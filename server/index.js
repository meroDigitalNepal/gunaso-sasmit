require('dotenv').config();
const express = require('express');
const cors = require('cors');
const defaultStore = require('./store/submissionsStore');
const { createSubmissionsRouter } = require('./routes/submissions');

function createApp(store = defaultStore) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/api/submissions', createSubmissionsRouter(store));

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
