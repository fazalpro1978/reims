'use client';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — INTEGRATED SLIDE-OUT "VIEW DETAILS" INSPECTION SUITE
// Privé Group RE-IMS · Unit Details Modal
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { UnitListing, Status, Furnishing, KitchenType } from '../types/inventory';

type TabId = 'property' | 'financials' | 'commission' | 'operational';

interface UnitDetailsModalProps {
  unit: UnitListing;
  onClose: () => void;
}

// ── Shared helpers ─────────────────────────────────────────────────────────

const formatQAR = (n: number) => `QAR ${n.toLocaleString('en-US')}`;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

const STATUS_BADGE: Record<Status, string> = {
  [Status.Available]: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-600/20',
  [Status.Leased]: 'bg-orange-100 text-orange-800 ring-1 ring-orange-600/20',
  [Status.Reserved]: 'bg-blue-100 text-blue-800 ring-1 ring-blue-600/20',
  [Status.Under_Maintenance]: 'bg-purple-100 text-purple-800 ring-1 ring-purple-600/20',
};

const FURNISHING_BADGE: Record<Furnishing, string> = {
  [Furnishing.Fully_Furnished]: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20',
  [Furnishing.Semi_Furnished]: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20',
  [Furnishing.Unfurnished]: 'bg-slate-100 text-slate-600 ring-1 ring-slate-500/20',
};

const KITCHEN_BADGE: Record<KitchenType, string> = {
  Open:   'border border-emerald-300 text-emerald-700 bg-emerald-50',
  Closed: 'border border-rose-300   text-rose-700   bg-rose-50',
  Yes:    'border border-green-300  text-green-700  bg-green-50',
  Pantry: 'border border-amber-300  text-amber-700  bg-amber-50',
};

const MOCI_BADGE: Record<string, string> = {
  REGISTERED: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-600/20',
  PENDING: 'bg-amber-100 text-amber-800 ring-1 ring-amber-600/20',
  RENEWAL_DUE: 'bg-orange-100 text-orange-800 ring-1 ring-orange-600/20',
  EXPIRED: 'bg-red-100 text-red-800 ring-1 ring-red-600/20',
  DRAFT: 'bg-slate-100 text-slate-600 ring-1 ring-slate-500/20',
};

// ── Layout primitives ──────────────────────────────────────────────────────

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-3 border-b border-gray-100 last:border-0">
      <dt className="sm:w-48 shrink-0 text-xs font-semibold text-slate-500 uppercase tracking-wide pt-0.5">
        {label}
      </dt>
      <dd className="flex-1 text-sm text-slate-900">{value}</dd>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-gray-200">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</h3>
      </div>
      <dl className="px-4">{children}</dl>
    </div>
  );
}

// ── Tab A: Property & Unit ─────────────────────────────────────────────────

function PropertyTab({ unit }: { unit: UnitListing }) {
  return (
    <div className="space-y-4">
      <SectionCard title="Identification">
        <FieldRow
          label="Realtor"
          value={<strong className="font-semibold">{unit.realtorName}</strong>}
        />
        <FieldRow
          label="MOCI License"
          value={
            <span className="font-mono text-sm bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded">
              {unit.realtorMOCI}
            </span>
          }
        />
        <FieldRow label="Property Name" value={<strong className="font-semibold">{unit.property}</strong>} />
        <FieldRow label="Unit Number" value={<span className="font-mono">{unit.unitNo}</span>} />
        <FieldRow label="District / Area" value={<strong className="font-semibold">{unit.zone}</strong>} />
        <FieldRow label="Zone Code" value={
          <span className="font-mono text-sm bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded">
            Zone {unit.zoneCode}
          </span>
        } />
      </SectionCard>
      <SectionCard title="Classification">
        <FieldRow label="Unit Type" value={unit.type} />
        <FieldRow label="Config" value={<strong className="font-semibold">{unit.config}</strong>} />
        <FieldRow label="Bathrooms" value={
          <span className="font-mono text-sm">{unit.bathrooms % 1 === 0 ? unit.bathrooms : unit.bathrooms.toFixed(1)}</span>
        } />
        <FieldRow label="Parking" value={
          unit.parking
            ? <span className="inline-flex items-center gap-1 text-emerald-700 text-sm font-medium">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
                Included
              </span>
            : <span className="text-slate-400 text-sm">Not included</span>
        } />
        <FieldRow label="Kitchen" value={
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${KITCHEN_BADGE[unit.kitchen]}`}>
            {unit.kitchen}
          </span>
        } />
        <FieldRow
          label="Furnishing State"
          value={
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${FURNISHING_BADGE[unit.furnishing]}`}>
              {unit.furnishing}
            </span>
          }
        />
        <FieldRow label="Listing Type" value={unit.listingType} />
        <FieldRow
          label="Current Status"
          value={
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[unit.status]}`}>
              {unit.status.replace('_', ' ')}
            </span>
          }
        />
      </SectionCard>
      <SectionCard title="External Links">
        <FieldRow
          label="Location Map"
          value={
            <a href={unit.locationMapUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline text-sm">
              Open in Google Maps
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          }
        />
        <FieldRow
          label="Media Assets"
          value={
            <a href={unit.mediaUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline text-sm">
              View Media Library
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          }
        />
      </SectionCard>
    </div>
  );
}

// ── Tab B: Financials ──────────────────────────────────────────────────────

function FinancialsTab({ unit }: { unit: UnitListing }) {
  const firstMonthTotal =
    unit.rent + unit.agencyFee + unit.depositAmount + unit.serviceCharges;

  const lineItems = [
    {
      label: 'Monthly Rent',
      amount: unit.rent,
      note: '/ month',
      highlight: true,
    },
    {
      label: 'Contract Charges',
      amount: unit.agencyFee,
      note: `${unit.agencyFeePercentage}% agency fee`,
      highlight: false,
    },
    {
      label: 'Security Deposit',
      amount: unit.depositAmount,
      note: `${(unit.depositAmount / unit.rent).toFixed(1)} months' rent`,
      highlight: false,
    },
    {
      label: 'Additional Charges',
      amount: unit.serviceCharges,
      note: 'service & utilities / month',
      highlight: false,
    },
  ];

  return (
    <div className="space-y-4">

      {/* ── Rent & Charges breakdown ── */}
      <SectionCard title="Rent & Charges">
        {lineItems.map(({ label, amount, note, highlight }) => (
          <FieldRow
            key={label}
            label={label}
            value={
              <div className="flex items-baseline gap-2">
                <span className={highlight
                  ? 'text-lg font-bold text-slate-900'
                  : 'font-semibold text-slate-800'}>
                  {formatQAR(amount)}
                </span>
                {note && (
                  <span className="text-xs text-slate-400">{note}</span>
                )}
              </div>
            }
          />
        ))}
      </SectionCard>

      {/* ── 1st Month Payment Banner ── */}
      <div className="rounded-xl overflow-hidden shadow-sm">
        {/* Banner header */}
        <div className="bg-amber-500 px-5 py-3 flex items-center justify-between">
          <div>
            <p className="text-amber-950 text-xs font-bold uppercase tracking-wider">
              Move-In Payment Summary
            </p>
            <p className="text-amber-900 text-[11px] mt-0.5 opacity-80">
              Total amount due upon lease signing
            </p>
          </div>
          <svg className="w-7 h-7 text-amber-800 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75" />
          </svg>
        </div>

        {/* Banner body */}
        <div className="bg-slate-900 px-5 py-5">
          {/* Total figure */}
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-slate-400 text-[11px] uppercase tracking-widest">
                Total 1st Month to Pay
              </p>
              <p className="text-white text-2xl font-bold mt-1 tabular-nums">
                {formatQAR(firstMonthTotal)}
              </p>
            </div>
            <span className="text-slate-600 text-xs font-mono">QAR</span>
          </div>

          {/* Breakdown grid */}
          <div className="border-t border-slate-700 pt-3 space-y-2">
            {lineItems.map(({ label, amount }) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{label}</span>
                <span className="text-slate-300 font-medium tabular-nums">
                  {formatQAR(amount)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between text-xs pt-2 mt-1 border-t border-slate-700">
              <span className="text-slate-300 font-semibold uppercase tracking-wider">Total</span>
              <span className="text-amber-400 font-bold tabular-nums">
                {formatQAR(firstMonthTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

// ── Tab C: Commission & Legal ──────────────────────────────────────────────

function CommissionTab({ unit }: { unit: UnitListing }) {
  return (
    <div className="space-y-4">
      <SectionCard title="Agency Commission">
        <FieldRow
          label="Agency Fee"
          value={<span className="font-semibold">{formatQAR(unit.agencyFee)}</span>}
        />
        <FieldRow
          label="Fee Percentage"
          value={`${unit.agencyFeePercentage}% of annual rent`}
        />
        <FieldRow
          label="Annual Rent Basis"
          value={formatQAR(unit.rent * 12)}
        />
      </SectionCard>
      <SectionCard title="MOCI Contract Registration">
        <FieldRow
          label="Registration Status"
          value={
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${MOCI_BADGE[unit.mociContractStatus] ?? 'bg-gray-100 text-gray-700'}`}>
              {unit.mociContractStatus}
            </span>
          }
        />
        <FieldRow
          label="Contract Number"
          value={<span className="font-mono text-sm">{unit.mociContractNumber}</span>}
        />
      </SectionCard>
      <SectionCard title="Legal Duration & Conditions">
        <FieldRow label="Contract Duration" value={unit.legalDuration} />
        <FieldRow label="Listed Date" value={formatDate(unit.listedDate)} />
        <FieldRow label="Last Updated" value={formatDate(unit.lastUpdated)} />
      </SectionCard>
    </div>
  );
}

// ── Tab D: Operational ────────────────────────────────────────────────────

function OperationalTab({ unit }: { unit: UnitListing }) {
  return (
    <div className="space-y-4">
      <SectionCard title="Maintenance Notes">
        <FieldRow
          label="Current Notes"
          value={
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {unit.maintenanceNotes}
            </p>
          }
        />
      </SectionCard>
      <SectionCard title="Access &amp; Security">
        <FieldRow
          label="Lockbox / Access Code"
          value={
            <span className="inline-flex items-center gap-2 font-mono text-sm bg-amber-50 text-amber-900 border border-amber-200 px-3 py-1.5 rounded-lg">
              <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              {unit.accessLockbox}
            </span>
          }
        />
      </SectionCard>
      <SectionCard title="Asset History Tracking">
        {unit.assetHistoryLinks.length === 0 ? (
          <div className="py-4 text-center text-sm text-slate-400">No asset history documents linked.</div>
        ) : (
          unit.assetHistoryLinks.map((link, i) => (
            <FieldRow
              key={i}
              label={`Asset Record ${i + 1}`}
              value={
                <a href={link} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline text-sm">
                  View Document
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              }
            />
          ))
        )}
      </SectionCard>
    </div>
  );
}

// ── Main modal component ───────────────────────────────────────────────────

const TABS: { id: TabId; label: string }[] = [
  { id: 'property', label: 'Property & Unit' },
  { id: 'financials', label: 'Financials' },
  { id: 'commission', label: 'Commission & Legal' },
  { id: 'operational', label: 'Operational' },
];

export default function UnitDetailsModal({ unit, onClose }: UnitDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('property');
  const [visible, setVisible] = useState(false);

  // Animate in
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Close with slide-out animation
  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 280);
  };

  // ESC key support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Build share payload
  const sharePayload =
    `Property: ${unit.property}\n` +
    `Unit: ${unit.unitNo} | District: ${unit.zone} (Zone ${unit.zoneCode})\n` +
    `Type: ${unit.type} · ${unit.config} | ${unit.furnishing}\n` +
    `Rent: QAR ${unit.rent.toLocaleString()}/month\n` +
    `Status: ${unit.status.replace('_', ' ')}\n` +
    `Realtor: ${unit.realtorName} (${unit.realtorMOCI})`;

  const handleWhatsApp = () =>
    window.open(`https://wa.me/?text=${encodeURIComponent(sharePayload)}`, '_blank');

  const handleEmail = () => {
    const subject = encodeURIComponent(`Property Details: ${unit.property} – Unit ${unit.unitNo}`);
    const body = encodeURIComponent(sharePayload);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Slide panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Unit details: ${unit.property} ${unit.unitNo}`}
        className={`fixed inset-y-0 right-0 z-50 flex flex-col w-full max-w-2xl bg-white shadow-2xl transition-transform duration-[280ms] ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* ── Header ── */}
        <div className="shrink-0 bg-slate-900 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[unit.status]}`}>
                  {unit.status.replace('_', ' ')}
                </span>
                <span className="text-slate-400 text-xs font-mono">{unit.unitNo}</span>
                <span className="text-slate-600 text-xs">·</span>
                <span className="text-slate-400 text-xs">{unit.zone}</span>
                <span className="text-slate-600 text-xs font-mono">Z{unit.zoneCode}</span>
              </div>
              <h2 className="text-white text-xl font-semibold mt-2 truncate">{unit.property}</h2>
              <p className="text-slate-400 text-sm mt-0.5">
                {unit.type} · {unit.config} · {unit.furnishing}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="shrink-0 w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              aria-label="Close panel"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Top Share Action Bar ── */}
        <div className="shrink-0 bg-slate-800 border-b border-slate-700 px-6 py-3 flex items-center gap-3 overflow-x-auto">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
            Quick Share:
          </span>
          <button
            onClick={handleWhatsApp}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
            WhatsApp
          </button>
          <button
            onClick={handleEmail}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Email
          </button>
          <div className="flex-1" />
          <span className="text-slate-500 text-xs font-mono whitespace-nowrap hidden sm:block">
            {unit.realtorMOCI}
          </span>
        </div>

        {/* ── Tab Navigation ── */}
        <div className="shrink-0 border-b border-gray-200 bg-white px-6">
          <nav className="flex gap-1 overflow-x-auto" role="tablist">
            {TABS.map((tab, i) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-1 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="w-5 h-5 rounded-full text-xs flex items-center justify-center bg-slate-100 text-slate-500 font-semibold shrink-0">
                  {i + 1}
                </span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Tab Content (scrollable) ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5" role="tabpanel">
          {activeTab === 'property' && <PropertyTab unit={unit} />}
          {activeTab === 'financials' && <FinancialsTab unit={unit} />}
          {activeTab === 'commission' && <CommissionTab unit={unit} />}
          {activeTab === 'operational' && <OperationalTab unit={unit} />}
        </div>

        {/* ── Footer Share Action Bar ── */}
        <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-6 py-4">
          <p className="text-xs text-slate-400 mb-3 font-medium">
            Auto-generated payload:{' '}
            <span className="text-slate-600 italic">
              Property: {unit.property}, Unit: {unit.unitNo}, Rent: QAR {unit.rent.toLocaleString()}/month
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleWhatsApp}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-4 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
              Share via WhatsApp
            </button>
            <button
              onClick={handleEmail}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Send via Email
            </button>
            <a
              href={unit.locationMapUrl} target="_blank" rel="noopener noreferrer"
              className="px-4 py-2.5 flex items-center justify-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 border border-gray-300 rounded-lg hover:bg-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Maps
            </a>
            <a
              href={unit.mediaUrl} target="_blank" rel="noopener noreferrer"
              className="px-4 py-2.5 flex items-center justify-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 border border-gray-300 rounded-lg hover:bg-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Media
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
