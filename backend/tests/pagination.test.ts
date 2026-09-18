import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePagination } from '../src/utils/pagination';

test('pagination defaults, exact maximum and huge finite limit', () => {
  assert.deepEqual(parsePagination(undefined, undefined, 20, 1000), { page: 1, limit: 20, skip: 0 });
  assert.deepEqual(parsePagination('2', '1000', 20, 1000), { page: 2, limit: 1000, skip: 1000 });
  assert.deepEqual(parsePagination('3', '1000000000', 20, 1000), { page: 3, limit: 1000, skip: 2000 });
});

for (const input of [-1, 0, 'abc', '1.5', 1.5, Infinity, NaN, 'Infinity', 'NaN',
  Number.MAX_SAFE_INTEGER + 1, '9007199254740992', [], ['2'], {}, null, true, '', '2abc']) {
  test(`pagination invalid input ${JSON.stringify(input)} (${typeof input}) uses defaults`, () => {
    assert.deepEqual(parsePagination(input, input, 20, 1000), { page: 1, limit: 20, skip: 0 });
  });
}

test('offset application boundary and overflow reset page without unsafe arithmetic', () => {
  assert.equal(parsePagination(50001, 20, 20, 1000).skip, 1_000_000);
  for (const page of [50002, 1e9, Number.MAX_SAFE_INTEGER]) {
    const result = parsePagination(page, 20, 20, 1000);
    assert.equal(result.page, 1);
    assert.equal(result.skip, 0);
    assert.ok(Number.isSafeInteger(result.skip));
  }
});
