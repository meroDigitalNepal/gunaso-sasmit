require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./utils/db');

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id      SERIAL      PRIMARY KEY,
      name    TEXT        UNIQUE NOT NULL,
      run_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const { rows } = await pool.query('SELECT 1 FROM migrations WHERE name = $1', [file]);
    if (rows.length > 0) {
      console.log(`Skipping (already run): ${file}`);
      continue;
    }

    console.log(`Running: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await pool.query(sql);
    await pool.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
    console.log(`Done: ${file}`);
  }

  console.log('All migrations complete.');
  await pool.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
