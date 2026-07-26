'use client';

import { useAuth } from '../../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import UserManagement from '../../../components/UserManagement';
import RoleMatrix from '../../../components/RoleMatrix';
import TopBar from '../../../components/TopBar';
import { useNav } from '../../../components/AppShell';

type Tab = 'users' | 'matrix';

function AdminUsersInner() {
  const { can, loading } = useAuth();
  const router           = useRouter();
  const { openNav }      = useNav();
  const [tab, setTab]    = useState<Tab>('users');

  useEffect(() => {
    if (!loading && !can('admin.users')) router.replace('/');
  }, [loading, can, router]);

  if (loading || !can('admin.users')) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <TopBar onMenuClick={openNav} />
      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-[#e0e0e0] tracking-tight">User Management</h1>
          <p className="text-sm text-[#555] mt-1">Manage roles, platform access, and account status</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 rounded-xl bg-[#0d0d0d] border border-[#1e1e1e] mb-6 w-fit">
          {([
            { id: 'users',  label: 'User Accounts' },
            { id: 'matrix', label: 'Role Matrix' },
          ] as { id: Tab; label: string }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-5 py-2 rounded-lg text-xs font-bold tracking-wide transition-all"
              style={{
                background: tab === t.id ? '#c9a84c18' : 'transparent',
                border:     `1px solid ${tab === t.id ? '#c9a84c40' : 'transparent'}`,
                color:      tab === t.id ? '#c9a84c' : '#555',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'users'  && <UserManagement />}
        {tab === 'matrix' && <RoleMatrix />}

      </main>
    </div>
  );
}

export default function AdminUsersPage() {
  return <AdminUsersInner />;
}
