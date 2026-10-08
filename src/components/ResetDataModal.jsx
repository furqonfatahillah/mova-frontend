import { useState, useEffect } from 'react';
import {
  RotateCcw, AlertTriangle, ShieldCheck, Trash2, X, Check,
  Layers, ShoppingCart, Clock, Package, UtensilsCrossed, Users, Store, Loader2, Sparkles, AlertOctagon
} from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';

export default function ResetDataModal({ isOpen, onClose, onSuccess }) {
  const [mode, setMode] = useState('all'); // 'all' | 'transactions_only'
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingStats, setFetchingStats] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setConfirmText('');
      fetchStats();
    }
  }, [isOpen]);

  async function fetchStats() {
    setFetchingStats(true);
    try {
      const res = await api.get('/system/reset-preview', { skipCache: true, skipDedupe: true });
      if (res.data?.success) {
        setStats(res.data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch reset preview stats:', err);
    } finally {
      setFetchingStats(false);
    }
  }

  async function handleExecuteReset() {
    if (confirmText.trim().toUpperCase() !== 'RESET') {
      toast.error('Ketik kata "RESET" untuk mengonfirmasi tindakan pembersihan.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/system/reset-data', { mode });
      if (res.data?.success) {
        toast.success(res.data.message || 'Data berhasil di-reset!');
        api.invalidateCache();
        onClose();
        if (onSuccess) {
          onSuccess(res.data);
        } else {
          setTimeout(() => {
            window.location.reload();
          }, 600);
        }
      } else {
        toast.error(res.data?.message || 'Gagal mereset data');
      }
    } catch (err) {
      console.error('Reset error:', err);
      toast.error(err.response?.data?.message || 'Terjadi kesalahan saat memproses reset data');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  const isConfirmed = confirmText.trim().toUpperCase() === 'RESET';

  return (
    <div
      className="modal-backdrop fade-in"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(4, 7, 18, 0.88)',
        backdropFilter: 'blur(14px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="card modal-content"
        style={{
          maxWidth: '680px',
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '24px',
          borderRadius: '20px',
          background: '#0e1326',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(239, 68, 68, 0.15)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
                flexShrink: 0,
              }}
            >
              <RotateCcw size={22} className={loading ? 'spin' : ''} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Reset Database Testing
                </h3>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: 'rgba(245, 158, 11, 0.2)',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    color: '#fbbf24',
                    letterSpacing: '0.05em',
                  }}
                >
                  FITUR SEMENTARA
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, margin: 0 }}>
                Pembersihan data untuk pengujian aplikasi POS. Akun Pengguna & Cabang Outlet dijamin 100% AMAN.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            disabled={loading}
            style={{ color: 'var(--text-secondary)', padding: 6 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Safety Guarantee Highlight Box */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(16, 185, 129, 0.05))',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: 12,
            padding: '12px 16px',
            marginBottom: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={22} style={{ color: '#4ade80', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#4ade80' }}>
                Proteksi Akun & Cabang Terjamin
              </div>
              <div style={{ fontSize: 11.5, color: '#bbf7d0', marginTop: 1 }}>
                Data tabel <strong>users</strong>, <strong>outlets</strong>, dan <strong>businesses</strong> TIDAK akan dihapus.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 6,
                background: 'rgba(34, 197, 94, 0.2)',
                color: '#4ade80',
                border: '1px solid rgba(34, 197, 94, 0.35)',
              }}
            >
              👤 {stats?.users_count ?? '...'} Users
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 6,
                background: 'rgba(34, 197, 94, 0.2)',
                color: '#4ade80',
                border: '1px solid rgba(34, 197, 94, 0.35)',
              }}
            >
              🏢 {stats?.outlets_count ?? '...'} Cabang
            </span>
          </div>
        </div>

        {/* Mode Selector */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>
            PILIH JANGKAUAN PEMBERSIHAN DATA:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 10 }}>
            {/* Mode 1: Full Reset */}
            <div
              onClick={() => !loading && setMode('all')}
              style={{
                padding: '14px',
                borderRadius: 12,
                cursor: loading ? 'not-allowed' : 'pointer',
                background: mode === 'all' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                border: `2px solid ${mode === 'all' ? '#ef4444' : 'var(--border)'}`,
                transition: 'all 0.2s ease',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: mode === 'all' ? '#f87171' : '#ffffff', fontWeight: 800, fontSize: 13 }}>
                  <Trash2 size={16} />
                  <span>Reset Semua Data</span>
                </div>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: mode === 'all' ? '#ef4444' : 'rgba(255, 255, 255, 0.1)',
                    color: '#ffffff',
                  }}
                >
                  REKOMENDASI
                </span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                Hapus seluruh transaksi, shift, log stok, OPEX, hutang/piutang, <strong>master menu, resep, dan bahan baku</strong>. Kembali ke kondisi awal bersih.
              </p>
            </div>

            {/* Mode 2: Transactions Only */}
            <div
              onClick={() => !loading && setMode('transactions_only')}
              style={{
                padding: '14px',
                borderRadius: 12,
                cursor: loading ? 'not-allowed' : 'pointer',
                background: mode === 'transactions_only' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                border: `2px solid ${mode === 'transactions_only' ? '#f59e0b' : 'var(--border)'}`,
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: mode === 'transactions_only' ? '#fbbf24' : '#ffffff', fontWeight: 800, fontSize: 13 }}>
                  <ShoppingCart size={16} />
                  <span>Transaksi & Mutasi Saja</span>
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                Hapus transaksi POS, shift, kartu stok, opname, transfer, & OPEX. <strong>Master Menu, Resep, dan Bahan Baku tetap dipertahankan</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Live Data Summary to be Cleared */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: 12,
            border: '1px solid var(--border)',
            padding: '12px 14px',
            marginBottom: 18,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)' }}>
              RINGKASAN DATA YANG AKAN DIBERSIHKAN:
            </span>
            {fetchingStats && (
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Loader2 size={12} className="spin" /> Memuat data...
              </span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 8, fontSize: 11.5 }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '6px 10px', borderRadius: 8 }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: 10.5 }}>Penjualan & POS</div>
              <div style={{ fontWeight: 800, color: '#f87171', fontSize: 13 }}>
                {stats?.transactions_count ?? 0} Transaksi
              </div>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '6px 10px', borderRadius: 8 }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: 10.5 }}>Shift Kasir</div>
              <div style={{ fontWeight: 800, color: '#f87171', fontSize: 13 }}>
                {stats?.shifts_count ?? 0} Shift
              </div>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '6px 10px', borderRadius: 8 }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: 10.5 }}>Mutasi Stok & Opname</div>
              <div style={{ fontWeight: 800, color: '#f87171', fontSize: 13 }}>
                {(stats?.stock_movements_count ?? 0) + (stats?.opnames_count ?? 0)} Data
              </div>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '6px 10px', borderRadius: 8 }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: 10.5 }}>Master Menu & Resep</div>
              <div style={{ fontWeight: 800, color: mode === 'all' ? '#f87171' : '#4ade80', fontSize: 13 }}>
                {mode === 'all' ? `${stats?.menus_count ?? 0} Menu (Dihapus)` : `${stats?.menus_count ?? 0} Menu (Aman)`}
              </div>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '6px 10px', borderRadius: 8 }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: 10.5 }}>Master Bahan Baku</div>
              <div style={{ fontWeight: 800, color: mode === 'all' ? '#f87171' : '#4ade80', fontSize: 13 }}>
                {mode === 'all' ? `${stats?.ingredients_count ?? 0} Bahan (Dihapus)` : `${stats?.ingredients_count ?? 0} Bahan (Aman)`}
              </div>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '6px 10px', borderRadius: 8 }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: 10.5 }}>Keuangan & OPEX</div>
              <div style={{ fontWeight: 800, color: '#f87171', fontSize: 13 }}>
                {(stats?.expenses_count ?? 0) + (stats?.receivables_count ?? 0) + (stats?.payables_count ?? 0)} Transaksi
              </div>
            </div>
          </div>
        </div>

        {/* Confirmation Input */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <AlertOctagon size={14} />
            Ketik kata <span style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.15)', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>RESET</span> untuk konfirmasi:
          </label>
          <input
            type="text"
            className="form-control"
            placeholder="Ketik RESET di sini..."
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={loading}
            style={{
              borderColor: isConfirmed ? '#22c55e' : 'rgba(239, 68, 68, 0.4)',
              background: 'rgba(0, 0, 0, 0.4)',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.08em',
            }}
          />
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={loading}
            style={{ fontWeight: 600, padding: '8px 18px' }}
          >
            Batalkan
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleExecuteReset}
            disabled={!isConfirmed || loading}
            style={{
              background: isConfirmed
                ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                : 'rgba(239, 68, 68, 0.3)',
              color: '#ffffff',
              borderColor: '#ef4444',
              fontWeight: 800,
              padding: '8px 22px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: isConfirmed && !loading ? 'pointer' : 'not-allowed',
              boxShadow: isConfirmed ? '0 4px 16px rgba(239, 68, 68, 0.4)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="spin" />
                <span>Sedang Membersihkan...</span>
              </>
            ) : (
              <>
                <Trash2 size={16} />
                <span>Eksekusi Reset Data</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
