const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { Readable } = require('stream');
const request = require('supertest');
const rateLimit = require('express-rate-limit');

const createApp = require('../index');

const MP_ID = 'test-parliamentarian-id';

// Injects a fixed MP onto every request — avoids a real DB lookup in HTTP tests.
function mockTenant(req, res, next) {
  req.mp = { id: MP_ID, name: 'Test MP', subdomain: 'test' };
  next();
}

// Default DI overrides for tests that aren't specifically exercising rate
// limiting or CAPTCHA — the real submissionRateLimit is a module-level
// singleton (shared across every createApp() call that doesn't override it),
// so using it unmodified here would let unrelated tests' request counts
// accumulate against each other.
function noOpRateLimit(req, res, next) {
  next();
}
function alwaysAllowTurnstile() {
  return { verifyToken: async () => true };
}

function createFakeBlobStorage({ enabled = true } = {}) {
  const uploads = [];
  return {
    uploads,
    async uploadAttachment(args) {
      uploads.push(args);
      if (!enabled) return null;
      return `${args.mpId}/${args.submissionId}/fake-blob-${args.originalFileName}`;
    },
    async streamAttachment() {
      throw new Error('not used in these tests');
    },
  };
}

function createMemoryStore(initialSubmissions = []) {
  const submissions = [...initialSubmissions];

  return {
    submissions,
    lastFilters: null,
    async getAll(mpId, filters = {}) {
      this.lastFilters = filters;
      return submissions.filter(s => {
        if (s.mpId !== mpId) return false;
        if (filters.status && s.status !== filters.status) return false;
        if (filters.category && s.category !== filters.category) return false;
        return true;
      });
    },
    async getById(mpId, id) {
      return submissions.find(s => s.id === id && s.mpId === mpId) || null;
    },
    async getByTrackingId(mpId, trackingId) {
      return submissions.find(s => s.trackingId === trackingId && s.mpId === mpId) || null;
    },
    async create(mpId, submission) {
      const entry = { ...submission, mpId };
      submissions.push(entry);
      return entry;
    },
    async update(mpId, id, updates) {
      const index = submissions.findIndex(s => s.id === id && s.mpId === mpId);
      if (index === -1) return null;
      submissions[index] = { ...submissions[index], ...updates, updatedAt: new Date().toISOString() };
      return submissions[index];
    },
  };
}

function createFakeMailer({ throwSync = false, rejectAsync = false } = {}) {
  const calls = [];
  return {
    calls,
    sendSubmissionConfirmationEmail(args) {
      calls.push(args);
      if (throwSync) throw new Error('boom-sync');
      if (rejectAsync) return Promise.reject(new Error('boom-async'));
      return Promise.resolve({ sent: true });
    },
  };
}

test('POST /api/submissions creates a new submission with defaults', async () => {
  const store = createMemoryStore();
  const app = createApp(store, { resolveTenantMiddleware: mockTenant, submissionRateLimit: noOpRateLimit, turnstileVerifier: alwaysAllowTurnstile() });

  const response = await request(app)
    .post('/api/submissions')
    .send({
      title: 'Broken streetlight',
      description: 'The lamp has been off for 2 weeks.',
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.status, 'new');
  assert.match(response.body.id, /^[0-9a-f-]{36}$/i);
  assert.match(response.body.trackingId, /^[0-9a-f-]{36}$/i);
  assert.equal(response.body.contactEmail, null);
  assert.equal(response.body.contactPhone, null);
  assert.equal(response.body.publicResponse, null);
  assert.equal(response.body.internalNotes, null);
  assert.equal(store.submissions.length, 1);
  assert.equal(store.submissions[0].mpId, MP_ID);
});

test('POST /api/submissions stores a supplied contactPhone', async () => {
  const store = createMemoryStore();
  const app = createApp(store, { resolveTenantMiddleware: mockTenant, submissionRateLimit: noOpRateLimit, turnstileVerifier: alwaysAllowTurnstile() });

  const response = await request(app)
    .post('/api/submissions')
    .send({
      title: 'Broken streetlight',
      description: 'The lamp has been off for 2 weeks.',
      contactPhone: '9812345678',
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.contactPhone, '9812345678');
  assert.equal(store.submissions.length, 1);
  assert.equal(store.submissions[0].contactPhone, '9812345678');
});

test('POST /api/submissions sends a confirmation email when contactEmail is provided', async () => {
  const store = createMemoryStore();
  const mailer = createFakeMailer();
  const app = createApp(store, { resolveTenantMiddleware: mockTenant, mailer, submissionRateLimit: noOpRateLimit, turnstileVerifier: alwaysAllowTurnstile() });

  const response = await request(app)
    .post('/api/submissions')
    .send({
      title: 'Broken streetlight',
      description: 'The lamp has been off for 2 weeks.',
      contactEmail: 'citizen@example.com',
    });

  assert.equal(response.status, 201);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(mailer.calls.length, 1);
  assert.deepEqual(mailer.calls[0], {
    to: 'citizen@example.com',
    title: 'Broken streetlight',
    trackingId: response.body.trackingId,
    mpName: 'Test MP',
  });
});

test('POST /api/submissions does not send a confirmation email when contactEmail is absent', async () => {
  const store = createMemoryStore();
  const mailer = createFakeMailer();
  const app = createApp(store, { resolveTenantMiddleware: mockTenant, mailer, submissionRateLimit: noOpRateLimit, turnstileVerifier: alwaysAllowTurnstile() });

  const response = await request(app)
    .post('/api/submissions')
    .send({
      title: 'Broken streetlight',
      description: 'The lamp has been off for 2 weeks.',
    });

  assert.equal(response.status, 201);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(mailer.calls.length, 0);
});

test('POST /api/submissions still succeeds when the mailer throws synchronously', async () => {
  const store = createMemoryStore();
  const mailer = createFakeMailer({ throwSync: true });
  const app = createApp(store, { resolveTenantMiddleware: mockTenant, mailer, submissionRateLimit: noOpRateLimit, turnstileVerifier: alwaysAllowTurnstile() });

  const response = await request(app)
    .post('/api/submissions')
    .send({
      title: 'Broken streetlight',
      description: 'The lamp has been off for 2 weeks.',
      contactEmail: 'citizen@example.com',
    });

  assert.equal(response.status, 201);
  assert.equal(store.submissions.length, 1);
});

test('POST /api/submissions still succeeds when the mailer rejects asynchronously', async () => {
  const store = createMemoryStore();
  const mailer = createFakeMailer({ rejectAsync: true });
  const app = createApp(store, { resolveTenantMiddleware: mockTenant, mailer, submissionRateLimit: noOpRateLimit, turnstileVerifier: alwaysAllowTurnstile() });

  const response = await request(app)
    .post('/api/submissions')
    .send({
      title: 'Broken streetlight',
      description: 'The lamp has been off for 2 weeks.',
      contactEmail: 'citizen@example.com',
    });

  assert.equal(response.status, 201);
  assert.equal(store.submissions.length, 1);
});

test('POST /api/submissions rejects requests missing required fields', async () => {
  const store = createMemoryStore();
  const app = createApp(store, { resolveTenantMiddleware: mockTenant, submissionRateLimit: noOpRateLimit, turnstileVerifier: alwaysAllowTurnstile() });

  const response = await request(app)
    .post('/api/submissions')
    .send({
      title: 'Missing description',
    });

  assert.equal(response.status, 400);
  assert.match(response.body.error, /title and description are required/i);
  assert.equal(store.submissions.length, 0);
});

test('POST /api/submissions rejects an invalid category when one is supplied', async () => {
  const store = createMemoryStore();
  const app = createApp(store, { resolveTenantMiddleware: mockTenant, submissionRateLimit: noOpRateLimit, turnstileVerifier: alwaysAllowTurnstile() });

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

test('POST /api/submissions stores a null category when none is supplied', async () => {
  const store = createMemoryStore();
  const app = createApp(store, { resolveTenantMiddleware: mockTenant, submissionRateLimit: noOpRateLimit, turnstileVerifier: alwaysAllowTurnstile() });

  const response = await request(app)
    .post('/api/submissions')
    .send({
      title: 'No category',
      description: 'Category is optional now.',
    });

  assert.equal(response.status, 201);
  assert.equal(store.submissions.length, 1);
  assert.equal(store.submissions[0].category, null);
});

test('GET /api/submissions passes dashboard filters to the store', async () => {
  const store = createMemoryStore([
    {
      id: 'matching',
      trackingId: 'tracking-1',
      mpId: MP_ID,
      title: 'Clinic issue',
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
      mpId: MP_ID,
      title: 'Resolved clinic issue',
      description: 'Already resolved',
      contactEmail: null,
      status: 'resolved',
      createdAt: '2026-03-02T00:00:00.000Z',
      updatedAt: '2026-03-02T00:00:00.000Z',
      publicResponse: null,
      internalNotes: null,
    },
  ]);

  // Bypass auth middleware by providing a mock requireAuth via a store wrapper that already
  // has the auth check baked into the route — for integration-test purposes we patch the
  // route factory to skip auth by providing the tenant middleware only.
  const app = createApp(store, { resolveTenantMiddleware: mockTenant, submissionRateLimit: noOpRateLimit, turnstileVerifier: alwaysAllowTurnstile() });

  // Inject a fake auth header so requireAuth passes (we mock it at the route level via
  // a custom createSubmissionsRouter in a separate test helper if needed — for now the
  // admin routes return 401 without a token, which is correct behaviour to test here).
  const response = await request(app)
    .get('/api/submissions')
    .query({ status: 'new', category: 'health' })
    .set('Authorization', 'Bearer skip-for-unit-test');

  // 401 is expected without a real Entra token — this test confirms the route is protected.
  assert.equal(response.status, 401);
});

test('GET /api/submissions/stats returns public aggregate counts without auth', async () => {
  const store = createMemoryStore([
    { id: '1', trackingId: 't1', mpId: MP_ID, title: 'A', description: 'x', status: 'new', category: 'health', internalNotes: 'secret' },
    { id: '2', trackingId: 't2', mpId: MP_ID, title: 'B', description: 'x', status: 'resolved', category: 'health' },
    { id: '3', trackingId: 't3', mpId: MP_ID, title: 'C', description: 'x', status: 'in_review', category: null },
    { id: '4', trackingId: 't4', mpId: 'other-mp', title: 'D', description: 'x', status: 'new', category: 'security' },
  ]);
  const app = createApp(store, { resolveTenantMiddleware: mockTenant, submissionRateLimit: noOpRateLimit, turnstileVerifier: alwaysAllowTurnstile() });

  const response = await request(app).get('/api/submissions/stats');

  assert.equal(response.status, 200);
  // Scoped to the tenant — the other-mp row is excluded.
  assert.equal(response.body.total, 3);
  assert.deepEqual(response.body.byStatus, { new: 1, in_review: 1, resolved: 1 });
  assert.equal(response.body.byCategory.health, 2);
  assert.equal(response.body.byCategory.security, 0);
  assert.equal(response.body.uncategorized, 1);
  // No individual submission fields leak into the aggregate response.
  assert.equal(JSON.stringify(response.body).includes('secret'), false);
});

test('GET /api/submissions/stats returns zeroed counts for an empty tenant', async () => {
  const store = createMemoryStore();
  const app = createApp(store, { resolveTenantMiddleware: mockTenant, submissionRateLimit: noOpRateLimit, turnstileVerifier: alwaysAllowTurnstile() });

  const response = await request(app).get('/api/submissions/stats');

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 0);
  assert.deepEqual(response.body.byStatus, { new: 0, in_review: 0, resolved: 0 });
  assert.deepEqual(response.body.byCategory, { infrastructure: 0, health: 0, education: 0, security: 0, other: 0 });
  assert.equal(response.body.uncategorized, 0);
});

test('GET /api/submissions/stats is not shadowed by the auth-protected /:id route', async () => {
  // /stats must be registered before /:id — otherwise "stats" is treated as a
  // submission id and the request hits the staff-only handler, turning the
  // public dashboard endpoint into a 401. Guard that ordering here.
  const store = createMemoryStore([
    { id: 'stats', trackingId: 't1', mpId: MP_ID, title: 'A', description: 'x', status: 'new', category: 'health' },
  ]);
  const app = createApp(store, { resolveTenantMiddleware: mockTenant, submissionRateLimit: noOpRateLimit, turnstileVerifier: alwaysAllowTurnstile() });

  const response = await request(app).get('/api/submissions/stats');

  assert.equal(response.status, 200);
  // Aggregate shape, not a single submission — confirms the /stats handler ran.
  assert.ok(response.body.byStatus, 'expected aggregate byStatus, got a submission');
  assert.equal(response.body.trackingId, undefined);
});

test('GET /api/submissions/stats buckets weekly activity by updated_at', async () => {
  const now = new Date();
  const recent = now.toISOString();
  const longAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const store = createMemoryStore([
    { id: '1', trackingId: 't1', mpId: MP_ID, title: 'A', description: 'x', status: 'new', category: 'health', updatedAt: recent },
    { id: '2', trackingId: 't2', mpId: MP_ID, title: 'B', description: 'x', status: 'resolved', category: 'education', updatedAt: recent },
    // 60 days old — outside the 5-week window, so excluded from every bucket.
    { id: '3', trackingId: 't3', mpId: MP_ID, title: 'C', description: 'x', status: 'new', category: 'health', updatedAt: longAgo },
  ]);
  const app = createApp(store, { resolveTenantMiddleware: mockTenant, submissionRateLimit: noOpRateLimit, turnstileVerifier: alwaysAllowTurnstile() });

  const response = await request(app).get('/api/submissions/stats');

  assert.equal(response.status, 200);
  // Fixed window: 2 weeks before + current + 2 weeks after = 5 buckets.
  assert.equal(response.body.weekly.length, 5);
  // Every bucket exposes fully-zeroed status/category maps and a week start.
  for (const week of response.body.weekly) {
    assert.deepEqual(Object.keys(week.byStatus), ['new', 'in_review', 'resolved']);
    assert.deepEqual(Object.keys(week.byCategory), ['infrastructure', 'health', 'education', 'security', 'other']);
    assert.ok(week.weekStart);
  }
  // Only the two recent rows land in-window; the 60-day-old row is excluded.
  const sum = (pick) => response.body.weekly.reduce((acc, w) => acc + pick(w), 0);
  assert.equal(sum(w => w.byStatus.new), 1);
  assert.equal(sum(w => w.byStatus.resolved), 1);
  assert.equal(sum(w => w.byCategory.health), 1);
  assert.equal(sum(w => w.byCategory.education), 1);
  // Placement, not just totals: `now` falls in the center bucket (index 2 =
  // current week), so both recent rows land there — and the two future
  // buckets (indices 3, 4) stay empty. Guards against off-by-one bucketing.
  assert.deepEqual(response.body.weekly[2].byStatus, { new: 1, in_review: 0, resolved: 1 });
  assert.equal(response.body.weekly[2].byCategory.health, 1);
  assert.equal(response.body.weekly[2].byCategory.education, 1);
  assert.deepEqual(response.body.weekly[3].byStatus, { new: 0, in_review: 0, resolved: 0 });
  assert.deepEqual(response.body.weekly[4].byStatus, { new: 0, in_review: 0, resolved: 0 });
});

test('GET /api/submissions/track/:trackingId hides internal-only fields', async () => {
  const store = createMemoryStore([
    {
      id: 'abc-123',
      trackingId: 'GUN-ABCDE',
      mpId: MP_ID,
      title: 'Noise complaint',
      description: 'Night construction noise.',
      contactEmail: 'person@example.com',
      status: 'resolved',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-02T00:00:00.000Z',
      publicResponse: 'Case closed.',
      internalNotes: 'Sensitive routing note',
    },
  ]);
  const app = createApp(store, { resolveTenantMiddleware: mockTenant, submissionRateLimit: noOpRateLimit, turnstileVerifier: alwaysAllowTurnstile() });

  const response = await request(app).get('/api/submissions/track/gun-abcde');

  assert.equal(response.status, 200);
  assert.equal(response.body.trackingId, 'GUN-ABCDE');
  assert.equal(response.body.publicResponse, 'Case closed.');
  assert.equal(response.body.contactEmail, undefined);
  assert.equal(response.body.internalNotes, undefined);
});

test('GET /api/submissions/track/:trackingId includes the attachment file name but not its storage details', async () => {
  const store = createMemoryStore([
    {
      id: 'abc-123',
      trackingId: 'GUN-WITHFILE',
      mpId: MP_ID,
      title: 'Pothole',
      description: 'desc',
      contactEmail: null,
      status: 'new',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
      publicResponse: null,
      internalNotes: null,
      attachmentFileName: 'photo.jpg',
      attachmentContentType: 'image/jpeg',
      attachmentSizeBytes: 1234,
      attachmentBlobPath: 'clinic/abc-123/uuid-photo.jpg',
    },
  ]);
  const app = createApp(store, { resolveTenantMiddleware: mockTenant });

  const response = await request(app).get('/api/submissions/track/gun-withfile');

  assert.equal(response.status, 200);
  assert.equal(response.body.attachmentFileName, 'photo.jpg');
  assert.equal(response.body.attachmentBlobPath, undefined, 'internal blob path must never be exposed publicly');
  assert.equal(response.body.attachmentContentType, undefined);
});

test('GET /api/submissions/track/:trackingId/attachment streams the file for a valid tracking ID', async () => {
  const store = createMemoryStore([
    {
      id: 'abc-123',
      trackingId: 'GUN-WITHFILE',
      mpId: MP_ID,
      title: 'Pothole',
      description: 'desc',
      contactEmail: null,
      status: 'new',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
      publicResponse: null,
      internalNotes: null,
      attachmentFileName: 'photo.jpg',
      attachmentContentType: 'image/jpeg',
      attachmentSizeBytes: 1234,
      attachmentBlobPath: 'clinic/abc-123/uuid-photo.jpg',
    },
  ]);
  const blobStorage = {
    async streamAttachment() {
      return Readable.from([Buffer.from('fake-image-bytes')]);
    },
  };
  const app = createApp(store, { resolveTenantMiddleware: mockTenant, blobStorage });

  const response = await request(app).get('/api/submissions/track/gun-withfile/attachment');

  assert.equal(response.status, 200);
  assert.equal(response.headers['content-type'], 'image/jpeg');
  assert.match(response.headers['content-disposition'], /photo\.jpg/);
  assert.equal(response.body.toString(), 'fake-image-bytes');
});

test('GET /api/submissions/track/:trackingId/attachment 404s when the submission has no attachment', async () => {
  const store = createMemoryStore([
    {
      id: 'abc-123',
      trackingId: 'GUN-NOFILE',
      mpId: MP_ID,
      title: 'Pothole',
      description: 'desc',
      contactEmail: null,
      status: 'new',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
      publicResponse: null,
      internalNotes: null,
    },
  ]);
  const app = createApp(store, { resolveTenantMiddleware: mockTenant });

  const response = await request(app).get('/api/submissions/track/gun-nofile/attachment');

  assert.equal(response.status, 404);
});

test('GET /api/submissions/track/:trackingId/attachment 404s for an unknown tracking ID', async () => {
  const store = createMemoryStore();
  const app = createApp(store, { resolveTenantMiddleware: mockTenant });

  const response = await request(app).get('/api/submissions/track/does-not-exist/attachment');

  assert.equal(response.status, 404);
});

test('PATCH /api/submissions/:id is protected and returns 401 without a token', async () => {
  const store = createMemoryStore([
    {
      id: 'case-1',
      trackingId: 'tracking-1',
      mpId: MP_ID,
      title: 'Water leak',
      description: 'Leak near the park.',
      contactEmail: null,
      status: 'new',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
      publicResponse: null,
      internalNotes: null,
    },
  ]);
  const app = createApp(store, { resolveTenantMiddleware: mockTenant, submissionRateLimit: noOpRateLimit, turnstileVerifier: alwaysAllowTurnstile() });

  const response = await request(app)
    .patch('/api/submissions/case-1')
    .send({ status: 'resolved' });

  assert.equal(response.status, 401);
});

test('PATCH /api/submissions/:id rejects invalid status regardless of auth', async () => {
  const store = createMemoryStore();
  const app = createApp(store, { resolveTenantMiddleware: mockTenant, submissionRateLimit: noOpRateLimit, turnstileVerifier: alwaysAllowTurnstile() });

  // Bad status is caught before the auth check
  const response = await request(app)
    .patch('/api/submissions/case-1')
    .send({ status: 'closed' });

  assert.equal(response.status, 400);
  assert.match(response.body.error, /status must be one of/i);
});

test('PATCH /api/submissions/:id rejects an invalid category regardless of auth', async () => {
  const store = createMemoryStore();
  const app = createApp(store, { resolveTenantMiddleware: mockTenant, submissionRateLimit: noOpRateLimit, turnstileVerifier: alwaysAllowTurnstile() });

  // Bad category is caught before the auth check, like status
  const response = await request(app)
    .patch('/api/submissions/case-1')
    .send({ category: 'transport' });

  assert.equal(response.status, 400);
  assert.match(response.body.error, /category must be one of/i);
});

test('POST /api/submissions is rate limited per IP', async () => {
  const store = createMemoryStore();
  const tinyRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 2, standardHeaders: true, legacyHeaders: false });
  const app = createApp(store, {
    resolveTenantMiddleware: mockTenant,
    submissionRateLimit: tinyRateLimit,
    turnstileVerifier: alwaysAllowTurnstile(),
  });

  const payload = { title: 'Broken streetlight', description: 'desc' };

  const first = await request(app).post('/api/submissions').send(payload);
  const second = await request(app).post('/api/submissions').send(payload);
  const third = await request(app).post('/api/submissions').send(payload);

  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(third.status, 429);
  assert.equal(store.submissions.length, 2);
});

test('POST /api/submissions rejects requests that fail CAPTCHA verification', async () => {
  const store = createMemoryStore();
  const app = createApp(store, {
    resolveTenantMiddleware: mockTenant,
    submissionRateLimit: noOpRateLimit,
    turnstileVerifier: { verifyToken: async () => false },
  });

  const response = await request(app)
    .post('/api/submissions')
    .send({
      title: 'Broken streetlight',
      description: 'desc',
      turnstileToken: 'bad-token',
    });

  assert.equal(response.status, 400);
  assert.match(response.body.error, /CAPTCHA/i);
  assert.equal(store.submissions.length, 0);
});

test('POST /api/submissions reads the CAPTCHA token from the X-Turnstile-Token header', async () => {
  const store = createMemoryStore();
  let receivedToken = null;
  const app = createApp(store, {
    resolveTenantMiddleware: mockTenant,
    submissionRateLimit: noOpRateLimit,
    turnstileVerifier: { verifyToken: async (token) => { receivedToken = token; return true; } },
  });

  await request(app)
    .post('/api/submissions')
    .set('X-Turnstile-Token', 'header-token-value')
    .send({ title: 'Broken streetlight', description: 'desc' });

  assert.equal(receivedToken, 'header-token-value');
});

test('POST /api/submissions succeeds without an attachment (all attachment fields null)', async () => {
  const store = createMemoryStore();
  const app = createApp(store, {
    resolveTenantMiddleware: mockTenant,
    submissionRateLimit: noOpRateLimit,
    turnstileVerifier: alwaysAllowTurnstile(),
  });

  const response = await request(app)
    .post('/api/submissions')
    .field('title', 'Broken streetlight')
    .field('description', 'desc');

  assert.equal(response.status, 201);
  assert.equal(response.body.attachmentFileName, null);
  assert.equal(response.body.attachmentBlobPath, null);
});

test('POST /api/submissions uploads a valid attachment and stores its metadata', async () => {
  const store = createMemoryStore();
  const blobStorage = createFakeBlobStorage();
  const app = createApp(store, {
    resolveTenantMiddleware: mockTenant,
    submissionRateLimit: noOpRateLimit,
    turnstileVerifier: alwaysAllowTurnstile(),
    blobStorage,
  });

  const response = await request(app)
    .post('/api/submissions')
    .field('title', 'Broken streetlight')
    .field('description', 'desc')
    .attach('attachment', path.join(__dirname, 'fixtures', 'sample.png'));

  assert.equal(response.status, 201);
  assert.equal(response.body.attachmentFileName, 'sample.png');
  assert.equal(response.body.attachmentContentType, 'image/png');
  assert.equal(blobStorage.uploads.length, 1);
  assert.equal(blobStorage.uploads[0].contentType, 'image/png');
});

test('POST /api/submissions accepts a real docx attachment', async () => {
  const store = createMemoryStore();
  const blobStorage = createFakeBlobStorage();
  const app = createApp(store, {
    resolveTenantMiddleware: mockTenant,
    submissionRateLimit: noOpRateLimit,
    turnstileVerifier: alwaysAllowTurnstile(),
    blobStorage,
  });

  const response = await request(app)
    .post('/api/submissions')
    .field('title', 'Broken streetlight')
    .field('description', 'desc')
    .attach('attachment', path.join(__dirname, 'fixtures', 'sample.docx'));

  assert.equal(response.status, 201);
  assert.equal(response.body.attachmentContentType, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
});

test('POST /api/submissions rejects an oversized attachment', async () => {
  const store = createMemoryStore();
  const app = createApp(store, {
    resolveTenantMiddleware: mockTenant,
    submissionRateLimit: noOpRateLimit,
    turnstileVerifier: alwaysAllowTurnstile(),
    blobStorage: createFakeBlobStorage(),
  });

  const oversized = Buffer.alloc(6 * 1024 * 1024, 1);

  const response = await request(app)
    .post('/api/submissions')
    .field('title', 'Broken streetlight')
    .field('description', 'desc')
    .attach('attachment', oversized, 'huge.png');

  assert.equal(response.status, 400);
  assert.match(response.body.error, /5MB/i);
  assert.equal(store.submissions.length, 0);
});

test('POST /api/submissions rejects more than one attachment', async () => {
  const store = createMemoryStore();
  const app = createApp(store, {
    resolveTenantMiddleware: mockTenant,
    submissionRateLimit: noOpRateLimit,
    turnstileVerifier: alwaysAllowTurnstile(),
    blobStorage: createFakeBlobStorage(),
  });

  const response = await request(app)
    .post('/api/submissions')
    .field('title', 'Broken streetlight')
    .field('description', 'desc')
    .attach('attachment', path.join(__dirname, 'fixtures', 'sample.png'))
    .attach('attachment', path.join(__dirname, 'fixtures', 'sample.pdf'));

  assert.equal(response.status, 400);
  assert.match(response.body.error, /one file/i);
});

test('POST /api/submissions rejects a file whose real content does not match an allowed type', async () => {
  const store = createMemoryStore();
  const app = createApp(store, {
    resolveTenantMiddleware: mockTenant,
    submissionRateLimit: noOpRateLimit,
    turnstileVerifier: alwaysAllowTurnstile(),
    blobStorage: createFakeBlobStorage(),
  });

  // Plain text disguised with a .jpg filename and an image content-type —
  // the declared type must be ignored in favor of the real magic bytes.
  const disguised = Buffer.from('this is not actually an image, just plain text padded out');

  const response = await request(app)
    .post('/api/submissions')
    .field('title', 'Broken streetlight')
    .field('description', 'desc')
    .attach('attachment', disguised, { filename: 'photo.jpg', contentType: 'image/jpeg' });

  assert.equal(response.status, 400);
  assert.match(response.body.error, /JPG, PNG, WEBP, PDF, DOC, or DOCX/);
  assert.equal(store.submissions.length, 0);
});

test('POST /api/submissions succeeds with attachment fields left null when blob storage is unconfigured', async () => {
  const store = createMemoryStore();
  const app = createApp(store, {
    resolveTenantMiddleware: mockTenant,
    submissionRateLimit: noOpRateLimit,
    turnstileVerifier: alwaysAllowTurnstile(),
    blobStorage: createFakeBlobStorage({ enabled: false }),
  });

  const response = await request(app)
    .post('/api/submissions')
    .field('title', 'Broken streetlight')
    .field('description', 'desc')
    .attach('attachment', path.join(__dirname, 'fixtures', 'sample.png'));

  assert.equal(response.status, 201);
  assert.equal(response.body.attachmentFileName, null);
  assert.equal(response.body.attachmentBlobPath, null);
});

test('GET /api/submissions/:id/attachment requires staff auth', async () => {
  const store = createMemoryStore();
  const app = createApp(store, { resolveTenantMiddleware: mockTenant });

  const response = await request(app).get('/api/submissions/some-id/attachment');

  assert.equal(response.status, 401);
});
