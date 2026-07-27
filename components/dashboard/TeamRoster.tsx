'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authedFetch } from '../../lib/authedFetch';
import { useAuth } from '../../contexts/AuthContext';

interface Member {
  id:         string;
  email:      string;
  full_name:  string | null;
  role:       string;
  is_active:  boolean;
  updated_at: string;
}

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  superuser:     { label: 'Superuser',     color: '#c9a84c' },
  administrator: { label: 'Administrator', color: '#a47cf5' },
  staff:         { label: 'Staff',         color: '#5b9cf6' },
  agent:         { label: 'Agent',         color: '#2dd496' },
  public:        { label: 'Public',        color: '#44445a' },
};

function initials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7)  return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

export default function TeamRoster() {
  const { user, role } = useAuth();
  const router         = useRouter();
  const [members,  setMembers ] = useState<Member[]>([]);
  const [loading,  setLoading ] = useState(true);

  const isAdmin = role === 'superuser' || role === 'administrator';

  useEffect(() => {
    if (!user || !isAdmin) { setLoading(false); return; }
    authedFetch('/api/dashboard/team')
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.members) setMembers(j.members); })
      .finally(() => setLoading(false));
  }, [user, isAdmin]);

  if (!isAdmin) return null;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={headingStyle}>Team</h3>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.08em', color: '#c9a84c', background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.25)', padding: '2px 6px', borderRadius: 4 }}>
            ADMIN
          </span>
        </div>
        <button
          onClick={() => router.push('/admin/users')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#5b9cf6', padding: 0 }}
        >
          Manage →
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 44, borderRadius: 8, background: '#1a1a24' }} />)}
        </div>
      ) : members.length === 0 ? (
        <p style={{ fontSize: 12, color: '#44445a', margin: 0 }}>No team members found.</p>
      ) : (
        <div
          style={{
            display: 'flex', flexDirection: 'column', gap: 0,
            maxHeight: 340, overflowY: 'auto',
            scrollbarWidth: 'thin', scrollbarColor: '#22222e transparent',
          }}
        >
          {members.map((m, i) => {
            const badge = ROLE_BADGE[m.role] ?? { label: m.role, color: '#44445a' };
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 4px',
                  borderBottom: i < members.length - 1 ? '1px solid #1a1a24' : 'none',
                  opacity: m.is_active ? 1 : 0.45,
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: `${badge.color}18`,
                  border: `1px solid ${badge.color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: badge.color,
                }}>
                  {initials(m.full_name, m.email)}
                </div>

                {/* Name + email */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#c8c8e8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.full_name ?? m.email.split('@')[0]}
                  </p>
                  <p style={{ margin: '1px 0 0', fontSize: 9.5, color: '#44445a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.email}
                  </p>
                </div>

                {/* Role + last seen */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase',
                    color: badge.color, background: `${badge.color}18`,
                    padding: '2px 5px', borderRadius: 4, display: 'block',
                  }}>
                    {badge.label}
                  </span>
                  <span style={{ fontSize: 9, color: '#44445a', marginTop: 2, display: 'block' }}>
                    {!m.is_active ? 'Inactive' : relTime(m.updated_at)}
                  </span>
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
