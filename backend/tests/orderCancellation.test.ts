import assert from 'node:assert/strict';
import test from 'node:test';
import { decideOrderCancellation } from '../src/domain/orderCancellation';

test('CRM accepts cancellable and already-cancelled fulfillment states', () => {
  assert.deepEqual(decideOrderCancellation('confirmed'), {
    decision: 'accepted',
    reasonCode: 'CANCELLATION_ACCEPTED',
  });
  assert.deepEqual(decideOrderCancellation('assembling'), {
    decision: 'accepted',
    reasonCode: 'CANCELLATION_ACCEPTED',
  });
  assert.deepEqual(decideOrderCancellation('cancelled'), {
    decision: 'accepted',
    reasonCode: 'ALREADY_CANCELLED',
  });
});

test('CRM rejects cancellation after fulfillment shipped', () => {
  assert.deepEqual(decideOrderCancellation('shipped'), {
    decision: 'rejected',
    reasonCode: 'FULFILLMENT_ALREADY_SHIPPED',
  });
  assert.deepEqual(decideOrderCancellation('unknown'), {
    decision: 'rejected',
    reasonCode: 'CANCELLATION_NOT_ALLOWED',
  });
});

