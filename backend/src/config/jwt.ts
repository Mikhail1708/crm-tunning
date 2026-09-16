// Read after dotenv.config(); never include secret values in errors or logs.
export const getJwtSecret = (env: NodeJS.ProcessEnv = process.env): string => {
  const secret = env.JWT_SECRET;
  if (!secret || !secret.trim()) {
    throw new Error('JWT_SECRET is required');
  }
  if (env.NODE_ENV === 'production' && Buffer.byteLength(secret.trim(), 'utf8') < 32) {
    throw new Error('JWT_SECRET must contain at least 32 bytes in production');
  }
  return secret;
};

export const CRM_JWT_ALGORITHM = 'HS256' as const;
