const { fromDb, toDb } = require('../utils/caseConvert');

// mp_id is a server-side scoping key; strip it before returning
// submissions to callers so it never appears in API responses.
function toSubmission(dbRow) {
  const row = fromDb(dbRow);
  delete row.mpId;
  return row;
}

function createSubmissionsStore(pool) {
  async function getAll(mpId, filters = {}) {
    const conditions = ['mp_id = $1'];
    const params = [mpId];

    if (filters.status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(filters.status);
    }

    const sql = `SELECT * FROM submissions WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`;
    const { rows } = await pool.query(sql, params);
    return rows.map(toSubmission);
  }

  async function getById(mpId, id) {
    const { rows } = await pool.query(
      'SELECT * FROM submissions WHERE id = $1 AND mp_id = $2',
      [id, mpId],
    );
    return rows[0] ? toSubmission(rows[0]) : null;
  }

  async function getByTrackingId(mpId, trackingId) {
    const { rows } = await pool.query(
      'SELECT * FROM submissions WHERE tracking_id = $1 AND mp_id = $2',
      [trackingId, mpId],
    );
    return rows[0] ? toSubmission(rows[0]) : null;
  }

  async function create(mpId, submission) {
    const dbRow = { ...toDb(submission), mp_id: mpId };
    const columns = Object.keys(dbRow);
    const placeholders = columns.map((_, i) => `$${i + 1}`);
    const values = columns.map(col => dbRow[col]);

    const sql = `
      INSERT INTO submissions (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;
    const { rows } = await pool.query(sql, values);
    return toSubmission(rows[0]);
  }

  async function update(mpId, id, updates) {
    const dbUpdates = toDb({ ...updates, updatedAt: new Date().toISOString() });
    const columns = Object.keys(dbUpdates);

    const setClauses = columns.map((col, i) => `${col} = $${i + 1}`);
    const values = [
      ...columns.map(col => dbUpdates[col]),
      id,
      mpId,
    ];

    const sql = `
      UPDATE submissions
      SET ${setClauses.join(', ')}
      WHERE id = $${columns.length + 1} AND mp_id = $${columns.length + 2}
      RETURNING *
    `;
    const { rows } = await pool.query(sql, values);
    return rows[0] ? toSubmission(rows[0]) : null;
  }

  return { getAll, getById, getByTrackingId, create, update };
}

let defaultStore;

function getDefaultStore() {
  if (!defaultStore) {
    const pool = require('../utils/db');
    defaultStore = createSubmissionsStore(pool);
  }
  return defaultStore;
}

module.exports = {
  getAll: (...args) => getDefaultStore().getAll(...args),
  getById: (...args) => getDefaultStore().getById(...args),
  getByTrackingId: (...args) => getDefaultStore().getByTrackingId(...args),
  create: (...args) => getDefaultStore().create(...args),
  update: (...args) => getDefaultStore().update(...args),
  createSubmissionsStore,
};
