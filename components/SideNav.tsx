'use client';

// ─────────────────────────────────────────────────────────────────────────────
// SIDE NAVIGATION PANEL — PropertyScape · Vanguard REOS
// Slide-out drawer · overlay on all screen sizes
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { authedFetch } from '../lib/authedFetch';

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
      <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
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
      <circle cx="8" cy="8" r="3" /><circle cx="16" cy="16" r="3" />
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
function IcBriefcase() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2M12 12v4M10 14h4" />
    </svg>
  );
}
function IcMapPin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
function IcPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="w-[13px] h-[13px]">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function IcCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px]">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

// ── Registry constants ────────────────────────────────────────────────────────

const REALTOR_CLASSIFICATIONS = [
  'Semi-Government & Master Developer',
  'Elite Private Developer & Conglomerate',
  'Top International & Local Brokerage',
  'Institutional Property Manager',
  'Independent',
] as const;

const QATAR_MUNICIPALITIES = [
  'Doha', 'Al Rayyan', 'Lusail', 'Al Wakrah',
  'Al Khor', 'Al Shamal', 'Al Daayen', 'Umm Salal',
];

// ── Nav data ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ReactNode> = {
  hash:       <IcHash />,
  ingest:     <IcIngest />,
  synergy:    <IcSynergy />,
  grid:       <IcGrid />,
  building:   <IcBuilding />,
  users:      <IcUsers />,
  document:   <IcDocument />,
  chart:      <IcChartBar />,
  report:     <IcReport />,
  settings:   <IcSettings />,
  help:       <IcHelp />,
  briefcase:  <IcBriefcase />,
  mappin:     <IcMapPin />,
};

const NAV_ICON_COLOR: Record<string, string> = {
  hash:       '#e879f9',
  ingest:     '#f97316',
  synergy:    '#f43f5e',
  grid:       '#22d3ee',
  building:   '#a78bfa',
  users:      '#4ade80',
  document:   '#fb923c',
  chart:      '#c9a84c',
  report:     '#38bdf8',
  settings:   '#94a3b8',
  help:       '#86efac',
  briefcase:  '#fbbf24',
  mappin:     '#34d399',
};

const NAV_SECTIONS = [
  {
    label: 'Portfolio',
    // role gates: undefined = all roles; array = allowed roles
    items: [
      { id: 'dashboard',     label: 'Dashboard',           href: '/',              icon: 'chart',     soon: false },
      { id: 'inventory',     label: 'Units Inventory',     href: '/inventory',     icon: 'grid',      soon: false },
      { id: 'properties',    label: 'Properties',          href: '/properties',    icon: 'building',  soon: false },
      { id: 'tenants',       label: 'Tenants',             href: '/tenants',       icon: 'users',     soon: true,  roles: ['superuser','administrator','staff'] },
      { id: 'code-registry', label: 'Code Registry',       href: '/code-registry', icon: 'hash',      soon: false, roles: ['superuser','administrator','staff'] },
      { id: 'realtors',      label: 'Realtor Information', href: '/realtors', icon: 'briefcase', soon: false, roles: ['superuser','administrator','staff'] },
      { id: 'zones',         label: 'Zone / District',     href: '/zones',    icon: 'mappin',    soon: false, roles: ['superuser','administrator','staff'] },
    ],
  },
  {
    label: 'Ingest',
    items: [
      { id: 'ingest-queue',  label: 'Axiom Queue',         href: '/ingest-queue',  icon: 'ingest',    soon: false, roles: ['superuser','administrator'] },
      { id: 'synergy',       label: 'Synergy Center',      href: '/synergy',       icon: 'synergy',   soon: false, roles: ['superuser','administrator','staff'] },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'contracts',  label: 'Contracts & Legal', href: '/contracts',  icon: 'document', soon: false, roles: ['superuser','administrator'] },
      { id: 'financials', label: 'Financials',        href: '/financials', icon: 'chart',    soon: true,  roles: ['superuser','administrator'] },
      { id: 'reports',    label: 'Reports',           href: '/reports',    icon: 'report',   soon: true,  roles: ['superuser','administrator','staff'] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { id: 'admin-users', label: 'User Management', href: '/admin/users', icon: 'users', soon: false, roles: ['superuser','administrator'] },
    ],
  },
];

const BOTTOM_ITEMS = [
  { id: 'settings', label: 'Settings',      href: '/settings', icon: 'settings', soon: true },
  { id: 'help',     label: 'Help & Support', href: '/help',     icon: 'help',     soon: true },
];

// IDs of nav items that have quick-add functionality
const QUICK_ADD_IDS = new Set(['realtors', 'zones']);

// ── Add Realtor Modal ─────────────────────────────────────────────────────────

function AddRealtorModal({ onClose }: { onClose: () => void }) {
  const [name,    setName]    = useState('');
  const [cls,     setCls]     = useState('');
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');
  const [success, setSuccess] = useState(false);

  async function save() {
    if (!name.trim()) { setErr('Company name is required.'); return; }
    if (!cls)         { setErr('Classification is required.'); return; }
    setSaving(true); setErr('');
    try {
      const res  = await authedFetch('/api/realtors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), classification: cls }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(typeof json.error === 'string' ? json.error : 'Failed to save');
      setSuccess(true);
      setTimeout(onClose, 1400);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Register Realtor" accentColor="#fbbf24" onClose={onClose}>
      {success ? (
        <SuccessBanner label={`"${name}" registered`} />
      ) : (
        <div className="space-y-4">
          <Field label="Company Name *">
            <input
              autoFocus
              value={name}
              onChange={e => { setName(e.target.value); setErr(''); }}
              onKeyDown={e => e.key === 'Enter' && save()}
              placeholder="e.g. Privé Real Estate"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-[#e0e0e0] placeholder-[#555] focus:outline-none focus:border-[#fbbf24] transition-colors"
            />
          </Field>
          <Field label="Classification *">
            <select
              value={cls}
              onChange={e => { setCls(e.target.value); setErr(''); }}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-[#e0e0e0] focus:outline-none focus:border-[#fbbf24] transition-colors"
            >
              <option value="">Select classification…</option>
              {REALTOR_CLASSIFICATIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          {err && <p className="text-xs text-[#ef4444]">{err}</p>}
          <ModalActions
            label={saving ? 'Registering…' : 'Register Realtor'}
            disabled={saving || !name.trim() || !cls}
            accentColor="#fbbf24"
            onSave={save}
            onCancel={onClose}
          />
        </div>
      )}
    </ModalShell>
  );
}

// ── Add Zone Modal ────────────────────────────────────────────────────────────

function AddZoneModal({ onClose }: { onClose: () => void }) {
  const [municipality,  setMunicipality]  = useState('');
  const [customMuni,    setCustomMuni]    = useState('');
  const [zoneNum,       setZoneNum]       = useState('');
  const [districtName,  setDistrictName]  = useState('');
  const [saving,        setSaving]        = useState(false);
  const [err,           setErr]           = useState('');
  const [success,       setSuccess]       = useState(false);

  const effectiveMuni = municipality === '__custom__' ? customMuni.trim() : municipality;
  const preview = zoneNum && districtName.trim()
    ? `Zone ${zoneNum} — ${districtName.trim()}`
    : null;

  async function save() {
    if (!effectiveMuni)       { setErr('Municipality is required.'); return; }
    const code = Number(zoneNum);
    if (!zoneNum || !Number.isInteger(code) || code <= 0) {
      setErr('Zone Number must be a positive integer.'); return;
    }
    if (!districtName.trim()) { setErr('District/Zone Name is required.'); return; }

    setSaving(true); setErr('');
    try {
      const res  = await fetch('/api/code-registry/zone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zoneCode: code, districtName: districtName.trim(), municipality: effectiveMuni }),
      });
      const json = await res.json();
      if (res.status === 409) throw new Error(json.error || `Zone ${code} already exists.`);
      if (!res.ok || json.error) throw new Error(typeof json.error === 'string' ? json.error : 'Failed to save');
      setSuccess(true);
      setTimeout(onClose, 1400);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Register Zone / District" accentColor="#34d399" onClose={onClose}>
      {success ? (
        <SuccessBanner label={preview ?? 'Zone registered'} />
      ) : (
        <div className="space-y-4">
          <Field label="Municipality *">
            <select
              value={municipality}
              onChange={e => { setMunicipality(e.target.value); setErr(''); }}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-[#e0e0e0] focus:outline-none focus:border-[#34d399] transition-colors"
            >
              <option value="">Select municipality…</option>
              {QATAR_MUNICIPALITIES.map(m => <option key={m} value={m}>{m}</option>)}
              <option value="__custom__">Other (type below)</option>
            </select>
            {municipality === '__custom__' && (
              <input
                autoFocus
                value={customMuni}
                onChange={e => { setCustomMuni(e.target.value); setErr(''); }}
                placeholder="Enter municipality name"
                className="mt-2 w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-[#e0e0e0] placeholder-[#555] focus:outline-none focus:border-[#34d399] transition-colors"
              />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Zone Number *">
              <input
                type="number"
                min={1}
                value={zoneNum}
                onChange={e => { setZoneNum(e.target.value); setErr(''); }}
                placeholder="e.g. 61"
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-[#e0e0e0] placeholder-[#555] focus:outline-none focus:border-[#34d399] transition-colors"
              />
            </Field>
            <Field label="District / Zone Name *">
              <input
                value={districtName}
                onChange={e => { setDistrictName(e.target.value); setErr(''); }}
                placeholder="e.g. Al Kharayej"
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-[#e0e0e0] placeholder-[#555] focus:outline-none focus:border-[#34d399] transition-colors"
              />
            </Field>
          </div>
          {preview && (
            <p className="text-[11px] text-[#34d399] font-mono bg-[#34d399]/5 border border-[#34d399]/20 rounded-lg px-3 py-2">
              Preview: {preview}
            </p>
          )}
          {err && <p className="text-xs text-[#ef4444]">{err}</p>}
          <ModalActions
            label={saving ? 'Registering…' : 'Register Zone'}
            disabled={saving || !effectiveMuni || !zoneNum || !districtName.trim()}
            accentColor="#34d399"
            onSave={save}
            onCancel={onClose}
          />
        </div>
      )}
    </ModalShell>
  );
}

// ── Shared modal primitives ───────────────────────────────────────────────────

function ModalShell({
  title, accentColor, onClose, children,
}: { title: string; accentColor: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#141414] border border-[#2a2a2a] rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.8)] z-10 overflow-hidden">
        {/* Accent bar */}
        <div className="h-[3px] w-full" style={{ background: accentColor }} />
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-[#e0e0e0] tracking-wide">{title}</h2>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-[#1e1e1e] hover:bg-[#2a2a2a] border border-[#333] flex items-center justify-center text-[#666] hover:text-[#e0e0e0] transition-colors"
            >
              <IcClose />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function ModalActions({
  label, disabled, accentColor, onSave, onCancel,
}: { label: string; disabled: boolean; accentColor: string; onSave: () => void; onCancel: () => void }) {
  return (
    <div className="flex gap-2 pt-1">
      <button
        onClick={onSave}
        disabled={disabled}
        style={{ background: disabled ? '#222' : accentColor, color: disabled ? '#555' : '#0f0f0f' }}
        className="flex-1 text-sm font-bold py-2.5 rounded-xl transition-all disabled:cursor-not-allowed"
      >
        {label}
      </button>
      <button
        onClick={onCancel}
        className="px-4 text-sm text-[#666] hover:text-[#e0e0e0] border border-[#2a2a2a] hover:border-[#444] rounded-xl transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}

function SuccessBanner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6">
      <div className="w-10 h-10 rounded-full bg-[#22c55e]/15 border border-[#22c55e]/30 flex items-center justify-center">
        <IcCheck />
      </div>
      <p className="text-sm text-[#22c55e] font-semibold text-center">{label}</p>
      <p className="text-[11px] text-[#555]">Registered and synced across all workspaces</p>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SideNav({ open, onClose }: SideNavProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const [addRealtorOpen, setAddRealtorOpen] = useState(false);
  const [addZoneOpen,    setAddZoneOpen]    = useState(false);

  const userRole = user?.role ?? 'public';
  const canWrite = ['superuser','administrator'].includes(userRole);

  // Role label / color (same as TopBar)
  const ROLE_LABEL: Record<string, string> = {
    superuser:'Superuser', administrator:'Administrator', staff:'Staff', agent:'Agent', public:'Public',
  };
  const ROLE_COLOR: Record<string, string> = {
    superuser:'#c9a84c', administrator:'#3b82f6', staff:'#10b981', agent:'#8b5cf6', public:'#64748b',
  };
  const roleColor  = ROLE_COLOR[userRole] ?? '#888';
  const initials   = user?.fullName
    ? user.fullName.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase()
    : '?';

  const isActive = (href: string) => {
    const base = href.split('?')[0];
    return base === '/' ? pathname === '/' : pathname.startsWith(base);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !addRealtorOpen && !addZoneOpen) onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, addRealtorOpen, addZoneOpen]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  type NavItemData = { id: string; label: string; href: string; icon: string; soon: boolean; roles?: string[] };

  function NavItem({ item }: { item: NavItemData }) {
    // Role gate — if item has roles list, only show to those roles
    if (item.roles && !item.roles.includes(userRole)) return null;

    const active     = isActive(item.href);
    const isRealtor  = item.id === 'realtors';
    const isZone     = item.id === 'zones';
    // Quick-add only visible to SU/AD
    const hasAdd     = QUICK_ADD_IDS.has(item.id) && canWrite;
    const accentCol  = isRealtor ? '#fbbf24' : '#34d399';

    const baseClass = 'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors group';

    if (item.soon) {
      return (
        <div className={`${baseClass} px-3 py-2.5 text-[#666666] cursor-default`}>
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

    if (hasAdd) {
      return (
        <div
          className={`flex items-center rounded-lg overflow-hidden transition-colors ${
            active
              ? 'bg-[#c9a84c]/10 border-l-2 border-[#c9a84c] rounded-l-none'
              : 'hover:bg-[#1e1e1e]'
          }`}
        >
          {/* Main link */}
          <a
            href={item.href}
            onClick={onClose}
            className={`flex items-center gap-3 flex-1 px-3 py-2.5 min-w-0 ${
              active ? 'text-[#c9a84c]' : 'text-[#aaaaaa] hover:text-[#e0e0e0]'
            }`}
          >
            <span style={{ color: active ? '#c9a84c' : NAV_ICON_COLOR[item.icon] ?? '#888888' }}>
              {ICON_MAP[item.icon]}
            </span>
            <span className="flex-1 truncate">{item.label}</span>
            {active && <span className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] shrink-0" />}
          </a>
          {/* Quick-add button */}
          <button
            title={`Add new ${isRealtor ? 'realtor' : 'zone'}`}
            onClick={e => {
              e.stopPropagation();
              if (isRealtor) setAddRealtorOpen(true);
              else            setAddZoneOpen(true);
            }}
            style={{ color: accentCol }}
            className="shrink-0 mx-1.5 my-1 w-6 h-6 rounded-md flex items-center justify-center opacity-40 hover:opacity-100 hover:bg-[#ffffff10] transition-all"
          >
            <IcPlus />
          </button>
        </div>
      );
    }

    return (
      <a
        href={item.href}
        onClick={onClose}
        className={`${baseClass} px-3 py-2.5 ${
          active
            ? 'bg-[#c9a84c]/10 text-[#c9a84c] border-l-2 border-[#c9a84c] rounded-l-none'
            : 'text-[#aaaaaa] hover:text-[#e0e0e0] hover:bg-[#1e1e1e]'
        }`}
      >
        <span style={{ color: active ? '#c9a84c' : NAV_ICON_COLOR[item.icon] ?? '#888888' }}>
          {ICON_MAP[item.icon]}
        </span>
        <span className="flex-1 truncate">{item.label}</span>
        {active && <span className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] shrink-0" />}
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
          {NAV_SECTIONS.map((section) => {
            const visibleItems = section.items.filter(item => !item.roles || item.roles.includes(userRole));
            if (visibleItems.length === 0) return null;
            return (
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
            );
          })}
        </nav>

        {/* ── Bottom section ── */}
        <div className="shrink-0 border-t border-[#1a1a1a] px-3 pt-3 pb-5">
          <div className="space-y-0.5 mb-3">
            {BOTTOM_ITEMS.map((item) => (
              <NavItem key={item.id} item={item} />
            ))}
          </div>

          <div className="mx-3 mb-3 border-t border-[#1e1e1e]" />

          {/* User profile + sign out */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#1a1a1a] transition-colors group">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: `${roleColor}18`, border: `1px solid ${roleColor}30` }}
            >
              <span className="text-xs font-bold select-none" style={{ color: roleColor }}>{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#c8c8c8] truncate">{user?.fullName ?? '—'}</p>
              <p className="text-[11px] truncate" style={{ color: `${roleColor}bb` }}>
                {ROLE_LABEL[userRole] ?? userRole}
              </p>
            </div>
            <button
              onClick={signOut}
              title="Sign out"
              className="w-6 h-6 rounded-md flex items-center justify-center text-[#666] hover:text-[#ef4444] hover:bg-[#ef444410] transition-all"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Quick-add modals (render outside the slide panel so they cover the full viewport) ── */}
      {addRealtorOpen && <AddRealtorModal onClose={() => setAddRealtorOpen(false)} />}
      {addZoneOpen    && <AddZoneModal    onClose={() => setAddZoneOpen(false)} />}
    </>
  );
}
