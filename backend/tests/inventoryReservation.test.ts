import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildReservationPayloadHash,
  minorUnitsForJson,
  normalizeReservationItems,
  parseMinorUnits,
  toMinorUnits,
} from '../src/domain/inventoryReservation';

test('reservation items are validated and normalized deterministically', () => {
  assert.deepEqual(
    normalizeReservationItems([
      { productId: 9, quantity: 1, price: -100 },
      { productId: 2, quantity: 3, price: 999999 },
    ]),
    [
      { productId: 2, quantity: 3 },
      { productId: 9, quantity: 1 },
    ],
  );
  assert.equal(normalizeReservationItems([]), null);
  assert.equal(normalizeReservationItems([{ productId: 1, quantity: 0 }]), null);
  assert.equal(normalizeReservationItems([
    { productId: 1, quantity: 1 },
    { productId: 1, quantity: 2 },
  ]), null);
});

test('reservation hash is stable for item order and excludes untrusted prices', () => {
  const left = normalizeReservationItems([
    { productId: 2, quantity: 1, price: 1 },
    { productId: 1, quantity: 2, price: 2 },
  ])!;
  const right = normalizeReservationItems([
    { productId: 1, quantity: 2, price: 20000 },
    { productId: 2, quantity: 1, price: -1 },
  ])!;
  assert.equal(
    buildReservationPayloadHash('order-1', 'RUB', left),
    buildReservationPayloadHash('order-1', 'RUB', right),
  );
  assert.notEqual(
    buildReservationPayloadHash('order-1', 'RUB', left),
    buildReservationPayloadHash('order-2', 'RUB', left),
  );
});

test('money conversion rounds once to integer minor units', () => {
  assert.equal(toMinorUnits(125.505), 12551n);
  assert.equal(toMinorUnits(0), 0n);
  assert.throws(() => toMinorUnits(-1));
  assert.throws(() => toMinorUnits(Number.POSITIVE_INFINITY));
});

test('paid minor units accept only safe non-negative integers', () => {
  assert.equal(parseMinorUnits(12551), 12551n);
  assert.equal(parseMinorUnits(-1), null);
  assert.equal(parseMinorUnits(1.5), null);
  assert.equal(parseMinorUnits('12551'), null);
  assert.equal(parseMinorUnits(Number.MAX_SAFE_INTEGER + 1), null);
});

test('BigInt response values cannot silently lose precision', () => {
  assert.equal(minorUnitsForJson(12551n), 12551);
  assert.throws(() => minorUnitsForJson(BigInt(Number.MAX_SAFE_INTEGER) + 1n));
});
