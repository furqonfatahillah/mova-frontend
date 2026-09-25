import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Mail, Lock, KeyRound, ArrowRight, ArrowLeft,
  CheckCircle2, RefreshCw, Eye, EyeOff, ShieldCheck, Sparkles
} from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';

export default function ForgotPassword() {
  const navigate = useNavigate();

  // Steps: 1 = Email, 2 = Verify OTP, 3 = Reset Password, 4 = Success
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Timer for resend code
  const [resendCountdown, setResendCountdown] = useState(0);

  // OTP inputs refs
  const otpRefs = useRef([]);

  useEffect(() => {
    let timer;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown(c => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // Handle Step 1: Request OTP Code
  async function handleRequestOtp(e) {
    if (e) e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Masukkan alamat email yang valid.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/forgot-password', { email });
      toast.success(res.data.message || 'Kode verifikasi telah dikirim ke email Anda.');
      setResendCountdown(60);
      setStep(2);
      // Focus first OTP input
      setTimeout(() => {
        if (otpRefs.current[0]) otpRefs.current[0].focus();
      }, 100);
    } catch (err) {
      const msg = err.response?.data?.errors?.email?.[0] || err.response?.data?.message || 'Gagal mengirim kode verifikasi.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  // Handle OTP digit changes
  function handleOtpChange(index, value) {
    if (value.length > 1) {
      // User pasted full code
      const pasted = value.replace(/\D/g, '').slice(0, 6);
      if (pasted.length > 0) {
        const newOtp = [...otp];
        for (let i = 0; i < 6; i++) {
          newOtp[i] = pasted[i] || '';
        }
        setOtp(newOtp);
        const nextIdx = Math.min(pasted.length, 5);
        if (otpRefs.current[nextIdx]) otpRefs.current[nextIdx].focus();
        return;
      }
    }

    const digit = value.replace(/\D/g, '');
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-advance to next input
    if (digit && index < 5 && otpRefs.current[index + 1]) {
      otpRefs.current[index + 1].focus();
    }
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1].focus();
    }
  }

  // Handle Step 2: Verify OTP
  async function handleVerifyOtp(e) {
    e.preventDefault();
    const fullCode = otp.join('');
    if (fullCode.length !== 6) {
      toast.error('Masukkan 6 digit kode verifikasi dengan lengkap.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/verify-reset-code', { email, code: fullCode });
      toast.success('Kode verifikasi cocok! Silakan buat password baru.');
      setStep(3);
    } catch (err) {
      const msg = err.response?.data?.errors?.code?.[0] || err.response?.data?.message || 'Kode verifikasi tidak valid.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  // Handle Step 3: Save New Password
  async function handleResetPassword(e) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('Password baru minimal harus 8 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi password tidak cocok.');
      return;
    }

    setLoading(true);
    try {
      const fullCode = otp.join('');
      const res = await api.post('/reset-password', {
        email,
        code: fullCode,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      toast.success(res.data.message || 'Password berhasil diubah!');
      setStep(4);
    } catch (err) {
      const msg = err.response?.data?.errors?.password?.[0] || err.response?.data?.message || 'Gagal mengubah password.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-card" style={{ maxWidth: 460 }}>
        {/* Header Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <img src="/MOVA.svg" alt="MOVA POS Logo" />
          </div>
          <h1>MOVA POS</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Pemulihan Akses Akun
          </p>
        </div>

        {/* STEP 1: INPUT EMAIL */}
        {step === 1 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px', color: '#818cf8'
              }}>
                <KeyRound size={22} />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Lupa Kata Sandi?
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
                Masukkan alamat email yang terdaftar pada akun MOVA POS Anda. Kami akan mengirimkan kode verifikasi 6-digit.
              </p>
            </div>

            <form onSubmit={handleRequestOtp}>
              <div className="form-group">
                <label className="form-label">
                  <Mail size={12} style={{ display: 'inline', marginRight: 5 }} />
                  Alamat Email Terdaftar
                </label>
                <input
                  type="email"
                  className="form-control"
                  required
                  placeholder="nama@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                style={{ marginTop: 10, justifyContent: 'center', height: 44 }}
                disabled={loading || !email}
              >
                {loading ? 'Mengirim Kode...' : 'Kirim Kode Verifikasi'}
                {!loading && <ArrowRight size={15} />}
              </button>
            </form>

            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <Link to="/login" style={{
                fontSize: 13, color: 'var(--text-secondary)',
                display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none'
              }}>
                <ArrowLeft size={14} /> Kembali ke Halaman Login
              </Link>
            </div>
          </div>
        )}

        {/* STEP 2: VERIFY OTP */}
        {step === 2 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px', color: '#38bdf8'
              }}>
                <ShieldCheck size={22} />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Verifikasi Kode Email
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
                Kode 6-digit telah dikirimkan ke <br />
                <strong style={{ color: 'var(--accent-bright)' }}>{email}</strong>
              </p>
            </div>

            <form onSubmit={handleVerifyOtp}>
              <div style={{ marginBottom: 24 }}>
                <label className="form-label" style={{ textAlign: 'center', display: 'block', marginBottom: 16, color: '#ffffff', fontWeight: 600, fontSize: 13.5 }}>
                  Masukkan 6 Digit Kode Verifikasi (OTP)
                </label>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', padding: '6px 0' }}>
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={el => otpRefs.current[idx] = el}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(idx, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(idx, e)}
                      onFocus={e => {
                        e.target.style.borderColor = '#c084fc';
                        e.target.style.background = '#1e2548';
                        e.target.style.boxShadow = '0 0 18px rgba(192, 132, 252, 0.45)';
                      }}
                      onBlur={e => {
                        e.target.style.borderColor = digit ? '#8b5cf6' : 'rgba(165, 180, 252, 0.35)';
                        e.target.style.background = digit ? 'rgba(30, 37, 72, 0.95)' : 'rgba(15, 20, 41, 0.95)';
                        e.target.style.boxShadow = digit ? '0 0 12px rgba(139, 92, 246, 0.3)' : 'inset 0 2px 4px rgba(0,0,0,0.4)';
                      }}
                      style={{
                        width: 48,
                        height: 56,
                        textAlign: 'center',
                        fontSize: 24,
                        fontWeight: 800,
                        fontFamily: "'JetBrains Mono', 'Plus Jakarta Sans', monospace",
                        borderRadius: 12,
                        background: digit ? 'rgba(30, 37, 72, 0.95)' : 'rgba(15, 20, 41, 0.95)',
                        border: digit ? '2px solid #8b5cf6' : '2px solid rgba(165, 180, 252, 0.35)',
                        color: '#ffffff',
                        outline: 'none',
                        boxShadow: digit ? '0 0 12px rgba(139, 92, 246, 0.3)' : 'inset 0 2px 4px rgba(0,0,0,0.4)',
                        transition: 'all 0.2s ease',
                      }}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                style={{ justifyContent: 'center', height: 44 }}
                disabled={loading || otp.join('').length !== 6}
              >
                {loading ? 'Memverifikasi...' : 'Verifikasi Kode'}
                {!loading && <ArrowRight size={15} />}
              </button>

              <div style={{
                marginTop: 18, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
              }}>
                <span>Tidak menerima kode?</span>
                {resendCountdown > 0 ? (
                  <span style={{ color: 'var(--text-muted)' }}>
                    Kirim ulang ({resendCountdown}s)
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    disabled={loading}
                    style={{
                      background: 'none', border: 'none', color: 'var(--accent-bright)',
                      cursor: 'pointer', padding: 0, fontWeight: 600, fontSize: 13,
                      display: 'inline-flex', alignItems: 'center', gap: 4
                    }}
                  >
                    <RefreshCw size={12} /> Kirim Ulang
                  </button>
                )}
              </div>
            </form>

            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6
                }}
              >
                <ArrowLeft size={14} /> Ganti Alamat Email
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: RESET PASSWORD */}
        {step === 3 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px', color: '#10b981'
              }}>
                <Lock size={22} />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Buat Kata Sandi Baru
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
                Gunakan minimal 8 karakter dengan kombinasi huruf dan angka.
              </p>
            </div>

            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label className="form-label">
                  <Lock size={12} style={{ display: 'inline', marginRight: 5 }} />
                  Password Baru *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="form-control"
                    required
                    placeholder="Minimal 8 karakter"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    style={{ paddingRight: 40 }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer'
                    }}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Lock size={12} style={{ display: 'inline', marginRight: 5 }} />
                  Konfirmasi Password Baru *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    className="form-control"
                    required
                    placeholder="Ketik ulang password baru"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    style={{ paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(s => !s)}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer'
                    }}
                  >
                    {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                style={{ marginTop: 12, justifyContent: 'center', height: 44 }}
                disabled={loading || !newPassword || !confirmPassword}
              >
                {loading ? 'Menyimpan Password...' : 'Simpan & Perbarui Password'}
                {!loading && <CheckCircle2 size={16} />}
              </button>
            </form>
          </div>
        )}

        {/* STEP 4: SUCCESS */}
        {step === 4 && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.2)', border: '2px solid #10b981',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', color: '#10b981'
            }}>
              <CheckCircle2 size={32} />
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Password Berhasil Diubah!
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6 }}>
              Kata sandi akun Anda telah berhasil diperbarui. Silakan login kembali dengan kata sandi baru Anda.
            </p>

            <button
              type="button"
              className="btn btn-primary w-full"
              style={{ marginTop: 24, justifyContent: 'center', height: 44 }}
              onClick={() => navigate('/login')}
            >
              Masuk ke Akun Sekarang <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
