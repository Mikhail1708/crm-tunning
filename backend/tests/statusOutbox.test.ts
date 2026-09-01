import assert from 'node:assert/strict';
import test from 'node:test';
import { crmStatusEventId, statusOutboxRetryDelayMs } from '../src/domain/statusOutbox';

test('CRM status outbox IDs are deterministic per authoritative version', () => {
  assert.equal(crmStatusEventId(42, 3), 'crm-order-status:42:v3');
  assert.equal(crmStatusEventId(42, 3), crmStatusEventId(42, 3));
  assert.notEqual(crmStatusEventId(42, 3), crmStatusEventId(42, 4));
});

test('CRM status outbox retry uses capped exponential backoff', () => {
  assert.equal(statusOutboxRetryDelayMs(1, 100, 1_000), 100);
  assert.equal(statusOutboxRetryDelayMs(2, 100, 1_000), 200);
  assert.equal(statusOutboxRetryDelayMs(4, 100, 1_000), 800);
  assert.equal(statusOutboxRetryDelayMs(10, 100, 1_000), 1_000);
});

