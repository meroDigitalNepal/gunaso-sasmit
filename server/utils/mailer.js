const { ConfidentialClientApplication } = require('@azure/msal-node');

const GRAPH_SCOPE = 'https://graph.microsoft.com/.default';

function graphSendMailUrl(mailbox) {
  return `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/sendMail`;
}

function buildConfirmationHtml({ title, trackingId, trackingUrl, mpName }) {
  const office = mpName ? `the office of ${mpName}` : 'your representative’s office';
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:32px;">
            <tr>
              <td>
                <h2 style="margin:0 0 12px;color:#111827;">Namaste,</h2>
                <p style="margin:0 0 16px;color:#4b5563;line-height:1.5;">
                  Thank you for taking the time to reach out. We've received your Gunaso${title ? ` about "${title}"` : ''}, and ${office} will look into it and get back to you soon.
                </p>
                <p style="margin:0 0 20px;color:#4b5563;line-height:1.5;">
                  You can check on its progress anytime using the tracking ID below.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;border-radius:6px;margin-bottom:24px;">
                  <tr>
                    <td style="padding:16px 20px;">
                      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">Tracking ID</p>
                      <p style="margin:0;font-size:18px;font-weight:bold;letter-spacing:1px;color:#111827;">${trackingId}</p>
                    </td>
                  </tr>
                </table>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:6px;background:#2563eb;">
                      <a href="${trackingUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:bold;">Track My Gunaso</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #e5e7eb;color:#b0b7c3;font-size:12px;line-height:1.5;">
                  Sent via Sachivalaya, on behalf of ${office}.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// Graph enforces a hard max of 4 concurrent sendMail requests per app+mailbox
// pair — exceeding it just gets 429'd. We cap below that so bursts (e.g. many
// submissions at once) queue briefly in-process rather than getting throttled.
const DEFAULT_MAX_CONCURRENT_SENDS = 3;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

// Circuit breaker: a failure only reaches this layer after postToGraph has
// already exhausted its own retry loop, so it's a pre-filtered signal, not
// raw noise — a low threshold is appropriate. 1 minute comfortably clears a
// throttling-driven trip (Graph's Retry-After is typically seconds-to-tens
// of seconds) without excessive delay to legitimate senders.
const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_COOLDOWN_MS = 60_000;

function createMailer({
  fetchImpl = fetch,
  msalApp = null,
  senderAddress = process.env.MAIL_SENDER_ADDRESS,
  publicAppUrl = process.env.PUBLIC_APP_URL,
  sleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
  maxConcurrentSends = DEFAULT_MAX_CONCURRENT_SENDS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  failureThreshold = DEFAULT_FAILURE_THRESHOLD,
  cooldownMs = DEFAULT_COOLDOWN_MS,
} = {}) {
  const enabled = Boolean(msalApp && senderAddress && publicAppUrl);
  if (!enabled) {
    console.warn('[mailer] Graph mail not configured (GRAPH_CLIENT_ID/GRAPH_CLIENT_SECRET/MAIL_SENDER_ADDRESS/PUBLIC_APP_URL missing) — confirmation emails disabled.');
  }

  // Tiny in-process counting semaphore — keeps concurrent Graph sends under
  // maxConcurrentSends without pulling in a queue dependency.
  let active = 0;
  const waiting = [];
  function acquire() {
    if (active < maxConcurrentSends) {
      active += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => waiting.push(resolve)).then(() => { active += 1; });
  }
  function release() {
    active -= 1;
    const next = waiting.shift();
    if (next) next();
  }

  // Circuit breaker state — in-memory, per-process (same assumption the
  // semaphore above already makes). Revisit if this ever runs as multiple
  // replicas behind a load balancer.
  let circuitState = 'closed'; // 'closed' | 'open' | 'half-open'
  let consecutiveFailures = 0;
  let openedAt = null;
  let halfOpenInFlight = false;

  // Synchronous — no await inside, so under Node's event loop two
  // "concurrent" callers can never interleave the open→half-open transition
  // and the halfOpenInFlight reservation; one call's synchronous prefix
  // always finishes before another callback runs.
  function tryEnterCircuit() {
    if (circuitState === 'open') {
      if (now() - openedAt >= cooldownMs) {
        circuitState = 'half-open';
      } else {
        return { proceed: false };
      }
    }
    if (circuitState === 'half-open') {
      if (halfOpenInFlight) return { proceed: false };
      halfOpenInFlight = true;
    }
    return { proceed: true };
  }

  function recordSuccess() {
    circuitState = 'closed';
    consecutiveFailures = 0;
    openedAt = null;
    halfOpenInFlight = false;
  }

  function recordFailure() {
    consecutiveFailures += 1;
    if (circuitState === 'half-open' || consecutiveFailures >= failureThreshold) {
      circuitState = 'open';
      openedAt = now();
    }
    halfOpenInFlight = false;
  }

  async function postToGraph(accessToken, message) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
      let response;
      try {
        response = await fetchImpl(graphSendMailUrl(senderAddress), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message, saveToSentItems: false }),
          signal: controller.signal,
        });
      } catch (err) {
        // Network error or timeout — retryable like a 5xx.
        if (attempt === maxAttempts) throw new Error(`Graph sendMail failed: network error (${err.message})`);
        await sleepImpl(attempt * 1000);
        continue;
      } finally {
        clearTimeout(timeoutId);
      }

      if (response.ok) return;

      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === maxAttempts) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Graph sendMail failed: ${response.status} ${detail}`);
      }

      // Graph returns Retry-After (seconds) on throttling; fall back to a
      // short linear backoff for transient 5xx errors that omit it.
      const retryAfterHeader = response.headers?.get?.('retry-after');
      const delayMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : attempt * 1000;
      await sleepImpl(delayMs);
    }
  }

  async function sendSubmissionConfirmationEmail({ to, title, trackingId, mpName }) {
    if (!enabled || !to) return { sent: false };

    const gate = tryEnterCircuit();
    if (!gate.proceed) return { sent: false, circuitOpen: true };

    const trackingUrl = `${publicAppUrl.replace(/\/$/, '')}/track/${trackingId}`;

    await acquire();
    try {
      const { accessToken } = await msalApp.acquireTokenByClientCredential({ scopes: [GRAPH_SCOPE] });
      if (!accessToken) throw new Error('Failed to acquire Graph access token');

      await postToGraph(accessToken, {
        subject: "We've received your Gunaso",
        body: { contentType: 'HTML', content: buildConfirmationHtml({ title, trackingId, trackingUrl, mpName }) },
        toRecipients: [{ emailAddress: { address: to } }],
      });
      recordSuccess();
      return { sent: true };
    } catch (err) {
      recordFailure();
      throw err;
    } finally {
      release();
    }
  }

  return { sendSubmissionConfirmationEmail };
}

let defaultMailer;

function getDefaultMailer() {
  if (!defaultMailer) {
    const { GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, ENTRA_TENANT_ID, MAIL_SENDER_ADDRESS, PUBLIC_APP_URL } = process.env;

    let msalApp = null;
    if (GRAPH_CLIENT_ID && GRAPH_CLIENT_SECRET && ENTRA_TENANT_ID) {
      msalApp = new ConfidentialClientApplication({
        auth: {
          clientId: GRAPH_CLIENT_ID,
          authority: `https://login.microsoftonline.com/${ENTRA_TENANT_ID}`,
          clientSecret: GRAPH_CLIENT_SECRET,
        },
      });
    }

    defaultMailer = createMailer({
      msalApp,
      senderAddress: MAIL_SENDER_ADDRESS,
      publicAppUrl: PUBLIC_APP_URL,
    });
  }
  return defaultMailer;
}

module.exports = {
  sendSubmissionConfirmationEmail: (...args) => getDefaultMailer().sendSubmissionConfirmationEmail(...args),
  createMailer,
};
