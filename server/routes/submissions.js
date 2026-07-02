const express = require('express');
const { v4: uuidv4 } = require('uuid');
const defaultStore = require('../store/submissionsStore');
const { resolveTenant } = require('../middleware/tenant');
const { requireAuth, requireRole } = require('../middleware/auth');
const defaultMailer = require('../utils/mailer');

const CATEGORIES = ['infrastructure', 'health', 'education', 'security', 'other'];
const STATUSES = ['new', 'in_review', 'resolved'];

function createSubmissionsRouter(store = defaultStore, { resolveTenantMiddleware = resolveTenant, mailer = defaultMailer } = {}) {
  const router = express.Router();

  // POST /api/submissions — public: any citizen can submit
  router.post('/', resolveTenantMiddleware, async (req, res) => {
    const { title, category, description, contactEmail } = req.body;

    if (!title || !category || !description) {
      return res.status(400).json({ error: 'title, category, and description are required' });
    }
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
    }

    const now = new Date().toISOString();
    const submission = {
      id: uuidv4(),
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
    };

    try {
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
          }))
          .catch((err) => console.error('[submissions] Failed to send confirmation email:', err.message));
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

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

      const { id, trackingId, title, category, description, status, createdAt, updatedAt, publicResponse } = submission;
      res.json({ id, trackingId, title, category, description, status, createdAt, updatedAt, publicResponse });
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

  return router;
}

module.exports = createSubmissionsRouter();
module.exports.createSubmissionsRouter = createSubmissionsRouter;
