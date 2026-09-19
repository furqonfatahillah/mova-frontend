import { useState, useEffect, useMemo } from 'react';
import {
  Coins, Plus, Search, Shield, Building2, Store, ArrowUpRight, ArrowDownLeft,
  Calendar, CheckCircle2, AlertTriangle, XCircle, Clock, Edit3, RefreshCw,
  TrendingUp, CreditCard, Banknote, FileText, Check, X, AlertCircle, Gift,
  User, Eye, ChevronRight, Layers, ListFilter
} from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';
import { PageHeader, LoadingState, rupiah, num, formatDateTime, PeriodPicker } from '../components/ui';
import { getMonthStartStr, getTodayStr } from '../utils/date';
import { useOutlet } from '../context/OutletContext';

/**
 * Format string date (YYYY-MM-DD) into Indonesian readable date.
 */
function formatDateIndo(dateStr) {
  if (!dateStr || dateStr === 'Lainnya') return dateStr || '-';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
}

/**
 * Group raw mutations array by date (YYYY-MM-DD extracted from created_at).
 * Calculates daily usage count/amount, top up count/amount, and net balance movement.
 */
function groupMutationsByDate(mutations) {
  if (!Array.isArray(mutations) || mutations.length === 0) return [];

  const groupsMap = {};

  for (const m of mutations) {
    const dateKey = (m.created_at || '').substring(0, 10) || 'Lainnya';
    if (!groupsMap[dateKey]) {
      groupsMap[dateKey] = {
        date: dateKey,
        items: [],
        totalChange: 0,
        usageCount: 0,
        usageAmount: 0,
        topUpCount: 0,
        topUpAmount: 0,
        otherCount: 0,
        startBalance: null,
        endBalance: null,
      };
    }
    groupsMap[dateKey].items.push(m);
  }

  // Sort groups by date descending
  const sortedGroups = Object.values(groupsMap).sort((a, b) => b.date.localeCompare(a.date));

  for (const g of sortedGroups) {
    let sumAmount = 0;
    let uCount = 0;
    let uAmt = 0;
    let tCount = 0;
    let tAmt = 0;
    let oCount = 0;

    // Items are ordered by created_at desc (latest is index 0, earliest is last index)
    const latestItem = g.items[0];
    const earliestItem = g.items[g.items.length - 1];

    g.endBalance = latestItem?.balance_after ?? 0;
    g.startBalance = earliestItem?.balance_before ?? 0;

    for (const item of g.items) {
      const amt = Number(item.amount) || 0;
      sumAmount += amt;
      if (item.type === 'USAGE') {
        uCount++;
        uAmt += Math.abs(amt);
      } else if (item.type === 'TOPUP') {
        tCount++;
        tAmt += amt;
      } else {
        oCount++;
      }
    }

    g.totalChange = sumAmount;
    g.usageCount = uCount;
    g.usageAmount = uAmt;
    g.topUpCount = tCount;
    g.topUpAmount = tAmt;
    g.otherCount = oCount;
  }

  return sortedGroups;
}

export default function CoinManagement() {
  const { isSuperadminPlatform, isOwnerWebsite, refreshCoins } = useOutlet();
  const isPlatformAdmin = isSuperadminPlatform || isOwnerWebsite;

  // --- STATE HOOKS (Always top level) ---
  const [dataOverview, setDataOverview] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('tenants'); // 'tenants' | 'history'

  // Filter & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'LOW' | 'OUT' | 'SAFE'
  const [historyBusinessFilter, setHistoryBusinessFilter] = useState('');
  const [adminViewMode, setAdminViewMode] = useState('grouped'); // 'grouped' | 'flat'
  const [historyPeriod, setHistoryPeriod] = useState(() => ({
    from: getMonthStartStr(),
    to: getTodayStr(),
  }));

  // Modals
  const [topUpModal, setTopUpModal] = useState({
    open: false,
    business: null,
    coins: 10000,
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

  const [detailDateModal, setDetailDateModal] = useState({
    open: false,
    group: null,
  });

  const [myCoinsData, setMyCoinsData] = useState(null);
  const [loadingMyCoins, setLoadingMyCoins] = useState(true);

  // --- EFFECT HOOKS (Always top level) ---
  useEffect(() => {
    if (isPlatformAdmin) {
      fetchOverview();
    } else {
      fetchMyCoins();
    }
  }, [isPlatformAdmin]);

  useEffect(() => {
    if (isPlatformAdmin && activeTab === 'history') {
      fetchHistory();
    }
  }, [isPlatformAdmin, activeTab, historyBusinessFilter, historyPeriod]);

  // --- MEMO HOOKS (Always top level, NEVER inside if statements) ---
  const filteredTenantMutations = useMemo(() => {
    const raw = myCoinsData?.recent_mutations || [];
    if (!historyPeriod.from && !historyPeriod.to) return raw;
    return raw.filter(m => {
      const d = (m.created_at || '').substring(0, 10);
      if (historyPeriod.from && d < historyPeriod.from) return false;
      if (historyPeriod.to && d > historyPeriod.to) return false;
      return true;
    });
  }, [myCoinsData, historyPeriod]);
  const mutations = filteredTenantMutations;
  const groupedMutations = useMemo(() => groupMutationsByDate(mutations), [mutations]);

  const safeHistoryList = useMemo(() => {
    return Array.isArray(historyList) ? historyList : (historyList?.data || []);
  }, [historyList]);

  const groupedAdminHistory = useMemo(() => groupMutationsByDate(safeHistoryList), [safeHistoryList]);

  const businesses = useMemo(() => dataOverview?.businesses || [], [dataOverview]);
  const metrics = useMemo(() => dataOverview?.metrics || {
    total_businesses: 0,
    total_coins_in_circulation: 0,
    businesses_low_coins: 0,
    businesses_out_of_coins: 0,
  }, [dataOverview]);

  const filteredBusinesses = useMemo(() => {
    return businesses.filter(b => {
      const matchSearch =
        b.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
  }, [businesses, searchTerm, statusFilter]);

  // --- API HANDLERS ---
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
      const params = {};
      if (historyBusinessFilter) params.business_id = historyBusinessFilter;
      if (historyPeriod.from) params.date_from = historyPeriod.from;
      if (historyPeriod.to) params.date_to = historyPeriod.to;
      const res = await api.get('/platform/coins/history', { params });
      const rawData = res.data;
      const list = Array.isArray(rawData) ? rawData : (rawData?.data || []);
      setHistoryList(list);
    } catch (err) {
      toast.error('Gagal memuat riwayat mutasi koin');
    } finally {
      setLoadingHistory(false);
    }
  }

  async function fetchMyCoins() {
    setLoadingMyCoins(true);
    try {
      const res = await api.get('/my-business/coins');
      setMyCoinsData(res.data);
    } catch (err) {
      toast.error('Gagal memuat saldo koin bisnis');
    } finally {
      setLoadingMyCoins(false);
    }
  }

  // Open Top Up Modal
  function handleOpenTopUp(business) {
    setTopUpModal({
      open: true,
      business,
      coins: 10000,
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
      setTopUpModal({ open: false, business: null, coins: 10000, paymentAmount: '', paymentReference: '', notes: '', submitting: false });
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

  // -------------------------------------------------------------
  // VIEW: BUSINESS / TENANT OWNER ("Cek Saldo Koin Usaha")
  // -------------------------------------------------------------
  if (!isPlatformAdmin) {
    if (loadingMyCoins && !myCoinsData) {
      return <LoadingState message="Memuat saldo koin perusahaan..." />;
    }

    const coinBal = myCoinsData?.coin_balance || 0;
    const remTx = myCoinsData?.remaining_transactions || 0;
    const rate = myCoinsData?.coins_per_transaction || 1;
    const isLow = myCoinsData?.is_coin_low;
    const isOut = myCoinsData?.is_coin_out;
    const businessName = myCoinsData?.business_name || 'Perusahaan';
    const waLink = `https://wa.me/6281244295923?text=Halo%20Admin%20MOVA%20POS,%20saya%20ingin%20Top%20Up%20Koin%20untuk%20perusahaan%20${encodeURIComponent(businessName)}`;

    return (
      <div className="page-container">
        {/* Header */}
        <PageHeader
          title="Informasi Saldo & Top Up Koin"
          subtitle={`Monitor sisa koin transaksi kasir, tarif per nota, dan riwayat penggunaan koin perusahaan ${businessName}.`}
          badgeText="Saldo Perusahaan"
          badgeIcon={Coins}
          rightContent={
            <button
              onClick={() => {
                fetchMyCoins();
                refreshCoins();
              }}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={14} className={loadingMyCoins ? 'animate-spin' : ''} />
              Segarkan Saldo
            </button>
          }
        />

        {/* Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16, borderLeft: `4px solid ${isOut ? '#ef4444' : isLow ? '#f59e0b' : '#34d399'}` }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: isOut ? 'rgba(239, 68, 68, 0.15)' : isLow ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isOut ? '#f87171' : isLow ? '#fbbf24' : '#34d399' }}>
              <Coins size={26} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Saldo Koin Perusahaan
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#ffffff', marginTop: 4 }}>
                🪙 {num(coinBal)} Koin
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16, borderLeft: '4px solid #3b82f6' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
              <FileText size={26} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Estimasi Sisa Transaksi
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#ffffff', marginTop: 4 }}>
                {num(remTx)} Nota Kasir
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16, borderLeft: '4px solid #8b5cf6' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(139, 92, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa' }}>
              <CreditCard size={26} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Tarif Koin per Nota
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#c4b5fd', marginTop: 4 }}>
                {num(rate)} Koin / Nota
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16, borderLeft: `4px solid ${isOut ? '#ef4444' : isLow ? '#f59e0b' : '#10b981'}` }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: isOut ? 'rgba(239, 68, 68, 0.15)' : isLow ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isOut ? '#f87171' : isLow ? '#fbbf24' : '#34d399' }}>
              {isOut ? <XCircle size={26} /> : isLow ? <AlertTriangle size={26} /> : <CheckCircle2 size={26} />}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Status Saldo
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: isOut ? '#f87171' : isLow ? '#fbbf24' : '#34d399', marginTop: 4 }}>
                {isOut ? '🔴 SALDO HABIS (0 Nota)' : isLow ? '🟡 MENIPIS (≤ 20 Nota)' : '🟢 SALDO AMAN'}
              </div>
            </div>
          </div>
        </div>

        {/* WhatsApp Top-Up Banner Card */}
        <div
          className="card mb-4"
          style={{
            padding: 24,
            background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.12) 0%, rgba(18, 140, 126, 0.08) 100%)',
            border: '1px solid rgba(37, 211, 102, 0.3)',
            borderRadius: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 20,
            boxShadow: '0 8px 32px rgba(37, 211, 102, 0.15)'
          }}
        >
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ padding: '6px 12px', borderRadius: 20, background: '#25D366', color: '#ffffff', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Coins size={14} /> Cara Top Up Koin Transaksi
              </div>
              <span style={{ fontSize: 12, color: '#34d399', fontWeight: 600 }}>Layanan Resmi Admin Helpdesk</span>
            </div>
            <h3 style={{ margin: '6px 0', fontSize: 18, fontWeight: 800, color: '#ffffff' }}>
              Isi Ulang Koin Transaksi Perusahaan Anda
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Setiap transaksi nota di kasir memotong koin sesuai tarif. Untuk menambahkan koin, silakan lakukan pembayaran ke <strong>Pemilik Website (Platform Owner)</strong> melalui WhatsApp Helpdesk di bawah ini.
            </p>
          </div>

          <div>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={{
                background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                border: 'none',
                padding: '12px 22px',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: '0 6px 20px rgba(37, 211, 102, 0.4)',
                color: '#ffffff',
                textDecoration: 'none'
              }}
            >
              <Coins size={18} />
              <span>Top Up via WA Admin (+62 812-4429-5923)</span>
            </a>
          </div>
        </div>

        {/* Mutation History Table Card - Grouped By Date */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(165, 180, 252, 0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={18} style={{ color: 'var(--accent-bright)' }} />
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                Riwayat Mutasi Koin per Tanggal ({groupedMutations.length} Hari · {mutations.length} Transaksi)
              </h3>
            </div>
            <PeriodPicker
              from={historyPeriod.from}
              to={historyPeriod.to}
              onChange={setHistoryPeriod}
              label="Periode"
              align="right"
            />
          </div>

          {groupedMutations.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Clock size={36} style={{ marginBottom: 8, opacity: 0.5 }} />
              <div>Belum ada riwayat mutasi koin untuk perusahaan ini.</div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 20 }}>Tanggal Transaksi</th>
                    <th style={{ textAlign: 'center' }}>Aktivitas Mutasi</th>
                    <th style={{ textAlign: 'right' }}>Total Perubahan</th>
                    <th style={{ textAlign: 'right' }}>Saldo (Awal &rarr; Akhir)</th>
                    <th style={{ textAlign: 'center', paddingRight: 20 }}>Rincian Transaksi</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedMutations.map((g) => (
                    <tr
                      key={g.date}
                      style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                      onClick={() => setDetailDateModal({ open: true, group: g })}
                    >
                      <td style={{ paddingLeft: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 38, height: 38, borderRadius: 10,
                            background: 'rgba(139, 92, 246, 0.15)',
                            color: '#c4b5fd',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, fontSize: 13, flexShrink: 0
                          }}>
                            <Calendar size={18} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#ffffff', fontSize: 14 }}>
                              {formatDateIndo(g.date)}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                              {g.date} • Total {g.items.length} Transaksi
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                          {g.usageCount > 0 && (
                            <span style={{
                              padding: '4px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700,
                              background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)'
                            }}>
                              🛒 {g.usageCount} Nota Kasir (-{num(g.usageAmount)})
                            </span>
                          )}
                          {g.topUpCount > 0 && (
                            <span style={{
                              padding: '4px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700,
                              background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)'
                            }}>
                              🪙 {g.topUpCount} Top Up (+{num(g.topUpAmount)})
                            </span>
                          )}
                          {g.otherCount > 0 && (
                            <span style={{
                              padding: '4px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700,
                              background: 'rgba(139, 92, 246, 0.15)', color: '#c4b5fd'
                            }}>
                              {g.otherCount} Penyesuaian
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 14 }}>
                        <span style={{ color: g.totalChange > 0 ? '#34d399' : g.totalChange < 0 ? '#ef4444' : '#ffffff' }}>
                          {g.totalChange > 0 ? `+${num(g.totalChange)}` : num(g.totalChange)} Koin
                        </span>
                      </td>

                      <td style={{ textAlign: 'right', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{num(g.startBalance)}</span>
                        <span style={{ margin: '0 6px', color: 'var(--text-muted)' }}>&rarr;</span>
                        <strong style={{ color: '#ffffff', fontSize: 14 }}>{num(g.endBalance)}</strong>
                      </td>

                      <td style={{ textAlign: 'center', paddingRight: 20 }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailDateModal({ open: true, group: g });
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 8
                          }}
                        >
                          <Eye size={14} style={{ color: 'var(--accent-bright)' }} />
                          <span>Lihat {g.items.length} Rincian</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Detail Transaksi Koin per Tanggal */}
        <CoinDateDetailModal
          open={detailDateModal.open}
          group={detailDateModal.group}
          onClose={() => setDetailDateModal({ open: false, group: null })}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: PLATFORM ADMIN / WEBSITE OWNER
  // -------------------------------------------------------------
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
                            {num(b.remaining_transactions)} Nota
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
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
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
                            <button
                              onClick={() => {
                                setHistoryBusinessFilter(String(b.id));
                                setActiveTab('history');
                              }}
                              className="btn btn-ghost btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#38bdf8' }}
                              title="Lihat riwayat mutasi koin perusahaan ini"
                            >
                              <Clock size={14} />
                              Riwayat
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>Filter:</span>
              <PeriodPicker
                from={historyPeriod.from}
                to={historyPeriod.to}
                onChange={setHistoryPeriod}
                label="Periode"
                align="left"
              />
              <select
                className="form-control"
                style={{ minWidth: 200 }}
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

              <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', padding: 3, borderRadius: 8 }}>
                <button
                  type="button"
                  onClick={() => setAdminViewMode('grouped')}
                  className={`btn btn-sm ${adminViewMode === 'grouped' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 6 }}
                >
                  <Layers size={13} style={{ marginRight: 4 }} />
                  Group Tanggal
                </button>
                <button
                  type="button"
                  onClick={() => setAdminViewMode('flat')}
                  className={`btn btn-sm ${adminViewMode === 'flat' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 6 }}
                >
                  <ListFilter size={13} style={{ marginRight: 4 }} />
                  Semua Baris
                </button>
              </div>
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

          {(() => {
            if (loadingHistory) {
              return <LoadingState message="Memuat mutasi koin..." />;
            }
            if (safeHistoryList.length === 0) {
              return (
                <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                  <Clock size={36} style={{ color: 'var(--text-secondary)', margin: '0 auto 12px' }} />
                  <h4>Belum ada riwayat mutasi koin</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Mutasi akan otomatis tercatat saat top up koin atau setiap nota transaksi kasir selesai.</p>
                </div>
              );
            }

            if (adminViewMode === 'grouped') {
              return (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(165, 180, 252, 0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Calendar size={18} style={{ color: 'var(--accent-bright)' }} />
                      <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                        Riwayat Mutasi Koin per Tanggal ({groupedAdminHistory.length} Hari · {safeHistoryList.length} Transaksi)
                      </h3>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      💡 Klik baris tanggal untuk melihat rincian & operator pembuat
                    </span>
                  </div>

                  <div className="table-responsive">
                    <table className="table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ paddingLeft: 20 }}>Tanggal Transaksi</th>
                          <th style={{ textAlign: 'center' }}>Aktivitas Mutasi</th>
                          <th style={{ textAlign: 'right' }}>Total Perubahan</th>
                          <th style={{ textAlign: 'right' }}>Saldo (Awal &rarr; Akhir)</th>
                          <th style={{ textAlign: 'center', paddingRight: 20 }}>Rincian Transaksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedAdminHistory.map((g) => (
                          <tr
                            key={g.date}
                            style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                            onClick={() => setDetailDateModal({ open: true, group: g })}
                          >
                            <td style={{ paddingLeft: 20 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{
                                  width: 38, height: 38, borderRadius: 10,
                                  background: 'rgba(139, 92, 246, 0.15)',
                                  color: '#c4b5fd',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontWeight: 800, fontSize: 13, flexShrink: 0
                                }}>
                                  <Calendar size={18} />
                                </div>
                                <div>
                                  <div style={{ fontWeight: 700, color: '#ffffff', fontSize: 14 }}>
                                    {formatDateIndo(g.date)}
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                    {g.date} • Total {g.items.length} Transaksi
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                                {g.usageCount > 0 && (
                                  <span style={{
                                    padding: '4px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700,
                                    background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)'
                                  }}>
                                    🛒 {g.usageCount} Nota Kasir (-{num(g.usageAmount)})
                                  </span>
                                )}
                                {g.topUpCount > 0 && (
                                  <span style={{
                                    padding: '4px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700,
                                    background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)'
                                  }}>
                                    🪙 {g.topUpCount} Top Up (+{num(g.topUpAmount)})
                                  </span>
                                )}
                              </div>
                            </td>

                            <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 14 }}>
                              <span style={{ color: g.totalChange > 0 ? '#34d399' : g.totalChange < 0 ? '#ef4444' : '#ffffff' }}>
                                {g.totalChange > 0 ? `+${num(g.totalChange)}` : num(g.totalChange)} Koin
                              </span>
                            </td>

                            <td style={{ textAlign: 'right', fontSize: 13 }}>
                              <span style={{ color: 'var(--text-secondary)' }}>{num(g.startBalance)}</span>
                              <span style={{ margin: '0 6px', color: 'var(--text-muted)' }}>&rarr;</span>
                              <strong style={{ color: '#ffffff', fontSize: 14 }}>{num(g.endBalance)}</strong>
                            </td>

                            <td style={{ textAlign: 'center', paddingRight: 20 }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDetailDateModal({ open: true, group: g });
                                }}
                                className="btn btn-secondary btn-sm"
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 6,
                                  fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 8
                                }}
                              >
                                <Eye size={14} style={{ color: 'var(--accent-bright)' }} />
                                <span>Lihat {g.items.length} Rincian</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            }

            return (
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
                      {safeHistoryList.map((h) => (
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#ffffff', fontSize: 12.5 }}>
                              <User size={13} style={{ color: 'var(--accent-bright)' }} />
                              <span>{h.creator?.name || h.created_by_name || 'Admin / Kasir'}</span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {h.outlet?.name ? `Cabang: ${h.outlet.name} • ` : ''}
                              {h.notes || '-'}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* Modal Detail Transaksi Koin per Tanggal (For Admin View) */}
      <CoinDateDetailModal
        open={detailDateModal.open}
        group={detailDateModal.group}
        onClose={() => setDetailDateModal({ open: false, group: null })}
      />

      {/* MODAL 1: TOP UP KOIN */}
      {topUpModal.open && topUpModal.business && (
        <div className="modal-overlay" onClick={() => setTopUpModal(p => ({ ...p, open: false }))}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, width: '100%', padding: 24, maxHeight: '92vh', overflowY: 'auto' }}>
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
                  {[10000, 15000, 20000, 25000, 30000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTopUpModal(p => ({ ...p, coins: amt }))}
                      className={`btn btn-sm ${Number(topUpModal.coins) === amt ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: 11.5, fontWeight: 700, padding: '6px 4px' }}
                    >
                      +{num(amt)}
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
                  {' '} ({Math.floor((Number(topUpModal.business.coin_balance || 0) + Number(topUpModal.coins || 0)) / (Number(topUpModal.business.coins_per_transaction) || 1))} Nota)
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
        <div className="modal-overlay" onClick={() => setRateModal(p => ({ ...p, open: false }))}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 460, width: '100%', padding: 24, maxHeight: '92vh', overflowY: 'auto' }}>
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
                    Setiap transaksi kasir berstatus <strong>PAID</strong> di seluruh cabang perusahaan ini akan memotong koin sejumlah tarif di atas.
                    <br /><br />
                    <span style={{ color: '#34d399', fontWeight: 600 }}>
                      ℹ️ Catatan Penting: Perubahan tarif ini hanya berlaku untuk transaksi kasir ke depan. Riwayat pengurangan koin pada transaksi yang sudah berlalu (history) tetap tersimpan aman dan tidak akan berubah.
                    </span>
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

/**
 * Modal detail rincian transaksi koin untuk 1 tanggal terpilih.
 * Menampilkan ringkasan mutasi harian, daftar per nota/top-up, serta Operator / Kasir pembuat transaksi (Created By).
 */
function CoinDateDetailModal({ open, group, onClose }) {
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'USAGE' | 'TOPUP'
  const [searchTxt, setSearchTxt] = useState('');

  const items = useMemo(() => group?.items || [], [group]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (filterType === 'USAGE' && item.type !== 'USAGE') return false;
      if (filterType === 'TOPUP' && item.type !== 'TOPUP') return false;
      if (searchTxt) {
        const q = searchTxt.toLowerCase();
        const orderMatch = (item.order_number || '').toLowerCase().includes(q);
        const refMatch = (item.payment_reference || '').toLowerCase().includes(q);
        const creatorMatch = (item.creator?.name || item.created_by_name || '').toLowerCase().includes(q);
        const outletMatch = (item.outlet?.name || '').toLowerCase().includes(q);
        const bizMatch = (item.business?.name || '').toLowerCase().includes(q);
        const notesMatch = (item.notes || '').toLowerCase().includes(q);
        if (!orderMatch && !refMatch && !creatorMatch && !outletMatch && !bizMatch && !notesMatch) return false;
      }
      return true;
    });
  }, [items, filterType, searchTxt]);

  if (!open || !group) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 960,
          width: '95%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(165, 180, 252, 0.15)',
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.1) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
            }}>
              <Calendar size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#ffffff' }}>
                  {formatDateIndo(group.date)}
                </h3>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: 'rgba(139, 92, 246, 0.2)',
                  color: '#c4b5fd',
                  fontSize: 12,
                  fontWeight: 700
                }}>
                  {group.date}
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                Total <strong>{items.length} transaksi koin</strong> tercatat pada tanggal ini.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-icon btn-sm"
            style={{ borderRadius: 8, padding: 8 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Date Summary Metric Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 12,
          padding: '16px 24px',
          background: 'rgba(15, 23, 42, 0.6)',
          borderBottom: '1px solid rgba(165, 180, 252, 0.1)'
        }}>
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Mutasi Hari Ini</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: group.totalChange > 0 ? '#34d399' : group.totalChange < 0 ? '#ef4444' : '#ffffff', marginTop: 2 }}>
              {group.totalChange > 0 ? `+${num(group.totalChange)}` : num(group.totalChange)} Koin
            </div>
          </div>

          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase' }}>Pemotongan Nota Kasir</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#60a5fa', marginTop: 2 }}>
              🛒 {group.usageCount} Nota (-{num(group.usageAmount)} Koin)
            </div>
          </div>

          {group.topUpCount > 0 && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6ee7b7', textTransform: 'uppercase' }}>Top Up Saldo</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#34d399', marginTop: 2 }}>
                🪙 {group.topUpCount} Top Up (+{num(group.topUpAmount)} Koin)
              </div>
            </div>
          )}

          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Pergerakan Saldo</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', marginTop: 4 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{num(group.startBalance)}</span>
              <span style={{ margin: '0 6px', color: 'var(--text-muted)' }}>&rarr;</span>
              <strong style={{ color: '#38bdf8' }}>{num(group.endBalance)}</strong>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div style={{
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          borderBottom: '1px solid rgba(165, 180, 252, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              className={`btn btn-sm ${filterType === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6 }}
            >
              Semua ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('USAGE')}
              className={`btn btn-sm ${filterType === 'USAGE' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6 }}
            >
              Nota Kasir ({group.usageCount})
            </button>
            {group.topUpCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterType('TOPUP')}
                className={`btn btn-sm ${filterType === 'TOPUP' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6 }}
              >
                Top Up ({group.topUpCount})
              </button>
            )}
          </div>

          <div style={{ position: 'relative', width: 240 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Cari nota, kasir / user..."
              className="form-control"
              style={{ fontSize: 12, padding: '6px 10px 6px 30px' }}
              value={searchTxt}
              onChange={(e) => setSearchTxt(e.target.value)}
            />
          </div>
        </div>

        {/* Transaction Table Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
          {filteredItems.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              Tidak ada transaksi yang sesuai kriteria pencarian.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table" style={{ margin: 0 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <th style={{ paddingLeft: 24, width: 100 }}>Waktu</th>
                    <th style={{ textAlign: 'center', width: 120 }}>Tipe</th>
                    <th style={{ textAlign: 'right', width: 130 }}>Perubahan</th>
                    <th style={{ textAlign: 'right', width: 170 }}>Saldo (Awal &rarr; Akhir)</th>
                    <th style={{ width: 180 }}>No. Nota / Ref</th>
                    <th>Dibuat Oleh (Operator / Kasir)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const timeStr = item.created_at ? (item.created_at.includes('T') ? item.created_at.split('T')[1]?.substring(0, 8) : item.created_at.split(' ')[1]?.substring(0, 8)) : '-';
                    const creatorName = item.creator?.name || item.created_by_name || 'Admin / Kasir';
                    const outletName = item.outlet?.name || 'Cabang Utama';

                    return (
                      <tr key={item.id} style={{ verticalAlign: 'middle' }}>
                        <td style={{ paddingLeft: 24, fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace', fontWeight: 600 }}>
                          <Clock size={12} style={{ display: 'inline', marginRight: 4, opacity: 0.7 }} />
                          {timeStr}
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          {item.type === 'TOPUP' ? (
                            <span style={{
                              padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                              background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)'
                            }}>
                              TOP UP
                            </span>
                          ) : item.type === 'USAGE' ? (
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
                              {item.type}
                            </span>
                          )}
                        </td>

                        <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 13 }}>
                          <span style={{ color: Number(item.amount) > 0 ? '#34d399' : '#ef4444' }}>
                            {Number(item.amount) > 0 ? `+${num(item.amount)}` : num(item.amount)} Koin
                          </span>
                        </td>

                        <td style={{ textAlign: 'right', fontSize: 12 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{num(item.balance_before)}</span>
                          <span style={{ margin: '0 5px', color: 'var(--text-muted)' }}>&rarr;</span>
                          <strong style={{ color: '#ffffff' }}>{num(item.balance_after)}</strong>
                        </td>

                        <td>
                          {item.order_number ? (
                            <span style={{
                              fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: 'var(--accent-bright)'
                            }}>
                              {item.order_number}
                            </span>
                          ) : item.payment_reference ? (
                            <span style={{ fontSize: 12, color: '#34d399', fontWeight: 600 }}>
                              Ref: {item.payment_reference}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>-</span>
                          )}
                          {item.payment_amount && Number(item.payment_amount) > 0 && (
                            <div style={{ fontSize: 11, color: '#34d399' }}>
                              ({rupiah(item.payment_amount)})
                            </div>
                          )}
                        </td>

                        <td>
                          {/* Created By & Outlet Info */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#ffffff', fontSize: 12.5 }}>
                              <div style={{
                                width: 22, height: 22, borderRadius: '50%',
                                background: 'rgba(139, 92, 246, 0.25)',
                                color: '#c4b5fd',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                <User size={12} />
                              </div>
                              <span>{creatorName}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-secondary)' }}>
                              <Store size={12} style={{ color: 'var(--text-muted)' }} />
                              <span>{outletName}</span>
                              {item.business?.name && (
                                <>
                                  <span>•</span>
                                  <span style={{ color: '#c4b5fd' }}>{item.business.name}</span>
                                </>
                              )}
                              {item.notes && (
                                <>
                                  <span>•</span>
                                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{item.notes}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid rgba(165, 180, 252, 0.12)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.4)'
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Menampilkan <strong>{filteredItems.length}</strong> dari {items.length} transaksi pada {group.date}
          </div>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '7px 18px', fontWeight: 700 }}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
