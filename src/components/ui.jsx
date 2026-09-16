import DateRangePicker from './DateRangePicker';

export function rupiah(n) {
  const v = Math.round(n || 0);
  const neg = v < 0;
  const s = Math.abs(v).toLocaleString('id-ID');
  return (neg ? '-Rp' : 'Rp') + s;
}

export function num(n, d = 2) {
  if (n === undefined || n === null || isNaN(n)) return '0';
  return Number(n).toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: 0 });
}

export function pct(n, d = 1) {
  if (n === undefined || n === null || isNaN(n)) return '0%';
  const s = n > 0 ? '+' : '';
  return s + Number(n).toFixed(d) + '%';
}

export function statusClass(status) {
  if (status === 'NORMAL')      return 'ok';
  if (status === 'WASPADA')     return 'warn';
  if (status === 'TIDAK WAJAR') return 'danger';
  return 'muted';
}

export function StatusPill({ status }) {
  if (!status) return <span className="pill pill-muted mono">—</span>;
  const cls = statusClass(status);
  return <span className={`pill pill-${cls} mono`}>{status}</span>;
}

export function LoadingState() {
  return (
    <div className="loading-spinner">
      <div className="spinner" />
      Memuat data...
    </div>
  );
}

export function EmptyState({ title = 'Tidak ada data', desc }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {desc && <p style={{ fontSize: 13, marginTop: 6 }}>{desc}</p>}
    </div>
  );
}

export function PeriodPicker({ from, to, onChange, label = 'Periode', align = 'left', style = {} }) {
  return (
    <DateRangePicker
      from={from}
      to={to}
      onChange={onChange}
      label={label}
      align={align}
      style={style}
    />
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="page-header page-header-wrap mb-6">
      <div className="page-header-titles">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </div>
  );
}

export function MiniCard({ label, value, color }) {
  return (
    <div className="mini-card">
      <div className="mini-label">{label}</div>
      <div className="mini-value" style={{ color: color || 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

export function formatDateTime(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString).slice(0, 19).replace('T', ' ');
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return String(isoString);
  }
}

export function AuditInfo({ createdAt, createdBy, updatedAt, updatedBy, compact = false }) {
  const hasChanged = (updatedBy && updatedBy !== '-') || (updatedAt && createdAt && Math.abs(new Date(updatedAt).getTime() - new Date(createdAt).getTime()) > 2000);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}>
        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
          BUAT
        </span>
        <span>{formatDateTime(createdAt)}</span>
        {createdBy && <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{createdBy}</strong>}
      </div>
      {hasChanged && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-bright)' }}>
          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--accent-dim)', color: 'var(--accent-bright)' }}>
            UBAH
          </span>
          <span>{formatDateTime(updatedAt)}</span>
          {updatedBy && <strong style={{ color: 'var(--accent-bright)', fontWeight: 500 }}>{updatedBy}</strong>}
        </div>
      )}
    </div>
  );
}

export const SATUAN_BELI_OPTIONS = [
  'Kg',
  'gram',
  'Liter',
  'ml',
  'Pcs',
  'Pack',
  'Dus',
  'Botol',
  'Kaleng',
  'Ikat',
  'Porsi',
  'Butir',
  'Lembar',
  'Sachet',
];

export const SATUAN_PAKAI_OPTIONS = [
  'gram',
  'ml',
  'Pcs',
  'sdm',
  'sdt',
  'lembar',
  'porsi',
  'butir',
  'Kg',
  'Liter',
];

export const KATEGORI_BAHAN_OPTIONS = [
  'Protein',
  'Sayur',
  'Bumbu',
  'Kering',
  'Cair',
  'Dairy',
  'Minuman',
  'Packaging',
  'Umum',
];

export function getSuggestedConversion(unitBeli, unitPakai) {
  const ub = String(unitBeli || '').trim().toLowerCase();
  const up = String(unitPakai || '').trim().toLowerCase();
  if ((ub === 'kg' || ub === 'kilogram') && (up === 'gram' || up === 'gr' || up === 'g')) return 1000;
  if ((ub === 'liter' || ub === 'l') && (up === 'ml' || up === 'mililiter')) return 1000;
  if (ub === up) return 1;
  return null;
}

export function UnitSelect({ value, onChange, options = SATUAN_PAKAI_OPTIONS, style = {}, className = 'form-control' }) {
  const opts = options.includes(value) || !value ? options : [value, ...options];
  return (
    <select
      className={className}
      style={{
        padding: '5px 8px',
        fontSize: 12,
        minWidth: 80,
        cursor: 'pointer',
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        borderColor: 'var(--border-strong)',
        ...style,
      }}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
    >
      {opts.map(opt => (
        <option key={opt} value={opt} style={{ background: '#11162d', color: '#ffffff' }}>
          {opt}
        </option>
      ))}
    </select>
  );
}
