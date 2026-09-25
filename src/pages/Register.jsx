import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User, Mail, Lock, ArrowRight, Clock, Store, Shield,
  Building2, Phone, MapPin, CheckCircle2, Sparkles, Gift
} from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';

export default function Register() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('business'); // 'business' or 'staff'
  const [loading, setLoading] = useState(false);
  const [registeredUser, setRegisteredUser] = useState(null);

  // Form for New Business Owner
  const [businessForm, setBusinessForm] = useState({
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
    business_name: '',
    business_phone: '',
    business_address: '',
    first_outlet_name: '',
    referral_code: '',
  });

  // Form for Staff
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
    business_id: '',
    outlet_id: '',
    role: 'pegawai',
  });

  const [businesses, setBusinesses] = useState([]);
  const [outlets, setOutlets] = useState([]);

  useEffect(() => {
    fetchPublicBusinesses();
    const refParam = new URLSearchParams(window.location.search).get('ref');
    if (refParam) {
      setBusinessForm(p => ({ ...p, referral_code: refParam.toUpperCase().trim() }));
    }
  }, []);

  async function fetchPublicBusinesses() {
    try {
      const { data } = await api.get('/public/businesses');
      setBusinesses(data);
      if (data.length > 0) {
        setStaffForm(p => ({ ...p, business_id: data[0].id }));
        fetchOutletsForBusiness(data[0].id);
      }
    } catch { }
  }

  async function fetchOutletsForBusiness(businessId) {
    if (!businessId) return;
    try {
      const { data } = await api.get(`/public/outlets?business_id=${businessId}`);
      setOutlets(data);
      if (data.length > 0) {
        setStaffForm(p => ({ ...p, outlet_id: data[0].id }));
      } else {
        setStaffForm(p => ({ ...p, outlet_id: '' }));
      }
    } catch { }
  }

  function handleBusinessChange(bId) {
    setStaffForm(p => ({ ...p, business_id: bId }));
    fetchOutletsForBusiness(bId);
  }

  async function handleBusinessSubmit(e) {
    e.preventDefault();
    if (businessForm.password !== businessForm.password_confirmation) {
      toast.error('Konfirmasi password tidak cocok!');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/register', {
        registration_type: 'business',
        ...businessForm,
      });

      if (data.token && data.user) {
        localStorage.setItem('pos_token', data.token);
        localStorage.setItem('pos_user', JSON.stringify(data.user));
        localStorage.setItem('pos_active_outlet_id', String(data.outlet?.id || '1'));
        localStorage.setItem('pos_active_business_id', String(data.business?.id || ''));
        toast.success(data.message || 'Pendaftaran bisnis berhasil!');
        navigate('/');
      } else {
        toast.success(data.message || 'Pendaftaran berhasil!');
        navigate('/login');
      }
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) {
        Object.values(errors).flat().forEach(msg => toast.error(msg));
      } else {
        toast.error(err.response?.data?.message || 'Gagal mendaftarkan bisnis');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleStaffSubmit(e) {
    e.preventDefault();
    if (staffForm.password !== staffForm.password_confirmation) {
      toast.error('Konfirmasi password tidak cocok!');
      return;
    }
    if (!staffForm.business_id) {
      toast.error('Pilih usaha tempat Anda bertugas!');
      return;
    }
    if (!staffForm.outlet_id) {
      toast.error('Pilih cabang outlet tempat Anda bertugas!');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/register', {
        registration_type: 'staff',
        ...staffForm,
      });
      setRegisteredUser(data.user || { name: staffForm.name, email: staffForm.email });
      toast.success(data.message || 'Pendaftaran berhasil!');
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) {
        Object.values(errors).flat().forEach(msg => toast.error(msg));
      } else {
        toast.error(err.response?.data?.message || 'Registrasi pegawai gagal');
      }
    } finally {
      setLoading(false);
    }
  }

  if (registeredUser) {
    return (
      <div className="auth-layout">
        <div className="auth-card" style={{ textAlign: 'center', maxWidth: 480 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '2px solid rgba(245, 158, 11, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px'
            }}
          >
            <Clock size={32} color="#f59e0b" />
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, color: '#ffffff' }}>
            Pendaftaran Berhasil!
          </h2>

          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: 8,
              fontSize: 13,
              color: '#fde68a',
              lineHeight: 1.6,
              marginBottom: 20
            }}
          >
            Akun <strong style={{ color: '#ffffff' }}>{registeredUser.email}</strong> sedang dalam status:
            <div style={{ marginTop: 6 }}>
              <span
                style={{
                  background: '#f59e0b',
                  color: '#11162d',
                  padding: '3px 12px',
                  borderRadius: 20,
                  fontWeight: 800,
                  fontSize: 12,
                  display: 'inline-block'
                }}
              >
                ⏳ MENUNGGU PERSETUJUAN (PENDING APPROVAL)
              </span>
            </div>
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
            Akun Anda akan ditinjau dan disetujui langsung oleh Owner Bisnis dari usaha yang bersangkutan sebelum dapat digunakan untuk masuk.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link to="/login" className="btn btn-primary" style={{ justifyContent: 'center' }}>
              Ke Halaman Masuk (Login) <ArrowRight size={14} />
            </Link>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setRegisteredUser(null)}
              style={{ fontSize: 12 }}
            >
              Daftarkan Akun Lain
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-layout">
      <div className="auth-card" style={{ maxWidth: 520 }}>
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <img src="/MOVA.svg" alt="MOVA POS Logo" />
          </div>
          <h1>Daftar MOVA POS</h1>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
            Mendorong bisnis untuk terus bergerak dan berkembang
          </p>
        </div>

        {/* Tab Selection */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: 4,
            borderRadius: 10,
            marginBottom: 22,
            border: '1px solid rgba(165, 180, 252, 0.15)'
          }}
        >
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setTab('business')}
            style={{
              background: tab === 'business' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
              color: tab === 'business' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: tab === 'business' ? 700 : 500,
              boxShadow: tab === 'business' ? '0 2px 10px rgba(99,102,241,0.4)' : 'none',
              border: 'none',
              borderRadius: 8,
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            <Building2 size={15} /> Daftarkan Bisnis Baru
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setTab('staff')}
            style={{
              background: tab === 'staff' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
              color: tab === 'staff' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: tab === 'staff' ? 700 : 500,
              boxShadow: tab === 'staff' ? '0 2px 10px rgba(99,102,241,0.4)' : 'none',
              border: 'none',
              borderRadius: 8,
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            <User size={15} /> Gabung sebagai Pegawai
          </button>
        </div>

        {tab === 'business' ? (
          /* FORM DAFTAR BISNIS BARU (OWNER BISNIS) */
          <form onSubmit={handleBusinessSubmit}>
            <div
              style={{
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 12.5,
                color: '#c7d2fe',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 16
              }}
            >
              <Sparkles size={16} style={{ color: '#a5b4fc', flexShrink: 0 }} />
              <span>Daftarkan usaha Anda dan nikmati fitur Multi-Cabang & Manajemen Resep Bahan Baku gratis trial 30 hari.</span>
            </div>

            <div className="form-group">
              <label className="form-label"><Building2 size={12} style={{ display: 'inline', marginRight: 5 }} />Nama Usaha / Bisnis / Brand *</label>
              <input
                type="text"
                className="form-control"
                required
                placeholder="Contoh: Kopi Kenangan Senja"
                value={businessForm.business_name}
                onChange={e => setBusinessForm({ ...businessForm, business_name: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label"><User size={12} style={{ display: 'inline', marginRight: 5 }} />Nama Pemilik Usaha *</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="Nama lengkap Anda"
                  value={businessForm.name}
                  onChange={e => setBusinessForm({ ...businessForm, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label"><Phone size={12} style={{ display: 'inline', marginRight: 5 }} />No. HP / WhatsApp</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="0812-xxxx-xxxx"
                  value={businessForm.business_phone}
                  onChange={e => setBusinessForm({ ...businessForm, business_phone: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label"><Mail size={12} style={{ display: 'inline', marginRight: 5 }} />Alamat Email (Login) *</label>
              <input
                type="email"
                className="form-control"
                required
                placeholder="owner@brand.id"
                value={businessForm.email}
                onChange={e => setBusinessForm({ ...businessForm, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label"><Store size={12} style={{ display: 'inline', marginRight: 5 }} />Nama Cabang Perdana *</label>
              <input
                type="text"
                className="form-control"
                required
                placeholder="Contoh: Outlet Pusat atau Cabang Ranggong"
                value={businessForm.first_outlet_name}
                onChange={e => setBusinessForm({ ...businessForm, first_outlet_name: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label"><Lock size={12} style={{ display: 'inline', marginRight: 5 }} />Password *</label>
                <input
                  type="password"
                  className="form-control"
                  required
                  placeholder="Min. 8 karakter"
                  value={businessForm.password}
                  onChange={e => setBusinessForm({ ...businessForm, password: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label"><Lock size={12} style={{ display: 'inline', marginRight: 5 }} />Konfirmasi Password *</label>
                <input
                  type="password"
                  className="form-control"
                  required
                  placeholder="Ulangi password"
                  value={businessForm.password_confirmation}
                  onChange={e => setBusinessForm({ ...businessForm, password_confirmation: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 4 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span><Gift size={12} style={{ display: 'inline', marginRight: 5, color: '#f59e0b' }} />Kode Referral Mitra (Opsional)</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Ada rekomendasi?</span>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Contoh: REF-A8K2M9"
                style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, color: '#fbbf24' }}
                value={businessForm.referral_code}
                onChange={e => setBusinessForm({ ...businessForm, referral_code: e.target.value.toUpperCase() })}
              />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginTop: 3 }}>
                Jika Anda mendaftar atas rekomendasi rekan / mitra MOVA POS, masukkan kodenya di sini.
              </span>
            </div>

            <button type="submit" className="btn btn-primary w-full" style={{ marginTop: 10, justifyContent: 'center' }} disabled={loading}>
              {loading ? 'Mendaftarkan Bisnis...' : 'Daftarkan Bisnis & Mulai'}
              {!loading && <ArrowRight size={15} />}
            </button>
          </form>
        ) : (
          /* FORM DAFTAR PEGAWAI DI BISNIS YANG SUDAH ADA */
          <form onSubmit={handleStaffSubmit}>
            <div className="form-group">
              <label className="form-label"><Building2 size={12} style={{ display: 'inline', marginRight: 5 }} />Pilih Usaha / Tempat Bertugas *</label>
              <select
                className="form-control"
                value={staffForm.business_id}
                onChange={e => handleBusinessChange(e.target.value)}
                required
              >
                {businesses.map(b => (
                  <option key={b.id} value={b.id}>
                    🏢 {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label"><Store size={12} style={{ display: 'inline', marginRight: 5 }} />Pilih Cabang Outlet *</label>
              <select
                className="form-control"
                value={staffForm.outlet_id}
                onChange={e => setStaffForm({ ...staffForm, outlet_id: e.target.value })}
                required
              >
                {outlets.map(o => (
                  <option key={o.id} value={o.id}>
                    📍 {o.name} {o.is_main ? '(Pusat)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label"><User size={12} style={{ display: 'inline', marginRight: 5 }} />Nama Lengkap Pegawai *</label>
              <input
                type="text"
                className="form-control"
                required
                placeholder="Nama Anda"
                value={staffForm.name}
                onChange={e => setStaffForm({ ...staffForm, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label"><Mail size={12} style={{ display: 'inline', marginRight: 5 }} />Alamat Email *</label>
              <input
                type="email"
                className="form-control"
                required
                placeholder="email@contoh.com"
                value={staffForm.email}
                onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label"><Shield size={12} style={{ display: 'inline', marginRight: 5 }} />Peran / Posisi *</label>
              <select
                className="form-control"
                value={staffForm.role}
                onChange={e => setStaffForm({ ...staffForm, role: e.target.value })}
              >
                <option value="pegawai">Kasir / Pegawai Operasional</option>
                <option value="owner_outlet">Store Manager Cabang</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label"><Lock size={12} style={{ display: 'inline', marginRight: 5 }} />Password *</label>
                <input
                  type="password"
                  className="form-control"
                  required
                  placeholder="Min. 8 karakter"
                  value={staffForm.password}
                  onChange={e => setStaffForm({ ...staffForm, password: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label"><Lock size={12} style={{ display: 'inline', marginRight: 5 }} />Konfirmasi Password *</label>
                <input
                  type="password"
                  className="form-control"
                  required
                  placeholder="Ulangi password"
                  value={staffForm.password_confirmation}
                  onChange={e => setStaffForm({ ...staffForm, password_confirmation: e.target.value })}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-full" style={{ marginTop: 10, justifyContent: 'center' }} disabled={loading}>
              {loading ? 'Mengirim Pendaftaran...' : 'Kirim Pendaftaran Pegawai'}
              {!loading && <ArrowRight size={15} />}
            </button>
          </form>
        )}

        <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
          Sudah punya akun? <Link to="/login" className="auth-link">Masuk</Link>
        </p>
      </div>
    </div>
  );
}
