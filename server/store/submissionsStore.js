const { toDb, fromDb } = require('../utils/caseConvert');

// PostgREST error code for zero rows returned by .single()
const NOT_FOUND = 'PGRST116';

let defaultStore;

function getDefaultSupabase() {
  return require('../utils/supabase').supabase;
}

function createSubmissionsStore(supabaseClient = getDefaultSupabase()) {
  async function getAll(filters = {}) {
    let query = supabaseClient
      .from('submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.category) query = query.eq('category', filters.category);

    const { data, error } = await query;
    if (error) throw error;
    return data.map(fromDb);
  }

  async function getById(id) {
    const { data, error } = await supabaseClient
      .from('submissions')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === NOT_FOUND) return null;
      throw error;
    }
    return fromDb(data);
  }

  async function getByTrackingId(trackingId) {
    const { data, error } = await supabaseClient
      .from('submissions')
      .select('*')
      .eq('tracking_id', trackingId)
      .single();
    if (error) {
      if (error.code === NOT_FOUND) return null;
      throw error;
    }
    return fromDb(data);
  }

  async function create(submission) {
    const { data, error } = await supabaseClient
      .from('submissions')
      .insert(toDb(submission))
      .select()
      .single();
    if (error) throw error;
    return fromDb(data);
  }

  async function update(id, updates) {
    const dbUpdates = toDb({ ...updates, updatedAt: new Date().toISOString() });
    const { data, error } = await supabaseClient
      .from('submissions')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      if (error.code === NOT_FOUND) return null;
      throw error;
    }
    return fromDb(data);
  }

  return { getAll, getById, getByTrackingId, create, update };
}

function getDefaultStore() {
  if (!defaultStore) defaultStore = createSubmissionsStore();
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
