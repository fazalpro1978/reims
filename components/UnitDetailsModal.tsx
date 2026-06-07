'use client';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — INTEGRATED SLIDE-OUT "VIEW DETAILS" INSPECTION SUITE
// Privé Group RE-IMS · Unit Details Modal
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import { UnitListing, Status, Furnishing, KitchenType } from '../types/inventory';
import { supabase } from '../lib/supabase/client';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function SaveBar({ status, onSave, errorMsg }: { status: SaveStatus; onSave: () => void; errorMsg?: string }) {
  return (
    <div className="flex items-center justify-end gap-3 pt-3 mt-3 border-t border-[#2a2a2a]">
      {status === 'saved'  && <span className="text-xs text-emerald-400">✓ Saved</span>}
      {status === 'error'  && <span className="text-xs text-red-400">{errorMsg ?? 'Save failed'}</span>}
      <button
        onClick={onSave}
        disabled={status === 'saving'}
        className="px-4 py-1.5 text-xs font-semibold bg-[#c9a84c] hover:bg-[#dfc070] text-[#0f0f0f] rounded-lg disabled:opacity-50 transition-colors"
      >
        {status === 'saving' ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  );
}

async function insertAuditLog(unitUuid: string, changes: { field: string; oldValue: string; newValue: string }[]) {
  if (!unitUuid || changes.length === 0) return;
  const rows = changes
    .filter(c => c.oldValue !== c.newValue)
    .map(c => ({ unit_id: unitUuid, field: c.field, old_value: c.oldValue, new_value: c.newValue }));
  if (rows.length === 0) return;
  await supabase.from('audit_log').insert(rows);
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
            <span className="font-mono text-sm bg-[#111111] text-[#c9a84c] px-2.5 py-0.5 rounded">
              {unit.realtorMOCI}
            </span>
          }
        />
        <FieldRow label="Property Name" value={<strong className="font-semibold">{unit.property}</strong>} />
        <FieldRow label="Unit Number" value={<span className="font-mono">{unit.unitNo}</span>} />
        <FieldRow label="District / Area" value={<strong className="font-semibold">{unit.zone}</strong>} />
        <FieldRow label="Zone Code" value={
          <span className="font-mono text-sm bg-[#111111] text-[#c9a84c] px-2.5 py-0.5 rounded">
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
            ? <span className="inline-flex items-center gap-1 text-emerald-400 text-sm font-medium">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
                Included
              </span>
            : <span className="text-[#555555] text-sm">Not included</span>
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
              className="inline-flex items-center gap-1.5 text-[#c9a84c] hover:text-[#dfc070] hover:underline text-sm">
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
              className="inline-flex items-center gap-1.5 text-[#c9a84c] hover:text-[#dfc070] hover:underline text-sm">
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

  const handleSave = async () => {
    setSaveStatus('saving');
    const prev = { rent: unit.rent, agency_fee: unit.agencyFee, service_charges: unit.serviceCharges };
    const { error } = await supabase
      .from('units')
      .update({ rent: monthlyRent, agency_fee: contractCharges, service_charges: additionalCharges })
      .eq('unit_code', unit.id);
    if (error) { setSaveError(error.message); setSaveStatus('error'); return; }
    await insertAuditLog(unitUuid, [
      { field: 'Monthly Rent',       oldValue: String(prev.rent),            newValue: String(monthlyRent) },
      { field: 'Contract Charges',   oldValue: String(prev.agency_fee),      newValue: String(contractCharges) },
      { field: 'Additional Charges', oldValue: String(prev.service_charges), newValue: String(additionalCharges) },
    ]);
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

  const firstMonthTotal = monthlyRent + contractCharges + additionalCharges;

  const bannerRows = [
    { label: 'Monthly Rent',       amount: monthlyRent },
    { label: 'Contract Charges',   amount: contractCharges },
    { label: 'Additional Charges', amount: additionalCharges },
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

interface ClientDocUrls {
  qid: string;
  passport: string;
  cr: string;
  computerCard: string;
}

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

const DOC_TYPES: { key: keyof ClientDocUrls; label: string }[] = [
  { key: 'qid',          label: 'QID' },
  { key: 'passport',     label: 'Passport' },
  { key: 'cr',           label: 'CR' },
  { key: 'computerCard', label: 'Computer Card' },
];

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
  const [docs,                 setDocs]                 = useState<ClientDocUrls>({ qid: '', passport: '', cr: '', computerCard: '' });
  const [uploadedFiles,        setUploadedFiles]        = useState<string[]>([]);
  const [uploadError,          setUploadError]          = useState('');
  const [notes,                setNotes]                = useState('');
  const [saveStatus,           setSaveStatus]           = useState<SaveStatus>('idle');
  const [saveError,            setSaveError]            = useState('');

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    const invalid = files.filter(f => f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf'));
    if (invalid.length > 0) {
      setUploadError(`Only PDF files are accepted. Rejected: ${invalid.map(f => f.name).join(', ')}`);
      return;
    }
    setUploadError('');
    setUploadedFiles(prev => [...prev, ...files.map(f => f.name)]);
  };

  const removeFile = (idx: number) => setUploadedFiles(prev => prev.filter((_, i) => i !== idx));
  const setDoc = (key: keyof ClientDocUrls, val: string) => setDocs(prev => ({ ...prev, [key]: val }));

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

      {/* ── Document Upload URLs ── */}
      <FieldRow
        label="Document Uploads"
        value={
          <div className="w-full space-y-2">
            {DOC_TYPES.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2.5">
                <span className="w-[88px] shrink-0 text-[10px] font-bold text-[#555555] uppercase tracking-wider">
                  {label}
                </span>
                <input
                  type="text"
                  placeholder="URL or file path…"
                  value={docs[key]}
                  onChange={e => setDoc(key, e.target.value)}
                  className="flex-1 min-w-0 text-xs font-mono text-[#c0c0c0] bg-[#111111] border border-[#2a2a2a] rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#c9a84c] focus:border-[#c9a84c] placeholder:text-[#3a3a3a]"
                />
              </div>
            ))}
          </div>
        }
      />

      {/* ── PDF Upload ── */}
      <FieldRow
        label="Upload File"
        value={
          <div className="flex flex-col gap-2.5">
            <label className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-dashed border-[#2e2e2e] hover:border-[#c9a84c] bg-[#0d0d0d] hover:bg-[#c9a84c]/5 cursor-pointer transition-colors w-fit group">
              <svg className="w-4 h-4 text-[#555555] group-hover:text-[#c9a84c] shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              <span className="text-sm text-[#666666] group-hover:text-[#c9a84c] transition-colors">
                Choose PDF file…
              </span>
              <span className="text-[9px] font-bold text-[#484848] bg-[#1a1a1a] border border-[#2a2a2a] px-1.5 py-0.5 rounded uppercase tracking-wider">
                PDF only
              </span>
              <input
                type="file"
                accept=".pdf,application/pdf"
                multiple
                onChange={handleFileUpload}
                className="sr-only"
              />
            </label>

            {uploadError && (
              <p className="flex items-center gap-1.5 text-xs text-red-400">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4M12 16h.01" />
                </svg>
                {uploadError}
              </p>
            )}

            {uploadedFiles.length > 0 && (
              <ul className="space-y-1">
                {uploadedFiles.map((name, i) => (
                  <li key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[#141414] border border-[#222222]">
                    <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" /><path d="M14 2v6h6" />
                    </svg>
                    <span className="flex-1 text-xs font-mono text-[#b0b0b0] truncate">{name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      aria-label={`Remove ${name}`}
                      className="text-[#444444] hover:text-red-400 transition-colors text-lg leading-none shrink-0 px-0.5"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        }
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

type DurationUnit = 'Days' | 'Weeks' | 'Months' | 'Years';

function parseLegalDuration(s: string): { value: number; unit: DurationUnit } {
  const m = s.trim().match(/^(\d+(?:\.\d+)?)\s*(day|days|week|weeks|month|months|year|years)/i);
  if (!m) return { value: 1, unit: 'Years' };
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  if (u.startsWith('day'))   return { value: n, unit: 'Days' };
  if (u.startsWith('week'))  return { value: n, unit: 'Weeks' };
  if (u.startsWith('month')) return { value: n, unit: 'Months' };
  return { value: n, unit: 'Years' };
}

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

  const handleSave = async () => {
    setSaveStatus('saving');
    const legalDuration = `${durationValue} ${durationUnit}`;
    const { error } = await supabase.from('units').update({
      listed_date:         listedDate || null,
      contract_start_date: contractStartDate || null,
      contract_end_date:   contractEndDate || null,
      legal_duration:      legalDuration,
    }).eq('unit_code', unit.id);
    if (error) { setSaveError(error.message); setSaveStatus('error'); return; }
    await insertAuditLog(unitUuid, [
      { field: 'Listed Date',          oldValue: unit.listedDate,          newValue: listedDate },
      { field: 'Contract Start Date',  oldValue: unit.contractStartDate,   newValue: contractStartDate },
      { field: 'Contract End Date',    oldValue: unit.contractEndDate,     newValue: contractEndDate },
      { field: 'Legal Duration',       oldValue: unit.legalDuration,       newValue: legalDuration },
    ]);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2500);
  };

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setLastModified(new Date().toISOString());
  }, [listedDate, contractStartDate, contractEndDate, durationValue, durationUnit]);

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

      {/* Listed Date — editable date picker */}
      <FieldRow
        label="Listed Date"
        value={
          <input
            type="date"
            value={listedDate}
            onChange={e => setListedDate(e.target.value)}
            className={dateInp}
            style={{ colorScheme: 'dark' }}
          />
        }
      />

      {/* Contract Start Date — editable date picker */}
      <FieldRow
        label="Contract Start Date"
        value={
          <input
            type="date"
            value={contractStartDate}
            onChange={e => setContractStartDate(e.target.value)}
            className={dateInp}
            style={{ colorScheme: 'dark' }}
          />
        }
      />

      {/* Contract End Date — editable date picker */}
      <FieldRow
        label="Contract End Date"
        value={
          <input
            type="date"
            value={contractEndDate}
            onChange={e => setContractEndDate(e.target.value)}
            className={dateInp}
            style={{ colorScheme: 'dark' }}
          />
        }
      />

      {/* Contract Duration — numeric input + unit dropdown */}
      <FieldRow
        label="Contract Duration"
        value={
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={durationValue}
              onChange={e => setDurationValue(Math.max(1, Number(e.target.value)))}
              className="w-20 text-center text-sm text-[#d0d0d0] bg-[#111111] border border-[#333333] rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#c9a84c] focus:border-[#c9a84c] tabular-nums"
            />
            <select
              value={durationUnit}
              onChange={e => setDurationUnit(e.target.value as DurationUnit)}
              className="px-3 py-1.5 text-sm bg-[#111111] text-[#d0d0d0] border border-[#333333] rounded-md focus:outline-none focus:ring-2 focus:ring-[#c9a84c] focus:border-[#c9a84c] cursor-pointer"
            >
              {(['Days', 'Weeks', 'Months', 'Years'] as DurationUnit[]).map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState('');

  const handleSave = async () => {
    setSaveStatus('saving');
    const { error } = await supabase.from('unit_commissions').upsert({
      unit_id:              unitUuid,
      agency_fee_applicable: agencyFeeApplicable,
      agency_fee_amount:    agencyFeeApplicable ? agencyFeeAmount : null,
      paid_by:              agencyFeeApplicable ? paidBy : null,
      paid_by_other:        paidBy === 'Other' ? paidByOther : null,
      property_reg_status:  regStatus,
      registration_by:      registrationBy || null,
    }, { onConflict: 'unit_id' });
    if (error) { setSaveError(error.message); setSaveStatus('error'); return; }
    await insertAuditLog(unitUuid, [
      { field: 'Agency Fee Applicable', oldValue: '', newValue: String(agencyFeeApplicable) },
      { field: 'Property Reg Status',   oldValue: '', newValue: regStatus },
    ]);
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

        <FieldRow
          label="Contract Number"
          value={<span className="font-mono text-sm">{unit.mociContractNumber}</span>}
        />

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
  id: string;
  timestamp: string;
  field: string;
  oldValue: string;
  newValue: string;
}

function fmtLogTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
}

function SystemUpdateLog({ entries }: { entries: LogEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="py-6 flex flex-col items-center gap-2 text-center">
        <svg className="w-8 h-8 text-[#2a2a2a]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-[#444444]">No updates recorded yet.</p>
        <p className="text-xs text-[#333333]">Edits to this record will appear here automatically.</p>
      </div>
    );
  }

  return (
    <div className="relative pl-6 py-2">
      {/* Vertical timeline rail */}
      <div className="absolute left-[11px] top-0 bottom-0 w-px bg-[#1e1e1e]" />
      <ul className="space-y-4">
        {entries.map((entry) => (
          <li key={entry.id} className="relative">
            {/* Timeline dot */}
            <span className="absolute -left-[19px] top-[3px] w-2.5 h-2.5 rounded-full bg-[#c9a84c]/25 border border-[#c9a84c]/50 shrink-0" />
            <div className="bg-[#141414] border border-[#1e1e1e] rounded-lg px-3 py-2.5 space-y-1.5">
              {/* Header row */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-semibold text-[#d0d0d0]">{entry.field}</span>
                <span className="text-[10px] font-mono text-[#444444] shrink-0">{fmtLogTime(entry.timestamp)}</span>
              </div>
              {/* Old → new */}
              <div className="flex items-start gap-1.5 text-xs">
                <span className="shrink-0 text-[#3a3a3a] pt-px">from</span>
                <span className="text-[#555555] line-through break-all">{entry.oldValue || <em className="not-italic text-[#3a3a3a]">empty</em>}</span>
              </div>
              <div className="flex items-start gap-1.5 text-xs">
                <span className="shrink-0 text-[#c9a84c]/60 pt-px">to</span>
                <span className="text-[#c0c0c0] break-all">{entry.newValue || <em className="not-italic text-[#3a3a3a]">empty</em>}</span>
              </div>
            </div>
          </li>
        ))}
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

  // ── System Update Log ──────────────────────────────────────────────────────
  const [updateLog, setUpdateLog] = useState<LogEntry[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError,  setSaveError]  = useState('');

  const handleSave = async () => {
    setSaveStatus('saving');
    const { error } = await supabase.from('unit_operational').update({
      focal_point_name:  focalName    || null,
      focal_point_phone: focalPhone   || null,
      focal_point_email: focalEmail   || null,
      operator_remarks:  operatorRemarks || null,
      maintenance_notes: maintenanceNotes || null,
    }).eq('unit_id', unitUuid);
    if (error) { setSaveError(error.message); setSaveStatus('error'); return; }
    // Persist the in-memory log entries to audit_log table
    if (unitUuid && updateLog.length > 0) {
      await supabase.from('audit_log').insert(
        updateLog.map(e => ({
          unit_id:   unitUuid,
          field:     e.field,
          old_value: e.oldValue,
          new_value: e.newValue,
          changed_at: e.timestamp,
        }))
      );
    }
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2500);
  };

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
    setUpdateLog(prev => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: new Date().toISOString(),
        field,
        oldValue,
        newValue,
      },
      ...prev,
    ]);
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
            <span className="inline-flex items-center gap-2 font-mono text-sm bg-[#c9a84c]/10 text-[#c9a84c] border border-[#c9a84c]/30 px-3 py-1.5 rounded-lg">
              <svg className="w-3.5 h-3.5 text-[#c9a84c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              {unit.accessLockbox}
            </span>
          }
        />
      </SectionCard>

      {/* ── Asset History Tracking ── */}
      <SectionCard title="Asset History Tracking">
        {unit.assetHistoryLinks.length === 0 ? (
          <div className="py-4 text-center text-sm text-[#555555]">No asset history documents linked.</div>
        ) : (
          unit.assetHistoryLinks.map((link, i) => (
            <FieldRow
              key={i}
              label={`Asset Record ${i + 1}`}
              value={
                <a href={link} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[#c9a84c] hover:text-[#dfc070] hover:underline text-sm">
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

      {/* ── System Update Log ── */}
      <SectionCard title="System Update Log">
        <div className="flex items-center justify-between px-0 pb-2 pt-1">
          <span className="text-[11px] text-[#444444]">
            {updateLog.length} {updateLog.length === 1 ? 'entry' : 'entries'} this session
          </span>
          {updateLog.length > 0 && (
            <button
              type="button"
              onClick={() => setUpdateLog([])}
              className="text-[10px] text-[#444444] hover:text-red-400 transition-colors font-medium"
            >
              Clear log
            </button>
          )}
        </div>
        <SystemUpdateLog entries={updateLog} />
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
  const [unitUuid, setUnitUuid] = useState('');

  // Fetch the DB UUID for this unit once on open (needed for child table writes)
  useEffect(() => {
    supabase.from('units').select('id').eq('unit_code', unit.id).single()
      .then(({ data }) => { if (data) setUnitUuid((data as { id: string }).id); });
  }, [unit.id]);

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
        className={`fixed inset-y-0 right-0 z-50 flex flex-col w-full max-w-2xl bg-[#181818] shadow-2xl transition-transform duration-[280ms] ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}
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
        <div className="shrink-0 border-b border-[#2a2a2a] bg-[#181818] px-6">
          <nav className="flex gap-1 overflow-x-auto" role="tablist">
            {TABS.map((tab, i) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
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
          {activeTab === 'property'    && <PropertyTab unit={unit} />}
          {activeTab === 'financials'  && <FinancialsTab unit={unit} unitUuid={unitUuid} />}
          {activeTab === 'commission'  && <CommissionTab unit={unit} unitUuid={unitUuid} />}
          {activeTab === 'operational' && <OperationalTab unit={unit} unitUuid={unitUuid} />}
        </div>

        {/* ── Footer Share Action Bar ── */}
        <div className="shrink-0 border-t border-[#2a2a2a] bg-[#111111] px-6 py-4">
          <p className="text-xs text-[#555555] mb-3 font-medium">
            Auto-generated payload:{' '}
            <span className="text-[#888888] italic">
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
              className="px-4 py-2.5 flex items-center justify-center gap-1.5 text-sm font-medium text-[#888888] hover:text-[#c9a84c] border border-[#333333] rounded-lg hover:bg-[#2a2a2a] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Maps
            </a>
            <a
              href={unit.mediaUrl} target="_blank" rel="noopener noreferrer"
              className="px-4 py-2.5 flex items-center justify-center gap-1.5 text-sm font-medium text-[#888888] hover:text-[#c9a84c] border border-[#333333] rounded-lg hover:bg-[#2a2a2a] transition-colors"
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
