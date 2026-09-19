import React from 'react';
import { AlertOctagon, RefreshCw, Home } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          color: '#ffffff',
          fontFamily: "'Plus Jakarta Sans', sans-serif"
        }}>
          <div style={{
            maxWidth: '560px',
            width: '100%',
            background: 'linear-gradient(135deg, rgba(23, 27, 44, 0.95), rgba(15, 18, 32, 0.98))',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#ef4444'
            }}>
              <AlertOctagon size={32} />
            </div>

            <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px', color: '#ffffff' }}>
              Terjadi Kesalahan Halaman
            </h2>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, marginBottom: '20px' }}>
              Halaman ini mengalami kendala teknis saat memuat data. Silakan muat ulang atau kembali ke dashboard utama.
            </p>

            {this.state.error?.message && (
              <div style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '12px',
                fontFamily: 'monospace',
                color: '#f87171',
                textAlign: 'left',
                overflowX: 'auto',
                marginBottom: '24px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
              }}>
                {this.state.error.toString()}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={this.handleReset}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: '#6366f1',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <RefreshCw size={14} /> Muat Ulang Halaman
              </button>
              <button
                onClick={this.handleGoHome}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.15)',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <Home size={14} /> Ke Beranda
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
