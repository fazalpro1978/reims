'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authedFetch } from '../../lib/authedFetch';
import { useAuth } from '../../contexts/AuthContext';

interface UploadRun {
  id:              string;
  source_file:     string;
  status:          string;
  record_count:    number;
  approved_count:  number;
  exported_count:  number;
  uploaded_at:     string;
  uploaded_by:     string;
}

interface AxiomData {
  recentRuns:    UploadRun[];
  pendingExport: number;
}

const STATUS_COLOR: Record<string, string> = {
  processing:         '#f5a847',
  staged:             '#5b9cf6',
  partially_approved: '#a47cf5',
  approved:           '#2dd496',
  exported:           '#2dd496',
  failed:             '#e8445a',
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function shortFileName(name: string): string {
  const base = name.split('/').pop() ?? name;
  return base.length > 28 ? '…' + base.slice(-26) : base;
}

export default function AxiomStatus() {
  const { user, role }  = useAuth();
  const isAgent = role === 'agent';
  const router    = useRouter();
  const [data,    setData   ] = useState<AxiomData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || isAgent) return;
    authedFetch('/api/dashboard/axiom-status')
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j && !j.error) setData(j); })
      .finally(() => setLoading(false));
  }, [user, isAgent]);

  if (isAgent) return null;

  const latest = data?.recentRuns?.[0];

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={headingStyle}>AXIOM Pipeline</h3>
        <button
          onClick={() => router.push('/ingest-queue')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 10, fontWeight: 700, letterSpacing: '.08em',
            textTransform: 'uppercase', color: '#5b9cf6', padding: 0,
          }}
        >
          Open queue →
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2].map(i => <div key={i} style={{ height: 54, borderRadius: 8, background: '#1a1a24' }} />)}
        </div>
      ) : !latest ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <p style={{ fontSize: 12, color: '#44445a', margin: '0 0 12px' }}>No ingest runs yet.</p>
          <button
            onClick={() => router.push('/ingest-queue')}
            style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 11,
              fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase',
              cursor: 'pointer', border: '1px solid #2e2e3e',
              background: '#17171f', color: '#7878a8',
            }}
          >
            Start first import
          </button>
        </div>
      ) : (
        <>
          {/* Pending export banner */}
          {(data?.pendingExport ?? 0) > 0 && (
            <div
              onClick={() => router.push('/ingest-queue')}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8,
                background: 'rgba(201,168,76,.08)',
                border: '1px solid rgba(201,168,76,.25)',
                cursor: 'pointer', marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 14 }}>⏳</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#c9a84c' }}>
                  {data!.pendingExport} record{data!.pendingExport !== 1 ? 's' : ''} pending export
                </p>
                <p style={{ margin: '1px 0 0', fontSize: 10, color: '#7878a8' }}>
                  Approved in AXIOM — ready to import into REIMS
                </p>
              </div>
              <span style={{ fontSize: 11, color: '#c9a84c' }}>→</span>
            </div>
          )}

          {/* Recent runs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data!.recentRuns.slice(0, 4).map((run, i) => {
              const color = STATUS_COLOR[run.status] ?? '#44445a';
              const pct   = run.record_count > 0
                ? Math.round((run.approved_count / run.record_count) * 100)
                : 0;
              return (
                <div
                  key={run.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 10px', borderRadius: 8,
                    background: i === 0 ? '#0d0d14' : 'transparent',
                    border: `1px solid ${i === 0 ? '#1e1e2e' : 'transparent'}`,
                  }}
                >
                  {/* Status dot */}
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />

                  {/* File + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 11, color: '#c8c8e8', fontWeight: i === 0 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {shortFileName(run.source_file)}
                    </p>
                    <p style={{ margin: '1px 0 0', fontSize: 9.5, color: '#44445a' }}>
                      {run.record_count} records
                      {run.record_count > 0 ? ` · ${pct}% approved` : ''}
                      {' · '}{relTime(run.uploaded_at)}
                    </p>
                  </div>

                  {/* Status chip */}
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '.05em',
                    textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4,
                    color, background: `${color}18`, flexShrink: 0,
                  }}>
                    {run.status.replace('_', ' ')}
                  </span>
                </div>
              );
            })}
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
  margin: 0,
};
