'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../contexts/AuthContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const ROLES = ['superuser','administrator','staff','agent','public'] as const;
type Role = typeof ROLES[number];

const ROLE_LABEL: Record<Role, string> = {
  superuser: 'Superuser', administrator: 'Administrator', staff: 'Staff',
  agent: 'Agent', public: 'Public',
};

const ROLE_COLOR: Record<Role, string> = {
  superuser: '#c9a84c', administrator: '#3b82f6', staff: '#10b981',
  agent: '#8b5cf6', public: '#64748b',
};

interface UserRow {
  id:          string;
  email:       string;
  full_name:   string | null;
  role:        Role;
  department:  string | null;
  platforms:   string[] | null;
  is_active:   boolean;
  created_at:  string;
}

export default function UserManagement() {
  const { user: me } = useAuth();
  const [users,   setUsers  ] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving ] = useState<string | null>(null);
  const [error,   setError  ] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { setLoading(false); return; }

    const res = await fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (res.ok) setUsers(json.users ?? []);
    else setError(json.error ?? 'Failed to load users');
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function patch(id: string, updates: Partial<{ role: Role; is_active: boolean; platforms: string[] }>) {
    setSaving(id); setError('');
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const res = await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, ...updates }),
    });
    const json = await res.json();
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...json.user } : u));
    } else {
      setError(json.error ?? 'Update failed');
    }
    setSaving(null);
  }

  const canAssignSuperuser = me?.role === 'superuser';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-[#c9a84c]/30 border-t-[#c9a84c] animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-950/30 border border-red-900/30 text-red-400 text-xs">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-[#1e1e1e]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#111] border-b border-[#1e1e1e] text-[10px] font-bold uppercase tracking-[0.12em] text-[#555]">
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3 w-[160px]">Role</th>
              <th className="text-left px-4 py-3">Platforms</th>
              <th className="text-center px-4 py-3 w-[90px]">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => {
              const isSelf       = u.id === me?.id;
              const isSaving     = saving === u.id;
              const roleColor    = ROLE_COLOR[u.role] ?? '#888';

              return (
                <tr
                  key={u.id}
                  className={`border-b border-[#151515] transition-colors ${i % 2 === 0 ? 'bg-[#0d0d0d]' : 'bg-[#0a0a0a]'} ${!u.is_active ? 'opacity-45' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                        style={{ background: `${roleColor}18`, border: `1px solid ${roleColor}30`, color: roleColor }}
                      >
                        {(u.full_name ?? u.email).split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase()}
                      </div>
                      <span className="text-[#d0d0d0] font-medium truncate">
                        {u.full_name ?? '—'}
                        {isSelf && <span className="ml-1.5 text-[9px] text-[#555] font-normal">(you)</span>}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-[#888] text-xs font-mono">{u.email}</td>

                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      disabled={isSelf || isSaving}
                      onChange={e => patch(u.id, { role: e.target.value as Role })}
                      className="bg-[#111] border border-[#2a2a2a] rounded-lg px-2 py-1.5 text-xs w-full focus:outline-none focus:border-[#c9a84c] disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ color: roleColor }}
                    >
                      {ROLES.filter(r => r !== 'superuser' || canAssignSuperuser).map(r => (
                        <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                      ))}
                    </select>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 flex-wrap">
                      {([['reims','REIMS'],['dinges','AXIOM']] as [string,string][]).map(([p, label]) => {
                        const active = (u.platforms ?? []).includes(p);
                        const isLocked = isSelf || isSaving;
                        return (
                          <button
                            key={p}
                            disabled={isLocked}
                            onClick={() => {
                              const cur  = u.platforms ?? [];
                              const next = active ? cur.filter(x => x !== p) : [...cur, p];
                              patch(u.id, { platforms: next });
                            }}
                            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{
                              background: active ? `${p === 'reims' ? '#c9a84c' : '#3b82f6'}18` : '#1a1a1a',
                              border:     `1px solid ${active ? (p === 'reims' ? '#c9a84c40' : '#3b82f640') : '#2a2a2a'}`,
                              color:      active ? (p === 'reims' ? '#c9a84c' : '#3b82f6') : '#555',
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-center">
                    <button
                      disabled={isSelf || isSaving}
                      onClick={() => patch(u.id, { is_active: !u.is_active })}
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                        u.is_active
                          ? 'bg-[#10b98118] text-[#10b981] border border-[#10b98130] hover:bg-[#ef444415] hover:text-[#ef4444] hover:border-[#ef444430]'
                          : 'bg-[#ef444415] text-[#ef4444] border border-[#ef444430] hover:bg-[#10b98118] hover:text-[#10b981] hover:border-[#10b98130]'
                      }`}
                    >
                      {isSaving ? '…' : u.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="text-center py-12 text-[#444] text-sm">
            No users found. Invite users via the Supabase Dashboard.
          </div>
        )}
      </div>

      <p className="text-[11px] text-[#444] mt-4">
        Only Superuser is authorised to invite new users.
      </p>
    </div>
  );
}
