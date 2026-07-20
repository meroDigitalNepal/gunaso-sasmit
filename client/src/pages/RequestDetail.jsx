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

// Category is assigned by staff during triage — citizens never pick it.
// The empty option lets staff leave a submission uncategorized.
const CATEGORY_OPTIONS = [
  { value: '', label: 'Uncategorized' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'health', label: 'Health' },
  { value: 'education', label: 'Education' },
  { value: 'security', label: 'Security' },
  { value: 'other', label: 'Other' },
];

export default function RequestDetail() {
  const { id } = useParams();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [publicResponse, setPublicResponse] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [downloadError, setDownloadError] = useState(null);
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState(null);

  useEffect(() => {
    fetchSubmission();
  }, [id]);

  // Images and PDFs can be previewed inline with no extra infrastructure —
  // just render the blob directly. DOC/DOCX has no good inline preview
  // option without either a public URL or a heavy third-party viewer, so
  // those stay download-only.
  useEffect(() => {
    const isPreviewable = submission?.attachmentContentType?.startsWith('image/')
      || submission?.attachmentContentType === 'application/pdf';
    if (!isPreviewable) {
      setAttachmentPreviewUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl;
    api.getAttachmentBlob(id).then((blob) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setAttachmentPreviewUrl(objectUrl);
    }).catch(() => {
      // Preview is best-effort — the download button below still works.
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, submission?.attachmentContentType]);

  async function fetchSubmission() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSubmission(id);
      setSubmission(data);
      setStatus(data.status);
      setCategory(data.category || '');
      setPublicResponse(data.publicResponse || '');
      setInternalNotes(data.internalNotes || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadAttachment() {
    setDownloadError(null);
    try {
      const blob = await api.getAttachmentBlob(id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = submission.attachmentFileName || 'attachment';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err.message);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveSuccess(false);
    setError(null);
    try {
      const updated = await api.updateSubmission(id, { status, category, publicResponse, internalNotes });
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
      <Button as={Link} to="/control-room" variant="secondary">← Back to control room</Button>
    </main>
  );
  if (!submission) return null;

  return (
    <main className="page" style={{ paddingTop: '48px', paddingBottom: '80px' }}>
      <div style={{ maxWidth: '720px' }}>
      <Link to="/control-room" style={{ fontSize: 'var(--mero-typography-size-sm)', color: 'var(--mero-colors-text-subtle)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '28px' }}>
        ← Control Room
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '32px' }}>
        <div>
          <Text size="sm" subtle style={{ marginBottom: '6px', fontFamily: 'var(--mero-typography-font-mono)' }}>{submission.trackingId}</Text>
          <Heading level={3}>{submission.title}</Heading>
          <Text size="sm" subtle style={{ marginTop: '8px' }}>Submitted {new Date(submission.createdAt).toLocaleDateString()}</Text>
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
        {submission.contactPhone && (
          <Text size="sm" subtle style={{ marginTop: submission.contactEmail ? '4px' : '14px' }}>
            Phone: <a href={`tel:${submission.contactPhone}`}>{submission.contactPhone}</a>
          </Text>
        )}
        {submission.attachmentFileName && (
          <div style={{ marginTop: '14px' }}>
            {attachmentPreviewUrl && submission.attachmentContentType.startsWith('image/') && (
              <img
                src={attachmentPreviewUrl}
                alt={submission.attachmentFileName}
                style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: 'var(--mero-radii-md)', display: 'block', marginBottom: '10px' }}
              />
            )}
            {attachmentPreviewUrl && submission.attachmentContentType === 'application/pdf' && (
              <iframe
                src={attachmentPreviewUrl}
                title={submission.attachmentFileName}
                style={{ width: '100%', height: '500px', border: '1px solid var(--mero-colors-border)', borderRadius: 'var(--mero-radii-md)', marginBottom: '10px' }}
              />
            )}
            <Button variant="secondary" onClick={handleDownloadAttachment}>
              Download attachment ({submission.attachmentFileName})
            </Button>
            {downloadError && <Alert style={{ marginTop: '8px' }}>{downloadError}</Alert>}
          </div>
        )}
      </Card>

      <Stack gap="20px">
        {error && <Alert>{error}</Alert>}
        {saveSuccess && <Alert variant="success">Changes saved successfully.</Alert>}

        <Select
          label="Category"
          hint="Assigned by your team — not chosen by the citizen"
          options={CATEGORY_OPTIONS}
          value={category}
          onChange={e => setCategory(e.target.value)}
        />

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
      </div>
    </main>
  );
}
