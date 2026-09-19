import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/login', form);
      localStorage.setItem('pos_token', data.token);
      localStorage.setItem('pos_user', JSON.stringify(data.user));
      const u = data.user;
      const isSuperadminPlatform = u.role === 'superadmin_platform' || u.role === 'superadmin' || Boolean(u.is_superadmin_platform);
      const isOwnerWebsite = u.role === 'owner_website' || Boolean(u.is_owner_website);
      const isPlatformAdmin = isSuperadminPlatform || isOwnerWebsite;
      const isOwnerBisnis = u.role === 'owner_bisnis' || u.role === 'owner' || u.role === 'admin' || Boolean(u.is_owner_bisnis);
      const isOwnerOutlet = u.role === 'owner_outlet' || u.role === 'manager_outlet' || Boolean(u.is_owner_outlet);
      const isPegawai = !isPlatformAdmin && !isOwnerBisnis && !isOwnerOutlet;

      if (u.outlet_id && (isPegawai || isOwnerOutlet)) {
        localStorage.setItem('pos_active_outlet_id', String(u.outlet_id));
      }

      navigate(isPegawai ? '/pos' : isPlatformAdmin ? '/businesses' : '/');
    } catch (err) {
      if (!err.response) {
        toast.error('Tidak dapat terhubung ke server.');
      } else if (err.response?.data?.errors) {
        Object.values(err.response.data.errors).flat().forEach(m => toast.error(m));
      } else {
        toast.error(err.response?.data?.message || 'Login gagal, periksa email dan password.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <img src="/mova%20logo.svg" alt="MOVA POS Logo" />
          </div>
          <h1>MOVA POS</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Move Your Business Forward
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              <Mail size={12} style={{ display: 'inline', marginRight: 5 }} />
              Email
            </label>
            <input
              type="email"
              className="form-control"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
              placeholder="nama@email.com"
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="form-label" style={{ margin: 0 }}>
                <Lock size={12} style={{ display: 'inline', marginRight: 5 }} />
                Password
              </label>
              <Link
                to="/forgot-password"
                style={{ fontSize: 12, color: 'var(--accent-bright)', textDecoration: 'none', fontWeight: 500 }}
              >
                Lupa password?
              </Link>
            </div>
            <input
              type="password"
              className="form-control"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            style={{ marginTop: 8, justifyContent: 'center' }}
            disabled={loading}
          >
            {loading ? 'Masuk...' : 'Masuk'}
            {!loading && <ArrowRight size={15} />}
          </button>
        </form>

        <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
          Belum punya akun?{' '}
          <Link to="/register" className="auth-link">Daftar sekarang</Link>
        </p>
      </div>
    </div>
  );
}
