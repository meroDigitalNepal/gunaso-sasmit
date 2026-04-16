const express = require('express');
const { v4: uuidv4 } = require('uuid');
const defaultStore = require('../store/submissionsStore');

const CATEGORIES = ['infrastructure', 'health', 'education', 'security', 'other'];
const STATUSES = ['new', 'in_review', 'resolved'];

function createSubmissionsRouter(store = defaultStore) {
  const router = express.Router();

  // POST /api/submissions — create new submission
  router.post('/', async (req, res) => {
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
      trackingId: uuidv4(),
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
      const created = await store.create(submission);
      res.status(201).json(created);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/submissions — list all (dashboard)
  router.get('/', async (req, res) => {
    try {
      const { status, category } = req.query;
      const filters = {};
      if (status) filters.status = status;
      if (category) filters.category = category;
      const submissions = await store.getAll(filters);
      res.json(submissions);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/submissions/track/:trackingId — citizen lookup (must be before /:id)
  router.get('/track/:trackingId', async (req, res) => {
    try {
      const submission = await store.getByTrackingId(req.params.trackingId.toUpperCase());
      if (!submission) return res.status(404).json({ error: 'Submission not found' });
      // Return only citizen-visible fields
      const { id, trackingId, title, category, description, status, createdAt, updatedAt, publicResponse } = submission;
      res.json({ id, trackingId, title, category, description, status, createdAt, updatedAt, publicResponse });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/submissions/:id — get single submission (dashboard)
  router.get('/:id', async (req, res) => {
    try {
      const submission = await store.getById(req.params.id);
      if (!submission) return res.status(404).json({ error: 'Submission not found' });
      res.json(submission);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/submissions/:id — update status / add response
  router.patch('/:id', async (req, res) => {
    const { status, publicResponse, internalNotes } = req.body;
    if (status && !STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
    }
    const updates = {};
    if (status !== undefined) updates.status = status;
    if (publicResponse !== undefined) updates.publicResponse = publicResponse;
    if (internalNotes !== undefined) updates.internalNotes = internalNotes;

    try {
      const updated = await store.update(req.params.id, updates);
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
