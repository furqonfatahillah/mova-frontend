import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Trash2, HelpCircle, Layers, FileSpreadsheet, Printer, X, Download, ShieldCheck, Building2, Calendar, User } from 'lucide-react';
import api from '../api/client';
import { rupiah, pct, num, StatusPill, LoadingState, PeriodPicker, PageHeader } from '../components/ui';
import { getWasteReason } from './StockMovement';
import toast from 'react-hot-toast';
import { useOutlet } from '../context/OutletContext';
import { exportDashboardToExcel } from '../utils/exportReport';
import { printElement } from '../utils/print';

const today = new Date().toISOString().slice(0, 10);
const firstOfMonth = today.slice(0, 8) + '01';

export default function Dashboard() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState({ from: '2026-08-01', to: '2026-08-31' });
  const [data, setData] = useState(null);
  const [varData, setVarData] = useState([]);
  const [varMenuData, setVarMenuData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);

  const { activeOutletId, activeOutlet, currentBusiness } = useOutlet();
  const currentUser = JSON.parse(localStorage.getItem('pos_user') || '{}');
  const businessName = currentBusiness?.name || currentUser?.business?.name || 'MOVA POS F&B Management';
  const outletName = (activeOutlet && activeOutletId !== 'ALL' && activeOutletId !== 'all') ? activeOutlet.name : 'Semua Cabang (Konsolidasi)';

  useEffect(() => {
    fetchAll();
  }, [period, activeOutletId]);

  async function fetchAll() {
    setLoading(true);
    try {
      const targetOutlet = activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all' ? activeOutletId : undefined;
      const params = { from: period.from, to: period.to, outlet_id: targetOutlet };
      const [dash, varBahan, varMenu] = await Promise.all([
        api.get('/reports/dashboard', { params }),
        api.get('/reports/variance/ingredients', { params }),
        api.get('/reports/variance/menus', { params }),
      ]);
      setData(dash.data);
      setVarData(varBahan.data.slice(0, 5).filter(v => v.variance_value !== null).sort((a, b) => Math.abs(b.variance_value) - Math.abs(a.variance_value)));
      setVarMenuData(varMenu.data.slice(0, 5).sort((a, b) => Math.abs(b.variance_value) - Math.abs(a.variance_value)));
    } catch {
      toast.error('Gagal memuat data dashboard');
    } finally {
      setLoading(false);
    }
  }

  function handleExportExcel() {
    try {
      const fname = exportDashboardToExcel({
        data,
        varData,
        varMenuData,
        period,
        outletName,
        businessName,
        userName: currentUser?.name || 'Administrator',
      });
      toast.success(`Laporan Excel berhasil diunduh: ${fname}`);
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengekspor laporan ke Excel');
    }
  }

  function handlePrintPdf() {
    printElement(
      'printable-dashboard-report',
      `Laporan Eksekutif Cost Control - ${period.from} sd ${period.to}`,
      { orientation: 'portrait' }
    );
  }

  if (loading) return <LoadingState />;
  if (!data) return null;

  const {
    status_counts = {},
    total_variance_value = 0,
    total_variance_loss = 0,
    total_waste_value = 0,
    total_combined_loss = 0,
    top_waste: topWaste = [],
    waste_by_reason = {},
  } = data || {};

  return (
    <div className="fade-in">
      <div className="flex-between mb-4 flex-wrap gap-3">
        <PageHeader
          title="Cost Control & Analytics Dashboard"
          subtitle="Evaluasi kinerja HPP, audit variance bahan baku & pemisahan kerugian waste untuk periode berjalan."
        />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <PeriodPicker from={period.from} to={period.to} onChange={setPeriod} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                borderColor: 'rgba(16, 185, 129, 0.4)',
                color: '#34d399',
                background: 'rgba(16, 185, 129, 0.08)',
                fontWeight: 600
              }}
              onClick={handleExportExcel}
              title="Unduh laporan dalam format Microsoft Excel (.xlsx)"
            >
              <FileSpreadsheet size={15} /> Export Excel
            </button>
            <button
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
              onClick={() => setShowReportModal(true)}
              title="Pratinjau dokumen eksekutif & unduh / cetak sebagai PDF"
            >
              <Printer size={15} /> Unduh PDF / Cetak
            </button>
          </div>
        </div>
      </div>

      {/* Cost Control Key Metric Cards */}
      <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="stat-card ok">
          <div className="stat-label">✓ Normal</div>
          <div className="stat-value ok">{status_counts.NORMAL ?? 0}</div>
          <div className="stat-sub">bahan dalam batas resep</div>
        </div>

        <div className="stat-card warn">
          <div className="stat-label">⚠ Waspada</div>
          <div className="stat-value warn">{status_counts.WASPADA ?? 0}</div>
          <div className="stat-sub">perlu perhatian koki</div>
        </div>

        <div className="stat-card danger">
          <div className="stat-label">✕ Tidak Wajar</div>
          <div className="stat-value danger">{status_counts['TIDAK WAJAR'] ?? 0}</div>
          <div className="stat-sub">wajib investigasi</div>
        </div>

        <div className="stat-card" style={{ background: 'rgba(251, 146, 60, 0.08)', border: '1px solid rgba(251, 146, 60, 0.25)' }}>
          <div className="stat-label" style={{ color: '#fb923c', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Trash2 size={13} /> Kerugian Waste
          </div>
          <div className="stat-value" style={{ fontSize: 20, color: '#fb923c' }}>
            {rupiah(total_waste_value || 0)}
          </div>
          <div className="stat-sub">kerusakan bahan resmi</div>
        </div>

        <div className="stat-card" style={{ background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.25)' }}>
          <div className="stat-label" style={{ color: '#fb7185', display: 'flex', alignItems: 'center', gap: 5 }}>
            <HelpCircle size={13} /> Selisih Tak Jelas
          </div>
          <div className="stat-value" style={{ fontSize: 20, color: '#fb7185' }}>
            {rupiah(total_variance_loss || 0)}
          </div>
          <div className="stat-sub">anomali fisik vs teoritis</div>
        </div>

        <div className="stat-card accent">
          <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Layers size={13} /> Total Kerugian F&B
          </div>
          <div className="stat-value" style={{ fontSize: 20, color: 'var(--accent-bright)' }}>
            {rupiah(total_combined_loss || 0)}
          </div>
          <div className="stat-sub">waste + selisih murni</div>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="grid-2 gap-4 mb-4">
        {/* Top Bahan Variance (Unaccounted Shrinkage) */}
        <div className="card">
          <div className="flex-between mb-3">
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <HelpCircle size={16} color="var(--danger)" />
              <span>Top Selisih Bahan (Perlu Audit)</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/variance/bahan')}>
              Selengkapnya →
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bahan Baku</th>
                  <th className="right">% Net</th>
                  <th className="right">Nilai Selisih</th>
                  <th className="right">Status</th>
                </tr>
              </thead>
              <tbody>
                {varData.map((iv, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{iv.ingredient?.name}</td>
                    <td className="mono right">{pct(iv.variance_pct)}</td>
                    <td className="mono right" style={{ color: iv.variance_value > 0 ? 'var(--danger)' : 'var(--ok)' }}>
                      {rupiah(iv.variance_value)}
                    </td>
                    <td className="right">
                      <StatusPill status={iv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Menu Variance */}
        <div className="card">
          <div className="flex-between mb-3">
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={16} color="var(--accent)" />
              <span>Top Menu Penyumbang Variance</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/variance/menu')}>
              Selengkapnya →
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Menu</th>
                  <th className="right">Weighted %</th>
                  <th className="right">Variance Value</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {varMenuData.map((row, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{row.menu?.name}</td>
                    <td className="mono right">{pct(row.weighted_pct)}</td>
                    <td className="mono right" style={{ color: row.variance_value > 0 ? 'var(--danger)' : 'var(--ok)' }}>
                      {rupiah(row.variance_value)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/variance/menu')}>
                        Lihat →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Top Waste / Kerusakan Bahan Baku Section */}
      <div className="card" style={{ border: '1px solid rgba(251, 146, 60, 0.25)' }}>
        <div className="flex-between mb-3">
          <div style={{ fontWeight: 700, fontSize: 14, color: '#fb923c', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Trash2 size={16} />
            <span>Kerusakan & Limbah Bahan Baku (Documented Waste Breakdown)</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/movement')}>
            Buka Mutasi Stok →
          </button>
        </div>

        {topWaste.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bahan Baku</th>
                  <th className="right">Total Rusak / Terbuang</th>
                  <th className="right">Nilai Kerugian Waste</th>
                  <th>Log Kejadian Tercatat</th>
                  <th>Tindakan Rekomendasi</th>
                </tr>
              </thead>
              <tbody>
                {topWaste.map((tw, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{tw.ingredient?.name}</td>
                    <td className="mono right" style={{ color: '#fb923c', fontWeight: 600 }}>
                      {num(tw.waste_qty || tw.waste)} {tw.ingredient?.unit_pakai}
                    </td>
                    <td className="mono right" style={{ color: '#fb923c', fontWeight: 700 }}>
                      {rupiah(tw.waste_value)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(tw.waste_records || []).slice(0, 2).map((wr, wIdx) => {
                          const r = getWasteReason(wr.waste_reason);
                          return (
                            <span key={wIdx} style={{ fontSize: 11, color: r.badgeColor, background: r.bg, padding: '2px 7px', borderRadius: 4 }}>
                              {r.label} ({num(wr.qty)} {tw.ingredient?.unit_pakai})
                            </span>
                          );
                        })}
                        {(tw.waste_records?.length || 0) > 2 && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            +{tw.waste_records.length - 2} log lain
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Evaluasi suhu penyimpanan & SOP handling bahan.
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '12px 0', textAlign: 'center' }}>
            🎉 Tidak ada bahan baku yang terbuang atau rusak pada periode ini.
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL PRATINJAU LAPORAN EKSEKUTIF COST CONTROL (PRINT / DOWNLOAD PDF)     */}
      {/* ========================================================================= */}
      {showReportModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 20, 0.82)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 16
          }}
        >
          <div
            className="modal-card"
            style={{
              width: '100%',
              maxWidth: 920,
              maxHeight: '92vh',
              background: '#0d1226',
              border: '1px solid rgba(165, 180, 252, 0.25)',
              borderRadius: 14,
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Modal Action Bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 20px',
                borderBottom: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.03)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(79, 70, 229, 0.15)', color: 'var(--accent-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>
                    Pratinjau Dokumen Laporan Eksekutif
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    Format resmi siap cetak / simpan sebagai PDF untuk Akuntan, Mitra & Investor
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleExportExcel}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, borderColor: 'rgba(16, 185, 129, 0.4)', color: '#34d399' }}
                >
                  <FileSpreadsheet size={14} /> Export Excel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handlePrintPdf}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}
                >
                  <Printer size={14} /> Cetak / Simpan PDF
                </button>
                <button
                  className="btn btn-ghost btn-icon"
                  onClick={() => setShowReportModal(false)}
                  style={{ padding: 6, marginLeft: 4 }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Document Paper Container (Scrollable Preview) */}
            <div style={{ overflowY: 'auto', padding: '24px 28px', background: '#0a0e20' }}>
              <div
                id="printable-dashboard-report"
                className="printable-document"
                style={{
                  padding: '30px 36px',
                  background: '#ffffff',
                  color: '#0f172a',
                  borderRadius: 10,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                  maxWidth: 850,
                  margin: '0 auto'
                }}
              >
                {/* 1. KOP RESMI LAPORAN */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2.5px solid #0f172a', paddingBottom: 16, marginBottom: 20 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#4f46e5' }} />
                      <span style={{ fontWeight: 800, fontSize: 18, color: '#1e1b4b', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
                        {businessName}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginTop: 3 }}>
                      LAPORAN EKSEKUTIF COST CONTROL & ANALISIS VARIANSI
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      MOVA POS — Advanced Inventory Cost Accounting & Recipe Yield Protection
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#4f46e5', background: '#eef2ff', padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Dokumen Manajemen F&B
                    </span>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                      No. Dokumen: <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>REP-CC-{period.from.replace(/-/g, '')}-{period.to.replace(/-/g, '')}</strong>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      Waktu Cetak: {new Date().toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>

                {/* 2. PARAMETER AUDIT METADATA */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 20, fontSize: 11.5 }}>
                  <div>
                    <div style={{ color: '#64748b', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 700 }}>Cabang / Gudang</div>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, marginTop: 1 }}>{outletName}</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 700 }}>Periode Audit</div>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, marginTop: 1 }}>{period.from} s/d {period.to}</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 700 }}>Auditor / Dicetak Oleh</div>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, marginTop: 1 }}>{currentUser?.name || 'Administrator'} ({currentUser?.role || 'Staff'})</div>
                  </div>
                </div>

                {/* 3. EXECUTIVE KPI STRIP */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                    I. Ringkasan Eksekutif Finansial & Persediaan
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, textAlign: 'center' }}>
                    <div style={{ padding: '10px 8px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 6 }}>
                      <div style={{ fontSize: 10.5, color: '#64748b', textTransform: 'uppercase' }}>Status Resep Bahan</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginTop: 3 }}>
                        <span style={{ color: '#059669' }}>{status_counts.NORMAL ?? 0}</span> / <span style={{ color: '#d97706' }}>{status_counts.WASPADA ?? 0}</span> / <span style={{ color: '#dc2626' }}>{status_counts['TIDAK WAJAR'] ?? 0}</span>
                      </div>
                      <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 2 }}>Normal / Waspada / Anomali</div>
                    </div>

                    <div style={{ padding: '10px 8px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6 }}>
                      <div style={{ fontSize: 10.5, color: '#c2410c', textTransform: 'uppercase' }}>Kerugian Limbah (Waste)</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#ea580c', marginTop: 3 }}>
                        {rupiah(total_waste_value || 0)}
                      </div>
                      <div style={{ fontSize: 9.5, color: '#9a3412', marginTop: 2 }}>Diakui dapur & staf</div>
                    </div>

                    <div style={{ padding: '10px 8px', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 6 }}>
                      <div style={{ fontSize: 10.5, color: '#be123c', textTransform: 'uppercase' }}>Selisih Tak Jelas (Shrinkage)</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#e11d48', marginTop: 3 }}>
                        {rupiah(total_variance_loss || 0)}
                      </div>
                      <div style={{ fontSize: 9.5, color: '#9f1239', marginTop: 2 }}>Anomali fisik vs sistem</div>
                    </div>

                    <div style={{ padding: '10px 8px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 6 }}>
                      <div style={{ fontSize: 10.5, color: '#4338ca', textTransform: 'uppercase' }}>Total Kerugian F&B</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#4f46e5', marginTop: 3 }}>
                        {rupiah(total_combined_loss || 0)}
                      </div>
                      <div style={{ fontSize: 9.5, color: '#3730a3', marginTop: 2 }}>Akumulasi kerugian bersih</div>
                    </div>
                  </div>
                </div>

                {/* 4. TABEL TOP SELISIH BAHAN BAKU */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <span>II. Bahan Baku dengan Anomali Selisih Tertinggi (Perlu Audit)</span>
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: '#64748b' }}>Metode: PSAK 14 Weighted Moving Avg</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderTop: '1px solid #cbd5e1', borderBottom: '1.5px solid #94a3b8' }}>
                        <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700, color: '#1e293b' }}>Nama Bahan Baku</th>
                        <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700, color: '#1e293b' }}>Kategori</th>
                        <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, color: '#1e293b' }}>% Net Variance</th>
                        <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, color: '#1e293b' }}>Nilai Selisih (Rp)</th>
                        <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 700, color: '#1e293b' }}>Status Audit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {varData.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '12px', color: '#64748b' }}>
                            Tidak ada data selisih bahan baku untuk periode ini.
                          </td>
                        </tr>
                      ) : (
                        varData.map((iv, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '6px 8px', fontWeight: 600, color: '#0f172a' }}>{iv.ingredient?.name}</td>
                            <td style={{ padding: '6px 8px', color: '#475569' }}>{iv.ingredient?.category || '-'}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{pct(iv.variance_pct)}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: iv.variance_value > 0 ? '#dc2626' : '#059669' }}>
                              {rupiah(iv.variance_value)}
                            </td>
                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                              <span style={{
                                fontSize: 9.5,
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: iv.status === 'NORMAL' ? '#ecfdf5' : iv.status === 'WASPADA' ? '#fffbeb' : '#fef2f2',
                                color: iv.status === 'NORMAL' ? '#047857' : iv.status === 'WASPADA' ? '#b45309' : '#b91c1c'
                              }}>
                                {iv.status || 'NORMAL'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 5. TABEL TOP MENU PENYUMBANG VARIANCE */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                    III. Menu Produk Penyumbang Variansi HPP Terbesar
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderTop: '1px solid #cbd5e1', borderBottom: '1.5px solid #94a3b8' }}>
                        <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700, color: '#1e293b' }}>Nama Menu</th>
                        <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, color: '#1e293b' }}>Qty Terjual</th>
                        <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, color: '#1e293b' }}>Weighted %</th>
                        <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, color: '#1e293b' }}>Nilai Variance (Rp)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {varMenuData.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', padding: '12px', color: '#64748b' }}>
                            Tidak ada menu penyumbang variansi untuk periode ini.
                          </td>
                        </tr>
                      ) : (
                        varMenuData.map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '6px 8px', fontWeight: 600, color: '#0f172a' }}>{row.menu?.name}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{row.qty_terjual || 0} porsi</td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{pct(row.weighted_pct)}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: row.variance_value > 0 ? '#dc2626' : '#059669' }}>
                              {rupiah(row.variance_value)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 6. TABEL DOCUMENTED WASTE LOG */}
                {topWaste.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                      IV. Rincian Limbah & Kerusakan Bahan Baku (Documented Waste)
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9', borderTop: '1px solid #cbd5e1', borderBottom: '1.5px solid #94a3b8' }}>
                          <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700, color: '#1e293b' }}>Bahan Baku</th>
                          <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, color: '#1e293b' }}>Total Terbuang</th>
                          <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, color: '#1e293b' }}>Nilai Kerugian (Rp)</th>
                          <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700, color: '#1e293b' }}>Alasan Limbah Tercatat</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topWaste.map((tw, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '6px 8px', fontWeight: 600, color: '#0f172a' }}>{tw.ingredient?.name}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                              {num(tw.waste_qty || tw.waste)} {tw.ingredient?.unit_pakai}
                            </td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#ea580c' }}>
                              {rupiah(tw.waste_value)}
                            </td>
                            <td style={{ padding: '6px 8px', color: '#475569', fontSize: 10.5 }}>
                              {(tw.waste_records || []).map(wr => `${getWasteReason(wr.waste_reason).label}: ${num(wr.qty)}`).join(', ') || 'Limbah operasional dapur'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 7. CATATAN STRATEGIS & REKOMENDASI AUDIT */}
                <div style={{ padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 28, fontSize: 11, lineHeight: 1.6 }}>
                  <strong style={{ color: '#0f172a', textTransform: 'uppercase', fontSize: 11.5 }}>Catatan Analisis & Rekomendasi Manajemen:</strong>
                  <ul style={{ margin: '6px 0 0 16px', padding: 0, color: '#334155' }}>
                    <li><strong>Perlindungan Margin Menu:</strong> Evaluasi takaran porsi (yield testing) untuk bahan yang berstatus <em>TIDAK WAJAR</em> guna mencegah kebocoran margin kotor.</li>
                    <li><strong>Mitigasi Limbah Basi / Rusak:</strong> Evaluasi suhu cold storage dan terapkan sistem rotasi FIFO/FEFO ketat pada bahan mudah rusak (perishable items).</li>
                    <li><strong>Transparansi Akuntansi:</strong> Seluruh perhitungan harga bahan menggunakan metode <em>Weighted Moving Average (PSAK 14)</em> yang merefleksikan harga beli pasar terkini.</li>
                  </ul>
                </div>

                {/* 8. BLOK TANDA TANGAN 3 PIHAK (OFFICIAL SIGNATURES) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, textAlign: 'center', marginTop: 10, pageBreakInside: 'avoid' }}>
                  <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>Disiapkan Oleh:</div>
                    <div style={{ height: 48 }} />
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#0f172a' }}>{currentUser?.name || 'Supervisor Dapur'}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>Cost Control & Kitchen Leader</div>
                  </div>

                  <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>Diperiksa Oleh:</div>
                    <div style={{ height: 48 }} />
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#0f172a' }}>Store Manager / Finance</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>Akuntan Cabang / Finance Spv</div>
                  </div>

                  <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>Disetujui Oleh:</div>
                    <div style={{ height: 48 }} />
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#0f172a' }}>Mitra Pemilik / Investor</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>Branch Partner / Investor Representative</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
