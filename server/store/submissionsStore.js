const { fromDb, toDb } = require('../utils/caseConvert');

// parliamentarian_id is a server-side scoping key; strip it before returning
// submissions to callers so it never appears in API responses.
function toSubmission(dbRow) {
  const row = fromDb(dbRow);
  delete row.parliamentarianId;
  return row;
}

function createSubmissionsStore(pool) {
  async function getAll(parliamentarianId, filters = {}) {
    const conditions = ['parliamentarian_id = $1'];
    const params = [parliamentarianId];

    if (filters.status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(filters.status);
    }
    if (filters.category) {
      conditions.push(`category = $${params.length + 1}`);
      params.push(filters.category);
    }

    const sql = `SELECT * FROM submissions WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`;
    const { rows } = await pool.query(sql, params);
    return rows.map(toSubmission);
  }

  async function getById(parliamentarianId, id) {
    const { rows } = await pool.query(
      'SELECT * FROM submissions WHERE id = $1 AND parliamentarian_id = $2',
      [id, parliamentarianId],
    );
    return rows[0] ? toSubmission(rows[0]) : null;
  }

  async function getByTrackingId(parliamentarianId, trackingId) {
    const { rows } = await pool.query(
      'SELECT * FROM submissions WHERE tracking_id = $1 AND parliamentarian_id = $2',
      [trackingId, parliamentarianId],
    );
    return rows[0] ? toSubmission(rows[0]) : null;
  }

  async function create(parliamentarianId, submission) {
    const dbRow = { ...toDb(submission), parliamentarian_id: parliamentarianId };
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

  async function update(parliamentarianId, id, updates) {
    const dbUpdates = toDb({ ...updates, updatedAt: new Date().toISOString() });
    const columns = Object.keys(dbUpdates);

    const setClauses = columns.map((col, i) => `${col} = $${i + 1}`);
    const values = [
      ...columns.map(col => dbUpdates[col]),
      id,
      parliamentarianId,
    ];

    const sql = `
      UPDATE submissions
      SET ${setClauses.join(', ')}
      WHERE id = $${columns.length + 1} AND parliamentarian_id = $${columns.length + 2}
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
