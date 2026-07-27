'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authedFetch } from '../../lib/authedFetch';
import { useAuth } from '../../contexts/AuthContext';

interface Listing {
  unit_code:  string;
  property:   string;
  zone:       string;
  type:       string;
  config:     string;
  furnishing: string;
  rent:       number;
}

function formatQAR(n: number) {
  return 'QAR ' + n.toLocaleString('en-QA');
}

const TYPE_ACCENT: Record<string, string> = {
  Apartment:  '#5b9cf6',
  Villa:      '#2dd496',
  Townhouse:  '#a47cf5',
  Penthouse:  '#c9a84c',
  Studio:     '#5b9cf6',
  Duplex:     '#f5a847',
  Office:     '#7878a8',
};

export default function TopListings() {
  const { user } = useAuth();
  const router   = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading,  setLoading ] = useState(true);

  useEffect(() => {
    if (!user) return;
    authedFetch('/api/dashboard/top-listings')
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.listings) setListings(j.listings); })
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={headingStyle}>Top Available</h3>
        <button
          onClick={() => router.push('/inventory?status=Available')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#5b9cf6', padding: 0 }}
        >
          See all →
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 72, borderRadius: 8, background: '#1a1a24' }} />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <p style={{ fontSize: 12, color: '#44445a', margin: 0 }}>No available units found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {listings.map((l, rank) => {
            const accent = TYPE_ACCENT[l.type] ?? '#7878a8';
            return (
              <div
                key={l.unit_code}
                onClick={() => router.push('/inventory')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  background: '#0d0d14',
                  border: '1px solid #1e1e2e',
                  borderLeft: `3px solid ${accent}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'border-color .12s, background .12s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = '#14141e';
                  (e.currentTarget as HTMLElement).style.borderColor = accent;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = '#0d0d14';
                  (e.currentTarget as HTMLElement).style.borderColor = '#1e1e2e';
                  (e.currentTarget as HTMLElement).style.borderLeftColor = accent;
                }}
              >
                {/* Rank badge */}
                <span style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: rank === 0 ? 'rgba(201,168,76,.15)' : '#17171f',
                  border: `1px solid ${rank === 0 ? 'rgba(201,168,76,.4)' : '#2e2e3e'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, color: rank === 0 ? '#c9a84c' : '#44445a',
                  flexShrink: 0,
                }}>
                  {rank + 1}
                </span>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e2ee' }}>
                      {l.unit_code}
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                      color: accent, padding: '1px 5px', borderRadius: 3,
                      background: `${accent}18`,
                    }}>
                      {l.type}
                    </span>
                  </div>
                  <p style={{ fontSize: 10, color: '#7878a8', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.property}{l.zone ? ` · ${l.zone}` : ''}{l.config ? ` · ${l.config}` : ''}{l.furnishing ? ` · ${l.furnishing}` : ''}
                  </p>
                </div>

                {/* Rent */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e2ee', fontVariantNumeric: 'tabular-nums' }}>
                    {formatQAR(l.rent)}
                  </div>
                  <div style={{ fontSize: 9, color: '#44445a' }}>/ year</div>
                </div>
              </div>
            );
          })}
        </div>
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
  margin: 0,
};
