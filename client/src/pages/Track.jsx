import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';

const STATUS_LABELS = { new: 'New', in_review: 'In Review', resolved: 'Resolved' };
const CATEGORY_LABELS = {
  infrastructure: 'Infrastructure', health: 'Health',
  education: 'Education', security: 'Security', other: 'Other',
};

function StatusTimeline({ status }) {
  const steps = ['new', 'in_review', 'resolved'];
  const current = steps.indexOf(status);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginTop: '24px', marginBottom: '8px' }}>
      {steps.map((step, i) => (
        <div key={step} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: i <= current ? 'var(--color-accent)' : 'var(--color-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: '0.75rem', fontWeight: 600,
          }}>
            {i < current ? '✓' : i + 1}
          </div>
          <div style={{ fontSize: '0.75rem', position: 'absolute', marginTop: '44px', marginLeft: '-20px', whiteSpace: 'nowrap', color: i <= current ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
            {STATUS_LABELS[step]}
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: '2px', background: i < current ? 'var(--color-accent)' : 'var(--color-border)', margin: '0 4px' }} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function Track() {
  const { trackingId: paramId } = useParams();
  const [input, setInput] = useState(paramId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submission, setSubmission] = useState(null);

  useEffect(() => {
    if (paramId) fetchSubmission(paramId);
  }, [paramId]);

  async function fetchSubmission(id) {
    setError(null);
    setLoading(true);
    try {
      const data = await api.trackSubmission(id.trim().toUpperCase());
      setSubmission(data);
    } catch (err) {
      setError('No submission found with that tracking ID.');
      setSubmission(null);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (input.trim()) fetchSubmission(input.trim());
  }

  return (
    <main className="page" style={{ paddingTop: '64px', paddingBottom: '80px', maxWidth: '640px' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: '8px' }}>Track your request</h1>
      <p className="text-secondary mb-40">Enter your tracking ID to see the current status.</p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '40px' }}>
        <input
          type="text" value={input} onChange={e => setInput(e.target.value)}
          placeholder="Your tracking number here..."
          style={{
            flex: 1, padding: '10px 14px', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-sans)', fontSize: '0.9375rem',
            outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--color-accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Looking up…' : 'Track'}
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {submission && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                {submission.trackingId}
              </p>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{submission.title}</h2>
            </div>
            <span className={`badge badge-${submission.status}`}>{STATUS_LABELS[submission.status]}</span>
          </div>

          <div style={{ marginTop: '16px', paddingBottom: '48px' }}>
            <StatusTimeline status={submission.status} />
          </div>

          <div style={{ display: 'flex', gap: '20px', marginTop: '12px', flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Category</p>
              <p style={{ fontSize: '0.9rem' }}>{CATEGORY_LABELS[submission.category]}</p>
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Submitted</p>
              <p style={{ fontSize: '0.9rem' }}>{new Date(submission.createdAt).toLocaleDateString()}</p>
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Last updated</p>
              <p style={{ fontSize: '0.9rem' }}>{new Date(submission.updatedAt).toLocaleDateString()}</p>
            </div>
          </div>

          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--color-border)' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>Description</p>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>{submission.description}</p>
          </div>

          {submission.publicResponse && (
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--color-border)' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>Response from MP's team</p>
              <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>{submission.publicResponse}</p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
