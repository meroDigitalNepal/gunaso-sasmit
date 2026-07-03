const rateLimit = require('express-rate-limit');

// 8 submissions per IP per hour. Relies on Express's 'trust proxy' setting
// (set in index.js) to read the real client IP from X-Forwarded-For behind
// the Azure Container Apps ingress — without it this either rate-limits
// everyone as one IP or is trivially bypassed by a spoofed header.
const submissionRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions from this IP. Please try again later.' },
});

module.exports = { submissionRateLimit };
