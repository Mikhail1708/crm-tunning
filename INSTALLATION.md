# Установка и запуск SalesCore CRM

> **SalesCore CRM — Installation & Development Guide**
>
> Руководство по подготовке окружения, установке зависимостей, настройке PostgreSQL, Prisma, запуску приложения и диагностике ошибок.
>
> **Текущее ограничение:** репозиторий пока не обеспечивает полностью автоматический запуск с нуля. Отсутствуют `backend/Dockerfile` и backend-скрипт `dev`. Перед полноценным развёртыванием эти компоненты необходимо реализовать и проверить.

---

## 1. О проекте

SalesCore CRM — внутренняя система управления продажами, товарами, клиентами, складскими остатками и аналитикой SWAPSERVICE38.

Приложение состоит из:

- **Frontend:** React 19, TypeScript, Vite 8.
- **Backend:** Node.js, Express 4, TypeScript.
- **Database:** PostgreSQL 15, Prisma 5.
- **Infrastructure:** Docker Compose, nginx.
- **Monitoring:** Prometheus, Grafana, Node Exporter.

Frontend и backend имеют отдельные зависимости и процессы запуска.

## 2. Системные требования

Рекомендуемое окружение разработки:

| Компонент | Требование |
|---|---|
| ОС | Windows 10/11 или Linux |
| Node.js | Версия, совместимая с Vite 8 и backend |
| npm | Совместимая с Node.js |
| PostgreSQL | 15 |
| Docker | Для контейнерного запуска |
| Docker Compose | Современная версия плагина |
| Git | Для получения исходников |

Для Vite 8 необходима совместимая современная версия Node.js. Backend использует типы Node.js 20, однако это само по себе не фиксирует минимальную runtime-версию.

Проверить инструменты:

```bash
node --version
npm --version
git --version
docker --version
docker compose version
```

Для разработки на Windows рекомендуется PowerShell или терминал VS Code.

## 3. Клонирование репозитория

```bash
git clone https://github.com/Mikhail1708/crm-tunning.git
cd crm-tunning
```

Если требуется явно выбрать текущую основную рабочую ветку:

```bash
git switch feature/edit-order
```

> Исторически проект использовал `main`. Перед развёртыванием необходимо проверять актуальную основную ветку и настройки CI/CD.

## 4. Структура проекта

```text
crm-tunning/
├── .github/
│   └── workflows/
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   ├── seed.js
│   │   └── seed.ts
│   ├── src/
│   ├── tests/
│   └── package.json
├── frontend/
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── prometheus/
├── scripts/
├── .env.example
├── docker-compose.yml
├── README.md
├── ARCHITECTURE.md
├── BACKUP_RESTORE.md
└── SECURITY.md
```

## 5. Установка зависимостей

В проекте находятся три `package.json`:

- Корневой — общие команды.
- `backend/package.json` — сервер.
- `frontend/package.json` — интерфейс.

Для установки зависимостей предусмотрена команда:

```bash
npm run install:all
```

Однако при первом клонировании корневые зависимости ещё не установлены.

Поэтому более предсказуемый способ — установка отдельно:

```bash
npm install
cd backend
npm install
cd ../frontend
npm install
```

Если присутствуют актуальные lock-файлы, для воспроизводимой установки предпочтительно использовать `npm ci`.

## 6. Переменные окружения

В корне репозитория находится шаблон:

`.env.example`

Для локального окружения можно создать отдельный `.env`.

### Windows PowerShell

```powershell
Copy-Item .env.example .env
```

### Linux

```bash
cp .env.example .env
```

Не используйте реальные production-секреты в локальном окружении.

### PostgreSQL

```dotenv
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<local-database-password>
POSTGRES_DB=crm_db
DATABASE_URL=postgresql://postgres:<local-database-password>@db:5432/crm_db
```

**Важно:** адрес `db` работает внутри сети Docker Compose.

При запуске backend непосредственно на компьютере обычно используется `localhost` и соответствующий порт PostgreSQL.

### JWT

```dotenv
JWT_SECRET=<unique-local-secret>
```

### Внутренний API

```dotenv
INTERNAL_API_KEY=<unique-local-api-key>
```

### Webhook

```dotenv
SITE_WEBHOOK_URL=<safe-test-endpoint>
WEBHOOK_SECRET=<unique-local-webhook-secret>
```

Не направляйте локальные тестовые события на рабочий сайт.

### Outbox

```dotenv
CRM_STATUS_OUTBOX_POLL_MS=1000
CRM_STATUS_OUTBOX_STALE_MS=60000
CRM_STATUS_OUTBOX_RETRY_BASE_MS=1000
CRM_STATUS_OUTBOX_RETRY_MAX_MS=900000
```

### Grafana

```dotenv
GRAFANA_PASSWORD=<local-grafana-password>
```

Значения в угловых скобках являются обозначениями параметров и должны заменяться реальными локальными значениями. Они не предназначены для непосредственного запуска.

## 7. Настройка PostgreSQL

В `docker-compose.yml` предусмотрен контейнер PostgreSQL 15.

Сервис называется:

`db`

Имя контейнера:

`crm-db`

Порт:

`5432`

Данные хранятся в именованном Docker volume:

`postgres_data`

### Запуск только базы данных

После подготовки локального `.env`:

```bash
docker compose up -d db
```

Это запускает только PostgreSQL, без CRM и сервисов мониторинга.

Проверить состояние:

```bash
docker compose ps db
```

### Важное замечание

Контейнер публикует порт `5432` на хосте.

На публичном сервере такая настройка требует отдельной защиты сетевого доступа.

Локальную тестовую базу следует изолировать от production.

## 8. Prisma ORM

Backend использует Prisma 5.

Схема данных:

`backend/prisma/schema.prisma`

Миграции:

`backend/prisma/migrations/`

### Генерация Prisma Client

Из папки backend:

```bash
npx prisma generate
```

### Применение миграций

Для локальной разработки предусмотрена корневая команда:

```bash
npm run migrate
```

Она вызывает:

```bash
npx prisma migrate dev
```

**Не используйте `migrate dev` для автоматического обновления production.**

Для production-процессов требуется отдельно проверенная процедура применения существующих миграций.

### Prisma Studio

Из корня проекта:

```bash
npm run studio
```

Studio позволяет просматривать данные через интерфейс Prisma.

Не предоставляйте к нему публичный доступ.

### Опасная команда

В корневом `package.json` присутствует:

```bash
npm run clear:db
```

Она вызывает:

```bash
npx prisma migrate reset --force
```

**Команда удаляет данные базы.**

Не выполняйте её на production или на базе с важной информацией.

## 9. Локальный запуск backend

Backend написан на TypeScript.

Подтверждённые команды:

```bash
cd backend
npm run build
npm start
```

`npm run build` выполняет компиляцию через `tsc`.

`npm start` запускает:

```bash
node dist/server.js
```

### Конфигурация

Перед запуском необходимо:

1. Подготовить доступную PostgreSQL.
2. Указать корректный `DATABASE_URL`.
3. Настроить JWT-секрет.
4. Настроить остальные необходимые параметры окружения.
5. Применить миграции.
6. Проверить, что backend читает конфигурацию из ожидаемого места.

В текущем `server.ts` вызывается `dotenv.config()`. При прямом запуске из `backend/` обычно используется файл `backend/.env` либо переменные окружения процесса.

Корневой `.env`, используемый Docker Compose, не следует автоматически считать конфигурацией отдельно запущенного backend.

### Проверка доступности

После успешного запуска API можно проверить:

```text
http://localhost:5000/api/health
```

Ожидаемый формат ответа:

```json
{
  "status": "OK",
  "timestamp": "...",
  "env": "development"
}
```

Healthcheck подтверждает работу HTTP-процесса, но не является полной проверкой всех интеграций.

## 10. Локальный запуск frontend

Перейдите в каталог frontend:

```bash
cd frontend
npm run dev
```

Vite запускает сервер разработки.

Типичный адрес:

```text
http://localhost:5173
```

Фактический адрес необходимо брать из вывода Vite.

### Подключение к API

Frontend использует переменную:

`VITE_API_URL`

При локальном запуске без reverse proxy может потребоваться отдельный `frontend/.env.local`:

```dotenv
VITE_API_URL=http://localhost:5000/api
```

Backend должен разрешать origin frontend и корректно обрабатывать авторизацию и cookie в выбранной конфигурации.

### Сборка

```bash
npm run build
```

### Предпросмотр сборки

```bash
npm run preview
```

### ESLint

```bash
npm run lint
```

## 11. Корневые команды

Корневой `package.json` содержит следующие сценарии:

| Команда | Назначение |
|---|---|
| `npm run dev` | Совместный запуск frontend/backend |
| `npm run dev:network` | Запуск с сетевым доступом к frontend |
| `npm run backend` | Запуск backend dev |
| `npm run frontend` | Запуск frontend dev |
| `npm run build` | Сборка frontend |
| `npm run preview` | Предпросмотр frontend |
| `npm run install:all` | Установка зависимостей |
| `npm run migrate` | Prisma migrate dev |
| `npm run studio` | Prisma Studio |
| `npm run clear:db` | Сброс базы данных |

### Известное ограничение

Корневой скрипт:

```bash
npm run dev
```

вызывает:

```bash
cd backend && npm run dev
```

Но в текущем `backend/package.json` отсутствует скрипт `dev`.

Поэтому совместный запуск необходимо исправить перед тем, как рекомендовать его как рабочую команду.

## 12. Docker Compose

В проекте предусмотрены следующие сервисы:

| Сервис | Контейнер | Порт хоста |
|---|---|---|
| PostgreSQL | `crm-db` | 5432 |
| Backend | `crm-backend` | 5000 |
| Frontend | `crm-frontend` | 8080 |
| Prometheus | `prometheus` | 9090 |
| Grafana | `grafana` | 3000 |
| Node Exporter | `node-exporter` | 9100 |

### Проверка конфигурации

После заполнения локального `.env`:

```bash
docker compose config --quiet
```

Эта команда проверяет разрешение конфигурации Compose, но не гарантирует успешную сборку и запуск приложения.

Не публикуйте полный вывод `docker compose config`, если он содержит подставленные секреты.

### Ограничение сборки

Текущий Compose содержит:

```yaml
backend:
  build: ./backend
```

Однако в предоставленном состоянии репозитория отсутствует:

`backend/Dockerfile`

Поэтому полноценная сборка backend через Docker Compose из чистого клона пока не поддерживается.

### Конфигурация frontend

В репозитории присутствует:

`frontend/Dockerfile`

При этом необходимо отдельно проверить, что production-конфигурация nginx корректно обрабатывает SPA-маршруты и проксирование `/api`.

### Production-параметры

Compose задаёт:

```text
NODE_ENV=production
BASE_URL=https://swapcrm38.ru
COOKIE_DOMAIN=.swapcrm38.ru
```

Эти значения привязаны к рабочему домену.

Для локального контейнерного запуска требуется отдельная адаптация конфигурации, чтобы не смешивать тестовое окружение с production.

## 13. Фоновые процессы

При запуске backend активируются:

- Обработчик истечения складских резервов.
- Диспетчер событий status outbox.

Их запуск происходит из `server.ts`.

Это означает, что даже локальный экземпляр backend может выполнять фоновые операции.

**Не подключайте тестовый backend к production-базе или рабочему webhook.**

## 14. Тестирование

Backend использует встроенный тестовый механизм Node.js.

Из каталога backend:

```bash
npm test
```

Команда запускает тесты из:

`backend/tests/`

Для frontend предусмотрены:

```bash
npm run lint
npm run build
```

Перед публикацией изменений рекомендуется проверять сборку и соответствующие тесты.

## 15. Мониторинг

Docker Compose включает Prometheus, Grafana и Node Exporter.

Порты по умолчанию:

- Prometheus — `9090`.
- Grafana — `3000`.
- Node Exporter — `9100`.

Для Grafana требуется `GRAFANA_PASSWORD`.

Наличие контейнеров мониторинга не означает, что backend автоматически предоставляет все необходимые метрики.

Источники данных Prometheus определяются файлом:

`prometheus/prometheus.yml`

## 16. Частые проблемы

### Backend не запускается через npm run dev

Причина: в backend отсутствует соответствующий скрипт.

Решение: использовать подтверждённые команды сборки и запуска либо отдельно реализовать dev-сценарий.

### Docker не собирает backend

Причина: отсутствует `backend/Dockerfile`.

Решение: подготовить и протестировать Dockerfile с учётом сборки TypeScript, Prisma и запуска сервера.

### Ошибка подключения к PostgreSQL

Проверьте:

- Работает ли контейнер.
- Правильный ли hostname.
- Соответствуют ли логин и пароль.
- Применены ли миграции.
- Используется ли правильная база.

В Docker Compose hostname базы — `db`.

При прямом запуске с хоста обычно используется `localhost`.

### Frontend не обращается к API

Проверьте:

- `VITE_API_URL`.
- Доступность backend.
- CORS.
- Cookie.
- CSRF.
- Настройки reverse proxy.

### Ошибка авторизации

Проверьте конфигурацию JWT, cookie и фактический адрес приложения.

### Не работает синхронизация с сайтом

Проверьте:

- `SITE_WEBHOOK_URL`.
- `WEBHOOK_SECRET`.
- Доступность endpoint.
- Состояние outbox.
- Журналы backend.

Не используйте production-интеграцию для локальных экспериментов.

## 17. Безопасность

Необходимо соблюдать следующие правила:

- Не публиковать `.env`.
- Не хранить действующие токены в Git.
- Не использовать production-базу для разработки.
- Не запускать destructive-команды без резервной копии.
- Не публиковать PostgreSQL без сетевых ограничений.
- Не направлять тестовые webhook в рабочий магазин.
- Не удалять Docker volumes при обычном обновлении.

Дополнительная информация:

[SECURITY.md](SECURITY.md)

## 18. Подготовка к production

Перед развёртыванием нового экземпляра необходимо:

1. Подготовить и проверить Dockerfile backend.
2. Проверить nginx-конфигурацию frontend.
3. Убедиться в наличии всех секретов.
4. Настроить HTTPS и домен.
5. Проверить PostgreSQL и миграции.
6. Проверить авторизацию.
7. Проверить работу каталога и склада.
8. Проверить фоновые обработчики.
9. Проверить интеграцию с сайтом.
10. Настроить резервное копирование.
11. Выполнить тестовое восстановление.
12. Проверить правила CI/CD.

Этот список является контрольным перечнем, а не автоматической процедурой production-развёртывания.

---

## Документация

- [README.md](README.md) — обзор проекта.
- [ARCHITECTURE.md](ARCHITECTURE.md) — архитектура.
- [SECURITY.md](SECURITY.md) — безопасность.
- [BACKUP_RESTORE.md](BACKUP_RESTORE.md) — резервное копирование.

---

**SalesCore CRM**

*Development × Infrastructure × Reliability*

Разработчик: [Mikhail1708](https://github.com/Mikhail1708)
