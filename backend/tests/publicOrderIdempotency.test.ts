import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildExternalPayloadHash,
  isValidExternalOrderId,
} from '../src/domain/publicOrderIdempotency';

const payload = {
  items: [
    { productId: 2, quantity: 1, price: 1 },
    { productId: 1, quantity: 3, price: 999999 },
  ],
  client: {
    firstName: ' Ivan ',
    lastName: 'Petrov',
    phone: '+7 (999) 123-45-67',
    email: 'USER@EXAMPLE.COM',
  },
  deliveryMethod: ' courier ',
  deliveryAddress: 'Main street 1',
  comment: 'Call first',
  source: 'website',
};

test('payload hash is stable for item order, formatting and untrusted prices', () => {
  const retry = {
    ...payload,
    items: [
      { productId: 1, quantity: 3, price: -1 },
      { productId: 2, quantity: 1, price: 500 },
    ],
    client: {
      ...payload.client,
      firstName: 'Ivan',
      phone: '79991234567',
      email: 'user@example.com',
    },
    deliveryMethod: 'courier',
  };

  assert.equal(buildExternalPayloadHash(retry), buildExternalPayloadHash(payload));
});

test('payload hash detects semantic conflicts', () => {
  assert.notEqual(
    buildExternalPayloadHash({ ...payload, items: [{ productId: 2, quantity: 2 }] }),
    buildExternalPayloadHash(payload)
  );
  assert.notEqual(
    buildExternalPayloadHash({ ...payload, deliveryAddress: 'Another address' }),
    buildExternalPayloadHash(payload)
  );
});

test('external order id validation is bounded and predictable', () => {
  assert.equal(isValidExternalOrderId('site-order:123_ABC'), true);
  assert.equal(isValidExternalOrderId(''), false);
  assert.equal(isValidExternalOrderId('contains spaces'), false);
  assert.equal(isValidExternalOrderId('x'.repeat(129)), false);
});
