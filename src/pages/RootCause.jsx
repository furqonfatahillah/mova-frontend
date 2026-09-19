import { useState, useEffect, useMemo } from 'react';
import {
  Save, Store, AlertTriangle, CheckCircle2, ShieldAlert,
  RefreshCw, FileText, Check, Search, Filter, AlertOctagon, HelpCircle
} from 'lucide-react';
import api from '../api/client';
import {
  num, pct, rupiah, StatusPill, LoadingState,
  PeriodPicker, PageHeader, MiniCard
} from '../components/ui';
import { getTodayStr, getMonthStartStr, getMonthEndStr } from '../utils/date';
import { useOutlet } from '../context/OutletContext';
import toast from 'react-hot-toast';

const REASONS = [
  'Over portion (Porsi berlebih)',
  'Gramasi tidak sesuai SOP',
  'Waste / Bahan basi / rusak',
  'Salah input kasir / transaksi',
  'Complimentary / Tester tamu',
  'Staff meal / Konsumsi karyawan',
  'Pemakaian internal / Quality Control',
  'Transfer antar cabang',
  'Stock opname error / Salah hitung fisik',
  'Recipe / Komposisi tidak sesuai aktual',
  'Potensi kehilangan / Selisih fisik',
  'Penyebab lain',
];

const APPROVER_OPTIONS = [
  { value: 'Supervisor', label: 'Supervisor' },
  { value: 'Manager Outlet', label: 'Manager Outlet' },
  { value: 'Owner Bisnis', label: 'Owner Bisnis' },
];

export default function RootCause() {
  const {
    activeOutletId,
    outlets,
    canSwitchOutlet,
    currentUser,
    userOutletName,
  } = useOutlet();

  const [selectedOutletId, setSelectedOutletId] = useState(() => {
    if (!canSwitchOutlet) {
      return String(currentUser?.outlet_id || activeOutletId || '');
    }
    if (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all') {
      return String(activeOutletId);
    }
    return '';
  });

  const targetOutlet = useMemo(() => {
    if (!canSwitchOutlet) {
      return Number(currentUser?.outlet_id || activeOutletId || outlets?.[0]?.id || 1);
    }
    if (selectedOutletId && selectedOutletId !== 'ALL' && selectedOutletId !== 'all') {
      return Number(selectedOutletId);
    }
    if (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all') {
      return Number(activeOutletId);
    }
    return outlets?.[0]?.id || 1;
  }, [selectedOutletId, activeOutletId, outlets, canSwitchOutlet, currentUser?.outlet_id]);

  const [period, setPeriod] = useState(() => ({
    from: getMonthStartStr(),
    to: getTodayStr(),
  }));

  const [varData, setVarData] = useState([]);
  const [opnames, setOpnames] = useState({});
  const [forms, setForms] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [savedStatus, setSavedStatus] = useState({});

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'WASPADA' | 'TIDAK WAJAR'
  const [actionFilter, setActionFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'DONE'

  useEffect(() => {
    fetchData();
  }, [period, targetOutlet]);

  async function fetchData() {
    setLoading(true);
    try {
      const [vRes, oRes] = await Promise.all([
        api.get('/reports/variance/ingredients', {
          params: { from: period.from, to: period.to, outlet_id: targetOutlet },
        }),
        api.get('/opnames', {
          params: { from: period.from, to: period.to, outlet_id: targetOutlet },
        }),
      ]);

      const rawVar = Array.isArray(vRes.data) ? vRes.data : [];
      // Filter only items that have abnormal status (WASPADA or TIDAK WAJAR)
      const anomalyItems = rawVar.filter(iv => iv.status && iv.status !== 'NORMAL');
      setVarData(anomalyItems);

      const opnData = (oRes.data && typeof oRes.data === 'object' && !Array.isArray(oRes.data))
        ? oRes.data
        : (Array.isArray(oRes.data)
            ? Object.fromEntries(oRes.data.map(item => [item.ingredient_id, item]))
            : {});
      setOpnames(opnData);

      // Populate forms from existing opnames
      const existForms = {};
      const initialSaved = {};
      Object.entries(opnData).forEach(([ingId, opn]) => {
        if (opn) {
          existForms[ingId] = {
            reason: opn.reason || '',
            approver: opn.approver || '',
            notes: opn.notes || '',
          };
          if (opn.reason && opn.approver) {
            initialSaved[ingId] = true;
          }
        }
      });
      setForms(existForms);
      setSavedStatus(initialSaved);
    } catch (err) {
      console.error('Error fetching root cause data:', err);
      toast.error('Gagal memuat data root cause');
    } finally {
      setLoading(false);
    }
  }

  function setField(ingId, field, value) {
    setForms(prev => ({
      ...prev,
      [ingId]: { ...(prev[ingId] || {}), [field]: value },
    }));
    // mark unsaved if changed
    setSavedStatus(prev => ({ ...prev, [ingId]: false }));
  }

  async function saveOne(iv) {
    const ingId = iv.ingredient?.id || iv.ingredient_id;
    if (!ingId) {
      toast.error('ID Bahan tidak valid');
      return;
    }

    const currentForm = forms[ingId] || {};
    if (!currentForm.reason) {
      toast.error(`Pilih penyebab (Root Cause) untuk ${iv.ingredient?.name || 'bahan ini'}`);
      return;
    }
    if (!currentForm.approver) {
      toast.error(`Pilih level approval untuk ${iv.ingredient?.name || 'bahan ini'}`);
      return;
    }

    setSaving(s => ({ ...s, [ingId]: true }));
    try {
      await api.post('/opnames', {
        period_from: period.from,
        period_to: period.to,
        ingredient_id: ingId,
        outlet_id: targetOutlet,
        opname_date: getTodayStr(),
        reason: currentForm.reason,
        approver: currentForm.approver,
        notes: currentForm.notes || '',
      });

      setSavedStatus(prev => ({ ...prev, [ingId]: true }));
      toast.success(`Root cause & approval ${iv.ingredient?.name || ''} berhasil disimpan!`);
    } catch (err) {
      console.error('Error saving root cause:', err);
      const msg = err.response?.data?.message || 'Gagal menyimpan root cause';
      toast.error(msg);
    } finally {
      setSaving(s => ({ ...s, [ingId]: false }));
    }
  }

  // Filtered dataset
  const filteredData = useMemo(() => {
    return varData.filter(iv => {
      const ingName = iv.ingredient?.name?.toLowerCase() || '';
      const ingCode = iv.ingredient?.sku?.toLowerCase() || '';
      const q = searchQuery.toLowerCase().trim();

      if (q && !ingName.includes(q) && !ingCode.includes(q)) {
        return false;
      }

      if (statusFilter !== 'ALL' && iv.status !== statusFilter) {
        return false;
      }

      const ingId = iv.ingredient?.id || iv.ingredient_id;
      const hasReason = Boolean(forms[ingId]?.reason && forms[ingId]?.approver);

      if (actionFilter === 'DONE' && !hasReason) return false;
      if (actionFilter === 'PENDING' && hasReason) return false;

      return true;
    });
  }, [varData, searchQuery, statusFilter, actionFilter, forms]);

  // Statistics
  const stats = useMemo(() => {
    let totalAnomali = varData.length;
    let countTidakWajar = 0;
    let countWaspada = 0;
    let countDone = 0;
    let totalLossVal = 0;

    varData.forEach(iv => {
      if (iv.status === 'TIDAK WAJAR') countTidakWajar++;
      if (iv.status === 'WASPADA') countWaspada++;
      const ingId = iv.ingredient?.id || iv.ingredient_id;
      if (forms[ingId]?.reason && forms[ingId]?.approver) {
        countDone++;
      }
      totalLossVal += Math.abs(Number(iv.variance_value || 0));
    });

    const countPending = totalAnomali - countDone;

    return {
      totalAnomali,
      countTidakWajar,
      countWaspada,
      countDone,
      countPending,
      totalLossVal,
    };
  }, [varData, forms]);

  if (loading) return <LoadingState />;

  return (
    <div className="fade-in" style={{ paddingBottom: '40px' }}>
      {/* Header */}
      <div className="flex-between mb-6" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <PageHeader
          title="Root Cause & Approval Anomali"
          subtitle="Identifikasi penyebab selisih fisik bahan baku yang melewati batas toleransi dan rekam approval pimpinan."
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {canSwitchOutlet && outlets && outlets.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Store size={16} style={{ color: 'var(--primary)' }} />
              <select
                className="form-control"
                style={{ width: 'auto', minWidth: '180px', fontWeight: 600 }}
                value={selectedOutletId}
                onChange={e => setSelectedOutletId(e.target.value)}
              >
                {outlets.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          )}

          <PeriodPicker from={period.from} to={period.to} onChange={setPeriod} />

          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchData}
            title="Segarkan Data"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid-4 mb-6">
        <MiniCard
          label="Total Bahan Anomali"
          value={stats.totalAnomali}
          sub={`${stats.countTidakWajar} Tidak Wajar · ${stats.countWaspada} Waspada`}
          icon={<ShieldAlert size={20} color="var(--primary)" />}
        />
        <MiniCard
          label="Menunggu Alasan / Form"
          value={stats.countPending}
          sub={stats.countPending === 0 ? 'Semua telah diisi ✓' : 'Wajib diisi & diverifikasi'}
          icon={<AlertOctagon size={20} color={stats.countPending > 0 ? 'var(--danger)' : 'var(--ok)'} />}
        />
        <MiniCard
          label="Sudah Diberi Alasan"
          value={stats.countDone}
          sub={`${stats.totalAnomali > 0 ? Math.round((stats.countDone / stats.totalAnomali) * 100) : 100}% Terselesaikan`}
          icon={<CheckCircle2 size={20} color="var(--ok)" />}
        />
        <MiniCard
          label="Estimasi Nilai Selisih"
          value={rupiah(stats.totalLossVal)}
          sub="Total variansi di luar toleransi"
          icon={<AlertTriangle size={20} color="#f59e0b" />}
        />
      </div>

      {/* Filter & Search Bar */}
      <div className="card mb-5" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
            <Search size={16} style={{ color: 'var(--text-secondary)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Cari nama bahan atau SKU..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'transparent', padding: '4px 0', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Status:</span>
              <select
                className="form-control form-control-sm"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{ width: 'auto', fontSize: '12px' }}
              >
                <option value="ALL">Semua Status</option>
                <option value="TIDAK WAJAR">TIDAK WAJAR</option>
                <option value="WASPADA">WASPADA</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Progress:</span>
              <select
                className="form-control form-control-sm"
                value={actionFilter}
                onChange={e => setActionFilter(e.target.value)}
                style={{ width: 'auto', fontSize: '12px' }}
              >
                <option value="ALL">Semua Progress</option>
                <option value="PENDING">Belum Diisi</option>
                <option value="DONE">Sudah Selesai</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main List */}
      {varData.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '56px 24px', borderRadius: '16px' }}>
          <div style={{ fontSize: 42, marginBottom: 16 }}>🎉</div>
          <h3 style={{ fontWeight: 700, color: 'var(--ok)', fontSize: 18, marginBottom: 8 }}>
            Semua Bahan Baku Dalam Batas Normal
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, maxWidth: '480px', margin: '0 auto', lineHeight: 1.6 }}>
            Tidak ditemukan bahan baku dengan selisih fisik yang melebihi batas toleransi pada periode{' '}
            <strong>{period.from}</strong> s/d <strong>{period.to}</strong>. Tidak ada tindakan root cause yang diperlukan.
          </p>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <AlertCircle size={32} style={{ color: 'var(--text-secondary)', margin: '0 auto 12px' }} />
          <div style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: 14 }}>
            Tidak ada data yang sesuai dengan filter pencarian.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredData.map(iv => {
            const ingId = iv.ingredient?.id || iv.ingredient_id;
            const form = forms[ingId] || {};
            const isSaved = savedStatus[ingId] || (form.reason && form.approver && !saving[ingId]);
            const isCritical = iv.status === 'TIDAK WAJAR';
            const unitName = iv.ingredient?.unit_pakai || 'unit';
            const tolerancePct = iv.ingredient?.tolerance ?? 0;

            return (
              <div
                key={ingId}
                className="card"
                style={{
                  borderLeft: isCritical ? '4px solid #ef4444' : '4px solid #f59e0b',
                  transition: 'all 0.2s ease',
                  padding: '20px 24px'
                }}
              >
                {/* Card Header */}
                <div className="flex-between mb-4" style={{ flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: isCritical ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isCritical ? '#ef4444' : '#f59e0b',
                      flexShrink: 0
                    }}>
                      <ShieldAlert size={20} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, fontSize: 16, color: '#ffffff' }}>
                          {iv.ingredient?.name || `Bahan #${ingId}`}
                        </span>
                        {iv.ingredient?.sku && (
                          <span className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>
                            {iv.ingredient.sku}
                          </span>
                        )}
                      </div>
                      <div className="mono" style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
                        Variansi: <span style={{ color: isCritical ? '#f87171' : '#fbbf24', fontWeight: 700 }}>{pct(iv.variance_pct)}</span> · Nilai Selisih: <span style={{ color: '#ffffff', fontWeight: 600 }}>{rupiah(iv.variance_value)}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <StatusPill status={iv.status} />
                    {isSaved && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--ok)',
                        background: 'rgba(16, 185, 129, 0.12)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        padding: '4px 8px',
                        borderRadius: '6px'
                      }}>
                        <Check size={12} /> Tersimpan
                      </span>
                    )}
                  </div>
                </div>

                {/* Summary Highlight Box */}
                <div style={{
                  background: isCritical ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                  border: `1px solid ${isCritical ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
                  borderRadius: 10,
                  padding: '12px 16px',
                  marginBottom: 16,
                  fontSize: 12.5,
                  color: isCritical ? '#fca5a5' : '#fde68a',
                  lineHeight: 1.6
                }}>
                  Selisih <strong>{pct(iv.variance_pct)}</strong> ({rupiah(iv.variance_value)}) melebihi batas toleransi yang ditetapkan (<strong>{tolerancePct}%</strong>).
                  <div style={{ marginTop: '4px', color: 'rgba(255,255,255,0.85)' }}>
                    • Pemakaian Teoritis (Resep POS): <strong className="mono">{num(iv.pemakaian_teoritis, 2)} {unitName}</strong>
                    <br />
                    • Pemakaian Aktual (Opname Fisik): <strong className="mono">{iv.pemakaian_aktual != null ? num(iv.pemakaian_aktual, 2) : '—'} {unitName}</strong>
                    {iv.waste_qty > 0 && (
                      <span> · Waste Terdata: <strong className="mono" style={{ color: '#fb923c' }}>{num(iv.waste_qty, 2)} {unitName} ({rupiah(iv.waste_value)})</strong></span>
                    )}
                  </div>
                </div>

                {/* Form Controls */}
                <div className="grid-2 gap-3 mb-3">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                      Penyebab Utama (Root Cause) <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <select
                      className="form-control"
                      value={form.reason || ''}
                      onChange={e => setField(ingId, 'reason', e.target.value)}
                      style={{ fontSize: '13px' }}
                    >
                      <option value="">— Pilih Penyebab Selisih —</option>
                      {REASONS.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                      Level Approval / Penanggung Jawab <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <select
                      className="form-control"
                      value={form.approver || ''}
                      onChange={e => setField(ingId, 'approver', e.target.value)}
                      style={{ fontSize: '13px' }}
                    >
                      <option value="">— Pilih Penanggung Jawab —</option>
                      {APPROVER_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group mb-4">
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                    Catatan Detail & Tindakan Korektif (Opsional)
                  </label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={form.notes || ''}
                    onChange={e => setField(ingId, 'notes', e.target.value)}
                    placeholder="Contoh: Terjadi tumpahan minyak saat pergantian shift sore, staf telah ditegur dan SOP refill diperketat..."
                    style={{ fontSize: '12px', resize: 'vertical' }}
                  />
                </div>

                {/* Action footer */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => saveOne(iv)}
                    disabled={saving[ingId]}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: '110px', justifyContent: 'center' }}
                  >
                    <Save size={14} />
                    {saving[ingId] ? 'Menyimpan...' : (isSaved ? 'Perbarui Alasan' : 'Simpan Root Cause')}
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
