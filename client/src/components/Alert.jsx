/*
 * Lightweight alert banner. @mero-nepal/ui has no Alert primitive, so this
 * composes the library's design tokens (--mero-*) to stay on-theme.
 */
const VARIANTS = {
  error: {
    background: 'var(--mero-colors-danger-subtle)',
    color: 'var(--mero-colors-danger)',
    border: '1px solid var(--mero-colors-danger)',
  },
  success: {
    background: 'var(--mero-colors-success-subtle)',
    color: 'var(--mero-colors-success)',
    border: '1px solid var(--mero-colors-success)',
  },
};

export default function Alert({ variant = 'error', children, style }) {
  return (
    <div
      role="alert"
      style={{
        padding: '14px 18px',
        borderRadius: 'var(--mero-radii-md)',
        fontSize: 'var(--mero-typography-size-sm)',
        ...VARIANTS[variant],
        ...style,
      }}
    >
      {children}
    </div>
  );
}
