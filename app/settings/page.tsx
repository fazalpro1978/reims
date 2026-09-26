'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { useNav } from '@/components/AppShell';
import { useAuth } from '@/contexts/AuthContext';
import { UserPrefs, getPrefs, savePrefs } from '@/lib/userPrefs';
import { ALL_MODULES } from '@/components/dashboard/QuickAccess';

// ── Widget definitions ────────────────────────────────────────────────────────

interface WidgetDef {
  id:        string;
  label:     string;
  desc:      string;
  color:     string;
  adminOnly: boolean;
}

const ALL_WIDGETS: WidgetDef[] = [
  { id: 'kpi-strip',           label: 'KPI Strip',           desc: 'Total units, available, reserved, maintenance counts at a glance',       color: '#c9a84c', adminOnly: false },
  { id: 'status-donut',        label: 'Portfolio Status',    desc: 'Donut chart of portfolio status breakdown + unit type bars',             color: '#22d3ee', adminOnly: false },
  { id: 'zone-breakdown',      label: 'Zone Breakdown',      desc: 'Top zones by available unit count with progress bars',                    color: '#a78bfa', adminOnly: false },
  { id: 'top-listings',        label: 'Top Listings',        desc: 'Highest-value available units for quick client sharing',                  color: '#f97316', adminOnly: false },
  { id: 'circle-of-excellence',label: 'Circle of Excellence',desc: 'Agent performance leaderboard',                                          color: '#fbbf24', adminOnly: false },
  { id: 'synergy-stats',       label: 'Synergy Pipeline',   desc: 'CRM funnel overview — active inquiries, stage breakdown, conversion',    color: '#f43f5e', adminOnly: true  },
  { id: 'activity-feed',       label: 'Activity Feed',       desc: 'Recent system events and user actions',                                   color: '#38bdf8', adminOnly: true  },
  { id: 'axiom-status',        label: 'AXIOM Status',        desc: 'Latest ingestion batch results and pipeline health',                     color: '#fb923c', adminOnly: true  },
  { id: 'alerts-strip',        label: 'Alerts',              desc: 'Expiry warnings, Look UP units, and pending action items',               color: '#ef4444', adminOnly: true  },
  { id: 'revenue-panel',       label: 'Revenue Panel',       desc: 'Rental revenue estimates and financial trends',                          color: '#4ade80', adminOnly: true  },
  { id: 'team-roster',         label: 'Team Roster',         desc: 'Staff online status and recent activity',                                color: '#818cf8', adminOnly: true  },
];

// ── Landing page options ──────────────────────────────────────────────────────

const LANDING_OPTIONS = [
  { value: '/',              label: 'Dashboard',        sub: 'Default home screen' },
  { value: '/inventory',     label: 'Units Inventory',  sub: 'Available unit listing' },
  { value: '/synergy',       label: 'Synergy Center',   sub: 'CRM pipeline' },
  { value: '/ingest-queue',  label: 'AXIOM Queue',      sub: 'Ingestion pipeline (staff+)' },
  { value: '/properties',    label: 'Properties',       sub: 'Building register' },
];

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, color = '#c9a84c' }: { checked: boolean; onChange: (v: boolean) => void; color?: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        width: 40,
        height: 22,
        borderRadius: 11,
        border: 'none',
        background: checked ? color : '#2a2a3a',
        cursor: 'pointer',
        padding: 0,
        transition: 'background .2s',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: 3,
        left: checked ? 21 : 3,
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: '#ffffff',
        transition: 'left .2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
      }} />
    </button>
  );
}

// ── Section card ─────────────────────────────────────────────────────────────

function SectionCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#111118',
      border: '1px solid #1e1e2e',
      borderRadius: 14,
      padding: '20px 24px',
      marginBottom: 16,
    }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#e2e2ee', margin: 0, letterSpacing: '.01em' }}>{title}</h2>
        {sub && <p style={{ fontSize: 11, color: '#44445a', marginTop: 4 }}>{sub}</p>}
      </div>
      {children}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, loading, role } = useAuth();
  const router  = useRouter();
  const { openNav } = useNav();
  const isAgent = role === 'agent';

  const [prefs, setPrefs]   = useState<UserPrefs>(getPrefs);
  const [saved, setSaved]   = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) return null;

  function update(patch: Partial<UserPrefs>) {
    setPrefs(prev => ({ ...prev, ...patch }));
    setSaved(false);
  }

  function toggleWidget(id: string, visible: boolean) {
    update({
      hiddenWidgets: visible
        ? prefs.hiddenWidgets.filter(w => w !== id)
        : [...prefs.hiddenWidgets.filter(w => w !== id), id],
    });
  }

  function togglePin(id: string, pinned: boolean) {
    update({
      pinnedModules: pinned
        ? [...prefs.pinnedModules.filter(m => m !== id), id]
        : prefs.pinnedModules.filter(m => m !== id),
    });
  }

  function handleSave() {
    savePrefs(prefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  function handleReset() {
    const fresh: UserPrefs = { defaultLanding: '/', hiddenWidgets: [], pinnedModules: ['inventory', 'synergy'] };
    setPrefs(fresh);
    savePrefs(fresh);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  const visibleWidgets = ALL_WIDGETS.filter(w => !w.adminOnly || !isAgent);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0d' }}>
      <TopBar onMenuClick={openNav} />

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e2ee', margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>
              Settings
            </h1>
            <p style={{ fontSize: 12, color: '#44445a', marginTop: 6 }}>
              Personalise your Vanguard REOS workspace — stored locally on this device.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {saved && (
              <span style={{ fontSize: 11, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{width:13,height:13}}>
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Saved
              </span>
            )}
            <button
              onClick={handleReset}
              style={{
                background: 'transparent',
                border: '1px solid #22222e',
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: 11,
                fontWeight: 600,
                color: '#44445a',
                cursor: 'pointer',
                transition: 'border-color .15s, color .15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#e2e2ee'; (e.currentTarget as HTMLElement).style.borderColor = '#3a3a4e'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#44445a'; (e.currentTarget as HTMLElement).style.borderColor = '#22222e'; }}
            >
              Reset to defaults
            </button>
            <button
              onClick={handleSave}
              style={{
                background: '#c9a84c',
                border: 'none',
                borderRadius: 8,
                padding: '8px 18px',
                fontSize: 11,
                fontWeight: 700,
                color: '#0a0a0d',
                cursor: 'pointer',
                letterSpacing: '.04em',
                textTransform: 'uppercase',
                transition: 'background .15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#e0bc60'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#c9a84c'; }}
            >
              Save Changes
            </button>
          </div>
        </div>

        {/* ── 1. Quick Access / Pinned Modules ─────────────────────────── */}
        <SectionCard
          title="Quick Access Bar"
          sub="Choose which modules appear as shortcuts on your dashboard. Drag them to reorder."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {ALL_MODULES.map(mod => {
              const pinned = prefs.pinnedModules.includes(mod.id);
              return (
                <div
                  key={mod.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '24px 1fr auto',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 6px',
                    borderRadius: 8,
                    borderBottom: '1px solid #1a1a28',
                    transition: 'background .1s',
                    cursor: 'default',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#14141e'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <span style={{ color: pinned ? mod.color : '#2a2a3a', transition: 'color .2s' }}>{mod.icon}</span>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: pinned ? '#e2e2ee' : '#44445a', transition: 'color .2s' }}>
                      {mod.label}
                    </span>
                    <span style={{ fontSize: 10, color: '#2a2a3a', marginLeft: 8 }}>{mod.sub}</span>
                  </div>
                  <Toggle checked={pinned} onChange={v => togglePin(mod.id, v)} color={mod.color} />
                </div>
              );
            })}
          </div>
          {prefs.pinnedModules.length === 0 && (
            <p style={{ fontSize: 11, color: '#44445a', marginTop: 12 }}>
              No modules pinned — the quick access bar will be hidden on the dashboard.
            </p>
          )}
        </SectionCard>

        {/* ── 2. Dashboard Widget Visibility ───────────────────────────── */}
        <SectionCard
          title="Dashboard Widgets"
          sub="Show or hide panels on your dashboard. Hiding a widget doesn't delete its data."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {visibleWidgets.map(widget => {
              const visible = !prefs.hiddenWidgets.includes(widget.id);
              return (
                <div
                  key={widget.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '10px 1fr auto',
                    alignItems: 'center',
                    gap: 14,
                    padding: '11px 6px',
                    borderRadius: 8,
                    borderBottom: '1px solid #1a1a28',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#14141e'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: visible ? widget.color : '#1e1e2e',
                    transition: 'background .2s', flexShrink: 0,
                    alignSelf: 'center',
                    display: 'inline-block',
                  }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: visible ? '#e2e2ee' : '#44445a', transition: 'color .2s' }}>
                      {widget.label}
                      {widget.adminOnly && (
                        <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 700, letterSpacing: '.1em', color: '#44445a', background: '#1a1a28', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>
                          Staff+
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: '#2a2a3a', marginTop: 2 }}>{widget.desc}</div>
                  </div>
                  <Toggle checked={visible} onChange={v => toggleWidget(widget.id, v)} color={widget.color} />
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* ── 3. Default Landing Page ───────────────────────────────────── */}
        <SectionCard
          title="Default Landing Page"
          sub="The first page you see after logging in."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {LANDING_OPTIONS.map(opt => {
              const selected = prefs.defaultLanding === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => update({ defaultLanding: opt.value })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: selected ? '#c9a84c12' : 'transparent',
                    border: `1px solid ${selected ? '#c9a84c44' : '#1e1e2e'}`,
                    borderRadius: 10,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'border-color .15s, background .15s',
                  }}
                  onMouseEnter={e => { if (!selected) { (e.currentTarget as HTMLElement).style.borderColor = '#2a2a3e'; (e.currentTarget as HTMLElement).style.background = '#14141e'; } }}
                  onMouseLeave={e => { if (!selected) { (e.currentTarget as HTMLElement).style.borderColor = '#1e1e2e'; (e.currentTarget as HTMLElement).style.background = 'transparent'; } }}
                >
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%',
                    border: `2px solid ${selected ? '#c9a84c' : '#2a2a3a'}`,
                    background: selected ? '#c9a84c' : 'transparent',
                    flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'border-color .15s, background .15s',
                  }}>
                    {selected && (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0a0a0d' }} />
                    )}
                  </span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: selected ? '#c9a84c' : '#9898b8' }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 10, color: '#2a2a3a', marginTop: 1 }}>{opt.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </SectionCard>

        {/* ── Footer note ──────────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '14px 18px',
          background: '#0e0e14',
          border: '1px solid #1a1a28',
          borderRadius: 10,
          marginTop: 8,
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14,color:'#44445a',flexShrink:0}}>
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
          </svg>
          <p style={{ fontSize: 10, color: '#44445a', margin: 0, lineHeight: 1.5 }}>
            Settings are saved locally on this device. Clearing browser data will reset them.
            Role-restricted modules (e.g. AXIOM Queue) remain gated by your account role regardless of pins.
          </p>
        </div>

      </main>
    </div>
  );
}
