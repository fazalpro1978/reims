'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authedFetch } from '../../lib/authedFetch';
import { useAuth } from '../../contexts/AuthContext';

interface AlertsData {
  maintenance:       number;
  expiring_critical: number;
  expiring_soon:     number;
  samples: {
    maintenance:       string[];
    expiring_critical: string[];
    expiring_soon:     string[];
  };
}

export default function AlertsStrip() {
  const { user, role }  = useAuth();
  const isAgent = role === 'agent';
  const router    = useRouter();
  const [data,    setData   ] = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || isAgent) return;
    authedFetch('/api/dashboard/alerts')
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j && !j.error) setData(j); })
      .finally(() => setLoading(false));
  }, [user, isAgent]);

  if (isAgent || loading || !data) return null;

  interface Alert {
    key:    string;
    icon:   string;
    label:  string;
    sub:    string;
    color:  string;
    bg:     string;
    border: string;
    action: () => void;
  }

  const alerts: Alert[] = [];

  if (data.expiring_critical > 0) alerts.push({
    key:    'critical',
    icon:   '🔴',
    label:  `${data.expiring_critical} lease${data.expiring_critical !== 1 ? 's' : ''} expiring within 7 days`,
    sub:    data.samples.expiring_critical.join(', '),
    color:  '#e8445a',
    bg:     'rgba(232,68,90,.08)',
    border: 'rgba(232,68,90,.25)',
    action: () => router.push('/inventory?status=Leased'),
  });

  if (data.maintenance > 0) alerts.push({
    key:    'maintenance',
    icon:   '🟡',
    label:  `${data.maintenance} unit${data.maintenance !== 1 ? 's' : ''} under maintenance`,
    sub:    data.samples.maintenance.join(', '),
    color:  '#f5a847',
    bg:     'rgba(245,168,71,.08)',
    border: 'rgba(245,168,71,.25)',
    action: () => router.push('/inventory?status=Under_Maintenance'),
  });

  if (data.expiring_soon > 0) alerts.push({
    key:    'soon',
    icon:   '🟠',
    label:  `${data.expiring_soon} lease${data.expiring_soon !== 1 ? 's' : ''} expiring within 30 days`,
    sub:    data.samples.expiring_soon.join(', '),
    color:  '#f5a847',
    bg:     'rgba(245,168,71,.06)',
    border: 'rgba(245,168,71,.18)',
    action: () => router.push('/inventory?status=Leased'),
  });

  if (alerts.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        marginBottom: 12,
      }}
    >
      {alerts.map(a => (
        <button
          key={a.key}
          onClick={a.action}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 10,
            background: a.bg, border: `1px solid ${a.border}`,
            cursor: 'pointer', textAlign: 'left', flex: '1 1 auto',
            minWidth: 220,
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.8'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
        >
          <span style={{ fontSize: 16, flexShrink: 0 }}>{a.icon}</span>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: a.color }}>{a.label}</p>
            {a.sub && (
              <p style={{ margin: '2px 0 0', fontSize: 9.5, color: '#7878a8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.sub}
              </p>
            )}
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: a.color, flexShrink: 0 }}>→</span>
        </button>
      ))}
    </div>
  );
}
