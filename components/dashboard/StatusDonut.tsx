'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authedFetch } from '../../lib/authedFetch';
import { useAuth } from '../../contexts/AuthContext';

interface KPIData {
  total: number;
  available: number;
  leased: number;
  reserved: number;
  maintenance: number;
  types: Record<string, number>;
}

const STATUS_SLICES = [
  { key: 'available',   label: 'Available',    color: '#2dd496', param: 'Available'   },
  { key: 'leased',      label: 'Leased',        color: '#5b9cf6', param: 'Leased'      },
  { key: 'reserved',    label: 'Reserved',      color: '#a47cf5', param: 'Reserved'    },
  { key: 'maintenance', label: 'Maintenance',   color: '#f5a847', param: 'Under_Maintenance' },
] as const;

const TYPE_ORDER = ['Apartment','Villa','Townhouse','Penthouse','Studio','Duplex','Office'];

const R = 54, CX = 70, CY = 70, STROKE = 14;
const CIRC = 2 * Math.PI * R;

function buildArcs(data: KPIData) {
  const total = data.total || 1;
  let offset = 0;
  return STATUS_SLICES.map(s => {
    const count = data[s.key as keyof KPIData] as number;
    const frac  = count / total;
    const dash  = frac * CIRC;
    const arc   = { ...s, count, frac, dashOffset: CIRC - offset, dashLen: dash - 2 };
    offset += dash;
    return arc;
  });
}

export default function StatusDonut() {
  const { user } = useAuth();
  const router   = useRouter();
  const [data,    setData   ] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    authedFetch('/api/dashboard/kpis')
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j && !j.error) setData(j); })
      .finally(() => setLoading(false));
  }, [user]);

  const arcs    = data ? buildArcs(data) : [];
  const types   = data?.types ?? {};
  const maxType = Math.max(...Object.values(types), 1);

  const orderedTypes = TYPE_ORDER
    .filter(t => types[t])
    .map(t => ({ label: t, count: types[t] }));
  const otherTypes = Object.entries(types)
    .filter(([k]) => !TYPE_ORDER.includes(k))
    .map(([label, count]) => ({ label, count }));
  const allTypes = [...orderedTypes, ...otherTypes];

  if (loading) {
    return (
      <div style={cardStyle}>
        <div style={skeletonStyle} />
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <h3 style={headingStyle}>Portfolio Status</h3>

      {/* Donut + legend row */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 20 }}>
        {/* SVG Donut */}
        <div style={{ flexShrink: 0, position: 'relative' }}>
          <svg width={140} height={140} viewBox="0 0 140 140">
            {/* Track */}
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="#1e1e2e" strokeWidth={STROKE} />
            {arcs.map(a => (
              <circle
                key={a.key}
                cx={CX}
                cy={CY}
                r={R}
                fill="none"
                stroke={a.color}
                strokeWidth={hovered === a.key ? STROKE + 3 : STROKE}
                strokeDasharray={`${Math.max(0, a.dashLen)} ${CIRC}`}
                strokeDashoffset={a.dashOffset}
                strokeLinecap="round"
                style={{
                  transform: 'rotate(-90deg)',
                  transformOrigin: `${CX}px ${CY}px`,
                  cursor: 'pointer',
                  transition: 'stroke-width .15s',
                  opacity: hovered && hovered !== a.key ? 0.4 : 1,
                }}
                onMouseEnter={() => setHovered(a.key)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => router.push(`/inventory?status=${a.param}`)}
              />
            ))}
            {/* Centre label */}
            <text x={CX} y={CY - 6} textAnchor="middle" fill="#e2e2ee" fontSize={20} fontWeight={700}>
              {data?.total ?? '—'}
            </text>
            <text x={CX} y={CY + 10} textAnchor="middle" fill="#44445a" fontSize={9} letterSpacing="0.08em">
              TOTAL
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {arcs.map(a => (
            <button
              key={a.key}
              onClick={() => router.push(`/inventory?status=${a.param}`)}
              onMouseEnter={() => setHovered(a.key)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '2px 0',
                opacity: hovered && hovered !== a.key ? 0.4 : 1,
                transition: 'opacity .15s',
              }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: a.color, flexShrink: 0,
              }} />
              <span style={{ fontSize: 11, color: '#7878a8', flex: 1, textAlign: 'left' }}>
                {a.label}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e2ee', fontVariantNumeric: 'tabular-nums' }}>
                {a.count}
              </span>
              <span style={{ fontSize: 10, color: '#44445a', width: 32, textAlign: 'right' }}>
                {data && data.total > 0 ? `${Math.round((a.count / data.total) * 100)}%` : '—'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Type breakdown bars */}
      {allTypes.length > 0 && (
        <>
          <div style={{ height: 1, background: '#1e1e2e', margin: '4px 0 14px' }} />
          <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#44445a', margin: '0 0 10px' }}>
            By Type
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {allTypes.map(({ label, count }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: '#7878a8', width: 82, flexShrink: 0 }}>{label}</span>
                <div style={{ flex: 1, height: 4, background: '#1e1e2e', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(count / maxType) * 100}%`,
                    background: 'linear-gradient(90deg, #5030e8, #00d0b8)',
                    borderRadius: 2,
                    transition: 'width .4s ease',
                  }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#e2e2ee', width: 22, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </>
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
  margin: '0 0 16px',
};

const skeletonStyle: React.CSSProperties = {
  width: 140,
  height: 140,
  borderRadius: '50%',
  background: 'linear-gradient(90deg, #1a1a24 25%, #22222e 50%, #1a1a24 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.4s infinite',
};
