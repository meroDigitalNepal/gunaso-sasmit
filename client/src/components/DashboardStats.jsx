/*
 * Overview charts shown above the submissions table. @mero-nepal/ui ships no
 * chart primitives, so these are built from plain SVG/CSS composed with the
 * library's design tokens (--mero-*) to stay on the safa theme — no charting
 * dependency. Charts summarise the full submission set, independent of the
 * table's active filters.
 */

// Status colors mirror the Badge variants used in the table
// (new → primary, in_review → warning, resolved → success).
const STATUS_META = [
  { key: 'new', label: 'New', color: 'var(--mero-colors-primary)' },
  { key: 'in_review', label: 'In Review', color: 'var(--mero-colors-warning)' },
  { key: 'resolved', label: 'Resolved', color: 'var(--mero-colors-success)' },
];

const CATEGORY_META = [
  { key: 'infrastructure', label: 'Infrastructure' },
  { key: 'health', label: 'Health' },
  { key: 'education', label: 'Education' },
  { key: 'security', label: 'Security' },
  { key: 'other', label: 'Other' },
];

const panelStyle = {
  border: '1px solid var(--mero-colors-border)',
  borderRadius: 'var(--mero-radii-md)',
  background: 'var(--mero-colors-surface-raised)',
  padding: '20px',
};

const panelTitleStyle = {
  fontSize: 'var(--mero-typography-size-sm)',
  fontWeight: 'var(--mero-typography-weight-medium)',
  color: 'var(--mero-colors-text-subtle)',
  marginBottom: '18px',
};

// Donut built with a stroke-dasharray arc per segment on a single ring.
function Donut({ segments, total }) {
  const size = 168;
  const stroke = 24;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--mero-colors-border)"
          strokeWidth={stroke}
        />
        {total > 0 && segments.map(seg => {
          if (seg.value === 0) return null;
          const len = (seg.value / total) * c;
          const dash = (
            <circle
              key={seg.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return dash;
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '1.75rem', fontWeight: 'var(--mero-typography-weight-semibold)', color: 'var(--mero-colors-text)', lineHeight: 1 }}>
          {total}
        </div>
        <div style={{ fontSize: 'var(--mero-typography-size-xs)', color: 'var(--mero-colors-text-subtle)' }}>total</div>
      </div>
    </div>
  );
}

function Legend({ segments, total }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minWidth: '140px' }}>
      {segments.map(seg => (
        <div key={seg.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--mero-typography-size-sm)' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: seg.color, flexShrink: 0 }} />
          <span style={{ color: 'var(--mero-colors-text)' }}>{seg.label}</span>
          <span style={{ marginLeft: 'auto', color: 'var(--mero-colors-text-subtle)', fontFamily: 'var(--mero-typography-font-mono)' }}>
            {seg.value}
            {total > 0 && <span style={{ marginLeft: '6px' }}>{Math.round((seg.value / total) * 100)}%</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function CategoryBars({ bars, max }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {bars.map(bar => (
        <div key={bar.key}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: 'var(--mero-typography-size-sm)' }}>
            <span style={{ color: 'var(--mero-colors-text)' }}>{bar.label}</span>
            <span style={{ color: 'var(--mero-colors-text-subtle)', fontFamily: 'var(--mero-typography-font-mono)' }}>{bar.value}</span>
          </div>
          <div style={{ height: '8px', borderRadius: '4px', background: 'var(--mero-colors-border)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${max > 0 ? (bar.value / max) * 100 : 0}%`,
                background: 'var(--mero-colors-primary)',
                borderRadius: '4px',
                transition: 'width var(--mero-motion-duration-fast) var(--mero-motion-easing)',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardStats({ submissions }) {
  const statusSegments = STATUS_META.map(s => ({
    ...s,
    value: submissions.filter(sub => sub.status === s.key).length,
  }));

  const categoryBars = CATEGORY_META.map(c => ({
    ...c,
    value: submissions.filter(sub => sub.category === c.key).length,
  }));
  const uncategorized = submissions.filter(sub => !sub.category).length;
  if (uncategorized > 0) {
    categoryBars.push({ key: 'uncategorized', label: 'Uncategorized', value: uncategorized });
  }
  const maxCategory = Math.max(0, ...categoryBars.map(b => b.value));

  const total = submissions.length;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        <div style={panelStyle}>
          <div style={panelTitleStyle}>Status distribution</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            <Donut segments={statusSegments} total={total} />
            <Legend segments={statusSegments} total={total} />
          </div>
        </div>

        <div style={panelStyle}>
          <div style={panelTitleStyle}>Category distribution</div>
          <CategoryBars bars={categoryBars} max={maxCategory} />
        </div>
      </div>
    </section>
  );
}
