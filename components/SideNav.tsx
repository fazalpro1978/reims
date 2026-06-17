'use client';

// ─────────────────────────────────────────────────────────────────────────────
// SIDE NAVIGATION PANEL — Privé Group Vanguard REOS
// Slide-out drawer · overlay on all screen sizes
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';

interface SideNavProps {
  open: boolean;
  onClose: () => void;
}

// ── Icons ────────────────────────────────────────────────────────────────────

function IcGrid() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function IcHash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0">
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  );
}

function IcBuilding() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0">
      <path d="M6 22V4a2 2 0 012-2h8a2 2 0 012 2v18H6zM2 22h20M10 6h.01M10 10h.01M10 14h.01M14 6h.01M14 10h.01M14 14h.01" />
    </svg>
  );
}

function IcUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function IcDocument() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}

function IcChartBar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0">
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  );
}

function IcReport() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 8h10M7 12h10M7 16h6" />
    </svg>
  );
}

function IcSettings() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function IcHelp() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" />
    </svg>
  );
}

function IcIngest() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0">
      <path d="M12 3v12M8 11l4 4 4-4" />
      <path d="M20 21H4a1 1 0 01-1-1v-2a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-1 1z" />
    </svg>
  );
}

function IcSynergy() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0">
      <circle cx="8" cy="8" r="3" />
      <circle cx="16" cy="16" r="3" />
      <path d="M10.5 10.5l3 3" />
      <path d="M16 8a5 5 0 00-5 5" strokeDasharray="2 2" />
      <path d="M8 16a5 5 0 005-5" strokeDasharray="2 2" />
    </svg>
  );
}

function IcClose() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px]">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

const ICON_MAP: Record<string, React.ReactNode> = {
  hash:     <IcHash />,
  ingest:   <IcIngest />,
  synergy:  <IcSynergy />,
  grid:     <IcGrid />,
  building: <IcBuilding />,
  users:    <IcUsers />,
  document: <IcDocument />,
  chart:    <IcChartBar />,
  report:   <IcReport />,
  settings: <IcSettings />,
  help:     <IcHelp />,
};

const NAV_ICON_COLOR: Record<string, string> = {
  hash:     '#e879f9',  // fuchsia        — Code Registry
  ingest:   '#f97316',  // neon orange    — Data Ingestion
  synergy:  '#f43f5e',  // rose           — Synergy Center
  grid:     '#22d3ee',  // electric cyan  — Units Inventory
  building: '#a78bfa',  // neon violet    — Properties
  users:    '#4ade80',  // neon green     — Tenants
  document: '#fb923c',  // neon orange    — Contracts & Legal
  chart:    '#c9a84c',  // brand gold     — Financials
  report:   '#38bdf8',  // sky blue       — Reports
  settings: '#94a3b8',  // cool grey      — Settings
  help:     '#86efac',  // light green    — Help & Support
};

// ── Nav data ─────────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  {
    label: 'Portfolio',
    items: [
      { id: 'code-registry', label: 'Code Registry',    href: '/code-registry', icon: 'hash',   soon: false },
      { id: 'data-ingest',   label: 'Data Ingestion',   href: '/units-import',  icon: 'ingest',   soon: false },
      { id: 'synergy',       label: 'Synergy Center',   href: '/synergy',       icon: 'synergy', soon: false },
      { id: 'inventory',     label: 'Units Inventory',  href: '/',              icon: 'grid',    soon: false },
      { id: 'properties',  label: 'Properties',        href: '/properties', icon: 'building', soon: true  },
      { id: 'tenants',     label: 'Tenants',            href: '/tenants',    icon: 'users',    soon: true  },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'contracts',   label: 'Contracts & Legal', href: '/contracts',  icon: 'document', soon: true },
      { id: 'financials',  label: 'Financials',        href: '/financials', icon: 'chart',    soon: true },
      { id: 'reports',     label: 'Reports',           href: '/reports',    icon: 'report',   soon: true },
    ],
  },
];

const BOTTOM_ITEMS = [
  { id: 'settings', label: 'Settings',      href: '/settings', icon: 'settings', soon: true },
  { id: 'help',     label: 'Help & Support', href: '/help',     icon: 'help',     soon: true },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function SideNav({ open, onClose }: SideNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  type NavItemData = { id: string; label: string; href: string; icon: string; soon: boolean };

  function NavItem({ item }: { item: NavItemData }) {
    const active = isActive(item.href);

    const baseClass = 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group';

    if (item.soon) {
      return (
        <div className={`${baseClass} text-[#666666] cursor-default`}>
          <span style={{ color: NAV_ICON_COLOR[item.icon] ?? '#666666', opacity: 0.35 }}>
            {ICON_MAP[item.icon]}
          </span>
          <span className="flex-1 truncate">{item.label}</span>
          <span className="text-[9px] font-bold bg-[#222222] text-[#666666] px-1.5 py-0.5 rounded uppercase tracking-wider">
            Soon
          </span>
        </div>
      );
    }

    return (
      <a
        href={item.href}
        onClick={onClose}
        className={`${baseClass} ${
          active
            ? 'bg-[#c9a84c]/10 text-[#c9a84c] border-l-2 border-[#c9a84c] rounded-l-none'
            : 'text-[#aaaaaa] hover:text-[#e0e0e0] hover:bg-[#1e1e1e]'
        }`}
      >
        <span style={{ color: active ? '#c9a84c' : NAV_ICON_COLOR[item.icon] ?? '#888888' }}>
          {ICON_MAP[item.icon]}
        </span>
        <span className="flex-1 truncate">{item.label}</span>
        {active && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] shrink-0" />
        )}
      </a>
    );
  }

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/65 backdrop-blur-[3px] transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* ── Slide panel ── */}
      <aside
        role="navigation"
        aria-label="Main navigation"
        className={`fixed inset-y-0 left-0 z-50 w-[272px] flex flex-col bg-[#111111] border-r border-[#1e1e1e] shadow-[6px_0_48px_rgba(0,0,0,0.7)] transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* ── Panel header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e1e] shrink-0">
          <div className="flex items-center gap-3">
            <img
              src="/brand/logo-dark.png"
              alt="Privé Group Real Estate"
              style={{ height: '38px', width: 'auto', flexShrink: 0 }}
            />
            <p className="text-[#888888] text-[10px] leading-tight tracking-widest uppercase select-none">
              Vanguard REOS · v1.0
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-[#1a1a1a] hover:bg-[#252525] border border-[#2a2a2a] flex items-center justify-center text-[#888888] hover:text-[#c9a84c] transition-colors"
            aria-label="Close navigation"
          >
            <IcClose />
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-6">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="px-3 pb-2 text-[10px] font-bold text-[#666666] uppercase tracking-[0.14em]">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavItem key={item.id} item={item} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Bottom section ── */}
        <div className="shrink-0 border-t border-[#1a1a1a] px-3 pt-3 pb-5">
          <div className="space-y-0.5 mb-3">
            {BOTTOM_ITEMS.map((item) => (
              <NavItem key={item.id} item={item} />
            ))}
          </div>

          <div className="mx-3 mb-3 border-t border-[#1e1e1e]" />

          {/* User profile */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#1a1a1a] transition-colors cursor-default group">
            <div className="w-8 h-8 rounded-full bg-[#c9a84c]/15 border border-[#c9a84c]/20 flex items-center justify-center shrink-0">
              <span className="text-[#c9a84c] text-xs font-bold select-none">A</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#c8c8c8] truncate">Administrator</p>
              <p className="text-[11px] text-[#888888] truncate">Privé Group · Admin</p>
            </div>
            <svg className="w-3.5 h-3.5 text-[#666666] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </aside>
    </>
  );
}
