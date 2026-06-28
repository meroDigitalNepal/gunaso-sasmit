require('dotenv').config();
const express = require('express');
const cors = require('cors');
const defaultStore = require('./store/submissionsStore');
const { createSubmissionsRouter } = require('./routes/submissions');
const { resolveTenant } = require('./middleware/tenant');

function createApp(store = defaultStore, { resolveTenantMiddleware = resolveTenant } = {}) {
  const app = express();

  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  }));
  app.use(express.json());

  app.use('/api/submissions', createSubmissionsRouter(store, { resolveTenantMiddleware }));

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
