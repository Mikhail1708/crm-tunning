import crypto from 'crypto';

const normalizeText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized || null;
};

const normalizePhone = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/\D/g, '') : '';

export const isValidExternalOrderId = (value: string): boolean =>
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value.trim());

export const buildExternalPayloadHash = (data: any): string => {
  const client = data.client || {};
  const semanticPayload = {
    items: data.items
      .map((item: any) => ({ productId: item.productId, quantity: item.quantity }))
      .sort((a: any, b: any) => a.productId - b.productId),
    client: {
      firstName: normalizeText(client.firstName),
      lastName: normalizeText(client.lastName),
      middleName: normalizeText(client.middleName),
      phone: normalizePhone(client.phone),
      email: normalizeText(client.email)?.toLowerCase() || null,
      city: normalizeText(client.city),
      address: normalizeText(client.address),
      preferredContact: normalizeText(client.preferredContact || data.contactMethod),
    },
    deliveryMethod: normalizeText(data.deliveryMethod),
    deliveryAddress: normalizeText(data.deliveryAddress),
    deliveryProvider: normalizeText(data.deliveryProvider),
    comment: normalizeText(data.comment),
    source: 'website',
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(semanticPayload))
    .digest('hex');
};
