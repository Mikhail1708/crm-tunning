// backend/src/services/databaseBackup.service.ts

import { Prisma, PrismaClient } from '@prisma/client';
import { newAuthGeneration } from './authRevocation.service';

const tables = {
  users: 'user',
  categories: 'category',
  categoryFields: 'categoryField',

  products: 'product',
  productKits: 'productKit',
  productKitItems: 'productKitItem',
  productCategories: 'productCategory',
  productCharacteristics: 'productCharacteristic',

  clients: 'client',

  saleDocuments: 'saleDocument',
  saleDocumentItems: 'saleDocumentItem',
  sales: 'sale',

  expenses: 'expense',

  productImages: 'productImage',
  priceHistory: 'priceHistory',

  inventoryReservations: 'inventoryReservation',
  inventoryReservationItems: 'inventoryReservationItem',

  crmStatusOutboxEvents: 'crmStatusOutboxEvent',
  invoiceAllocations: 'invoiceAllocation',
} as const;

type BackupTableKey = keyof typeof tables;

const runtimeKeys = [
  'productImages',
  'priceHistory',
  'inventoryReservations',
  'inventoryReservationItems',
  'crmStatusOutboxEvents',
  'invoiceAllocations',
] as const;

const bigintFields: Record<string, string[]> = {
  saleDocuments: ['paidAmountMinor'],
  inventoryReservations: ['totalMinor', 'paidAmountMinor'],
  inventoryReservationItems: ['unitPriceMinor', 'totalMinor'],
  invoiceAllocations: ['amountMinor'],
};

export class BackupError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'BackupError';
  }
}

/**
 * Блокируем все таблицы, участвующие в backup/restore.
 *
 * Restore заменяет состояние базы целиком, поэтому во время операции
 * нельзя позволять фоновой задаче/HTTP-запросу создавать новые строки.
 */
export async function lockBackupTables(
  tx: Prisma.TransactionClient
) {
  await tx.$executeRaw`
    LOCK TABLE
      "User",
      "Category",
      "CategoryField",

      "Product",
      "ProductKit",
      "ProductKitItem",
      "ProductCategory",
      "ProductCharacteristic",

      "Client",

      "SaleDocument",
      "SaleDocumentItem",
      "Sale",

      "Expense",

      "ProductImage",
      "PriceHistory",

      "InventoryReservation",
      "InventoryReservationItem",

      "CrmStatusOutboxEvent",
      "InvoiceAllocation"

    IN ACCESS EXCLUSIVE MODE
  `;
}

/**
 * Полная очистка данных перед restore.
 *
 * ВАЖНО:
 * ProductKitItem.componentProductId -> Product.id имеет onDelete: Restrict.
 *
 * Поэтому:
 *
 * ProductKitItem
 *      ↓
 * ProductKit
 *      ↓
 * Product
 *
 * Нарушать этот порядок нельзя.
 */
export async function clearBackupTables(
  tx: Prisma.TransactionClient
) {
  /*
   * Счета / резервы / outbox.
   */
  await tx.invoiceAllocation.deleteMany();

  await tx.inventoryReservationItem.deleteMany();
  await tx.inventoryReservation.deleteMany();

  await tx.crmStatusOutboxEvent.deleteMany();

  /*
   * Продажи.
   */
  await tx.saleDocumentItem.deleteMany();
  await tx.sale.deleteMany();
  await tx.saleDocument.deleteMany();

  /*
   * История/изображения/характеристики.
   */
  await tx.priceHistory.deleteMany();
  await tx.productImage.deleteMany();

  await tx.productCharacteristic.deleteMany();
  await tx.productCategory.deleteMany();

  /*
   * КОМПЛЕКТЫ.
   *
   * ProductKitItem ссылается:
   * - на ProductKit;
   * - на Product как componentProduct.
   *
   * Поэтому ProductKitItem обязательно удаляем ДО Product.
   */
  await tx.productKitItem.deleteMany();
  await tx.productKit.deleteMany();

  /*
   * Остальные сущности.
   */
  await tx.expense.deleteMany();
  await tx.client.deleteMany();

  /*
   * Теперь Product больше не имеет ProductKitItem RESTRICT-ссылок.
   */
  await tx.product.deleteMany();

  await tx.categoryField.deleteMany();
  await tx.category.deleteMany();

  /*
   * Текущих администраторов не удаляем.
   */
  await tx.user.deleteMany({
    where: {
      role: {
        not: 'admin',
      },
    },
  });
}

/**
 * Создание полного backup.
 */
export async function exportDatabaseBackup(
  db: PrismaClient
) {
  return db.$transaction(
    async tx => {
      const data: Record<string, any[]> = {};

      for (
        const [key, model] of Object.entries(tables)
      ) {
        const rows =
          await (tx[model] as any).findMany();

        data[key] = rows.map((row: any) => {
          const result = {
            ...row,
          };

          /*
           * JSON.stringify не умеет BigInt.
           * Храним денежные BigInt как строки.
           */
          for (
            const field of bigintFields[key] || []
          ) {
            if (result[field] != null) {
              result[field] =
                result[field].toString();
            }
          }

          /*
           * Buffer изображения -> base64.
           */
          if (
            key === 'productImages' &&
            result.data != null
          ) {
            result.data = Buffer
              .from(result.data)
              .toString('base64');
          }

          return result;
        });
      }

      return {
        version: '4.0',
        exportedAt: new Date().toISOString(),
        data,
      };
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel
          .RepeatableRead,

      timeout: 120_000,
    }
  );
}

/**
 * Восстановление backup.
 */
export async function restoreDatabaseBackup(
  db: PrismaClient,
  dump: any
) {
  /*
   * Основная проверка формата.
   */
  if (
    !dump ||
    !['3.0', '4.0'].includes(dump.version) ||
    !dump.data ||
    typeof dump.data !== 'object'
  ) {
    throw new BackupError(
      400,
      'Неверный формат дампа: ожидается версия 3.0 или 4.0'
    );
  }

  const legacy = dump.version === '3.0';

  /**
   * Старые backup v4 могли быть созданы ДО появления
   * InvoiceAllocation.
   *
   * Для v4 restore является полным восстановлением состояния.
   * Отсутствующая таблица означает, что в том snapshot данных
   * этой сущности ещё не было.
   */
  if (
    !legacy &&
    dump.data.invoiceAllocations === undefined
  ) {
    dump = {
      ...dump,

      data: {
        ...dump.data,
        invoiceAllocations: [],
      },
    };
  }

  /**
   * Аналогичная совместимость для ProductKit.
   *
   * Старые v4 backup могли быть созданы до появления
   * механизма комплектов.
   */
  if (
    !legacy &&
    dump.data.productKits === undefined
  ) {
    dump = {
      ...dump,

      data: {
        ...dump.data,
        productKits: [],
      },
    };
  }

  if (
    !legacy &&
    dump.data.productKitItems === undefined
  ) {
    dump = {
      ...dump,

      data: {
        ...dump.data,
        productKitItems: [],
      },
    };
  }

  /*
   * После нормализации v4 это практически всегда false,
   * но оставляем существующую совместимую логику.
   */
  const missingInvoices =
    dump.data.invoiceAllocations === undefined;

  /**
   * v3 не должен содержать новые runtime-таблицы.
   */
  if (
    legacy &&
    runtimeKeys.some(
      key =>
        dump.data[key] !== undefined &&
        (
          !Array.isArray(dump.data[key]) ||
          dump.data[key].length !== 0
        )
    )
  ) {
    throw new BackupError(
      400,
      'Runtime tables require backup version 4.0'
    );
  }

  /**
   * Проверяем структуру дампа.
   */
  for (
    const key of Object.keys(
      tables
    ) as BackupTableKey[]
  ) {
    if (
      key === 'invoiceAllocations' &&
      missingInvoices
    ) {
      continue;
    }

    /*
     * Формат v3 существовал до ProductKit.
     */
    if (
      legacy &&
      (
        key === 'productKits' ||
        key === 'productKitItems'
      )
    ) {
      continue;
    }

    /*
     * Runtime-таблиц в v3 нет.
     */
    if (
      legacy &&
      (
        runtimeKeys as readonly string[]
      ).includes(key)
    ) {
      continue;
    }

    if (
      !Array.isArray(dump.data[key]) ||
      dump.data[key].some(
        (row: any) =>
          !row ||
          typeof row !== 'object' ||
          Array.isArray(row)
      )
    ) {
      throw new BackupError(
        400,
        `Дамп не содержит обязательную таблицу: ${key}`
      );
    }
  }

  /**
   * Для v3 обязательно явное подтверждение старой политики.
   */
  if (
    legacy &&
    dump.legacyRuntimePolicy !==
      'require-empty'
  ) {
    throw new BackupError(
      409,
      'Дамп v3 не содержит резервы, outbox, изображения и историю цен. Требуется явное подтверждение legacyRuntimePolicy=require-empty'
    );
  }

  await db.$transaction(
    async tx => {
      /*
       * Сначала блокируем всё состояние.
       */
      await lockBackupTables(tx);

      /**
       * Защита legacy v3.
       *
       * v3 действительно не содержит runtime-таблицы.
       * Поэтому уничтожать существующие данные молча нельзя.
       */
      if (legacy) {
        for (const key of runtimeKeys) {
          if (
            await (
              tx[tables[key]] as any
            ).count()
          ) {
            throw new BackupError(
              409,
              'Восстановление v3 запрещено: отсутствующие в дампе таблицы содержат данные. Сначала нужен полный backup v4'
            );
          }
        }

        /**
         * v3 также ничего не знает о ProductKit.
         *
         * Если в текущей БД уже есть комплекты —
         * старый v3 backup не должен молча их уничтожать.
         */
        const currentProductKits =
          await tx.productKit.count();

        const currentProductKitItems =
          await tx.productKitItem.count();

        if (
          currentProductKits > 0 ||
          currentProductKitItems > 0
        ) {
          throw new BackupError(
            409,
            'Восстановление v3 запрещено: дамп не содержит комплекты товаров, а текущая база содержит их. Сначала нужен полный backup v4'
          );
        }
      }

      /**
       * Полное восстановление.
       *
       * Всё выполняется внутри одной транзакции.
       * Если дальше произойдёт ошибка —
       * PostgreSQL откатит очистку.
       */
      await clearBackupTables(tx);

      /**
       * clearBackupTables сохраняет admin.
       *
       * Получаем их после очистки и сопоставляем
       * admin ID из backup с существующим admin.
       */
      const preservedAdmins =
        await tx.user.findMany({
          where: {
            role: 'admin',
          },

          orderBy: {
            id: 'asc',
          },
        });

      const adminIds =
        new Map<number, number>();

      /**
       * Порядок восстановления имеет значение.
       *
       * Сначала создаются родители, потом дети.
       */
      const restoreOrder: BackupTableKey[] = [
        'users',

        'categories',
        'categoryFields',

        'products',

        /*
         * ProductKit требует Product.
         */
        'productKits',

        /*
         * ProductKitItem требует ProductKit + Product.
         */
        'productKitItems',

        'productCategories',
        'productCharacteristics',

        'clients',

        'saleDocuments',
        'saleDocumentItems',
        'sales',

        'expenses',

        'productImages',
        'priceHistory',

        'inventoryReservations',
        'inventoryReservationItems',

        'crmStatusOutboxEvents',

        'invoiceAllocations',
      ];

      for (const key of restoreOrder) {
        /*
         * Старый backup без InvoiceAllocation.
         */
        if (
          key === 'invoiceAllocations' &&
          missingInvoices
        ) {
          continue;
        }

        /*
         * v3 не содержит комплектов.
         */
        if (
          legacy &&
          (
            key === 'productKits' ||
            key === 'productKitItems'
          )
        ) {
          continue;
        }

        /*
         * v3 не содержит runtime tables.
         */
        if (
          legacy &&
          (
            runtimeKeys as readonly string[]
          ).includes(key)
        ) {
          continue;
        }

        const model = tables[key];

        for (
          const row of dump.data[key]
        ) {
          const data = {
            ...row,
          };

          /**
           * ADMIN.
           *
           * Существующего администратора не дублируем.
           */
          if (key === 'users') {
            if (
              data.role === 'admin'
            ) {
              const existing =
                preservedAdmins.find(
                  user =>
                    user.email ===
                    data.email
                ) ||
                preservedAdmins[0];

              if (existing) {
                adminIds.set(
                  data.id,
                  existing.id
                );

                continue;
              }
            }

            /*
             * После restore старые auth generation
             * не должны продолжать действовать.
             */
            data.authGeneration =
              newAuthGeneration();
          }

          /**
           * Поля, которые могут ссылаться на администратора.
           */
          for (
            const field of [
              'createdBy',
              'changedBy',
              'discountUpdatedBy',
            ]
          ) {
            if (
              adminIds.has(
                data[field]
              )
            ) {
              data[field] =
                adminIds.get(
                  data[field]
                );
            }
          }

          /**
           * Prisma различает SQL NULL и JSON null.
           */
          if (
            key === 'products' &&
            data.costBreakdown === null
          ) {
            data.costBreakdown =
              Prisma.DbNull;
          }

          if (
            key ===
              'invoiceAllocations' &&
            data.payload === null
          ) {
            data.payload =
              Prisma.DbNull;
          }

          /**
           * BigInt в JSON хранится строкой.
           */
          for (
            const field of
              bigintFields[key] || []
          ) {
            if (
              data[field] != null
            ) {
              if (
                typeof data[field] ===
                  'number' &&
                !Number.isSafeInteger(
                  data[field]
                )
              ) {
                throw new BackupError(
                  400,
                  'Large monetary values must be encoded as decimal strings'
                );
              }

              if (
                !/^-?\d+$/.test(
                  String(data[field])
                )
              ) {
                throw new BackupError(
                  400,
                  'Неверное денежное значение в дампе'
                );
              }

              data[field] =
                BigInt(data[field]);
            }
          }

          /**
           * ProductImage:
           * base64 обратно в Buffer.
           */
          if (
            key === 'productImages' &&
            data.data != null
          ) {
            if (
              typeof data.data !==
                'string' ||
              !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
                data.data
              )
            ) {
              throw new BackupError(
                400,
                'Неверные данные изображения в дампе'
              );
            }

            data.data =
              Buffer.from(
                data.data,
                'base64'
              );
          }

          /**
           * processing outbox принадлежал
           * процессу, который существовал до restore.
           *
           * После восстановления возвращаем его в pending.
           */
          if (
            key ===
              'crmStatusOutboxEvents' &&
            data.deliveryStatus ===
              'processing'
          ) {
            data.deliveryStatus =
              'pending';

            data.lockedAt = null;
          }

          await (
            tx[model] as any
          ).create({
            data,
          });
        }
      }

      /**
       * ID импортируются вручную.
       *
       * PostgreSQL sequence об этом не знает,
       * поэтому передвигаем sequence после restore.
       */
      const sequenceTables = [
        'User',
        'Category',
        'CategoryField',

        'Product',
        'ProductKit',
        'ProductKitItem',
        'ProductCharacteristic',

        'Client',

        'SaleDocument',
        'SaleDocumentItem',
        'Sale',

        'Expense',

        'ProductImage',
        'PriceHistory',
      ];

      for (
        const table of sequenceTables
      ) {
        const [row] =
          await tx.$queryRaw<
            Array<{
              next:
                | number
                | bigint
                | string;
            }>
          >(
            Prisma.sql`
              SELECT
                COALESCE(MAX(id), 0) + 1 AS next
              FROM ${Prisma.raw(
                `"${table}"`
              )}
            `
          );

        const next =
          Number(row.next);

        if (
          !Number.isSafeInteger(next) ||
          next < 1
        ) {
          throw new BackupError(
            400,
            `Неверная последовательность ID для ${table}`
          );
        }

        await tx.$executeRaw(
          Prisma.sql`
            ALTER SEQUENCE
            ${Prisma.raw(
              `"${table}_id_seq"`
            )}
            RESTART WITH
            ${Prisma.raw(
              String(next)
            )}
          `
        );
      }
    },
    {
      timeout: 120_000,
    }
  );
}

/**
 * Обычная очистка истории продаж —
 * НЕ то же самое, что restore.
 *
 * Здесь сохраняем защиту от уничтожения
 * активных резервов / счетов / outbox.
 */
export async function assertSalesHistoryCanBeCleared(
  tx: Prisma.TransactionClient
) {
  if (
    (
      await tx.inventoryReservation.count()
    ) ||
    (
      await tx.crmStatusOutboxEvent.count()
    ) ||
    (
      await tx.invoiceAllocation.count()
    )
  ) {
    throw new BackupError(
      409,
      'Очистка истории запрещена при наличии резервов, счетов или status outbox. Используйте штатную отмену заказов'
    );
  }
}