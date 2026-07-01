import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heading, Text, Button, Card, Input, Select, Textarea, Stack } from '@mero-nepal/ui';
import Alert from '../components/Alert';
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
        <Card style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>✓</div>
          <Heading level={3} style={{ marginBottom: '8px' }}>Request submitted</Heading>
          <Text subtle style={{ marginBottom: '24px' }}>Save your tracking ID to check on progress.</Text>
          <div style={{
            background: 'var(--mero-colors-surface)',
            border: '1px solid var(--mero-colors-border)',
            borderRadius: 'var(--mero-radii-md)',
            padding: '18px 24px',
            marginBottom: '24px',
          }}>
            <Text size="sm" subtle style={{ marginBottom: '4px' }}>Tracking ID</Text>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <Text
                as="span"
                size="xl"
                weight="bold"
                color="var(--mero-colors-primary)"
                style={{ letterSpacing: '1px' }}
              >
                {result.trackingId}
              </Text>
              <div style={{ position: 'relative', display: 'inline-flex' }}>
                {copied && (
                  <div style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 6px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--mero-colors-text)',
                    color: 'var(--mero-colors-surface)',
                    fontSize: 'var(--mero-typography-size-xs)',
                    fontWeight: 'var(--mero-typography-weight-medium)',
                    padding: '4px 8px',
                    borderRadius: 'var(--mero-radii-sm)',
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
                      borderColor: 'var(--mero-colors-text) transparent transparent transparent',
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
                    background: copied ? 'var(--mero-colors-success-subtle)' : 'var(--mero-colors-surface-raised)',
                    border: '1px solid var(--mero-colors-border)',
                    borderRadius: 'var(--mero-radii-sm)',
                    width: '32px',
                    height: '32px',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'background var(--mero-motion-duration-fast) var(--mero-motion-easing)',
                  }}
                >
                  {copied ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 8.5L6.5 12L13 5" stroke="var(--mero-colors-success)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="-1 -1 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="5.5" y="5.5" width="8" height="9" rx="1.5" stroke="var(--mero-colors-text-subtle)" strokeWidth="1.25"/>
                      <path d="M5.5 10H4a1.5 1.5 0 0 1-1.5-1.5v-7A1.5 1.5 0 0 1 4 0h7a1.5 1.5 0 0 1 1.5 1.5V3" stroke="var(--mero-colors-text-subtle)" strokeWidth="1.25" strokeLinecap="round"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
          <Stack direction="row" gap="12px" justify="center" wrap>
            <Button as={Link} to={`/track/${result.trackingId}`}>Track this request</Button>
            <Button variant="secondary" onClick={() => setResult(null)}>Submit another</Button>
          </Stack>
        </Card>
      </main>
    );
  }

  return (
    <main className="page" style={{ paddingTop: '64px', paddingBottom: '80px', maxWidth: '560px' }}>
      <Heading level={1} style={{ marginBottom: '8px' }}>Submit a request</Heading>
      <Text subtle style={{ marginBottom: '40px' }}>Your representative's team will review and respond to your submission.</Text>

      {error && <Alert style={{ marginBottom: '20px' }}>{error}</Alert>}

      <form onSubmit={handleSubmit}>
        <Stack gap="20px">
          <Input
            label="Title" name="title"
            placeholder="Brief summary of your request"
            value={form.title} onChange={handleChange} required
          />

          <Select
            label="Category" name="category"
            placeholder="Select a category"
            options={CATEGORIES}
            value={form.category} onChange={handleChange} required
          />

          <Textarea
            label="Description" name="description"
            placeholder="Describe your request in detail"
            value={form.description} onChange={handleChange} required
          />

          <Input
            label="Contact email" name="contactEmail" type="email"
            placeholder="you@example.com"
            value={form.contactEmail} onChange={handleChange}
            hint="We'll only use this to follow up on your request."
          />

          <Button type="submit" loading={loading} style={{ width: '100%' }}>
            {loading ? 'Submitting…' : 'Submit request'}
          </Button>
        </Stack>
      </form>
    </main>
  );
}
