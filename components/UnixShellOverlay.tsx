'use client';

// Cairo Shell-inspired Unix workstation simulation overlay.
// Renders a GNOME Activities panel + dock, or a KDE Plasma taskbar,
// anchored with fixed positioning so they never affect document flow.
// The data-layout attribute on <html> adds matching body padding via globals.css.

import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

// ── Shared clock ─────────────────────────────────────────────────────────────

function ShellClock({ color }: { color: string }) {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
      setDate(now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
    };
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center leading-none select-none">
      <span className="text-[13px] font-semibold" style={{ color }}>{time}</span>
      <span className="text-[10px] mt-0.5 opacity-70" style={{ color }}>{date}</span>
    </div>
  );
}

// ── Dock icon button ──────────────────────────────────────────────────────────

function DockIcon({ label, accent, children }: { label: string; accent: string; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <div className="relative flex flex-col items-center gap-1 group">
      <button
        title={label}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150"
        style={{
          background: hover ? `${accent}22` : 'rgba(255,255,255,0.08)',
          border: `1px solid ${hover ? accent + '55' : 'rgba(255,255,255,0.10)'}`,
          transform: hover ? 'translateY(-4px) scale(1.12)' : 'none',
          boxShadow: hover ? `0 8px 24px ${accent}33` : 'none',
        }}
      >
        {children}
      </button>
      {hover && (
        <span
          className="absolute -top-7 px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.85)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          {label}
        </span>
      )}
      {/* Active dot */}
      <div className="w-1 h-1 rounded-full" style={{ background: accent, opacity: 0.7 }} />
    </div>
  );
}

// ── GNOME Shell ───────────────────────────────────────────────────────────────
// Top panel (32 px) + bottom dock (64 px)

function GnomeShell() {
  const { theme } = useTheme();
  const { accent, bgHeader, bgSurface, textPrimary } = theme.tokens;

  const panelBg   = 'rgba(0,0,0,0.82)';
  const dockBg    = 'rgba(18,18,18,0.78)';
  const border    = 'rgba(255,255,255,0.10)';

  return (
    <>
      {/* ── Top Activities panel ────────────────────────────────────────────── */}
      <div
        className="fixed top-0 left-0 right-0 flex items-center px-3"
        style={{
          height: 32,
          background: panelBg,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${border}`,
          zIndex: 9000,
        }}
      >
        {/* Left — Activities + App name */}
        <div className="flex items-center gap-3 flex-1">
          <button
            className="text-[12px] font-semibold px-2.5 py-0.5 rounded transition-colors"
            style={{
              color: textPrimary,
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${border}`,
            }}
          >
            Activities
          </button>
          <span className="text-[12px] font-medium opacity-80" style={{ color: textPrimary }}>
            RE-IMS
          </span>
        </div>

        {/* Center — Clock */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <ShellClock color={textPrimary} />
        </div>

        {/* Right — Status icons */}
        <div className="flex items-center gap-2.5 flex-1 justify-end">
          {/* Network */}
          <svg className="w-3.5 h-3.5 opacity-70" fill="none" stroke={textPrimary} viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>
          {/* Volume */}
          <svg className="w-3.5 h-3.5 opacity-70" fill="none" stroke={textPrimary} viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6v12m-3.536-9.536a5 5 0 000 7.072" />
          </svg>
          {/* Power */}
          <button className="opacity-70 hover:opacity-100 transition-opacity">
            <svg className="w-3.5 h-3.5" fill="none" stroke={textPrimary} viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v9M18.364 5.636a9 9 0 11-12.728 0" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Bottom Dock ─────────────────────────────────────────────────────── */}
      <div
        className="fixed bottom-3 left-1/2 -translate-x-1/2 flex items-end px-3 py-2 gap-2"
        style={{
          background: dockBg,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: `1px solid ${border}`,
          borderRadius: 16,
          zIndex: 9000,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}
      >
        {/* Files */}
        <DockIcon label="Files" accent={accent}>
          <svg className="w-5 h-5" fill="none" stroke={accent} viewBox="0 0 24 24" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          </svg>
        </DockIcon>
        {/* Terminal */}
        <DockIcon label="Terminal" accent={accent}>
          <svg className="w-5 h-5" fill="none" stroke={accent} viewBox="0 0 24 24" strokeWidth={1.75}>
            <rect x="2" y="3" width="20" height="18" rx="2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3" />
          </svg>
        </DockIcon>
        {/* Browser */}
        <DockIcon label="Browser" accent={accent}>
          <svg className="w-5 h-5" fill="none" stroke={accent} viewBox="0 0 24 24" strokeWidth={1.75}>
            <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
          </svg>
        </DockIcon>
        {/* Settings */}
        <DockIcon label="Settings" accent={accent}>
          <svg className="w-5 h-5" fill="none" stroke={accent} viewBox="0 0 24 24" strokeWidth={1.75}>
            <circle cx="12" cy="12" r="3" />
            <path strokeLinecap="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </DockIcon>
        {/* Divider */}
        <div className="w-px h-8 mx-1 self-center" style={{ background: 'rgba(255,255,255,0.15)' }} />
        {/* RE-IMS app icon */}
        <DockIcon label="RE-IMS" accent={accent}>
          <span className="text-[13px] font-bold" style={{ color: accent }}>RE</span>
        </DockIcon>
      </div>
    </>
  );
}

// ── KDE Plasma Taskbar ────────────────────────────────────────────────────────
// Bottom panel (48 px): K-menu · task list · system tray · clock

function KdePlasma() {
  const { theme } = useTheme();
  const { accent, bgHeader, textPrimary, textMuted } = theme.tokens;

  const panelBg = 'rgba(14,18,22,0.88)';
  const border  = 'rgba(255,255,255,0.09)';

  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex items-center px-2 gap-1"
      style={{
        height: 48,
        background: panelBg,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: `1px solid ${border}`,
        zIndex: 9000,
      }}
    >
      {/* K-menu launcher */}
      <button
        className="w-9 h-9 rounded-lg flex items-center justify-center mr-1 transition-all"
        style={{
          background: `${accent}18`,
          border: `1px solid ${accent}40`,
        }}
        title="Application Launcher"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill={accent}>
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke={accent} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Separator */}
      <div className="w-px h-6 mx-1" style={{ background: border }} />

      {/* Task manager (RE-IMS active window) */}
      <button
        className="flex items-center gap-2 px-3 h-8 rounded-lg text-[12px] font-medium transition-all"
        style={{
          background: `${accent}20`,
          border: `1px solid ${accent}50`,
          color: textPrimary,
          minWidth: 140,
        }}
      >
        <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: accent }} />
        <span className="truncate">RE-IMS — Units Inventory</span>
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* System tray */}
      <div className="flex items-center gap-2 px-2">
        {/* Network */}
        <svg className="w-4 h-4 opacity-60" fill="none" stroke={textPrimary} viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
        </svg>
        {/* Volume */}
        <svg className="w-4 h-4 opacity-60" fill="none" stroke={textPrimary} viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6v12m-3.536-9.536a5 5 0 000 7.072" />
        </svg>
        {/* Battery */}
        <svg className="w-4 h-4 opacity-60" fill="none" stroke={textPrimary} viewBox="0 0 24 24" strokeWidth={2}>
          <rect x="2" y="7" width="18" height="11" rx="2" /><path d="M20 11h2v3h-2" strokeLinecap="round" />
          <rect x="4" y="9" width="12" height="7" rx="1" fill={accent} opacity="0.7" />
        </svg>
      </div>

      {/* Separator */}
      <div className="w-px h-6 mx-1" style={{ background: border }} />

      {/* Clock */}
      <div className="px-2">
        <ShellClock color={textPrimary} />
      </div>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function UnixShellOverlay() {
  const { layoutMode } = useTheme();
  if (layoutMode === 'gnome') return <GnomeShell />;
  if (layoutMode === 'kde')   return <KdePlasma />;
  return null;
}
