'use client';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — MAIN CORE UNITS INVENTORY PANEL
// Privé Group RE-IMS · Admin Dashboard
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import {
  UnitListing,
  Status,
  Furnishing,
  KitchenType,
  UnitType,
  ListingType,
  MociContractStatus,
  StatusFilter,
  FurnishingFilter,
  ContextMenuPosition,
} from '../types/inventory';
import { supabase } from '../lib/supabase/client';
import UnitDetailsModal from './UnitDetailsModal';
import { ThemePanel } from './ThemeSwitcher';

// ── Constants ──────────────────────────────────────────────────────────────

const ROWS_PER_PAGE = 50;

const STATUS_BADGE: Record<Status, { label: string; classes: string }> = {
  [Status.Available]: {
    label: 'Available',
    classes: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-500/30',
  },
  [Status.Leased]: {
    label: 'Leased',
    classes: 'bg-orange-500/10 text-orange-400 ring-1 ring-inset ring-orange-500/30',
  },
  [Status.Reserved]: {
    label: 'Reserved',
    classes: 'bg-blue-500/10 text-blue-400 ring-1 ring-inset ring-blue-500/30',
  },
  [Status.Under_Maintenance]: {
    label: 'Maintenance',
    classes: 'bg-purple-500/10 text-purple-400 ring-1 ring-inset ring-purple-500/30',
  },
};

// ── Utility ────────────────────────────────────────────────────────────────

const formatQAR = (n: number) => `QAR ${n.toLocaleString('en-US')}`;

function generateShareText(unit: UnitListing): string {
  return (
    `Property: ${unit.property}, Unit: ${unit.unitNo}, District: ${unit.zone} (Zone ${unit.zoneCode}), ` +
    `Type: ${unit.type} · ${unit.config}, Furnishing: ${unit.furnishing}, ` +
    `Rent: QAR ${unit.rent.toLocaleString()}/month, Status: ${unit.status.replace('_', ' ')}, ` +
    `Realtor (MOCI): ${unit.realtorMOCI}`
  );
}

function generateEmailBody(unit: UnitListing): string {
  return [
    `Property Listing Enquiry — Privé Group Real Estate`,
    ``,
    `Property:   ${unit.property}`,
    `Unit No:    ${unit.unitNo}`,
    `Type:       ${unit.type} — ${unit.config}`,
    `District:   ${unit.zone} (Zone ${unit.zoneCode})`,
    `Furnishing: ${unit.furnishing}`,
    `Status:     ${unit.status.replace('_', ' ')}`,
    `Rent:       QAR ${unit.rent.toLocaleString()} / month`,
    ``,
    `─────────────────────────────────────`,
    `Privé Group Real Estate`,
    `Tel / WhatsApp: +974 7707 5959`,
    `Email: admin@privegroupre.com`,
    `Brokerage Licence No 773 | CR No 187753`,
  ].join('\n');
}

const KITCHEN_BADGE: Record<KitchenType, string> = {
  Open:   'border border-emerald-600/40 text-emerald-400 bg-emerald-500/10',
  Closed: 'border border-rose-600/40   text-rose-400   bg-rose-500/10',
  Yes:    'border border-green-600/40  text-green-400  bg-green-500/10',
  Pantry: 'border border-amber-600/40  text-amber-400  bg-amber-500/10',
};

function IconShower() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22L14 12" />
      <circle cx="16" cy="8" r="4" />
      <line x1="11" y1="17" x2="11" y2="19" />
      <line x1="14" y1="18" x2="14" y2="20" />
      <line x1="17" y1="17" x2="17" y2="19" />
    </svg>
  );
}

function IconToilet() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="2" width="10" height="5" rx="1" />
      <path d="M6 7h12c0 5.5-2.5 9-6 9s-6-3.5-6-9z" />
    </svg>
  );
}

function BathCell({ n }: { n: number }) {
  const full = Math.floor(n);
  const half = n % 1 >= 0.5;
  const shown = Math.min(full, 4);
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: shown }).map((_, i) => (
        <span key={i} className="text-[#c9a84c]"><IconShower /></span>
      ))}
      {full > 4 && <span className="text-[10px] text-[#606060]">+{full - 4}</span>}
      {half && <span className="text-[#555555]"><IconToilet /></span>}
      <span className="ml-1 text-sm text-slate-300">{n % 1 === 0 ? n : n.toFixed(1)}</span>
    </div>
  );
}

function ParkingCell({ has }: { has: boolean }) {
  return has ? (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-[#c9a84c]/20 text-[#c9a84c]">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
      </svg>
    </span>
  ) : (
    <span className="text-[#333333] text-base leading-none select-none">—</span>
  );
}

// ── SVG icon primitives ────────────────────────────────────────────────────

function IconSearch() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function IconMap() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconMedia() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function IconPDF() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function IconWhatsApp() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

// ── Metric Card ────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  count: number;
  valueColor: string;
  isActive: boolean;
  onClick: () => void;
  accentRing: string;
}

function MetricCard({ label, count, valueColor, isActive, onClick, accentRing }: MetricCardProps) {
  return (
    <button
      onClick={onClick}
      className={`group text-left bg-[#1a1a1a] rounded-xl border px-5 py-4 transition-all duration-150 hover:shadow-[0_4px_24px_rgba(0,0,0,0.5)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a84c] ${
        isActive ? `${accentRing} shadow-md` : 'border-[#2a2a2a]'
      }`}
    >
      <p className="text-xs font-semibold text-[#606060] uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-bold mt-1.5 tabular-nums ${valueColor}`}>{count}</p>
      {isActive && (
        <div className="mt-2 h-0.5 w-8 rounded-full bg-[#c9a84c]" />
      )}
    </button>
  );
}

// ── Context Menu ───────────────────────────────────────────────────────────

interface ContextMenuProps {
  menu: ContextMenuPosition;
  onClose: () => void;
  onViewDetails: (unit: UnitListing) => void;
  onWhatsApp: (unit: UnitListing) => void;
  onEmail: (unit: UnitListing) => void;
  onDuplicate: (unit: UnitListing) => void;
}

function ContextMenu({ menu, onClose, onViewDetails, onWhatsApp, onEmail, onDuplicate }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler, true);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler, true);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  const item = (
    icon: React.ReactNode,
    label: string,
    onClick: () => void,
    extraClass = '',
    iconColor = '#505050'
  ) => (
    <button
      onClick={() => { onClick(); onClose(); }}
      className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors text-left hover:bg-[#252525] focus:outline-none focus-visible:bg-[#252525] ${extraClass}`}
    >
      <span className="shrink-0" style={{ color: iconColor }}>{icon}</span>
      {label}
    </button>
  );

  const linkItem = (
    icon: React.ReactNode,
    label: string,
    href: string,
    iconColor = '#64748b'
  ) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClose}
      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-300 transition-colors hover:bg-[#252525]"
    >
      <span className="shrink-0" style={{ color: iconColor }}>{icon}</span>
      {label}
    </a>
  );

  return (
    <div
      ref={ref}
      style={{ top: menu.y, left: menu.x }}
      className="fixed z-50 w-56 bg-[#1a1a1a] rounded-xl shadow-[0_8px_40px_-4px_rgba(0,0,0,0.7)] border border-[#2d2d2d] py-1.5 overflow-hidden"
      role="menu"
    >
      {item(<IconEye />,  'View Details', () => onViewDetails(menu.unit),                              'text-slate-200 font-medium', '#22d3ee')}
      {item(<IconEdit />, 'Edit Unit',    () => onViewDetails(menu.unit),                              'text-slate-300',             '#c9a84c')}
      {item(<IconCopy />, 'Duplicate',    () => onDuplicate(menu.unit),                                'text-slate-300',             '#a78bfa')}

      <div className="my-1 mx-1 border-t border-[#2a2a2a]" />

      {linkItem(<IconMap />,   'Maps',  menu.unit.locationMapUrl, '#4ade80')}
      {linkItem(<IconMedia />, 'Media', menu.unit.mediaUrl,       '#60a5fa')}

      <div className="my-1 mx-1 border-t border-[#2a2a2a]" />
      <p className="px-3.5 pt-1 pb-0.5 text-[10px] font-bold text-[#505050] uppercase tracking-widest">
        Share
      </p>

      <button
        onClick={() => { onWhatsApp(menu.unit); onClose(); }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-300 hover:bg-[#252525] transition-colors text-left"
      >
        <span style={{ color: '#25D366' }}><IconWhatsApp /></span>
        WhatsApp
      </button>
      {item(<IconPDF />,  'PDF Report', () => window.open(`/report/${menu.unit.uuid}`, '_blank'), 'text-slate-300', '#fb923c')}
      {item(<IconMail />, 'Email',      () => onEmail(menu.unit),                                 'text-slate-300', '#38bdf8')}

      <div className="my-1 mx-1 border-t border-[#2a2a2a]" />

      {item(
        <IconTrash />,
        'Delete',
        () => {},
        'text-red-400 font-medium hover:!bg-[#1a0a0a]',
        '#f87171'
      )}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────

export default function UnitsInventory({ onMenuClick }: { onMenuClick?: () => void }) {
  // ── Filter state ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [furnishingFilter, setFurnishingFilter] = useState<FurnishingFilter>('All');
  const [zoneFilter, setZoneFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<UnitType | 'All'>('All');
  const [configFilter, setConfigFilter] = useState<string>('All');
  const [realtorFilter, setRealtorFilter] = useState<string>('All');
  const [minRent, setMinRent] = useState<string>('');
  const [maxRent, setMaxRent] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);

  // ── Live data from Supabase ────────────────────────────────────────────────
  const [units, setUnits] = useState<UnitListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    async function fetchUnits() {
      setLoading(true);
      const { data, error } = await supabase
        .from('units')
        .select('*, unit_operational(maintenance_notes, access_lockbox)')
        .order('unit_code');
      if (error) { setDbError(error.message); setLoading(false); return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: UnitListing[] = ((data ?? []) as any[]).map((row) => ({
        id:                  row.unit_code,
        uuid:                row.id,
        realtorName:         row.realtor_name,
        realtorMOCI:         row.realtor_moci,
        property:            row.property,
        unitNo:              row.unit_no,
        zoneCode:            row.zone_code,
        zone:                row.zone,
        type:                row.type as UnitType,
        config:              row.config,
        bathrooms:           Number(row.bathrooms),
        parking:             row.parking,
        kitchen:             row.kitchen as KitchenType,
        furnishing:          row.furnishing as Furnishing,
        listingType:         row.listing_type as ListingType,
        status:              row.status as Status,
        rent:                Number(row.rent),
        serviceCharges:      Number(row.service_charges),
        depositAmount:       Number(row.deposit_amount),
        agencyFee:           Number(row.agency_fee),
        mociContractStatus:  row.moci_contract_status as MociContractStatus,
        mociContractNumber:  row.moci_contract_number ?? '',
        legalDuration:       row.legal_duration ?? '',
        contractStartDate:   row.contract_start_date ?? '',
        contractEndDate:     row.contract_end_date ?? '',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        maintenanceNotes:    (row.unit_operational as any)?.[0]?.maintenance_notes ?? '',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        accessLockbox:       (row.unit_operational as any)?.[0]?.access_lockbox ?? '',
        assetHistoryLinks:   row.asset_history_links ?? [],
        locationMapUrl:      row.location_map_url ?? '',
        mediaUrl:            row.media_url ?? '',
        listedDate:          row.listed_date ?? '',
        lastUpdated:         row.updated_at ?? '',
      }));
      setUnits(mapped);
      setLoading(false);
    }
    fetchUnits();
  }, [refreshKey]);

  // ── Modal / context menu / settings state ────────────────────────────────
  const [selectedUnit, setSelectedUnit] = useState<UnitListing | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const settingsPanelRef = useRef<HTMLDivElement>(null);

  // Close settings panel on outside click
  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        settingsBtnRef.current?.contains(e.target as Node) ||
        settingsPanelRef.current?.contains(e.target as Node)
      ) return;
      setSettingsOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSettingsOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [settingsOpen]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const allZones = useMemo(
    () => Array.from(new Set(units.map((u) => u.zone))).sort(),
    [units]
  );

  const allTypes = useMemo(
    () => Array.from(new Set(units.map((u) => u.type))).sort() as UnitType[],
    [units]
  );

  const allConfigs = useMemo(
    () => Array.from(new Set(units.map((u) => u.config))).sort(),
    [units]
  );

  const allRealtors = useMemo(
    () => Array.from(new Set(units.map((u) => u.realtorName))).sort(),
    [units]
  );

  const rentRange = useMemo(() => ({
    min: units.length ? Math.min(...units.map((u) => u.rent)) : 0,
    max: units.length ? Math.max(...units.map((u) => u.rent)) : 0,
  }), [units]);

  // Full-dataset metrics (not filtered, so metric cards always show totals)
  const metrics = useMemo(
    () => ({
      total:       units.length,
      available:   units.filter((u) => u.status === Status.Available).length,
      leased:      units.filter((u) => u.status === Status.Leased).length,
      reserved:    units.filter((u) => u.status === Status.Reserved).length,
      maintenance: units.filter((u) => u.status === Status.Under_Maintenance).length,
    }),
    [units]
  );

  const _q = search.trim().toLowerCase();
  const _minR = minRent !== '' ? Number(minRent) : null;
  const _maxR = maxRent !== '' ? Number(maxRent) : null;
  const filteredUnits = units.filter((u) => {
    const matchSearch =
      !_q ||
      u.property.toLowerCase().includes(_q) ||
      u.unitNo.toLowerCase().includes(_q) ||
      u.realtorName.toLowerCase().includes(_q) ||
      (u.realtorMOCI ?? '').toLowerCase().includes(_q);
    const matchStatus     = statusFilter     === 'All' || u.status      === statusFilter;
    const matchFurnishing = furnishingFilter  === 'All' || u.furnishing  === furnishingFilter;
    const matchZone       = zoneFilter        === 'All' || u.zone        === zoneFilter;
    const matchType       = typeFilter        === 'All' || u.type        === typeFilter;
    const matchConfig     = configFilter      === 'All' || u.config      === configFilter;
    const matchRealtor    = realtorFilter     === 'All' || u.realtorName === realtorFilter;
    const matchMinRent    = _minR === null || u.rent >= _minR;
    const matchMaxRent    = _maxR === null || u.rent <= _maxR;
    return matchSearch && matchStatus && matchFurnishing && matchZone &&
           matchType && matchConfig && matchRealtor && matchMinRent && matchMaxRent;
  });

  const totalPages = Math.max(1, Math.ceil(filteredUnits.length / ROWS_PER_PAGE));
  const paginatedUnits = filteredUnits.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE
  );

  // Reset to page 1 whenever filters change
  const resetPage = useCallback(() => setCurrentPage(1), []);

  const hasActiveFilters =
    search !== '' ||
    statusFilter    !== 'All' ||
    furnishingFilter !== 'All' ||
    zoneFilter      !== 'All' ||
    typeFilter      !== 'All' ||
    configFilter    !== 'All' ||
    realtorFilter   !== 'All' ||
    minRent !== '' ||
    maxRent !== '';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('All');
    setFurnishingFilter('All');
    setZoneFilter('All');
    setTypeFilter('All');
    setConfigFilter('All');
    setRealtorFilter('All');
    setMinRent('');
    setMaxRent('');
    setCurrentPage(1);
  };

  // ── Context menu positioning ───────────────────────────────────────────────

  const handleEllipsisClick = (e: React.MouseEvent<HTMLButtonElement>, unit: UnitListing) => {
    e.stopPropagation();
    if (contextMenu?.unit.id === unit.id) {
      setContextMenu(null);
      return;
    }
    const MENU_W = 224;
    const MENU_H = 360;
    const rect = e.currentTarget.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let x = rect.right - MENU_W;
    let y = rect.bottom + 4;

    if (y + MENU_H > vh) y = rect.top - MENU_H - 4;
    if (x < 8) x = 8;
    if (x + MENU_W > vw - 8) x = vw - MENU_W - 8;

    setContextMenu({ unit, x, y });
  };

  // ── Share handlers ─────────────────────────────────────────────────────────

  const handleWhatsApp = useCallback((unit: UnitListing) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(generateShareText(unit))}`, '_blank');
  }, []);

  const handleEmail = useCallback((unit: UnitListing) => {
    const subject = encodeURIComponent(
      `Property Enquiry — ${unit.property} ${unit.config} | ${unit.id}`
    );
    const body = encodeURIComponent(generateEmailBody(unit));
    window.open(`mailto:?subject=${subject}&body=${body}`);
  }, []);

  const handleDuplicate = useCallback(async (unit: UnitListing) => {
    if (!unit.uuid) return;
    // Fetch the full DB row so we copy every column, not just mapped fields
    const { data: row, error: fetchErr } = await supabase
      .from('units')
      .select('*')
      .eq('id', unit.uuid)
      .single();
    if (fetchErr || !row) {
      setToast({ type: 'error', msg: 'Could not read unit data for duplication.' });
      setTimeout(() => setToast(null), 4000);
      return;
    }
    // Build the duplicate — strip DB-managed identity columns, reset lease-specific fields
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = row;
    const newCode = `${row.unit_code}-COPY`;
    const newRow = {
      ...rest,
      unit_code:            newCode,
      status:               'Available',
      moci_contract_status: 'DRAFT',
      moci_contract_number: null,
      contract_start_date:  null,
      contract_end_date:    null,
    };
    const { error: insertErr } = await supabase.from('units').insert(newRow);
    if (insertErr) {
      setToast({ type: 'error', msg: `Duplicate failed: ${insertErr.message}` });
      setTimeout(() => setToast(null), 5000);
      return;
    }
    setToast({ type: 'success', msg: `Duplicated as ${newCode} — edit to update details.` });
    setTimeout(() => setToast(null), 4000);
    setRefreshKey(k => k + 1);
  }, []);

  const handleViewDetails = useCallback((unit: UnitListing) => {
    setSelectedUnit(unit);
  }, []);

  // ── Pagination page numbers (show at most 7 pages) ────────────────────────

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 4) return [1, 2, 3, 4, 5, '…', totalPages];
    if (currentPage >= totalPages - 3)
      return [1, '…', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, '…', currentPage - 1, currentPage, currentPage + 1, '…', totalPages];
  }, [currentPage, totalPages]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0f0f0f]">

      {/* ── HEADER ── */}
      <header className="bg-[#0d0d0d] sticky top-0 z-30 border-b border-[#1e1e1e]">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Hamburger — desktop (lg+) */}
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
            <p className="text-[#444444] text-[11px] leading-tight hidden sm:block tracking-wide select-none">
              Real Estate Information Management System
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[#3a3a3a] text-xs hidden md:block font-medium tracking-wide">Admin Console</span>
            {/* Divider */}
            <div className="hidden md:block w-px h-4 bg-[#222222] mx-1" />
            {/* Notifications bell */}
            <button className="hidden sm:flex w-8 h-8 rounded-lg bg-[#1a1a1a] hover:bg-[#242424] border border-[#222222] items-center justify-center text-[#444444] hover:text-[#c9a84c] transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
              </svg>
            </button>

            {/* Settings gear — opens theme panel */}
            <div className="relative">
              <button
                ref={settingsBtnRef}
                onClick={() => setSettingsOpen(v => !v)}
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

              {/* Settings dropdown — ThemePanel is self-contained with its own shell */}
              {settingsOpen && (
                <div
                  ref={settingsPanelRef}
                  className="absolute top-full right-0 mt-2"
                  style={{ zIndex: 200 }}
                >
                  <ThemePanel onClose={() => setSettingsOpen(false)} />
                </div>
              )}
            </div>

            {/* Avatar */}
            <div className="w-7 h-7 rounded-full bg-[#c9a84c]/15 border border-[#c9a84c]/25 flex items-center justify-center cursor-default">
              <span className="text-[#c9a84c] text-xs font-bold select-none">A</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── DB error banner ── */}
        {dbError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            Database error: {dbError}
          </div>
        )}

        {/* ── PAGE TITLE ── */}
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Units Inventory</h2>
          <p className="text-[#606060] text-sm mt-0.5">
            Manage, filter, and monitor all Qatar property listings
          </p>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION A: METRIC TICKER RIBBON
            Each card is clickable and overrides the active status filter.
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <MetricCard
            label="Total Units"
            count={metrics.total}
            valueColor="text-slate-900"
            isActive={statusFilter === 'All'}
            accentRing="border-slate-900 ring-1 ring-slate-900"
            onClick={() => { setStatusFilter('All'); resetPage(); }}
          />
          <MetricCard
            label="Available"
            count={metrics.available}
            valueColor="text-emerald-600"
            isActive={statusFilter === Status.Available}
            accentRing="border-emerald-500 ring-1 ring-emerald-500"
            onClick={() => { setStatusFilter(Status.Available); resetPage(); }}
          />
          <MetricCard
            label="Leased"
            count={metrics.leased}
            valueColor="text-orange-500"
            isActive={statusFilter === Status.Leased}
            accentRing="border-orange-500 ring-1 ring-orange-500"
            onClick={() => { setStatusFilter(Status.Leased); resetPage(); }}
          />
          <MetricCard
            label="Reserved"
            count={metrics.reserved}
            valueColor="text-blue-600"
            isActive={statusFilter === Status.Reserved}
            accentRing="border-blue-500 ring-1 ring-blue-500"
            onClick={() => { setStatusFilter(Status.Reserved); resetPage(); }}
          />
          <MetricCard
            label="Maintenance"
            count={metrics.maintenance}
            valueColor="text-purple-600"
            isActive={statusFilter === Status.Under_Maintenance}
            accentRing="border-purple-500 ring-1 ring-purple-500"
            onClick={() => { setStatusFilter(Status.Under_Maintenance); resetPage(); }}
          />
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION B: FILTER & UTILITY ENGINE CONSOLE
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="bg-[#181818] rounded-xl border border-[#2a2a2a] p-4">

          {/* ── Filter row — wraps on smaller screens ── */}
          <div className="flex flex-wrap items-center gap-2">

            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#505050] pointer-events-none">
                <IconSearch />
              </span>
              <input
                type="text"
                placeholder="Search code, realtor, zone…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); resetPage(); }}
                className="w-full pl-9 pr-3 py-2 text-sm bg-[#1e1e1e] text-white border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c9a84c]/40 focus:border-[#c9a84c] placeholder:text-[#505050]"
              />
            </div>

            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); resetPage(); }}
              className="py-2 px-3 text-sm bg-[#1e1e1e] text-[#d0d0d0] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c9a84c]/40 focus:border-[#c9a84c] cursor-pointer min-w-[120px]"
            >
              <option value="All">All Status</option>
              {Object.values(Status).map((s) => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>

            {/* Furnishing */}
            <select
              value={furnishingFilter}
              onChange={(e) => { setFurnishingFilter(e.target.value as FurnishingFilter); resetPage(); }}
              className="py-2 px-3 text-sm bg-[#1e1e1e] text-[#d0d0d0] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c9a84c]/40 focus:border-[#c9a84c] cursor-pointer min-w-[140px]"
            >
              <option value="All">Any Furnishing</option>
              {Object.values(Furnishing).map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>

            {/* Unit Type */}
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value as UnitType | 'All'); resetPage(); }}
              className="py-2 px-3 text-sm bg-[#1e1e1e] text-[#d0d0d0] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c9a84c]/40 focus:border-[#c9a84c] cursor-pointer min-w-[120px]"
            >
              <option value="All">All Types</option>
              {allTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            {/* Config */}
            <select
              value={configFilter}
              onChange={(e) => { setConfigFilter(e.target.value); resetPage(); }}
              className="py-2 px-3 text-sm bg-[#1e1e1e] text-[#d0d0d0] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c9a84c]/40 focus:border-[#c9a84c] cursor-pointer min-w-[130px]"
            >
              <option value="All">All Configs</option>
              {allConfigs.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Realtor */}
            <select
              value={realtorFilter}
              onChange={(e) => { setRealtorFilter(e.target.value); resetPage(); }}
              className="py-2 px-3 text-sm bg-[#1e1e1e] text-[#d0d0d0] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c9a84c]/40 focus:border-[#c9a84c] cursor-pointer min-w-[130px]"
            >
              <option value="All">All Realtors</option>
              {allRealtors.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            {/* District / Zone */}
            <select
              value={zoneFilter}
              onChange={(e) => { setZoneFilter(e.target.value); resetPage(); }}
              className="py-2 px-3 text-sm bg-[#1e1e1e] text-[#d0d0d0] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c9a84c]/40 focus:border-[#c9a84c] cursor-pointer min-w-[130px]"
            >
              <option value="All">All Districts</option>
              {allZones.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>

            {/* Min Rent */}
            <input
              type="number"
              min={0}
              placeholder={`Min rent`}
              value={minRent}
              onChange={(e) => { setMinRent(e.target.value); resetPage(); }}
              className="py-2 px-3 text-sm bg-[#1e1e1e] text-[#d0d0d0] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c9a84c]/40 focus:border-[#c9a84c] placeholder:text-[#505050] w-28 tabular-nums"
            />

            {/* Max Rent */}
            <input
              type="number"
              min={0}
              placeholder={`Max rent`}
              value={maxRent}
              onChange={(e) => { setMaxRent(e.target.value); resetPage(); }}
              className="py-2 px-3 text-sm bg-[#1e1e1e] text-[#d0d0d0] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c9a84c]/40 focus:border-[#c9a84c] placeholder:text-[#505050] w-28 tabular-nums"
            />

            {/* Inline Clear */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="py-2 px-3 text-sm text-[#888888] hover:text-[#c9a84c] transition-colors whitespace-nowrap"
              >
                Clear
              </button>
            )}

          </div>

          {/* ── Summary row ── */}
          <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-[#606060]">
              Showing{' '}
              <strong className="text-[#c0c0c0] font-semibold">{filteredUnits.length}</strong>
              {' '}of{' '}
              <strong className="text-[#505050] font-semibold">{units.length}</strong>
              {' '}units
              {(minRent !== '' || maxRent !== '') && (
                <span className="ml-1 text-[#505050]">
                  · Rent{minRent !== '' ? ` ≥ QAR ${Number(minRent).toLocaleString()}` : ''}
                  {maxRent !== '' ? ` ≤ QAR ${Number(maxRent).toLocaleString()}` : ''}
                </span>
              )}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-[#c9a84c] hover:text-[#dfc070] underline underline-offset-2 hover:no-underline transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>

        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION C: TABULAR DATA PRESENTATION ARRAY
        ══════════════════════════════════════════════════════════════════════ */}
        {loading ? (
          <div className="bg-[#181818] rounded-xl border border-[#2a2a2a] p-12 flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
            <p className="text-[#505050] text-sm">Loading units from database…</p>
          </div>
        ) : (
        <div className="bg-[#181818] rounded-xl border border-[#2a2a2a] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#111111] border-b border-[#252525]">
                  {([
                    ['Realtor',       'text-left'],
                    ['Property / Unit','text-left'],
                    ['Zone / District','text-left'],
                    ['Type · Config',  'text-left'],
                    ['Bath',           'text-left'],
                    ['P',              'text-center'],
                    ['Kitchen',        'text-left'],
                    ['Furnishing',     'text-left'],
                    ['Rent (QAR/mo)',  'text-right'],
                    ['Status',         'text-left'],
                    ['',               'text-center'],
                  ] as [string, string][]).map(([col, align], i) => (
                    <th key={i} className={`px-2.5 py-2.5 text-[10px] font-semibold text-[#505050] uppercase tracking-wider whitespace-nowrap ${align}`}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedUnits.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-14 text-center">
                      <p className="text-[#505050] text-sm">No units match the current filter combination.</p>
                      {hasActiveFilters && (
                        <button onClick={clearFilters} className="mt-2 text-sm text-[#c9a84c] underline underline-offset-2 hover:no-underline">
                          Clear filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  paginatedUnits.map((unit) => (
                    <tr
                      key={unit.id}
                      onClick={() => handleViewDetails(unit)}
                      className="border-b border-[#222222] last:border-0 hover:bg-[#1e1e1e] transition-colors cursor-pointer"
                    >
                      {/* Realtor */}
                      <td className="px-2.5 py-2.5 whitespace-nowrap max-w-[130px]" title={unit.realtorName}>
                        <span className="text-xs text-[#888888] truncate block">{unit.realtorName}</span>
                        <span className="text-[10px] font-mono text-[#444444]">{unit.realtorMOCI}</span>
                      </td>

                      {/* Property / Unit — combined */}
                      <td className="px-2.5 py-2.5 max-w-[180px]" title={unit.property}>
                        <span className="block text-xs font-semibold text-white leading-snug truncate">{unit.property}</span>
                        <span className="block text-[10px] font-mono text-[#555555] mt-0.5">{unit.unitNo}</span>
                      </td>

                      {/* Zone / District — combined */}
                      <td className="px-2.5 py-2.5 whitespace-nowrap">
                        <span className="block text-xs font-bold text-[#c9a84c] font-mono">Z-{unit.zoneCode}</span>
                        <span className="block text-[10px] text-[#555555] mt-0.5 max-w-[120px] truncate">{unit.zone}</span>
                      </td>

                      {/* Type · Config — combined */}
                      <td className="px-2.5 py-2.5 whitespace-nowrap">
                        <span className="text-xs text-[#888888]">{unit.type}</span>
                        <span className="text-[10px] text-[#444444]"> · </span>
                        <span className="text-xs font-medium text-[#c0c0c0]">{unit.config}</span>
                      </td>

                      {/* Bath */}
                      <td className="px-2.5 py-2.5 whitespace-nowrap">
                        <BathCell n={unit.bathrooms} />
                      </td>

                      {/* Parking */}
                      <td className="px-2.5 py-2.5 text-center whitespace-nowrap">
                        <ParkingCell has={unit.parking} />
                      </td>

                      {/* Kitchen */}
                      <td className="px-2.5 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${KITCHEN_BADGE[unit.kitchen]}`}>
                          {unit.kitchen}
                        </span>
                      </td>

                      {/* Furnishing */}
                      <td className="px-2.5 py-2.5 whitespace-nowrap">
                        <span className="text-xs text-[#888888]">
                          {unit.furnishing === 'Fully Furnished' ? 'Fully Furn.' : unit.furnishing === 'Semi-Furnished' ? 'Semi-Furn.' : 'Unfurnished'}
                        </span>
                      </td>

                      {/* Rent */}
                      <td className="px-2.5 py-2.5 text-right whitespace-nowrap">
                        <span className="text-xs font-bold text-white">{formatQAR(unit.rent)}</span>
                      </td>

                      {/* Status */}
                      <td className="px-2.5 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE[unit.status].classes}`}>
                          {STATUS_BADGE[unit.status].label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-2 py-2.5 text-center w-8">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEllipsisClick(e, unit); }}
                          aria-label={`Actions for ${unit.unitNo}`}
                          className={`w-6 h-6 rounded-md flex items-center justify-center text-base leading-none transition-colors mx-auto ${
                            contextMenu?.unit.id === unit.id
                              ? 'bg-[#c9a84c] text-[#0f0f0f]'
                              : 'text-[#505050] hover:text-[#c9a84c] hover:bg-[#2a2a2a]'
                          }`}
                        >
                          ⋮
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── PAGINATION CONTROLS ── */}
          {totalPages > 1 && (
            <div className="border-t border-[#252525] px-4 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-[#555555] order-2 sm:order-1">
                Page <strong className="font-semibold text-slate-700">{currentPage}</strong> of{' '}
                <strong className="font-semibold text-slate-700">{totalPages}</strong> ·{' '}
                {filteredUnits.length} units · {ROWS_PER_PAGE} per page
              </p>

              <div className="flex items-center gap-1 order-1 sm:order-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-xs font-medium bg-[#1e1e1e] text-slate-300 border border-[#2a2a2a] rounded-lg hover:bg-[#2a2a2a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ← Prev
                </button>

                {pageNumbers.map((p, i) =>
                  p === '…' ? (
                    <span key={`ellipsis-${i}`} className="w-8 text-center text-[#444444] text-sm">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p as number)}
                      className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors ${
                        currentPage === p
                          ? 'bg-[#c9a84c] text-[#0f0f0f] font-bold'
                          : 'border border-[#2a2a2a] bg-[#1e1e1e] text-slate-400 hover:bg-[#2a2a2a]'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
        )} {/* end loading conditional */}

        {/* Footer note */}
        <p className="text-center text-xs text-[#333333] pb-4">
          Privé Group RE-IMS · Qatar Property Portfolio · {units.length} active listings
        </p>
      </main>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION D: ABSOLUTE POSITIONED FLOATING CONTEXT MENU OVERLAY
      ══════════════════════════════════════════════════════════════════════ */}
      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onViewDetails={handleViewDetails}
          onWhatsApp={handleWhatsApp}
          onEmail={handleEmail}
          onDuplicate={handleDuplicate}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION E: UNIT DETAILS MODAL (SLIDE-OUT)
      ══════════════════════════════════════════════════════════════════════ */}
      {selectedUnit && (
        <UnitDetailsModal
          unit={selectedUnit}
          onClose={() => setSelectedUnit(null)}
        />
      )}

      {/* ── Toast notification ────────────────────────────────────────────── */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '28px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 18px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 500,
            boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
            background: toast.type === 'success' ? '#14532d' : '#450a0a',
            border: `1px solid ${toast.type === 'success' ? '#16a34a' : '#b91c1c'}`,
            color: toast.type === 'success' ? '#bbf7d0' : '#fecaca',
            whiteSpace: 'nowrap',
            maxWidth: '90vw',
          }}
        >
          <span>{toast.type === 'success' ? '✓' : '✕'}</span>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
