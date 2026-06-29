import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Heading, Text, Button, Card, Select, Textarea, Stack } from '@mero-nepal/ui';
import Alert from '../components/Alert';
import { api } from '../api';

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'in_review', label: 'In Review' },
  { value: 'resolved', label: 'Resolved' },
];

const CATEGORY_LABELS = {
  infrastructure: 'Infrastructure', health: 'Health',
  education: 'Education', security: 'Security', other: 'Other',
};

export default function RequestDetail() {
  const { id } = useParams();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [status, setStatus] = useState('');
  const [publicResponse, setPublicResponse] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  useEffect(() => {
    fetchSubmission();
  }, [id]);

  async function fetchSubmission() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSubmission(id);
      setSubmission(data);
      setStatus(data.status);
      setPublicResponse(data.publicResponse || '');
      setInternalNotes(data.internalNotes || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveSuccess(false);
    setError(null);
    try {
      const updated = await api.updateSubmission(id, { status, publicResponse, internalNotes });
      setSubmission(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="page" style={{ paddingTop: '64px' }}><Text subtle>Loading…</Text></main>;
  if (error && !submission) return (
    <main className="page" style={{ paddingTop: '64px' }}>
      <Alert style={{ marginBottom: '16px' }}>{error}</Alert>
      <Button as={Link} to="/dashboard" variant="secondary">← Back to dashboard</Button>
    </main>
  );
  if (!submission) return null;

  return (
    <main className="page" style={{ paddingTop: '48px', paddingBottom: '80px', maxWidth: '720px' }}>
      <Link to="/dashboard" style={{ fontSize: 'var(--mero-typography-size-sm)', color: 'var(--mero-colors-text-subtle)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '28px' }}>
        ← Dashboard
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '32px' }}>
        <div>
          <Text size="sm" subtle style={{ marginBottom: '6px', fontFamily: 'var(--mero-typography-font-mono)' }}>{submission.trackingId}</Text>
          <Heading level={3}>{submission.title}</Heading>
          <Text size="sm" subtle style={{ marginTop: '8px' }}>{CATEGORY_LABELS[submission.category]} · Submitted {new Date(submission.createdAt).toLocaleDateString()}</Text>
        </div>
      </div>

      <Card style={{ marginBottom: '24px' }}>
        <Text size="sm" subtle weight="medium" style={{ marginBottom: '10px' }}>Description</Text>
        <Text style={{ lineHeight: 1.7 }}>{submission.description}</Text>
        {submission.contactEmail && (
          <Text size="sm" subtle style={{ marginTop: '14px' }}>
            Contact: <a href={`mailto:${submission.contactEmail}`}>{submission.contactEmail}</a>
          </Text>
        )}
      </Card>

      <Stack gap="20px">
        {error && <Alert>{error}</Alert>}
        {saveSuccess && <Alert variant="success">Changes saved successfully.</Alert>}

        <Select
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={e => setStatus(e.target.value)}
        />

        <Textarea
          label="Public response"
          hint="Visible to citizen"
          value={publicResponse}
          onChange={e => setPublicResponse(e.target.value)}
          placeholder="Write a response that the citizen will see on the tracking page…"
        />

        <Textarea
          label="Internal notes"
          hint="Not visible to citizen"
          value={internalNotes}
          onChange={e => setInternalNotes(e.target.value)}
          placeholder="Add internal notes for your team…"
        />

        <Button onClick={handleSave} loading={saving} style={{ alignSelf: 'flex-start', minWidth: '120px' }}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </Stack>
    </main>
  );
}
