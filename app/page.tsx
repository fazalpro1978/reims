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
import SynergyStats from '@/components/dashboard/SynergyStats';
import AlertsStrip from '@/components/dashboard/AlertsStrip';
import RevenuePanel from '@/components/dashboard/RevenuePanel';
import TeamRoster from '@/components/dashboard/TeamRoster';
import SplashScreen from '@/components/dashboard/SplashScreen';
import CircleOfExcellence from '@/components/dashboard/CircleOfExcellence';
import QuickAccess from '@/components/dashboard/QuickAccess';
import { useUserPrefs } from '@/hooks/useUserPrefs';

const SPLASH_KEY = 'vanguard_splash_done_v2';

function DashboardInner() {
  const { user, loading, role } = useAuth();
  const isAgent           = role === 'agent';
  const router            = useRouter();
  const { openNav }       = useNav();
  const { prefs }         = useUserPrefs();
  const hidden            = (id: string) => prefs.hiddenWidgets.includes(id);

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

          {/* Quick access bar — pinned module shortcuts */}
          <QuickAccess />

          {!hidden('kpi-strip') && <KPIStrip />}

          {/* Phase 2 — Portfolio panels (visible to all roles) */}
          {(!hidden('status-donut') || !hidden('zone-breakdown') || !hidden('top-listings')) && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '360px 1fr 1fr',
                gap: 12,
                marginBottom: 12,
              }}
            >
              {!hidden('status-donut')   && <StatusDonut />}
              {!hidden('zone-breakdown') && <ZoneBreakdown />}
              {!hidden('top-listings')   && <TopListings />}
            </div>
          )}

          {/* Circle of Excellence — visible to all authenticated users */}
          {!hidden('circle-of-excellence') && (
            <div style={{ marginTop: 4, marginBottom: 4 }}>
              <CircleOfExcellence />
            </div>
          )}

          {/* Phase 3 — Synergy Pipeline (staff/admin only) */}
          {!isAgent && !hidden('synergy-stats') && <SynergyStats />}

          {/* Phase 3 — Activity + AXIOM (staff/admin only) */}
          {!isAgent && (!hidden('activity-feed') || !hidden('axiom-status')) && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                marginTop: 4,
              }}
            >
              {!hidden('activity-feed') && <ActivityFeed />}
              {!hidden('axiom-status')  && <AxiomStatus />}
            </div>
          )}

          {/* Phase 4 — Alerts + Revenue + Team (staff/admin only) */}
          {!isAgent && (!hidden('alerts-strip') || !hidden('revenue-panel') || !hidden('team-roster')) && (
            <div style={{ marginTop: 4 }}>
              {!hidden('alerts-strip') && <AlertsStrip />}
              {(!hidden('revenue-panel') || !hidden('team-roster')) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {!hidden('revenue-panel') && <RevenuePanel />}
                  {!hidden('team-roster')   && <TeamRoster />}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}

export default function DashboardPage() {
  return <DashboardInner />;
}
