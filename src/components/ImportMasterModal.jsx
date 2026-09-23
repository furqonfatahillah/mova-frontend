import { useState } from 'react';
import {
  FileSpreadsheet, Upload, X, CheckCircle2, AlertCircle,
  Download, RefreshCw, AlertOctagon, Check, ArrowRight, Table
} from 'lucide-react';
import api from '../api/client';
import { rupiah, LoadingState } from './ui';
import {
  downloadIngredientTemplate,
  downloadMenuTemplate,
  downloadReceivableTemplate,
  downloadOutletTemplate
} from '../utils/exportTemplates';
import toast from 'react-hot-toast';

async function getXLSX() {
  return await import('xlsx');
}

/**
 * Reusable Excel Import Modal Component for MOVA POS Master Data
 */
export default function ImportMasterModal({
  isOpen,
  onClose,
  targetMaster = 'INGREDIENT', // 'INGREDIENT' | 'MENU' | 'RECEIVABLE' | 'OUTLET'
  onSuccess,
}) {
  const [selectedMaster, setSelectedMaster] = useState(targetMaster);
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [loadingFile, setLoadingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  if (!isOpen) return null;

  const currentMasterType = selectedMaster || targetMaster;

  const MASTER_CONFIG = {
    INGREDIENT: {
      title: 'Master Bahan (Ingredients)',
      downloadFn: downloadIngredientTemplate,
      endpoint: '/ingredients/bulk-import',
      columns: ['Nama Bahan*', 'Tipe*', 'Satuan Beli*', 'Satuan Pakai*', 'Konversi*', 'Harga Beli*'],
      sampleHint: 'Contoh: Tepung Terigu, Satuan Beli: kg, Satuan Pakai: gram, Konversi: 1000, Harga: 14000',
    },
    MENU: {
      title: 'Master Menu & F&B',
      downloadFn: downloadMenuTemplate,
      endpoint: '/menus/bulk-import',
      columns: ['Nama Menu*', 'Kategori*', 'Tipe Item*', 'Harga Jual*', 'HPP (Modal)'],
      sampleHint: 'Contoh: Kopi Aren, Kategori: Minuman, Tipe: RECIPE, Harga Jual: 20000, HPP: 8000',
    },
    RECEIVABLE: {
      title: 'Master Piutang (Kasbon Customer)',
      downloadFn: downloadReceivableTemplate,
      endpoint: '/receivables/bulk-import',
      columns: ['Nama Pelanggan*', 'Total Tagihan*', 'Uang Muka (DP)', 'Tgl Terbit*', 'Tgl Jatuh Tempo*'],
      sampleHint: 'Contoh: Bpk H. Paksi, Total Tagihan: 250000, DP: 50000, Terbit: 2026-09-24',
    },
    OUTLET: {
      title: 'Master Gudang & Outlet Cabang',
      downloadFn: downloadOutletTemplate,
      endpoint: '/outlets/bulk-import',
      columns: ['Nama Outlet*', 'Tipe (CABANG/PUSAT/GUDANG)*', 'PIC Manager', 'Nomor Telepon'],
      sampleHint: 'Contoh: Maroa Branch Panakkukang, Tipe: CABANG, PIC: Ibu Maya, Phone: 081298765432',
    },
  };

  const activeConfig = MASTER_CONFIG[currentMasterType] || MASTER_CONFIG.INGREDIENT;

  // Handle template download
  async function handleDownloadTemplate() {
    try {
      await activeConfig.downloadFn();
      toast.success(`Template Excel ${activeConfig.title} berhasil terunduh!`);
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengunduh template Excel.');
    }
  }

  // Helper to normalize object keys (trim spaces & lowercase)
  function getVal(row, possibleKeys) {
    const keys = Object.keys(row || {});
    for (const p of possibleKeys) {
      const match = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(p.toLowerCase().replace(/[^a-z0-9]/g, '')));
      if (match && row[match] !== undefined && row[match] !== null && String(row[match]).trim() !== '') {
        return row[match];
      }
    }
    return '';
  }

  // Parse Excel File on client side
  async function handleFileUpload(e) {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setLoadingFile(true);
    setFile(uploadedFile);
    setFileName(uploadedFile.name);
    setParsedRows([]);
    setImportResult(null);

    try {
      const XLSX = await getXLSX();
      const buffer = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawJson = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      // Filter out header title rows or instruction rows (rows that don't look like data)
      const dataRows = rawJson.filter(row => {
        const strValues = Object.values(row).join(' ').toLowerCase();
        if (strValues.includes('template import') || strValues.includes('petunjuk:') || strValues.includes('=== daftar') || strValues.includes('=== petunjuk')) {
          return false;
        }
        return Object.values(row).some(v => v !== '' && v !== null);
      });

      // Parse & Validate depending on master type
      const parsed = dataRows.map((row, idx) => {
        const errors = [];
        let mappedData = {};

        if (currentMasterType === 'INGREDIENT') {
          const name = getVal(row, ['nama', 'namabahan', 'ingredient']);
          const code = getVal(row, ['kode', 'kodebahan', 'code']);
          const category = getVal(row, ['kategori', 'category']) || 'BAHAN_BAKU';
          const typeRaw = getVal(row, ['tipe', 'tipebahan', 'type']);
          const type = (typeRaw && typeRaw.toUpperCase().includes('SEMI')) ? 'SEMI_FINISHED' : 'RAW';
          const unitBeli = getVal(row, ['satuanbeli', 'unitbeli']) || 'kg';
          const unitPakai = getVal(row, ['satuanpakai', 'unitpakai']) || 'gram';
          const konversi = parseFloat(getVal(row, ['konversi', 'faktorkonversi'])) || 1;
          const harga = parseFloat(getVal(row, ['hargabeli', 'harga', 'hargasatuan'])) || 0;
          const minStock = parseFloat(getVal(row, ['stokminimal', 'minstok'])) || 0;
          const initialStock = parseFloat(getVal(row, ['stokawal', 'stok'])) || 0;
          const notes = getVal(row, ['catatan', 'keterangan']);

          if (!name) errors.push('Nama bahan wajib diisi.');
          if (harga < 0) errors.push('Harga beli tidak boleh negatif.');

          mappedData = { code, name, category, type, unit_beli: unitBeli, unit_pakai: unitPakai, konversi, harga, minstok: minStock, initial_stock: initialStock, notes };

        } else if (currentMasterType === 'MENU') {
          const name = getVal(row, ['namamenu', 'nama', 'menu']);
          const code = getVal(row, ['kodemenu', 'kode', 'code']);
          const barcode = getVal(row, ['barcode']);
          const category = getVal(row, ['kategori', 'category']) || 'Umum';
          const typeRaw = getVal(row, ['tipeitem', 'tipe', 'type']).toUpperCase();
          const itemType = ['RECIPE', 'DIRECT', 'SERVICE', 'BUNDLE'].includes(typeRaw) ? typeRaw : 'RECIPE';
          const price = parseFloat(getVal(row, ['hargajual', 'harga', 'price'])) || 0;
          const costPrice = parseFloat(getVal(row, ['hpp', 'modal', 'cost'])) || 0;
          const description = getVal(row, ['deskripsi', 'keterangan']);
          const statusRaw = getVal(row, ['status']);
          const isKosong = statusRaw && statusRaw.toUpperCase().includes('KOSONG');

          if (!name) errors.push('Nama menu wajib diisi.');
          if (price <= 0) errors.push('Harga jual harus lebih dari 0.');

          mappedData = { code, barcode, name, category, item_type: itemType, price, cost_price: costPrice, description, is_available: !isKosong };

        } else if (currentMasterType === 'RECEIVABLE') {
          const customerName = getVal(row, ['namapelanggan', 'namadebitur', 'nama', 'customer']);
          const phone = getVal(row, ['nomorhp', 'phone', 'telepon', 'hp']);
          const address = getVal(row, ['alamat', 'address']);
          const totalAmount = parseFloat(getVal(row, ['totaltagihan', 'total', 'nominal'])) || 0;
          const initialPaid = parseFloat(getVal(row, ['nominaldp', 'uangmuka', 'dp'])) || 0;
          const issueDate = getVal(row, ['tanggalterbit', 'terbit', 'issuedate']) || new Date().toISOString().slice(0, 10);
          const dueDate = getVal(row, ['tanggaljatuh', 'jatuhtempo', 'duedate']) || new Date().toISOString().slice(0, 10);
          const notes = getVal(row, ['catatan', 'keterangan']);

          if (!customerName) errors.push('Nama pelanggan wajib diisi.');
          if (totalAmount <= 0) errors.push('Total tagihan kasbon harus lebih dari 0.');

          mappedData = { customer_name: customerName, customer_phone: phone, customer_address: address, total_amount: totalAmount, initial_paid: initialPaid, issue_date: issueDate, due_date: dueDate, notes };

        } else if (currentMasterType === 'OUTLET') {
          const name = getVal(row, ['namaoutlet', 'namacabang', 'nama', 'outlet']);
          const code = getVal(row, ['kodeoutlet', 'kode', 'code']);
          const typeRaw = getVal(row, ['tipe', 'type']).toUpperCase();
          const type = ['CABANG', 'PUSAT', 'GUDANG'].includes(typeRaw) ? typeRaw : 'CABANG';
          const picName = getVal(row, ['namapic', 'pic', 'manager']);
          const phone = getVal(row, ['telepon', 'phone', 'hp']);
          const address = getVal(row, ['alamat', 'address']);
          const mainFlag = getVal(row, ['cabangutama', 'is_main', 'main']);
          const isMain = mainFlag && mainFlag.toUpperCase().includes('YA');

          if (!name) errors.push('Nama outlet wajib diisi.');

          mappedData = { code, name, type, pic_name: picName, phone, address, is_main: isMain };
        }

        return {
          rowNumber: idx + 6,
          original: row,
          data: mappedData,
          isValid: errors.length === 0,
          errors,
        };
      });

      setParsedRows(parsed);
      toast.success(`Berhasil membaca ${parsed.length} baris data dari file Excel!`);
    } catch (err) {
      console.error(err);
      toast.error('Gagal membaca file Excel. Pastikan format file sesuai (.xlsx / .csv)');
    } finally {
      setLoadingFile(false);
    }
  }

  // Submit parsed valid rows to backend
  async function handleSubmitImport() {
    const validItems = parsedRows.filter(r => r.isValid).map(r => r.data);
    if (validItems.length === 0) {
      toast.error('Tidak ada baris data valid yang siap di-import.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post(activeConfig.endpoint, { items: validItems });
      const importedCount = res.data?.imported_count || res.data?.count || validItems.length;

      setImportResult({
        success: true,
        message: res.data?.message || `Berhasil meng-import ${importedCount} data ${activeConfig.title}!`,
        count: importedCount,
      });

      toast.success(`Import berhasil! ${importedCount} data tersimpan.`);
      onSuccess?.();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Gagal meng-import data ke database.');
    } finally {
      setSubmitting(false);
    }
  }

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.length - validCount;

  return (
    <div className="modal-backdrop fade-in" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(4, 7, 18, 0.85)', backdropFilter: 'blur(12px)',
      zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }}>
      <div className="card modal-content" style={{
        maxWidth: '780px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
        padding: '24px', borderRadius: '18px', background: '#11162d', border: '1px solid var(--border-strong)'
      }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <FileSpreadsheet size={22} color="var(--primary)" />
              Import Data Master Excel & Template Hub
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Unggah file Excel (.xlsx / .csv) untuk meng-import data secara instan
            </span>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Master Type Selector Pills */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
          {[
            { key: 'INGREDIENT', label: 'Master Bahan' },
            { key: 'MENU', label: 'Master Menu' },
            { key: 'RECEIVABLE', label: 'Kasbon / Piutang' },
            { key: 'OUTLET', label: 'Outlet & Gudang' },
          ].map(m => (
            <button
              key={m.key}
              type="button"
              onClick={() => {
                setSelectedMaster(m.key);
                setFile(null);
                setParsedRows([]);
                setImportResult(null);
              }}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: selectedMaster === m.key ? 'var(--primary)' : 'var(--border)',
                background: selectedMaster === m.key ? 'var(--primary)' : 'rgba(255,255,255,0.04)',
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: selectedMaster === m.key ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Template Download Banner */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(79, 70, 229, 0.22) 100%)',
          border: '1px solid rgba(139, 92, 246, 0.35)',
          borderRadius: '12px',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Download size={16} color="var(--accent-bright)" /> Download Template Format Excel ({activeConfig.title})
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {activeConfig.sampleHint}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleDownloadTemplate}
            style={{ fontWeight: 800, color: '#ffffff', borderColor: 'rgba(255,255,255,0.3)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={14} /> Download Template .xlsx
          </button>
        </div>

        {/* File Upload Dropzone */}
        <div style={{
          border: '2px dashed var(--border-strong)',
          borderRadius: '14px',
          padding: '24px 16px',
          textAlign: 'center',
          background: 'rgba(0, 0, 0, 0.2)',
          marginBottom: '20px',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}>
          <Upload size={32} style={{ color: 'var(--primary)', margin: '0 auto 8px' }} />
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
            {fileName ? `File Terpilih: ${fileName}` : 'Pilih atau Drag & Drop File Excel (.xlsx / .csv)'}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Format didukung: .xlsx, .xls, .csv (Maksimal 5.000 baris per sekali import)
          </div>
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileUpload}
            style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}
          />
        </div>

        {/* Loading File Indicator */}
        {loadingFile && <LoadingState message="Membaca & Memvalidasi File Excel..." />}

        {/* Import Result Success Banner */}
        {importResult && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.4)',
            borderRadius: '12px',
            padding: '14px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <CheckCircle2 size={22} color="var(--ok)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '14px', color: '#ffffff' }}>
                {importResult.message}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--ok)', marginTop: '2px' }}>
                Data master telah terbarui dan siap digunakan di sistem MOVA POS.
              </div>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              style={{ fontWeight: 700 }}
            >
              Selesai
            </button>
          </div>
        )}

        {/* Live Parsed Preview Table */}
        {!importResult && parsedRows.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Table size={16} color="var(--primary)" />
                Pratinjau Data Parsed ({parsedRows.length} Baris)
              </div>
              <div style={{ display: 'flex', gap: '8px', fontSize: '11.5px' }}>
                <span className="pill pill-ok" style={{ fontWeight: 700 }}>
                  ✓ {validCount} Valid
                </span>
                {invalidCount > 0 && (
                  <span className="pill pill-danger" style={{ fontWeight: 700 }}>
                    ⚠ {invalidCount} Error
                  </span>
                )}
              </div>
            </div>

            <div style={{ maxHeight: '220px', overflowY: 'auto', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '8px 12px', width: '50px' }}>#</th>
                    <th style={{ padding: '8px 12px' }}>Nama Item</th>
                    <th style={{ padding: '8px 12px' }}>Detail Data</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Status Validasi</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: row.isValid ? undefined : 'rgba(239, 68, 68, 0.08)' }}>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{row.rowNumber}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: '#ffffff' }}>
                        {row.data.name || row.data.customer_name || '—'}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: '11px' }}>
                        {currentMasterType === 'INGREDIENT' && `${row.data.type} · Satuan: ${row.data.unit_beli}/${row.data.unit_pakai} · ${rupiah(row.data.harga)}`}
                        {currentMasterType === 'MENU' && `${row.data.category} · ${row.data.item_type} · ${rupiah(row.data.price)}`}
                        {currentMasterType === 'RECEIVABLE' && `Total: ${rupiah(row.data.total_amount)} · DP: ${rupiah(row.data.initial_paid)}`}
                        {currentMasterType === 'OUTLET' && `${row.data.type} · PIC: ${row.data.pic_name || '—'} · ${row.data.phone || ''}`}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        {row.isValid ? (
                          <span style={{ color: 'var(--ok)', fontWeight: 700, fontSize: '11px' }}>✓ Siap Import</span>
                        ) : (
                          <span style={{ color: '#f87171', fontWeight: 700, fontSize: '11px' }} title={row.errors.join(', ')}>
                            ⚠ {row.errors[0]}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Batal
          </button>
          {!importResult && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmitImport}
              disabled={submitting || validCount === 0}
              style={{ fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {submitting ? 'Meng-import...' : `Simpan & Import (${validCount} Item Valid)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
