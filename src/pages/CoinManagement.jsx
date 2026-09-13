import { useState, useEffect } from 'react';
import {
  Coins, Plus, Search, Shield, Building2, Store, ArrowUpRight, ArrowDownLeft,
  Calendar, CheckCircle2, AlertTriangle, XCircle, Clock, Edit3, RefreshCw,
  TrendingUp, CreditCard, Banknote, FileText, Check, X, AlertCircle, Gift
} from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';
import { PageHeader, LoadingState, rupiah, num, formatDateTime } from '../components/ui';
import { useOutlet } from '../context/OutletContext';

export default function CoinManagement() {
  const { isSuperadminPlatform, refreshCoins } = useOutlet();
  const [dataOverview, setDataOverview] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('tenants'); // 'tenants' | 'history'

  // Filter & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'LOW' | 'OUT' | 'SAFE'
  const [historyBusinessFilter, setHistoryBusinessFilter] = useState('');

  // Modals
  const [topUpModal, setTopUpModal] = useState({
    open: false,
    business: null,
    coins: 100,
    paymentAmount: '',
    paymentReference: '',
    notes: '',
    submitting: false,
  });

  const [rateModal, setRateModal] = useState({
    open: false,
    business: null,
    coinsPerTx: 1,
    submitting: false,
  });

  useEffect(() => {
    fetchOverview();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, historyBusinessFilter]);

  async function fetchOverview() {
    setLoading(true);
    try {
      const res = await api.get('/platform/coins/overview');
      setDataOverview(res.data);
    } catch (err) {
      toast.error('Gagal memuat ringkasan koin platform');
    } finally {
      setLoading(false);
    }
  }

  async function fetchHistory() {
    setLoadingHistory(true);
    try {
      const params = historyBusinessFilter ? { business_id: historyBusinessFilter } : {};
      const res = await api.get('/platform/coins/history', { params });
      setHistoryList(res.data);
    } catch (err) {
      toast.error('Gagal memuat riwayat mutasi koin');
    } finally {
      setLoadingHistory(false);
    }
  }

  // Open Top Up Modal
  function handleOpenTopUp(business) {
    setTopUpModal({
      open: true,
      business,
      coins: 100,
      paymentAmount: '',
      paymentReference: '',
      notes: `Top-up koin untuk ${business.name}`,
      submitting: false,
    });
  }

  // Submit Top Up
  async function handleSubmitTopUp(e) {
    e.preventDefault();
    const { business, coins, paymentAmount, paymentReference, notes } = topUpModal;
    if (!business || !coins || Number(coins) <= 0) {
      toast.error('Jumlah koin harus lebih besar dari 0.');
      return;
    }

    setTopUpModal(p => ({ ...p, submitting: true }));
    try {
      await api.post('/platform/coins/topup', {
        business_id: business.id,
        coins: Number(coins),
        amount_coins: Number(coins),
        payment_amount: paymentAmount ? Number(paymentAmount) : undefined,
        payment_reference: paymentReference || undefined,
        notes: notes || undefined,
      });

      toast.success(`Berhasil menambahkan +${num(coins)} koin ke ${business.name}!`);
      setTopUpModal({ open: false, business: null, coins: 100, paymentAmount: '', paymentReference: '', notes: '', submitting: false });
      fetchOverview();
      if (activeTab === 'history') fetchHistory();
      refreshCoins();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memproses top up koin.');
      setTopUpModal(p => ({ ...p, submitting: false }));
    }
  }

  // Open Rate Modal
  function handleOpenRateModal(business) {
    setRateModal({
      open: true,
      business,
      coinsPerTx: business.coins_per_transaction || 1,
      submitting: false,
    });
  }

  // Submit Rate Update
  async function handleSubmitRate(e) {
    e.preventDefault();
    const { business, coinsPerTx } = rateModal;
    if (!business || Number(coinsPerTx) < 0) {
      toast.error('Tarif koin per nota tidak boleh negatif.');
      return;
    }

    setRateModal(p => ({ ...p, submitting: true }));
    try {
      await api.put('/platform/coins/rate', {
        business_id: business.id,
        coins_per_transaction: Number(coinsPerTx),
      });

      toast.success(`Tarif transaksi untuk ${business.name} diubah menjadi ${coinsPerTx} koin / nota!`);
      setRateModal({ open: false, business: null, coinsPerTx: 1, submitting: false });
      fetchOverview();
      refreshCoins();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengubah tarif koin.');
      setRateModal(p => ({ ...p, submitting: false }));
    }
  }

  if (!isSuperadminPlatform) {
    return (
      <div className="page-container">
        <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <Shield size={48} style={{ color: '#ef4444', margin: '0 auto 16px' }} />
          <h3>Akses Terbatas</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Halaman ini khusus untuk Pemilik Website (Superadmin Platform) guna mengelola koin penyewa.</p>
        </div>
      </div>
    );
  }

  const businesses = dataOverview?.businesses || [];
  const metrics = dataOverview?.metrics || {
    total_businesses: 0,
    total_coins_in_circulation: 0,
    businesses_low_coins: 0,
    businesses_out_of_coins: 0,
  };

  // Filtered Businesses
  const filteredBusinesses = businesses.filter(b => {
    const matchSearch =
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.owner_name && b.owner_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (b.slug && b.slug.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (b.referral_code_used && b.referral_code_used.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (b.referred_by?.name && b.referred_by.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (b.referred_by?.referral_code && b.referred_by.referral_code.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchSearch) return false;

    if (statusFilter === 'LOW') return b.is_coin_low && !b.is_coin_out;
    if (statusFilter === 'OUT') return b.is_coin_out;
    if (statusFilter === 'SAFE') return !b.is_coin_low && !b.is_coin_out;

    return true;
  });

  return (
    <div className="page-container">
      {/* Header */}
      <PageHeader
        title="Top Up & Manajemen Koin Platform"
        subtitle="Kelola saldo koin transaksi per perusahaan (tenant), tarif pemotongan nota, dan riwayat mutasi pembayaran."
        badgeText="SaaS Billing"
        badgeIcon={Coins}
        rightContent={
          <button
            onClick={() => {
              fetchOverview();
              if (activeTab === 'history') fetchHistory();
            }}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Segarkan
          </button>
        }
      />

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16, borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(139, 92, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa' }}>
            <Coins size={26} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Total Koin Beredar
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', marginTop: 4 }}>
              🪙 {num(metrics.total_coins_in_circulation)}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16, borderLeft: '4px solid #3b82f6' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
            <Building2 size={26} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Total Perusahaan
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', marginTop: 4 }}>
              {metrics.total_businesses} Bisnis
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16, borderLeft: '4px solid #f59e0b' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24' }}>
            <AlertTriangle size={26} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Koin Kritis (&le; 20 Nota)
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>
              {metrics.businesses_low_coins} Bisnis
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16, borderLeft: '4px solid #ef4444' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>
            <XCircle size={26} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Koin Habis (0 Nota)
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#ef4444', marginTop: 4 }}>
              {metrics.businesses_out_of_coins} Bisnis
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid rgba(165, 180, 252, 0.15)', marginBottom: 20 }}>
        <button
          className={`btn btn-ghost ${activeTab === 'tenants' ? 'active' : ''}`}
          onClick={() => setActiveTab('tenants')}
          style={{
            padding: '10px 18px',
            borderBottom: activeTab === 'tenants' ? '2px solid var(--accent-bright)' : '2px solid transparent',
            borderRadius: '8px 8px 0 0',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: activeTab === 'tenants' ? 'var(--accent-bright)' : 'var(--text-secondary)',
          }}
        >
          <Building2 size={16} />
          Saldo Koin Perusahaan ({businesses.length})
        </button>
        <button
          className={`btn btn-ghost ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
          style={{
            padding: '10px 18px',
            borderBottom: activeTab === 'history' ? '2px solid var(--accent-bright)' : '2px solid transparent',
            borderRadius: '8px 8px 0 0',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: activeTab === 'history' ? 'var(--accent-bright)' : 'var(--text-secondary)',
          }}
        >
          <Clock size={16} />
          Riwayat Mutasi & Top Up
        </button>
      </div>

      {/* TAB 1: TENANTS LIST */}
      {activeTab === 'tenants' && (
        <>
          {/* Controls Bar */}
          <div className="card" style={{ padding: 14, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 260 }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  placeholder="Cari perusahaan atau nama pemilik..."
                  className="form-control"
                  style={{ paddingLeft: 36 }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <select
                className="form-control"
                style={{ maxWidth: 180 }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Semua Status</option>
                <option value="SAFE">🟢 Saldo Aman (&gt; 20)</option>
                <option value="LOW">🟡 Koin Kritis (&le; 20)</option>
                <option value="OUT">🔴 Koin Habis (0)</option>
              </select>
            </div>

            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Menampilkan <strong>{filteredBusinesses.length}</strong> dari {businesses.length} perusahaan
            </div>
          </div>

          {loading ? (
            <LoadingState message="Memuat data koin perusahaan..." />
          ) : filteredBusinesses.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <Coins size={36} style={{ color: 'var(--text-secondary)', margin: '0 auto 12px' }} />
              <h4>Tidak ada data perusahaan yang cocok</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Coba ubah kata kunci pencarian atau filter status koin.</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-responsive">
                <table className="table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 20 }}>Perusahaan / Tenant</th>
                      <th>Pemilik & Kontak</th>
                      <th style={{ textAlign: 'center' }}>Cabang</th>
                      <th style={{ textAlign: 'right' }}>Saldo Koin</th>
                      <th style={{ textAlign: 'center' }}>Tarif per Nota</th>
                      <th style={{ textAlign: 'center' }}>Sisa Transaksi</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                      <th style={{ textAlign: 'right', paddingRight: 20 }}>Aksi Pemilik Website</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBusinesses.map((b) => (
                      <tr key={b.id} style={{ verticalAlign: 'middle' }}>
                        <td style={{ paddingLeft: 20 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: 10,
                              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.2))',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--accent-bright)'
                            }}>
                              {b.name?.[0]?.toUpperCase() || 'B'}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: '#ffffff', fontSize: 14 }}>{b.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>ID #{b.id} • /{b.slug}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>{b.owner_name || '-'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{b.phone || b.email || 'Tanpa Kontak'}</div>
                          {b.referred_by ? (
                            <div style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 4, background: 'rgba(236, 72, 153, 0.12)', border: '1px solid rgba(236, 72, 153, 0.25)', fontSize: 11, color: '#f472b6' }}>
                              <Gift size={11} />
                              <span>Ref: <strong>{b.referred_by.name}</strong> ({b.referral_code_used || b.referred_by.referral_code})</span>
                            </div>
                          ) : b.referral_code_used ? (
                            <div style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 4, background: 'rgba(236, 72, 153, 0.12)', border: '1px solid rgba(236, 72, 153, 0.25)', fontSize: 11, color: '#f472b6' }}>
                              <Gift size={11} />
                              <span>Ref: <strong>{b.referral_code_used}</strong></span>
                            </div>
                          ) : null}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)',
                            fontSize: 12, fontWeight: 600
                          }}>
                            <Store size={12} />
                            {b.outlets_count ?? 1} Cabang
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{
                            fontSize: 16, fontWeight: 800,
                            color: b.is_coin_out ? '#ef4444' : b.is_coin_low ? '#f59e0b' : '#34d399',
                            display: 'inline-flex', alignItems: 'center', gap: 4
                          }}>
                            🪙 {num(b.coin_balance)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            fontSize: 12, fontWeight: 700,
                            padding: '4px 10px', borderRadius: 8,
                            background: 'rgba(139, 92, 246, 0.15)', color: '#c4b5fd', border: '1px solid rgba(139, 92, 246, 0.3)'
                          }}>
                            {num(b.coins_per_transaction)} koin / nota
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            fontSize: 14, fontWeight: 700,
                            color: b.is_coin_out ? '#ef4444' : b.is_coin_low ? '#f59e0b' : '#ffffff'
                          }}>
                            ~{num(b.remaining_transactions)} Nota
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {b.is_coin_out ? (
                            <span style={{
                              padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                              background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)'
                            }}>
                              🔴 Saldo Habis
                            </span>
                          ) : b.is_coin_low ? (
                            <span style={{
                              padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                              background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)'
                            }}>
                              🟡 Kritis (&le; 20)
                            </span>
                          ) : (
                            <span style={{
                              padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                              background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)'
                            }}>
                              🟢 Aman
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', paddingRight: 20 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                            <button
                              onClick={() => handleOpenTopUp(b)}
                              className="btn btn-primary btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                            >
                              <Plus size={14} />
                              Top Up Koin
                            </button>
                            <button
                              onClick={() => handleOpenRateModal(b)}
                              className="btn btn-ghost btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              title="Atur tarif koin per transaksi"
                            >
                              <Edit3 size={14} />
                              Tarif
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: AUDIT LOGS */}
      {activeTab === 'history' && (
        <>
          <div className="card" style={{ padding: 14, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>Filter Perusahaan:</span>
              <select
                className="form-control"
                style={{ minWidth: 220 }}
                value={historyBusinessFilter}
                onChange={(e) => setHistoryBusinessFilter(e.target.value)}
              >
                <option value="">Semua Perusahaan</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={fetchHistory}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={14} className={loadingHistory ? 'animate-spin' : ''} />
              Segarkan Log
            </button>
          </div>

          {loadingHistory ? (
            <LoadingState message="Memuat mutasi koin..." />
          ) : historyList.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <Clock size={36} style={{ color: 'var(--text-secondary)', margin: '0 auto 12px' }} />
              <h4>Belum ada riwayat mutasi koin</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Mutasi akan otomatis tercatat saat top up koin atau setiap nota transaksi kasir selesai.</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-responsive">
                <table className="table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 20 }}>Waktu</th>
                      <th>Perusahaan / Tenant</th>
                      <th style={{ textAlign: 'center' }}>Tipe Mutasi</th>
                      <th style={{ textAlign: 'right' }}>Perubahan</th>
                      <th style={{ textAlign: 'right' }}>Saldo (Awal &rarr; Akhir)</th>
                      <th>Referensi / Nota</th>
                      <th>Catatan & Operator</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyList.map((h) => (
                      <tr key={h.id}>
                        <td style={{ paddingLeft: 20, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {formatDateTime(h.created_at)}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: '#ffffff', fontSize: 13 }}>{h.business?.name || 'Perusahaan'}</div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {h.type === 'TOPUP' ? (
                            <span style={{
                              padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                              background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)'
                            }}>
                              TOP UP
                            </span>
                          ) : h.type === 'USAGE' ? (
                            <span style={{
                              padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                              background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)'
                            }}>
                              NOTA KASIR
                            </span>
                          ) : (
                            <span style={{
                              padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                              background: 'rgba(139, 92, 246, 0.15)', color: '#c4b5fd'
                            }}>
                              {h.type}
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>
                          <span style={{ color: Number(h.amount) > 0 ? '#34d399' : '#ef4444' }}>
                            {Number(h.amount) > 0 ? `+${num(h.amount)}` : num(h.amount)} Koin
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontSize: 13 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{num(h.balance_before)}</span>
                          <span style={{ margin: '0 6px', color: 'var(--text-muted)' }}>&rarr;</span>
                          <strong style={{ color: '#ffffff' }}>{num(h.balance_after)}</strong>
                        </td>
                        <td>
                          {h.order_number ? (
                            <span style={{
                              fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: 'var(--accent-bright)'
                            }}>
                              {h.order_number}
                            </span>
                          ) : h.payment_reference ? (
                            <span style={{ fontSize: 12, color: '#34d399', fontWeight: 600 }}>
                              Ref: {h.payment_reference}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>-</span>
                          )}
                          {h.payment_amount && Number(h.payment_amount) > 0 && (
                            <div style={{ fontSize: 11, color: '#34d399' }}>
                              ({rupiah(h.payment_amount)})
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{h.notes || '-'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Oleh: {h.creator?.name || 'Sistem'}
                            {h.outlet?.name ? ` • Cabang: ${h.outlet.name}` : ''}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL 1: TOP UP KOIN */}
      {topUpModal.open && topUpModal.business && (
        <div className="modal-backdrop">
          <div className="modal card" style={{ maxWidth: 520, width: '100%', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(139, 92, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa' }}>
                  <Coins size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Top Up Koin Transaksi</h3>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                    Untuk <strong>{topUpModal.business.name}</strong> (Milik {topUpModal.business.owner_name || 'Owner'})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTopUpModal(p => ({ ...p, open: false }))}
                className="btn btn-ghost btn-icon btn-sm"
              >
                <X size={18} />
              </button>
            </div>

            {/* Current Balance Notice */}
            <div style={{
              background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.25)',
              borderRadius: 12, padding: 14, marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Saldo Koin Saat Ini</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#c4b5fd' }}>
                  🪙 {num(topUpModal.business.coin_balance)} Koin
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Tarif per Nota</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>
                  {num(topUpModal.business.coins_per_transaction)} koin / nota
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmitTopUp}>
              {/* Preset Buttons */}
              <div style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Pilihan Cepat Jumlah Koin</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                  {[50, 100, 250, 500, 1000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTopUpModal(p => ({ ...p, coins: amt }))}
                      className={`btn btn-sm ${topUpModal.coins === amt ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: 12, fontWeight: 700 }}
                    >
                      +{amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Jumlah Koin */}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Jumlah Koin yang Ditambahkan <span style={{ color: '#ef4444' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    className="form-control"
                    style={{ fontSize: 16, fontWeight: 700, color: '#34d399' }}
                    value={topUpModal.coins}
                    onChange={(e) => setTopUpModal(p => ({ ...p, coins: e.target.value }))}
                  />
                  <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: 13 }}>
                    Koin
                  </span>
                </div>
              </div>

              {/* Nominal Pembayaran Uang Pribadi */}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">
                  Nominal Pembayaran Diterima (Rp) <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>(Transfer Pribadi dari Owner)</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 700 }}>
                    Rp
                  </span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Contoh: 250000"
                    className="form-control"
                    style={{ paddingLeft: 42 }}
                    value={topUpModal.paymentAmount}
                    onChange={(e) => setTopUpModal(p => ({ ...p, paymentAmount: e.target.value }))}
                  />
                </div>
              </div>

              {/* Bukti Transfer / Referensi */}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Referensi / Bukti Transfer</label>
                <input
                  type="text"
                  placeholder="Contoh: Transfer Bank BCA ref 9821 a.n. Owner"
                  className="form-control"
                  value={topUpModal.paymentReference}
                  onChange={(e) => setTopUpModal(p => ({ ...p, paymentReference: e.target.value }))}
                />
              </div>

              {/* Catatan */}
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Catatan Tambahan</label>
                <input
                  type="text"
                  placeholder="Catatan top-up untuk pencatatan internal"
                  className="form-control"
                  value={topUpModal.notes}
                  onChange={(e) => setTopUpModal(p => ({ ...p, notes: e.target.value }))}
                />
              </div>

              {/* New Projected Balance */}
              <div style={{
                background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: 10, padding: 12, marginBottom: 20, fontSize: 13, display: 'flex', justifyContent: 'space-between'
              }}>
                <span style={{ color: 'var(--text-secondary)' }}>Saldo Baru Setelah Top Up:</span>
                <strong style={{ color: '#34d399' }}>
                  🪙 {num(Number(topUpModal.business.coin_balance || 0) + Number(topUpModal.coins || 0))} Koin
                  {' '} (~{Math.floor((Number(topUpModal.business.coin_balance || 0) + Number(topUpModal.coins || 0)) / (Number(topUpModal.business.coins_per_transaction) || 1))} Nota)
                </strong>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setTopUpModal(p => ({ ...p, open: false }))}
                  className="btn btn-secondary"
                  disabled={topUpModal.submitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={topUpModal.submitting || !topUpModal.coins || Number(topUpModal.coins) <= 0}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}
                >
                  <Plus size={16} />
                  {topUpModal.submitting ? 'Memproses...' : 'Konfirmasi Top Up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ATUR TARIF KOIN */}
      {rateModal.open && rateModal.business && (
        <div className="modal-backdrop">
          <div className="modal card" style={{ maxWidth: 460, width: '100%', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                  <Edit3 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Atur Tarif Koin per Nota</h3>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                    Untuk <strong>{rateModal.business.name}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRateModal(p => ({ ...p, open: false }))}
                className="btn btn-ghost btn-icon btn-sm"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitRate}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Jumlah Koin Terpotong per 1 Nota Selesai</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    required
                    className="form-control"
                    style={{ fontSize: 16, fontWeight: 700 }}
                    value={rateModal.coinsPerTx}
                    onChange={(e) => setRateModal(p => ({ ...p, coinsPerTx: e.target.value }))}
                  />
                  <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: 13 }}>
                    Koin / Nota
                  </span>
                </div>
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6
              }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <AlertCircle size={16} style={{ color: 'var(--accent-bright)', flexShrink: 0, marginTop: 2 }} />
                  <div>
                    Setiap transaksi kasir berstatus <strong>PAID</strong> (baik pesanan langsung atau pelunasan tagihan terbuka / open bill) di seluruh cabang perusahaan ini akan memotong koin sejumlah tarif di atas secara otomatis.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setRateModal(p => ({ ...p, open: false }))}
                  className="btn btn-secondary"
                  disabled={rateModal.submitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={rateModal.submitting || Number(rateModal.coinsPerTx) < 0}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}
                >
                  <Check size={16} />
                  {rateModal.submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
