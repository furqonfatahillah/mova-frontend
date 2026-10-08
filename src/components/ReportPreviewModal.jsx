import { useState, useMemo } from 'react';
import {
  X,
  FileSpreadsheet,
  Printer,
  Search,
  Maximize2,
  Minimize2,
  Sparkles,
  Building2,
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
  FileText,
  Download,
  Eye,
} from 'lucide-react';
import { rupiah, num, pct } from './ui';

/**
 * Universal Report Preview & Export Modal
 * 
 * Provides an interactive, publication-ready on-screen preview of any report
 * with executive letterhead, KPI summaries, multi-sheet tabs, live in-modal search,
 * and direct one-click Download Excel (.xlsx) or Print PDF.
 */
export default function ReportPreviewModal({
  isOpen,
  onClose,
  title = 'Pratinjau Laporan',
  reportTitle = 'LAPORAN RESMI',
  businessName = 'MOVA POS',
  outletName = 'Semua Cabang',
  periodText = '',
  kpis = [],
  sheets = [], // Array of { id, name, columns: [{ key, label, align, format, width }], data: [], subtotals: [], totals: [] }
  onExportExcel,
  onPrint,
  exporting = false,
}) {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Normalize sheets: if sheets is empty or single sheet passed via simpler props
  const currentSheets = useMemo(() => {
    if (Array.isArray(sheets) && sheets.length > 0) {
      return sheets;
    }
    return [
      {
        id: 'main',
        name: 'Lembar Utama',
        columns: [],
        data: [],
      }
    ];
  }, [sheets]);

  const activeSheet = currentSheets[activeSheetIndex] || currentSheets[0];

  // Filtered rows based on in-modal search
  const filteredRows = useMemo(() => {
    if (!activeSheet?.data || !Array.isArray(activeSheet.data)) return [];
    if (!searchTerm.trim()) return activeSheet.data;

    const term = searchTerm.toLowerCase();
    return activeSheet.data.filter(row => {
      if (Array.isArray(row)) {
        return row.some(val => val !== null && val !== undefined && String(val).toLowerCase().includes(term));
      }
      return Object.values(row).some(val => val !== null && val !== undefined && String(val).toLowerCase().includes(term));
    });
  }, [activeSheet, searchTerm]);

  if (!isOpen) return null;

  // Format cell value helper
  const formatCell = (val, fmt) => {
    if (val === null || val === undefined || val === '') return '-';
    if (fmt === 'currency' || fmt === 'rupiah') {
      return typeof val === 'number' ? rupiah(val) : val;
    }
    if (fmt === 'percent') {
      return typeof val === 'number' ? `${(val * (val <= 1 ? 100 : 1)).toFixed(2)}%` : val;
    }
    if (fmt === 'number') {
      return typeof val === 'number' ? val.toLocaleString('id-ID') : val;
    }
    if (fmt === 'decimal') {
      return typeof val === 'number' ? val.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : val;
    }
    return String(val);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isFullscreen ? 0 : 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: isFullscreen ? 0 : 16,
          width: isFullscreen ? '100vw' : '95vw',
          maxWidth: isFullscreen ? '100vw' : '1400px',
          height: isFullscreen ? '100vh' : '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(30, 41, 59, 0.95)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
              }}
            >
              <Eye size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                {title}
              </h3>
              <p style={{ margin: 0, fontSize: 11.5, color: '#94a3b8' }}>
                Pratinjau tata letak resmi sebelum diunduh ke Excel (.xlsx) atau dicetak ke PDF
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {onExportExcel && (
              <button
                className="btn btn-sm"
                onClick={onExportExcel}
                disabled={exporting}
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  color: '#ffffff',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                  padding: '7px 14px',
                }}
              >
                <FileSpreadsheet size={15} />
                <span>{exporting ? 'Mengekspor...' : 'Unduh Excel (.xlsx)'}</span>
              </button>
            )}

            {onPrint && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={onPrint}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: '#38bdf8',
                  borderColor: 'rgba(56, 189, 248, 0.4)',
                  background: 'rgba(56, 189, 248, 0.08)',
                  padding: '7px 12px',
                }}
              >
                <Printer size={15} />
                <span>Cetak / PDF</span>
              </button>
            )}

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="btn btn-secondary btn-sm"
              title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
              style={{ padding: '7px 9px', color: '#94a3b8' }}
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>

            <button
              onClick={onClose}
              className="btn btn-secondary btn-sm"
              title="Tutup Pratinjau"
              style={{ padding: '7px 9px', color: '#f43f5e' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* CONTROLS BAR: Multi-Sheet Switcher & Search */}
        <div
          style={{
            padding: '10px 20px',
            background: 'rgba(15, 23, 42, 0.7)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {/* Multi-sheet Tabs */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            {currentSheets.map((sheet, idx) => (
              <button
                key={sheet.id || idx}
                onClick={() => {
                  setActiveSheetIndex(idx);
                  setSearchTerm('');
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: activeSheetIndex === idx ? 700 : 500,
                  color: activeSheetIndex === idx ? '#38bdf8' : '#94a3b8',
                  background: activeSheetIndex === idx ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                  border: activeSheetIndex === idx ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Layers size={13} />
                <span>{sheet.name || `Lembar ${idx + 1}`}</span>
                {Array.isArray(sheet.data) && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: '1px 6px',
                      borderRadius: 10,
                      background: activeSheetIndex === idx ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                      color: activeSheetIndex === idx ? '#e0f2fe' : '#94a3b8',
                    }}
                  >
                    {sheet.data.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Quick Search */}
          <div style={{ position: 'relative', width: 260 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#64748b',
              }}
            />
            <input
              type="text"
              placeholder="Cari dalam pratinjau..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px 6px 30px',
                fontSize: 12,
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#f8fafc',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* DOCUMENT PREVIEW WORKSPACE */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'auto',
            padding: 24,
            background: 'rgba(0, 0, 0, 0.25)',
          }}
        >
          {/* Paper Container Simulation */}
          <div
            style={{
              maxWidth: 1200,
              margin: '0 auto',
              background: '#ffffff',
              color: '#0f172a',
              borderRadius: 12,
              padding: '32px 36px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
              minHeight: '100%',
            }}
          >
            {/* 1. DOCUMENT LETTERHEAD / HEADER */}
            <div
              style={{
                borderBottom: '2.5px solid #0f172a',
                paddingBottom: 14,
                marginBottom: 20,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
                    {businessName}
                  </h1>
                  <h2 style={{ margin: '4px 0 0 0', fontSize: 14, fontWeight: 700, color: '#1e40af' }}>
                    {reportTitle}
                  </h2>
                </div>
                <div style={{ textAlign: 'right', fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>
                  <div><strong>Cabang:</strong> {outletName}</div>
                  <div><strong>Periode:</strong> {periodText || 'Semua Periode'}</div>
                  <div><strong>Dicetak:</strong> {new Date().toLocaleString('id-ID')}</div>
                </div>
              </div>
            </div>

            {/* 2. KPI METRICS CARDS (IF ANY) */}
            {kpis && kpis.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`,
                  gap: 12,
                  marginBottom: 22,
                }}
              >
                {kpis.map((kpi, kIdx) => (
                  <div
                    key={kIdx}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      padding: '10px 14px',
                      borderLeft: `4px solid ${kpi.color || '#3b82f6'}`,
                    }}
                  >
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                      {kpi.label}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: kpi.color || '#0f172a', marginTop: 2 }}>
                      {kpi.isCurrency
                        ? rupiah(kpi.value)
                        : kpi.isPercent
                        ? `${(kpi.value || 0).toFixed(2)}%`
                        : kpi.value ?? '-'}
                    </div>
                    {kpi.sublabel && (
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                        {kpi.sublabel}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 3. TABLE DATA */}
            {activeSheet?.columns && activeSheet.columns.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 11.5,
                  }}
                >
                  <thead>
                    <tr style={{ background: '#1e293b', color: '#ffffff' }}>
                      {activeSheet.columns.map((col, cIdx) => (
                        <th
                          key={col.key || cIdx}
                          style={{
                            padding: '10px 12px',
                            textAlign: col.align || (col.format === 'currency' || col.format === 'number' ? 'right' : 'left'),
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: '0.2px',
                            width: col.width || 'auto',
                            border: '1px solid #334155',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length > 0 ? (
                      filteredRows.map((row, rIdx) => {
                        // Section header row check
                        if (row.isSectionHeader) {
                          return (
                            <tr key={rIdx} style={{ background: '#e2e8f0', fontWeight: 'bold' }}>
                              <td
                                colSpan={activeSheet.columns.length}
                                style={{
                                  padding: '8px 12px',
                                  color: '#0f172a',
                                  fontSize: 12,
                                  border: '1px solid #cbd5e1',
                                }}
                              >
                                {row.label || row.title}
                              </td>
                            </tr>
                          );
                        }

                        const isEven = rIdx % 2 === 1;
                        return (
                          <tr
                            key={rIdx}
                            style={{
                              background: isEven ? '#f8fafc' : '#ffffff',
                              transition: 'background 0.1s',
                            }}
                          >
                            {activeSheet.columns.map((col, cIdx) => {
                              const rawVal = Array.isArray(row) ? row[cIdx] : row[col.key];
                              const align = col.align || (col.format === 'currency' || col.format === 'number' ? 'right' : 'left');

                              return (
                                <td
                                  key={col.key || cIdx}
                                  style={{
                                    padding: '7px 12px',
                                    textAlign: align,
                                    border: '1px solid #e2e8f0',
                                    color: '#1e293b',
                                    fontFamily: col.format === 'currency' || col.format === 'number' || col.isCode ? 'monospace' : 'inherit',
                                    fontWeight: col.isBold || row.isBold ? 700 : 'normal',
                                  }}
                                >
                                  {col.render ? col.render(rawVal, row) : formatCell(rawVal, col.format)}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={activeSheet.columns.length}
                          style={{
                            padding: 30,
                            textAlign: 'center',
                            color: '#64748b',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          {searchTerm ? `Tidak ditemukan baris yang cocok dengan "${searchTerm}"` : 'Tidak ada data untuk ditampilkan'}
                        </td>
                      </tr>
                    )}
                  </tbody>

                  {/* 4. TOTAL SUMMARY FOOTER */}
                  {activeSheet.totals && activeSheet.totals.length > 0 && (
                    <tfoot>
                      <tr
                        style={{
                          background: '#f1f5f9',
                          fontWeight: 'bold',
                          borderTop: '2px solid #94a3b8',
                          borderBottom: '3px double #0f172a',
                        }}
                      >
                        {activeSheet.totals.map((tot, tIdx) => {
                          const align = tot.align || (typeof tot.value === 'number' ? 'right' : 'left');
                          return (
                            <td
                              key={tIdx}
                              colSpan={tot.colSpan || 1}
                              style={{
                                padding: '9px 12px',
                                textAlign: align,
                                border: '1px solid #cbd5e1',
                                fontSize: 11.5,
                                color: '#0f172a',
                                fontFamily: tot.format === 'currency' ? 'monospace' : 'inherit',
                              }}
                            >
                              {formatCell(tot.value, tot.format)}
                            </td>
                          );
                        })}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                Format pratinjau belum dikonfigurasi untuk lembar ini.
              </div>
            )}

            {/* Document Footnote */}
            <div
              style={{
                marginTop: 28,
                paddingTop: 12,
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 10,
                color: '#94a3b8',
              }}
            >
              <div>Dokumen Resmi Sistem POS & Akuntansi Otomatis MOVA</div>
              <div>Halaman 1 / 1</div>
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div
          style={{
            padding: '12px 20px',
            background: 'rgba(15, 23, 42, 0.95)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            Menampilkan <strong style={{ color: '#f8fafc' }}>{filteredRows.length}</strong> baris data pada <em>{activeSheet.name}</em>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              style={{ color: '#cbd5e1' }}
            >
              Tutup Pratinjau
            </button>

            {onExportExcel && (
              <button
                className="btn btn-primary btn-sm"
                onClick={onExportExcel}
                disabled={exporting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  border: 'none',
                }}
              >
                <Download size={14} />
                <span>{exporting ? 'Mengekspor...' : 'Ekspor Excel Sekarang'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
