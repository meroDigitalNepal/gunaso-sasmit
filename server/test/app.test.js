const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const createApp = require('../index');

function createMemoryStore(initialSubmissions = []) {
  const submissions = [...initialSubmissions];

  return {
    submissions,
    lastFilters: null,
    async getAll(filters = {}) {
      this.lastFilters = filters;
      return submissions.filter(submission => {
        if (filters.status && submission.status !== filters.status) return false;
        if (filters.category && submission.category !== filters.category) return false;
        return true;
      });
    },
    async getById(id) {
      return submissions.find(submission => submission.id === id) || null;
    },
    async getByTrackingId(trackingId) {
      return submissions.find(submission => submission.trackingId === trackingId) || null;
    },
    async create(submission) {
      submissions.push(submission);
      return submission;
    },
    async update(id, updates) {
      const index = submissions.findIndex(submission => submission.id === id);
      if (index === -1) return null;
      submissions[index] = {
        ...submissions[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      return submissions[index];
    },
  };
}

test('POST /api/submissions creates a new submission with defaults', async () => {
  const store = createMemoryStore();
  const app = createApp(store);

  const response = await request(app)
    .post('/api/submissions')
    .send({
      title: 'Broken streetlight',
      category: 'infrastructure',
      description: 'The lamp has been off for 2 weeks.',
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.status, 'new');
  assert.match(response.body.id, /^[0-9a-f-]{36}$/i);
  assert.match(response.body.trackingId, /^[0-9a-f-]{36}$/i);
  assert.equal(response.body.contactEmail, null);
  assert.equal(response.body.publicResponse, null);
  assert.equal(response.body.internalNotes, null);
  assert.equal(store.submissions.length, 1);
});

test('POST /api/submissions rejects invalid categories before writing', async () => {
  const store = createMemoryStore();
  const app = createApp(store);

  const response = await request(app)
    .post('/api/submissions')
    .send({
      title: 'Invalid category',
      category: 'transport',
      description: 'Should fail validation.',
    });

  assert.equal(response.status, 400);
  assert.match(response.body.error, /category must be one of/i);
  assert.equal(store.submissions.length, 0);
});

test('GET /api/submissions passes dashboard filters to the store', async () => {
  const store = createMemoryStore([
    {
      id: 'matching',
      trackingId: 'tracking-1',
      title: 'Clinic issue',
      category: 'health',
      description: 'Needs review',
      contactEmail: null,
      status: 'new',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
      publicResponse: null,
      internalNotes: null,
    },
    {
      id: 'other-status',
      trackingId: 'tracking-2',
      title: 'Resolved clinic issue',
      category: 'health',
      description: 'Already resolved',
      contactEmail: null,
      status: 'resolved',
      createdAt: '2026-03-02T00:00:00.000Z',
      updatedAt: '2026-03-02T00:00:00.000Z',
      publicResponse: null,
      internalNotes: null,
    },
  ]);
  const app = createApp(store);

  const response = await request(app)
    .get('/api/submissions')
    .query({ status: 'new', category: 'health' });

  assert.equal(response.status, 200);
  assert.deepEqual(store.lastFilters, { status: 'new', category: 'health' });
  assert.deepEqual(response.body.map(submission => submission.id), ['matching']);
});

test('GET /api/submissions/track/:trackingId hides internal-only fields', async () => {
  const store = createMemoryStore([
    {
      id: 'abc-123',
      trackingId: 'GUN-ABCDE',
      title: 'Noise complaint',
      category: 'other',
      description: 'Night construction noise.',
      contactEmail: 'person@example.com',
      status: 'resolved',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-02T00:00:00.000Z',
      publicResponse: 'Case closed.',
      internalNotes: 'Sensitive routing note',
    },
  ]);
  const app = createApp(store);

  const response = await request(app).get('/api/submissions/track/gun-abcde');

  assert.equal(response.status, 200);
  assert.equal(response.body.trackingId, 'GUN-ABCDE');
  assert.equal(response.body.publicResponse, 'Case closed.');
  assert.equal(response.body.contactEmail, undefined);
  assert.equal(response.body.internalNotes, undefined);
});

test('PATCH /api/submissions/:id updates allowed fields and rejects bad statuses', async () => {
  const store = createMemoryStore([
    {
      id: 'case-1',
      trackingId: 'tracking-1',
      title: 'Water leak',
      category: 'infrastructure',
      description: 'Leak near the park.',
      contactEmail: null,
      status: 'new',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
      publicResponse: null,
      internalNotes: null,
    },
  ]);
  const app = createApp(store);

  const invalid = await request(app)
    .patch('/api/submissions/case-1')
    .send({ status: 'closed' });

  assert.equal(invalid.status, 400);

  const updated = await request(app)
    .patch('/api/submissions/case-1')
    .send({
      status: 'resolved',
      publicResponse: 'Maintenance completed.',
      internalNotes: 'Closed by field team.',
    });

  assert.equal(updated.status, 200);
  assert.equal(updated.body.status, 'resolved');
  assert.equal(updated.body.publicResponse, 'Maintenance completed.');
  assert.equal(updated.body.internalNotes, 'Closed by field team.');
  assert.notEqual(updated.body.updatedAt, '2026-03-01T00:00:00.000Z');
});
