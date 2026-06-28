const BASE = import.meta.env.DEV
  ? 'http://localhost:3001'
  : import.meta.env.VITE_API_BASE_URL || '';

let tokenGetter = null;

export function setTokenGetter(fn) {
  tokenGetter = fn;
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };

  if (tokenGetter) {
    const token = await tokenGetter();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  // In local development, tell the backend which tenant to use since
  // the Host header won't have a real subdomain.
  if (import.meta.env.DEV && import.meta.env.VITE_TENANT_SUBDOMAIN) {
    headers['X-Tenant-Subdomain'] = import.meta.env.VITE_TENANT_SUBDOMAIN;
  }

  const opts = { method, headers };
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
