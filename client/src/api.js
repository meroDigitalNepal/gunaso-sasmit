// In dev, call Express directly on port 3001 (bypasses Vite proxy).
// In production, BASE_URL is '/gunaso/' (set by vite.config.js base), giving '/gunaso'
// as the prefix — API calls become /gunaso/api/... which the Container App handles.
const BASE = import.meta.env.DEV
  ? 'http://localhost:3001'
  : import.meta.env.BASE_URL.replace(/\/$/, '');

let tokenGetter = null;

export function setTokenGetter(fn) {
  tokenGetter = fn;
}

async function request(method, path, body, extraHeaders = {}) {
  // FormData sets its own multipart boundary in the Content-Type header —
  // setting it manually here would break that boundary.
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers = { ...extraHeaders };
  if (!isFormData) headers['Content-Type'] = 'application/json';

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
  if (body) opts.body = isFormData ? body : JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// A plain <a href> can't carry the Authorization header on staff-only
// downloads — fetch as a blob with the same auth headers instead, then hand
// the caller an object URL to trigger the browser's save dialog with.
async function requestBlob(path) {
  const headers = {};
  if (tokenGetter) {
    const token = await tokenGetter();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  if (import.meta.env.DEV && import.meta.env.VITE_TENANT_SUBDOMAIN) {
    headers['X-Tenant-Subdomain'] = import.meta.env.VITE_TENANT_SUBDOMAIN;
  }

  const res = await fetch(`${BASE}${path}`, { headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Request failed');
  }
  return res.blob();
}

export const api = {
  getAttachmentBlob: (id) => requestBlob(`/api/submissions/${id}/attachment`),
  // Sends multipart/form-data so an optional attachment can travel alongside
  // the text fields. turnstileToken goes in a header, not the form body, so
  // the server can verify CAPTCHA before it has to buffer any file bytes.
  createSubmission: ({ turnstileToken, attachment, ...fields }) => {
    const formData = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') formData.append(key, value);
    });
    if (attachment) formData.append('attachment', attachment);
    return request('POST', '/api/submissions', formData, { 'X-Turnstile-Token': turnstileToken || '' });
  },
  listSubmissions: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/api/submissions${qs ? '?' + qs : ''}`);
  },
  // Public endpoint — aggregate counts only, powers the public /dashboard page.
  getStats: () => request('GET', '/api/submissions/stats'),
  getSubmission: (id) => request('GET', `/api/submissions/${id}`),
  updateSubmission: (id, body) => request('PATCH', `/api/submissions/${id}`, body),
  trackSubmission: (trackingId) => request('GET', `/api/submissions/track/${trackingId}`),
  // Public endpoint — no auth needed, so a plain URL works directly in an <a href>.
  getTrackingAttachmentUrl: (trackingId) => `${BASE}/api/submissions/track/${trackingId}/attachment`,
};
