'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import TopBar from '@/components/TopBar';
import { useNav } from '@/components/AppShell';
import GreetingBar from '@/components/dashboard/GreetingBar';
import KPIStrip from '@/components/dashboard/KPIStrip';
import StatusDonut from '@/components/dashboard/StatusDonut';
import ZoneBreakdown from '@/components/dashboard/ZoneBreakdown';
import TopListings from '@/components/dashboard/TopListings';
import SplashScreen from '@/components/dashboard/SplashScreen';

const SPLASH_KEY = 'vanguard_splash_done';

function DashboardInner() {
  const { user, loading } = useAuth();
  const router            = useRouter();
  const { openNav }       = useNav();

  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem(SPLASH_KEY)) {
      setShowSplash(true);
    }
  }, []);

  const handleSplashDone = useCallback(() => {
    sessionStorage.setItem(SPLASH_KEY, '1');
    setShowSplash(false);
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <>
      {showSplash && <SplashScreen onDone={handleSplashDone} />}

      <div style={{ minHeight: '100vh', background: '#0a0a0d' }}>
        <TopBar onMenuClick={openNav} />
        <main style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 24px 80px' }}>
          <GreetingBar />
          <KPIStrip />

          {/* Phase 2 — Portfolio panels */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '280px 1fr 1fr',
              gap: 12,
              marginBottom: 12,
            }}
          >
            <StatusDonut />
            <ZoneBreakdown />
            <TopListings />
          </div>

          {/* Phase 3–4 placeholder */}
          <div
            style={{
              marginTop: 4,
              padding: '36px 24px',
              border: '1px dashed #22222e',
              borderRadius: 12,
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: 12, color: '#44445a', margin: 0 }}>
              Activity feed · AXIOM pipeline status · Occupancy trend — coming in Phase 3
            </p>
          </div>
        </main>
      </div>
    </>
  );
}

export default function DashboardPage() {
  return <DashboardInner />;
}
