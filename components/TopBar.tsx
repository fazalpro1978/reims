'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ThemePanel } from './ThemeSwitcher';
import { useAuth } from '../contexts/AuthContext';
import { authedFetch } from '../lib/authedFetch';

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

type BellItemType = 'pipeline_done' | 'pipeline_failed' | 'pipeline_killed' | 'expiry_critical' | 'expiry_soon' | 'card_assigned';
interface BellItem { id: string; type: BellItemType; title: string; body: string; created_at: string; }

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const TYPE_META: Record<BellItemType, { icon: string; color: string }> = {
  pipeline_done:    { icon: '✓', color: '#10b981' },
  pipeline_failed:  { icon: '✕', color: '#ef4444' },
  pipeline_killed:  { icon: '—', color: '#6b7280' },
  expiry_critical:  { icon: '!', color: '#ef4444' },
  expiry_soon:      { icon: '!', color: '#f59e0b' },
  card_assigned:    { icon: '→', color: '#c9a84c' },
};

export default function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, signOut } = useAuth();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen,    setNotifOpen]    = useState(false);
  const [notifItems,   setNotifItems]   = useState<BellItem[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
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
    if (!isInternal) return;
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
  useEffect(() => { if (isInternal) fetchNotifs(); }, [fetchNotifs, isInternal]);

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

  const openNotif = () => {
    setNotifOpen(v => {
      if (!v) {
        fetchNotifs();
        const now = new Date();
        setLastSeen(now);
        try { localStorage.setItem(NOTIF_LS_KEY, now.toISOString()); } catch {}
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

          {/* Notifications bell — internal roles only */}
          {isInternal && (
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
                  <div className="px-4 py-3 border-b border-[#222] flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#e0e0e0]">Notifications</p>
                    <span className="text-[10px] text-[#555]">Last 48 h</span>
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {notifLoading ? (
                      <div className="px-4 py-6 text-center text-[#555] text-xs">Loading…</div>
                    ) : notifItems.length === 0 ? (
                      <div className="px-4 py-6 text-center">
                        <p className="text-[#444] text-xs">No recent activity</p>
                      </div>
                    ) : (
                      notifItems.map(item => {
                        const meta = TYPE_META[item.type];
                        const isNew = new Date(item.created_at) > lastSeen;
                        return (
                          <div
                            key={item.id}
                            className={`px-4 py-3 border-b border-[#1e1e1e] last:border-0 ${isNew ? 'bg-[#ffffff06]' : ''}`}
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
              className="w-7 h-7 rounded-full border flex items-center justify-center transition-colors hover:opacity-80"
              style={{
                background: `${roleColor}18`,
                borderColor: `${roleColor}35`,
              }}
              title={user?.fullName ?? 'User'}
            >
              <span className="text-xs font-bold select-none" style={{ color: roleColor }}>
                {initials}
              </span>
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
  );
}
