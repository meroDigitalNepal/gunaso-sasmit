const test = require('node:test');
const assert = require('node:assert/strict');

const { createSubmissionsStore } = require('../store/submissionsStore');

const MP_ID = 'parl-001';

function createMockPool(result) {
  const calls = [];
  return {
    calls,
    query(sql, params) {
      calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      return Promise.resolve(result);
    },
  };
}

test('store getAll scopes to mpId and applies filters', async () => {
  const pool = createMockPool({ rows: [
    {
      id: 'sub-1',
      tracking_id: 'tracking-1',
      mp_id: MP_ID,
      title: 'Clinic issue',
      category: 'health',
      description: 'Needs review',
      contact_email: null,
      status: 'new',
      created_at: '2026-03-01T00:00:00.000Z',
      updated_at: '2026-03-01T00:00:00.000Z',
      public_response: null,
      internal_notes: null,
    },
  ] });

  const store = createSubmissionsStore(pool);
  const results = await store.getAll(MP_ID, { status: 'new', category: 'health' });

  assert.equal(results.length, 1);
  assert.equal(results[0].trackingId, 'tracking-1');
  assert.equal(results[0].mpId, undefined, 'mpId should not leak to camelCase output');

  const { sql, params } = pool.calls[0];
  assert.match(sql, /WHERE mp_id = \$1/);
  assert.match(sql, /status = \$2/);
  assert.match(sql, /category = \$3/);
  assert.deepEqual(params, [MP_ID, 'new', 'health']);
});

test('store getAll with no filters only scopes by mpId', async () => {
  const pool = createMockPool({ rows: [] });
  const store = createSubmissionsStore(pool);

  await store.getAll(MP_ID);

  const { sql, params } = pool.calls[0];
  assert.match(sql, /WHERE mp_id = \$1/);
  assert.equal(params.length, 1);
});

test('store create inserts with mp_id and returns camelCase', async () => {
  const submissionRow = {
    id: 'sub-1',
    tracking_id: 'tracking-1',
    mp_id: MP_ID,
    title: 'Pothole',
    category: 'infrastructure',
    description: 'Large pothole.',
    contact_email: null,
    status: 'new',
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
    public_response: null,
    internal_notes: null,
  };
  const pool = createMockPool({ rows: [submissionRow] });
  const store = createSubmissionsStore(pool);

  const result = await store.create(MP_ID, {
    id: 'sub-1',
    trackingId: 'tracking-1',
    title: 'Pothole',
    category: 'infrastructure',
    description: 'Large pothole.',
    contactEmail: null,
    status: 'new',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    publicResponse: null,
    internalNotes: null,
  });

  assert.equal(result.trackingId, 'tracking-1');

  const { sql, params } = pool.calls[0];
  assert.match(sql, /INSERT INTO submissions/);
  assert.match(sql, /RETURNING \*/);
  assert.ok(params.includes(MP_ID), 'mp_id must be in INSERT params');
});

test('store update scopes WHERE clause to mpId', async () => {
  const pool = createMockPool({ rows: [
    {
      id: 'sub-1',
      tracking_id: 'tracking-1',
      mp_id: MP_ID,
      title: 'Water leak',
      category: 'infrastructure',
      description: 'Leak near the park.',
      contact_email: null,
      status: 'resolved',
      created_at: '2026-03-01T00:00:00.000Z',
      updated_at: '2026-03-02T00:00:00.000Z',
      public_response: 'Fixed.',
      internal_notes: null,
    },
  ] });
  const store = createSubmissionsStore(pool);

  const result = await store.update(MP_ID, 'sub-1', { status: 'resolved', category: 'infrastructure', publicResponse: 'Fixed.' });

  assert.equal(result.status, 'resolved');

  const { sql, params } = pool.calls[0];
  assert.match(sql, /WHERE id = \$\d+ AND mp_id = \$\d+/);
  assert.ok(params.includes('sub-1'));
  assert.ok(params.includes(MP_ID));
  assert.ok(params.includes('infrastructure'), 'category must be forwarded into the UPDATE params');
});

test('store update returns null when no rows matched', async () => {
  const pool = createMockPool({ rows: [] });
  const store = createSubmissionsStore(pool);

  const result = await store.update(MP_ID, 'missing-id', { status: 'resolved' });

  assert.equal(result, null);
});

test('store getById scopes to mpId', async () => {
  const pool = createMockPool({ rows: [] });
  const store = createSubmissionsStore(pool);

  await store.getById(MP_ID, 'sub-1');

  const { sql, params } = pool.calls[0];
  assert.match(sql, /WHERE id = \$1 AND mp_id = \$2/);
  assert.deepEqual(params, ['sub-1', MP_ID]);
});

test('store getByTrackingId scopes to mpId', async () => {
  const pool = createMockPool({ rows: [] });
  const store = createSubmissionsStore(pool);

  await store.getByTrackingId(MP_ID, 'TRACK-001');

  const { sql, params } = pool.calls[0];
  assert.match(sql, /WHERE tracking_id = \$1 AND mp_id = \$2/);
  assert.deepEqual(params, ['TRACK-001', MP_ID]);
});
