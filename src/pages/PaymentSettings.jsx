import { useState, useEffect } from 'react';
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
  FileCheck,
  Sliders
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

export default function PaymentSettings() {
  const { outlets } = useOutlet();
  const [activeTab, setActiveTab] = useState('accounts'); // 'accounts', 'gateway', 'comparison'
  const [loading, setLoading] = useState(false);

  // Bank Accounts State
  const [bankAccounts, setBankAccounts] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [formAccount, setFormAccount] = useState({
    bank_name: 'BCA (Bank Central Asia)',
    bank_code: 'BCA',
    account_number: '',
    account_holder: '',
    branch: '',
    outlet_id: '',
    qr_image_url: '',
    is_primary: false,
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
      toast.error('Gagal memuat daftar rekening bank');
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

  function handleOpenCreateModal() {
    setEditingAccount(null);
    setFormAccount({
      bank_name: 'BCA (Bank Central Asia)',
      bank_code: 'BCA',
      account_number: '',
      account_holder: '',
      branch: '',
      outlet_id: '',
      qr_image_url: '',
      is_primary: bankAccounts.length === 0,
      notes: '',
    });
    setModalOpen(true);
  }

  function handleOpenEditModal(acc) {
    setEditingAccount(acc);
    setFormAccount({
      bank_name: acc.bank_name || 'BCA (Bank Central Asia)',
      bank_code: acc.bank_code || 'BCA',
      account_number: acc.account_number || '',
      account_holder: acc.account_holder || '',
      branch: acc.branch || '',
      outlet_id: acc.outlet_id ? String(acc.outlet_id) : '',
      qr_image_url: acc.qr_image_url || '',
      is_primary: Boolean(acc.is_primary),
      notes: acc.notes || '',
    });
    setModalOpen(true);
  }

  async function handleSaveAccount(e) {
    e.preventDefault();
    if (!formAccount.account_number.trim() || !formAccount.account_holder.trim()) {
      toast.error('Nomor rekening dan nama pemilik wajib diisi');
      return;
    }

    try {
      const payload = {
        ...formAccount,
        outlet_id: formAccount.outlet_id || null,
      };

      if (editingAccount) {
        await api.put(`/bank-accounts/${editingAccount.id}`, payload);
        toast.success('Data rekening berhasil diperbarui');
      } else {
        await api.post('/bank-accounts', payload);
        toast.success('Nomor rekening berhasil didaftarkan');
      }
      setModalOpen(false);
      fetchBankAccounts();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Gagal menyimpan data rekening');
    }
  }

  async function handleDeleteAccount(id, name) {
    if (!window.confirm(`Yakin ingin menghapus rekening ${name}?`)) return;
    try {
      await api.delete(`/bank-accounts/${id}`);
      toast.success('Nomor rekening berhasil dihapus');
      fetchBankAccounts();
    } catch (err) {
      console.error(err);
      toast.error('Gagal menghapus nomor rekening');
    }
  }

  async function handleSetPrimary(id) {
    try {
      await api.patch(`/bank-accounts/${id}/set-primary`);
      toast.success('Rekening berhasil dijadikan sebagai rekening utama');
      fetchBankAccounts();
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengubah rekening utama');
    }
  }

  async function handleToggleActive(id) {
    try {
      await api.patch(`/bank-accounts/${id}/toggle-active`);
      toast.success('Status aktif rekening diperbarui');
      fetchBankAccounts();
    } catch (err) {
      console.error(err);
      toast.error('Gagal memperbarui status aktif');
    }
  }

  function handleCopyNumber(num, id) {
    navigator.clipboard.writeText(num);
    setCopiedId(id);
    toast.success(`Nomor rekening ${num} disalin ke clipboard`);
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

  function getBankMeta(bankName) {
    const found = POPULAR_BANKS.find((b) => bankName?.toUpperCase().includes(b.code));
    return found || {
      name: bankName,
      code: 'BANK',
      color: '#6366f1',
      gradient: 'linear-gradient(135deg, #1e1b4b, #4338ca)',
    };
  }

  return (
    <div>
      {/* Page Header */}
      <PageHeader
        title="Rekening & Payment Gateway"
        subtitle="Daftarkan nomor rekening bank usaha, QRIS statis outlet, dan integrasikan pembayaran QRIS & Transfer Bank otomatis via Midtrans / Xendit."
      />

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
          <CreditCard size={16} /> Daftar Nomor Rekening & QRIS ({bankAccounts.length})
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
          <Zap size={16} /> Payment Gateway (Midtrans / Xendit)
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
          TAB 1: DAFTAR REKENING BANK & QRIS TOKO
          ======================================================== */}
      {activeTab === 'accounts' && (
        <div>
          {/* Header Action Bar */}
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
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#ffffff' }}>
                Rekening Penerima Pembayaran Toko
              </h3>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                Rekening ini akan tampil di kasir POS saat memilih metode bayar Transfer Bank atau QRIS.
              </p>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleOpenCreateModal}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <Plus size={16} /> Daftarkan Rekening Baru
            </button>
          </div>

          {loading ? (
            <LoadingState />
          ) : bankAccounts.length === 0 ? (
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
                <Landmark size={28} />
              </div>
              <h4 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#ffffff' }}>
                Belum Ada Nomor Rekening Terdaftar
              </h4>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 440, margin: '8px auto 20px' }}>
                Daftarkan nomor rekening bank (BCA, Mandiri, BRI, dll) atau upload QRIS toko Anda agar kasir dapat menerima pembayaran non-tunai dengan mudah.
              </p>
              <button className="btn btn-primary" onClick={handleOpenCreateModal}>
                <Plus size={16} /> Daftarkan Rekening Sekarang
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: 16,
              }}
            >
              {bankAccounts.map((acc) => {
                const meta = getBankMeta(acc.bank_name);
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
                      boxShadow: acc.is_primary ? '0 4px 20px rgba(139, 92, 246, 0.2)' : 'none',
                    }}
                  >
                    {/* Atmospheric Card Header with Bank Style Gradient */}
                    <div
                      style={{
                        padding: '16px 18px',
                        background: meta.gradient,
                        position: 'relative',
                        color: '#ffffff',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8, fontWeight: 700 }}>
                            {acc.outlet?.name ? `Cabang: ${acc.outlet.name}` : 'Semua Cabang (Global)'}
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4, letterSpacing: '-0.01em' }}>
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
                            <Star size={12} fill="#ffffff" /> Utama
                          </span>
                        )}
                      </div>

                      {/* Chip & Wi-Fi Icon Visual Embellishment */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, opacity: 0.85 }}>
                        <div
                          style={{
                            width: 32,
                            height: 24,
                            borderRadius: 4,
                            background: 'rgba(255, 215, 0, 0.75)',
                            border: '1px solid rgba(255, 255, 255, 0.4)',
                          }}
                        />
                        <div style={{ fontSize: 10, letterSpacing: '0.12em' }}>ELECTRONIC USE ONLY</div>
                      </div>

                      {/* Account Number */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: 12,
                          background: 'rgba(0, 0, 0, 0.25)',
                          padding: '6px 10px',
                          borderRadius: 8,
                        }}
                      >
                        <span style={{ fontSize: 16, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.08em' }}>
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
                          title="Salin nomor rekening"
                        >
                          {copiedId === acc.id ? <Check size={14} /> : <Copy size={14} />}
                          <span>{copiedId === acc.id ? 'Tersalin' : 'Salin'}</span>
                        </button>
                      </div>

                      {/* Account Holder */}
                      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 8, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                        {acc.account_holder}
                      </div>
                    </div>

                    {/* Card Body & Action Controls */}
                    <div style={{ padding: '14px 18px' }}>
                      {acc.branch && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                          KCP/Cabang: <strong>{acc.branch}</strong>
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
                          <QrCode size={14} /> Memiliki QRIS Stiker Terlampir
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
                              title="Jadikan sebagai rekening utama toko"
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
                            title="Edit rekening"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteAccount(acc.id, `${acc.bank_name} (${acc.account_number})`)}
                            title="Hapus rekening"
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
        <div style={{ maxWidth: 840 }}>
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
              Pilih Provider Payment Gateway
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '4px 0 16px' }}>
              Integrasikan akun Midtrans atau Xendit agar POS kasir bisa memunculkan QRIS Dinamis otomatis (nominal pas & auto-lunas) serta Virtual Account bank.
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
                  Manual (Tanpa Gateway)
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '8px 0 0' }}>
                  Hanya gunakan nomor rekening bank & QRIS statis stiker toko Anda. Tanpa potongan fee gateway, kasir cek manual.
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
                  Rekomendasi Ahli untuk MOVA POS: Pilih Midtrans atau Xendit?
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                  Keduanya adalah Payment Gateway berizin resmi Bank Indonesia terbaik dan terpercaya di Indonesia. Berikut panduan memilih sesuai kebutuhan spesifik usaha Anda:
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
                  <li>Fokus utama adalah <strong>QRIS Kasir POS (Offline / Toko Fisik)</strong>. Midtrans bagian dari GoTo sehingga ekosistem QRIS GoPay/Shopee/Semua Bank sangat cepat.</li>
                  <li>Ingin <strong>biaya Virtual Account lebih murah</strong> (Rp 4.000 / transaksi sukses flat).</li>
                  <li>Ingin lingkungan <strong>Sandbox / testing paling mudah</strong> tanpa ribet syarat dokumen di awal masa uji coba.</li>
                </ul>
              </div>

              {/* Xendit recommendation */}
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: 16, borderRadius: 10, border: '1px solid rgba(52, 211, 153, 0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#34d399', fontWeight: 800, fontSize: 14 }}>
                  <span>🏆 PILIH XENDIT JIKA:</span>
                </div>
                <ul style={{ fontSize: 12.5, color: '#e2e8f0', margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
                  <li>Membutuhkan <strong>Disbursement / Auto-Payout otomatis</strong> (uang penjualan langsung ditransfer ke rekening pribadi owner setiap malam).</li>
                  <li>Memiliki banyak cabang dan ingin uang penjualan cabang A masuk rekening A, cabang B masuk rekening B secara otomatis.</li>
                  <li>Sering mengirim invoice tagihan piutang / kasbon lewat WhatsApp.</li>
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
                    <td style={{ fontWeight: 600 }}>Pencairan Dana (Settlement)</td>
                    <td>H+1 / H+2 hari kerja (dapat ditarik ke rekening bank terdaftar)</td>
                    <td><strong style={{ color: '#34d399' }}>Instan / Real-time</strong> (tersedia fitur auto-disbursement)</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Kemudahan Pendaftaran Akun</td>
                    <td>Sangat mudah untuk perorangan/UMKM (cukup KTP & Rekening Bank)</td>
                    <td>Mudah, namun untuk akun korporat membutuhkan dokumen legalitas lebih lengkap</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Simulator Sandbox Testing</td>
                    <td><strong style={{ color: '#38bdf8' }}>Terbaik & Terlengkap</strong> (ada web simulator QRIS & VA langsung)</td>
                    <td>Sangat baik melalui Dashboard test</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Kesimpulan Terbaik</td>
                    <td><strong style={{ color: '#38bdf8' }}>Paling Ideal untuk Kasir POS Offline & Toko</strong></td>
                    <td><strong style={{ color: '#34d399' }}>Paling Ideal untuk Payout Otomatis & Tagihan WA</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Step-by-Step Setup Guide */}
          <div className="card" style={{ padding: 22 }}>
            <h4 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#ffffff' }}>
              Cara Mendaftar & Mengambil API Key:
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {/* Midtrans steps */}
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: 8 }}>
                  1. Panduan Midtrans
                </div>
                <ol style={{ fontSize: 12, color: 'var(--text-secondary)', paddingLeft: 18, margin: 0, lineHeight: 1.7 }}>
                  <li>Buka <a href="https://midtrans.com" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}>midtrans.com</a> dan daftar akun gratis.</li>
                  <li>Login ke Dashboard Midtrans. Di pojok kiri atas, pilih mode <strong>Sandbox</strong> (untuk test) atau <strong>Production</strong>.</li>
                  <li>Buka menu <strong>Settings &gt; Access Keys</strong>.</li>
                  <li>Salin <strong>Server Key</strong> dan <strong>Client Key</strong>.</li>
                  <li>Tempelkan ke tab <em>Payment Gateway</em> di MOVA POS ini, lalu klik <strong>Uji Koneksi</strong>.</li>
                </ol>
              </div>

              {/* Xendit steps */}
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 700, color: '#34d399', marginBottom: 8 }}>
                  2. Panduan Xendit
                </div>
                <ol style={{ fontSize: 12, color: 'var(--text-secondary)', paddingLeft: 18, margin: 0, lineHeight: 1.7 }}>
                  <li>Buka <a href="https://xendit.co" target="_blank" rel="noopener noreferrer" style={{ color: '#34d399' }}>xendit.co</a> dan buat akun bisnis Anda.</li>
                  <li>Login ke Dashboard Xendit. Pilih mode <strong>Test Data</strong> atau <strong>Live Data</strong>.</li>
                  <li>Buka menu <strong>Settings &gt; Developers &gt; API Keys</strong>.</li>
                  <li>Klik <em>Generate Secret Key</em> dengan izin Read &amp; Write.</li>
                  <li>Salin Secret Key ke tab <em>Payment Gateway</em> di MOVA POS ini, lalu klik <strong>Uji Koneksi</strong>.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: DAFTAR / EDIT NOMOR REKENING BANK
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
              maxWidth: 520,
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
                  <Landmark size={18} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#ffffff' }}>
                  {editingAccount ? 'Edit Nomor Rekening' : 'Daftarkan Nomor Rekening Baru'}
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

            <form onSubmit={handleSaveAccount} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Bank Selection */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Nama Bank *</label>
                <select
                  className="form-control"
                  value={formAccount.bank_name}
                  onChange={(e) => {
                    const sel = POPULAR_BANKS.find((b) => b.name === e.target.value);
                    setFormAccount({
                      ...formAccount,
                      bank_name: e.target.value,
                      bank_code: sel ? sel.code : 'OTHER',
                    });
                  }}
                >
                  {POPULAR_BANKS.map((b) => (
                    <option key={b.code} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Account Number */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Nomor Rekening *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Contoh: 005001005015564"
                  value={formAccount.account_number}
                  onChange={(e) => setFormAccount({ ...formAccount, account_number: e.target.value })}
                  required
                />
              </div>

              {/* Account Holder */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Atas Nama Pemilik Rekening *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Contoh: PT MOVA BISNIS INDONESIA / NAMA OWNER"
                  value={formAccount.account_holder}
                  onChange={(e) => setFormAccount({ ...formAccount, account_holder: e.target.value })}
                  required
                />
              </div>

              {/* Branch */}
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
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Jika dipilih cabang tertentu, rekening ini hanya akan muncul saat kasir berada di cabang tersebut.
                </span>
              </div>

              {/* QRIS URL / Image */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">URL Foto / Gambar QRIS Statis Toko (Opsional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Contoh: https://... / URL foto QRIS stiker meja"
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
                  placeholder="Contoh: Rekening penampungan kasir shift pagi"
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
                  Jadikan sebagai Rekening Utama Penerima Pembayaran
                </span>
              </label>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingAccount ? 'Simpan Perubahan' : 'Daftarkan Rekening'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
