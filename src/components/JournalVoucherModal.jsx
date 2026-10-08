import { useState, useEffect } from 'react';
import {
  X,
  Printer,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Calendar,
  Store,
  User,
  Tag,
  FileText,
  Copy,
  ExternalLink,
} from 'lucide-react';
import api from '../api/client';
import { rupiah, LoadingState } from './ui';
import toast from 'react-hot-toast';

export default function JournalVoucherModal({ isOpen, onClose, journalId, entryNo }) {
  const [loading, setLoading] = useState(true);
  const [voucher, setVoucher] = useState(null);

  useEffect(() => {
    if (!isOpen || (!journalId && !entryNo)) return;

    let isMounted = true;
    setLoading(true);

    const target = journalId || entryNo;
    api
      .get(`/accounting/journal-entries/${target}`)
      .then((res) => {
        if (isMounted) {
          setVoucher(res.data);
        }
      })
      .catch((err) => {
        console.error('Gagal memuat bukti jurnal:', err);
        if (isMounted) {
          toast.error('Bukti jurnal tidak ditemukan');
          onClose();
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, journalId, entryNo]);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (!voucher) return;
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    const fmt = (n) =>
      new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);

    const linesHtml = (voucher.lines || [])
      .map(
        (l, i) => `
        <tr>
          <td style="padding: 6px 8px; text-align:center;">${i + 1}</td>
          <td style="padding: 6px 8px; font-family:monospace; font-weight:bold;">${l.account_code}</td>
          <td style="padding: 6px 8px;">${l.account_name}</td>
          <td style="padding: 6px 8px; font-weight:600; color:#4338ca;">${l.outlet_name || voucher.outlet_name || '-'}</td>
          <td style="padding: 6px 8px; color:#555;">${l.memo || '-'}</td>
          <td style="padding: 6px 8px; text-align:right; font-family:monospace;">${l.debit > 0 ? fmt(l.debit) : '-'}</td>
          <td style="padding: 6px 8px; text-align:right; font-family:monospace;">${l.credit > 0 ? fmt(l.credit) : '-'}</td>
        </tr>
      `
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bukti Jurnal ${voucher.entry_no}</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #111; }
            .header { border-bottom: 2px solid #222; padding-bottom: 10px; margin-bottom: 12px; }
            .title { font-size: 16px; font-weight: bold; text-transform: uppercase; }
            .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; font-size: 11.5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #f0f0f0; border: 1px solid #ccc; padding: 6px 8px; text-align: left; font-size: 11px; }
            td { border: 1px solid #ccc; font-size: 11px; }
            .footer-box { margin-top: 20px; display: flex; justify-content: space-between; font-size: 11px; }
            .sign-box { text-align: center; width: 140px; margin-top: 40px; border-top: 1px solid #000; padding-top: 4px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">BUKTI JURNAL MEMORIAL (JOURNAL VOUCHER)</div>
            <div>No. Bukti: <strong>${voucher.entry_no}</strong></div>
          </div>
          <div class="meta">
            <div><strong>Tanggal:</strong> ${voucher.entry_date}</div>
            <div><strong>Cabang Entri:</strong> ${voucher.outlet_name}</div>
            <div><strong>Tipe Dokumen:</strong> ${voucher.entry_type}</div>
            <div><strong>Dibuat Oleh:</strong> ${voucher.creator_name}</div>
            <div style="grid-column: span 2;"><strong>Keterangan / Alur:</strong> ${voucher.description || '-'}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width:30px; text-align:center;">#</th>
                <th style="width:90px;">KODE AKUN</th>
                <th>NAMA AKUN</th>
                <th style="width:140px;">CABANG / UNIT</th>
                <th>MEMO / RINCIAN</th>
                <th style="width:110px; text-align:right;">DEBIT</th>
                <th style="width:110px; text-align:right;">KREDIT</th>
              </tr>
            </thead>
            <tbody>
              ${linesHtml}
            </tbody>
            <tfoot>
              <tr style="font-weight:bold; background:#fafafa;">
                <td colspan="5" style="padding:6px 8px; text-align:right;">TOTAL</td>
                <td style="padding:6px 8px; text-align:right; font-family:monospace;">${fmt(voucher.total_debit)}</td>
                <td style="padding:6px 8px; text-align:right; font-family:monospace;">${fmt(voucher.total_credit)}</td>
              </tr>
            </tfoot>
          </table>
          <div style="margin-top:10px; font-weight:bold; font-size:11px; color:${voucher.is_balanced ? 'green' : 'red'};">
            STATUS: ${voucher.is_balanced ? 'SEIMBANG (DEBIT = KREDIT)' : 'TIDAK SEIMBANG'}
          </div>
          <div class="footer-box" style="margin-top: 40px;">
            <div class="sign-box">Dibuat Oleh (${voucher.creator_name})</div>
            <div class="sign-box">Diperiksa / Akuntan</div>
            <div class="sign-box">Disetujui / Manager</div>
          </div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const copyVoucherNo = () => {
    if (voucher?.entry_no) {
      navigator.clipboard.writeText(voucher.entry_no);
      toast.success(`No. Bukti Jurnal ${voucher.entry_no} disalin!`);
    }
  };

  const getBranchBadgeStyle = (branchName) => {
    const s = String(branchName || '').toLowerCase();
    if (s.includes('utama') || s.includes('pusat')) {
      return {
        bg: 'rgba(139, 92, 246, 0.15)',
        color: '#c4b5fd',
        border: 'rgba(139, 92, 246, 0.35)',
        icon: '🏢',
      };
    }
    if (s.includes('hertasning')) {
      return {
        bg: 'rgba(56, 189, 248, 0.15)',
        color: '#38bdf8',
        border: 'rgba(56, 189, 248, 0.35)',
        icon: '🏪',
      };
    }
    return {
      bg: 'rgba(16, 185, 129, 0.15)',
      color: '#34d399',
      border: 'rgba(16, 185, 129, 0.35)',
      icon: '📍',
    };
  };

  return (
    <div
      className="modal-backdrop fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-card card modal-lg"
        style={{
          width: '95%',
          maxWidth: '1200px',
          '--modal-max-w': '1200px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          borderRadius: '18px',
          background: 'var(--surface, #13192f)',
          border: '1px solid rgba(139, 92, 246, 0.35)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.85)',
          overflow: 'hidden',
        }}
      >
        {/* MODAL HEADER */}
        <div
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
                background: 'rgba(139, 92, 246, 0.15)',
                border: '1px solid rgba(139, 92, 246, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#a78bfa',
                flexShrink: 0,
              }}
            >
              <BookOpen size={20} />
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
                    background: 'rgba(139, 92, 246, 0.2)',
                    color: '#c4b5fd',
                    border: '1px solid rgba(139, 92, 246, 0.35)',
                  }}
                >
                  BUKTI JURNAL BERPASANGAN
                </span>
                {voucher?.is_balanced ? (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <CheckCircle2 size={12} /> SEIMBANG (BALANCE)
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#f87171',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <AlertCircle size={12} /> SELISIH
                  </span>
                )}
              </div>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: '#ffffff',
                  margin: '4px 0 0 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>{voucher?.entry_no || 'Memuat Bukti Jurnal...'}</span>
                {voucher?.entry_no && (
                  <button
                    onClick={copyVoucherNo}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 2,
                    }}
                    title="Salin No. Bukti"
                  >
                    <Copy size={13} />
                  </button>
                )}
              </h3>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handlePrint}
              disabled={loading || !voucher}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: '#38bdf8',
                borderColor: 'rgba(56, 189, 248, 0.35)',
              }}
            >
              <Printer size={14} />
              <span>Cetak Voucher</span>
            </button>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-icon"
              style={{ borderRadius: 8, color: 'var(--text-secondary)' }}
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
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {loading ? (
            <div style={{ padding: '40px 0' }}>
              <LoadingState message="Memuat detail bukti jurnal double-entry..." />
            </div>
          ) : !voucher ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              Bukti jurnal tidak dapat ditampilkan.
            </div>
          ) : (
            <>
              {/* Metadata Info Card */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(165, 180, 252, 0.1)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 12,
                }}
              >
                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Calendar size={13} style={{ color: '#38bdf8' }} /> Tanggal Jurnal (Entry Date):
                  </span>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#38bdf8', marginTop: 3 }}>
                    {(() => {
                      if (!voucher.entry_date) return '-';
                      try {
                        const d = new Date(voucher.entry_date);
                        if (isNaN(d.getTime())) return voucher.entry_date;
                        return d.toLocaleDateString('id-ID', {
                          weekday: 'long',
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        });
                      } catch (e) {
                        return voucher.entry_date;
                      }
                    })()}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                    {String(voucher.entry_date || '').slice(0, 10)}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Tag size={13} /> Tipe Modul:
                  </span>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8', marginTop: 2 }}>
                    {voucher.entry_type} {voucher.reference_type ? `(${voucher.reference_type})` : ''}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Store size={13} /> Cabang / Outlet:
                  </span>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981', marginTop: 2 }}>
                    {voucher.outlet_name}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <User size={13} /> Petugas / Sistem:
                  </span>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', marginTop: 2 }}>
                    {voucher.creator_name}
                  </div>
                </div>

                <div style={{ gridColumn: '1 / -1', borderTop: '1px solid rgba(165, 180, 252, 0.06)', paddingTop: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <FileText size={13} /> Keterangan Transaksi:
                  </span>
                  <div style={{ fontSize: 12.5, color: '#e2e8f0', marginTop: 2, lineHeight: 1.4 }}>
                    {voucher.description || '-'}
                  </div>
                </div>
              </div>

              {/* Double-Entry Journal Lines Table */}
              <div
                style={{
                  background: 'rgba(15, 20, 41, 0.5)',
                  border: '1px solid rgba(165, 180, 252, 0.12)',
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid rgba(165, 180, 252, 0.1)',
                    background: 'rgba(139, 92, 246, 0.08)',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#c4b5fd',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>DAFTAR POS JURNAL (DEBIT & KREDIT)</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{voucher.lines?.length || 0} Baris Akun</span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: '#151c36', color: 'var(--text-secondary)', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px', width: 36, textAlign: 'center' }}>#</th>
                        <th style={{ padding: '8px 12px', width: 100 }}>KODE AKUN</th>
                        <th style={{ padding: '8px 12px' }}>NAMA AKUN</th>
                        <th style={{ padding: '8px 12px', width: 160 }}>CABANG / OUTLET</th>
                        <th style={{ padding: '8px 12px' }}>MEMO / RINCIAN</th>
                        <th style={{ padding: '8px 12px', width: 130, textAlign: 'right' }}>DEBIT (Rp)</th>
                        <th style={{ padding: '8px 12px', width: 130, textAlign: 'right' }}>KREDIT (Rp)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(voucher.lines || []).map((line, idx) => {
                        const isDebit = line.debit > 0;
                        const bBadge = getBranchBadgeStyle(line.outlet_name || voucher.outlet_name || 'Cabang Utama');
                        return (
                          <tr
                            key={line.id || idx}
                            style={{
                              borderBottom: '1px solid rgba(165, 180, 252, 0.05)',
                              background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)',
                            }}
                          >
                            <td style={{ padding: '10px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
                              {idx + 1}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span
                                className="mono"
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: line.account_code?.startsWith('1')
                                    ? '#10b981'
                                    : line.account_code?.startsWith('2')
                                    ? '#f43f5e'
                                    : line.account_code?.startsWith('3')
                                    ? '#38bdf8'
                                    : line.account_code?.startsWith('4')
                                    ? '#a78bfa'
                                    : '#fbbf24',
                                }}
                              >
                                {line.account_code}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ color: '#ffffff', fontWeight: 600, paddingLeft: isDebit ? 0 : 16 }}>
                                {!isDebit && <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>↳</span>}
                                {line.account_name}
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: 5,
                                  background: bBadge.bg,
                                  color: bBadge.color,
                                  border: `1px solid ${bBadge.border}`,
                                  whiteSpace: 'nowrap',
                                  display: 'inline-block',
                                }}
                              >
                                {bBadge.icon} {line.outlet_name || voucher.outlet_name || 'Cabang Utama'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', color: '#cbd5e1', fontSize: 12 }}>
                              {line.memo || '-'}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                              <span className="mono" style={{ fontWeight: 700, color: line.debit > 0 ? '#10b981' : 'var(--text-muted)' }}>
                                {line.debit > 0 ? rupiah(line.debit) : '-'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                              <span className="mono" style={{ fontWeight: 700, color: line.credit > 0 ? '#38bdf8' : 'var(--text-muted)' }}>
                                {line.credit > 0 ? rupiah(line.credit) : '-'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr
                        style={{
                          background: 'rgba(255, 255, 255, 0.04)',
                          borderTop: '2px solid rgba(165, 180, 252, 0.2)',
                          fontWeight: 800,
                        }}
                      >
                        <td colSpan={5} style={{ padding: '12px 14px', textAlign: 'right', color: '#ffffff', letterSpacing: '0.04em' }}>
                          TOTAL MUTASI VOUCHER:
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <span className="mono" style={{ fontSize: 14, color: '#10b981', fontWeight: 800 }}>
                            {rupiah(voucher.total_debit || 0)}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <span className="mono" style={{ fontSize: 14, color: '#38bdf8', fontWeight: 800 }}>
                            {rupiah(voucher.total_credit || 0)}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Balancing verification footer box */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: voucher.is_balanced ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                  border: `1px solid ${voucher.is_balanced ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {voucher.is_balanced ? (
                    <CheckCircle2 size={18} color="#10b981" />
                  ) : (
                    <AlertCircle size={18} color="#f87171" />
                  )}
                  <span style={{ fontSize: 12.5, color: '#ffffff' }}>
                    {voucher.is_balanced
                      ? 'Validasi Akuntansi: Jurnal berpasangan seimbang (Debit = Kredit).'
                      : `Perhatian: Terdapat selisih pembukuan sebesar ${rupiah(voucher.difference || 0)}.`}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  ID Ref: {voucher.reference_id || '-'}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
