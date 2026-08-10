'use client';

import { useState, useEffect, useCallback } from 'react';
import { authedFetch } from '../lib/authedFetch';

interface PendingReg {
  id:         string;
  email:      string;
  full_name:  string | null;
  company:    string | null;
  phone:      string | null;
  created_at: string;
}

const ROLES = ['staff', 'agent', 'broker', 'administrator'] as const;

function relTime(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1)  return 'Today';
  if (d < 2)  return 'Yesterday';
  if (d < 7)  return `${Math.floor(d)}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

export default function RegistrationApprovalPanel({ onClose, onResolved }: {
  onClose: () => void;
  onResolved: () => void;
}) {
  const [regs,    setRegs    ] = useState<PendingReg[]>([]);
  const [loading, setLoading ] = useState(true);
  const [acting,  setActing  ] = useState<string | null>(null); // id of row being processed
  const [roles,   setRoles   ] = useState<Record<string, string>>({}); // id → selected role

  const fetchRegs = useCallback(() => {
    authedFetch('/api/admin/registrations')
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.registrations) setRegs(j.registrations); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchRegs(); }, [fetchRegs]);

  const act = async (id: string, action: 'approve' | 'reject') => {
    setActing(id);
    try {
      await authedFetch('/api/admin/registrations', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id, action, role: roles[id] ?? 'staff' }),
      });
      setRegs(prev => prev.filter(r => r.id !== id));
      if (regs.length <= 1) { onResolved(); onClose(); }
    } catch {}
    setActing(null);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 'min(560px, 92vw)', background: '#111118', border: '1px solid #2a2a3e', borderRadius: 14, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,.8)' }}
      >
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #1e1e2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 15, color: '#f59e0b' }}>●</span>
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#e0e0e0', letterSpacing: '.02em' }}>Pending Access Requests</p>
              <p style={{ margin: 0, fontSize: 10, color: '#44445a' }}>Review and assign a role before approving</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#44445a', cursor: 'pointer', fontSize: 16, padding: '2px 6px', lineHeight: 1 }}>✕</button>
        </div>

        {/* List */}
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '32px 22px', textAlign: 'center', color: '#2a2a3e', fontSize: 12 }}>Loading…</div>
          ) : regs.length === 0 ? (
            <div style={{ padding: '32px 22px', textAlign: 'center', color: '#2a2a3e', fontSize: 12 }}>No pending requests.</div>
          ) : regs.map((r, i) => (
            <div key={r.id} style={{ padding: '16px 22px', borderBottom: i < regs.length - 1 ? '1px solid #1a1a26' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#d0d0e8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.full_name ?? r.email.split('@')[0]}
                    </p>
                    <span style={{ fontSize: 9, color: '#44445a', flexShrink: 0 }}>{relTime(r.created_at)}</span>
                  </div>
                  <p style={{ margin: '0 0 2px', fontSize: 11, color: '#555577' }}>{r.email}</p>
                  {(r.company || r.phone) && (
                    <p style={{ margin: 0, fontSize: 10, color: '#3a3a5a' }}>
                      {[r.company, r.phone].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                  <select
                    value={roles[r.id] ?? 'staff'}
                    onChange={e => setRoles(prev => ({ ...prev, [r.id]: e.target.value }))}
                    style={{ background: '#0d0d14', border: '1px solid #2a2a3e', borderRadius: 5, color: '#c8c8e8', fontSize: 10, padding: '4px 6px', outline: 'none', cursor: 'pointer' }}
                  >
                    {ROLES.map(ro => (
                      <option key={ro} value={ro}>{ro.charAt(0).toUpperCase() + ro.slice(1)}</option>
                    ))}
                  </select>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button
                      disabled={acting === r.id}
                      onClick={() => act(r.id, 'approve')}
                      style={{ padding: '5px 11px', borderRadius: 5, border: 'none', background: acting === r.id ? '#1a3a2a' : '#10b981', color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer', letterSpacing: '.05em', opacity: acting && acting !== r.id ? 0.5 : 1 }}
                    >
                      {acting === r.id ? '…' : 'Approve'}
                    </button>
                    <button
                      disabled={!!acting}
                      onClick={() => act(r.id, 'reject')}
                      style={{ padding: '5px 11px', borderRadius: 5, border: '1px solid #3a1a1a', background: 'transparent', color: '#ef4444', fontSize: 10, fontWeight: 700, cursor: 'pointer', opacity: acting ? 0.5 : 1 }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
