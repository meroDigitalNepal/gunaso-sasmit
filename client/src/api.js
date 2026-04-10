const BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  createSubmission: (body) => request('POST', '/api/submissions', body),
  listSubmissions: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/api/submissions${qs ? '?' + qs : ''}`);
  },
  getSubmission: (id) => request('GET', `/api/submissions/${id}`),
  updateSubmission: (id, body) => request('PATCH', `/api/submissions/${id}`, body),
  trackSubmission: (trackingId) => request('GET', `/api/submissions/track/${trackingId}`),
};
