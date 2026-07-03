const test = require('node:test');
const assert = require('node:assert/strict');

const { createTurnstileVerifier } = require('../utils/turnstile');

function createFakeFetch(response) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    return response;
  };
  return { calls, fn };
}

test('verifyToken returns true without calling out when secretKey is unset', async () => {
  const originalWarn = console.warn;
  let warned = false;
  console.warn = () => { warned = true; };

  const fakeFetch = createFakeFetch({ ok: true, json: async () => ({ success: true }) });
  const verifier = createTurnstileVerifier({ fetchImpl: fakeFetch.fn, secretKey: undefined });
  const result = await verifier.verifyToken('some-token', '1.2.3.4');

  console.warn = originalWarn;
  assert.equal(warned, true);
  assert.equal(result, true);
  assert.equal(fakeFetch.calls.length, 0);
});

test('verifyToken returns false immediately when no token is provided', async () => {
  const fakeFetch = createFakeFetch({ ok: true, json: async () => ({ success: true }) });
  const verifier = createTurnstileVerifier({ fetchImpl: fakeFetch.fn, secretKey: 'test-secret' });

  const result = await verifier.verifyToken(undefined, '1.2.3.4');

  assert.equal(result, false);
  assert.equal(fakeFetch.calls.length, 0);
});

test('verifyToken posts to the Cloudflare siteverify endpoint and returns success', async () => {
  const fakeFetch = createFakeFetch({ ok: true, json: async () => ({ success: true }) });
  const verifier = createTurnstileVerifier({ fetchImpl: fakeFetch.fn, secretKey: 'test-secret' });

  const result = await verifier.verifyToken('good-token', '1.2.3.4');

  assert.equal(result, true);
  assert.equal(fakeFetch.calls.length, 1);
  assert.equal(fakeFetch.calls[0].url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  const body = fakeFetch.calls[0].opts.body;
  assert.equal(body.get('secret'), 'test-secret');
  assert.equal(body.get('response'), 'good-token');
  assert.equal(body.get('remoteip'), '1.2.3.4');
});

test('verifyToken returns false when Cloudflare reports failure', async () => {
  const fakeFetch = createFakeFetch({ ok: true, json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }) });
  const verifier = createTurnstileVerifier({ fetchImpl: fakeFetch.fn, secretKey: 'test-secret' });

  const result = await verifier.verifyToken('bad-token', '1.2.3.4');

  assert.equal(result, false);
});

test('verifyToken returns false when the siteverify request itself fails', async () => {
  const fakeFetch = createFakeFetch({ ok: false, status: 500, json: async () => ({}) });
  const verifier = createTurnstileVerifier({ fetchImpl: fakeFetch.fn, secretKey: 'test-secret' });

  const result = await verifier.verifyToken('some-token', '1.2.3.4');

  assert.equal(result, false);
});
