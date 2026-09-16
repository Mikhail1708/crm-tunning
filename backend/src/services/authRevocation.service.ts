import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';

export const newAuthGeneration = (): string => randomUUID();

export const isAuthGeneration = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);

// One atomic write, not read-modify-write. Concurrent revokes each write a fresh
// generation, so none can restore an earlier generation. Also usable in a future
// password-change transaction (pass its Prisma transaction client).
export const revokeUserTokens = async (db: Pick<PrismaClient, 'user'>, userId: number): Promise<void> => {
  await db.user.update({
    where: { id: userId },
    data: { authGeneration: newAuthGeneration() },
    select: { id: true },
  });
};
