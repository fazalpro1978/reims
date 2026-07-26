'use client';

import React, { useRef, useState, useEffect } from 'react';
import { ThemePanel } from './ThemeSwitcher';
import { useAuth } from '../contexts/AuthContext';

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

export default function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, signOut } = useAuth();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const settingsBtnRef  = useRef<HTMLButtonElement>(null);
  const settingsPanelRef = useRef<HTMLDivElement>(null);
  const userBtnRef      = useRef<HTMLButtonElement>(null);
  const userMenuRef     = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!settingsOpen && !userMenuOpen) return;
      if (settingsBtnRef.current?.contains(e.target as Node) || settingsPanelRef.current?.contains(e.target as Node)) return;
      if (userBtnRef.current?.contains(e.target as Node)     || userMenuRef.current?.contains(e.target as Node))     return;
      setSettingsOpen(false);
      setUserMenuOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSettingsOpen(false); setUserMenuOpen(false); }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [settingsOpen, userMenuOpen]);

  // Derive initials from full name
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

          {/* Notifications bell */}
          <button className="hidden sm:flex w-8 h-8 rounded-lg bg-[#1a1a1a] hover:bg-[#242424] border border-[#222222] items-center justify-center text-[#444444] hover:text-[#c9a84c] transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
            </svg>
          </button>

          {/* Settings gear */}
          <div className="relative">
            <button
              ref={settingsBtnRef}
              onClick={() => { setSettingsOpen(v => !v); setUserMenuOpen(false); }}
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
              onClick={() => { setUserMenuOpen(v => !v); setSettingsOpen(false); }}
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
