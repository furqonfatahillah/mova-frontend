import { useState, useEffect, useMemo } from 'react';
import api from '../api/client';
import { PageHeader, LoadingState } from '../components/ui';
import { useOutlet } from '../context/OutletContext';
import toast from 'react-hot-toast';
import {
  CreditCard,
  Landmark,
  QrCode,
  ShieldCheck,
  Zap,
  Copy,
  Check,
  Plus,
  Edit2,
  Trash2,
  Star,
  ExternalLink,
  RefreshCw,
  Key,
  Globe,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  HelpCircle,
  Building2,
  Store,
  Info,
  X,
  Smartphone,
  Wallet,
  Clock,
  Send,
  Users
} from 'lucide-react';

const POPULAR_BANKS = [
  { name: 'BCA (Bank Central Asia)', code: 'BCA', color: '#005caa', gradient: 'linear-gradient(135deg, #003366, #005caa)' },
  { name: 'Bank Mandiri', code: 'MANDIRI', color: '#003d79', gradient: 'linear-gradient(135deg, #002244, #003d79)' },
  { name: 'BRI (Bank Rakyat Indonesia)', code: 'BRI', color: '#00529c', gradient: 'linear-gradient(135deg, #002e5b, #00529c)' },
  { name: 'BNI (Bank Negara Indonesia)', code: 'BNI', color: '#f15a24', gradient: 'linear-gradient(135deg, #b83d10, #f15a24)' },
  { name: 'BSI (Bank Syariah Indonesia)', code: 'BSI', color: '#00a39d', gradient: 'linear-gradient(135deg, #00605c, #00a39d)' },
  { name: 'CIMB Niaga', code: 'CIMB', color: '#ed1c24', gradient: 'linear-gradient(135deg, #8a0c11, #ed1c24)' },
  { name: 'Permata Bank', code: 'PERMATA', color: '#79b93c', gradient: 'linear-gradient(135deg, #446e1c, #79b93c)' },
  { name: 'Bank Danamon', code: 'DANAMON', color: '#ff6600', gradient: 'linear-gradient(135deg, #993d00, #ff6600)' },
  { name: 'Bank Jago', code: 'JAGO', color: '#ff8000', gradient: 'linear-gradient(135deg, #aa5500, #ff8000)' },
  { name: 'SeaBank', code: 'SEABANK', color: '#ff5b00', gradient: 'linear-gradient(135deg, #9e3900, #ff5b00)' },
  { name: 'Bank Lainnya', code: 'OTHER', color: '#6366f1', gradient: 'linear-gradient(135deg, #3730a3, #6366f1)' },
];

const POPULAR_EWALLETS = [
  { name: 'GoPay (GoTo / GoBiz)', code: 'GOPAY', color: '#00a5cf', gradient: 'linear-gradient(135deg, #004d61, #00a5cf)' },
  { name: 'OVO (OVO Merchant / Akun Premier)', code: 'OVO', color: '#4c2a86', gradient: 'linear-gradient(135deg, #2b1353, #4c2a86)' },
  { name: 'DANA (DANA Bisnis / Premium)', code: 'DANA', color: '#118eea', gradient: 'linear-gradient(135deg, #0a4f82, #118eea)' },
  { name: 'ShopeePay (Shopee Merchant)', code: 'SHOPEEPAY', color: '#ee4d2d', gradient: 'linear-gradient(135deg, #87230e, #ee4d2d)' },
  { name: 'LinkAja (Telkomsel / BUMN)', code: 'LINKAJA', color: '#e31e24', gradient: 'linear-gradient(135deg, #7a0c10, #e31e24)' },
];

export default function PaymentSettings() {
  const { outlets, isSuperadminPlatform, currentBusiness } = useOutlet();
  const [activeTab, setActiveTab] = useState('accounts'); // 'accounts', 'gateway', 'comparison'
  const [accountTypeFilter, setAccountTypeFilter] = useState('ALL'); // 'ALL', 'BANK', 'EWALLET'
  const [loading, setLoading] = useState(false);

  // Bank & E-Wallet Accounts State
  const [bankAccounts, setBankAccounts] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);

  const [formAccount, setFormAccount] = useState({
    account_type: 'BANK', // 'BANK' or 'EWALLET'
    bank_name: 'BCA (Bank Central Asia)',
    bank_code: 'BCA',
    account_number: '',
    account_holder: '',
    branch: '',
    outlet_id: '',
    qr_image_url: '',
    is_primary: false,
    payout_schedule: 'DAILY',
    notes: '',
  });

  // Gateway Settings State
  const [gatewayConfig, setGatewayConfig] = useState({
    active_gateway: 'none',
    environment: 'sandbox',
    enable_qris: true,
    enable_va: true,
    midtrans_server_key: '',
    midtrans_client_key: '',
    midtrans_merchant_id: '',
    xendit_secret_key: '',
    xendit_public_key: '',
    xendit_webhook_token: '',
    qris_fee_absorbed_by: 'merchant',
    va_fee_absorbed_by: 'customer',
    auto_settlement: true,
  });
  const [showMidtransKey, setShowMidtransKey] = useState(false);
  const [showXenditKey, setShowXenditKey] = useState(false);
  const [savingGateway, setSavingGateway] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    fetchBankAccounts();
    fetchGatewayConfig();
  }, []);

  async function fetchBankAccounts() {
    setLoading(true);
    try {
      const { data } = await api.get('/bank-accounts');
      setBankAccounts(data.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat daftar rekening / e-wallet');
    } finally {
      setLoading(false);
    }
  }

  async function fetchGatewayConfig() {
    try {
      const { data } = await api.get('/payment-gateways/config');
      if (data.data) {
        setGatewayConfig((prev) => ({
          ...prev,
          ...data.data,
          midtrans_server_key: data.data.midtrans_server_key_masked || data.data.midtrans_server_key || '',
          xendit_secret_key: data.data.xendit_secret_key_masked || data.data.xendit_secret_key || '',
        }));
      }
    } catch (err) {
      console.error(err);
    }
  }

  function handleOpenCreateModal(type = 'BANK') {
    setEditingAccount(null);
    setFormAccount({
      account_type: type,
      bank_name: type === 'EWALLET' ? 'GoPay (GoTo / GoBiz)' : 'BCA (Bank Central Asia)',
      bank_code: type === 'EWALLET' ? 'GOPAY' : 'BCA',
      account_number: '',
      account_holder: '',
      branch: '',
      outlet_id: '',
      qr_image_url: '',
      is_primary: bankAccounts.length === 0,
      payout_schedule: 'DAILY',
      notes: '',
    });
    setModalOpen(true);
  }

  function handleOpenEditModal(acc) {
    setEditingAccount(acc);
    setFormAccount({
      account_type: acc.account_type || (acc.bank_code === 'GOPAY' || acc.bank_code === 'OVO' || acc.bank_code === 'DANA' ? 'EWALLET' : 'BANK'),
      bank_name: acc.bank_name || 'BCA (Bank Central Asia)',
      bank_code: acc.bank_code || 'BCA',
      account_number: acc.account_number || '',
      account_holder: acc.account_holder || '',
      branch: acc.branch || '',
      outlet_id: acc.outlet_id ? String(acc.outlet_id) : '',
      qr_image_url: acc.qr_image_url || '',
      is_primary: Boolean(acc.is_primary),
      payout_schedule: acc.payout_schedule || 'DAILY',
      notes: acc.notes || '',
    });
    setModalOpen(true);
  }

  async function handleSaveAccount(e) {
    e.preventDefault();
    if (!formAccount.account_number.trim() || !formAccount.account_holder.trim()) {
      toast.error('Nomor rekening / nomor HP e-wallet dan nama pemilik wajib diisi');
      return;
    }

    try {
      const payload = {
        ...formAccount,
        outlet_id: formAccount.outlet_id || null,
      };

      if (editingAccount) {
        await api.put(`/bank-accounts/${editingAccount.id}`, payload);
        toast.success('Data rekening / e-wallet berhasil diperbarui');
      } else {
        await api.post('/bank-accounts', payload);
        toast.success(formAccount.account_type === 'EWALLET' ? 'E-Wallet berhasil didaftarkan' : 'Nomor rekening berhasil didaftarkan');
      }
      setModalOpen(false);
      fetchBankAccounts();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Gagal menyimpan data rekening');
    }
  }

  async function handleDeleteAccount(id, name) {
    if (!window.confirm(`Yakin ingin menghapus ${name}?`)) return;
    try {
      await api.delete(`/bank-accounts/${id}`);
      toast.success('Data rekening berhasil dihapus');
      fetchBankAccounts();
    } catch (err) {
      console.error(err);
      toast.error('Gagal menghapus data');
    }
  }

  async function handleSetPrimary(id) {
    try {
      await api.patch(`/bank-accounts/${id}/set-primary`);
      toast.success('Ditetapkan sebagai rekening / e-wallet utama penerimaan dana');
      fetchBankAccounts();
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengubah rekening utama');
    }
  }

  async function handleToggleActive(id) {
    try {
      await api.patch(`/bank-accounts/${id}/toggle-active`);
      toast.success('Status aktif berhasil diperbarui');
      fetchBankAccounts();
    } catch (err) {
      console.error(err);
      toast.error('Gagal memperbarui status');
    }
  }

  function handleCopyNumber(num, id) {
    navigator.clipboard.writeText(num);
    setCopiedId(id);
    toast.success(`Nomor ${num} disalin ke clipboard`);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleSaveGateway(e) {
    if (e) e.preventDefault();
    setSavingGateway(true);
    try {
      await api.post('/payment-gateways/config', gatewayConfig);
      toast.success('Konfigurasi Payment Gateway berhasil disimpan');
      fetchGatewayConfig();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Gagal menyimpan konfigurasi');
    } finally {
      setSavingGateway(false);
    }
  }

  async function handleTestConnection() {
    if (gatewayConfig.active_gateway === 'none') {
      toast.error('Pilih provider Midtrans atau Xendit terlebih dahulu untuk pengujian');
      return;
    }

    setTestingConnection(true);
    setTestResult(null);
    try {
      const { data } = await api.post('/payment-gateways/test-connection', {
        gateway: gatewayConfig.active_gateway,
        environment: gatewayConfig.environment,
        midtrans_server_key: gatewayConfig.midtrans_server_key,
        xendit_secret_key: gatewayConfig.xendit_secret_key,
      });

      setTestResult(data);
      if (data.connected) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || 'Gagal melakukan tes koneksi';
      setTestResult({ connected: false, message: msg });
      toast.error(msg);
    } finally {
      setTestingConnection(false);
    }
  }

  function getAccountMeta(acc) {
    const isEwallet = acc.account_type === 'EWALLET' || POPULAR_EWALLETS.some(ew => acc.bank_code === ew.code || acc.bank_name?.toUpperCase().includes(ew.code));
    if (isEwallet) {
      const found = POPULAR_EWALLETS.find((ew) => acc.bank_name?.toUpperCase().includes(ew.code) || acc.bank_code === ew.code);
      return found || {
        name: acc.bank_name,
        code: 'EWALLET',
        color: '#00a5cf',
        gradient: 'linear-gradient(135deg, #004d61, #00a5cf)',
      };
    }
    const found = POPULAR_BANKS.find((b) => acc.bank_name?.toUpperCase().includes(b.code) || acc.bank_code === b.code);
    return found || {
      name: acc.bank_name,
      code: 'BANK',
      color: '#6366f1',
      gradient: 'linear-gradient(135deg, #1e1b4b, #4338ca)',
    };
  }

  const filteredAccounts = useMemo(() => {
    if (accountTypeFilter === 'ALL') return bankAccounts;
    return bankAccounts.filter((acc) => {
      const isEw = acc.account_type === 'EWALLET' || POPULAR_EWALLETS.some(ew => acc.bank_code === ew.code || acc.bank_name?.toUpperCase().includes(ew.code));
      return accountTypeFilter === 'EWALLET' ? isEw : !isEw;
    });
  }, [bankAccounts, accountTypeFilter]);

  const bankCount = bankAccounts.filter(a => a.account_type !== 'EWALLET' && !POPULAR_EWALLETS.some(ew => a.bank_code === ew.code)).length;
  const ewalletCount = bankAccounts.length - bankCount;

  return (
    <div>
      {/* Page Header */}
      <PageHeader
        title="Rekening & E-Wallet Owner Bisnis"
        subtitle="Daftarkan nomor rekening bank & e-wallet penerimaan dana untuk para owner bisnis penyewa, agar setiap transaksi penjualan langsung masuk ke rekening masing-masing owner."
      />

      {/* Multi-Tenant SaaS Info Banner */}
      <div
        className="card mb-4"
        style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(139, 92, 246, 0.06))',
          borderRadius: 14,
          border: '1.5px solid rgba(139, 92, 246, 0.35)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'rgba(139, 92, 246, 0.2)',
            color: 'var(--accent-bright)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          <Building2 size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>
              SaaS Multi-Tenant: Alur Penyaluran Uang ke Owner Bisnis
            </span>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 6,
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
                fontWeight: 700,
              }}
            >
              Aktif: {currentBusiness?.name || 'Owner Bisnis'}
            </span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '6px 0 0', lineHeight: 1.6 }}>
            Setiap owner bisnis penyewa platform MOVA POS dapat mendaftarkan nomor rekening bank (BCA, Mandiri, BRI, dll) atau akun E-Wallet (GoPay, OVO, DANA, ShopeePay). Ketika customer membayar transaksi di kasir via QRIS atau Transfer, uang akan <strong>langsung disalurkan otomatis ke rekening / e-wallet utama owner bisnis</strong> ini.
          </p>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 20,
          borderBottom: '1px solid var(--border)',
          paddingBottom: 6,
          overflowX: 'auto',
        }}
      >
        <button
          onClick={() => setActiveTab('accounts')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 18px',
            borderRadius: '8px 8px 0 0',
            fontSize: 13,
            fontWeight: activeTab === 'accounts' ? 700 : 500,
            color: activeTab === 'accounts' ? 'var(--primary)' : 'var(--text-secondary)',
            background: activeTab === 'accounts' ? 'rgba(79, 70, 229, 0.12)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'accounts' ? '2px solid var(--primary)' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <CreditCard size={16} /> Rekening & E-Wallet ({bankAccounts.length})
        </button>

        <button
          onClick={() => setActiveTab('gateway')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 18px',
            borderRadius: '8px 8px 0 0',
            fontSize: 13,
            fontWeight: activeTab === 'gateway' ? 700 : 500,
            color: activeTab === 'gateway' ? 'var(--primary)' : 'var(--text-secondary)',
            background: activeTab === 'gateway' ? 'rgba(79, 70, 229, 0.12)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'gateway' ? '2px solid var(--primary)' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Zap size={16} /> Integrasi Gateway (Midtrans / Xendit)
          {gatewayConfig.active_gateway !== 'none' && (
            <span
              style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 4,
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              {gatewayConfig.active_gateway}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('comparison')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 18px',
            borderRadius: '8px 8px 0 0',
            fontSize: 13,
            fontWeight: activeTab === 'comparison' ? 700 : 500,
            color: activeTab === 'comparison' ? 'var(--primary)' : 'var(--text-secondary)',
            background: activeTab === 'comparison' ? 'rgba(79, 70, 229, 0.12)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'comparison' ? '2px solid var(--primary)' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <HelpCircle size={16} /> Mana Lebih Bagus? (Midtrans vs Xendit)
        </button>
      </div>

      {/* ========================================================
          TAB 1: DAFTAR REKENING BANK & E-WALLET OWNER
          ======================================================== */}
      {activeTab === 'accounts' && (
        <div>
          {/* Header Action Bar & Filter Switcher */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 18,
            }}
          >
            {/* Filter Buttons: Semua, Rekening Bank, E-Wallet */}
            <div style={{ display: 'flex', gap: 6, background: 'rgba(0,0,0,0.25)', padding: 4, borderRadius: 10, border: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => setAccountTypeFilter('ALL')}
                style={{
                  fontSize: 12,
                  fontWeight: accountTypeFilter === 'ALL' ? 700 : 500,
                  padding: '6px 12px',
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  background: accountTypeFilter === 'ALL' ? 'var(--accent)' : 'transparent',
                  color: accountTypeFilter === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                Semua ({bankAccounts.length})
              </button>

              <button
                type="button"
                onClick={() => setAccountTypeFilter('BANK')}
                style={{
                  fontSize: 12,
                  fontWeight: accountTypeFilter === 'BANK' ? 700 : 500,
                  padding: '6px 12px',
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: accountTypeFilter === 'BANK' ? 'var(--accent)' : 'transparent',
                  color: accountTypeFilter === 'BANK' ? '#ffffff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Landmark size={14} /> Rekening Bank ({bankCount})
              </button>

              <button
                type="button"
                onClick={() => setAccountTypeFilter('EWALLET')}
                style={{
                  fontSize: 12,
                  fontWeight: accountTypeFilter === 'EWALLET' ? 700 : 500,
                  padding: '6px 12px',
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: accountTypeFilter === 'EWALLET' ? 'var(--accent)' : 'transparent',
                  color: accountTypeFilter === 'EWALLET' ? '#ffffff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Smartphone size={14} /> E-Wallet ({ewalletCount})
              </button>
            </div>

            {/* Action Dropdown / Buttons */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary"
                onClick={() => handleOpenCreateModal('EWALLET')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}
              >
                <Smartphone size={15} /> + Tambah E-Wallet
              </button>

              <button
                className="btn btn-primary"
                onClick={() => handleOpenCreateModal('BANK')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <Plus size={16} /> + Daftarkan Rekening Bank
              </button>
            </div>
          </div>

          {loading ? (
            <LoadingState />
          ) : filteredAccounts.length === 0 ? (
            <div
              className="card text-center"
              style={{
                padding: '48px 24px',
                border: '1.5px dashed var(--border)',
                background: 'rgba(15, 20, 42, 0.4)',
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'rgba(99, 102, 241, 0.12)',
                  color: 'var(--accent-bright)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                }}
              >
                <Wallet size={28} />
              </div>
              <h4 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#ffffff' }}>
                Belum Ada {accountTypeFilter === 'EWALLET' ? 'E-Wallet' : accountTypeFilter === 'BANK' ? 'Rekening Bank' : 'Rekening / E-Wallet'} Terdaftar
              </h4>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 460, margin: '8px auto 20px' }}>
                Daftarkan nomor rekening bank (BCA, Mandiri, BRI, dll) atau nomor HP E-Wallet (GoPay, OVO, DANA, ShopeePay) milik owner bisnis ini agar uang transaksi penjualan dapat langsung ditransfer otomatis.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button className="btn btn-secondary" onClick={() => handleOpenCreateModal('EWALLET')}>
                  <Smartphone size={15} /> Daftarkan E-Wallet
                </button>
                <button className="btn btn-primary" onClick={() => handleOpenCreateModal('BANK')}>
                  <Plus size={16} /> Daftarkan Rekening Bank
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
                gap: 16,
              }}
            >
              {filteredAccounts.map((acc) => {
                const meta = getAccountMeta(acc);
                const isEw = acc.account_type === 'EWALLET' || POPULAR_EWALLETS.some(ew => acc.bank_code === ew.code);

                return (
                  <div
                    key={acc.id}
                    className="card"
                    style={{
                      position: 'relative',
                      overflow: 'hidden',
                      padding: 0,
                      borderRadius: 14,
                      border: acc.is_primary ? '1.5px solid #8b5cf6' : '1px solid var(--border)',
                      background: 'var(--bg-card)',
                      boxShadow: acc.is_primary ? '0 4px 20px rgba(139, 92, 246, 0.25)' : 'none',
                    }}
                  >
                    {/* Modern Bank / E-Wallet Card Header */}
                    <div
                      style={{
                        padding: '18px 20px',
                        background: meta.gradient,
                        position: 'relative',
                        color: '#ffffff',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: 'rgba(0, 0, 0, 0.35)',
                              color: '#ffffff',
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                            }}>
                              {isEw ? '📱 E-WALLET' : '🏦 REKENING BANK'}
                            </span>
                            <span style={{ fontSize: 11, opacity: 0.85, fontWeight: 600 }}>
                              {acc.outlet?.name ? `Cabang: ${acc.outlet.name}` : 'Semua Cabang'}
                            </span>
                          </div>

                          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6, letterSpacing: '-0.01em' }}>
                            {acc.bank_name}
                          </div>
                        </div>

                        {acc.is_primary && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '3px 8px',
                              borderRadius: 6,
                              background: 'rgba(255, 255, 255, 0.25)',
                              backdropFilter: 'blur(4px)',
                              fontSize: 11,
                              fontWeight: 800,
                              color: '#ffffff',
                            }}
                          >
                            <Star size={12} fill="#ffffff" /> Rekening Utama
                          </span>
                        )}
                      </div>

                      {/* Chip & Type Visual Embellishment */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, opacity: 0.9 }}>
                        <div
                          style={{
                            width: 32,
                            height: 24,
                            borderRadius: 4,
                            background: isEw ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255, 215, 0, 0.75)',
                            border: '1px solid rgba(255, 255, 255, 0.4)',
                          }}
                        />
                        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                          Pencairan: {acc.payout_schedule === 'INSTANT' ? '⚡ Instan' : acc.payout_schedule === 'MANUAL' ? '📅 Manual' : '🌙 Harian (23:59)'}
                        </div>
                      </div>

                      {/* Account Number / Phone Number */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: 12,
                          background: 'rgba(0, 0, 0, 0.3)',
                          padding: '7px 12px',
                          borderRadius: 8,
                        }}
                      >
                        <span style={{ fontSize: 16, fontFamily: 'monospace', fontWeight: 800, letterSpacing: '0.08em' }}>
                          {acc.account_number}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyNumber(acc.account_number, acc.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: copiedId === acc.id ? '#34d399' : '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 6px',
                          }}
                          title="Salin nomor"
                        >
                          {copiedId === acc.id ? <Check size={14} /> : <Copy size={14} />}
                          <span>{copiedId === acc.id ? 'Tersalin' : 'Salin'}</span>
                        </button>
                      </div>

                      {/* Account Holder */}
                      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 8, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                        a.n. {acc.account_holder}
                      </div>
                    </div>

                    {/* Card Body & Action Controls */}
                    <div style={{ padding: '14px 18px' }}>
                      {acc.branch && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                          KCP/Wilayah: <strong>{acc.branch}</strong>
                        </div>
                      )}

                      {acc.notes && (
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 10, fontStyle: 'italic' }}>
                          "{acc.notes}"
                        </div>
                      )}

                      {acc.qr_image_url && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 11.5,
                            color: '#38bdf8',
                            marginBottom: 10,
                          }}
                        >
                          <QrCode size={14} /> Memiliki QRIS Stiker Toko Terlampir
                        </div>
                      )}

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingTop: 10,
                          borderTop: '1px solid var(--border)',
                          marginTop: 6,
                        }}
                      >
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {!acc.is_primary && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleSetPrimary(acc.id)}
                              style={{ fontSize: 11.5 }}
                              title="Jadikan sebagai rekening utama pencairan"
                            >
                              <Star size={12} /> Set Utama
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleToggleActive(acc.id)}
                            style={{
                              fontSize: 11.5,
                              color: acc.is_active ? '#34d399' : 'var(--text-muted)',
                            }}
                          >
                            {acc.is_active ? '✓ Aktif' : 'Nonaktif'}
                          </button>
                        </div>

                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenEditModal(acc)}
                            title="Edit rekening / e-wallet"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteAccount(acc.id, `${acc.bank_name} (${acc.account_number})`)}
                            title="Hapus"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 2: PAYMENT GATEWAY (MIDTRANS / XENDIT)
          ======================================================== */}
      {activeTab === 'gateway' && (
        <div style={{ maxWidth: 860 }}>
          {/* Diagnostic Result Banner if Connection Test was run */}
          {testResult && (
            <div
              className="card mb-4"
              style={{
                padding: '14px 18px',
                borderRadius: 12,
                border: `1.5px solid ${testResult.connected ? '#10b981' : '#f43f5e'}`,
                background: testResult.connected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              {testResult.connected ? (
                <CheckCircle2 size={22} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
              ) : (
                <AlertCircle size={22} color="#f43f5e" style={{ flexShrink: 0, marginTop: 2 }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: testResult.connected ? '#34d399' : '#f87171' }}>
                  {testResult.connected ? 'Koneksi Payment Gateway Berhasil!' : 'Koneksi Gateway Gagal'}
                </div>
                <div style={{ fontSize: 12.5, color: '#ffffff', marginTop: 4 }}>
                  {testResult.message}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTestResult(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          <div
            className="card mb-4"
            style={{
              padding: 22,
              borderRadius: 14,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#ffffff' }}>
              Pilih Provider Payment Gateway untuk Owner Bisnis
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '4px 0 16px' }}>
              Integrasikan akun Midtrans atau Xendit agar POS kasir bisa memunculkan QRIS Dinamis otomatis (nominal pas & auto-lunas) serta Virtual Account bank yang langsung disalurkan ke rekening/e-wallet owner.
            </p>

            {/* Provider Switcher Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 20 }}>
              {/* Option 1: Midtrans */}
              <div
                onClick={() => setGatewayConfig({ ...gatewayConfig, active_gateway: 'midtrans' })}
                style={{
                  padding: 16,
                  borderRadius: 12,
                  cursor: 'pointer',
                  border: gatewayConfig.active_gateway === 'midtrans' ? '2px solid #8b5cf6' : '1px solid var(--border)',
                  background: gatewayConfig.active_gateway === 'midtrans' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(15, 20, 42, 0.4)',
                  transition: 'all 0.18s ease',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#38bdf8' }}>
                    MIDTRANS
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: 'rgba(56, 189, 248, 0.2)',
                      color: '#38bdf8',
                    }}
                  >
                    ⭐ Rekomendasi POS
                  </span>
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '8px 0 0' }}>
                  QRIS Dinamis GoPay, ShopeePay & Semua Bank. Tercepat untuk verifikasi di kasir POS dan biaya VA hemat (Rp 4.000).
                </p>
              </div>

              {/* Option 2: Xendit */}
              <div
                onClick={() => setGatewayConfig({ ...gatewayConfig, active_gateway: 'xendit' })}
                style={{
                  padding: 16,
                  borderRadius: 12,
                  cursor: 'pointer',
                  border: gatewayConfig.active_gateway === 'xendit' ? '2px solid #8b5cf6' : '1px solid var(--border)',
                  background: gatewayConfig.active_gateway === 'xendit' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(15, 20, 42, 0.4)',
                  transition: 'all 0.18s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#34d399' }}>
                    XENDIT
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: '#34d399',
                    }}
                  >
                    Disbursement Unggul
                  </span>
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '8px 0 0' }}>
                  Sangat unggul untuk auto-payout ke multi-rekening pemilik dan invoice link tagihan piutang via WhatsApp.
                </p>
              </div>

              {/* Option 3: Manual Transfer Only */}
              <div
                onClick={() => setGatewayConfig({ ...gatewayConfig, active_gateway: 'none' })}
                style={{
                  padding: 16,
                  borderRadius: 12,
                  cursor: 'pointer',
                  border: gatewayConfig.active_gateway === 'none' ? '2px solid #94a3b8' : '1px solid var(--border)',
                  background: gatewayConfig.active_gateway === 'none' ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 20, 42, 0.4)',
                  transition: 'all 0.18s ease',
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 800, color: '#94a3b8' }}>
                  Manual (Direct Rekening & E-Wallet)
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '8px 0 0' }}>
                  Hanya gunakan nomor rekening bank & QRIS statis stiker toko Anda. Tanpa potongan fee gateway, kasir cek mutasi manual.
                </p>
              </div>
            </div>

            {/* Mode Environment (Sandbox vs Production) */}
            {gatewayConfig.active_gateway !== 'none' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid var(--border)',
                  marginBottom: 20,
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
                    Lingkungan API ({gatewayConfig.environment === 'production' ? '🚀 LIVE PRODUCTION' : '🧪 SANDBOX / UJI COBA'})
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    {gatewayConfig.environment === 'production'
                      ? 'Transaksi nyata dengan uang sungguhan.'
                      : 'Transaksi pura-pura untuk testing kasir tanpa uang asli.'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setGatewayConfig({ ...gatewayConfig, environment: 'sandbox' })}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      background: gatewayConfig.environment === 'sandbox' ? '#f59e0b' : 'rgba(255, 255, 255, 0.05)',
                      color: gatewayConfig.environment === 'sandbox' ? '#000000' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    🧪 Sandbox (Uji Coba)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGatewayConfig({ ...gatewayConfig, environment: 'production' })}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      background: gatewayConfig.environment === 'production' ? '#10b981' : 'rgba(255, 255, 255, 0.05)',
                      color: gatewayConfig.environment === 'production' ? '#ffffff' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    🚀 Production (Live)
                  </button>
                </div>
              </div>
            )}

            {/* Form Midtrans Credentials */}
            {gatewayConfig.active_gateway === 'midtrans' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Midtrans Server Key (Rahasia) *</span>
                    <a
                      href="https://dashboard.midtrans.com/settings/access_keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 11.5, color: '#38bdf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      Ambil Key di Dashboard Midtrans <ExternalLink size={12} />
                    </a>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showMidtransKey ? 'text' : 'password'}
                      className="form-control"
                      placeholder="Contoh: SB-Mid-server-xxxxxxxxxxxx"
                      value={gatewayConfig.midtrans_server_key}
                      onChange={(e) => setGatewayConfig({ ...gatewayConfig, midtrans_server_key: e.target.value })}
                      style={{ paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowMidtransKey(!showMidtransKey)}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {showMidtransKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Digunakan backend untuk membuat QRIS dinamis dan verifikasi notifikasi pembayaran webhook.
                  </span>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Midtrans Client Key *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: SB-Mid-client-xxxxxxxxxxxx"
                    value={gatewayConfig.midtrans_client_key}
                    onChange={(e) => setGatewayConfig({ ...gatewayConfig, midtrans_client_key: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Midtrans Merchant ID (Opsional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: G123456789"
                    value={gatewayConfig.midtrans_merchant_id}
                    onChange={(e) => setGatewayConfig({ ...gatewayConfig, midtrans_merchant_id: e.target.value })}
                  />
                </div>

                {/* Midtrans Webhook Notification URL Box */}
                <div style={{
                  padding: 14,
                  borderRadius: 12,
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Globe size={15} /> URL Webhook / Payment Notification
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const webhookUrl = `${window.location.protocol}//${window.location.hostname}:8000/api/payment-gateways/midtrans/webhook`;
                        navigator.clipboard.writeText(webhookUrl);
                        toast.success('URL Webhook Midtrans berhasil disalin!');
                      }}
                      style={{
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        borderRadius: 6,
                        color: '#38bdf8',
                        padding: '3px 8px',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <Copy size={12} /> Salin URL Webhook
                    </button>
                  </div>
                  <div className="mono" style={{ fontSize: 11.5, color: '#e0f2fe', wordBreak: 'break-all', background: 'rgba(0,0,0,0.35)', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                    {`${window.location.protocol}//${window.location.hostname}:8000/api/payment-gateways/midtrans/webhook`}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
                    💡 <strong>Cara Pakai:</strong> Buka portal <strong>Midtrans Dashboard &gt; Settings &gt; Configuration</strong>, lalu tempelkan (paste) URL di atas pada kolom <strong>Payment Notification URL</strong>. Dengan ini, ketika customer scan &amp; bayar QRIS di kasir, sistem POS akan otomatis mendeteksi transaksi lunas secara real-time!
                  </div>
                </div>
              </div>
            )}

            {/* Form Xendit Credentials */}
            {gatewayConfig.active_gateway === 'xendit' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Xendit Secret API Key *</span>
                    <a
                      href="https://dashboard.xendit.co/settings/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 11.5, color: '#34d399', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      Ambil Key di Dashboard Xendit <ExternalLink size={12} />
                    </a>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showXenditKey ? 'text' : 'password'}
                      className="form-control"
                      placeholder="Contoh: xnd_development_xxxxxxxxxxxx"
                      value={gatewayConfig.xendit_secret_key}
                      onChange={(e) => setGatewayConfig({ ...gatewayConfig, xendit_secret_key: e.target.value })}
                      style={{ paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowXenditKey(!showXenditKey)}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {showXenditKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Xendit Public Key (Opsional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: xnd_public_development_xxxxxxxxxxxx"
                    value={gatewayConfig.xendit_public_key}
                    onChange={(e) => setGatewayConfig({ ...gatewayConfig, xendit_public_key: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Webhook Verification Token (Opsional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Token untuk memvalidasi webhook notifikasi dari Xendit"
                    value={gatewayConfig.xendit_webhook_token}
                    onChange={(e) => setGatewayConfig({ ...gatewayConfig, xendit_webhook_token: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* Feature Toggles (Visible if gateway is active) */}
            {gatewayConfig.active_gateway !== 'none' && (
              <div
                style={{
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
                  Metode Pembayaran yang Diaktifkan di POS:
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'rgba(0, 0, 0, 0.2)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={gatewayConfig.enable_qris}
                      onChange={(e) => setGatewayConfig({ ...gatewayConfig, enable_qris: e.target.checked })}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>QRIS Dinamis Otomatis</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        Muncul QRIS dengan nominal pas di layar kasir, auto-lunas saat dibayar.
                      </div>
                    </div>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'rgba(0, 0, 0, 0.2)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={gatewayConfig.enable_va}
                      onChange={(e) => setGatewayConfig({ ...gatewayConfig, enable_va: e.target.checked })}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>Virtual Account (VA) Bank</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        Nomor rekening virtual unik per transaksi (BCA, Mandiri, BRI, BNI).
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div
              style={{
                marginTop: 24,
                paddingTop: 16,
                borderTop: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              {gatewayConfig.active_gateway !== 'none' ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <RefreshCw size={14} className={testingConnection ? 'animate-spin' : ''} />
                  <span>{testingConnection ? 'Menguji API...' : '🧪 Uji Koneksi API Real-Time'}</span>
                </button>
              ) : <div />}

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveGateway}
                disabled={savingGateway}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <Check size={16} />
                <span>{savingGateway ? 'Menyimpan...' : 'Simpan Konfigurasi Gateway'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 3: MANA LEBIH BAGUS? (MIDTRANS VS XENDIT)
          ======================================================== */}
      {activeTab === 'comparison' && (
        <div style={{ maxWidth: 900 }}>
          {/* Executive Summary Card */}
          <div
            className="card mb-4"
            style={{
              padding: '20px 24px',
              borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.08))',
              border: '1.5px solid rgba(139, 92, 246, 0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>💡</span>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#ffffff' }}>
                  Rekomendasi untuk Platform SaaS: Pilih Midtrans atau Xendit?
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                  Kedua gateway berizin resmi Bank Indonesia ini sangat handal. Berikut panduan memilih sesuai model bisnis penyewaan software POS Anda:
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginTop: 18 }}>
              {/* Midtrans recommendation */}
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: 16, borderRadius: 10, border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8', fontWeight: 800, fontSize: 14 }}>
                  <span>🏆 PILIH MIDTRANS JIKA:</span>
                </div>
                <ul style={{ fontSize: 12.5, color: '#e2e8f0', margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
                  <li>Fokus utama adalah <strong>QRIS Kasir POS (Offline / Toko Fisik)</strong>. Midtrans bagian dari GoTo sehingga ekosistem QRIS GoPay/Shopee/Semua Bank sangat cepat (1-2 detik auto lunas).</li>
                  <li>Ingin <strong>biaya Virtual Account lebih hemat</strong> (Rp 4.000 / transaksi sukses flat).</li>
                  <li>Setiap Owner Bisnis mendaftar akun Midtrans mereka sendiri (BYOK - Bring Your Own Keys) sehingga uang 100% langsung masuk ke rekening/e-wallet owner tanpa lewat rekening platform.</li>
                </ul>
              </div>

              {/* Xendit recommendation */}
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: 16, borderRadius: 10, border: '1px solid rgba(52, 211, 153, 0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#34d399', fontWeight: 800, fontSize: 14 }}>
                  <span>🏆 PILIH XENDIT JIKA:</span>
                </div>
                <ul style={{ fontSize: 12.5, color: '#e2e8f0', margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
                  <li>Platform ingin <strong>Disbursement / Auto-Payout Otomatis</strong> ke rekening bank / e-wallet masing-masing owner bisnis setiap malam.</li>
                  <li>Mendukung fitur <strong>XenPlatform (Split Payment)</strong>: jika platform ingin mengambil komisi fee SaaS per transaksi otomatis.</li>
                  <li>Fitur tagihan WhatsApp invoice untuk pelanggan grosir/kasbon.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Head to Head Comparison Table */}
          <div className="card mb-4" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#ffffff' }}>
                Tabel Perbandingan Lengkap: Midtrans vs Xendit
              </h4>
            </div>
            <div className="table-wrap" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '28%' }}>Parameter Evaluasi</th>
                    <th style={{ width: '36%', color: '#38bdf8' }}>MIDTRANS</th>
                    <th style={{ width: '36%', color: '#34d399' }}>XENDIT</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Biaya QRIS (MDR)</td>
                    <td><strong style={{ color: '#34d399' }}>0.7%</strong> (Standar Bank Indonesia)</td>
                    <td><strong style={{ color: '#34d399' }}>0.7%</strong> (Standar Bank Indonesia)</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Biaya Virtual Account (VA)</td>
                    <td><strong style={{ color: '#38bdf8' }}>Rp 4.000</strong> / transaksi sukses (BCA, Mandiri, BRI, BNI, Permata)</td>
                    <td><strong>Rp 4.500</strong> / transaksi sukses (BCA, Mandiri, BRI, BNI, BSI)</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Kecepatan Deteksi QRIS di POS</td>
                    <td><strong style={{ color: '#34d399' }}>Sangat Cepat (1-2 detik)</strong> langsung trigger webhook lunas</td>
                    <td><strong>Cepat (2-4 detik)</strong></td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Penyaluran Dana ke Owner (Payout)</td>
                    <td>H+1 / H+2 ke rekening bank owner terdaftar di Midtrans</td>
                    <td><strong style={{ color: '#34d399' }}>Real-time / Instan</strong> (API Disbursement ke Bank &amp; E-Wallet)</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Kemudahan Pendaftaran Akun</td>
                    <td>Sangat mudah untuk perorangan/UMKM (cukup KTP &amp; Rekening Bank)</td>
                    <td>Mudah, namun untuk akun korporat membutuhkan dokumen legalitas lebih lengkap</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Simulator Sandbox Testing</td>
                    <td><strong style={{ color: '#38bdf8' }}>Terbaik &amp; Terlengkap</strong> (ada web simulator QRIS &amp; VA langsung)</td>
                    <td>Sangat baik melalui Dashboard test</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: DAFTAR / EDIT REKENING BANK ATAU E-WALLET
          ======================================================== */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 540,
              padding: 24,
              borderRadius: 16,
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-strong)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: 'var(--accent-bright)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {formAccount.account_type === 'EWALLET' ? <Smartphone size={18} /> : <Landmark size={18} />}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#ffffff' }}>
                  {editingAccount
                    ? (formAccount.account_type === 'EWALLET' ? 'Edit Akun E-Wallet Owner' : 'Edit Rekening Bank Owner')
                    : 'Daftarkan Akun Penerimaan Dana'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Type Switcher inside Modal: Bank vs E-Wallet */}
            {!editingAccount && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                  background: 'rgba(0, 0, 0, 0.25)',
                  padding: 4,
                  borderRadius: 10,
                  marginBottom: 16,
                  border: '1px solid var(--border)',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setFormAccount({
                      ...formAccount,
                      account_type: 'BANK',
                      bank_name: 'BCA (Bank Central Asia)',
                      bank_code: 'BCA',
                    });
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '8px',
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: formAccount.account_type === 'BANK' ? 700 : 500,
                    border: 'none',
                    cursor: 'pointer',
                    background: formAccount.account_type === 'BANK' ? 'var(--accent)' : 'transparent',
                    color: formAccount.account_type === 'BANK' ? '#ffffff' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Landmark size={15} /> Rekening Bank
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFormAccount({
                      ...formAccount,
                      account_type: 'EWALLET',
                      bank_name: 'GoPay (GoTo / GoBiz)',
                      bank_code: 'GOPAY',
                    });
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '8px',
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: formAccount.account_type === 'EWALLET' ? 700 : 500,
                    border: 'none',
                    cursor: 'pointer',
                    background: formAccount.account_type === 'EWALLET' ? 'var(--accent)' : 'transparent',
                    color: formAccount.account_type === 'EWALLET' ? '#ffffff' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Smartphone size={15} /> E-Wallet (GoPay, OVO, DANA)
                </button>
              </div>
            )}

            <form onSubmit={handleSaveAccount} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Bank or E-Wallet Provider Selection */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">
                  {formAccount.account_type === 'EWALLET' ? 'Penyedia E-Wallet *' : 'Nama Bank *'}
                </label>
                <select
                  className="form-control"
                  value={formAccount.bank_name}
                  onChange={(e) => {
                    if (formAccount.account_type === 'EWALLET') {
                      const sel = POPULAR_EWALLETS.find((ew) => ew.name === e.target.value);
                      setFormAccount({
                        ...formAccount,
                        bank_name: e.target.value,
                        bank_code: sel ? sel.code : 'EWALLET',
                      });
                    } else {
                      const sel = POPULAR_BANKS.find((b) => b.name === e.target.value);
                      setFormAccount({
                        ...formAccount,
                        bank_name: e.target.value,
                        bank_code: sel ? sel.code : 'OTHER',
                      });
                    }
                  }}
                >
                  {formAccount.account_type === 'EWALLET'
                    ? POPULAR_EWALLETS.map((ew) => (
                        <option key={ew.code} value={ew.name}>
                          {ew.name}
                        </option>
                      ))
                    : POPULAR_BANKS.map((b) => (
                        <option key={b.code} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                </select>
              </div>

              {/* Account Number / Phone Number */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">
                  {formAccount.account_type === 'EWALLET'
                    ? 'Nomor Handphone Terdaftar di E-Wallet *'
                    : 'Nomor Rekening Bank *'}
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder={
                    formAccount.account_type === 'EWALLET'
                      ? 'Contoh: 081234567890 (Nomor GoPay / OVO / DANA)'
                      : 'Contoh: 005001005015564'
                  }
                  value={formAccount.account_number}
                  onChange={(e) => setFormAccount({ ...formAccount, account_number: e.target.value })}
                  required
                />
              </div>

              {/* Account Holder */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">
                  {formAccount.account_type === 'EWALLET'
                    ? 'Nama Akun / Nama Pemilik di E-Wallet *'
                    : 'Atas Nama Pemilik Rekening *'}
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Contoh: NAMA LENGKAP OWNER BISNIS"
                  value={formAccount.account_holder}
                  onChange={(e) => setFormAccount({ ...formAccount, account_holder: e.target.value })}
                  required
                />
              </div>

              {/* Payout Schedule */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Jadwal Pencairan Dana (Payout Schedule)</label>
                <select
                  className="form-control"
                  value={formAccount.payout_schedule}
                  onChange={(e) => setFormAccount({ ...formAccount, payout_schedule: e.target.value })}
                >
                  <option value="DAILY">🌙 Harian Otomatis (Tutup Buku Setiap Malam 23:59)</option>
                  <option value="INSTANT">⚡ Real-time (Langsung Masuk Sesaat Setelah Transaksi Kasir)</option>
                  <option value="MANUAL">📅 Manual (Sesuai Pengajuan Tarik Dana Owner)</option>
                </select>
              </div>

              {/* Branch (Bank only) */}
              {formAccount.account_type === 'BANK' && (
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">KCP / Kantor Cabang Bank (Opsional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: KCP Sudirman / Cabang Makassar"
                    value={formAccount.branch}
                    onChange={(e) => setFormAccount({ ...formAccount, branch: e.target.value })}
                  />
                </div>
              )}

              {/* Outlet Binding */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Berlaku untuk Cabang Outlet</label>
                <select
                  className="form-control"
                  value={formAccount.outlet_id}
                  onChange={(e) => setFormAccount({ ...formAccount, outlet_id: e.target.value })}
                >
                  <option value="">Semua Cabang (Global Usaha)</option>
                  {outlets?.map((ot) => (
                    <option key={ot.id} value={ot.id}>
                      {ot.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* QRIS URL / Image */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">URL Foto / Gambar Stiker QRIS Toko (Opsional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Contoh: https://... / URL gambar QRIS statis stiker"
                  value={formAccount.qr_image_url}
                  onChange={(e) => setFormAccount({ ...formAccount, qr_image_url: e.target.value })}
                />
              </div>

              {/* Notes */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Catatan Tambahan (Opsional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Contoh: Rekening utama penerimaan kasir"
                  value={formAccount.notes}
                  onChange={(e) => setFormAccount({ ...formAccount, notes: e.target.value })}
                />
              </div>

              {/* Primary Toggle */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'rgba(0, 0, 0, 0.2)',
                  cursor: 'pointer',
                  marginTop: 4,
                }}
              >
                <input
                  type="checkbox"
                  checked={formAccount.is_primary}
                  onChange={(e) => setFormAccount({ ...formAccount, is_primary: e.target.checked })}
                />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#ffffff' }}>
                  Jadikan sebagai Rekening / E-Wallet Utama Penerimaan Dana Transaksi
                </span>
              </label>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingAccount
                    ? 'Simpan Perubahan'
                    : formAccount.account_type === 'EWALLET'
                    ? 'Daftarkan E-Wallet'
                    : 'Daftarkan Rekening'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
