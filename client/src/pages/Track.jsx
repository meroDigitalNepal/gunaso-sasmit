import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Heading, Text, Button, Card, Input, Badge } from '@mero-nepal/ui';
import Alert from '../components/Alert';
import { api } from '../api';

const STATUS_LABELS = { new: 'New', in_review: 'In Review', resolved: 'Resolved' };
const STATUS_VARIANTS = { new: 'primary', in_review: 'warning', resolved: 'success' };
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
            background: i <= current ? 'var(--mero-colors-primary)' : 'var(--mero-colors-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--mero-colors-text-on-primary)', fontSize: 'var(--mero-typography-size-xs)',
            fontWeight: 'var(--mero-typography-weight-semibold)',
          }}>
            {i < current ? '✓' : i + 1}
          </div>
          <div style={{
            fontSize: 'var(--mero-typography-size-xs)', position: 'absolute', marginTop: '44px',
            marginLeft: '-20px', whiteSpace: 'nowrap',
            color: i <= current ? 'var(--mero-colors-text)' : 'var(--mero-colors-text-subtle)',
          }}>
            {STATUS_LABELS[step]}
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: '2px', background: i < current ? 'var(--mero-colors-primary)' : 'var(--mero-colors-border)', margin: '0 4px' }} />
          )}
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <Text size="xs" subtle>{label}</Text>
      <Text size="sm">{children}</Text>
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
    } catch {
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
      <Heading level={1} style={{ marginBottom: '8px' }}>Track your Gunaso</Heading>
      <Text subtle style={{ marginBottom: '40px' }}>Enter your tracking ID to see the current status.</Text>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '40px' }}>
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Your tracking number here..."
          style={{ flex: 1 }}
        />
        <Button type="submit" loading={loading}>
          {loading ? 'Looking up…' : 'Track'}
        </Button>
      </form>

      {error && <Alert style={{ marginBottom: '20px' }}>{error}</Alert>}

      {submission && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <Text size="sm" subtle style={{ marginBottom: '4px' }}>{submission.trackingId}</Text>
              <Heading level={4}>{submission.title}</Heading>
            </div>
            <Badge variant={STATUS_VARIANTS[submission.status]}>{STATUS_LABELS[submission.status]}</Badge>
          </div>

          <div style={{ marginTop: '16px', paddingBottom: '48px' }}>
            <StatusTimeline status={submission.status} />
          </div>

          <div style={{ display: 'flex', gap: '20px', marginTop: '12px', flexWrap: 'wrap' }}>
            <Field label="Category">{CATEGORY_LABELS[submission.category]}</Field>
            <Field label="Submitted">{new Date(submission.createdAt).toLocaleDateString()}</Field>
            <Field label="Last updated">{new Date(submission.updatedAt).toLocaleDateString()}</Field>
          </div>

          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--mero-colors-border)' }}>
            <Text size="xs" subtle style={{ marginBottom: '6px' }}>Description</Text>
            <Text size="sm" style={{ lineHeight: 1.6 }}>{submission.description}</Text>
          </div>

          {submission.attachmentFileName && (
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--mero-colors-border)' }}>
              <Text size="xs" subtle style={{ marginBottom: '6px' }}>Attachment</Text>
              <a
                href={api.getTrackingAttachmentUrl(submission.trackingId)}
                style={{ fontSize: 'var(--mero-typography-size-sm)', color: 'var(--mero-colors-primary)' }}
              >
                {submission.attachmentFileName}
              </a>
            </div>
          )}

          {submission.publicResponse && (
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--mero-colors-border)' }}>
              <Text size="xs" subtle style={{ marginBottom: '6px' }}>Response from representative's team</Text>
              <Text size="sm" style={{ lineHeight: 1.6 }}>{submission.publicResponse}</Text>
            </div>
          )}
        </Card>
      )}
    </main>
  );
}
