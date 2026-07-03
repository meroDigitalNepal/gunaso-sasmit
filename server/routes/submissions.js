const express = require('express');
const multer = require('multer');
const { fromBuffer: sniffFileType } = require('file-type');
const { v4: uuidv4 } = require('uuid');
const defaultStore = require('../store/submissionsStore');
const { resolveTenant } = require('../middleware/tenant');
const { requireAuth, requireRole } = require('../middleware/auth');
const { submissionRateLimit: defaultSubmissionRateLimit } = require('../middleware/rateLimit');
const defaultMailer = require('../utils/mailer');
const defaultTurnstileVerifier = require('../utils/turnstile');
const defaultBlobStorage = require('../utils/blobStorage');

const CATEGORIES = ['infrastructure', 'health', 'education', 'security', 'other'];
const STATUSES = ['new', 'in_review', 'resolved'];

const ALLOWED_ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 10,
    fieldSize: 10 * 1024,
  },
});

async function streamSubmissionAttachment(res, submission, blobStorage) {
  if (!submission || !submission.attachmentBlobPath) {
    return res.status(404).json({ error: 'Attachment not found' });
  }
  const stream = await blobStorage.streamAttachment(submission.attachmentBlobPath);
  res.set('Content-Type', submission.attachmentContentType);
  res.attachment(submission.attachmentFileName);
  stream.pipe(res);
}

function createSubmissionsRouter(store = defaultStore, {
  resolveTenantMiddleware = resolveTenant,
  mailer = defaultMailer,
  submissionRateLimit = defaultSubmissionRateLimit,
  turnstileVerifier = defaultTurnstileVerifier,
  blobStorage = defaultBlobStorage,
} = {}) {
  const router = express.Router();

  // POST /api/submissions — public: any citizen can submit
  router.post(
    '/',
    submissionRateLimit,
    resolveTenantMiddleware,
    // CAPTCHA is verified before multer parses the multipart body — the
    // token travels as a header (X-Turnstile-Token), not a form field, so a
    // bad/missing token is rejected before any file bytes are buffered.
    // Reversing this order would let an unauthenticated request force up to
    // 5MB into memory before CAPTCHA is ever checked.
    async (req, res, next) => {
      const captchaValid = await turnstileVerifier.verifyToken(req.get('X-Turnstile-Token'), req.ip);
      if (!captchaValid) {
        return res.status(400).json({ error: 'CAPTCHA verification failed' });
      }
      next();
    },
    upload.single('attachment'),
    async (req, res) => {
      const { title, category, description, contactEmail } = req.body;

      if (!title || !category || !description) {
        return res.status(400).json({ error: 'title, category, and description are required' });
      }
      if (!CATEGORIES.includes(category)) {
        return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
      }

      // Never trust req.file.mimetype — it's just the client's declared
      // Content-Type header and trivially spoofable. Sniff the real type
      // from the file's magic bytes instead.
      let sniffedType = null;
      if (req.file) {
        // A file with a valid signature prefix but corrupted/truncated
        // internal structure can make the sniffer throw rather than return
        // undefined (e.g. a PNG header followed by garbage instead of a
        // real image) — treat that the same as "unrecognized type" rather
        // than letting it propagate as an unhandled rejection.
        const sniffed = await sniffFileType(req.file.buffer).catch(() => null);
        if (!sniffed || !ALLOWED_ATTACHMENT_TYPES.has(sniffed.mime)) {
          return res.status(400).json({ error: 'Attachment must be a JPG, PNG, WEBP, PDF, DOC, or DOCX file' });
        }
        sniffedType = sniffed.mime;
      }

      const now = new Date().toISOString();
      const submissionId = uuidv4();

      try {
        let attachmentFields = {
          attachmentFileName: null,
          attachmentContentType: null,
          attachmentSizeBytes: null,
          attachmentBlobPath: null,
        };

        if (req.file) {
          const blobPath = await blobStorage.uploadAttachment({
            mpId: req.mp.id,
            submissionId,
            buffer: req.file.buffer,
            contentType: sniffedType,
            originalFileName: req.file.originalname,
          });
          // blobPath is null when blob storage isn't configured (e.g. local
          // dev) — skip the attachment entirely rather than store metadata
          // for a file that was never actually saved anywhere, matching the
          // mailer/Turnstile precedent of gracefully no-op'ing optional
          // integrations instead of failing the whole submission.
          if (blobPath) {
            attachmentFields = {
              attachmentFileName: req.file.originalname,
              attachmentContentType: sniffedType,
              attachmentSizeBytes: req.file.size,
              attachmentBlobPath: blobPath,
            };
          }
        }

        const submission = {
          id: submissionId,
          trackingId: uuidv4().toUpperCase(),
          title,
          category,
          description,
          contactEmail: contactEmail || null,
          status: 'new',
          createdAt: now,
          updatedAt: now,
          publicResponse: null,
          internalNotes: null,
          ...attachmentFields,
        };

        const created = await store.create(req.mp.id, submission);
        res.status(201).json(created);

        if (created.contactEmail) {
          // Fire-and-forget, wrapped so even a synchronous throw from the mailer
          // becomes a rejection instead of bubbling into this try/catch — headers
          // are already sent above, so a second res.status() call would crash.
          Promise.resolve()
            .then(() => mailer.sendSubmissionConfirmationEmail({
              to: created.contactEmail,
              title: created.title,
              trackingId: created.trackingId,
              mpName: req.mp.name,
            }))
            .catch((err) => console.error('[submissions] Failed to send confirmation email:', err.message));
        }
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
  );

  // GET /api/submissions — admin only
  router.get('/', resolveTenantMiddleware, requireAuth, requireRole('staff'), async (req, res) => {
    try {
      const { status, category } = req.query;
      const filters = {};
      if (status) filters.status = status;
      if (category) filters.category = category;
      const submissions = await store.getAll(req.mp.id, filters);
      res.json(submissions);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/submissions/track/:trackingId — public: citizen tracking lookup
  router.get('/track/:trackingId', resolveTenantMiddleware, async (req, res) => {
    try {
      const submission = await store.getByTrackingId(
        req.mp.id,
        req.params.trackingId.toUpperCase(),
      );
      if (!submission) return res.status(404).json({ error: 'Submission not found' });

      const { id, trackingId, title, category, description, status, createdAt, updatedAt, publicResponse, attachmentFileName } = submission;
      res.json({ id, trackingId, title, category, description, status, createdAt, updatedAt, publicResponse, attachmentFileName });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/submissions/track/:trackingId/attachment — public: the citizen's
  // own attachment. No auth beyond knowing the tracking ID — same trust
  // model already used for the rest of the track response (title,
  // description, status, publicResponse are all accessible this way too).
  router.get('/track/:trackingId/attachment', resolveTenantMiddleware, async (req, res) => {
    try {
      const submission = await store.getByTrackingId(
        req.mp.id,
        req.params.trackingId.toUpperCase(),
      );
      await streamSubmissionAttachment(res, submission, blobStorage);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/submissions/:id — admin only
  router.get('/:id', resolveTenantMiddleware, requireAuth, requireRole('staff'), async (req, res) => {
    try {
      const submission = await store.getById(req.mp.id, req.params.id);
      if (!submission) return res.status(404).json({ error: 'Submission not found' });
      res.json(submission);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/submissions/:id/attachment — admin only: stream the attached file
  router.get('/:id/attachment', resolveTenantMiddleware, requireAuth, requireRole('staff'), async (req, res) => {
    try {
      const submission = await store.getById(req.mp.id, req.params.id);
      await streamSubmissionAttachment(res, submission, blobStorage);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/submissions/:id — admin only
  // Status validation runs before requireAuth so callers get a 400 immediately
  // on a bad enum value rather than a 401 that masks the real error.
  router.patch('/:id', resolveTenantMiddleware, (req, res, next) => {
    const { status } = req.body;
    if (status && !STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
    }
    next();
  }, requireAuth, requireRole('staff'), async (req, res) => {
    const { status, publicResponse, internalNotes } = req.body;
    const updates = {};
    if (status !== undefined) updates.status = status;
    if (publicResponse !== undefined) updates.publicResponse = publicResponse;
    if (internalNotes !== undefined) updates.internalNotes = internalNotes;

    try {
      const updated = await store.update(req.mp.id, req.params.id, updates);
      if (!updated) return res.status(404).json({ error: 'Submission not found' });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Multer's own limit violations (file too large, more than one file)
  // surface via Express's error-handling path, not this router's own
  // try/catch blocks — this is the app's first error-handling middleware.
  router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'File must be 5MB or smaller'
        : (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') ? 'Only one file may be attached'
        : 'Upload error';
      return res.status(400).json({ error: message });
    }
    next(err);
  });

  return router;
}

module.exports = createSubmissionsRouter();
module.exports.createSubmissionsRouter = createSubmissionsRouter;
