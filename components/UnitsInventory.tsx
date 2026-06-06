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
  StatusFilter,
  FurnishingFilter,
  ContextMenuPosition,
} from '../types/inventory';
import { mockUnits } from '../lib/mockData';
import UnitDetailsModal from './UnitDetailsModal';

// ── Constants ──────────────────────────────────────────────────────────────

const ROWS_PER_PAGE = 50;

const STATUS_BADGE: Record<Status, { label: string; classes: string }> = {
  [Status.Available]: {
    label: 'Available',
    classes: 'bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-600/20',
  },
  [Status.Leased]: {
    label: 'Leased',
    classes: 'bg-orange-100 text-orange-800 ring-1 ring-inset ring-orange-600/20',
  },
  [Status.Reserved]: {
    label: 'Reserved',
    classes: 'bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-600/20',
  },
  [Status.Under_Maintenance]: {
    label: 'Maintenance',
    classes: 'bg-purple-100 text-purple-800 ring-1 ring-inset ring-purple-600/20',
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

const KITCHEN_BADGE: Record<KitchenType, string> = {
  Open:   'border border-emerald-300 text-emerald-700 bg-emerald-50',
  Closed: 'border border-rose-300   text-rose-700   bg-rose-50',
  Yes:    'border border-green-300  text-green-700  bg-green-50',
  Pantry: 'border border-amber-300  text-amber-700  bg-amber-50',
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
        <span key={i} className="text-blue-400"><IconShower /></span>
      ))}
      {full > 4 && <span className="text-[10px] text-slate-400">+{full - 4}</span>}
      {half && <span className="text-slate-400"><IconToilet /></span>}
      <span className="ml-1 text-sm text-slate-700">{n % 1 === 0 ? n : n.toFixed(1)}</span>
    </div>
  );
}

function ParkingCell({ has }: { has: boolean }) {
  return has ? (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-emerald-100 text-emerald-600">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
      </svg>
    </span>
  ) : (
    <span className="text-slate-300 text-base leading-none select-none">—</span>
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
      className={`group text-left bg-white rounded-xl border px-5 py-4 transition-all duration-150 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
        isActive ? `${accentRing} shadow-md` : 'border-gray-200'
      }`}
    >
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-bold mt-1.5 tabular-nums ${valueColor}`}>{count}</p>
      {isActive && (
        <div className={`mt-2 h-0.5 w-8 rounded-full ${valueColor.replace('text-', 'bg-')}`} />
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
}

function ContextMenu({ menu, onClose, onViewDetails, onWhatsApp, onEmail }: ContextMenuProps) {
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
    extraClass = ''
  ) => (
    <button
      onClick={() => { onClick(); onClose(); }}
      className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors text-left hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50 ${extraClass}`}
    >
      <span className="shrink-0 text-slate-400">{icon}</span>
      {label}
    </button>
  );

  const linkItem = (
    icon: React.ReactNode,
    label: string,
    href: string
  ) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClose}
      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
    >
      <span className="shrink-0 text-slate-400">{icon}</span>
      {label}
    </a>
  );

  return (
    <div
      ref={ref}
      style={{ top: menu.y, left: menu.x }}
      className="fixed z-50 w-56 bg-white rounded-xl shadow-[0_8px_32px_-4px_rgba(0,0,0,0.18)] border border-gray-200 py-1.5 overflow-hidden"
      role="menu"
    >
      {item(<IconEye />, 'View Details', () => onViewDetails(menu.unit), 'text-slate-700 font-medium')}
      {item(<IconEdit />, 'Edit Unit', () => {}, 'text-slate-700')}
      {item(<IconCopy />, 'Duplicate', () => {}, 'text-slate-700')}

      <div className="my-1 mx-1 border-t border-gray-100" />

      {linkItem(<IconMap />, 'Maps', menu.unit.locationMapUrl)}
      {linkItem(<IconMedia />, 'Media', menu.unit.mediaUrl)}

      <div className="my-1 mx-1 border-t border-gray-100" />
      <p className="px-3.5 pt-1 pb-0.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        Share
      </p>

      <button
        onClick={() => { onWhatsApp(menu.unit); onClose(); }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
      >
        <span className="text-[#25D366]"><IconWhatsApp /></span>
        WhatsApp
      </button>
      {item(<IconPDF />, 'PDF Report', () => {}, 'text-slate-700')}
      {item(<IconMail />, 'Email', () => onEmail(menu.unit), 'text-slate-700')}

      <div className="my-1 mx-1 border-t border-gray-100" />

      {item(
        <IconTrash />,
        'Delete',
        () => {},
        'text-red-600 font-medium hover:!bg-red-50 [&_span]:!text-red-400'
      )}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────

export default function UnitsInventory() {
  // ── Filter state ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [furnishingFilter, setFurnishingFilter] = useState<FurnishingFilter>('All');
  const [zoneFilter, setZoneFilter] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);

  // ── Modal / context menu state ─────────────────────────────────────────────
  const [selectedUnit, setSelectedUnit] = useState<UnitListing | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null);

  // ── Derived data ──────────────────────────────────────────────────────────

  const allZones = useMemo(
    () => Array.from(new Set(mockUnits.map((u) => u.zone))).sort(),
    []
  );

  // Full-dataset metrics (not filtered, so metric cards always show totals)
  const metrics = useMemo(
    () => ({
      total: mockUnits.length,
      available: mockUnits.filter((u) => u.status === Status.Available).length,
      leased: mockUnits.filter((u) => u.status === Status.Leased).length,
      reserved: mockUnits.filter((u) => u.status === Status.Reserved).length,
      maintenance: mockUnits.filter((u) => u.status === Status.Under_Maintenance).length,
    }),
    []
  );

  const filteredUnits = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mockUnits.filter((u) => {
      const matchSearch =
        !q ||
        u.property.toLowerCase().includes(q) ||
        u.unitNo.toLowerCase().includes(q) ||
        u.realtorName.toLowerCase().includes(q) ||
        u.realtorMOCI.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'All' || u.status === statusFilter;
      const matchFurnishing = furnishingFilter === 'All' || u.furnishing === furnishingFilter;
      const matchZone = zoneFilter === 'All' || u.zone === zoneFilter;
      return matchSearch && matchStatus && matchFurnishing && matchZone;
    });
  }, [search, statusFilter, furnishingFilter, zoneFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUnits.length / ROWS_PER_PAGE));
  const paginatedUnits = filteredUnits.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE
  );

  // Reset to page 1 whenever filters change
  const resetPage = useCallback(() => setCurrentPage(1), []);

  const hasActiveFilters =
    search !== '' ||
    statusFilter !== 'All' ||
    furnishingFilter !== 'All' ||
    zoneFilter !== 'All';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('All');
    setFurnishingFilter('All');
    setZoneFilter('All');
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
    const subject = encodeURIComponent(`Property: ${unit.property} — Unit ${unit.unitNo}`);
    const body = encodeURIComponent(generateShareText(unit));
    window.open(`mailto:?subject=${subject}&body=${body}`);
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
    <div className="min-h-screen bg-slate-50">

      {/* ── HEADER ── */}
      <header className="bg-slate-900 sticky top-0 z-30 border-b border-slate-800">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-400 rounded flex items-center justify-center shrink-0">
              <span className="text-slate-900 font-black text-sm select-none">P</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-white font-semibold text-base leading-tight truncate">
                Privé Group
              </h1>
              <p className="text-slate-400 text-[11px] leading-tight hidden sm:block">
                Real Estate Information Management System
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-400 text-xs hidden md:block">Admin Console</span>
            <div className="w-7 h-7 rounded-full bg-amber-400/20 border border-amber-400/30 flex items-center justify-center">
              <span className="text-amber-400 text-xs font-bold">A</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── PAGE TITLE ── */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Units Inventory</h2>
          <p className="text-slate-500 text-sm mt-0.5">
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
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Unified search */}
            <div className="relative flex-1 min-w-0">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <IconSearch />
              </span>
              <input
                type="text"
                placeholder="Search by Property, Unit No., or Realtor name…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); resetPage(); }}
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/30 focus:border-slate-500 placeholder:text-slate-400 transition-shadow"
              />
            </div>

            {/* Status dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); resetPage(); }}
              className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/30 focus:border-slate-500 min-w-[150px] cursor-pointer"
            >
              <option value="All">All Statuses</option>
              {Object.values(Status).map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>

            {/* Furnishing dropdown */}
            <select
              value={furnishingFilter}
              onChange={(e) => { setFurnishingFilter(e.target.value as FurnishingFilter); resetPage(); }}
              className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/30 focus:border-slate-500 min-w-[165px] cursor-pointer"
            >
              <option value="All">All Furnishing</option>
              {Object.values(Furnishing).map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>

            {/* Zone dropdown */}
            <select
              value={zoneFilter}
              onChange={(e) => { setZoneFilter(e.target.value); resetPage(); }}
              className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/30 focus:border-slate-500 min-w-[150px] cursor-pointer"
            >
              <option value="All">All Districts</option>
              {allZones.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </div>

          {/* Filter summary row */}
          <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-slate-500">
              Showing{' '}
              <strong className="text-slate-700 font-semibold">{filteredUnits.length}</strong>{' '}
              of{' '}
              <strong className="text-slate-700 font-semibold">{mockUnits.length}</strong>{' '}
              units
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-slate-500 hover:text-slate-900 underline underline-offset-2 hover:no-underline transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION C: TABULAR DATA PRESENTATION ARRAY
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1680px] border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200">
                  {[
                    'Realtor',
                    'Property',
                    'Unit No.',
                    'District / Area',
                    'Type',
                    'Config',
                    'Bath',
                    'Parking',
                    'Kitchen',
                    'Furnishing',
                    'Rent (QAR/mo)',
                    'Status',
                    'Location',
                    'Media',
                    '',
                  ].map((col, i) => (
                    <th
                      key={i}
                      className={`px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap ${
                        col === 'Rent (QAR/mo)' ? 'text-right'
                        : col === 'Location' || col === 'Media' || col === '' || col === 'Parking' ? 'text-center'
                        : 'text-left'
                      }`}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedUnits.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="px-4 py-14 text-center">
                      <p className="text-slate-400 text-sm">No units match the current filter combination.</p>
                      {hasActiveFilters && (
                        <button
                          onClick={clearFilters}
                          className="mt-2 text-sm text-slate-900 underline underline-offset-2 hover:no-underline"
                        >
                          Clear filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  paginatedUnits.map((unit) => (
                    <tr
                      key={unit.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-slate-50/60 transition-colors group"
                    >
                      {/* Realtor Name */}
                      <td className="px-4 py-3.5 text-sm text-slate-700 whitespace-nowrap max-w-[180px] truncate" title={unit.realtorName}>
                        {unit.realtorName}
                      </td>

                      {/* Property */}
                      <td className="px-4 py-3.5" title={unit.property}>
                        <span className="block text-sm font-semibold text-slate-900">
                          {unit.property.slice(0, 14)}
                        </span>
                        {unit.property.length > 14 && (
                          <span className="block text-xs text-slate-400 mt-0.5">
                            {unit.property.slice(14, 28)}{unit.property.length > 28 ? '…' : ''}
                          </span>
                        )}
                      </td>

                      {/* Unit No */}
                      <td className="px-4 py-3.5 text-xs font-mono text-slate-700 whitespace-nowrap">
                        {unit.unitNo}
                      </td>

                      {/* District / Area */}
                      <td className="px-4 py-3.5">
                        <span className="block text-sm font-bold text-slate-900 font-mono">Z-{unit.zoneCode}</span>
                        <span className="block text-xs text-slate-400 mt-0.5 max-w-[160px] leading-snug">{unit.zone}</span>
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3.5 text-sm text-slate-500 whitespace-nowrap">
                        {unit.type}
                      </td>

                      {/* Config */}
                      <td className="px-4 py-3.5 text-sm font-medium text-slate-800 whitespace-nowrap">
                        {unit.config}
                      </td>

                      {/* Bath */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <BathCell n={unit.bathrooms} />
                      </td>

                      {/* Parking */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <ParkingCell has={unit.parking} />
                      </td>

                      {/* Kitchen */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${KITCHEN_BADGE[unit.kitchen]}`}>
                          {unit.kitchen}
                        </span>
                      </td>

                      {/* Furnishing */}
                      <td className="px-4 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                        {unit.furnishing}
                      </td>

                      {/* Rent */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <span className="text-sm font-bold text-slate-900">{formatQAR(unit.rent)}</span>
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[unit.status].classes}`}>
                          {STATUS_BADGE[unit.status].label}
                        </span>
                      </td>

                      {/* Location Map icon */}
                      <td className="px-4 py-3.5 text-center">
                        <a
                          href={unit.locationMapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open in Google Maps"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                        >
                          <IconMap />
                        </a>
                      </td>

                      {/* Media icon */}
                      <td className="px-4 py-3.5 text-center">
                        <a
                          href={unit.mediaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View media assets"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-amber-600 hover:text-amber-800 hover:bg-amber-50 transition-colors"
                        >
                          <IconMedia />
                        </a>
                      </td>

                      {/* Action trigger — vertical ellipsis */}
                      <td className="px-3 py-3.5 text-center w-10">
                        <button
                          onClick={(e) => handleEllipsisClick(e, unit)}
                          aria-label={`Actions for ${unit.unitNo}`}
                          className={`w-7 h-7 rounded-md flex items-center justify-center text-lg leading-none transition-colors ${
                            contextMenu?.unit.id === unit.id
                              ? 'bg-slate-100 text-slate-700'
                              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
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
            <div className="border-t border-gray-200 px-4 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-slate-500 order-2 sm:order-1">
                Page <strong className="font-semibold text-slate-700">{currentPage}</strong> of{' '}
                <strong className="font-semibold text-slate-700">{totalPages}</strong> ·{' '}
                {filteredUnits.length} units · {ROWS_PER_PAGE} per page
              </p>

              <div className="flex items-center gap-1 order-1 sm:order-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Prev
                </button>

                {pageNumbers.map((p, i) =>
                  p === '…' ? (
                    <span key={`ellipsis-${i}`} className="w-8 text-center text-slate-400 text-sm">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p as number)}
                      className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors ${
                        currentPage === p
                          ? 'bg-slate-900 text-white'
                          : 'border border-gray-200 text-slate-700 hover:bg-slate-50'
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

        {/* Footer note */}
        <p className="text-center text-xs text-slate-400 pb-4">
          Privé Group RE-IMS · Qatar Property Portfolio · {mockUnits.length} active listings
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
    </div>
  );
}
