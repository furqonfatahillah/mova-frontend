import { useState, useEffect } from 'react';
import api from '../api/client';
import { rupiah, pct, LoadingState, PeriodPicker, PageHeader } from '../components/ui';
import { FileSpreadsheet, Printer, X, ShieldCheck, TrendingDown, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { useOutlet } from '../context/OutletContext';
import { exportProfitabilityToExcel } from '../utils/exportReport';
import { printElement } from '../utils/print';

export default function Profitability() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);

  const { activeOutletId, activeOutlet, currentBusiness, dateRange: period } = useOutlet();
  const currentUser = JSON.parse(localStorage.getItem('pos_user') || '{}');
  const businessName = currentBusiness?.name || currentUser?.business?.name || 'MOVA POS F&B Management';
  const outletName = (activeOutlet && activeOutletId !== 'ALL' && activeOutletId !== 'all') ? activeOutlet.name : 'Semua Cabang (Konsolidasi)';

  useEffect(() => { fetchData(); }, [period, activeOutletId]);

  async function fetchData() {
    setLoading(true);
    try {
      const targetOutlet = activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all' ? activeOutletId : undefined;
      const { data } = await api.get('/reports/profitability', {
        params: { from: period.from, to: period.to, outlet_id: targetOutlet }
      });
      setData(data);
    } catch { toast.error('Gagal memuat data'); }
    finally { setLoading(false); }
  }

  async function handleExportExcel() {
    try {
      const fname = await exportProfitabilityToExcel({
        data,
        period,
        outletName,
        businessName,
        userName: currentUser?.name || 'Administrator',
      });
      toast.success(`Laporan Profitabilitas Excel berhasil diunduh: ${fname}`);
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengekspor laporan ke Excel');
    }
  }

  function handlePrintPdf() {
    printElement(
      'printable-profitability-report',
      `Laporan Profitabilitas Menu dan HPP - ${period.from} sd ${period.to}`,
      { orientation: 'portrait' }
    );
  }

  function marginBar(pctVal, bad = false) {
    const color = bad ? 'var(--danger)' : pctVal > 50 ? 'var(--ok)' : pctVal > 30 ? 'var(--warn)' : 'var(--danger)';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(0, Math.min(100, pctVal))}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
        </div>
        <span className="mono" style={{ fontSize: 12, color, minWidth: 36, textAlign: 'right' }}>{pctVal.toFixed(0)}%</span>
      </div>
    );
  }

  // Calculate summary metrics
  const avgGrossMargin = data.length > 0 ? (data.reduce((s, r) => s + (r.gross_margin || 0), 0) / data.length) : 0;
  const avgAdjustedMargin = data.length > 0 ? (data.reduce((s, r) => s + (r.adjusted_margin || 0), 0) / data.length) : 0;
  const criticalDropCount = data.filter(r => (r.gross_margin - r.adjusted_margin) > 3).length;

  if (loading) return <LoadingState />;

  return (
    <div className="fade-in">
      <div className="flex-between mb-4 flex-wrap gap-3">
        <PageHeader
          title="Menu Profitability & HPP Dinamis"
          subtitle="Evaluasi margin & HPP aktual berbasis Weighted Moving Average bahan baku, disesuaikan dengan variance per porsi."
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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
              title="Unduh laporan profitabilitas ke format Excel (.xlsx)"
            >
              <FileSpreadsheet size={15} /> Export Excel
            </button>
            <button
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
              onClick={() => setShowReportModal(true)}
              title="Pratinjau laporan & unduh / cetak sebagai PDF"
            >
              <Printer size={15} /> Unduh PDF / Cetak
            </button>
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Menu</th>
              <th className="right">Harga Jual</th>
              <th className="right">HPP (Moving Avg)</th>
              <th>Gross Margin</th>
              <th className="right">Variance Cost/Porsi</th>
              <th className="right">Adjusted HPP</th>
              <th>Adjusted Margin</th>
            </tr>
          </thead>
          <tbody>
            {data.map(r => {
              const marginDrop = r.gross_margin - r.adjusted_margin;
              return (
                <tr key={r.menu?.id}>
                  <td style={{ fontWeight: 600 }}>{r.menu?.name}</td>
                  <td className="mono right" style={{ color: 'var(--text-primary)' }}>{rupiah(r.menu?.price)}</td>
                  <td className="mono right">{rupiah(r.hpp)}</td>
                  <td style={{ minWidth: 140 }}>{marginBar(r.gross_margin)}</td>
                  <td className="mono right" style={{ color: r.variance_per_porsi > 0 ? 'var(--danger)' : 'var(--ok)' }}>
                    {rupiah(r.variance_per_porsi)}
                  </td>
                  <td className="mono right">{rupiah(r.adjusted_hpp)}</td>
                  <td style={{ minWidth: 140 }}>
                    {marginBar(r.adjusted_margin, marginDrop > 3)}
                    {marginDrop > 3 && (
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--danger)', marginTop: 2 }}>
                        ↓ {marginDrop.toFixed(1)}pp dari variance
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        <strong style={{ color: 'var(--text-primary)' }}>Interpretasi:</strong> Adjusted Margin memperhitungkan variance cost aktual per porsi.
        Jika adjusted margin turun &gt;3 percentage point (merah), perlu investigasi variance atau revisi harga jual.
      </div>

      {/* ========================================================================= */}
      {/* MODAL PRATINJAU DOKUMEN PROFITABILITAS & HPP (PRINT / PDF)                */}
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
                    Pratinjau Dokumen Profitabilitas Menu & Unit Economics
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    Format resmi analisis margin & HPP Moving Average untuk Investor dan Manajemen
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

            {/* Document Paper Container */}
            <div style={{ overflowY: 'auto', padding: '24px 28px', background: '#0a0e20' }}>
              <div
                id="printable-profitability-report"
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
                      LAPORAN ANALISIS PROFITABILITAS MENU & HPP DINAMIS
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      MOVA POS — Evaluasi Margin Produk Berbasis Weighted Moving Average
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#4f46e5', background: '#eef2ff', padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Unit Economics Report
                    </span>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                      No. Dokumen: <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>REP-PROF-{period.from.replace(/-/g, '')}-{period.to.replace(/-/g, '')}</strong>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      Waktu Cetak: {new Date().toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>

                {/* 2. PARAMETER METADATA */}
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
                    <div style={{ color: '#64748b', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 700 }}>Auditor PIC</div>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, marginTop: 1 }}>{currentUser?.name || 'Administrator'}</div>
                  </div>
                </div>

                {/* 3. EXECUTIVE KPI STRIP */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20, textAlign: 'center' }}>
                  <div style={{ padding: '10px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 6 }}>
                    <div style={{ fontSize: 10.5, color: '#047857', textTransform: 'uppercase', fontWeight: 700 }}>Rata-Rata Gross Margin</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#059669', marginTop: 2 }}>{avgGrossMargin.toFixed(1)}%</div>
                    <div style={{ fontSize: 9.5, color: '#065f46' }}>Margin teoritis resep</div>
                  </div>

                  <div style={{ padding: '10px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 6 }}>
                    <div style={{ fontSize: 10.5, color: '#4338ca', textTransform: 'uppercase', fontWeight: 700 }}>Rata-Rata Adjusted Margin</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#4f46e5', marginTop: 2 }}>{avgAdjustedMargin.toFixed(1)}%</div>
                    <div style={{ fontSize: 9.5, color: '#3730a3' }}>Margin riil pasca-variansi</div>
                  </div>

                  <div style={{ padding: '10px', background: criticalDropCount > 0 ? '#fff1f2' : '#f8fafc', border: `1px solid ${criticalDropCount > 0 ? '#fecdd3' : '#cbd5e1'}`, borderRadius: 6 }}>
                    <div style={{ fontSize: 10.5, color: criticalDropCount > 0 ? '#be123c' : '#475569', textTransform: 'uppercase', fontWeight: 700 }}>Menu Margin Anjlok (&gt;3pp)</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: criticalDropCount > 0 ? '#e11d48' : '#0f172a', marginTop: 2 }}>{criticalDropCount} Menu</div>
                    <div style={{ fontSize: 9.5, color: criticalDropCount > 0 ? '#9f1239' : '#64748b' }}>Wajib revisi harga/porsi</div>
                  </div>
                </div>

                {/* 4. TABEL ANALISIS PROFITABILITAS */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 20 }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderTop: '1px solid #cbd5e1', borderBottom: '1.5px solid #94a3b8' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700, color: '#1e293b' }}>Nama Menu</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, color: '#1e293b' }}>Harga Jual</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, color: '#1e293b' }}>HPP Moving Avg</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, color: '#1e293b' }}>Gross Margin</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, color: '#1e293b' }}>Var. Cost / Porsi</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, color: '#1e293b' }}>Adjusted HPP</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, color: '#1e293b' }}>Adjusted Margin</th>
                      <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 700, color: '#1e293b' }}>Evaluasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map(r => {
                      const drop = r.gross_margin - r.adjusted_margin;
                      return (
                        <tr key={r.menu?.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '6px 8px', fontWeight: 600, color: '#0f172a' }}>{r.menu?.name}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{rupiah(r.menu?.price)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{rupiah(r.hpp)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#059669' }}>
                            {r.gross_margin.toFixed(1)}%
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', color: r.variance_per_porsi > 0 ? '#dc2626' : '#059669' }}>
                            {rupiah(r.variance_per_porsi)}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{rupiah(r.adjusted_hpp)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: drop > 3 ? '#dc2626' : '#059669' }}>
                            {r.adjusted_margin.toFixed(1)}% {drop > 3 && `(↓${drop.toFixed(1)}pp)`}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <span style={{
                              fontSize: 9.5,
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: drop > 5 ? '#fef2f2' : drop > 2 ? '#fffbeb' : '#ecfdf5',
                              color: drop > 5 ? '#b91c1c' : drop > 2 ? '#b45309' : '#047857'
                            }}>
                              {drop > 5 ? 'KRITIS' : drop > 2 ? 'WASPADA' : 'SEHAT'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* 5. CATATAN UNIT ECONOMICS UNTUK INVESTOR */}
                <div style={{ padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 24, fontSize: 11, lineHeight: 1.6 }}>
                  <strong style={{ color: '#0f172a', textTransform: 'uppercase' }}>Interpretasi Finansial untuk Mitra & Investor:</strong>
                  <ul style={{ margin: '6px 0 0 16px', padding: 0, color: '#334155' }}>
                    <li><strong>Moving Average Protection:</strong> HPP otomatis memperhitungkan kenaikan harga pasar bahan baku terbaru, sehingga kalkulasi gross margin bebas dari bias harga lama.</li>
                    <li><strong>Dampak Variansi Aktual:</strong> Menu dengan selisih penurunan margin &gt;3 percentage point menandakan adanya kebocoran porsi atau pemborosan bahan saat peracikan di dapur cabang.</li>
                  </ul>
                </div>

                {/* 6. SIGNATURES */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, textAlign: 'center', marginTop: 10, pageBreakInside: 'avoid' }}>
                  <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>Dianalisis Oleh:</div>
                    <div style={{ height: 44 }} />
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#0f172a' }}>{currentUser?.name || 'Head Chef / R&D'}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>F&B Costing Specialist</div>
                  </div>

                  <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>Diverifikasi Oleh:</div>
                    <div style={{ height: 44 }} />
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#0f172a' }}>Finance & Accounting</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>Financial Controller</div>
                  </div>

                  <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>Disahkan Oleh:</div>
                    <div style={{ height: 44 }} />
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#0f172a' }}>Mitra Pemilik / Investor</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>Managing Partner / Owner</div>
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
