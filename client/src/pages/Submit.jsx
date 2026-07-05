import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Heading, Text, Button, Card, Input, Textarea, Stack } from '@mero-nepal/ui';
import Alert from '../components/Alert';
import { api } from '../api';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ACCEPTED_ATTACHMENT_TYPES = '.jpg,.jpeg,.png,.webp,.pdf,.doc,.docx';

export default function Submit() {
  const [form, setForm] = useState({ title: '', description: '', contactEmail: '', contactPhone: '' });
  const [attachment, setAttachment] = useState(null);
  const [attachmentError, setAttachmentError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const turnstileRef = useRef(null);

  // Loads the Turnstile script once and renders the widget into turnstileRef.
  // No-ops entirely if VITE_TURNSTILE_SITE_KEY isn't set, so local dev without
  // a Cloudflare key still works — mirrors the server's graceful degrade when
  // TURNSTILE_SECRET_KEY is unset.
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;

    function renderWidget() {
      if (turnstileRef.current && window.turnstile) {
        window.turnstile.render(turnstileRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token) => setTurnstileToken(token),
          'expired-callback': () => setTurnstileToken(null),
        });
      }
    }

    if (window.turnstile) {
      renderWidget();
      return;
    }

    let script = document.querySelector(`script[src="${TURNSTILE_SCRIPT_SRC}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
    script.addEventListener('load', renderWidget);
    return () => script.removeEventListener('load', renderWidget);
  }, []);

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  // Phone accepts digits only — strip anything else as the user types so the
  // stored value is always a bare number.
  function handlePhoneChange(e) {
    const digitsOnly = e.target.value.replace(/\D/g, '');
    setForm(f => ({ ...f, contactPhone: digitsOnly }));
  }

  // Client-side size check is UX only — the server enforces the real limit.
  function handleAttachmentChange(e) {
    const file = e.target.files[0] || null;
    if (file && file.size > MAX_ATTACHMENT_BYTES) {
      setAttachmentError('File must be 5MB or smaller.');
      setAttachment(null);
      e.target.value = '';
      return;
    }
    setAttachmentError(null);
    setAttachment(file);
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
      const submission = await api.createSubmission({ ...form, turnstileToken, attachment });
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
          <Heading level={3} style={{ marginBottom: '8px' }}>Gunaso submitted</Heading>
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
            <Button as={Link} to={`/track/${result.trackingId}`}>Track this Gunaso</Button>
            <Button variant="secondary" onClick={() => setResult(null)}>Submit another</Button>
          </Stack>
        </Card>
      </main>
    );
  }

  return (
    <main className="page" style={{ paddingTop: '64px', paddingBottom: '80px', maxWidth: '560px' }}>
      <Heading level={1} style={{ marginBottom: '8px' }}>Submit a Gunaso</Heading>
      <Text subtle style={{ marginBottom: '40px' }}>Your representative's team will review and respond to your submission.</Text>

      {error && <Alert style={{ marginBottom: '20px' }}>{error}</Alert>}

      <form onSubmit={handleSubmit}>
        <Stack gap="20px">
          <Input
            label="Title" name="title"
            placeholder="Brief summary of your Gunaso"
            value={form.title} onChange={handleChange} required
          />

          <Textarea
            label="Description" name="description"
            placeholder="Describe your Gunaso in detail"
            value={form.description} onChange={handleChange} required
          />

          <Input
            label="Email" name="contactEmail" type="email"
            placeholder="you@example.com"
            value={form.contactEmail} onChange={handleChange}
            hint="We'll only use this to follow up on your Gunaso."
          />

          <Input
            label="Phone" name="contactPhone" type="tel"
            inputMode="numeric" pattern="[0-9]*"
            placeholder="98XXXXXXXX"
            value={form.contactPhone} onChange={handlePhoneChange}
            hint="We'll only use this to follow up on your Gunaso."
          />

          <Input
            label="Attachment (optional)" name="attachment" type="file"
            accept={ACCEPTED_ATTACHMENT_TYPES}
            onChange={handleAttachmentChange}
            hint="JPG, PNG, WEBP, PDF, DOC, or DOCX — up to 5MB."
          />
          {attachmentError && <Alert>{attachmentError}</Alert>}

          {TURNSTILE_SITE_KEY && <div ref={turnstileRef} />}

          <Button
            type="submit"
            loading={loading}
            disabled={Boolean(TURNSTILE_SITE_KEY) && !turnstileToken}
            style={{ width: '100%' }}
          >
            {loading ? 'Submitting…' : 'Submit Gunaso'}
          </Button>
        </Stack>
      </form>
    </main>
  );
}
