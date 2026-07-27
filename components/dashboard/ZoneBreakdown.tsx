'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authedFetch } from '../../lib/authedFetch';
import { useAuth } from '../../contexts/AuthContext';

interface ZoneRow {
  zone:      string;
  total:     number;
  available: number;
}

export default function ZoneBreakdown() {
  const { user } = useAuth();
  const router   = useRouter();
  const [zones,   setZones  ] = useState<ZoneRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    authedFetch('/api/dashboard/zones')
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.zones) setZones(j.zones); })
      .finally(() => setLoading(false));
  }, [user]);

  const maxTotal = Math.max(...zones.map(z => z.total), 1);

  return (
    <div style={cardStyle}>
      <h3 style={headingStyle}>Zone Breakdown</h3>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[80, 65, 90, 50].map((w, i) => (
            <div key={i} style={{ height: 32, borderRadius: 6, width: `${w}%`, background: '#1a1a24' }} />
          ))}
        </div>
      ) : zones.length === 0 ? (
        <p style={{ fontSize: 12, color: '#44445a', margin: 0 }}>No zone data available.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Header */}
          <div style={rowStyle(false)}>
            <span style={{ ...cellStyle, color: '#44445a', width: '40%' }}>Zone</span>
            <span style={{ ...cellStyle, color: '#44445a', width: '30%' }}>Occupancy</span>
            <span style={{ ...cellStyle, color: '#44445a', width: '15%', textAlign: 'right' }}>Total</span>
            <span style={{ ...cellStyle, color: '#44445a', width: '15%', textAlign: 'right' }}>Avail.</span>
          </div>

          {zones.map((z, i) => {
            const occupancy = z.total > 0 ? Math.round(((z.total - z.available) / z.total) * 100) : 0;
            const fillPct   = (z.total / maxTotal) * 100;
            const availPct  = z.total > 0 ? Math.round((z.available / z.total) * 100) : 0;

            return (
              <div
                key={z.zone}
                style={{
                  ...rowStyle(true),
                  cursor: 'pointer',
                  borderTop: i === 0 ? '1px solid #1e1e2e' : undefined,
                }}
                onClick={() => router.push(`/inventory?zone=${encodeURIComponent(z.zone)}`)}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#17171f'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                {/* Zone name */}
                <span style={{ ...cellStyle, width: '40%', color: '#c8c8e8', fontWeight: 600 }}>
                  {z.zone}
                </span>

                {/* Fill bar */}
                <div style={{ width: '30%', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, height: 4, background: '#1e1e2e', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${fillPct}%`,
                      background: occupancy >= 80 ? '#2dd496' : occupancy >= 50 ? '#5b9cf6' : '#f5a847',
                      borderRadius: 2,
                    }} />
                  </div>
                  <span style={{ fontSize: 10, color: '#44445a', width: 26, flexShrink: 0 }}>
                    {occupancy}%
                  </span>
                </div>

                {/* Total */}
                <span style={{ ...cellStyle, width: '15%', textAlign: 'right', color: '#e2e2ee', fontVariantNumeric: 'tabular-nums' }}>
                  {z.total}
                </span>

                {/* Available */}
                <span style={{
                  ...cellStyle,
                  width: '15%',
                  textAlign: 'right',
                  color: availPct > 0 ? '#2dd496' : '#44445a',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {z.available}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {zones.length > 0 && (
        <button
          onClick={() => router.push('/inventory')}
          style={{
            marginTop: 14,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: '#5b9cf6',
            padding: 0,
          }}
        >
          View full inventory →
        </button>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#111118',
  border: '1px solid #22222e',
  borderRadius: 12,
  padding: '20px',
};

const headingStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  color: '#44445a',
  margin: '0 0 14px',
};

function rowStyle(interactive: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 6px',
    borderBottom: '1px solid #1e1e2e',
    borderRadius: interactive ? 6 : 0,
    transition: 'background .1s',
  };
}

const cellStyle: React.CSSProperties = {
  fontSize: 11,
  flexShrink: 0,
};
