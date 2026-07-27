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
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import AxiomStatus from '@/components/dashboard/AxiomStatus';
import AlertsStrip from '@/components/dashboard/AlertsStrip';
import RevenuePanel from '@/components/dashboard/RevenuePanel';
import TeamRoster from '@/components/dashboard/TeamRoster';
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

          {/* Phase 3 — Activity + AXIOM */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              marginTop: 4,
            }}
          >
            <ActivityFeed />
            <AxiomStatus />
          </div>

          {/* Phase 4 — Alerts + Revenue + Team */}
          <div style={{ marginTop: 4 }}>
            <AlertsStrip />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <RevenuePanel />
              <TeamRoster />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

export default function DashboardPage() {
  return <DashboardInner />;
}
