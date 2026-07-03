const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function createTurnstileVerifier({ fetchImpl = fetch, secretKey = process.env.TURNSTILE_SECRET_KEY } = {}) {
  if (!secretKey) {
    console.warn('[turnstile] TURNSTILE_SECRET_KEY not set — CAPTCHA verification disabled.');
  }

  async function verifyToken(token, remoteIp) {
    if (!secretKey) return true;
    if (!token) return false;

    const body = new URLSearchParams({ secret: secretKey, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);

    const response = await fetchImpl(VERIFY_URL, { method: 'POST', body });
    if (!response.ok) return false;

    const result = await response.json();
    return Boolean(result.success);
  }

  return { verifyToken };
}

let defaultVerifier;

function getDefaultVerifier() {
  if (!defaultVerifier) {
    defaultVerifier = createTurnstileVerifier();
  }
  return defaultVerifier;
}

module.exports = {
  verifyToken: (...args) => getDefaultVerifier().verifyToken(...args),
  createTurnstileVerifier,
};
