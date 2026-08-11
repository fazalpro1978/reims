'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { ThemePanel } from './ThemeSwitcher';
import { useAuth } from '../contexts/AuthContext';
import { authedFetch } from '../lib/authedFetch';
import Avatar from './Avatar';

const RegistrationApprovalPanel = dynamic(() => import('./RegistrationApprovalPanel'), { ssr: false });
const ProfileModal               = dynamic(() => import('./ProfileModal'),               { ssr: false });

const ROLE_LABEL: Record<string, string> = {
  superuser:     'Superuser',
  administrator: 'Administrator',
  staff:         'Staff',
  agent:         'Agent',
  public:        'Public',
};

const ROLE_COLOR: Record<string, string> = {
  superuser:     '#c9a84c',
  administrator: '#3b82f6',
  staff:         '#10b981',
  agent:         '#8b5cf6',
  public:        '#64748b',
};

const INTERNAL_ROLES = new Set(['superuser', 'administrator', 'staff']);

const NOTIF_LS_KEY = 'reims_notif_last_seen';

type BellItemType = 'pipeline_done' | 'pipeline_failed' | 'pipeline_killed' | 'expiry_critical' | 'expiry_soon' | 'card_assigned' | 'registration_pending' | 'broadcast';
interface BellItem { id: string; type: BellItemType; title: string; body: string; created_at: string; }

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const TYPE_META: Record<BellItemType, { icon: string; color: string }> = {
  pipeline_done:        { icon: '✓', color: '#10b981' },
  pipeline_failed:      { icon: '✕', color: '#ef4444' },
  pipeline_killed:      { icon: '—', color: '#6b7280' },
  expiry_critical:      { icon: '!', color: '#ef4444' },
  expiry_soon:          { icon: '!', color: '#f59e0b' },
  card_assigned:        { icon: '→', color: '#c9a84c' },
  registration_pending: { icon: '★', color: '#f59e0b' },
  broadcast:            { icon: '▶', color: '#6366f1' },
};

export default function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, signOut } = useAuth();

  const [settingsOpen,     setSettingsOpen    ] = useState(false);
  const [userMenuOpen,     setUserMenuOpen    ] = useState(false);
  const [notifOpen,        setNotifOpen       ] = useState(false);
  const [notifItems,       setNotifItems      ] = useState<BellItem[]>([]);
  const [notifLoading,     setNotifLoading    ] = useState(false);
  const [approvalPanelOpen, setApprovalPanelOpen] = useState(false);
  const [profileModalOpen,  setProfileModalOpen ] = useState(false);
  const [avatarSignedUrl,   setAvatarSignedUrl  ] = useState<string | null>(null);
  const [avatarPreset,      setAvatarPreset     ] = useState<string | null>(null);

  // Broadcast compose state (admin only)
  const [composeOpen,   setComposeOpen  ] = useState(false);
  const [bcTitle,       setBcTitle      ] = useState('');
  const [bcBody,        setBcBody       ] = useState('');
  const [bcGroups,      setBcGroups     ] = useState<string[]>([]);
  const [bcSending,     setBcSending    ] = useState(false);
  const [bcSent,        setBcSent       ] = useState(false);
  const [bcError,       setBcError      ] = useState<string | null>(null);

  const isAdmin    = user?.role === 'superuser' || user?.role === 'administrator';
  const [lastSeen,     setLastSeen]     = useState<Date>(() => {
    try { const s = localStorage.getItem(NOTIF_LS_KEY); return s ? new Date(s) : new Date(0); } catch { return new Date(0); }
  });

  const settingsBtnRef   = useRef<HTMLButtonElement>(null);
  const settingsPanelRef = useRef<HTMLDivElement>(null);
  const userBtnRef       = useRef<HTMLButtonElement>(null);
  const userMenuRef      = useRef<HTMLDivElement>(null);
  const notifBtnRef      = useRef<HTMLButtonElement>(null);
  const notifPanelRef    = useRef<HTMLDivElement>(null);

  const isInternal = INTERNAL_ROLES.has(user?.role ?? '');

  const fetchNotifs = useCallback(async () => {
    if (!user) return;
    setNotifLoading(true);
    try {
      const res = await authedFetch('/api/notifications/bell');
      if (res.ok) {
        const { items } = await res.json();
        setNotifItems(items ?? []);
      }
    } catch {}
    setNotifLoading(false);
  }, [isInternal]);

  // Fetch on mount for badge count
  useEffect(() => { if (user) fetchNotifs(); }, [fetchNotifs, user]);

  // Fetch avatar signed URL when user changes
  useEffect(() => {
    if (!user) { setAvatarSignedUrl(null); setAvatarPreset(null); return; }
    authedFetch('/api/profile')
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (j?.profile) {
          setAvatarSignedUrl(j.profile.avatarSignedUrl ?? null);
          setAvatarPreset(j.profile.avatar_preset ?? null);
        }
      })
      .catch(() => {});
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close all dropdowns on outside click / Escape
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!settingsOpen && !userMenuOpen && !notifOpen) return;
      if (settingsBtnRef.current?.contains(e.target as Node) || settingsPanelRef.current?.contains(e.target as Node)) return;
      if (userBtnRef.current?.contains(e.target as Node)     || userMenuRef.current?.contains(e.target as Node))     return;
      if (notifBtnRef.current?.contains(e.target as Node)    || notifPanelRef.current?.contains(e.target as Node))   return;
      setSettingsOpen(false);
      setUserMenuOpen(false);
      setNotifOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSettingsOpen(false); setUserMenuOpen(false); setNotifOpen(false); }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [settingsOpen, userMenuOpen, notifOpen]);

  const sendBroadcast = async () => {
    if (!bcTitle.trim() || !bcBody.trim() || bcGroups.length === 0) return;
    setBcSending(true);
    setBcError(null);
    try {
      const res = await authedFetch('/api/v1/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: bcTitle.trim(), body: bcBody.trim(), target_groups: bcGroups }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setBcError((j as { error?: string }).error ?? 'Send failed');
        return;
      }
      setBcSent(true);
      setBcTitle(''); setBcBody(''); setBcGroups([]);
      setTimeout(() => { setBcSent(false); setComposeOpen(false); }, 2000);
    } catch {
      setBcError('Network error — try again');
    } finally {
      setBcSending(false);
    }
  };

  const toggleGroup = (g: string) =>
    setBcGroups(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);

  const openNotif = () => {
    setNotifOpen(v => {
      if (!v) {
        fetchNotifs();
        const now = new Date();
        setLastSeen(now);
        try { localStorage.setItem(NOTIF_LS_KEY, now.toISOString()); } catch {}
      } else {
        // Reset compose when closing
        setComposeOpen(false);
        setBcTitle(''); setBcBody(''); setBcGroups([]); setBcError(null); setBcSent(false);
      }
      return !v;
    });
    setSettingsOpen(false);
    setUserMenuOpen(false);
  };

  const unreadCount = notifItems.filter(i => new Date(i.created_at) > lastSeen).length;

  const initials = user?.fullName
    ? user.fullName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?';

  const roleColor = ROLE_COLOR[user?.role ?? ''] ?? '#888';

  return (
    <>
    <header className="bg-[#0d0d0d] sticky top-0 z-30 border-b border-[#1e1e1e]">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Hamburger — desktop */}
          <button
            onClick={onMenuClick}
            aria-label="Open navigation menu"
            className="hidden lg:flex w-8 h-8 rounded-lg bg-[#1a1a1a] hover:bg-[#242424] border border-[#2a2a2a] items-center justify-center text-[#666666] hover:text-[#c9a84c] transition-colors shrink-0"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-4 h-4">
              <path d="M3 6h18M3 12h16M3 18h12" />
            </svg>
          </button>

          {/* Brand logo */}
          <img
            src="/brand/logo-dark.png"
            alt="Privé Group Real Estate"
            style={{ height: '36px', width: 'auto', flexShrink: 0 }}
          />
          <p className="text-[#888888] text-[11px] leading-tight hidden sm:block tracking-wide select-none">
            Vanguard REOS
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Role badge */}
          {user && (
            <span
              className="hidden md:inline-flex text-[10px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded"
              style={{ color: roleColor, background: `${roleColor}18`, border: `1px solid ${roleColor}30` }}
            >
              {ROLE_LABEL[user.role] ?? user.role}
            </span>
          )}

          <div className="hidden md:block w-px h-4 bg-[#222222] mx-1" />

          {/* Notifications bell — all authenticated users */}
          {user && (
            <div className="relative">
              <style>{`
                @keyframes bell-ring {
                  0%        { transform: rotate(0deg);   color: #555555; }
                  6%        { transform: rotate(20deg);  color: #f59e0b; }
                  12%       { transform: rotate(-18deg); color: #c9a84c; }
                  18%       { transform: rotate(15deg);  color: #f59e0b; }
                  24%       { transform: rotate(-12deg); color: #c9a84c; }
                  30%       { transform: rotate(8deg);   color: #f59e0b; }
                  36%       { transform: rotate(-5deg);  color: #c9a84c; }
                  42%       { transform: rotate(2deg);   color: #f59e0b; }
                  48%, 100% { transform: rotate(0deg);   color: #555555; }
                }
                .bell-ringing {
                  transform-origin: 50% 4%;
                  animation: bell-ring 2.8s ease-in-out infinite;
                }
              `}</style>
              <button
                ref={notifBtnRef}
                onClick={openNotif}
                aria-label="Notifications"
                title="Notifications"
                className={`hidden sm:flex relative w-8 h-8 rounded-lg border items-center justify-center transition-colors ${
                  notifOpen
                    ? 'bg-[#c9a84c] border-[#c9a84c] text-[#0f0f0f]'
                    : 'bg-[#1a1a1a] hover:bg-[#242424] border-[#222222] text-[#444444] hover:text-[#c9a84c]'
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={`w-4 h-4${unreadCount > 0 ? ' bell-ringing' : ''}`}>
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-[#ef4444] text-white leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div
                  ref={notifPanelRef}
                  className="absolute top-full right-0 mt-2 w-80 bg-[#141414] border border-[#2a2a2a] rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.7)] overflow-hidden"
                  style={{ zIndex: 200 }}
                >
                  {/* Panel header */}
                  <div className="px-4 py-3 border-b border-[#222] flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#e0e0e0]">
                      {composeOpen ? 'Broadcast Message' : 'Notifications'}
                    </p>
                    <div className="flex items-center gap-2">
                      {isAdmin && !composeOpen && (
                        <button
                          onClick={() => { setBcSent(false); setBcError(null); setComposeOpen(true); }}
                          className="flex items-center gap-1 text-[10px] font-semibold text-[#6366f1] hover:text-[#818cf8] transition-colors"
                          title="Compose broadcast"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                          </svg>
                          Broadcast
                        </button>
                      )}
                      {composeOpen && (
                        <button onClick={() => setComposeOpen(false)} className="text-[10px] text-[#555] hover:text-[#999] transition-colors">
                          ← Back
                        </button>
                      )}
                      {!composeOpen && <span className="text-[10px] text-[#555]">{isInternal ? 'Last 48 h' : 'Last 7 d'}</span>}
                    </div>
                  </div>

                  {/* Compose panel (admin) */}
                  {composeOpen ? (
                    <div className="p-4 space-y-3">
                      {bcSent ? (
                        <div className="py-8 flex flex-col items-center gap-2 text-center">
                          <span className="text-2xl">✓</span>
                          <p className="text-sm font-semibold text-[#10b981]">Broadcast sent</p>
                          <p className="text-[11px] text-[#555]">Recipients will see it in their bell.</p>
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className="block text-[10px] font-semibold text-[#555] uppercase tracking-wider mb-1">Title</label>
                            <input
                              value={bcTitle}
                              onChange={e => setBcTitle(e.target.value)}
                              maxLength={160}
                              placeholder="Announcement subject…"
                              className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-[#e0e0e0] placeholder-[#444] focus:outline-none focus:border-[#6366f1] transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-[#555] uppercase tracking-wider mb-1">Message</label>
                            <textarea
                              value={bcBody}
                              onChange={e => setBcBody(e.target.value)}
                              maxLength={2000}
                              rows={4}
                              placeholder="Write your message…"
                              className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-[#e0e0e0] placeholder-[#444] focus:outline-none focus:border-[#6366f1] resize-none transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-[#555] uppercase tracking-wider mb-2">Send to</label>
                            <div className="flex flex-wrap gap-2">
                              {(['staff', 'agent', 'broker', 'third_party'] as const).map(g => (
                                <button
                                  key={g}
                                  onClick={() => toggleGroup(g)}
                                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                                    bcGroups.includes(g)
                                      ? 'bg-[#6366f133] border-[#6366f1] text-[#818cf8]'
                                      : 'bg-transparent border-[#2a2a2a] text-[#555] hover:border-[#444]'
                                  }`}
                                >
                                  {g === 'third_party' ? 'Third Party' : g.charAt(0).toUpperCase() + g.slice(1)}
                                </button>
                              ))}
                            </div>
                          </div>
                          {bcError && <p className="text-[10px] text-[#ef4444]">{bcError}</p>}
                          <button
                            onClick={sendBroadcast}
                            disabled={bcSending || !bcTitle.trim() || !bcBody.trim() || bcGroups.length === 0}
                            className="w-full py-2 rounded-lg text-xs font-bold bg-[#6366f1] text-white hover:bg-[#4f46e5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            {bcSending ? 'Sending…' : 'Send Broadcast'}
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {notifLoading ? (
                      <div className="px-4 py-6 text-center text-[#555] text-xs">Loading…</div>
                    ) : notifItems.length === 0 ? (
                      <div className="px-4 py-6 text-center">
                        <p className="text-[#444] text-xs">No recent activity</p>
                      </div>
                    ) : (
                      notifItems.map(item => {
                        const meta  = TYPE_META[item.type];
                        const isNew = new Date(item.created_at) > lastSeen;
                        const clickable = item.type === 'registration_pending';
                        return (
                          <div
                            key={item.id}
                            onClick={clickable ? () => { setNotifOpen(false); setApprovalPanelOpen(true); } : undefined}
                            className={`px-4 py-3 border-b border-[#1e1e1e] last:border-0 ${isNew ? 'bg-[#ffffff06]' : ''}${clickable ? ' cursor-pointer hover:bg-[#ffffff08]' : ''}`}
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                                style={{ background: `${meta.color}20`, color: meta.color }}
                              >
                                {meta.icon}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-semibold text-[#d0d0d0] truncate">{item.title}</p>
                                  {isNew && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#ef4444]" />}
                                </div>
                                {item.body && (
                                  <p className="text-[11px] text-[#555] truncate mt-0.5">{item.body}</p>
                                )}
                                <p className="text-[10px] text-[#3a3a3a] mt-1">{timeAgo(item.created_at)}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Settings gear */}
          <div className="relative">
            <button
              ref={settingsBtnRef}
              onClick={() => { setSettingsOpen(v => !v); setUserMenuOpen(false); setNotifOpen(false); }}
              aria-label="Settings"
              title="Settings & Theme"
              className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                settingsOpen
                  ? 'bg-[#c9a84c] border-[#c9a84c] text-[#0f0f0f]'
                  : 'bg-[#1a1a1a] hover:bg-[#242424] border-[#222222] text-[#444444] hover:text-[#c9a84c]'
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </button>

            {settingsOpen && (
              <div ref={settingsPanelRef} className="absolute top-full right-0 mt-2" style={{ zIndex: 200 }}>
                <ThemePanel onClose={() => setSettingsOpen(false)} />
              </div>
            )}
          </div>

          {/* Avatar + user menu */}
          <div className="relative">
            <button
              ref={userBtnRef}
              onClick={() => { setUserMenuOpen(v => !v); setSettingsOpen(false); setNotifOpen(false); }}
              className="transition-opacity hover:opacity-80"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              title={user?.fullName ?? 'User'}
            >
              <Avatar
                size={28}
                photoUrl={avatarSignedUrl}
                preset={avatarSignedUrl ? null : avatarPreset}
                initials={initials}
                ringColor={roleColor}
              />
            </button>

            {userMenuOpen && (
              <div
                ref={userMenuRef}
                className="absolute top-full right-0 mt-2 w-56 bg-[#141414] border border-[#2a2a2a] rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.7)] overflow-hidden"
                style={{ zIndex: 200 }}
              >
                {/* User info header */}
                <div className="px-4 py-3 border-b border-[#222]">
                  <p className="text-sm font-semibold text-[#e0e0e0] truncate">{user?.fullName ?? '—'}</p>
                  <p className="text-[11px] text-[#666] truncate mt-0.5">{user?.email ?? ''}</p>
                  <span
                    className="inline-flex mt-1.5 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ color: roleColor, background: `${roleColor}18` }}
                  >
                    {ROLE_LABEL[user?.role ?? ''] ?? ''}
                  </span>
                </div>

                {/* My Profile */}
                <button
                  onClick={() => { setUserMenuOpen(false); setProfileModalOpen(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#aaa] hover:text-[#c9a84c] hover:bg-[#c9a84c08] transition-colors text-left"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
                  </svg>
                  My Profile
                </button>

                <div className="border-t border-[#1e1e1e]" />

                {/* Sign out */}
                <button
                  onClick={() => { setUserMenuOpen(false); signOut(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#aaa] hover:text-[#ef4444] hover:bg-[#ef444408] transition-colors text-left"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>

    {approvalPanelOpen && (
      <RegistrationApprovalPanel
        onClose={() => setApprovalPanelOpen(false)}
        onResolved={() => { setApprovalPanelOpen(false); fetchNotifs(); }}
      />
    )}

    {profileModalOpen && (
      <ProfileModal
        onClose={() => setProfileModalOpen(false)}
        onAvatarChange={(signedUrl, preset) => {
          setAvatarSignedUrl(signedUrl);
          setAvatarPreset(preset);
        }}
      />
    )}
  </>
  );
}
