'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import TopBar from '@/components/TopBar';
import { useNav } from '@/components/AppShell';
import GreetingBar from '@/components/dashboard/GreetingBar';
import KPIStrip from '@/components/dashboard/KPIStrip';

function DashboardInner() {
  const { user, loading } = useAuth();
  const router            = useRouter();
  const { openNav }       = useNav();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0d' }}>
      <TopBar onMenuClick={openNav} />
      <main
        style={{
          maxWidth: 1400,
          margin: '0 auto',
          padding: '32px 24px 80px',
        }}
      >
        <GreetingBar />
        <KPIStrip />

        {/* Phase 2–4 panels will be added here */}
        <div
          style={{
            marginTop: 8,
            padding: '48px 24px',
            border: '1px dashed #22222e',
            borderRadius: 12,
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 12, color: '#44445a', margin: 0 }}>
            Portfolio charts · Activity feed · AXIOM status · Top listings — coming in Phase 2
          </p>
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return <DashboardInner />;
}
