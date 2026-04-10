import { useState } from 'react';
import { api } from '../api';

const CATEGORIES = [
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'health', label: 'Health' },
  { value: 'education', label: 'Education' },
  { value: 'security', label: 'Security' },
  { value: 'other', label: 'Other' },
];

export default function Submit() {
  const [form, setForm] = useState({ title: '', category: '', description: '', contactEmail: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(result.trackingId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const submission = await api.createSubmission(form);
      setResult(submission);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <main className="page" style={{ paddingTop: '80px', paddingBottom: '80px', maxWidth: '560px' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>✓</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '8px' }}>Request submitted</h2>
          <p className="text-secondary mb-24">Save your tracking ID to check on progress.</p>
          <div style={{
            background: '#fff',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '18px 24px',
            marginBottom: '24px',
          }}>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Tracking ID</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <p style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '1px', color: 'var(--color-accent)', margin: 0 }}>
                {result.trackingId}
              </p>
              <div style={{ position: 'relative', display: 'inline-flex' }}>
                {copied && (
                  <div style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 6px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--color-text-primary)',
                    color: '#fff',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    padding: '4px 8px',
                    borderRadius: '6px',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                  }}>
                    Copied
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      borderWidth: '4px',
                      borderStyle: 'solid',
                      borderColor: 'var(--color-text-primary) transparent transparent transparent',
                    }} />
                  </div>
                )}
                <button
                  onClick={handleCopy}
                  title="Copy tracking ID"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: copied ? '#e6f4ea' : 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    width: '32px',
                    height: '32px',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'background 0.15s',
                  }}
                >
                  {copied ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 8.5L6.5 12L13 5" stroke="#1d7a3b" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="-1 -1 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="5.5" y="5.5" width="8" height="9" rx="1.5" stroke="var(--color-text-secondary)" strokeWidth="1.25"/>
                      <path d="M5.5 10H4a1.5 1.5 0 0 1-1.5-1.5v-7A1.5 1.5 0 0 1 4 0h7a1.5 1.5 0 0 1 1.5 1.5V3" stroke="var(--color-text-secondary)" strokeWidth="1.25" strokeLinecap="round"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={`/track/${result.trackingId}`} className="btn btn-primary">Track this request</a>
            <button className="btn btn-secondary" onClick={() => setResult(null)}>Submit another</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page" style={{ paddingTop: '64px', paddingBottom: '80px', maxWidth: '560px' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: '8px' }}>Submit a request</h1>
      <p className="text-secondary mb-40">Your MP's team will review and respond to your submission.</p>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">Title</label>
          <input
            id="title" name="title" type="text"
            placeholder="Brief summary of your request"
            value={form.title} onChange={handleChange} required
          />
        </div>

        <div className="form-group">
          <label htmlFor="category">Category</label>
          <select id="category" name="category" value={form.category} onChange={handleChange} required>
            <option value="">Select a category</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description" name="description"
            placeholder="Describe your request in detail"
            value={form.description} onChange={handleChange} required
          />
        </div>

        <div className="form-group">
          <label htmlFor="contactEmail">Contact email <span className="text-secondary" style={{ fontWeight: 400 }}>(optional)</span></label>
          <input
            id="contactEmail" name="contactEmail" type="email"
            placeholder="you@example.com"
            value={form.contactEmail} onChange={handleChange}
          />
          <span className="form-hint">We'll only use this to follow up on your request.</span>
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: '8px' }}>
          {loading ? 'Submitting…' : 'Submit request'}
        </button>
      </form>
    </main>
  );
}
