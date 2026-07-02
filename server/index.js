require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const defaultStore = require('./store/submissionsStore');
const { createSubmissionsRouter } = require('./routes/submissions');
const { resolveTenant } = require('./middleware/tenant');

const STATIC_DIR = path.join(__dirname, 'public', 'gunaso');

function createApp(store = defaultStore, { resolveTenantMiddleware = resolveTenant, mailer } = {}) {
  const app = express();

  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  }));
  app.use(express.json());

  const submissionsRouter = createSubmissionsRouter(store, { resolveTenantMiddleware, mailer });
  // /gunaso/api — production path (browser → Container App at full URL)
  // /api        — local dev path (Vite dev server → Express directly on port 3001)
  app.use('/gunaso/api/submissions', submissionsRouter);
  app.use('/api/submissions', submissionsRouter);

  app.use('/gunaso', express.static(STATIC_DIR));
  app.get('/gunaso', (req, res) => res.redirect('/gunaso/'));
  app.get('/gunaso/*', (req, res) => {
    res.sendFile('index.html', { root: STATIC_DIR }, (err) => {
      if (err) res.status(404).json({ error: 'Frontend not built.' });
    });
  });

  return app;
}

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Gunaso server running on http://localhost:${PORT}`);
  });
}

module.exports = createApp;
