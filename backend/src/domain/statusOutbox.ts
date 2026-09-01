export const DEFAULT_STATUS_OUTBOX_RETRY_BASE_MS = 1_000;
export const DEFAULT_STATUS_OUTBOX_RETRY_MAX_MS = 15 * 60_000;

const configuredInteger = (value: string | undefined, fallback: number, minimum: number): number => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum ? parsed : fallback;
};

export const statusOutboxRetryBaseMs = (): number => configuredInteger(
  process.env.CRM_STATUS_OUTBOX_RETRY_BASE_MS,
  DEFAULT_STATUS_OUTBOX_RETRY_BASE_MS,
  100,
);

export const statusOutboxRetryMaxMs = (): number => configuredInteger(
  process.env.CRM_STATUS_OUTBOX_RETRY_MAX_MS,
  DEFAULT_STATUS_OUTBOX_RETRY_MAX_MS,
  statusOutboxRetryBaseMs(),
);

export const statusOutboxRetryDelayMs = (
  attempts: number,
  baseMs = statusOutboxRetryBaseMs(),
  maxMs = statusOutboxRetryMaxMs(),
): number => {
  const safeAttempts = Math.max(1, Math.min(Math.trunc(attempts), 31));
  return Math.min(baseMs * (2 ** (safeAttempts - 1)), maxMs);
};

export const crmStatusEventId = (saleDocumentId: number, statusVersion: number): string =>
  `crm-order-status:${saleDocumentId}:v${statusVersion}`;

