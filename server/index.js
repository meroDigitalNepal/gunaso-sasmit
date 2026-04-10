require('dotenv').config();
const express = require('express');
const cors = require('cors');
const submissionsRouter = require('./routes/submissions');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/submissions', submissionsRouter);

app.listen(PORT, () => {
  console.log(`Gunaso server running on http://localhost:${PORT}`);
});

module.exports = app;
