const test = require('node:test');
const assert = require('node:assert/strict');

const { createMailer } = require('../utils/mailer');

function createFakeMsalApp(token = 'fake-token') {
  return { acquireTokenByClientCredential: async () => ({ accessToken: token }) };
}

function createFakeFetch(response = { ok: true }) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    return { ...response, text: async () => '', headers: { get: () => null } };
  };
  return { calls, fn };
}

function noopSleep() {
  return Promise.resolve();
}

test('sendSubmissionConfirmationEmail no-ops when unconfigured', async () => {
  const originalWarn = console.warn;
  let warned = false;
  console.warn = () => { warned = true; };

  const mailer = createMailer({});
  const result = await mailer.sendSubmissionConfirmationEmail({
    to: 'citizen@example.com', title: 'Broken streetlight', trackingId: 'ABC123',
  });

  console.warn = originalWarn;
  assert.equal(warned, true);
  assert.deepEqual(result, { sent: false });
});

test('sendSubmissionConfirmationEmail sends a well-formed Graph request', async () => {
  const fakeFetch = createFakeFetch();
  const mailer = createMailer({
    fetchImpl: fakeFetch.fn,
    msalApp: createFakeMsalApp('fake-token'),
    senderAddress: 'noreply@example.org',
    publicAppUrl: 'https://mp.example.org/gunaso',
  });

  const result = await mailer.sendSubmissionConfirmationEmail({
    to: 'citizen@example.com', title: 'Broken streetlight', trackingId: 'ABC123', mpName: 'Jane Doe',
  });

  assert.deepEqual(result, { sent: true });
  assert.equal(fakeFetch.calls.length, 1);

  const { url, opts } = fakeFetch.calls[0];
  assert.equal(url, 'https://graph.microsoft.com/v1.0/users/noreply%40example.org/sendMail');
  assert.equal(opts.headers.Authorization, 'Bearer fake-token');

  const body = JSON.parse(opts.body);
  assert.equal(body.message.toRecipients[0].emailAddress.address, 'citizen@example.com');
  assert.match(body.message.body.content, /ABC123/);
  assert.match(body.message.body.content, /href="https:\/\/mp\.example\.org\/gunaso\/track\/ABC123"/);
  assert.match(body.message.body.content, /Jane Doe/);
  assert.match(body.message.body.content, /Sachivalaya/);
  assert.doesNotMatch(body.message.subject, /—/);
  assert.doesNotMatch(body.message.body.content, /—/);
});

test('sendSubmissionConfirmationEmail falls back gracefully when mpName is not provided', async () => {
  const fakeFetch = createFakeFetch();
  const mailer = createMailer({
    fetchImpl: fakeFetch.fn,
    msalApp: createFakeMsalApp('fake-token'),
    senderAddress: 'noreply@example.org',
    publicAppUrl: 'https://mp.example.org/gunaso',
  });

  await mailer.sendSubmissionConfirmationEmail({
    to: 'citizen@example.com', title: 'Broken streetlight', trackingId: 'ABC123',
  });

  const body = JSON.parse(fakeFetch.calls[0].opts.body);
  assert.match(body.message.body.content, /your representative/i);
  assert.match(body.message.body.content, /Sachivalaya/);
});

test('sendSubmissionConfirmationEmail rejects immediately on a non-retryable Graph response', async () => {
  const fakeFetch = createFakeFetch({ ok: false, status: 401 });
  const mailer = createMailer({
    fetchImpl: fakeFetch.fn,
    msalApp: createFakeMsalApp(),
    senderAddress: 'noreply@example.org',
    publicAppUrl: 'https://mp.example.org/gunaso',
    sleepImpl: noopSleep,
  });

  await assert.rejects(
    () => mailer.sendSubmissionConfirmationEmail({ to: 'citizen@example.com', title: 't', trackingId: 'ABC123' }),
    /Graph sendMail failed: 401/,
  );
  assert.equal(fakeFetch.calls.length, 1);
});

test('sendSubmissionConfirmationEmail retries on 429 and succeeds once the mailbox is free', async () => {
  const calls = [];
  let attempt = 0;
  const fetchImpl = async (url, opts) => {
    attempt += 1;
    calls.push(opts);
    if (attempt < 3) {
      return { ok: false, status: 429, text: async () => '', headers: { get: (name) => (name === 'retry-after' ? '1' : null) } };
    }
    return { ok: true, text: async () => '', headers: { get: () => null } };
  };
  const sleepCalls = [];
  const mailer = createMailer({
    fetchImpl,
    msalApp: createFakeMsalApp(),
    senderAddress: 'noreply@example.org',
    publicAppUrl: 'https://mp.example.org/gunaso',
    sleepImpl: (ms) => { sleepCalls.push(ms); return Promise.resolve(); },
    maxAttempts: 5,
  });

  const result = await mailer.sendSubmissionConfirmationEmail({ to: 'citizen@example.com', title: 't', trackingId: 'ABC123' });

  assert.deepEqual(result, { sent: true });
  assert.equal(calls.length, 3);
  assert.deepEqual(sleepCalls, [1000, 1000]);
});

test('sendSubmissionConfirmationEmail gives up after maxAttempts of 429s', async () => {
  const fakeFetch = createFakeFetch({ ok: false, status: 429 });
  const mailer = createMailer({
    fetchImpl: fakeFetch.fn,
    msalApp: createFakeMsalApp(),
    senderAddress: 'noreply@example.org',
    publicAppUrl: 'https://mp.example.org/gunaso',
    sleepImpl: noopSleep,
    maxAttempts: 3,
  });

  await assert.rejects(
    () => mailer.sendSubmissionConfirmationEmail({ to: 'citizen@example.com', title: 't', trackingId: 'ABC123' }),
    /Graph sendMail failed: 429/,
  );
  assert.equal(fakeFetch.calls.length, 3);
});

test('circuit breaker opens after failureThreshold consecutive failures and short-circuits further sends', async () => {
  const fakeFetch = createFakeFetch({ ok: false, status: 401 });
  const mailer = createMailer({
    fetchImpl: fakeFetch.fn,
    msalApp: createFakeMsalApp(),
    senderAddress: 'noreply@example.org',
    publicAppUrl: 'https://mp.example.org/gunaso',
    sleepImpl: noopSleep,
    maxAttempts: 1,
    failureThreshold: 2,
  });
  const send = () => mailer.sendSubmissionConfirmationEmail({ to: 'citizen@example.com', title: 't', trackingId: 'ABC123' });

  await assert.rejects(send);
  await assert.rejects(send);
  assert.equal(fakeFetch.calls.length, 2);

  const result = await send();
  assert.deepEqual(result, { sent: false, circuitOpen: true });
  assert.equal(fakeFetch.calls.length, 2, 'circuit should short-circuit without calling fetchImpl again');
});

test('circuit breaker allows exactly one half-open trial after cooldown, rejecting concurrent callers', async () => {
  let currentTime = 0;
  const now = () => currentTime;
  const fakeFetch = createFakeFetch({ ok: false, status: 401 });
  const mailer = createMailer({
    fetchImpl: fakeFetch.fn,
    msalApp: createFakeMsalApp(),
    senderAddress: 'noreply@example.org',
    publicAppUrl: 'https://mp.example.org/gunaso',
    sleepImpl: noopSleep,
    now,
    maxAttempts: 1,
    failureThreshold: 1,
    cooldownMs: 1000,
  });
  const send = () => mailer.sendSubmissionConfirmationEmail({ to: 'citizen@example.com', title: 't', trackingId: 'ABC123' });

  await assert.rejects(send); // trips the breaker open
  assert.equal(fakeFetch.calls.length, 1);

  // Still within cooldown — short-circuited.
  assert.deepEqual(await send(), { sent: false, circuitOpen: true });
  assert.equal(fakeFetch.calls.length, 1);

  currentTime = 1000; // cooldown elapsed — one half-open trial should now be allowed
  const results = await Promise.all([send().catch((err) => err), send()]);

  // Exactly one of the two concurrent calls reached fetchImpl (the trial);
  // the other was short-circuited without ever calling out.
  assert.equal(fakeFetch.calls.length, 2);
  const shortCircuited = results.filter((r) => r && r.circuitOpen === true);
  assert.equal(shortCircuited.length, 1);
});

test('circuit breaker closes after a successful half-open trial', async () => {
  let currentTime = 0;
  const now = () => currentTime;
  let shouldFail = true;
  const fetchImpl = async () => (shouldFail
    ? { ok: false, status: 401, text: async () => '', headers: { get: () => null } }
    : { ok: true, text: async () => '', headers: { get: () => null } });
  const mailer = createMailer({
    fetchImpl,
    msalApp: createFakeMsalApp(),
    senderAddress: 'noreply@example.org',
    publicAppUrl: 'https://mp.example.org/gunaso',
    sleepImpl: noopSleep,
    now,
    maxAttempts: 1,
    failureThreshold: 1,
    cooldownMs: 1000,
  });
  const send = () => mailer.sendSubmissionConfirmationEmail({ to: 'citizen@example.com', title: 't', trackingId: 'ABC123' });

  await assert.rejects(send); // trips the breaker open
  currentTime = 1000;
  shouldFail = false;
  assert.deepEqual(await send(), { sent: true }); // half-open trial succeeds, closes the circuit

  // Circuit is closed again — a normal call proceeds without being short-circuited.
  const result = await send();
  assert.deepEqual(result, { sent: true });
});

test('circuit breaker reopens after a failed half-open trial', async () => {
  let currentTime = 0;
  const now = () => currentTime;
  const fakeFetch = createFakeFetch({ ok: false, status: 401 });
  const mailer = createMailer({
    fetchImpl: fakeFetch.fn,
    msalApp: createFakeMsalApp(),
    senderAddress: 'noreply@example.org',
    publicAppUrl: 'https://mp.example.org/gunaso',
    sleepImpl: noopSleep,
    now,
    maxAttempts: 1,
    failureThreshold: 1,
    cooldownMs: 1000,
  });
  const send = () => mailer.sendSubmissionConfirmationEmail({ to: 'citizen@example.com', title: 't', trackingId: 'ABC123' });

  await assert.rejects(send); // opens
  currentTime = 1000;
  await assert.rejects(send); // half-open trial fails — reopens
  assert.equal(fakeFetch.calls.length, 2);

  // Immediately after, still within the new cooldown window — short-circuited.
  assert.deepEqual(await send(), { sent: false, circuitOpen: true });
  assert.equal(fakeFetch.calls.length, 2);
});

test('a hung Graph request times out instead of hanging forever', async () => {
  const hangingFetch = (url, opts) => new Promise((resolve, reject) => {
    opts.signal.addEventListener('abort', () => reject(new Error('The operation was aborted')));
  });
  const mailer = createMailer({
    fetchImpl: hangingFetch,
    msalApp: createFakeMsalApp(),
    senderAddress: 'noreply@example.org',
    publicAppUrl: 'https://mp.example.org/gunaso',
    sleepImpl: noopSleep,
    maxAttempts: 1,
    requestTimeoutMs: 50,
  });

  await assert.rejects(
    () => mailer.sendSubmissionConfirmationEmail({ to: 'citizen@example.com', title: 't', trackingId: 'ABC123' }),
    /Graph sendMail failed: network error/,
  );
});

test('sendSubmissionConfirmationEmail caps concurrent Graph sends at maxConcurrentSends', async () => {
  let active = 0;
  let peak = 0;
  const fetchImpl = async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setImmediate(resolve));
    active -= 1;
    return { ok: true, text: async () => '', headers: { get: () => null } };
  };
  const mailer = createMailer({
    fetchImpl,
    msalApp: createFakeMsalApp(),
    senderAddress: 'noreply@example.org',
    publicAppUrl: 'https://mp.example.org/gunaso',
    sleepImpl: noopSleep,
    maxConcurrentSends: 3,
  });

  await Promise.all(Array.from({ length: 10 }, (_, i) =>
    mailer.sendSubmissionConfirmationEmail({ to: `citizen${i}@example.com`, title: 't', trackingId: `ID${i}` })));

  assert.ok(peak <= 3, `expected peak concurrency <= 3, got ${peak}`);
});
