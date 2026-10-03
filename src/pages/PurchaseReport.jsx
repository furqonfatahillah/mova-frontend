import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../api/client';
import { rupiah, LoadingState, PageHeader } from '../components/ui';
import { useOutlet } from '../context/OutletContext';
import { getTodayStr, getMonthStartStr } from '../utils/date';
import toast from 'react-hot-toast';
import {
  ShoppingBag,
  FileSpreadsheet,
  Printer,
  Search,
  RefreshCw,
  Calendar,
  Store,
  CreditCard,
  Truck,
  Building2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  Coins,
  Receipt,
  FileText,
  DollarSign,
  X
} from 'lucide-react';
import { printElement } from '../utils/print';
import {
  exportPurchaseTransactionsToExcel,
  exportPurchasesByProductToExcel,
  exportPurchasesBySupplierToExcel,
  exportSupplierPayablesToExcel,
  exportPurchaseShipmentsToExcel,
} from '../utils/exportReport';

const TABS = [
  {
    id: 'transactions',
    label: 'Transaksi Pembelian (Barang Masuk)',
    icon: ShoppingBag,
    title: 'Laporan Transaksi Pembelian',
    desc: 'Buku besar detail penerimaan barang masuk lengkap dengan harga, konversi satuan, status terima, PPN, dan metode pembayaran.',
  },
  {
    id: 'by-product',
    label: 'Pembelian per Produk',
    icon: Receipt,
    title: 'LAPORAN PEMBELIAN PER PRODUK',
    desc: 'Rekapitulasi volume kuantitas beli, refund, satuan beli, rata-rata harga, diskon, dan total nilai belanja per bahan baku / produk.',
  },
  {
    id: 'by-supplier',
    label: 'Pembelian per Supplier',
    icon: Building2,
    title: 'LAPORAN DAFTAR PEMBELIAN PER SUPPLIER',
    desc: 'Daftar transaksi belanja yang dikelompokkan berdasarkan vendor/supplier lengkap dengan nilai pembelian, pajak, ongkir, dan sisa hutang.',
  },
  {
    id: 'payables',
    label: 'Hutang Supplier (Tempo)',
    icon: Clock,
    title: 'LAPORAN HUTANG SUPPLIER (TEMPO)',
    desc: 'Buku hutang dagang / tempo supplier holding, riwayat pembayaran cicilan, jatuh tempo, dan sisa kewajiban aktif.',
  },
  {
    id: 'shipments',
    label: 'Pengiriman Pembelian',
    icon: Truck,
    title: 'LAPORAN PENGIRIMAN PEMBELIAN',
    desc: 'Monitoring status logistik pengadaan barang masuk (ekspedisi, kurir, nomor resi, in-transit, dan konfirmasi terima gudang).',
  },
];

export default function PurchaseReport() {
  const { selectedOutletId, activeOutletId, outlets, dateRange, currentBusiness, currentUser } = useOutlet();
  const currentOutletId = activeOutletId || selectedOutletId;
  const businessName = currentBusiness?.name || currentUser?.business?.name || 'MOVA POS';
  const outletName = (currentOutletId && currentOutletId !== 'ALL' && currentOutletId !== 'all')
    ? (outlets.find(o => String(o.id) === String(currentOutletId))?.name || 'Cabang Terpilih')
    : 'Semua Cabang (Konsolidasi)';

  // Active Tab
  const [activeTab, setActiveTab] = useState('transactions');

  // Active Period (100% synchronized with global navbar dateRange)
  const activePeriod = useMemo(() => ({
    from: dateRange?.from || getMonthStartStr(),
    to: dateRange?.to || getTodayStr(),
  }), [dateRange?.from, dateRange?.to]);

  const from = activePeriod.from;
  const to = activePeriod.to;

  // Active Outlet (100% synchronized with global navbar activeOutletId)
  const filterOutlet = useMemo(() => {
    if (!currentOutletId || currentOutletId === 'ALL' || currentOutletId === 'all') {
      return 'ALL';
    }
    return String(currentOutletId);
  }, [currentOutletId]);

  // Filter States (Payment, Supplier, Search)
  const [filterPayment, setFilterPayment] = useState('ALL');
  const [filterSupplier, setFilterSupplier] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Data States
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [suppliersList, setSuppliersList] = useState([]);
  const [exporting, setExporting] = useState(false);

  // Current outlet object
  const currentOutletObj = useMemo(() => {
    if (!filterOutlet || filterOutlet === 'ALL') return null;
    return outlets.find(o => String(o.id) === String(filterOutlet));
  }, [outlets, filterOutlet]);

  const isCurrentHolding = useMemo(() => {
    if (!currentOutletObj) return false;
    return Boolean(currentOutletObj.is_main);
  }, [currentOutletObj]);

  // Load distinct suppliers
  useEffect(() => {
    api.get('/suppliers')
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        setSuppliersList(list);
      })
      .catch(() => {});
  }, []);

  // Fetch Report Data
  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const endpointMap = {
        transactions: '/reports/purchase/transactions',
        'by-product': '/reports/purchase/by-product',
        'by-supplier': '/reports/purchase/by-supplier',
        payables: '/reports/purchase/payables',
        shipments: '/reports/purchase/shipments',
      };

      const params = {
        from,
        to,
        outlet_id: filterOutlet !== 'ALL' ? filterOutlet : undefined,
        payment_type: filterPayment !== 'ALL' ? filterPayment : undefined,
        supplier_name: filterSupplier !== 'ALL' ? filterSupplier : undefined,
        search: searchTerm.trim() || undefined,
      };

      // Determine scope
      if (filterOutlet !== 'ALL' && currentOutletObj) {
        params.scope = currentOutletObj.is_main ? 'HOLDING' : 'OUTLET';
      }

      const res = await api.get(endpointMap[activeTab] || endpointMap.transactions, { params });
      setReportData(res.data);
    } catch (err) {
      console.error('Failed to load purchase report:', err);
      toast.error(err.response?.data?.message || 'Gagal memuat laporan pembelian');
    } finally {
      setLoading(false);
    }
  }, [activeTab, from, to, filterOutlet, filterPayment, filterSupplier, searchTerm, currentOutletObj]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Export to Excel
  const handleExportExcel = async () => {
    if (!reportData || !reportData.items || reportData.items.length === 0) {
      toast.error('Tidak ada data untuk diexport');
      return;
    }

    setExporting(true);
    try {
      const payload = {
        businessName: reportData.business_name || 'URBAE CAFFEINE',
        period: reportData.period || `Per ${from} s/d ${to}`,
        items: reportData.items,
        summary: reportData.summary || {},
      };

      if (activeTab === 'transactions') {
        await exportPurchaseTransactionsToExcel(payload);
      } else if (activeTab === 'by-product') {
        await exportPurchasesByProductToExcel(payload);
      } else if (activeTab === 'by-supplier') {
        await exportPurchasesBySupplierToExcel(payload);
      } else if (activeTab === 'payables') {
        await exportSupplierPayablesToExcel(payload);
      } else if (activeTab === 'shipments') {
        await exportPurchaseShipmentsToExcel(payload);
      }
      toast.success('File Excel berhasil diunduh');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Gagal mengekspor laporan');
    } finally {
      setExporting(false);
    }
  };

  // Print Report
  const handlePrint = () => {
    printElement('purchase-report-content', {
      title: `${reportData?.report_title || 'Laporan Pembelian'} - ${reportData?.period || ''}`,
    });
  };

  const currentTabMeta = useMemo(() => {
    return TABS.find(t => t.id === activeTab) || TABS[0];
  }, [activeTab]);

  return (
    <div className="page-container" style={{ paddingBottom: 60 }}>
      {/* HEADER */}
      <PageHeader
        title="Laporan Pembelian & Pengadaan"
        subtitle="Analisis terpusat barang masuk, komparasi produk, buku hutang supplier holding, dan belanja kas operasional outlet cabang."
        actions={
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handlePrint}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 7 }}
              disabled={loading || !reportData}
            >
              <Printer size={15} />
              <span>Cetak / PDF</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700 }}
              disabled={loading || exporting || !reportData}
            >
              <FileSpreadsheet size={15} />
              <span>{exporting ? 'Mengekspor...' : 'Export Excel (.xlsx)'}</span>
            </button>
          </div>
        }
      />

      {/* POLICY BADGE BANNER */}
      <div style={{
        marginTop: 14,
        marginBottom: 20,
        padding: '12px 18px',
        borderRadius: 12,
        background: filterOutlet === 'ALL'
          ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.08))'
          : isCurrentHolding
            ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(16, 185, 129, 0.08))'
            : 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(239, 68, 68, 0.06))',
        border: `1px solid ${
          filterOutlet === 'ALL'
            ? 'rgba(99, 102, 241, 0.25)'
            : isCurrentHolding
              ? 'rgba(59, 130, 246, 0.3)'
              : 'rgba(245, 158, 11, 0.3)'
        }`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isCurrentHolding ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)',
            color: isCurrentHolding ? '#60a5fa' : '#f59e0b'
          }}>
            {isCurrentHolding ? <Building2 size={20} /> : <Store size={20} />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--text-primary)' }}>
                {filterOutlet === 'ALL'
                  ? 'Mode Konsolidasi Multi-Outlet'
                  : isCurrentHolding
                    ? `Level Holding (Outlet Pusat): ${currentOutletObj?.name || 'Gudang Pusat'}`
                    : `Level Outlet Cabang: ${currentOutletObj?.name || 'Cabang Operasional'}`}
              </span>
              <span className={`pill ${isCurrentHolding ? 'pill-primary' : filterOutlet === 'ALL' ? 'pill-info' : 'pill-warning'}`} style={{ fontSize: 11, fontWeight: 700 }}>
                {filterOutlet === 'ALL' ? 'Holding & Cabang' : isCurrentHolding ? 'Holding / Outlet Pusat' : 'Outlet Cabang'}
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
              {filterOutlet === 'ALL'
                ? 'Menampilkan seluruh pengadaan barang masuk: Holding (Hutang, Kas, Bank) dan Outlet Cabang (Kas Only).'
                : isCurrentHolding
                  ? 'Outlet ini diset sebagai Toko Pusat / Holding. Mendukung metode pembayaran: HUTANG (Tempo Supplier), KAS, dan BANK.'
                  : 'Outlet ini berstatus Cabang Operasional. Kebijakan Standar: Pembelian barang masuk dibatasi KAS ONLY (Petty Cash Cabang).'}
            </p>
          </div>
        </div>

        {/* Quick Badges */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span className="pill pill-success" style={{ fontSize: 11, padding: '4px 10px' }}>
            <CheckCircle2 size={12} style={{ marginRight: 4 }} /> Kas (Petty Cash)
          </span>
          {(isCurrentHolding || filterOutlet === 'ALL') && (
            <>
              <span className="pill pill-primary" style={{ fontSize: 11, padding: '4px 10px' }}>
                <CheckCircle2 size={12} style={{ marginRight: 4 }} /> Bank / Transfer
              </span>
              <span className="pill pill-danger" style={{ fontSize: 11, padding: '4px 10px' }}>
                <CheckCircle2 size={12} style={{ marginRight: 4 }} /> Hutang / Tempo
              </span>
            </>
          )}
        </div>
      </div>

      {/* FILTER TOOLBAR CARD */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          background: 'var(--bg-card)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          marginBottom: 20
        }}
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Left: Filter Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Metode Pembayaran Filter */}
            <select
              className="form-control"
              style={{ fontSize: 12, width: 'auto', minWidth: 160 }}
              value={filterPayment}
              onChange={e => setFilterPayment(e.target.value)}
              disabled={!isCurrentHolding && filterOutlet !== 'ALL' && activeTab !== 'payables'}
              title="Filter Metode Pembayaran"
            >
              <option value="ALL">Semua Pembayaran</option>
              <option value="CASH">💵 Kas Tunai / Petty Cash</option>
              {(isCurrentHolding || filterOutlet === 'ALL') && (
                <>
                  <option value="BANK">💳 Bank / Transfer / QRIS</option>
                  <option value="HUTANG">⏳ Hutang Supplier (Tempo)</option>
                </>
              )}
            </select>

            {/* Supplier Filter */}
            <select
              className="form-control"
              style={{ fontSize: 12, width: 'auto', minWidth: 160 }}
              value={filterSupplier}
              onChange={e => setFilterSupplier(e.target.value)}
              title="Filter Berdasarkan Vendor / Supplier"
            >
              <option value="ALL">Semua Supplier</option>
              {suppliersList.map(s => (
                <option key={s.id || s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Right: Search & Refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Quick Search */}
            <div style={{ position: 'relative', width: 250, maxWidth: '100%' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Cari ref, produk, vendor..."
                style={{ paddingLeft: 30, paddingRight: searchTerm ? 26 : 10, fontSize: 12 }}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0
                  }}
                  title="Hapus pencarian"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Refresh Button */}
            <button
              onClick={fetchReport}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '7px 12px' }}
              disabled={loading}
              title="Segarkan data laporan dari server"
            >
              <RefreshCw size={13} className={loading ? 'spin' : ''} />
              <span>Segarkan</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      {reportData && reportData.summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 22 }}>
          {/* Total Pembelian */}
          <div className="card" style={{ padding: '16px 18px', borderLeft: '4px solid #6366f1' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Total Pembelian</span>
              <div style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#818cf8', padding: 6, borderRadius: 8 }}>
                <ShoppingBag size={17} />
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
              {rupiah(reportData.summary.total_pembelian || reportData.summary.total_nilai_beli || reportData.summary.total_jumlah || 0)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {reportData.summary.total_items ? `${reportData.summary.total_items} Baris Barang Masuk` : `${reportData.summary.total_products || reportData.summary.total_suppliers || 0} Entitas`}
            </div>
          </div>

          {/* Pembayaran Kas */}
          <div className="card" style={{ padding: '16px 18px', borderLeft: '4px solid #10b981' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Belanja Kas / Tunai</span>
              <div style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', padding: 6, borderRadius: 8 }}>
                <Coins size={17} />
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981' }}>
              {rupiah(reportData.summary.total_kas ?? reportData.summary.total_dibayar ?? 0)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {isCurrentHolding ? 'Kas Holding & Kas Operasional' : 'Petty Cash Operasional Cabang'}
            </div>
          </div>

          {/* Bank / Transfer (Holding) */}
          {(isCurrentHolding || filterOutlet === 'ALL') && (
            <div className="card" style={{ padding: '16px 18px', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Transfer Bank Holding</span>
                <div style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', padding: 6, borderRadius: 8 }}>
                  <CreditCard size={17} />
                </div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6' }}>
                {rupiah(reportData.summary.total_bank || 0)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Rekening Perusahaan / Bank Pusat
              </div>
            </div>
          )}

          {/* Hutang / Tempo (Holding) */}
          {(isCurrentHolding || filterOutlet === 'ALL') && (
            <div className="card" style={{ padding: '16px 18px', borderLeft: '4px solid #ef4444' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Sisa Hutang Supplier</span>
                <div style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', padding: 6, borderRadius: 8 }}>
                  <Clock size={17} />
                </div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#ef4444' }}>
                {rupiah(reportData.summary.total_utang ?? reportData.summary.total_sisa_hutang ?? 0)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Tempo Supplier Holding Belum Lunas
              </div>
            </div>
          )}
        </div>
      )}

      {/* TABS NAVIGATION */}
      <div style={{
        display: 'flex',
        gap: 6,
        borderBottom: '1px solid var(--border)',
        marginBottom: 18,
        overflowX: 'auto',
        paddingBottom: 2
      }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isPayableTab = tab.id === 'payables';

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12.5,
                fontWeight: isActive ? 700 : 500,
                padding: '9px 16px',
                borderRadius: '8px 8px 0 0',
                border: 'none',
                borderBottom: isActive ? '2.5px solid var(--accent-bright)' : '2.5px solid transparent',
                color: isActive ? 'var(--accent-bright)' : 'var(--text-secondary)',
                background: isActive ? 'rgba(124, 58, 237, 0.08)' : 'transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
              {isPayableTab && (
                <span className="pill pill-primary" style={{ fontSize: 9.5, padding: '1px 6px' }}>Tempo</span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB DESCRIPTION */}
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
          {currentTabMeta.title}
        </h3>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)' }}>
          {currentTabMeta.desc}
        </p>
      </div>

      {/* PRINT CONTAINER / CONTENT */}
      <div id="purchase-report-content" className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Print Only Header */}
        <div className="print-only" style={{ padding: '20px 24px', borderBottom: '1px solid #ddd' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{reportData?.business_name || 'URBAE CAFFEINE'}</h2>
          <h3 style={{ margin: '4px 0', fontSize: 15, fontWeight: 700 }}>{currentTabMeta.title}</h3>
          <p style={{ margin: 0, fontSize: 12, color: '#555' }}>
            {reportData?.period || `Per ${from} s/d ${to}`} | {reportData?.outlet_name || 'Semua Unit'}
          </p>
        </div>

        {loading ? (
          <div style={{ padding: 60 }}>
            <LoadingState message="Memuat data laporan pembelian..." />
          </div>
        ) : !reportData || !reportData.items || reportData.items.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            {activeTab === 'payables' ? (
              reportData?.policy_note ? (
                <div>
                  <Store size={42} style={{ color: '#f59e0b', marginBottom: 12, opacity: 0.85 }} />
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Buku Hutang Tidak Tersedia di Cabang Ini
                  </h4>
                  <p style={{ margin: '0 auto 16px auto', fontSize: 13, color: 'var(--text-secondary)', maxWidth: 500, lineHeight: 1.5 }}>
                    {reportData.policy_note}
                  </p>
                  <button
                    onClick={() => setActiveTab('transactions')}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <ShoppingBag size={14} />
                    <span>Lihat Transaksi Pembelian Cabang (Kas Only)</span>
                  </button>
                </div>
              ) : (reportData?.summary?.total_kas > 0 || reportData?.summary?.total_pembelian > 0) ? (
                <div>
                  <div style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 14px auto',
                    color: '#10b981'
                  }}>
                    <CheckCircle2 size={30} />
                  </div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                    Tidak Ada Hutang Supplier (Semua Pembelian Lunas)
                  </h4>
                  <p style={{ margin: '0 auto 16px auto', fontSize: 13, color: 'var(--text-secondary)', maxWidth: 540, lineHeight: 1.6 }}>
                    Seluruh transaksi belanja barang masuk pada periode ini telah dibayar secara <strong style={{ color: '#10b981' }}>KAS / TUNAI</strong>. 
                    Tidak ada transaksi berstatus hutang/tempo ke supplier yang belum lunas.
                  </p>
                  <button
                    onClick={() => setActiveTab('transactions')}
                    className="btn btn-primary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 700, padding: '8px 16px' }}
                  >
                    <ShoppingBag size={15} />
                    <span>Buka Tab Transaksi Pembelian (Barang Masuk)</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                <div>
                  <Clock size={42} style={{ color: 'var(--text-muted)', marginBottom: 12, opacity: 0.5 }} />
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Tidak Ada Data Hutang Supplier
                  </h4>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', maxWidth: 450, marginInline: 'auto' }}>
                    Tidak ditemukan data hutang tempo supplier pada filter rentang tanggal dan warehouse terpilih.
                  </p>
                </div>
              )
            ) : activeTab === 'shipments' ? (
              <div>
                <Truck size={42} style={{ color: 'var(--text-muted)', marginBottom: 12, opacity: 0.5 }} />
                <h4 style={{ margin: '0 0 6px 0', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Tidak Ada Pengiriman Ekspedisi / Belanja Online
                </h4>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', maxWidth: 480, marginInline: 'auto', lineHeight: 1.5 }}>
                  Seluruh transaksi pembelian pada periode ini adalah <strong>Belanja Langsung</strong> (langsung masuk stok gudang). Tidak ada pengiriman via ekspedisi atau persediaan dalam perjalanan (in-transit).
                </p>
              </div>
            ) : (
              <div>
                <ShoppingBag size={42} style={{ color: 'var(--text-muted)', marginBottom: 12, opacity: 0.5 }} />
                <h4 style={{ margin: '0 0 6px 0', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Tidak Ada Data Pembelian
                </h4>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', maxWidth: 450, marginInline: 'auto' }}>
                  Tidak ditemukan data transaksi pembelian barang masuk pada filter rentang tanggal dan warehouse terpilih.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="table-wrap" style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
            {/* 1. TRANSAKSI PEMBELIAN (DETAIL BARANG MASUK) */}
            {activeTab === 'transactions' && (
              <table style={{ fontSize: 12, whiteSpace: 'nowrap', minWidth: 1600, width: '100%' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)' }}>
                    <th style={{ width: 45 }}>No.</th>
                    <th>Tgl</th>
                    <th>Tgl.Dibuat</th>
                    <th>Dibuat Oleh</th>
                    <th>No.Ref</th>
                    <th>Warehouse</th>
                    <th>Supplier</th>
                    <th>Status Terima</th>
                    <th>Kode Produk</th>
                    <th>Produk</th>
                    <th style={{ textAlign: 'right' }}>QTY</th>
                    <th>Satuan</th>
                    <th style={{ textAlign: 'right' }}>QTY Terkecil</th>
                    <th>Satuan Terkecil</th>
                    <th style={{ textAlign: 'right' }}>Harga</th>
                    <th style={{ textAlign: 'right' }}>Disc</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                    <th style={{ textAlign: 'right' }}>Disc Tambahan</th>
                    <th style={{ textAlign: 'right' }}>PPN</th>
                    <th style={{ textAlign: 'right' }}>Pengiriman</th>
                    <th style={{ textAlign: 'right', fontWeight: 800 }}>Pembelian</th>
                    <th style={{ textAlign: 'right', fontWeight: 800, color: '#10b981' }}>Dibayar</th>
                    <th style={{ textAlign: 'right', fontWeight: 800, color: '#ef4444' }}>Utang</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.items.map((row, idx) => (
                    <tr key={row.id || idx}>
                      <td>{row.no || (idx + 1)}</td>
                      <td>{row.tgl}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{row.tgl_dibuat}</td>
                      <td>{row.dibuat_oleh}</td>
                      <td className="mono" style={{ fontWeight: 600 }}>{row.no_ref}</td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          {row.is_holding ? <span className="pill pill-primary" style={{ fontSize: 9 }}>Holding</span> : <span className="pill pill-secondary" style={{ fontSize: 9 }}>Outlet</span>}
                          {row.warehouse}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{row.supplier}</td>
                      <td>
                        <span className="pill pill-success" style={{ fontSize: 10 }}>
                          {row.status_terima || 'Diterima'}
                        </span>
                      </td>
                      <td className="mono" style={{ color: 'var(--text-muted)' }}>{row.kode_produk}</td>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{row.produk}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{row.qty}</td>
                      <td>{row.satuan}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{row.qty_terkecil}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{row.satuan_terkecil}</td>
                      <td style={{ textAlign: 'right' }}>{rupiah(row.harga)}</td>
                      <td style={{ textAlign: 'right' }}>{rupiah(row.disc || 0)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{rupiah(row.subtotal)}</td>
                      <td style={{ textAlign: 'right' }}>{rupiah(row.disc_tambahan || 0)}</td>
                      <td style={{ textAlign: 'right' }}>{rupiah(row.ppn || 0)}</td>
                      <td style={{ textAlign: 'right' }}>{rupiah(row.pengiriman || 0)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800 }}>{rupiah(row.pembelian)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{rupiah(row.dibayar)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: row.utang > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                        {rupiah(row.utang)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--bg-elevated)', fontWeight: 800 }}>
                    <td colSpan={17} style={{ textAlign: 'right', fontSize: 13 }}>Total</td>
                    <td style={{ textAlign: 'right' }}>{rupiah(reportData.summary?.total_disc_tambahan || 0)}</td>
                    <td style={{ textAlign: 'right' }}>{rupiah(reportData.summary?.total_ppn || 0)}</td>
                    <td style={{ textAlign: 'right' }}>{rupiah(reportData.summary?.total_pengiriman || 0)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--primary)', fontSize: 13.5 }}>
                      {rupiah(reportData.summary?.total_pembelian || 0)}
                    </td>
                    <td style={{ textAlign: 'right', color: '#10b981', fontSize: 13.5 }}>
                      {rupiah(reportData.summary?.total_dibayar || 0)}
                    </td>
                    <td style={{ textAlign: 'right', color: '#ef4444', fontSize: 13.5 }}>
                      {rupiah(reportData.summary?.total_utang || 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* 2. PEMBELIAN PER PRODUK */}
            {activeTab === 'by-product' && (
              <table style={{ fontSize: 12, whiteSpace: 'nowrap', minWidth: 1000, width: '100%' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)' }}>
                    <th style={{ width: 45 }}>No.</th>
                    <th>Kode Produk</th>
                    <th>Nama Produk</th>
                    <th style={{ textAlign: 'right' }}>Qty Beli</th>
                    <th style={{ textAlign: 'right' }}>Qty Refund</th>
                    <th>Satuan</th>
                    <th style={{ textAlign: 'right' }}>Harga Rata-Rata</th>
                    <th style={{ textAlign: 'right' }}>Disc</th>
                    <th style={{ textAlign: 'right', fontWeight: 800 }}>Total Nilai Beli</th>
                    <th style={{ textAlign: 'right' }}>Total Nilai Refund</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.items.map((row, idx) => (
                    <tr key={idx}>
                      <td>{row.no || (idx + 1)}</td>
                      <td className="mono" style={{ color: 'var(--text-muted)' }}>{row.kode_produk}</td>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{row.nama_produk}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{row.qty_beli}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{row.qty_refund || 0}</td>
                      <td><span className="pill pill-secondary" style={{ fontSize: 10 }}>{row.satuan}</span></td>
                      <td style={{ textAlign: 'right' }}>{rupiah(row.harga)}</td>
                      <td style={{ textAlign: 'right' }}>{rupiah(row.disc || 0)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {rupiah(row.total_nilai_beli)}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                        {rupiah(row.total_nilai_refund || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--bg-elevated)', fontWeight: 800 }}>
                    <td colSpan={3} style={{ textAlign: 'right', fontSize: 13 }}>Total</td>
                    <td style={{ textAlign: 'right' }}>{reportData.summary?.total_qty_beli || 0}</td>
                    <td style={{ textAlign: 'right' }}>0</td>
                    <td colSpan={3}></td>
                    <td style={{ textAlign: 'right', color: 'var(--primary)', fontSize: 13.5 }}>
                      {rupiah(reportData.summary?.total_nilai_beli || 0)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {rupiah(reportData.summary?.total_nilai_refund || 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* 3. PEMBELIAN PER SUPPLIER */}
            {activeTab === 'by-supplier' && (
              <table style={{ fontSize: 12, whiteSpace: 'nowrap', minWidth: 950, width: '100%' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)' }}>
                    <th style={{ width: 45 }}>No.</th>
                    <th>Supplier / Kode Produk</th>
                    <th>Tgl. Dibuat</th>
                    <th>Dibuat Oleh</th>
                    <th>No. Ref</th>
                    <th style={{ textAlign: 'right' }}>Pembelian</th>
                    <th style={{ textAlign: 'right' }}>Disc</th>
                    <th style={{ textAlign: 'right' }}>Pajak</th>
                    <th style={{ textAlign: 'right' }}>Pengiriman</th>
                    <th style={{ textAlign: 'right', fontWeight: 800 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.items.map((row, idx) => (
                    <tr key={idx}>
                      <td>{row.no || (idx + 1)}</td>
                      <td>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                          {row.supplier}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {row.item_count || 0} item bahan dibeli
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{row.tgl_dibuat}</td>
                      <td>{row.dibuat_oleh}</td>
                      <td className="mono" style={{ fontSize: 11 }}>{row.no_ref}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{rupiah(row.pembelian)}</td>
                      <td style={{ textAlign: 'right' }}>{rupiah(row.disc || 0)}</td>
                      <td style={{ textAlign: 'right' }}>{rupiah(row.pajak || 0)}</td>
                      <td style={{ textAlign: 'right' }}>{rupiah(row.pengiriman || 0)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>
                        {rupiah(row.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--bg-elevated)', fontWeight: 800 }}>
                    <td colSpan={5} style={{ textAlign: 'right', fontSize: 13 }}>Total Pembelian Dari Semua Supplier</td>
                    <td style={{ textAlign: 'right' }}>{rupiah(reportData.summary?.total_pembelian || 0)}</td>
                    <td style={{ textAlign: 'right' }}>Rp 0,00</td>
                    <td style={{ textAlign: 'right' }}>Rp 0,00</td>
                    <td style={{ textAlign: 'right' }}>Rp 0,00</td>
                    <td style={{ textAlign: 'right', color: 'var(--primary)', fontSize: 13.5 }}>
                      {rupiah(reportData.summary?.total_pembelian || 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* 4. HUTANG SUPPLIER (HOLDING) */}
            {activeTab === 'payables' && (
              <table style={{ fontSize: 12, whiteSpace: 'nowrap', minWidth: 1100, width: '100%' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)' }}>
                    <th style={{ width: 45 }}>No.</th>
                    <th>Supplier / Tanggal</th>
                    <th>Tgl. Dibuat</th>
                    <th>Dibuat Oleh</th>
                    <th>No. Pembelian</th>
                    <th>No. Bayar</th>
                    <th>Jatuh Tempo</th>
                    <th style={{ textAlign: 'right' }}>Hutang</th>
                    <th style={{ textAlign: 'right', color: '#10b981' }}>Dibayar</th>
                    <th style={{ textAlign: 'right', color: '#ef4444' }}>Sisa Hutang</th>
                    <th style={{ textAlign: 'right', fontWeight: 800 }}>Total Hutang</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.items.map((row, idx) => (
                    <tr key={row.id || idx}>
                      <td>{row.no || (idx + 1)}</td>
                      <td>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{row.supplier_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.supplier_tanggal}</div>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{row.tgl_dibuat}</td>
                      <td>{row.dibuat_oleh}</td>
                      <td className="mono" style={{ fontWeight: 600 }}>{row.no_pembelian}</td>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.no_bayar}</td>
                      <td>
                        <span style={{ fontWeight: 700, color: row.is_overdue ? '#ef4444' : 'var(--text-primary)' }}>
                          {row.jatuh_tempo}
                        </span>
                        {row.is_overdue && (
                          <span className="pill pill-danger" style={{ fontSize: 9, marginLeft: 6 }}>Lewat Tempo</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{rupiah(row.hutang)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{rupiah(row.dibayar)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{rupiah(row.sisa_hutang)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#ef4444' }}>
                        {rupiah(row.total_hutang)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--bg-elevated)', fontWeight: 800 }}>
                    <td colSpan={7} style={{ textAlign: 'right', fontSize: 13 }}>Total Utang</td>
                    <td style={{ textAlign: 'right' }}>{rupiah(reportData.summary?.total_hutang || 0)}</td>
                    <td style={{ textAlign: 'right', color: '#10b981' }}>{rupiah(reportData.summary?.total_dibayar || 0)}</td>
                    <td style={{ textAlign: 'right', color: '#ef4444', fontSize: 13.5 }}>
                      {rupiah(reportData.summary?.total_sisa_hutang || 0)}
                    </td>
                    <td style={{ textAlign: 'right', color: '#ef4444', fontSize: 13.5 }}>
                      {rupiah(reportData.summary?.total_utang || 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* 5. PENGIRIMAN PEMBELIAN */}
            {activeTab === 'shipments' && (
              <table style={{ fontSize: 12, whiteSpace: 'nowrap', minWidth: 950, width: '100%' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)' }}>
                    <th style={{ width: 45 }}>No.</th>
                    <th>Supplier / Tanggal</th>
                    <th>Tgl. Dibuat</th>
                    <th>Dibuat Oleh</th>
                    <th>No. Ref / Resi</th>
                    <th>Kode Produk</th>
                    <th>Nama Produk</th>
                    <th style={{ textAlign: 'right' }}>Qty</th>
                    <th>Satuan</th>
                    <th style={{ textAlign: 'right', fontWeight: 800 }}>Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.items.map((row, idx) => (
                    <tr key={idx}>
                      <td>{row.no || (idx + 1)}</td>
                      <td>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{row.supplier_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.supplier_tanggal}</div>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{row.tgl_dibuat}</td>
                      <td>{row.dibuat_oleh}</td>
                      <td>
                        <div className="mono" style={{ fontWeight: 700 }}>{row.no_ref}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.ekspedisi}</div>
                      </td>
                      <td className="mono" style={{ color: 'var(--text-muted)' }}>{row.kode_produk}</td>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{row.nama_produk}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{row.qty}</td>
                      <td><span className="pill pill-secondary" style={{ fontSize: 10 }}>{row.satuan}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {rupiah(row.jumlah)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--bg-elevated)', fontWeight: 800 }}>
                    <td colSpan={7} style={{ textAlign: 'right', fontSize: 13 }}>Total Nilai Pengiriman</td>
                    <td style={{ textAlign: 'right' }}>{reportData.summary?.total_qty || 0}</td>
                    <td></td>
                    <td style={{ textAlign: 'right', color: 'var(--primary)', fontSize: 13.5 }}>
                      {rupiah(reportData.summary?.total_jumlah || 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
