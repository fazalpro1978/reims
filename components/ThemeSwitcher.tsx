'use client';

// ─────────────────────────────────────────────────────────────────────────────
// ThemeSwitcher — exports ThemePanel for embedding in any header/settings UI
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Theme, ThemeId,
  CORPORATE_THEMES, MOTORSPORT_THEMES,
  WINDOWS_STANDARD_THEMES, WINDOWS_HC_THEMES, UNIX_THEMES,
} from '../lib/theme/themes';

// Themes only superusers may see
const SUPERUSER_ONLY_THEMES = new Set([
  'prive-group',
  'tech-amethyst',
  'windows-glow',
  'windows-sunrise',
  'windows-flow',
  'hc-dusk',
  'unix-gnome',
  'unix-kde',
]);

// ── ThemePanel ────────────────────────────────────────────────────────────────
// Self-contained panel (no button). Drop it anywhere — inside a dropdown,
// a settings drawer, or a popover. onClose is called after a theme is selected.

export function ThemePanel({ onClose }: { onClose?: () => void }) {
  const { theme: current, setTheme } = useTheme();
  const { user } = useAuth();
  const isSuperuser = user?.role === 'superuser';

  const allow = (t: Theme) => isSuperuser || !SUPERUSER_ONLY_THEMES.has(t.id);

  const corporate       = CORPORATE_THEMES.filter(allow);
  const motorsport      = MOTORSPORT_THEMES.filter(allow);
  const windowsStandard = WINDOWS_STANDARD_THEMES.filter(allow);
  const windowsHc       = WINDOWS_HC_THEMES.filter(allow);
  const unix            = UNIX_THEMES.filter(allow);

  const select = (id: ThemeId) => {
    setTheme(id);
    onClose?.();
  };

  const CATEGORY_BADGE: Record<string, string> = {
    corporate:          'Corp',
    motorsport:         'Sport',
    'windows-standard': 'Win',
    'windows-hc':       'HC',
    unix:               'Unix',
  };

  return (
    <div
      className="w-[288px] overflow-hidden rounded-2xl theme-panel"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        boxShadow: '0 24px 64px -8px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.03)',
        maxHeight: '82vh',
        overflowY: 'auto',
      }}
    >
      {/* Header — active theme */}
      <div
        className="flex items-center gap-2.5 px-4 py-3 sticky top-0"
        style={{ background: 'var(--bg-header)', borderBottom: '1px solid var(--border-faint)', zIndex: 1 }}
      >
        <div
          className="w-5 h-5 rounded-md ring-1 ring-white/10 shrink-0"
          style={{ background: `linear-gradient(135deg, ${current.tokens.accent}, ${current.tokens.bgSurface})` }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] leading-none" style={{ color: 'var(--accent)' }}>
            UI THEME
          </p>
          <p className="text-[11px] font-semibold mt-0.5 truncate leading-tight" style={{ color: 'var(--text-primary)' }}>
            {current.name}
          </p>
        </div>
        <span
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide"
          style={{ background: 'var(--bg-subtle)', color: 'var(--text-dimmest)' }}
        >
          {CATEGORY_BADGE[current.category] ?? 'IMS'}
        </span>
      </div>

      {/* ── Corporate Tiers ─────────────────────────────────────────────────── */}
      {corporate.length > 0 && (
        <>
          <SectionHeader label="Corporate Tiers" />
          {corporate.map(t => (
            <ThemeRow key={t.id} theme={t} active={current.id === t.id} onSelect={() => select(t.id as ThemeId)} />
          ))}
          <Divider />
        </>
      )}

      {/* ── Motorsport Dashboard ─────────────────────────────────────────────── */}
      {motorsport.length > 0 && (
        <>
          <SectionHeader label="Motorsport Dashboard" />
          {motorsport.map(t => (
            <ThemeRow key={t.id} theme={t} active={current.id === t.id} onSelect={() => select(t.id as ThemeId)} />
          ))}
          <Divider />
        </>
      )}

      {/* ── Windows Core Standard ────────────────────────────────────────────── */}
      {windowsStandard.length > 0 && (
        <>
          <SectionHeader label="Windows Core Standard" icon="windows" />
          {windowsStandard.map(t => (
            <ThemeRow key={t.id} theme={t} active={current.id === t.id} onSelect={() => select(t.id as ThemeId)} />
          ))}
          <Divider />
        </>
      )}

      {/* ── Windows High-Contrast Accessibility ─────────────────────────────── */}
      {windowsHc.length > 0 && (
        <>
          <SectionHeader label="High-Contrast Accessibility" icon="accessibility" />
          {windowsHc.map(t => (
            <ThemeRow key={t.id} theme={t} active={current.id === t.id} onSelect={() => select(t.id as ThemeId)} />
          ))}
          {unix.length > 0 && <Divider />}
        </>
      )}

      {/* ── Cairo Shell — Unix Workstation ───────────────────────────────────── */}
      {unix.length > 0 && (
        <>
          <SectionHeader label="Cairo Shell · Unix Workstation" icon="unix" />
          <p className="px-4 pb-1 text-[10px] leading-snug" style={{ color: 'var(--text-dimmest)' }}>
            Activates a shell overlay (top panel + dock or taskbar) simulating GNOME or KDE.
          </p>
          {unix.map(t => (
            <ThemeRow key={t.id} theme={t} active={current.id === t.id} onSelect={() => select(t.id as ThemeId)} />
          ))}
        </>
      )}

      {/* Footer */}
      <div className="px-4 py-2.5" style={{ borderTop: '1px solid var(--border-faint)' }}>
        <p className="text-[9px]" style={{ color: 'var(--text-dimmest)' }}>
          <span className="font-semibold uppercase tracking-wide">Privé Group Vanguard REOS</span>
          <span className="mx-1.5">·</span>
          Theme persisted in browser
        </p>
      </div>
    </div>
  );
}

// ── Section helpers ───────────────────────────────────────────────────────────

function Divider() {
  return <div className="mx-4" style={{ height: '1px', background: 'var(--border-faint)' }} />;
}

function SectionHeader({ label, icon }: { label: string; icon?: 'windows' | 'accessibility' | 'unix' }) {
  return (
    <div className="flex items-center gap-1.5 px-4 pt-2.5 pb-1">
      {icon === 'windows' && (
        <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="var(--text-dimmest)">
          <path d="M3 5.557L10.5 4.5V11.5H3V5.557zM11.5 4.353L21 3v8.5H11.5V4.353zM3 12.5h7.5V19.5L3 18.443V12.5zM11.5 12.5H21V21l-9.5-1.353V12.5z" />
        </svg>
      )}
      {icon === 'accessibility' && (
        <svg className="w-3 h-3 shrink-0" fill="none" stroke="var(--text-dimmest)" viewBox="0 0 24 24" strokeWidth={2}>
          <circle cx="12" cy="5" r="1.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v6m0 0l-3 4m3-4l3 4M7 10l5 1 5-1" />
        </svg>
      )}
      {icon === 'unix' && (
        <svg className="w-3 h-3 shrink-0" fill="none" stroke="var(--text-dimmest)" viewBox="0 0 24 24" strokeWidth={2}>
          <rect x="2" y="3" width="20" height="18" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3" />
        </svg>
      )}
      <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--text-dimmest)' }}>
        {label}
      </p>
    </div>
  );
}

// ── ThemeRow ──────────────────────────────────────────────────────────────────

function ThemeRow({
  theme,
  active,
  onSelect,
}: {
  theme: Theme;
  active: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100"
      style={{
        background: active
          ? `color-mix(in srgb, ${theme.tokens.accent} 12%, transparent)`
          : hovered
          ? 'var(--bg-elevated)'
          : 'transparent',
      }}
    >
      {/* Gradient swatch */}
      <div className="relative shrink-0">
        <div
          className="w-7 h-7 rounded-lg ring-1 ring-white/8"
          style={{
            background: `linear-gradient(135deg, ${theme.tokens.accent} 0%, ${theme.tokens.bgElevated} 100%)`,
            boxShadow: active ? `0 0 0 2px ${theme.tokens.accent}55` : undefined,
          }}
        />
        {active && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg">
            <svg className="w-3 h-3 drop-shadow" fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth={3.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>

      {/* Name + tagline */}
      <div className="flex-1 min-w-0">
        <p
          className="text-xs font-semibold truncate leading-snug"
          style={{ color: active ? theme.tokens.accent : 'var(--text-secondary)' }}
        >
          {theme.name}
        </p>
        <p
          className="text-[10px] truncate leading-snug"
          style={{ color: 'var(--text-dimmest)' }}
        >
          {theme.tagline}
        </p>
      </div>

      {active && (
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: theme.tokens.accent }} />
      )}
    </button>
  );
}

// ── Default export: standalone floating trigger (kept for flexibility) ─────────

export default function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9000 }}
      className="flex flex-col items-end gap-3">
      {open && <ThemePanel onClose={() => setOpen(false)} />}
    </div>
  );
}
