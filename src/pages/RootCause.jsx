import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import api from '../api/client';
import { pct, rupiah, StatusPill, LoadingState, PeriodPicker, PageHeader } from '../components/ui';
import toast from 'react-hot-toast';

const REASONS = [
  'Over portion', 'Gramasi tidak sesuai', 'Waste', 'Produk rusak', 'Salah input',
  'Complimentary', 'Staff meal', 'Pemakaian internal', 'Transfer',
  'Stock opname error', 'Recipe tidak sesuai aktual', 'Potensi kehilangan', 'Penyebab lain',
];

export default function RootCause() {
  const [period, setPeriod] = useState({ from: '2026-08-01', to: '2026-08-31' });
  const [varData, setVarData] = useState([]);
  const [opnames, setOpnames] = useState({});
  const [forms, setForms] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});

  useEffect(() => { fetchData(); }, [period]);

  async function fetchData() {
    setLoading(true);
    try {
      const [v, o] = await Promise.all([
        api.get('/reports/variance/ingredients', { params: { from: period.from, to: period.to } }),
        api.get('/opnames', { params: { from: period.from, to: period.to } }),
      ]);
      setVarData(v.data.filter(iv => iv.status && iv.status !== 'NORMAL'));
      // populate forms from existing opnames
      const existForms = {};
      Object.entries(o.data).forEach(([ingId, opn]) => {
        existForms[ingId] = { reason: opn.reason || '', approver: opn.approver || '', notes: opn.notes || '' };
      });
      setForms(existForms);
    } catch { toast.error('Gagal memuat data'); }
    finally { setLoading(false); }
  }

  function setField(ingId, field, value) {
    setForms(prev => ({ ...prev, [ingId]: { ...(prev[ingId] || {}), [field]: value } }));
  }

  async function saveOne(iv) {
    const ingId = iv.ingredient?.id;
    setSaving(s => ({ ...s, [ingId]: true }));
    try {
      await api.post('/opnames', {
        period_from: period.from,
        period_to: period.to,
        ingredient_id: ingId,
        reason: forms[ingId]?.reason,
        approver: forms[ingId]?.approver,
        notes: forms[ingId]?.notes,
      });
      toast.success(`Root cause ${iv.ingredient?.name} disimpan`);
    } catch { toast.error('Gagal menyimpan'); }
    finally { setSaving(s => ({ ...s, [ingId]: false })); }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="fade-in">
      <div className="flex-between mb-6">
        <PageHeader
          title="Root Cause & Approval"
          subtitle="Bahan dengan status Waspada/Tidak Wajar wajib diberi alasan sebelum periode ditutup."
        />
        <PeriodPicker from={period.from} to={period.to} onChange={setPeriod} />
      </div>

      {varData.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
          <div style={{ fontWeight: 600, color: 'var(--ok)', fontSize: 15 }}>
            Semua bahan dalam batas normal pada periode ini.
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 6 }}>
            Tidak ada bahan dengan variance di luar toleransi.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {varData.map(iv => {
            const ingId = iv.ingredient?.id;
            const form = forms[ingId] || {};
            return (
              <div key={ingId} className="card">
                <div className="flex-between mb-4">
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{iv.ingredient?.name}</span>
                    <span className="mono" style={{ color: 'var(--text-secondary)', fontSize: 12, marginLeft: 10 }}>
                      · {pct(iv.variance_pct)} · {rupiah(iv.variance_value)}
                    </span>
                  </div>
                  <StatusPill status={iv.status} />
                </div>

                {/* Summary bar */}
                <div style={{
                  background: iv.status === 'TIDAK WAJAR' ? 'var(--danger-bg)' : 'var(--warn-bg)',
                  border: `1px solid ${iv.status === 'TIDAK WAJAR' ? 'var(--danger-border)' : 'var(--warn-border)'}`,
                  borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12,
                  color: iv.status === 'TIDAK WAJAR' ? 'var(--danger)' : 'var(--warn)'
                }}>
                  Variance {pct(iv.variance_pct)} ({rupiah(iv.variance_value)}) melebihi toleransi {iv.ingredient?.tolerance}%.
                  Pemakaian teoritis: <strong>{iv.pemakaian_teoritis?.toFixed(0)} {iv.ingredient?.unit_pakai}</strong>, aktual: <strong>{iv.pemakaian_aktual?.toFixed(0) ?? '—'}</strong>.
                </div>

                <div className="grid-2 gap-3" style={{ marginBottom: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Penyebab</label>
                    <select className="form-control" value={form.reason || ''}
                      onChange={e => setField(ingId, 'reason', e.target.value)}>
                      <option value="">— pilih —</option>
                      {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Approval</label>
                    <select className="form-control" value={form.approver || ''}
                      onChange={e => setField(ingId, 'approver', e.target.value)}>
                      <option value="">— pilih —</option>
                      <option value="Supervisor">Supervisor</option>
                      <option value="Manager">Manager</option>
                      <option value="Owner">Owner</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Catatan tambahan</label>
                  <textarea className="form-control" rows={2} value={form.notes || ''}
                    onChange={e => setField(ingId, 'notes', e.target.value)}
                    placeholder="Opsional — jelaskan kondisi lebih detail..." />
                </div>

                <div style={{ textAlign: 'right' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => saveOne(iv)} disabled={saving[ingId]}>
                    <Save size={12} /> {saving[ingId] ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
