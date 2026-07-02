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
    to: 'citizen@example.com', title: 'Broken streetlight', trackingId: 'ABC123',
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
