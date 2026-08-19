import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canTransitionOrderStatus,
  canTransitionPaymentStatus,
  isOrderStatus,
  isPaymentStatus,
} from '../src/domain/orderStateMachine';

test('order status state machine accepts forward and idempotent transitions', () => {
  assert.equal(canTransitionOrderStatus('confirmed', 'confirmed'), true);
  assert.equal(canTransitionOrderStatus('confirmed', 'assembling'), true);
  assert.equal(canTransitionOrderStatus('confirmed', 'shipped'), true);
  assert.equal(canTransitionOrderStatus('assembling', 'shipped'), true);
  assert.equal(canTransitionOrderStatus('shipped', 'shipped'), true);
});

test('order status state machine rejects backwards and unknown transitions', () => {
  assert.equal(canTransitionOrderStatus('shipped', 'assembling'), false);
  assert.equal(canTransitionOrderStatus('cancelled', 'confirmed'), false);
  assert.equal(canTransitionOrderStatus('unknown', 'confirmed'), false);
  assert.equal(isOrderStatus('ordered'), false);
  assert.equal(isOrderStatus('delivered'), false);
  assert.equal(isOrderStatus('unknown'), false);
});

test('payment status state machine rejects reopening paid orders', () => {
  assert.equal(canTransitionPaymentStatus('unpaid', 'paid'), true);
  assert.equal(canTransitionPaymentStatus('paid', 'paid'), true);
  assert.equal(canTransitionPaymentStatus('paid', 'unpaid'), false);
  assert.equal(canTransitionPaymentStatus('paid', 'refunded'), true);
  assert.equal(isPaymentStatus('arbitrary'), false);
});
