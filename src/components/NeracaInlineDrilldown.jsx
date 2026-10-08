import React, { useState, useEffect } from 'react';
import { ChevronRight, ExternalLink } from 'lucide-react';
import api from '../api/client';
import { rupiah } from './ui';

export default function NeracaInlineDrilldown({
  accountCode,
  accountName,
  period,
  onSelectBranch,
}) {
  const [loading, setLoading] = useState(true);
  const [outlets, setOutlets] = useState([]);

  useEffect(() => {
    if (!accountCode) return;
    let isMounted = true;
    setLoading(true);

    const params = {
      account_code: accountCode,
      account_name: accountName || '',
      from: period?.from,
      to: period?.to,
    };

    api
      .get('/reports/balance-sheet/detail', { params })
      .then((res) => {
        if (isMounted) {
          const list = res.data?.outlets_breakdown || res.data?.outlets || [];
          setOutlets(list);
        }
      })
      .catch((err) => {
        console.error('Gagal mengambil drilldown akun:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [accountCode, period?.from, period?.to]);

  if (loading) {
    return (
      <div style={{ padding: '8px 16px 8px 36px', color: 'var(--text-muted)', fontSize: 12 }}>
        <span className="spin-anim" style={{ display: 'inline-block', marginRight: 6 }}>⏳</span>
        Memuat rincian cabang...
      </div>
    );
  }

  if (outlets.length === 0) {
    return (
      <div style={{ padding: '6px 16px 6px 36px', color: 'var(--text-muted)', fontSize: 12 }}>
        Tidak ada data rincian cabang.
      </div>
    );
  }

  return (
    <div
      className="fade-in"
      style={{
        marginLeft: 28,
        paddingLeft: 12,
        borderLeft: '2px solid rgba(165, 180, 252, 0.15)',
        marginTop: 2,
        marginBottom: 6,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {outlets.map((out, idx) => {
        const subCode = out.sub_code || `${accountCode}.${String(idx + 1).padStart(2, '0')}`;

        return (
          <div
            key={out.outlet_id || idx}
            onClick={() => onSelectBranch && onSelectBranch(out)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '7px 12px',
              borderRadius: 6,
              fontSize: 12.5,
              cursor: 'pointer',
              background: 'rgba(255, 255, 255, 0.02)',
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)';
              e.currentTarget.style.borderLeft = '2px solid #38bdf8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
              e.currentTarget.style.borderLeft = 'none';
            }}
            title="Klik untuk membuka modal jurnal transaksi cabang ini"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="mono" style={{ color: '#38bdf8', fontSize: 11.5, minWidth: 90, fontWeight: 600 }}>
                {subCode}
              </span>
              <span style={{ color: '#ffffff', fontWeight: 500 }}>
                {out.outlet_name}
              </span>
              {out.tx_count > 0 && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.05)', padding: '1px 6px', borderRadius: 10 }}>
                  {out.tx_count} mutasi
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="mono" style={{ fontWeight: 600, color: out.balance < 0 ? '#f43f5e' : '#e2e8f0', fontSize: 12.5 }}>
                {rupiah(out.balance)}
              </span>
              <ExternalLink size={12} color="var(--text-muted)" style={{ opacity: 0.7 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
