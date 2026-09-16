import { useState, useEffect, useMemo } from 'react';
import {
  Save, Store, ClipboardCheck, History, Eye, Printer, X, Check,
  Calendar, Search, RefreshCw, AlertTriangle, FileText, ArrowRight,
  TrendingDown, TrendingUp, CheckCircle2, UserCheck
} from 'lucide-react';
import api from '../api/client';
import { num, pct, rupiah, StatusPill, LoadingState, PeriodPicker, PageHeader, AuditInfo, MiniCard } from '../components/ui';
import toast from 'react-hot-toast';
import { useOutlet } from '../context/OutletContext';
import { printElement } from '../utils/print';

export default function StockOpname() {
  const [activeTab, setActiveTab] = useState('INPUT'); // 'INPUT' | 'HISTORY'
  const { activeOutletId, activeOutlet, isOwnerBisnis, isSuperadminPlatform, outlets } = useOutlet();

  const [selectedOutletId, setSelectedOutletId] = useState(() => {
    if (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all') {
      return String(activeOutletId);
    }
    return '';
  });

  const targetOutlet = useMemo(() => {
    if (selectedOutletId && selectedOutletId !== 'ALL' && selectedOutletId !== 'all') {
      return Number(selectedOutletId);
    }
    if (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all') {
      return Number(activeOutletId);
    }
    return outlets?.[0]?.id || 1;
  }, [selectedOutletId, activeOutletId, outlets]);

  // --- TAB 1: INPUT OPNAME STATE ---
  const [period, setPeriod] = useState({ from: '2026-08-01', to: '2026-08-31' });
  const [varData, setVarData] = useState([]);
  const [actuals, setActuals] = useState({});
  const [reasons, setReasons] = useState({});
  const [opnameMap, setOpnameMap] = useState({});
  const [sessionForm, setSessionForm] = useState({
    opname_date: new Date().toISOString().slice(0, 10),
    approver: '',
    notes: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // --- TAB 2: RIWAYAT SESI OPNAME STATE ---
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyOutlet, setHistoryOutlet] = useState('ALL');

  // --- MODAL DETAIL SESI & BERITA ACARA STATE ---
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedSessionNo, setSelectedSessionNo] = useState(null);
  const [sessionDetail, setSessionDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Load input data when period, targetOutlet, historyOutlet, or activeTab changes
  useEffect(() => {
    if (activeTab === 'INPUT') {
      fetchInputData();
    } else if (activeTab === 'HISTORY') {
      fetchSessions();
    }
  }, [period, targetOutlet, historyOutlet, activeTab]);

  async function fetchInputData() {
    setLoading(true);
    try {
      const params = { from: period.from, to: period.to, outlet_id: targetOutlet };
      const [varRes, opnRes] = await Promise.all([
        api.get('/reports/variance/ingredients', { params }),
        api.get('/opnames', { params }),
      ]);
      setVarData(varRes.data);
      setOpnameMap(opnRes.data || {});

      // Populate actuals & reasons from existing saved opname records
      const acts = {};
      const reas = {};
      let firstApprover = '';
      let firstNotes = '';
      let firstDate = '';

      Object.entries(opnRes.data || {}).forEach(([ingId, opn]) => {
        acts[ingId] = opn.actual_qty ?? '';
        reas[ingId] = opn.reason ?? '';
        if (opn.approver) firstApprover = opn.approver;
        if (opn.notes) firstNotes = opn.notes;
        if (opn.opname_date) firstDate = opn.opname_date;
      });

      setActuals(acts);
      setReasons(reas);
      setSessionForm({
        opname_date: firstDate || new Date().toISOString().slice(0, 10),
        approver: firstApprover,
        notes: firstNotes
      });
    } catch {
      toast.error('Gagal memuat data stock opname');
    } finally {
      setLoading(false);
    }
  }

  async function fetchSessions() {
    setSessionsLoading(true);
    try {
      const params = {};
      if (historyOutlet !== 'ALL') {
        params.outlet_id = historyOutlet;
      } else if (!isOwnerBisnis && !isSuperadminPlatform && activeOutletId) {
        params.outlet_id = activeOutletId;
      }
      const { data } = await api.get('/opnames/history', { params });
      setSessions(data);
    } catch {
      toast.error('Gagal memuat riwayat sesi opname');
    } finally {
      setSessionsLoading(false);
    }
  }

  async function handleSave(actionType = 'DRAFT') {
    const todayStr = new Date().toISOString().slice(0, 10);
    if (sessionForm.opname_date < todayStr) {
      toast.error('Tanggal pelaksanaan opname tidak boleh di-inputkan tanggal mundur (sebelum hari ini)!');
      return;
    }

    const items = Object.entries(actuals)
      .filter(([, v]) => v !== '' && v !== undefined)
      .map(([ingId, qty]) => ({
        ingredient_id: Number(ingId),
        actual_qty: Number(qty),
        reason: reasons[ingId] || null,
        approver: sessionForm.approver || null,
        notes: sessionForm.notes || null,
      }));

    if (items.length === 0) {
      toast.error('Isi minimal satu hasil hitung fisik bahan baku!');
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.post('/opnames/bulk', {
        period_from: period.from,
        period_to: period.to,
        outlet_id: targetOutlet,
        opname_date: sessionForm.opname_date,
        approver: sessionForm.approver || null,
        notes: sessionForm.notes || null,
        action: actionType, // 'DRAFT' or 'RELEASE'
        items,
      });

      toast.success(data.message || `Sesi Opname ${data.opname_no || ''} berhasil disimpan!`);
      fetchInputData();

      if (data.opname_no) {
        openSessionDetail(data.opname_no);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan hasil stock opname');
    } finally {
      setSaving(false);
    }
  }

  async function handleReleaseSession(opnameNo) {
    if (!window.confirm(`Apakah Anda yakin ingin merilis (Release) & menyetujui Sesi Opname "${opnameNo}"?\nDokumen akan dikunci.`)) {
      return;
    }
    try {
      const { data } = await api.post(`/opnames/sessions/${opnameNo}/release`, {
        approver: sessionForm.approver || undefined,
        notes: sessionForm.notes || undefined,
      });
      toast.success(data.message || `Sesi Opname ${opnameNo} berhasil di-release & disetujui!`);
      openSessionDetail(opnameNo);
      if (activeTab === 'HISTORY') fetchSessions();
      else fetchInputData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal merilis sesi opname');
    }
  }

  async function openSessionDetail(opnameNo) {
    setSelectedSessionNo(opnameNo);
    setDetailModalOpen(true);
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/opnames/sessions/${opnameNo}`);
      setSessionDetail(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memuat detail sesi opname');
      setDetailModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  function printBeritaAcara() {
    printElement('printable-berita-acara', `Berita Acara Opname - ${selectedSessionNo || ''}`);
  }

  // Live variance preview helper for Tab 1
  function getLiveVariance(iv) {
    const ingId = iv.ingredient?.id;
    const actualQty = actuals[ingId] !== '' && actuals[ingId] !== undefined ? Number(actuals[ingId]) : null;
    if (actualQty === null) return { ...iv };
    const wasteQty = Number(iv.waste_qty ?? iv.waste ?? 0);
    const pemakaianAktual = iv.stok_awal_periode + iv.pembelian - actualQty;
    const varianceGross = pemakaianAktual - iv.pemakaian_teoritis;
    const varianceQty = varianceGross - wasteQty;
    const variancePct = iv.pemakaian_teoritis > 0 ? (varianceQty / iv.pemakaian_teoritis) * 100 : null;
    const tol = iv.ingredient?.tolerance || 5;
    let status = null;
    if (variancePct !== null) {
      const abs = Math.abs(variancePct);
      status = abs <= tol ? 'NORMAL' : abs <= tol * 2 ? 'WASPADA' : 'TIDAK WAJAR';
    }
    return {
      ...iv,
      stok_akhir_aktual: actualQty,
      pemakaian_aktual: pemakaianAktual,
      variance_gross_qty: varianceGross,
      variance_qty: varianceQty,
      variance_pct: variancePct,
      status
    };
  }

  // Filtered sessions for Tab 2
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      if (historyOutlet !== 'ALL' && String(s.outlet_id) !== String(historyOutlet)) return false;
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const matchNo = (s.opname_no || '').toLowerCase().includes(q);
        const matchPic = (s.created_by_name || '').toLowerCase().includes(q);
        const matchApp = (s.approver || '').toLowerCase().includes(q);
        const matchOut = (s.outlet_name || '').toLowerCase().includes(q);
        if (!matchNo && !matchPic && !matchApp && !matchOut) return false;
      }
      return true;
    });
  }, [sessions, historyOutlet, historySearch]);

  const totalSessionsCount = sessions.length;
  const totalItemsChecked = sessions.reduce((acc, s) => acc + (s.items_counted || 0), 0);
  const totalNetVarianceValue = sessions.reduce((acc, s) => acc + (s.net_variance_value || 0), 0);

  return (
    <div className="fade-in">
      <PageHeader
        title="Stock Opname & Rekonsiliasi Fisik"
        subtitle="Verifikasi stok fisik bahan baku, hitung selisih gramasi otomatis, dan arsipkan Berita Acara Opname per cabang."
      />

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid var(--border)', marginBottom: 20, paddingBottom: 8 }}>
        <button
          className={`btn ${activeTab === 'INPUT' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', fontSize: 13.5 }}
          onClick={() => setActiveTab('INPUT')}
        >
          <ClipboardCheck size={16} /> Input Hitung Fisik (Opname Aktif)
        </button>

        <button
          className={`btn ${activeTab === 'HISTORY' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', fontSize: 13.5 }}
          onClick={() => {
            setActiveTab('HISTORY');
            fetchSessions();
          }}
        >
          <History size={16} /> Riwayat Sesi Opname
          {sessions.length > 0 && (
            <span
              style={{
                fontSize: 11,
                padding: '1px 6px',
                borderRadius: 10,
                background: activeTab === 'HISTORY' ? 'rgba(255,255,255,0.2)' : 'var(--accent-dim)',
                color: activeTab === 'HISTORY' ? '#ffffff' : 'var(--accent-bright)'
              }}
            >
              {sessions.length} Sesi
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: INPUT HITUNG FISIK (OPNAME AKTIF)                                   */}
      {/* ========================================================================= */}
      {activeTab === 'INPUT' && (
        <div className="fade-in">
          {/* Top Period & Logistics Control */}
          <div className="card mb-4" style={{ padding: '16px 20px', background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.3) 0%, rgba(15, 23, 42, 0.6) 100%)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, alignItems: 'center' }}>
              <div>
                <label className="form-label" style={{ fontSize: 11.5 }}>Gudang / Cabang Pelaksana</label>
                {outlets && outlets.length > 0 ? (
                  <select
                    className="form-control"
                    style={{ fontSize: 13, fontWeight: 700, background: 'var(--card-bg)', color: '#ffffff', cursor: 'pointer' }}
                    value={targetOutlet}
                    onChange={e => setSelectedOutletId(e.target.value)}
                  >
                    {outlets.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.is_main ? '🏢 ' : '📍 '} {o.name} ({o.code})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13.5, color: '#ffffff' }}>
                    <Store size={15} color="var(--accent-bright)" />
                    <span>{activeOutlet?.name || 'Gudang Utama (Pusat)'}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 11.5 }}>Periode Buku yang Diperiksa</label>
                <PeriodPicker from={period.from} to={period.to} onChange={setPeriod} />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 11.5 }}>Tanggal Pelaksanaan Opname</label>
                <input
                  type="date"
                  className="form-control mono"
                  style={{ fontSize: 12.5 }}
                  min={new Date().toISOString().slice(0, 10)}
                  value={sessionForm.opname_date}
                  onChange={e => setSessionForm(p => ({ ...p, opname_date: e.target.value }))}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 11.5 }}>Petugas Approver / Saksi Fisik</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Nama Store Manager / Saksi"
                  style={{ fontSize: 12.5 }}
                  value={sessionForm.approver}
                  onChange={e => setSessionForm(p => ({ ...p, approver: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Table Input Hitung Fisik */}
          <div className="card mb-4">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  Formulir Hitung Fisik Bahan Baku — {activeOutlet?.name || 'Cabang'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Ketikkan angka timbangan fisik pada kolom <strong>Stok Akhir Fisik</strong>. Inputan pegawai akan berstatus <strong>DRAFT</strong> dan di-release oleh Owner.
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {(isOwnerBisnis || isSuperadminPlatform) ? (
                  <>
                    <button className="btn btn-secondary" onClick={() => handleSave('DRAFT')} disabled={saving}>
                      <Save size={14} /> {saving ? 'Menyimpan...' : 'Simpan Draft'}
                    </button>
                    <button className="btn btn-primary" onClick={() => handleSave('RELEASE')} disabled={saving} style={{ background: '#10b981', borderColor: '#10b981', color: '#ffffff', fontWeight: 700 }}>
                      <CheckCircle2 size={14} /> {saving ? 'Menyimpan...' : 'Release & Setujui Opname'}
                    </button>
                  </>
                ) : (
                  <button className="btn btn-primary" onClick={() => handleSave('DRAFT')} disabled={saving}>
                    <Save size={14} /> {saving ? 'Menyimpan...' : 'Simpan Draft Opname (Menunggu Release Owner)'}
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <LoadingState />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ minWidth: 150 }}>Nama Bahan Baku</th>
                      <th className="right">Stok Awal</th>
                      <th className="right">Pembelian (+)</th>
                      <th className="right">Pemakaian POS (-)</th>
                      <th className="right" style={{ color: '#fb923c' }}>Waste (-)</th>
                      <th className="right" style={{ color: 'var(--accent-bright)' }}>Sisa Teoritis</th>
                      <th className="right" style={{ width: 130 }}>Stok Akhir Fisik</th>
                      <th className="right" style={{ color: '#fb7185' }}>Selisih Bersih (Net)</th>
                      <th className="center">Status</th>
                      <th style={{ minWidth: 160 }}>Catatan Alasan Selisih</th>
                      <th style={{ minWidth: 140 }}>Audit Pemeriksa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {varData.map(ivRaw => {
                      const iv = getLiveVariance(ivRaw);
                      const ingId = iv.ingredient?.id;
                      const opn = opnameMap[ingId];

                      return (
                        <tr key={ingId}>
                          <td>
                            <div style={{ fontWeight: 600, color: '#ffffff' }}>{iv.ingredient?.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{iv.ingredient?.code} · {iv.ingredient?.category}</div>
                          </td>
                          <td className="mono right">{num(iv.stok_awal_periode)} {iv.ingredient?.unit_pakai}</td>
                          <td className="mono right">{num(iv.pembelian)}</td>
                          <td className="mono right">{num(iv.pemakaian_teoritis)}</td>
                          <td className="mono right" style={{ color: '#fb923c' }}>{num(iv.waste)}</td>
                          <td className="mono right" style={{ fontWeight: 700, color: 'var(--accent-bright)' }}>
                            {num(iv.stok_akhir_teoritis)}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              step="any"
                              className="form-control mono right"
                              style={{ width: 110, padding: '5px 8px', fontSize: 12.5, fontWeight: 700, borderColor: 'var(--accent)' }}
                              placeholder="Input fisik..."
                              value={actuals[ingId] ?? ''}
                              onChange={e => setActuals(prev => ({ ...prev, [ingId]: e.target.value }))}
                            />
                          </td>
                          <td className="mono right" style={{
                            fontWeight: 700,
                            color: iv.variance_qty > 0 ? 'var(--ok)' : iv.variance_qty < 0 ? 'var(--danger)' : 'var(--text-muted)'
                          }}>
                            {iv.variance_qty !== null
                              ? `${iv.variance_qty > 0 ? '+' : ''}${num(iv.variance_qty)} ${iv.ingredient?.unit_pakai} (${pct(iv.variance_pct)})`
                              : '—'}
                          </td>
                          <td className="center">
                            <StatusPill status={iv.status} />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="form-control"
                              style={{ padding: '4px 8px', fontSize: 11.5 }}
                              placeholder="Alasan selisih..."
                              value={reasons[ingId] ?? ''}
                              onChange={e => setReasons(p => ({ ...p, [ingId]: e.target.value }))}
                            />
                          </td>
                          <td>
                            {opn ? (
                              <AuditInfo
                                createdAt={opn.created_at}
                                createdBy={opn.created_by_name || opn.user?.name}
                                updatedAt={opn.updated_at}
                                updatedBy={opn.updated_by_name}
                              />
                            ) : (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Belum disimpan</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 650 }}>
              💡 <strong>Rumus Rekonsiliasi:</strong> Pemakaian Fisik Lapangan = Stok Awal + Pembelian − Stok Akhir Fisik. Selisih Bersih (Net Variance) = Pemakaian Fisik − Pemakaian Teoritis POS − Waste Tercatat.
            </div>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              <Save size={14} /> {saving ? 'Menyimpan...' : 'Simpan & Terbitkan Berita Acara'}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RIWAYAT SESI OPNAME (ARSIP BERITA ACARA)                            */}
      {/* ========================================================================= */}
      {activeTab === 'HISTORY' && (
        <div className="fade-in">
          {/* Summary KPI Cards */}
          <div className="stat-cards mb-5">
            <div className="stat-card accent">
              <div className="stat-label">Total Sesi Opname Terarsip</div>
              <div className="stat-value accent">
                {totalSessionsCount} <span style={{ fontSize: 14, fontWeight: 500 }}>Dokumen</span>
              </div>
              <div className="stat-sub">Arsip berita acara hitung fisik</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Total Bahan Terverifikasi</div>
              <div className="stat-value">
                {totalItemsChecked} <span style={{ fontSize: 14, fontWeight: 500 }}>Item</span>
              </div>
              <div className="stat-sub">Bahan yang telah dihitung fisik</div>
            </div>

            <div className="stat-card ok">
              <div className="stat-label">Total Net Variance Seluruh Sesi</div>
              <div className="stat-value ok">
                {rupiah(totalNetVarianceValue)}
              </div>
              <div className="stat-sub">Akumulasi selisih nilai rupiah</div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="card mb-4" style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Filter Gudang:
                </span>
                <select
                  className="form-control"
                  style={{ fontSize: 12.5, minWidth: 200 }}
                  value={historyOutlet}
                  onChange={e => setHistoryOutlet(e.target.value)}
                >
                  <option value="ALL">Semua Cabang / Gudang</option>
                  {outlets.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.is_main ? '🏢 ' : '📍 '} {o.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ position: 'relative', width: 260 }}>
                  <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Cari No. Dokumen / PIC..."
                    style={{ paddingLeft: 30, paddingRight: 10, fontSize: 12, height: 32 }}
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                  />
                  {historySearch && (
                    <button
                      onClick={() => setHistorySearch('')}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <button className="btn btn-ghost btn-sm" onClick={fetchSessions} disabled={sessionsLoading} title="Refresh Riwayat">
                  <RefreshCw size={13} className={sessionsLoading ? 'spin' : ''} />
                </button>
              </div>
            </div>
          </div>

          {/* Sessions List Table */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Daftar Dokumen Sesi Stock Opname</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Klik pada baris atau tombol <strong>"Lihat Detail & Berita Acara"</strong> untuk membuka laporan fisik dan cetak berita acara.
                </div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Menampilkan <strong>{filteredSessions.length}</strong> dokumen sesi
              </span>
            </div>

            {sessionsLoading ? (
              <LoadingState />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 140 }}>No. Dokumen Opname</th>
                      <th style={{ width: 100 }}>Tgl Opname</th>
                      <th style={{ width: 110 }}>Status</th>
                      <th style={{ minWidth: 150 }}>Periode Buku</th>
                      <th style={{ minWidth: 150 }}>Gudang / Cabang</th>
                      <th style={{ minWidth: 130 }}>Pemeriksa (PIC)</th>
                      <th style={{ minWidth: 130 }}>Saksi / Approver</th>
                      <th className="center" style={{ width: 120 }}>Hasil Fisik</th>
                      <th className="center" style={{ width: 140 }}>Distribusi Selisih</th>
                      <th className="right" style={{ width: 130 }}>Net Variance (Rp)</th>
                      <th className="center" style={{ width: 130 }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSessions.length === 0 ? (
                      <tr>
                        <td colSpan={11} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
                          Belum ada arsip sesi opname yang sesuai dengan filter.
                        </td>
                      </tr>
                    ) : (
                      filteredSessions.map(s => (
                        <tr
                          key={s.opname_no}
                          style={{ cursor: 'pointer' }}
                          className="table-row-hover"
                          onClick={() => openSessionDetail(s.opname_no)}
                        >
                          <td className="mono" style={{ fontWeight: 700, color: 'var(--accent-bright)' }}>
                            {s.opname_no}
                          </td>
                          <td className="mono" style={{ fontSize: 12.5 }}>
                            {s.opname_date}
                          </td>
                          <td>
                            <span style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: s.is_closed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: s.is_closed ? '#34d399' : '#fbbf24',
                              border: `1px solid ${s.is_closed ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`
                            }}>
                              {s.is_closed ? '🟢 RELEASED' : '⏳ DRAFT'}
                            </span>
                          </td>
                          <td className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                            {s.period_from} s/d {s.period_to}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Store size={13} color="var(--text-muted)" />
                              <span style={{ fontWeight: 600, color: '#ffffff' }}>{s.outlet_name}</span>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: 12.5, fontWeight: 500 }}>{s.created_by_name}</span>
                          </td>
                          <td>
                            <span style={{ fontSize: 12, color: s.approver ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              {s.approver || '—'}
                            </span>
                          </td>
                          <td className="center">
                            <span className="pill pill-muted mono" style={{ fontSize: 11 }}>
                              {s.items_counted} / {s.total_items} bahan
                            </span>
                          </td>
                          <td className="center">
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                              {s.surplus_count > 0 && (
                                <span className="pill pill-ok" style={{ fontSize: 10 }} title="Bahan Surplus">
                                  +{s.surplus_count}
                                </span>
                              )}
                              {s.deficit_count > 0 && (
                                <span className="pill pill-danger" style={{ fontSize: 10 }} title="Bahan Defisit/Minus">
                                  -{s.deficit_count}
                                </span>
                              )}
                              {s.match_count > 0 && (
                                <span className="pill pill-muted" style={{ fontSize: 10 }} title="Bahan Pas/Sesuai">
                                  ={s.match_count}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="mono right" style={{ fontWeight: 700, color: s.net_variance_value > 0 ? 'var(--ok)' : s.net_variance_value < 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                            {s.net_variance_value > 0 ? '+' : ''}{rupiah(s.net_variance_value)}
                          </td>
                          <td className="center" onClick={e => e.stopPropagation()}>
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ padding: '4px 10px', fontSize: 11.5 }}
                              onClick={() => openSessionDetail(s.opname_no)}
                            >
                              <Eye size={12} /> Berita Acara
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DETAIL SESI OPNAME & BERITA ACARA (PRINTABLE DOKUMEN RESMI)         */}
      {/* ========================================================================= */}
      {detailModalOpen && (
        <div className="modal-backdrop" onClick={() => setDetailModalOpen(false)}>
          <div
            className="modal-content card"
            style={{ maxWidth: 880, width: '100%', margin: '20px', maxHeight: '94vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header Actions */}
            <div className="flex-between mb-4 pb-2 no-print" style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileText size={18} color="var(--accent-bright)" />
                <span style={{ fontSize: 15, fontWeight: 700 }}>
                  Dokumen Berita Acara Opname — {selectedSessionNo}
                </span>
                {sessionDetail?.session && (
                  <span style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: sessionDetail.session.is_closed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: sessionDetail.session.is_closed ? '#34d399' : '#fbbf24',
                    border: `1px solid ${sessionDetail.session.is_closed ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`
                  }}>
                    {sessionDetail.session.is_closed ? '🟢 RELEASED' : '⏳ DRAFT'}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {(isOwnerBisnis || isSuperadminPlatform) && sessionDetail?.session && !sessionDetail.session.is_closed && (
                  <button
                    className="btn btn-sm"
                    style={{ background: '#10b981', borderColor: '#10b981', color: '#ffffff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}
                    onClick={() => handleReleaseSession(selectedSessionNo)}
                  >
                    <CheckCircle2 size={14} /> Release & Setujui Opname Ini
                  </button>
                )}
                <button className="btn btn-primary btn-sm" onClick={printBeritaAcara}>
                  <Printer size={13} /> Cetak Berita Acara
                </button>
                <button
                  className="btn btn-ghost btn-icon"
                  onClick={() => setDetailModalOpen(false)}
                  style={{ padding: 4 }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {detailLoading || !sessionDetail ? (
              <div style={{ padding: 40 }}><LoadingState /></div>
            ) : (
              /* Printable Berita Acara Container */
              <div
                id="printable-berita-acara"
                className="printable-document"
                style={{
                  padding: '24px 28px',
                  background: '#ffffff',
                  color: '#0f172a',
                  borderRadius: 8,
                  fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}
              >
                {/* Header Berita Acara */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: 14, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: '#1e1b4b', letterSpacing: '-0.02em' }}>
                      MOVA POS — AUDIT & INVENTORY CONTROL
                    </div>
                    <div style={{ fontSize: 12, color: '#475569' }}>
                      Dokumen Resmi Berita Acara Hasil Rekonsiliasi & Stock Opname Fisik
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#4f46e5' }}>
                      BERITA ACARA OPNAME
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                      {sessionDetail.session?.opname_no}
                    </div>
                  </div>
                </div>

                {/* Metadata Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: 12.5, marginBottom: 16 }}>
                  <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                      Lokasi Pemeriksaan Fisik
                    </div>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
                      {sessionDetail.session?.outlet?.name || 'Gudang Utama'}
                    </div>
                    <div style={{ color: '#475569', fontSize: 12, marginTop: 2 }}>
                      Alamat: {sessionDetail.session?.outlet?.address || 'Makassar'}
                    </div>
                    <div style={{ color: '#64748b', fontSize: 11.5, marginTop: 2 }}>
                      Tanggal Audit: <strong>{sessionDetail.session?.opname_date}</strong>
                    </div>
                  </div>

                  <div style={{ padding: '10px 12px', background: '#eef2ff', borderRadius: 6, border: '1px solid #c7d2fe' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', marginBottom: 4 }}>
                      Petugas & Periode Audit
                    </div>
                    <div><strong>Periode Buku:</strong> {sessionDetail.session?.period_from} s/d {sessionDetail.session?.period_to}</div>
                    <div><strong>Pemeriksa (PIC):</strong> {sessionDetail.session?.created_by_name || 'Staff Gudang'}</div>
                    <div><strong>Saksi / Approver:</strong> {sessionDetail.session?.approver || '—'}</div>
                  </div>
                </div>

                {/* Summary Variance Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18, textAlign: 'center' }}>
                  <div style={{ padding: '8px 10px', background: '#f1f5f9', borderRadius: 6, border: '1px solid #cbd5e1' }}>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>Bahan Diperiksa</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                      {sessionDetail.summary?.items_counted} / {sessionDetail.summary?.total_items}
                    </div>
                  </div>

                  <div style={{ padding: '8px 10px', background: '#ecfdf5', borderRadius: 6, border: '1px solid #a7f3d0' }}>
                    <div style={{ fontSize: 11, color: '#047857', textTransform: 'uppercase' }}>Total Surplus (+)</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#059669', marginTop: 2 }}>
                      +{rupiah(sessionDetail.summary?.total_surplus_value)}
                    </div>
                  </div>

                  <div style={{ padding: '8px 10px', background: '#fff1f2', borderRadius: 6, border: '1px solid #fecdd3' }}>
                    <div style={{ fontSize: 11, color: '#b91c1c', textTransform: 'uppercase' }}>Total Defisit (-)</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#e11d48', marginTop: 2 }}>
                      -{rupiah(sessionDetail.summary?.total_deficit_value)}
                    </div>
                  </div>

                  <div style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: 6, border: '1px solid #cbd5e1' }}>
                    <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase' }}>Net Selisih (Rp)</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: sessionDetail.summary?.total_variance_value >= 0 ? '#059669' : '#e11d48', marginTop: 2 }}>
                      {rupiah(sessionDetail.summary?.total_variance_value)}
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, marginBottom: 20 }}>
                  <thead>
                    <tr style={{ background: '#0f172a', color: '#ffffff' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'center', width: 30 }}>No</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left', width: 75 }}>Kode</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Nama Bahan</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Awal</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Masuk</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Teori POS</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Waste</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Sisa Teori</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800, background: '#1e1b4b' }}>Sisa Fisik</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Selisih Net</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Nilai Rp</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center', width: 70 }}>Status</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionDetail.items?.map((it, idx) => (
                      <tr key={it.ingredient_id || idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td style={{ padding: '6px 8px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontWeight: 600, color: '#4f46e5' }}>{it.code}</td>
                        <td style={{ padding: '6px 8px', fontWeight: 700, color: '#0f172a' }}>{it.name}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{num(it.stok_awal_periode)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>+{num(it.pembelian + (it.transfer_in || 0))}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>-{num(it.pemakaian_teoritis)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#ea580c' }}>{num(it.waste)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{num(it.stok_akhir_teoritis)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, background: '#f1f5f9', color: '#0f172a' }}>
                          {it.stok_akhir_aktual !== null ? `${num(it.stok_akhir_aktual)} ${it.unit_pakai}` : '—'}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: it.variance_qty > 0 ? '#059669' : it.variance_qty < 0 ? '#e11d48' : '#64748b' }}>
                          {it.variance_qty !== null ? `${it.variance_qty > 0 ? '+' : ''}${num(it.variance_qty)} (${pct(it.variance_pct)})` : '—'}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: it.variance_value > 0 ? '#059669' : it.variance_value < 0 ? '#e11d48' : '#64748b' }}>
                          {it.variance_value !== null ? rupiah(it.variance_value) : '—'}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <span
                            style={{
                              fontSize: 9.5,
                              padding: '2px 5px',
                              borderRadius: 4,
                              fontWeight: 700,
                              color: it.status === 'NORMAL' ? '#059669' : it.status === 'WASPADA' ? '#d97706' : '#dc2626',
                              background: it.status === 'NORMAL' ? '#ecfdf5' : it.status === 'WASPADA' ? '#fef3c7' : '#fee2e2'
                            }}
                          >
                            {it.status || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '6px 8px', color: '#64748b', fontSize: 11 }}>
                          {it.reason || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* General Notes */}
                {sessionDetail.session?.notes && (
                  <div style={{ fontSize: 12, color: '#475569', marginBottom: 20, padding: '6px 10px', background: '#f8fafc', borderRadius: 4, borderLeft: '3px solid #4f46e5' }}>
                    <strong>Catatan Khusus:</strong> {sessionDetail.session?.notes}
                  </div>
                )}

                {/* Signatures */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 24, textAlign: 'center', fontSize: 12 }}>
                  <div>
                    <div style={{ color: '#64748b', marginBottom: 45 }}>Pemeriksa Hitung Fisik,</div>
                    <div style={{ fontWeight: 700, borderTop: '1px solid #94a3b8', paddingTop: 4, color: '#0f172a' }}>
                      ( {sessionDetail.session?.created_by_name || 'Staff Gudang / PIC'} )
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Petugas Pelaksana</div>
                  </div>

                  <div>
                    <div style={{ color: '#64748b', marginBottom: 45 }}>Saksi Pemeriksaan,</div>
                    <div style={{ fontWeight: 700, borderTop: '1px solid #94a3b8', paddingTop: 4, color: '#0f172a' }}>
                      ( {sessionDetail.session?.approver || 'Store Manager / Supervisor'} )
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Saksi / Penanggung Jawab</div>
                  </div>

                  <div>
                    <div style={{ color: '#64748b', marginBottom: 45 }}>Disetujui & Disahkan,</div>
                    <div style={{ fontWeight: 700, borderTop: '1px solid #94a3b8', paddingTop: 4, color: '#0f172a' }}>
                      ( Owner / Finance Manager )
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Pimpinan Perusahaan</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
