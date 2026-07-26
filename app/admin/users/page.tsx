'use client';

import { useAuth } from '../../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import UserManagement from '../../../components/UserManagement';
import TopBar from '../../../components/TopBar';
import { useNav } from '../../../components/AppShell';

function AdminUsersInner() {
  const { can, loading } = useAuth();
  const router           = useRouter();
  const { openNav }      = useNav();

  useEffect(() => {
    if (!loading && !can('admin.users')) router.replace('/');
  }, [loading, can, router]);

  if (loading || !can('admin.users')) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <TopBar onMenuClick={openNav} />
      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-[#e0e0e0] tracking-tight">User Management</h1>
          <p className="text-sm text-[#555] mt-1">Manage roles, platform access, and account status</p>
        </div>
        <UserManagement />
      </main>
    </div>
  );
}

export default function AdminUsersPage() {
  return <AdminUsersInner />;
}
