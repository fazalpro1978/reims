'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';

const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function greeting(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(d: Date) {
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export default function GreetingBar() {
  const { user, can } = useAuth();
  const router        = useRouter();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const firstName = user?.fullName?.split(' ')[0] ?? user?.email?.split('@')[0] ?? '';

  const actions = [
    can('units.add')      && { label: '+ Add Unit',        onClick: () => router.push('/inventory?action=add'),    primary: true  },
    can('report.generate')&& { label: 'Generate Report',   onClick: () => router.push('/inventory'),               primary: false },
    can('admin.access')   && { label: 'AXIOM Import',      onClick: () => router.push('/ingest-queue'),                                primary: false },
  ].filter(Boolean) as { label: string; onClick: () => void; primary: boolean }[];

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 16, marginBottom: 20,
      }}
    >
      {/* Left — greeting */}
      <div>
        <h2
          style={{
            fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em',
            color: '#e2e2ee', margin: 0, lineHeight: 1.2,
          }}
        >
          {greeting(now.getHours())}{firstName ? `, ${firstName}` : ''}.
        </h2>
        <p style={{ fontSize: 11, color: '#44445a', margin: '4px 0 0', letterSpacing: '.01em' }}>
          {formatDate(now)} · Portfolio updated just now
        </p>
      </div>

      {/* Right — quick actions */}
      {actions.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {actions.map(a => (
            <button
              key={a.label}
              onClick={a.onClick}
              style={{
                padding: '7px 14px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '.04em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                border: a.primary ? '1px solid rgba(201,168,76,.35)' : '1px solid #2e2e3e',
                background: a.primary ? 'rgba(201,168,76,.12)' : '#17171f',
                color: a.primary ? '#c9a84c' : '#7878a8',
                transition: 'all .12s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = a.primary ? '#d9b85c' : '#e2e2ee';
                (e.currentTarget as HTMLElement).style.borderColor = a.primary ? 'rgba(201,168,76,.6)' : '#44445a';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = a.primary ? '#c9a84c' : '#7878a8';
                (e.currentTarget as HTMLElement).style.borderColor = a.primary ? 'rgba(201,168,76,.35)' : '#2e2e3e';
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
