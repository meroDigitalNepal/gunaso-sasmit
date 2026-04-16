const test = require('node:test');
const assert = require('node:assert/strict');

const { createSubmissionsStore } = require('../store/submissionsStore');

function createQuery(result, calls) {
  return {
    select(columns = '*') {
      calls.push(['select', columns]);
      return this;
    },
    order(column, options) {
      calls.push(['order', column, options]);
      return this;
    },
    eq(column, value) {
      calls.push(['eq', column, value]);
      return this;
    },
    insert(payload) {
      calls.push(['insert', payload]);
      return this;
    },
    update(payload) {
      calls.push(['update', payload]);
      return this;
    },
    single() {
      calls.push(['single']);
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(result()).then(resolve, reject);
    },
  };
}

function createSupabaseStub(result) {
  const calls = [];

  return {
    calls,
    client: {
      from(table) {
        calls.push(['from', table]);
        return createQuery(result, calls);
      },
    },
  };
}

test('store getAll applies filters and converts rows to camelCase', async () => {
  const { client, calls } = createSupabaseStub(() => ({
    data: [
      {
        id: 'submission-1',
        tracking_id: 'tracking-1',
        title: 'Clinic issue',
        status: 'new',
        created_at: '2026-03-01T00:00:00.000Z',
        updated_at: '2026-03-01T00:00:00.000Z',
        public_response: null,
        internal_notes: null,
      },
    ],
    error: null,
  }));
  const store = createSubmissionsStore(client);

  const submissions = await store.getAll({ status: 'new', category: 'health' });

  assert.deepEqual(submissions, [
    {
      id: 'submission-1',
      trackingId: 'tracking-1',
      title: 'Clinic issue',
      status: 'new',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
      publicResponse: null,
      internalNotes: null,
    },
  ]);
  assert.deepEqual(calls, [
    ['from', 'submissions'],
    ['select', '*'],
    ['order', 'created_at', { ascending: false }],
    ['eq', 'status', 'new'],
    ['eq', 'category', 'health'],
  ]);
});

test('store create writes snake_case payloads and returns camelCase data', async () => {
  const { client, calls } = createSupabaseStub(() => ({
    data: {
      id: 'submission-1',
      tracking_id: 'tracking-1',
      title: 'Pothole',
      category: 'infrastructure',
      status: 'new',
      created_at: '2026-03-01T00:00:00.000Z',
      updated_at: '2026-03-01T00:00:00.000Z',
      public_response: null,
      internal_notes: null,
    },
    error: null,
  }));
  const store = createSubmissionsStore(client);

  const created = await store.create({
    id: 'submission-1',
    trackingId: 'tracking-1',
    title: 'Pothole',
    category: 'infrastructure',
    status: 'new',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    publicResponse: null,
    internalNotes: null,
  });

  assert.equal(created.trackingId, 'tracking-1');
  assert.deepEqual(calls, [
    ['from', 'submissions'],
    ['insert', {
      id: 'submission-1',
      tracking_id: 'tracking-1',
      title: 'Pothole',
      category: 'infrastructure',
      status: 'new',
      created_at: '2026-03-01T00:00:00.000Z',
      updated_at: '2026-03-01T00:00:00.000Z',
      public_response: null,
      internal_notes: null,
    }],
    ['select', '*'],
    ['single'],
  ]);
});

test('store update returns null for Supabase not-found responses', async () => {
  const { client } = createSupabaseStub(() => ({
    data: null,
    error: { code: 'PGRST116', message: 'No rows found' },
  }));
  const store = createSubmissionsStore(client);

  const updated = await store.update('missing-id', { status: 'resolved' });

  assert.equal(updated, null);
});
