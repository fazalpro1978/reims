'use client';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — INTEGRATED SLIDE-OUT "VIEW DETAILS" INSPECTION SUITE
// Privé Group RE-IMS · Unit Details Modal
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import { UnitListing, Status, Furnishing, KitchenType, UnitType } from '../types/inventory';
import { supabase } from '../lib/supabase/client';
import { logEvent } from '../lib/auditLog';
import { DurationUnit, parseLegalDuration, calcEndDate, calcDurationFromDates } from '../lib/legalDuration';
import { generateInternalCopyText, generatePublicShareText } from '../lib/shareUtils';
import DocUploadRow from './DocUploadRow';
import CommDocRow, { DocEntry } from './CommDocRow';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function SaveBar({ status, onSave, errorMsg }: { status: SaveStatus; onSave: () => void; errorMsg?: string }) {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between gap-3 py-2.5 px-4 -mx-6 bg-[#111111] border-b border-[#2a2a2a] mb-1">
      <span className={`text-[10px] font-bold uppercase tracking-widest ${status === 'error' ? 'text-red-400' : status === 'saved' ? 'text-emerald-400' : 'text-[#666666]'}`}>
        {status === 'saving' ? 'Saving…' : status === 'saved' ? '✓ Saved to database' : status === 'error' ? `✕ ${errorMsg ?? 'Save failed'}` : 'Unsaved changes'}
      </span>
      <button
        onClick={onSave}
        disabled={status === 'saving'}
        className="px-4 py-1.5 text-xs font-bold bg-[#c9a84c] hover:bg-[#dfc070] text-[#0f0f0f] rounded-lg disabled:opacity-50 transition-colors shrink-0"
      >
        {status === 'saving' ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  );
}


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
  [Status.Available]: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-500/30',
  [Status.Leased]: 'bg-orange-500/10 text-orange-400 ring-1 ring-inset ring-orange-500/30',
  [Status.Reserved]: 'bg-blue-500/10 text-blue-400 ring-1 ring-inset ring-blue-500/30',
  [Status.Under_Maintenance]: 'bg-purple-500/10 text-purple-400 ring-1 ring-inset ring-purple-500/30',
};

const FURNISHING_BADGE: Record<Furnishing, string> = {
  [Furnishing.Fully_Furnished]: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-500/30',
  [Furnishing.Semi_Furnished]: 'bg-amber-500/10 text-amber-400 ring-1 ring-inset ring-amber-500/30',
  [Furnishing.Unfurnished]: 'bg-[#2a2a2a] text-[#888888] ring-1 ring-inset ring-[#444444]',
};

const KITCHEN_BADGE: Record<KitchenType, string> = {
  Open:   'border border-emerald-600/40 text-emerald-400 bg-emerald-500/10',
  Closed: 'border border-rose-600/40   text-rose-400   bg-rose-500/10',
  Yes:    'border border-green-600/40  text-green-400  bg-green-500/10',
  Pantry: 'border border-amber-600/40  text-amber-400  bg-amber-500/10',
};

// ── Property Registration Status ───────────────────────────────────────────

const PROPERTY_REG_STATUSES = [
  'Registered',
  'Not Registered',
  'Reserved',
  'Booked',
  'Leased',
  'Pending',
  'Expired',
] as const;

type PropertyRegStatus = typeof PROPERTY_REG_STATUSES[number];

const PROP_REG_BADGE: Record<PropertyRegStatus, string> = {
  'Registered':     'bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-500/30',
  'Not Registered': 'bg-[#2a2a2a] text-[#888888] ring-1 ring-inset ring-[#444444]',
  'Reserved':       'bg-blue-500/10 text-blue-400 ring-1 ring-inset ring-blue-500/30',
  'Booked':         'bg-purple-500/10 text-purple-400 ring-1 ring-inset ring-purple-500/30',
  'Leased':         'bg-orange-500/10 text-orange-400 ring-1 ring-inset ring-orange-500/30',
  'Pending':        'bg-amber-500/10 text-amber-400 ring-1 ring-inset ring-amber-500/30',
  'Expired':        'bg-red-500/10 text-red-400 ring-1 ring-inset ring-red-500/30',
};

const MOCI_TO_REG_STATUS: Record<string, PropertyRegStatus> = {
  REGISTERED:   'Registered',
  PENDING:      'Pending',
  RENEWAL_DUE:  'Pending',
  EXPIRED:      'Expired',
  DRAFT:        'Not Registered',
};

const ACTIVE_STATUSES = new Set<string>([
  Status.Leased,
  Status.Reserved,
  'Booked',
]);

function getDefaultRegStatus(unit: UnitListing): PropertyRegStatus {
  return ACTIVE_STATUSES.has(unit.status) ? 'Registered' : 'Not Registered';
}

// ── Static lookup data ─────────────────────────────────────────────────────

const REALTORS: { name: string; moci: string }[] = [
  { name: '25 Spaces Real Estate',        moci: 'MOCI-BRK-25S-0167' },
  { name: 'ABH Real Estate',              moci: 'MOCI-BRK-ABH-0234' },
  { name: 'Al Asmakh Real Estate',        moci: 'MOCI-BRK-ASM-0023' },
  { name: 'Alfardan Properties',          moci: 'MOCI-REG-ALP-0045' },
  { name: 'Al Jazi Real Estate',          moci: 'MOCI-IPM-AJZ-0089' },
  { name: 'Al Mana Real Estate',          moci: 'MOCI-REG-ALM-0034' },
  { name: 'Betterhomes Qatar',            moci: 'MOCI-BRK-BHQ-0067' },
  { name: 'Capital One Real Estate',      moci: 'MOCI-BRK-CAO-0156' },
  { name: 'Capstone Property',            moci: 'MOCI-BRK-CAP-0145' },
  { name: 'Coreo Real Estate',            moci: 'MOCI-BRK-CRE-0134' },
  { name: 'Corporate Real Estate Qatar',  moci: 'MOCI-BRK-CRQ-0212' },
  { name: 'Danat Qatar',                  moci: 'MOCI-IPM-DAN-0078' },
  { name: 'Direct Real Estate',           moci: 'MOCI-BRK-DRE-0178' },
  { name: 'FGREALTY Qatar',               moci: 'MOCI-BRK-FGR-0056' },
  { name: 'JMJ Group Holding',            moci: 'MOCI-REG-JMJ-0067' },
  { name: 'Maroon Homes',                 moci: 'MOCI-BRK-MRH-0245' },
  { name: 'Msheireb Properties',          moci: 'MOCI-REG-MSH-0001' },
  { name: 'NelsonPark Property',          moci: 'MOCI-BRK-NPP-0112' },
  { name: 'Premium Property Qatar',       moci: 'MOCI-BRK-PPQ-0201' },
  { name: 'The Loft Bureau Real Estate',  moci: 'MOCI-BRK-LFT-0078' },
  { name: 'The Pearl Gates',              moci: 'MOCI-BRK-TPG-0089' },
  { name: 'Unicorn Real Estate',          moci: 'MOCI-BRK-UNI-0189' },
];

const ZONE_OPTIONS: { zone: string; code: number }[] = [
  { zone: 'Al Dafna',                              code: 60 },
  { zone: 'Al Dafna / Al Qassar',                  code: 61 },
  { zone: 'Al Sadd',                               code: 38 },
  { zone: 'Hazm Al Markhiya',                      code: 67 },
  { zone: 'Jelaiah / Al Tarfa',                    code: 68 },
  { zone: 'Madinat Khalifa North / Dahl Al Hamam', code: 32 },
  { zone: 'Madinat Khalifa South',                 code: 34 },
  { zone: 'Musheireb',                             code: 4  },
];

const UNIT_CONFIGS = [
  '1 BHK', '2 BHK', '3 BHK',
  '4 BHK + Maid', '4 BHK + Maid (Private)',
  '5 BHK + Maid (Private)', 'Penthouse', 'Studio',
];

function isValidUrl(url: string): boolean {
  try { return Boolean(new URL(url)); } catch { return false; }
}

// ── Layout primitives ──────────────────────────────────────────────────────

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-3 border-b border-[#2a2a2a] last:border-0">
      <dt className="sm:w-48 shrink-0 text-xs font-semibold text-[#666666] uppercase tracking-wide pt-0.5">
        {label}
      </dt>
      <dd className="flex-1 text-sm text-[#d0d0d0]">{value}</dd>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#2a2a2a] overflow-hidden">
      <div className="px-4 py-2.5 bg-[#111111] border-b border-[#2a2a2a]">
        <h3 className="text-xs font-semibold text-[#666666] uppercase tracking-wider">{title}</h3>
      </div>
      <dl className="px-4">{children}</dl>
    </div>
  );
}

// ── Tab A: Property & Unit ─────────────────────────────────────────────────

function LockIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function PropertyTab({ unit, unitUuid, isAdmin, onRequestAdmin, onStatusSaved, onAdminLock }: {
  unit: UnitListing;
  unitUuid: string;
  isAdmin: boolean;
  onRequestAdmin: () => void;
  onStatusSaved?: (newStatus: Status) => void;
  onAdminLock?: () => void;
}) {
  const [realtorName, setRealtorName] = useState(unit.realtorName);
  const [realtorMoci, setRealtorMoci] = useState(unit.realtorMOCI);
  const [propertyName, setPropertyName] = useState(unit.property);
  const [unitNo, setUnitNo] = useState(unit.unitNo);
  const [zone, setZone] = useState(unit.zone);
  const [zoneCode, setZoneCode] = useState(unit.zoneCode);
  const [unitType, setUnitType] = useState<UnitType>(unit.type);
  const [config, setConfig] = useState(unit.config);
  const [parking, setParking] = useState(unit.parking);
  const [kitchen, setKitchen] = useState<KitchenType>(unit.kitchen);
  const [furnishing, setFurnishing] = useState<Furnishing>(unit.furnishing);
  const [status, setStatus] = useState<Status>(unit.status);
  const [locationMapUrl, setLocationMapUrl] = useState(unit.locationMapUrl);
  const [mediaUrl, setMediaUrl] = useState(unit.mediaUrl);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!unitUuid) return;
    supabase.from('units')
      .select('realtor_name,realtor_moci,property,unit_no,zone,zone_code,type,config,parking,kitchen,furnishing,status,location_map_url,media_url,amenities')
      .eq('id', unitUuid).single()
      .then(({ data }) => {
        if (!data) return;
        setRealtorName(data.realtor_name ?? unit.realtorName);
        setRealtorMoci(data.realtor_moci ?? unit.realtorMOCI);
        setPropertyName(data.property ?? unit.property);
        setUnitNo(data.unit_no ?? unit.unitNo);
        setZone(data.zone ?? unit.zone);
        setZoneCode(data.zone_code ?? unit.zoneCode);
        setUnitType((data.type as UnitType) ?? unit.type);
        setConfig(data.config ?? unit.config);
        setParking(data.parking ?? unit.parking);
        setKitchen((data.kitchen as KitchenType) ?? unit.kitchen);
        setFurnishing((data.furnishing as Furnishing) ?? unit.furnishing);
        setStatus((data.status as Status) ?? unit.status);
        setLocationMapUrl(data.location_map_url ?? unit.locationMapUrl);
        setMediaUrl(data.media_url ?? unit.mediaUrl);
        const raw = data.amenities;
        if (Array.isArray(raw)) setAmenities(raw);
        else if (typeof raw === 'string') {
          try { setAmenities(JSON.parse(raw)); } catch { /* leave empty */ }
        }
      });
  }, [unitUuid]);

  const handleRealtorChange = (name: string) => {
    setRealtorName(name);
    const r = REALTORS.find(r => r.name === name);
    if (r) setRealtorMoci(r.moci);
  };

  const handleZoneChange = (zoneName: string) => {
    setZone(zoneName);
    const z = ZONE_OPTIONS.find(z => z.zone === zoneName);
    if (z) setZoneCode(z.code);
  };

  const handleSave = async () => {
    if (!unitUuid) return;
    setSaveStatus('saving');
    setSaveError('');

    // Use service-role API route to bypass Supabase RLS on the units table
    const res = await fetch('/api/save-unit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unitUuid,
        fields: {
          realtor_name: realtorName,
          realtor_moci: realtorMoci,
          property:     propertyName,
          unit_no:      unitNo,
          zone,
          zone_code:        zoneCode,
          type:             unitType,
          config,
          parking,
          kitchen,
          furnishing,
          status,
          location_map_url: locationMapUrl || null,
          media_url:        mediaUrl || null,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setSaveError(body.error ?? `HTTP ${res.status}`);
      setSaveStatus('error');
      return;
    }

    // Amenities saved separately — column may not exist in all environments; never blocks main save
    fetch('/api/save-unit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitUuid, fields: { amenities } }),
    }).catch(() => {});

    await logEvent({ unitId: unitUuid, action: 'RECORD_SAVE', tab: 'property', payload: { realtorName, zone, unitType, config, furnishing, status } });
    if (status !== unit.status) {
      await logEvent({ unitId: unitUuid, action: 'STATUS_CHANGE', tab: 'property', field: 'Status', oldValue: unit.status, newValue: status });
      onStatusSaved?.(status);
    }
    onAdminLock?.();
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2500);
  };

  const sel = 'w-full text-sm text-[#d0d0d0] bg-[#111111] border border-[#333333] rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#c9a84c] focus:border-[#c9a84c] cursor-pointer';
  const inp = 'w-full text-sm text-[#d0d0d0] bg-[#111111] border border-[#333333] rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#c9a84c] focus:border-[#c9a84c]';

  const AdminLockButton = () => (
    <button
      type="button"
      onClick={onRequestAdmin}
      title="Admin unlock required"
      className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-[#1a1a1a] border border-[#2a2a2a] text-[#555555] rounded hover:text-[#c9a84c] hover:border-[#c9a84c]/50 transition-colors"
    >
      <LockIcon />
      Admin only
    </button>
  );

  return (
    <div className="space-y-4">
      <SaveBar status={saveStatus} onSave={handleSave} errorMsg={saveError} />

      {isAdmin && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
          <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 018 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
          </svg>
          <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Admin Mode Active</span>
          <span className="text-[10px] text-amber-600">— all fields unlocked</span>
        </div>
      )}

      <SectionCard title="Identification">

        {/* Realtor */}
        <FieldRow
          label="Realtor"
          value={
            <select value={realtorName} onChange={e => handleRealtorChange(e.target.value)} className={sel}>
              {REALTORS.map(r => <option key={r.moci} value={r.name}>{r.name}</option>)}
            </select>
          }
        />

        {/* MOCI License — admin-locked */}
        <FieldRow
          label="MOCI License"
          value={
            <div className="flex items-center gap-2 flex-wrap">
              {isAdmin ? (
                <input
                  type="text"
                  value={realtorMoci}
                  onChange={e => setRealtorMoci(e.target.value)}
                  className={`${inp} font-mono text-[#c9a84c] w-56`}
                />
              ) : (
                <>
                  <span className="font-mono text-sm bg-[#111111] text-[#c9a84c] px-2.5 py-0.5 rounded">
                    {realtorMoci}
                  </span>
                  <AdminLockButton />
                </>
              )}
            </div>
          }
        />

        {/* Property Name */}
        <FieldRow
          label="Property Name"
          value={
            <input type="text" value={propertyName}
              onChange={e => setPropertyName(e.target.value)}
              className={inp} />
          }
        />

        {/* Unit Number — admin-locked */}
        <FieldRow
          label="Unit Number"
          value={
            <div className="flex items-center gap-2">
              {isAdmin ? (
                <input
                  type="text"
                  value={unitNo}
                  onChange={e => setUnitNo(e.target.value)}
                  className={`${inp} font-mono w-40`}
                />
              ) : (
                <>
                  <span className="font-mono text-sm text-[#d0d0d0]">{unitNo}</span>
                  <AdminLockButton />
                </>
              )}
            </div>
          }
        />

        {/* District / Area — zone dropdown, auto-updates zone code */}
        <FieldRow
          label="District / Area"
          value={
            <select value={zone} onChange={e => handleZoneChange(e.target.value)} className={sel}>
              {ZONE_OPTIONS.map(z => <option key={z.code} value={z.zone}>{z.zone}</option>)}
            </select>
          }
        />

        {/* Zone Code — read-only, auto-set by zone dropdown */}
        <FieldRow
          label="Zone Code"
          value={
            <span className="font-mono text-sm bg-[#111111] text-[#c9a84c] px-2.5 py-0.5 rounded">
              Zone {zoneCode}
            </span>
          }
        />

      </SectionCard>

      <SectionCard title="Classification">

        {/* Unit Type */}
        <FieldRow
          label="Unit Type"
          value={
            <select value={unitType} onChange={e => setUnitType(e.target.value as UnitType)} className={`${sel} w-44`}>
              {Object.values(UnitType).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          }
        />

        {/* Config */}
        <FieldRow
          label="Config"
          value={
            <select value={config} onChange={e => setConfig(e.target.value)} className={`${sel} w-52`}>
              {UNIT_CONFIGS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          }
        />

        {/* Parking */}
        <FieldRow
          label="Parking"
          value={
            <div className="inline-flex rounded-lg overflow-hidden border border-[#333333] text-xs font-medium">
              <button type="button" onClick={() => setParking(true)}
                className={`px-3 py-1.5 transition-colors ${parking ? 'bg-emerald-600 text-white' : 'bg-[#1e1e1e] text-[#666666] hover:bg-[#2a2a2a]'}`}>
                Included
              </button>
              <button type="button" onClick={() => setParking(false)}
                className={`px-3 py-1.5 border-l border-[#333333] transition-colors ${!parking ? 'bg-[#3a3a3a] text-[#e0e0e0]' : 'bg-[#1e1e1e] text-[#666666] hover:bg-[#2a2a2a]'}`}>
                Not Included
              </button>
            </div>
          }
        />

        {/* Kitchen */}
        <FieldRow
          label="Kitchen"
          value={
            <select value={kitchen} onChange={e => setKitchen(e.target.value as KitchenType)} className={`${sel} w-36`}>
              {(['Open', 'Closed', 'Yes', 'Pantry'] as KitchenType[]).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          }
        />

        {/* Furnishing State */}
        <FieldRow
          label="Furnishing State"
          value={
            <select value={furnishing} onChange={e => setFurnishing(e.target.value as Furnishing)} className={`${sel} w-44`}>
              {Object.values(Furnishing).map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          }
        />

        {/* Current Status */}
        <FieldRow
          label="Current Status"
          value={
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${STATUS_BADGE[status]}`}>
                {status.replace('_', ' ')}
              </span>
              <select value={status} onChange={e => setStatus(e.target.value as Status)} className={`${sel} w-44`}>
                {Object.values(Status).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
          }
        />

        {/* Listing Type — read-only (structural field) */}
        <FieldRow label="Listing Type" value={<span className="text-sm text-[#d0d0d0]">{unit.listingType}</span>} />

        {/* Bathrooms — read-only */}
        <FieldRow label="Bathrooms" value={
          <span className="font-mono text-sm">{unit.bathrooms % 1 === 0 ? unit.bathrooms : unit.bathrooms.toFixed(1)}</span>
        } />

        {/* Amenities */}
        <div className="pt-3 pb-1">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-bold text-[#555555] uppercase tracking-[0.18em]">Amenities</span>
            {amenities.length > 0 && (
              <span className="text-[10px] font-semibold text-[#c9a84c] bg-[#c9a84c]/8 border border-[#c9a84c]/20 px-2 py-0.5 rounded-full">
                {amenities.length} selected
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {([
              'Balcony', 'Barbecue Area', 'Built-in Wardrobes', 'Central A/C',
              'Covered Parking', 'Private Gym', 'Private Jacuzzi', 'Kitchen Appliances',
              'Maids Room', 'Pets Allowed', 'Private Garden', 'Private Pool',
              'Shared Pool', 'Study', 'View of Water', 'Security',
              'Concierge', 'Shared Spa', 'Shared Gym', 'Maid Service',
              'Walk-in Closet', 'View of Landmark', "Children's Play Area",
              'Lobby in Building', "Children's Pool",
            ] as const).map(name => {
              const checked = amenities.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() =>
                    setAmenities(prev =>
                      checked ? prev.filter(a => a !== name) : [...prev, name]
                    )
                  }
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium transition-all select-none ${
                    checked
                      ? 'border-[#c9a84c]/50 bg-[#c9a84c]/8 text-[#c9a84c]'
                      : 'border-[#2a2a2a] text-[#555555] hover:border-[#444444] hover:text-[#888888]'
                  }`}
                >
                  <span
                    className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 transition-colors ${
                      checked ? 'bg-[#c9a84c] border-[#c9a84c]' : 'border-[#333333] bg-[#111111]'
                    }`}
                  >
                    {checked && (
                      <svg className="w-2 h-2" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l3 3 5-6" stroke="#0f0f0f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  {name}
                </button>
              );
            })}
          </div>
        </div>

      </SectionCard>

      <SectionCard title="External Links">

        {/* Location Map */}
        <FieldRow
          label="Location Map"
          value={
            <div className="flex flex-col gap-2 w-full">
              {locationMapUrl && isValidUrl(locationMapUrl) && (
                <a href={locationMapUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold w-fit"
                  style={{ color: '#4ade80' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#86efac')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#4ade80')}
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Open in Google Maps
                  <svg className="w-3 h-3 shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
              <input
                type="url"
                placeholder="Paste Google Maps URL…"
                value={locationMapUrl}
                onChange={e => setLocationMapUrl(e.target.value)}
                className={`${inp} font-mono text-xs text-[#888888]`}
              />
              {locationMapUrl && !isValidUrl(locationMapUrl) && (
                <span className="text-[11px] text-red-400">Invalid URL — must start with https://</span>
              )}
            </div>
          }
        />

        {/* Media Assets */}
        <FieldRow
          label="Media Assets"
          value={
            <div className="flex flex-col gap-2 w-full">
              {mediaUrl && isValidUrl(mediaUrl) && (
                <a href={mediaUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold w-fit"
                  style={{ color: '#60a5fa' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#93c5fd')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#60a5fa')}
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  View Media Library
                  <svg className="w-3 h-3 shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
              <input
                type="url"
                placeholder="Paste Dropbox, Google Drive, or OneDrive URL…"
                value={mediaUrl}
                onChange={e => setMediaUrl(e.target.value)}
                className={`${inp} font-mono text-xs text-[#888888]`}
              />
              {mediaUrl && !isValidUrl(mediaUrl) && (
                <span className="text-[11px] text-red-400">Invalid URL — must start with https://</span>
              )}
            </div>
          }
        />

      </SectionCard>
    </div>
  );
}

// ── Tab B: Financials ──────────────────────────────────────────────────────

function ApplicableToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="inline-flex rounded-lg overflow-hidden border border-[#333333] text-xs font-medium">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-3 py-1.5 transition-colors ${value ? 'bg-emerald-600 text-white' : 'bg-[#1e1e1e] text-[#666666] hover:bg-[#2a2a2a]'}`}
      >
        Applicable
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-3 py-1.5 border-l border-[#333333] transition-colors ${!value ? 'bg-[#444444] text-[#e0e0e0]' : 'bg-[#1e1e1e] text-[#666666] hover:bg-[#2a2a2a]'}`}
      >
        Not Applicable
      </button>
    </div>
  );
}

function DepositRow({ label, applicable, onToggle, amount, onAmount }: {
  label: string;
  applicable: boolean;
  onToggle: (v: boolean) => void;
  amount: number;
  onAmount: (v: number) => void;
}) {
  return (
    <FieldRow
      label={label}
      value={
        <div className="flex flex-col gap-2">
          <ApplicableToggle value={applicable} onChange={onToggle} />
          {applicable && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[#666666] select-none">QAR</span>
              <input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => onAmount(Math.max(0, Number(e.target.value)))}
                className="w-32 text-right text-sm font-semibold text-[#e0e0e0] bg-[#111111] border border-[#333333] rounded-md px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-[#c9a84c] focus:border-[#c9a84c] tabular-nums"
              />
            </div>
          )}
        </div>
      }
    />
  );
}

function FinancialsTab({ unit, unitUuid }: { unit: UnitListing; unitUuid: string }) {
  const [monthlyRent, setMonthlyRent] = useState<number>(unit.rent);
  const [contractCharges, setContractCharges] = useState<number>(unit.agencyFee);
  const [additionalCharges, setAdditionalCharges] = useState<number>(unit.serviceCharges);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!unitUuid) return;
    supabase.from('units').select('rent,agency_fee,service_charges').eq('id', unitUuid).single()
      .then(({ data }) => {
        if (!data) return;
        setMonthlyRent(Number(data.rent) ?? unit.rent);
        setContractCharges(Number(data.agency_fee) ?? unit.agencyFee);
        setAdditionalCharges(Number(data.service_charges) ?? unit.serviceCharges);
      });
  }, [unitUuid]);

  const handleSave = async () => {
    setSaveStatus('saving');
    setSaveError('');
    const res = await fetch('/api/save-unit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unitUuid,
        fields: { rent: monthlyRent, agency_fee: contractCharges, service_charges: additionalCharges },
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setSaveError(body.error ?? `HTTP ${res.status}`);
      setSaveStatus('error');
      return;
    }
    await logEvent({ unitId: unitUuid, action: 'RECORD_SAVE', tab: 'financials', payload: { monthlyRent, contractCharges, additionalCharges } });
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2500);
  };

  const [serviceUtility, setServiceUtility] = useState<boolean>(true);
  const [kahramaaApplicable, setKahramaaApplicable] = useState<boolean>(true);
  const [kahramaaAmount, setKahramaaAmount] = useState<number>(2000);
  const [qatarCoolApplicable, setQatarCoolApplicable] = useState<boolean>(true);
  const [qatarCoolAmount, setQatarCoolAmount] = useState<number>(3000);
  const [marafeqApplicable, setMarafeqApplicable] = useState<boolean>(true);
  const [marafeqAmount, setMarafeqAmount] = useState<number>(3000);

  const securityDeposit = monthlyRent; // 1 month's rent — refundable
  const firstMonthTotal = monthlyRent + securityDeposit + contractCharges + additionalCharges;

  const bannerRows = [
    { label: 'Monthly Rent',                  amount: monthlyRent },
    { label: 'Security Deposit (Refundable)', amount: securityDeposit },
    { label: 'Contract Charges',              amount: contractCharges },
    { label: 'Additional Charges',            amount: additionalCharges },
  ];

  return (
    <div className="space-y-4">

      <SaveBar status={saveStatus} onSave={handleSave} errorMsg={saveError} />

      {/* ── Rent & Charges breakdown ── */}
      <SectionCard title="Rent & Charges">

        {/* Monthly Rent — editable */}
        <FieldRow
          label="Monthly Rent"
          value={
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[#666666] select-none">QAR</span>
              <input
                type="number"
                min={0}
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(Math.max(0, Number(e.target.value)))}
                className="w-32 text-right text-sm font-bold text-[#e0e0e0] bg-[#111111] border border-[#333333] rounded-md px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-[#c9a84c] focus:border-[#c9a84c] tabular-nums"
              />
              <span className="text-xs text-[#555555]">/ month</span>
            </div>
          }
        />

        {/* Contract Charges — editable */}
        <FieldRow
          label="Contract Charges"
          value={
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[#666666] select-none">QAR</span>
              <input
                type="number"
                min={0}
                value={contractCharges}
                onChange={(e) => setContractCharges(Math.max(0, Number(e.target.value)))}
                className="w-32 text-right text-sm font-semibold text-[#e0e0e0] bg-[#111111] border border-[#333333] rounded-md px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-[#c9a84c] focus:border-[#c9a84c] tabular-nums"
              />
            </div>
          }
        />

        {/* Security Deposit — fixed (1 month) */}
        <FieldRow
          label="Security Deposit"
          value={
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-[#e0e0e0]">{formatQAR(monthlyRent)}</span>
              <span className="text-xs text-[#555555]">= 1 month&apos;s rent</span>
              <span className="text-xs font-semibold text-emerald-400">(REFUNDABLE)</span>
            </div>
          }
        />

        {/* Additional Charges — editable */}
        <FieldRow
          label="Additional Charges"
          value={
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[#666666] select-none">QAR</span>
              <input
                type="number"
                min={0}
                value={additionalCharges}
                onChange={(e) => setAdditionalCharges(Math.max(0, Number(e.target.value)))}
                className="w-32 text-right text-sm font-semibold text-[#e0e0e0] bg-[#111111] border border-[#333333] rounded-md px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-[#c9a84c] focus:border-[#c9a84c] tabular-nums"
              />
            </div>
          }
        />

      </SectionCard>

      {/* ── Service & Utility Charges ── */}
      <SectionCard title="Service & Utility Charges">
        <FieldRow
          label="Service & Utility"
          value={<ApplicableToggle value={serviceUtility} onChange={setServiceUtility} />}
        />
        {serviceUtility && (
          <>
            <DepositRow
              label="Kahramaa Deposit"
              applicable={kahramaaApplicable}
              onToggle={setKahramaaApplicable}
              amount={kahramaaAmount}
              onAmount={setKahramaaAmount}
            />
            <DepositRow
              label="Qatar Cool Deposit"
              applicable={qatarCoolApplicable}
              onToggle={setQatarCoolApplicable}
              amount={qatarCoolAmount}
              onAmount={setQatarCoolAmount}
            />
            <DepositRow
              label="Marafeq Deposit"
              applicable={marafeqApplicable}
              onToggle={setMarafeqApplicable}
              amount={marafeqAmount}
              onAmount={setMarafeqAmount}
            />
          </>
        )}
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
          <div className="border-t border-slate-700 pt-3 space-y-2">
            {bannerRows.map(({ label, amount }) => (
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

const PAID_BY_OPTIONS = [
  'Developer',
  'Real Estate Company',
  'Agent',
  'Client',
  'Other',
] as const;

type PaidByOption = typeof PAID_BY_OPTIONS[number];

// ── Client Info ────────────────────────────────────────────────────────────

type ClientType = 'Individual' | 'Company';

function ClientTypeToggle({ value, onChange }: { value: ClientType; onChange: (v: ClientType) => void }) {
  return (
    <div className="inline-flex rounded-lg overflow-hidden border border-[#333333] text-xs font-semibold">
      {(['Individual', 'Company'] as ClientType[]).map((opt, i) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-4 py-1.5 transition-colors ${i > 0 ? 'border-l border-[#333333]' : ''} ${
            value === opt
              ? 'bg-[#c9a84c] text-[#0f0f0f]'
              : 'bg-[#1e1e1e] text-[#666666] hover:bg-[#252525] hover:text-[#aaaaaa]'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}


function ClientInfoSection({ unitUuid }: { unitUuid: string }) {
  const [clientType,           setClientType]           = useState<ClientType>('Individual');
  const [fullName,             setFullName]             = useState('');
  const [idNumber,             setIdNumber]             = useState('');
  const [nationality,          setNationality]          = useState('');
  const [mobile,               setMobile]               = useState('');
  const [email,                setEmail]                = useState('');
  const [employerDetails,      setEmployerDetails]      = useState('');
  const [authorizedSignatory,  setAuthorizedSignatory]  = useState('');
  const [emergencyContact,     setEmergencyContact]     = useState('');
  const [notes,                setNotes]                = useState('');
  const [saveStatus,           setSaveStatus]           = useState<SaveStatus>('idle');
  const [saveError,            setSaveError]            = useState('');

  useEffect(() => {
    if (!unitUuid) return;
    supabase.from('unit_clients').select('*').eq('unit_id', unitUuid).single()
      .then(({ data }) => {
        if (!data) return;
        setClientType((data.client_type as ClientType) ?? 'Individual');
        setFullName(data.full_name ?? '');
        setIdNumber(data.qid_cr_number ?? '');
        setNationality(data.nationality ?? '');
        setMobile(data.mobile_number ?? '');
        setEmail(data.email ?? '');
        setEmployerDetails(data.employer ?? '');
        setAuthorizedSignatory(data.authorized_signatory ?? '');
        setEmergencyContact(data.emergency_contact ?? '');
        setNotes(data.notes ?? '');
      });
  }, [unitUuid]);

  const handleSave = async () => {
    if (!unitUuid) return;
    setSaveStatus('saving');
    const { error } = await supabase.from('unit_clients').upsert({
      unit_id:              unitUuid,
      client_type:          clientType,
      full_name:            fullName || null,
      qid_cr_number:        idNumber || null,
      nationality:          nationality || null,
      mobile_number:        mobile || null,
      email:                email || null,
      employer:             employerDetails || null,
      authorized_signatory: clientType === 'Company' ? authorizedSignatory || null : null,
      emergency_contact:    emergencyContact || null,
      notes:                notes || null,
    }, { onConflict: 'unit_id' });
    if (error) { setSaveError(error.message); setSaveStatus('error'); return; }
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2500);
  };

  const inp = 'w-full text-sm text-[#d0d0d0] bg-[#111111] border border-[#333333] rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#c9a84c] focus:border-[#c9a84c] placeholder:text-[#444444]';

  return (
    <>
    <SectionCard title="Client Info">

      <FieldRow label="Client Type" value={<ClientTypeToggle value={clientType} onChange={setClientType} />} />

      <FieldRow
        label={clientType === 'Individual' ? 'Full Name' : 'Company Name'}
        value={
          <input type="text"
            placeholder={clientType === 'Individual' ? 'Enter full legal name…' : 'Enter registered company name…'}
            value={fullName} onChange={e => setFullName(e.target.value)} className={inp} />
        }
      />

      <FieldRow
        label={clientType === 'Individual' ? 'QID Number' : 'CR Number'}
        value={
          <input type="text"
            placeholder={clientType === 'Individual' ? 'e.g. 28012345678' : 'e.g. 12345'}
            value={idNumber} onChange={e => setIdNumber(e.target.value)} className={`${inp} font-mono`} />
        }
      />

      <FieldRow
        label="Nationality"
        value={<input type="text" placeholder="e.g. Qatari, Indian, British…" value={nationality} onChange={e => setNationality(e.target.value)} className={inp} />}
      />

      <FieldRow
        label="Mobile Number"
        value={<input type="tel" placeholder="+974 XXXX XXXX" value={mobile} onChange={e => setMobile(e.target.value)} className={inp} />}
      />

      <FieldRow
        label="Email Address"
        value={<input type="email" placeholder="email@example.com" value={email} onChange={e => setEmail(e.target.value)} className={inp} />}
      />

      <FieldRow
        label="Employer / Company"
        value={<input type="text" placeholder="Employer name or company details…" value={employerDetails} onChange={e => setEmployerDetails(e.target.value)} className={inp} />}
      />

      {clientType === 'Company' && (
        <FieldRow
          label="Authorized Signatory"
          value={
            <input type="text" placeholder="Signatory full name…"
              value={authorizedSignatory} onChange={e => setAuthorizedSignatory(e.target.value)} className={inp} />
          }
        />
      )}

      <FieldRow
        label="Emergency Contact"
        value={<input type="text" placeholder="Name · +974 XXXX XXXX" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} className={inp} />}
      />

      {/* ── Notes & Special Conditions ── */}
      <FieldRow
        label="Notes & Special Conditions"
        value={
          <textarea
            rows={3}
            placeholder="Enter any notes, special conditions, or instructions…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className={`${inp} resize-y min-h-[72px]`}
          />
        }
      />

    </SectionCard>

    <SaveBar status={saveStatus} onSave={handleSave} errorMsg={saveError} />
    </>
  );
}

// ── Legal Duration & Conditions ────────────────────────────────────────────

const toDateValue = (iso: string) => (iso ? iso.split('T')[0] : '');

function LegalDurationSection({ unit, unitUuid }: { unit: UnitListing; unitUuid: string }) {
  const parsed = parseLegalDuration(unit.legalDuration);

  const [listedDate,        setListedDate]        = useState<string>(toDateValue(unit.listedDate));
  const [contractStartDate, setContractStartDate] = useState<string>(toDateValue(unit.contractStartDate));
  const [contractEndDate,   setContractEndDate]   = useState<string>(toDateValue(unit.contractEndDate));
  const [durationValue,     setDurationValue]     = useState<number>(parsed.value);
  const [durationUnit,      setDurationUnit]      = useState<DurationUnit>(parsed.unit);
  const [lastModified,      setLastModified]      = useState<string>(unit.lastUpdated);
  const [saveStatus,        setSaveStatus]        = useState<SaveStatus>('idle');
  const [saveError,         setSaveError]         = useState('');

  // Load fresh values from DB on open
  useEffect(() => {
    if (!unitUuid) return;
    supabase.from('units')
      .select('listed_date,contract_start_date,contract_end_date,legal_duration,updated_at')
      .eq('id', unitUuid).single()
      .then(({ data }) => {
        if (!data) return;
        setListedDate(toDateValue(data.listed_date ?? ''));
        const start = toDateValue(data.contract_start_date ?? '');
        const end   = toDateValue(data.contract_end_date ?? '');
        setContractStartDate(start);
        setContractEndDate(end);
        setLastModified(data.updated_at ?? unit.lastUpdated);
        if (data.legal_duration) {
          const p = parseLegalDuration(data.legal_duration);
          setDurationValue(p.value);
          setDurationUnit(p.unit);
        } else if (start && end) {
          const p = calcDurationFromDates(start, end);
          setDurationValue(p.value);
          setDurationUnit(p.unit);
        }
      });
  }, [unitUuid]);

  // Start date changed → recalculate end date from start + contract duration (duration stays fixed)
  const handleStartChange = (start: string) => {
    setContractStartDate(start);
    if (start && durationValue) {
      setContractEndDate(calcEndDate(start, durationValue, durationUnit));
    }
    setLastModified(new Date().toISOString());
  };

  // End date changed → recalculate duration from start→end (start date never changes)
  const handleEndChange = (end: string) => {
    setContractEndDate(end);
    if (end && contractStartDate) {
      const p = calcDurationFromDates(contractStartDate, end);
      setDurationValue(p.value);
      setDurationUnit(p.unit);
    }
    setLastModified(new Date().toISOString());
  };

  // Duration changed → recalculate end date from start
  const handleDurationValueChange = (val: number) => {
    setDurationValue(val);
    if (contractStartDate) setContractEndDate(calcEndDate(contractStartDate, val, durationUnit));
    setLastModified(new Date().toISOString());
  };

  const handleDurationUnitChange = (u: DurationUnit) => {
    setDurationUnit(u);
    if (contractStartDate) setContractEndDate(calcEndDate(contractStartDate, durationValue, u));
    setLastModified(new Date().toISOString());
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    setSaveError('');
    const legalDuration = `${durationValue} ${durationUnit}`;
    const res = await fetch('/api/save-unit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unitUuid,
        fields: {
          listed_date:         listedDate || null,
          contract_start_date: contractStartDate || null,
          contract_end_date:   contractEndDate || null,
          legal_duration:      legalDuration,
        },
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setSaveError(body.error ?? `HTTP ${res.status}`);
      setSaveStatus('error');
      return;
    }
    await logEvent({ unitId: unitUuid, action: 'RECORD_SAVE', tab: 'commission', field: 'Legal Duration', payload: { listedDate, contractStartDate, contractEndDate, legalDuration } });
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2500);
  };

  const formatTimestamp = (iso: string) =>
    new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });

  const dateInp = 'text-sm text-[#d0d0d0] bg-[#111111] border border-[#333333] rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#c9a84c] focus:border-[#c9a84c]';

  return (
    <>
    <SectionCard title="Legal Duration & Conditions">

      {/* Listed Date */}
      <FieldRow
        label="Listed Date"
        value={
          <input type="date" value={listedDate}
            onChange={e => { setListedDate(e.target.value); setLastModified(new Date().toISOString()); }}
            className={dateInp} style={{ colorScheme: 'dark' }}
          />
        }
      />

      {/* Contract Start Date → auto-calculates end date */}
      <FieldRow
        label="Contract Start Date"
        value={
          <input type="date" value={contractStartDate}
            onChange={e => handleStartChange(e.target.value)}
            className={dateInp} style={{ colorScheme: 'dark' }}
          />
        }
      />

      {/* Contract Duration → auto-calculates end date */}
      <FieldRow
        label="Contract Duration"
        value={
          <div className="flex items-center gap-2">
            <input
              type="number" min={1} value={durationValue}
              onChange={e => handleDurationValueChange(Math.max(1, Number(e.target.value)))}
              className="w-20 text-center text-sm text-[#d0d0d0] bg-[#111111] border border-[#333333] rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#c9a84c] focus:border-[#c9a84c] tabular-nums"
            />
            <select value={durationUnit}
              onChange={e => handleDurationUnitChange(e.target.value as DurationUnit)}
              className="px-3 py-1.5 text-sm bg-[#111111] text-[#d0d0d0] border border-[#333333] rounded-md focus:outline-none focus:ring-2 focus:ring-[#c9a84c] focus:border-[#c9a84c] cursor-pointer"
            >
              {(['Days', 'Weeks', 'Months', 'Years'] as DurationUnit[]).map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            {contractStartDate && contractEndDate && (
              <span className="text-xs text-[#555555] italic">auto-calculated</span>
            )}
          </div>
        }
      />

      {/* Contract End Date → auto-calculates duration when changed manually */}
      <FieldRow
        label="Contract End Date"
        value={
          <input type="date" value={contractEndDate}
            onChange={e => handleEndChange(e.target.value)}
            className={dateInp} style={{ colorScheme: 'dark' }}
          />
        }
      />

      {/* Last Updated — read-only system timestamp, auto-refreshes on any edit */}
      <FieldRow
        label="Last Updated"
        value={
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-mono text-[#888888]">
              {formatTimestamp(lastModified)}
            </span>
            <span className="text-[9px] font-bold bg-[#1a1a1a] border border-[#252525] text-[#555555] px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
              auto
            </span>
          </div>
        }
      />

    </SectionCard>

    <SaveBar status={saveStatus} onSave={handleSave} errorMsg={saveError} />
    </>
  );
}

function CommissionTab({ unit, unitUuid }: { unit: UnitListing; unitUuid: string }) {
  const [agencyFeeApplicable, setAgencyFeeApplicable] = useState<boolean>(unit.agencyFee > 0);
  const [agencyFeeAmount, setAgencyFeeAmount] = useState<number>(unit.agencyFee);
  const [paidBy, setPaidBy] = useState<PaidByOption>('Real Estate Company');
  const [paidByOther, setPaidByOther] = useState<string>('');

  const [regStatus, setRegStatus] = useState<PropertyRegStatus>(() => getDefaultRegStatus(unit));
  const [registrationBy, setRegistrationBy] = useState<string>('');
  const [contractNumber, setContractNumber] = useState<string>(unit.mociContractNumber);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState('');

  // Unified document state for all Commission & Legal doc types
  type CommDocKey = 'property_reg_cert' | 'commission_contract' | 'qid' | 'passport' | 'cr' | 'computer_card' | 'general';
  const EMPTY_DOC: DocEntry = { path: '', name: '', url: '' };
  const [commDocs, setCommDocs] = useState<Record<CommDocKey, DocEntry>>({
    property_reg_cert:   EMPTY_DOC,
    commission_contract: EMPTY_DOC,
    qid:                 EMPTY_DOC,
    passport:            EMPTY_DOC,
    cr:                  EMPTY_DOC,
    computer_card:       EMPTY_DOC,
    general:             EMPTY_DOC,
  });
  const setCommDoc = (key: CommDocKey, doc: DocEntry) => {
    setCommDocs(prev => {
      const old = prev[key];
      if (unitUuid) {
        if (doc.path && !old.path)  logEvent({ unitId: unitUuid, action: 'FILE_UPLOAD',  tab: 'commission', field: key, newValue: doc.name,    payload: { storagePath: doc.path } });
        if (!doc.path && old.path)  logEvent({ unitId: unitUuid, action: 'FILE_REMOVED', tab: 'commission', field: key, oldValue: old.name });
        if (doc.url  && !old.url)   logEvent({ unitId: unitUuid, action: 'LINK_SAVED',   tab: 'commission', field: key, newValue: doc.url });
        if (!doc.url  && old.url)   logEvent({ unitId: unitUuid, action: 'LINK_REMOVED', tab: 'commission', field: key, oldValue: old.url });
      }
      return { ...prev, [key]: doc };
    });
  };

  useEffect(() => {
    if (!unitUuid) return;
    Promise.all([
      supabase.from('unit_commissions').select('*').eq('unit_id', unitUuid).single(),
      supabase.from('units').select('moci_contract_number').eq('id', unitUuid).single(),
    ]).then(([{ data: commData }, { data: unitData }]) => {
      if (commData) {
        setAgencyFeeApplicable(commData.agency_fee_applicable ?? false);
        setAgencyFeeAmount(commData.agency_fee_amount ?? 0);
        setPaidBy((commData.paid_by as PaidByOption) ?? 'Real Estate Company');
        setPaidByOther(commData.paid_by_other ?? '');
        setRegStatus((commData.property_reg_status as PropertyRegStatus) ?? getDefaultRegStatus(unit));
        setRegistrationBy(commData.registration_by ?? '');
        const d = (commData.doc_urls ?? {}) as Record<string, any>;
        const loadDoc = (key: string): DocEntry => {
          const v = d[key];
          if (v && typeof v === 'object') return { path: v.path || '', name: v.name || '', url: v.url || '', label: v.label || '' };
          // backward-compat: flat keys from previous schema
          return { path: d[`${key}`] || d[`${key}_path`] || '', name: d[`${key}_name`] || '', url: d[`${key}_url`] || '' };
        };
        setCommDocs({
          property_reg_cert:   loadDoc('property_reg_cert'),
          commission_contract: loadDoc('commission_contract'),
          qid:                 loadDoc('qid'),
          passport:            loadDoc('passport'),
          cr:                  loadDoc('cr'),
          computer_card:       loadDoc('computer_card'),
          general:             loadDoc('general'),
        });
      }
      if (unitData) {
        setContractNumber(unitData.moci_contract_number ?? unit.mociContractNumber);
      }
    });
  }, [unitUuid]);

  const handleSave = async () => {
    setSaveStatus('saving');
    setSaveError('');
    // unit_commissions uses anon key — no RLS block on this table
    const { error } = await supabase.from('unit_commissions').upsert({
      unit_id:               unitUuid,
      agency_fee_applicable: agencyFeeApplicable,
      agency_fee_amount:     agencyFeeApplicable ? agencyFeeAmount : null,
      paid_by:               agencyFeeApplicable ? paidBy : null,
      paid_by_other:         paidBy === 'Other' ? paidByOther : null,
      property_reg_status:   regStatus,
      registration_by:       registrationBy || null,
      doc_urls: Object.fromEntries(
        (Object.entries(commDocs) as [string, DocEntry][])
          .filter(([, v]) => v.path || v.url)
          .map(([k, v]) => [k, { path: v.path || null, name: v.name || null, url: v.url || null }])
      ),
    }, { onConflict: 'unit_id' });
    if (error) { setSaveError(error.message); setSaveStatus('error'); return; }
    // moci_contract_number lives on units — use service-role API to bypass RLS
    const res = await fetch('/api/save-unit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unitUuid,
        fields: { moci_contract_number: contractNumber || null },
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setSaveError(body.error ?? `HTTP ${res.status}`);
      setSaveStatus('error');
      return;
    }
    await logEvent({ unitId: unitUuid, action: 'RECORD_SAVE', tab: 'commission', payload: { agencyFeeApplicable, agencyFeeAmount: agencyFeeApplicable ? agencyFeeAmount : null, paidBy: agencyFeeApplicable ? paidBy : null, regStatus, contractNumber } });
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2500);
  };

  const autoRegistered = ACTIVE_STATUSES.has(unit.status) && regStatus === 'Registered';
  const autoNotRegistered = !ACTIVE_STATUSES.has(unit.status) && regStatus === 'Not Registered';
  const showRegistrationBy = regStatus === 'Reserved' || regStatus === 'Booked' || regStatus === 'Leased';

  return (
    <div className="space-y-4">

      <SaveBar status={saveStatus} onSave={handleSave} errorMsg={saveError} />

      {/* ── Agency Commission ── */}
      <SectionCard title="Agency Commission">

        <FieldRow
          label="Agency Fee"
          value={<ApplicableToggle value={agencyFeeApplicable} onChange={setAgencyFeeApplicable} />}
        />

        {agencyFeeApplicable && (
          <>
            <FieldRow
              label="Fee Amount"
              value={
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[#666666] select-none">QAR</span>
                  <input
                    type="number"
                    min={0}
                    value={agencyFeeAmount}
                    onChange={(e) => setAgencyFeeAmount(Math.max(0, Number(e.target.value)))}
                    className="w-36 text-right text-sm font-bold text-[#e0e0e0] bg-[#111111] border border-[#333333] rounded-md px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-[#c9a84c] focus:border-[#c9a84c] tabular-nums"
                  />
                </div>
              }
            />

            <FieldRow
              label="Paid By"
              value={
                <div className="flex flex-col gap-2">
                  <select
                    value={paidBy}
                    onChange={(e) => setPaidBy(e.target.value as PaidByOption)}
                    className="w-52 px-3 py-1.5 text-sm bg-[#111111] text-[#d0d0d0] border border-[#333333] rounded-md focus:outline-none focus:ring-2 focus:ring-[#c9a84c] focus:border-[#c9a84c] cursor-pointer"
                  >
                    {PAID_BY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {paidBy === 'Other' && (
                    <input
                      type="text"
                      placeholder="Specify party…"
                      value={paidByOther}
                      onChange={(e) => setPaidByOther(e.target.value)}
                      className="w-52 text-sm text-[#d0d0d0] bg-[#111111] border border-[#333333] rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#c9a84c] focus:border-[#c9a84c] placeholder:text-[#444444]"
                    />
                  )}
                </div>
              }
            />
          </>
        )}

      </SectionCard>

      {/* ── Property Registration Status ── */}
      <SectionCard title="Property Registration Status">

        <FieldRow
          label="Registration Status"
          value={
            <div className="flex flex-col gap-2.5">
              {/* Live status badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${PROP_REG_BADGE[regStatus]}`}>
                  {regStatus}
                </span>
                {autoRegistered && (
                  <span className="text-[10px] text-[#444444] italic">
                    auto-set · unit is {unit.status.replace('_', ' ')}
                  </span>
                )}
                {autoNotRegistered && (
                  <span className="text-[10px] text-[#444444] italic">
                    auto-set · unit is {unit.status.replace('_', ' ')}
                  </span>
                )}
              </div>
              {/* Editable dropdown */}
              <select
                value={regStatus}
                onChange={(e) => setRegStatus(e.target.value as PropertyRegStatus)}
                className="w-48 px-3 py-1.5 text-sm bg-[#111111] text-[#d0d0d0] border border-[#333333] rounded-md focus:outline-none focus:ring-2 focus:ring-[#c9a84c] focus:border-[#c9a84c] cursor-pointer"
              >
                {PROPERTY_REG_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          }
        />

        {/* Registration By — shown only for Reserved / Booked / Leased */}
        {showRegistrationBy && (
          <FieldRow
            label="Registration By"
            value={
              <input
                type="text"
                placeholder="Enter registering party…"
                value={registrationBy}
                onChange={(e) => setRegistrationBy(e.target.value)}
                className="w-64 text-sm text-[#d0d0d0] bg-[#111111] border border-[#333333] rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#c9a84c] focus:border-[#c9a84c] placeholder:text-[#444444]"
              />
            }
          />
        )}

        {regStatus !== 'Not Registered' && (
          <FieldRow
            label="Contract Number"
            value={
              <input
                type="text"
                value={contractNumber}
                onChange={e => setContractNumber(e.target.value)}
                placeholder="e.g. MOCI-2024-DF-0701"
                className="w-64 font-mono text-sm text-[#d0d0d0] bg-[#111111] border border-[#333333] rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#c9a84c] focus:border-[#c9a84c] placeholder:text-[#444444]"
              />
            }
          />
        )}

      </SectionCard>

      {/* ── Commission Documents ── */}
      <SectionCard title="Commission Documents">
        <div className="space-y-2">
          <CommDocRow label="Reg Certificate"    doc={commDocs.property_reg_cert}   category={`${unitUuid}/commission/property-reg-cert`}   onChange={d => setCommDoc('property_reg_cert',   d)} />
          <CommDocRow label="Commission Contract" doc={commDocs.commission_contract} category={`${unitUuid}/commission/commission-contract`} onChange={d => setCommDoc('commission_contract', d)} />
        </div>
      </SectionCard>

      {/* ── Regulatory Documents ── */}
      <SectionCard title="Regulatory Documents">
        <div className="space-y-2">
          <CommDocRow label="QID"           doc={commDocs.qid}           category={`${unitUuid}/commission/qid`}           onChange={d => setCommDoc('qid',           d)} />
          <CommDocRow label="Passport"      doc={commDocs.passport}      category={`${unitUuid}/commission/passport`}      onChange={d => setCommDoc('passport',      d)} />
          <CommDocRow label="CR"            doc={commDocs.cr}            category={`${unitUuid}/commission/cr`}            onChange={d => setCommDoc('cr',            d)} />
          <CommDocRow label="Computer Card" doc={commDocs.computer_card} category={`${unitUuid}/commission/computer-card`} onChange={d => setCommDoc('computer_card', d)} />
          <CommDocRow
            label="Other Documents"
            doc={commDocs.general}
            category={`${unitUuid}/commission/other`}
            labelEditable
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png"
            onChange={d => setCommDoc('general', d)}
          />
        </div>
      </SectionCard>

      {/* ── Client Info ── */}
      <ClientInfoSection unitUuid={unitUuid} />

      {/* ── Legal Duration & Conditions ── */}
      <LegalDurationSection unit={unit} unitUuid={unitUuid} />

    </div>
  );
}

// ── Tab D: Operational ────────────────────────────────────────────────────

interface LogEntry {
  id:         string;
  timestamp:  string;
  actionType: string;
  operator:   string;
  tabContext:  string | null;
  field:      string | null;
  oldValue:   string | null;
  newValue:   string | null;
  payload:    Record<string, unknown>;
}

function fmtLogTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
}

const ACTION_BADGE: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  RECORD_VIEW:       { label: 'Record View',       dot: '#60a5fa', text: 'text-blue-400',    bg: 'bg-blue-950/40',    border: 'border-blue-800/30'    },
  TAB_NAVIGATE:      { label: 'Tab Navigate',       dot: '#a78bfa', text: 'text-violet-400',  bg: 'bg-violet-950/40',  border: 'border-violet-800/30'  },
  RECORD_SAVE:       { label: 'Record Save',        dot: '#c9a84c', text: 'text-amber-400',   bg: 'bg-amber-950/40',   border: 'border-amber-800/30'   },
  FIELD_UPDATE:      { label: 'Field Update',       dot: '#22d3ee', text: 'text-cyan-400',    bg: 'bg-cyan-950/40',    border: 'border-cyan-800/30'    },
  STATUS_CHANGE:     { label: 'Status Change',      dot: '#fb923c', text: 'text-orange-400',  bg: 'bg-orange-950/40',  border: 'border-orange-800/30'  },
  FILE_UPLOAD:       { label: 'File Upload',        dot: '#4ade80', text: 'text-emerald-400', bg: 'bg-emerald-950/40', border: 'border-emerald-800/30' },
  LINK_SAVED:        { label: 'Link Saved',         dot: '#38bdf8', text: 'text-sky-400',     bg: 'bg-sky-950/40',     border: 'border-sky-800/30'     },
  FILE_REMOVED:      { label: 'File Removed',       dot: '#f87171', text: 'text-red-400',     bg: 'bg-red-950/40',     border: 'border-red-800/30'     },
  LINK_REMOVED:      { label: 'Link Removed',       dot: '#f87171', text: 'text-red-400',     bg: 'bg-red-950/40',     border: 'border-red-800/30'     },
  RECORD_DUPLICATE:  { label: 'Duplicate',          dot: '#c084fc', text: 'text-purple-400',  bg: 'bg-purple-950/40',  border: 'border-purple-800/30'  },
};

const TAB_LABEL: Record<string, string> = {
  property:    'Property & Unit',
  financials:  'Financials',
  commission:  'Commission & Legal',
  operational: 'Operational',
};

function SystemUpdateLog({ entries }: { entries: LogEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="py-8 flex flex-col items-center gap-2 text-center">
        <svg className="w-8 h-8 text-[#2a2a2a]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm text-[#444444]">No audit events recorded yet.</p>
        <p className="text-xs text-[#333333]">All system actions will appear here automatically.</p>
      </div>
    );
  }

  return (
    <div className="relative pl-5 py-1">
      <div className="absolute left-[9px] top-0 bottom-0 w-px bg-[#1e1e1e]" />
      <ul className="space-y-3">
        {entries.map((entry) => {
          const badge = ACTION_BADGE[entry.actionType] ?? ACTION_BADGE['FIELD_UPDATE'];
          return (
            <li key={entry.id} className="relative">
              <span
                className="absolute -left-[17px] top-[6px] w-2 h-2 rounded-full border shrink-0"
                style={{ background: badge.dot + '33', borderColor: badge.dot + '88' }}
              />
              <div className={`rounded-lg border px-3 py-2 space-y-1.5 ${badge.bg} ${badge.border}`}>
                {/* Header */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${badge.text} bg-black/30`}>
                      {badge.label}
                    </span>
                    {entry.tabContext && (
                      <span className="text-[9px] text-[#555555] uppercase tracking-wider">
                        {TAB_LABEL[entry.tabContext] ?? entry.tabContext}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[9px] font-semibold text-[#555555]">{entry.operator}</span>
                    <span className="text-[9px] font-mono text-[#444444]">{fmtLogTime(entry.timestamp)}</span>
                  </div>
                </div>

                {/* Field change */}
                {entry.field && (
                  <div className="flex items-start gap-1.5 text-[11px]">
                    <span className="text-[#555555] font-mono shrink-0">{entry.field}</span>
                    {entry.oldValue && <><span className="text-[#3a3a3a]">·</span><span className="text-[#555555] line-through truncate">{entry.oldValue}</span></>}
                    {entry.newValue && <><span className="text-[#444444]">→</span><span className={`${badge.text} truncate`}>{entry.newValue}</span></>}
                  </div>
                )}

                {/* Payload — show non-null key/value pairs */}
                {entry.payload && Object.keys(entry.payload).length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {Object.entries(entry.payload)
                      .filter(([, v]) => v !== null && v !== '' && v !== undefined)
                      .map(([k, v]) => (
                        <span key={k} className="text-[10px] font-mono text-[#444444]">
                          <span className="text-[#3a3a3a]">{k}:</span> <span className="text-[#666666]">{String(v)}</span>
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function OperationalTab({ unit, unitUuid }: { unit: UnitListing; unitUuid: string }) {
  // ── Focal Point Info ──────────────────────────────────────────────────────
  const [focalName,  setFocalName]  = useState('');
  const [focalPhone, setFocalPhone] = useState('');
  const [focalEmail, setFocalEmail] = useState('');

  // ── Operator Remarks ──────────────────────────────────────────────────────
  const [operatorRemarks, setOperatorRemarks] = useState('');

  // ── Maintenance Notes (editable) ──────────────────────────────────────────
  const [maintenanceNotes, setMaintenanceNotes] = useState(unit.maintenanceNotes);

  // ── Access & Security ─────────────────────────────────────────────────────
  const [accessLockbox, setAccessLockbox] = useState(unit.accessLockbox);

  // ── Asset History Documents ───────────────────────────────────────────────
  const [assetDocPaths, setAssetDocPaths] = useState({ inspection_report: '', inventory_checklist: '', handover_cert: '' });
  const [assetDocNames, setAssetDocNames] = useState({ inspection_report: '', inventory_checklist: '', handover_cert: '' });
  const setAssetDoc = (key: 'inspection_report' | 'inventory_checklist' | 'handover_cert', path: string, name: string) => {
    if (unitUuid) {
      if (path && !assetDocPaths[key])  logEvent({ unitId: unitUuid, action: 'FILE_UPLOAD',  tab: 'operational', field: key, newValue: name, payload: { storagePath: path } });
      if (!path && assetDocPaths[key])  logEvent({ unitId: unitUuid, action: 'FILE_REMOVED', tab: 'operational', field: key, oldValue: assetDocNames[key] });
    }
    setAssetDocPaths(prev => ({ ...prev, [key]: path }));
    setAssetDocNames(prev => ({ ...prev, [key]: name }));
  };

  // ── System Update Log ──────────────────────────────────────────────────────
  const [dbLog,         setDbLog]         = useState<LogEntry[]>([]);
  const [logRefreshKey, setLogRefreshKey] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError,  setSaveError]  = useState('');

  useEffect(() => {
    if (!unitUuid) return;
    supabase.from('unit_operational').select('*').eq('unit_id', unitUuid).single()
      .then(({ data }) => {
        if (!data) return;
        const name    = data.focal_point_name  ?? '';
        const phone   = data.focal_point_phone ?? '';
        const femail  = data.focal_point_email ?? '';
        const remarks = data.operator_remarks  ?? '';
        const notes   = data.maintenance_notes ?? unit.maintenanceNotes;
        const lockbox = data.access_lockbox    ?? unit.accessLockbox;
        setFocalName(name);
        setFocalPhone(phone);
        setFocalEmail(femail);
        setOperatorRemarks(remarks);
        setMaintenanceNotes(notes);
        setAccessLockbox(lockbox);
        const ad = (data.doc_urls ?? {}) as Record<string, string>;
        setAssetDocPaths({ inspection_report: ad.inspection_report || '', inventory_checklist: ad.inventory_checklist || '', handover_cert: ad.handover_cert || '' });
        setAssetDocNames({ inspection_report: ad.inspection_report_name || '', inventory_checklist: ad.inventory_checklist_name || '', handover_cert: ad.handover_cert_name || '' });
        committed.current = {
          'Contact Name':      name,
          'Phone':             phone,
          'Email':             femail,
          'Operator Remarks':  remarks,
          'Maintenance Notes': notes,
        };
      });
  }, [unitUuid]);

  const handleSave = async () => {
    setSaveStatus('saving');
    const { error } = await supabase.from('unit_operational').update({
      focal_point_name:  focalName       || null,
      focal_point_phone: focalPhone      || null,
      focal_point_email: focalEmail      || null,
      operator_remarks:  operatorRemarks || null,
      maintenance_notes: maintenanceNotes || null,
      access_lockbox:    accessLockbox   || null,
      doc_urls: {
        ...(assetDocPaths.inspection_report   ? { inspection_report: assetDocPaths.inspection_report, inspection_report_name: assetDocNames.inspection_report } : {}),
        ...(assetDocPaths.inventory_checklist ? { inventory_checklist: assetDocPaths.inventory_checklist, inventory_checklist_name: assetDocNames.inventory_checklist } : {}),
        ...(assetDocPaths.handover_cert       ? { handover_cert: assetDocPaths.handover_cert, handover_cert_name: assetDocNames.handover_cert } : {}),
      },
    }).eq('unit_id', unitUuid);
    if (error) { setSaveError(error.message); setSaveStatus('error'); return; }
    await logEvent({ unitId: unitUuid, action: 'RECORD_SAVE', tab: 'operational', payload: { focalName, focalPhone, focalEmail, operatorRemarks, maintenanceNotes, accessLockbox } });
    setSaveStatus('saved');
    setLogRefreshKey(k => k + 1);
    setTimeout(() => setSaveStatus('idle'), 2500);
  };

  // ── Load full audit log from DB ────────────────────────────────────────────
  useEffect(() => {
    if (!unitUuid) return;
    supabase
      .from('audit_log')
      .select('*')
      .eq('unit_id', unitUuid)
      .order('changed_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (!data) return;
        setDbLog(data.map(r => ({
          id:         r.id ?? `${r.changed_at}-${r.field}`,
          timestamp:  r.changed_at,
          actionType: r.action_type ?? 'FIELD_UPDATE',
          operator:   r.operator    ?? 'Administrator',
          tabContext:  r.tab_context ?? null,
          field:      r.field       ?? null,
          oldValue:   r.old_value   ?? null,
          newValue:   r.new_value   ?? null,
          payload:    r.payload     ?? {},
        })));
      });
  }, [unitUuid, logRefreshKey]);

  // Snapshot of last-committed values used to detect real changes on blur
  const committed = useRef<Record<string, string>>({
    'Contact Name':       '',
    'Phone':              '',
    'Email':              '',
    'Operator Remarks':   '',
    'Maintenance Notes':  unit.maintenanceNotes,
  });

  const logChange = (field: string, newValue: string) => {
    const oldValue = committed.current[field] ?? '';
    if (oldValue === newValue) return;
    committed.current = { ...committed.current, [field]: newValue };
    if (unitUuid) {
      logEvent({ unitId: unitUuid, action: 'FIELD_UPDATE', tab: 'operational', field, oldValue, newValue })
        .then(() => setLogRefreshKey(k => k + 1));
    }
  };

  const inp = 'w-full text-sm text-[#d0d0d0] bg-[#111111] border border-[#333333] rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#c9a84c] focus:border-[#c9a84c] placeholder:text-[#444444]';

  return (
    <div className="space-y-4">

      <SaveBar status={saveStatus} onSave={handleSave} errorMsg={saveError} />

      {/* ── Property Focal Point Info ── */}
      <SectionCard title="Property Focal Point Info">
        <FieldRow
          label="Contact Name"
          value={
            <input type="text" placeholder="Full name…" value={focalName}
              onChange={e => setFocalName(e.target.value)}
              onBlur={e => logChange('Contact Name', e.target.value)}
              className={inp} />
          }
        />
        <FieldRow
          label="Phone"
          value={
            <input type="tel" placeholder="+974 XXXX XXXX" value={focalPhone}
              onChange={e => setFocalPhone(e.target.value)}
              onBlur={e => logChange('Phone', e.target.value)}
              className={inp} />
          }
        />
        <FieldRow
          label="Email"
          value={
            <input type="email" placeholder="email@example.com" value={focalEmail}
              onChange={e => setFocalEmail(e.target.value)}
              onBlur={e => logChange('Email', e.target.value)}
              className={inp} />
          }
        />
      </SectionCard>

      {/* ── Operator Remarks ── */}
      <SectionCard title="Operator Remarks">
        <FieldRow
          label="Remarks"
          value={
            <textarea
              rows={3}
              placeholder="Enter operator remarks, instructions, or observations…"
              value={operatorRemarks}
              onChange={e => setOperatorRemarks(e.target.value)}
              onBlur={e => logChange('Operator Remarks', e.target.value)}
              className={`${inp} resize-y min-h-[72px]`}
            />
          }
        />
      </SectionCard>

      {/* ── Maintenance Notes ── */}
      <SectionCard title="Maintenance Notes">
        <FieldRow
          label="Current Notes"
          value={
            <textarea
              rows={3}
              value={maintenanceNotes}
              onChange={e => setMaintenanceNotes(e.target.value)}
              onBlur={e => logChange('Maintenance Notes', e.target.value)}
              className={`${inp} resize-y min-h-[72px]`}
            />
          }
        />
      </SectionCard>

      {/* ── Access & Security ── */}
      <SectionCard title="Access &amp; Security">
        <FieldRow
          label="Lockbox / Access Code"
          value={
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-[#c9a84c] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <input
                type="text"
                value={accessLockbox}
                onChange={e => setAccessLockbox(e.target.value)}
                placeholder="e.g. Code: 1234 — Floor 3, Door Left"
                className={`${inp} font-mono`}
              />
            </div>
          }
        />
      </SectionCard>

      {/* ── Asset History Tracking ── */}
      <SectionCard title="Asset History Tracking">
        <DocUploadRow
          label="Inspection Report"
          storagePath={assetDocPaths.inspection_report}
          filename={assetDocNames.inspection_report}
          category={`${unitUuid}/asset-history/inspection-report`}
          onChange={(path, name) => setAssetDoc('inspection_report', path, name)}
        />
        <DocUploadRow
          label="Inventory Checklist"
          storagePath={assetDocPaths.inventory_checklist}
          filename={assetDocNames.inventory_checklist}
          category={`${unitUuid}/asset-history/inventory-checklist`}
          onChange={(path, name) => setAssetDoc('inventory_checklist', path, name)}
        />
        <DocUploadRow
          label="Handover Certificate"
          storagePath={assetDocPaths.handover_cert}
          filename={assetDocNames.handover_cert}
          category={`${unitUuid}/asset-history/handover-cert`}
          onChange={(path, name) => setAssetDoc('handover_cert', path, name)}
        />
      </SectionCard>

      {/* ── System Audit Log ── */}
      <SectionCard title="System Audit Log">
        <div className="flex items-center justify-between pb-2 pt-1">
          <span className="text-[11px] text-[#555555]">
            <span className="font-mono text-[#c9a84c]">{dbLog.length}</span> immutable {dbLog.length === 1 ? 'event' : 'events'} · complete record history
          </span>
          <button
            type="button"
            onClick={() => setLogRefreshKey(k => k + 1)}
            className="text-[10px] text-[#555555] hover:text-[#c9a84c] transition-colors font-medium flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
        <SystemUpdateLog entries={dbLog} />
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

const ADMIN_PIN = 'PRIVE2024';

export default function UnitDetailsModal({ unit, onClose }: UnitDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('property');
  const [visible, setVisible] = useState(false);
  const [unitUuid, setUnitUuid] = useState('');
  const [displayStatus, setDisplayStatus] = useState<Status>(unit.status);
  const [copyToast, setCopyToast] = useState(false);
  const [internalToast, setInternalToast] = useState(false);

  // Admin mode — unlocks MOCI License and Unit Number editing
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [pinError, setPinError] = useState('');

  const handleAdminUnlock = () => {
    if (adminPin === ADMIN_PIN) {
      setIsAdmin(true);
      setShowAdminDialog(false);
      setAdminPin('');
      setPinError('');
    } else {
      setPinError('Incorrect PIN. Access denied.');
      setAdminPin('');
    }
  };

  // UUID is now carried on the listing — no extra fetch needed
  useEffect(() => {
    if (unit.uuid) {
      setUnitUuid(unit.uuid);
      logEvent({ unitId: unit.uuid, action: 'RECORD_VIEW', payload: { unitCode: unit.id, property: unit.property, unitNo: unit.unitNo, status: unit.status } });
    }
  }, [unit.uuid]);

  const handleTabChange = (tabId: TabId) => {
    if (unitUuid && tabId !== activeTab) {
      logEvent({ unitId: unitUuid, action: 'TAB_NAVIGATE', tab: tabId, oldValue: activeTab, newValue: tabId });
    }
    setActiveTab(tabId);
  };

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
  const handleCopy = () => {
    navigator.clipboard.writeText(generateInternalCopyText(unit)).then(() => {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2500);
      setInternalToast(true);
      setTimeout(() => setInternalToast(false), 3500);
    });
  };

  const handleWhatsApp = () =>
    window.open(`https://wa.me/?text=${encodeURIComponent(generatePublicShareText(unit))}`, '_blank');

  const handleEmail = () => {
    const subject = encodeURIComponent(`Property Details: ${unit.property} – Unit ${unit.unitNo}`);
    const body = encodeURIComponent(generatePublicShareText(unit));
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
        className={`fixed inset-y-0 right-0 z-50 flex flex-col w-full max-w-2xl bg-[#181818] shadow-2xl transition-transform duration-[280ms] ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* ── Header ── */}
        <div className="shrink-0 bg-slate-900 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[displayStatus]}`}>
                  {displayStatus.replace('_', ' ')}
                </span>
                <span className="text-slate-300 text-xs font-mono">{unit.unitNo}</span>
                <span className="text-slate-400 text-xs">·</span>
                <span className="text-slate-300 text-xs">{unit.zone}</span>
                <span className="text-slate-400 text-xs font-mono">Z{unit.zoneCode}</span>
              </div>
              <h2 className="text-white text-xl font-semibold mt-2 truncate">{unit.property}</h2>
              <p className="text-slate-300 text-sm mt-0.5">
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
          <span className="text-slate-300 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
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
          {/* PDF Report — inline style bypasses [data-theme] CSS override */}
          <button
            onClick={() => { if (unitUuid) window.open(`/report/${unitUuid}`, '_blank'); }}
            disabled={!unitUuid}
            title={unitUuid ? 'Open printable PDF report in new tab' : 'Loading unit data…'}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px',
              background: unitUuid ? '#c9a84c' : '#2a2a2a',
              color: unitUuid ? '#0f0f0f' : '#555555',
              border: 'none',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: unitUuid ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap',
              opacity: unitUuid ? 1 : 0.55,
              transition: 'background 150ms, opacity 150ms',
              flexShrink: 0,
            }}
            onMouseEnter={e => { if (unitUuid) (e.currentTarget as HTMLButtonElement).style.background = '#dfc070'; }}
            onMouseLeave={e => { if (unitUuid) (e.currentTarget as HTMLButtonElement).style.background = '#c9a84c'; }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
            </svg>
            {unitUuid ? 'PDF Report' : 'Loading…'}
          </button>
          <button
            onClick={handleEmail}
            className="flex items-center gap-2 px-3.5 py-1.5 text-[#0f172a] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
            style={{ background: '#38bdf8' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#7dd3fc')}
            onMouseLeave={e => (e.currentTarget.style.background = '#38bdf8')}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Send via Email
          </button>
          <button
            onClick={handleCopy}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${copyToast ? 'bg-emerald-700 text-emerald-100' : 'text-red-300'}`}
            style={copyToast ? {} : { background: '#7f1d1d', border: '1px solid #ef4444' }}
          >
            {copyToast ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </>
            )}
          </button>
          {unit.locationMapUrl && isValidUrl(unit.locationMapUrl) && (
            <a
              href={unit.locationMapUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-3.5 py-1.5 text-[#0f172a] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
              style={{ background: '#4ade80' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#86efac')}
              onMouseLeave={e => (e.currentTarget.style.background = '#4ade80')}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Maps
            </a>
          )}
          {unit.mediaUrl && isValidUrl(unit.mediaUrl) && (
            <a
              href={unit.mediaUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-3.5 py-1.5 text-[#0f172a] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
              style={{ background: '#60a5fa' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#93c5fd')}
              onMouseLeave={e => (e.currentTarget.style.background = '#60a5fa')}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Media
            </a>
          )}
        </div>

        {/* ── Tab Navigation ── */}
        <div className="shrink-0 border-b border-[#2a2a2a] bg-[#181818] px-6">
          <nav className="flex gap-1 overflow-x-auto" role="tablist">
            {TABS.map((tab, i) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-1 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#c9a84c] text-[#c9a84c]'
                    : 'border-transparent text-[#555555] hover:text-[#d0d0d0] hover:border-[#555555]'
                }`}
              >
                <span className="w-5 h-5 rounded-full text-xs flex items-center justify-center bg-[#2a2a2a] text-[#666666] font-semibold shrink-0">
                  {i + 1}
                </span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Tab Content (scrollable) ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-[#181818]" role="tabpanel">
          {activeTab === 'property'    && <PropertyTab unit={unit} unitUuid={unitUuid} isAdmin={isAdmin} onRequestAdmin={() => setShowAdminDialog(true)} onStatusSaved={setDisplayStatus} onAdminLock={() => setIsAdmin(false)} />}
          {activeTab === 'financials'  && <FinancialsTab unit={unit} unitUuid={unitUuid} />}
          {activeTab === 'commission'  && <CommissionTab unit={unit} unitUuid={unitUuid} />}
          {activeTab === 'operational' && <OperationalTab unit={unit} unitUuid={unitUuid} />}
        </div>

        {/* ── Admin PIN Dialog ── */}
        {showAdminDialog && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-xs mx-4 bg-[#181818] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-5 py-4 bg-[#111111] border-b border-[#2a2a2a] flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#e0e0e0]">Admin Access Required</p>
                  <p className="text-[11px] text-[#555555] mt-0.5">Enter PIN to unlock restricted fields</p>
                </div>
              </div>
              <div className="px-5 py-4 space-y-3">
                <input
                  type="password"
                  placeholder="Enter admin PIN…"
                  value={adminPin}
                  onChange={e => { setAdminPin(e.target.value); setPinError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdminUnlock(); if (e.key === 'Escape') { setShowAdminDialog(false); setAdminPin(''); setPinError(''); } }}
                  autoFocus
                  className="w-full text-sm text-[#d0d0d0] bg-[#0d0d0d] border border-[#333333] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 placeholder:text-[#444444] font-mono tracking-widest"
                />
                {pinError && (
                  <p className="text-xs text-red-400 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4M12 16h.01" />
                    </svg>
                    {pinError}
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setShowAdminDialog(false); setAdminPin(''); setPinError(''); }}
                    className="flex-1 py-2 text-sm font-medium text-[#666666] bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg hover:bg-[#252525] hover:text-[#aaaaaa] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAdminUnlock}
                    className="flex-1 py-2 text-sm font-bold text-[#0f0f0f] bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors"
                  >
                    Unlock
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── FOR INTERNAL USE ONLY toast ── */}
      {internalToast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          zIndex: 99999, display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
          background: '#7f1d1d', border: '1px solid #ef4444', color: '#fecaca',
          whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          letterSpacing: '0.05em', textTransform: 'uppercase',
        }}>
          <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          For Internal Use Only
        </div>
      )}
    </>
  );
}
