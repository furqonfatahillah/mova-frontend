import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  FileSpreadsheet,
  ExternalLink,
  Info,
  TrendingUp,
  Wallet,
  CreditCard,
  Scale,
  Receipt,
  Package,
  Layers,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Building2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { rupiah, LoadingState } from './ui';
import { exportBalanceSheetDetailToExcel } from '../utils/exportReport';
import toast from 'react-hot-toast';

export default function BalanceSheetDetailModal({
  isOpen,
  onClose,
  accountCode,
  accountName,
  period,
  outletId,
  outletName = 'Semua Cabang (Konsolidasi)',
  businessName = 'MOVA POS',
}) {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [detailData, setDetailData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!isOpen || !accountCode) return;

    let isMounted = true;
    setLoading(true);
    setSearchTerm('');

    const fetchDetail = async () => {
      try {
        const params = {
          account_code: accountCode,
          account_name: accountName || '',
          from: period?.from,
          to: period?.to,
        };
        if (outletId && outletId !== 'ALL' && outletId !== 'all') {
          params.outlet_id = outletId;
        }

        const res = await api.get('/reports/balance-sheet/detail', { params });
        if (isMounted) {
          setDetailData(res.data);
        }
      } catch (err) {
        console.error('Gagal mengambil detail akun neraca:', err);
        if (isMounted) {
          toast.error('Gagal memuat detail akun neraca');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchDetail();

    return () => {
      isMounted = false;
    };
  }, [isOpen, accountCode, accountName, period?.from, period?.to, outletId]);

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!detailData?.items) return [];
    if (!searchTerm.trim()) return detailData.items;

    const term = searchTerm.toLowerCase();
    return detailData.items.filter((item) => {
      return Object.values(item).some((val) => {
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(term);
      });
    });
  }, [detailData?.items, searchTerm]);

  // Total of filtered items if there is an amount column
  const totalFilteredAmount = useMemo(() => {
    if (!filteredItems.length) return 0;
    return filteredItems.reduce((sum, item) => {
      const val = Number(item.amount ?? item.total_value ?? item.remaining_amount ?? 0);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [filteredItems]);

  if (!isOpen) return null;

  // Header icon & color based on account type
  const getTheme = () => {
    const code = accountCode || '';
    if (code.startsWith('1-')) {
      return {
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.12)',
        border: 'rgba(16, 185, 129, 0.3)',
        badge: 'ASET LANCAR',
        icon: <Wallet size={20} color="#10b981" />,
      };
    }
    if (code.startsWith('2-')) {
      return {
        color: '#f43f5e',
        bg: 'rgba(244, 63, 94, 0.12)',
        border: 'rgba(244, 63, 94, 0.3)',
        badge: 'LIABILITAS (HUTANG)',
        icon: <CreditCard size={20} color="#f43f5e" />,
      };
    }
    if (code.startsWith('3-')) {
      return {
        color: '#38bdf8',
        bg: 'rgba(56, 189, 248, 0.12)',
        border: 'rgba(56, 189, 248, 0.3)',
        badge: 'MODAL & EKUITAS',
        icon: <TrendingUp size={20} color="#38bdf8" />,
      };
    }
    return {
      color: '#a78bfa',
      bg: 'rgba(167, 139, 250, 0.12)',
      border: 'rgba(167, 139, 250, 0.3)',
      badge: 'RINGKASAN AUDIT',
      icon: <Scale size={20} color="#a78bfa" />,
    };
  };

  const theme = getTheme();

  const handleExport = async () => {
    if (!detailData) return;
    setExporting(true);
    try {
      await exportBalanceSheetDetailToExcel({
        detailData: {
          ...detailData,
          items: filteredItems,
        },
        period,
        outletName,
        businessName,
      });
      toast.success('Rincian berhasil diekspor ke Excel!');
    } catch (err) {
      console.error('Export detail error:', err);
      toast.error('Gagal mengekspor data ke Excel');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="modal-backdrop fade-in"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(10, 14, 26, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-card card"
        style={{
          width: '95%',
          maxWidth: '1060px',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          borderRadius: '18px',
          background: 'var(--surface, #13192f)',
          border: `1px solid ${theme.border}`,
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8)',
          overflow: 'hidden',
        }}
      >
        {/* MODAL HEADER */}
        <div
          className="modal-header"
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(165, 180, 252, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(15, 20, 41, 0.75)',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: theme.bg,
                border: `1px solid ${theme.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {theme.icon}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: theme.bg,
                    color: theme.color,
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  {theme.badge}
                </span>
                {detailData?.account_code && !detailData.account_code.includes('TOTAL') && (
                  <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    [{detailData.account_code}]
                  </span>
                )}
              </div>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: '#ffffff',
                  margin: '4px 0 0 0',
                }}
              >
                {detailData?.account_name || accountName || 'Rincian Akun Neraca'}
              </h3>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="hide-mobile" style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Periode: {period?.from} s/d {period?.to}
              </div>
              <div style={{ fontSize: 11, color: 'var(--accent-bright)', fontWeight: 600 }}>
                {outletName}
              </div>
            </div>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-icon"
              style={{
                borderRadius: 8,
                color: 'var(--text-secondary)',
                width: 34,
                height: 34,
              }}
              title="Tutup (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div
          className="modal-body"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {loading ? (
            <div style={{ padding: '60px 0' }}>
              <LoadingState message="Memuat audit trail & rincian data neraca..." />
            </div>
          ) : !detailData ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: 'var(--text-secondary)',
              }}
            >
              <AlertCircle size={36} color="var(--warning)" style={{ margin: '0 auto 10px' }} />
              <div>Tidak ada rincian data yang ditemukan untuk akun ini.</div>
            </div>
          ) : (
            <>
              {/* 1. TOP HIGHLIGHT CARD: TOTAL VALUE & EXPLANATION */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(20, 26, 52, 0.9) 0%, rgba(15, 20, 41, 0.95) 100%)',
                  border: `1px solid ${theme.border}`,
                  borderRadius: 12,
                  padding: '12px 18px',
                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                    marginBottom: 8,
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Total Nilai di Neraca:
                    </span>
                    <div
                      className="mono"
                      style={{
                        fontSize: 24,
                        fontWeight: 800,
                        color: theme.color,
                        margin: '1px 0 0 0',
                      }}
                    >
                      {rupiah(detailData.amount || 0)}
                    </div>
                  </div>

                  {detailData.formula && (
                    <div
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(165, 180, 252, 0.12)',
                        borderRadius: 8,
                        padding: '6px 12px',
                        maxWidth: '520px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: '#fbbf24',
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                        }}
                      >
                        Rumus Akuntansi:
                      </span>
                      <div
                        className="mono"
                        style={{
                          fontSize: 11,
                          color: 'var(--text-primary)',
                          marginTop: 2,
                          lineHeight: 1.35,
                        }}
                      >
                        {detailData.formula}
                      </div>
                    </div>
                  )}
                </div>

                {/* Explanation text */}
                <div
                  style={{
                    fontSize: 12,
                    lineHeight: 1.5,
                    color: '#cbd5e1',
                    borderTop: '1px solid rgba(165, 180, 252, 0.08)',
                    paddingTop: 8,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                  }}
                >
                  <Info size={15} color={theme.color} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong style={{ color: '#ffffff' }}>Sumber Nilai: </strong>
                    {detailData.explanation}
                  </div>
                </div>
              </div>

              {/* 2. FORMULA COMPONENTS (KPI CARDS) */}
              {detailData.components && detailData.components.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: 6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Layers size={13} color="var(--accent-bright)" />
                    Komponen Pembentuk Nilai:
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(auto-fit, minmax(130px, 1fr))`,
                      gap: 8,
                    }}
                  >
                    {detailData.components.map((comp, idx) => {
                      const compColor =
                        comp.type === 'success'
                          ? '#10b981'
                          : comp.type === 'danger'
                          ? '#f43f5e'
                          : comp.type === 'warning'
                          ? '#f59e0b'
                          : comp.type === 'primary'
                          ? theme.color
                          : '#a78bfa';

                      const formatVal = (v) => {
                        if (comp.format === 'number') return Number(v).toLocaleString('id-ID');
                        if (comp.format === 'string') return String(v);
                        return rupiah(v);
                      };

                      return (
                        <div
                          key={idx}
                          style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(165, 180, 252, 0.08)',
                            borderRadius: 8,
                            padding: '6px 10px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div
                            style={{
                              fontSize: 10,
                              color: 'var(--text-secondary)',
                              fontWeight: 600,
                              marginBottom: 2,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={`${comp.prefix ? comp.prefix + ' ' : ''}${comp.label}`}
                          >
                            {comp.prefix ? `${comp.prefix} ` : ''}
                            {comp.label}
                          </div>
                          <div
                            className="mono"
                            style={{
                              fontSize: 13,
                              fontWeight: 800,
                              color: compColor,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatVal(comp.value)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. DETAILED TABLE LIST */}
              {detailData.columns && detailData.columns.length > 0 && (
                <div
                  style={{
                    background: 'rgba(15, 20, 41, 0.5)',
                    border: '1px solid rgba(165, 180, 252, 0.12)',
                    borderRadius: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    minHeight: '280px',
                    overflow: 'hidden',
                  }}
                >
                  {/* Table Control Bar */}
                  <div
                    style={{
                      padding: '8px 14px',
                      borderBottom: '1px solid rgba(165, 180, 252, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(165, 180, 252, 0.12)',
                        borderRadius: 8,
                        padding: '4px 10px',
                        width: '100%',
                        maxWidth: '280px',
                      }}
                    >
                      <Search size={14} color="var(--text-muted)" />
                      <input
                        type="text"
                        placeholder="Cari rincian data..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ffffff',
                          fontSize: 12,
                          outline: 'none',
                          width: '100%',
                        }}
                      />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm('')}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        Menampilkan <strong>{filteredItems.length}</strong> dari{' '}
                        {detailData.items?.length || 0} data
                      </span>

                      <button
                        onClick={handleExport}
                        disabled={exporting || !filteredItems.length}
                        className="btn btn-secondary btn-sm"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 11.5,
                          padding: '5px 10px',
                        }}
                      >
                        <FileSpreadsheet size={13} color="#10b981" />
                        {exporting ? 'Mengekspor...' : 'Ekspor Excel'}
                      </button>
                    </div>
                  </div>

                  {/* Scrollable Table */}
                  <div
                    style={{
                      flex: 1,
                      minHeight: '220px',
                      maxHeight: '440px',
                      overflowY: 'auto',
                      overflowX: 'auto',
                    }}
                  >
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: 12,
                      }}
                    >
                      <thead
                        style={{
                          position: 'sticky',
                          top: 0,
                          background: '#151c36',
                          zIndex: 2,
                          boxShadow: '0 1px 0 rgba(165, 180, 252, 0.1)',
                        }}
                      >
                        <tr>
                          <th
                            style={{
                              padding: '8px 10px',
                              textAlign: 'center',
                              width: 38,
                              color: 'var(--text-muted)',
                              fontSize: 11,
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            #
                          </th>
                          {detailData.columns.map((col, idx) => (
                            <th
                              key={idx}
                              style={{
                                padding: '8px 12px',
                                textAlign: col.align || 'left',
                                color: 'var(--text-secondary)',
                                fontSize: 11,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredItems.length === 0 ? (
                          <tr>
                            <td
                              colSpan={detailData.columns.length + 1}
                              style={{
                                textAlign: 'center',
                                padding: '36px 10px',
                                color: 'var(--text-muted)',
                              }}
                            >
                              {searchTerm
                                ? 'Tidak ada data yang cocok dengan pencarian'
                                : 'Belum ada data rincian untuk pos ini'}
                            </td>
                          </tr>
                        ) : (
                          filteredItems.map((item, rowIdx) => (
                            <tr
                              key={rowIdx}
                              style={{
                                borderBottom: '1px solid rgba(165, 180, 252, 0.05)',
                                background:
                                  rowIdx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)',
                                transition: 'background 0.12s ease',
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)')
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.background =
                                  rowIdx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)')
                              }
                            >
                              <td
                                style={{
                                  padding: '9px 8px',
                                  verticalAlign: 'top',
                                  textAlign: 'center',
                                  color: 'var(--text-muted)',
                                  fontSize: 11,
                                }}
                              >
                                {rowIdx + 1}
                              </td>
                              {detailData.columns.map((col, colIdx) => {
                                const val = item[col.key];

                                // Format rendering
                                let rendered = val !== undefined && val !== null ? String(val) : '-';

                                if (col.format === 'rupiah') {
                                  const numVal = Number(val) || 0;
                                  rendered = (
                                    <span
                                      className="mono"
                                      style={{
                                        fontWeight: 700,
                                        fontSize: 12,
                                        color:
                                          numVal < 0
                                            ? '#f43f5e'
                                            : numVal > 0
                                            ? '#10b981'
                                            : 'var(--text-muted)',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {rupiah(numVal)}
                                    </span>
                                  );
                                } else if (col.format === 'number') {
                                  rendered = (
                                    <span className="mono" style={{ fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap' }}>
                                      {Number(val || 0).toLocaleString('id-ID')}
                                    </span>
                                  );
                                } else if (col.key === 'ref_no' || col.key === 'order_number') {
                                  rendered = (
                                    <span
                                      className="mono"
                                      style={{
                                        fontSize: 11.5,
                                        fontWeight: 700,
                                        color: '#38bdf8',
                                        background: 'rgba(56, 189, 248, 0.08)',
                                        padding: '2px 6px',
                                        borderRadius: 4,
                                        border: '1px solid rgba(56, 189, 248, 0.2)',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {val}
                                    </span>
                                  );
                                } else if (col.key === 'direction') {
                                  const isMasuk = String(val).toUpperCase() === 'MASUK';
                                  rendered = (
                                    <span
                                      style={{
                                        fontSize: 10,
                                        fontWeight: 800,
                                        padding: '2px 6px',
                                        borderRadius: 4,
                                        background: isMasuk
                                          ? 'rgba(16, 185, 129, 0.15)'
                                          : 'rgba(244, 63, 94, 0.15)',
                                        color: isMasuk ? '#10b981' : '#f43f5e',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {val}
                                    </span>
                                  );
                                } else if (col.key === 'status_label' || col.key === 'status') {
                                  const str = String(val).toUpperCase();
                                  const isOk = str.includes('LUNAS') || str === 'PAID' || str === 'OK';
                                  const isPartial = str.includes('SEBAGIAN') || str === 'PARTIAL';
                                  rendered = (
                                    <span
                                      style={{
                                        fontSize: 10,
                                        fontWeight: 800,
                                        padding: '2px 6px',
                                        borderRadius: 4,
                                        background: isOk
                                          ? 'rgba(16, 185, 129, 0.15)'
                                          : isPartial
                                          ? 'rgba(245, 158, 11, 0.15)'
                                          : 'rgba(244, 63, 94, 0.15)',
                                        color: isOk ? '#10b981' : isPartial ? '#f59e0b' : '#f43f5e',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {val}
                                    </span>
                                  );
                                } else if (col.key === 'date') {
                                  rendered = (
                                    <span style={{ fontSize: 11.5, color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                                      {val}
                                    </span>
                                  );
                                } else if (col.key === 'user_name' || col.key === 'cashier') {
                                  rendered = (
                                    <span style={{ fontSize: 11.5, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                      {val}
                                    </span>
                                  );
                                } else if (col.key === 'category') {
                                  rendered = (
                                    <span style={{ fontSize: 11.5, fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap' }}>
                                      {val}
                                    </span>
                                  );
                                } else if (col.key === 'description' || col.key === 'keterangan') {
                                  rendered = (
                                    <span style={{ fontSize: 12, color: '#f1f5f9' }}>
                                      {val}
                                    </span>
                                  );
                                }

                                return (
                                  <td
                                    key={colIdx}
                                    style={{
                                      padding: '9px 12px',
                                      verticalAlign: 'top',
                                      textAlign: col.align || 'left',
                                      color:
                                        col.align === 'right' ? '#ffffff' : 'var(--text-secondary)',
                                      lineHeight: '1.45',
                                    }}
                                  >
                                    {rendered}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        )}
                      </tbody>

                      {/* Footer Subtotal */}
                      {filteredItems.length > 0 && totalFilteredAmount > 0 && (
                        <tfoot
                          style={{
                            borderTop: '2px solid rgba(165, 180, 252, 0.15)',
                            background: 'rgba(255, 255, 255, 0.02)',
                            fontWeight: 700,
                          }}
                        >
                          <tr>
                            <td colSpan={detailData.columns.length} style={{ padding: '9px 12px', textAlign: 'right' }}>
                              Subtotal Rincian Terfilter:
                            </td>
                            <td
                              style={{
                                padding: '9px 12px',
                                textAlign: 'right',
                                color: theme.color,
                              }}
                            >
                              <span className="mono" style={{ fontSize: 13, fontWeight: 800 }}>
                                {rupiah(totalFilteredAmount)}
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid rgba(165, 180, 252, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(15, 20, 41, 0.75)',
            gap: 12,
          }}
        >
          <div>
            {detailData?.action_link && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  onClose();
                  navigate(detailData.action_link);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  color: 'var(--accent-bright)',
                  borderColor: 'rgba(99, 102, 241, 0.4)',
                }}
              >
                <ExternalLink size={13} />
                {detailData.action_label || 'Buka Modul Terkait'}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
