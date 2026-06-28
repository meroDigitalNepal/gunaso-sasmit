const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('Missing required DATABASE_URL environment variable.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
});

module.exports = pool;
