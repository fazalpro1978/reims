'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import TopBar from './TopBar';
import UnitDetailsModal from './UnitDetailsModal';
import { supabase } from '../lib/supabase/client';
import { authedFetch } from '../lib/authedFetch';
import { useAuth } from '../contexts/AuthContext';
import { generatePublicShareText } from '../lib/shareUtils';
import {
  UnitListing, UnitType, Furnishing, Status,
  ListingType, KitchenType, MociContractStatus,
} from '../types/inventory';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssignedUnit {
  id: string;
  unit_code: string;
  unit_no: string;
  property: string;
}

interface Inquiry {
  id: string;
  ref_no: string;
  client_name: string;
  client_phone?: string;
  client_email?: string;
  client_nationality?: string;
  source?: string;
  listing_type?: string;
  property_type?: string;
  config?: string;
  bathrooms_min?: number;
  budget_min?: number;
  budget_max?: number;
  preferred_zones?: string[];
  furnishing?: string;
  status: 'new' | 'contacted' | 'viewing' | 'negotiating' | 'won' | 'lost' | 'cancelled' | 'closed';
  status_changed_at?: string | null;
  assigned_agent?: string;
  staff_email?: string | null;
  staff_name?: string | null;
  staff_assigned_at?: string | null;
  assigned_unit_id?: string | null;
  assigned_unit?: AssignedUnit | null;
  assigned_unit_id_2?: string | null;
  assigned_unit2?: AssignedUnit | null;
  assigned_unit_id_3?: string | null;
  assigned_unit3?: AssignedUnit | null;
  move_in_date?: string | null;
  bills_included?: string | null;
  size?: number | null;
  follow_up_date?: string;
  notes?: string;
  last_matched_at?: string;
  match_count: number;
  created_at: string;
}

interface InquiryMatch {
  id: string;
  inquiry_id: string;
  unit_id: string;
  unit_code: string;
  unit_snapshot: {
    property: string; unit_no: string; zone: string; zone_code: number;
    type: string; config: string; rent: number; bathrooms: number;
    furnishing: string; status: string; listing_type: string;
  };
  match_tier: 1 | 2 | 3;
  match_score: number;
  match_reasons: {
    budget: 'exact' | 'flex' | false;
    type: boolean | null;
    config: boolean | null;
    bathrooms: boolean | null;
    zone: 'exact' | false | null;
    furnishing: boolean | null;
  };
  is_shortlisted: boolean;
  shortlisted_at?: string;
  computed_at: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string;
  inquiry_id?: string;
  is_read: boolean;
  created_at: string;
}

interface AgentProfile {
  agent_code: string;
  full_name: string;
}

interface StaffProfile {
  email: string;
  full_name: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('en-QA');

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  new:          { label: 'New',          color: '#94a3b8', bg: '#1e293b' },
  contacted:    { label: 'Contacted',    color: '#38bdf8', bg: '#0c1a26' },
  viewing:      { label: 'Viewing',      color: '#fbbf24', bg: '#1a1500' },
  negotiating:  { label: 'Negotiating', color: '#fb923c', bg: '#1a0f00' },
  won:          { label: 'Won',          color: '#4ade80', bg: '#0a1a0a' },
  lost:         { label: 'Lost',         color: '#f87171', bg: '#1a0a0a' },
  cancelled:    { label: 'Cancelled',    color: '#6b7280', bg: '#111827' },
  closed:       { label: 'Closed',       color: '#a78bfa', bg: '#1e1b4b' },
};

const TIER_META = {
  1: { label: 'T1', color: '#4ade80', title: 'Exact Match' },
  2: { label: 'T2', color: '#fbbf24', title: '±10% Flex'  },
  3: { label: 'T3', color: '#94a3b8', title: 'Zone Buffer' },
};

const SOURCES = ['Walk-in','WhatsApp','Website','Referral','Bayut','Property Finder','Phone','Other'];
const STATUSES = ['new','contacted','viewing','negotiating','won','lost','cancelled','closed'];
const PROPERTY_TYPES = ['Apartment','Villa','Townhouse','Penthouse','Studio','Duplex','Office'];
const FURNISHING_OPTS = ['Fully Furnished','Semi-Furnished','Unfurnished'];

function Badge({ label, color, bg }: { label: string; color: string; bg?: string }) {
  return (
    <span style={{ color, background: bg ?? `${color}22`, border: `1px solid ${color}44` }}
      className="text-[10px] font-bold px-2 py-0.5 rounded-full">
      {label}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? '#4ade80' : score >= 40 ? '#fbbf24' : '#f87171';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-[#222] rounded-full overflow-hidden">
        <div style={{ width: `${score}%`, background: color }} className="h-full rounded-full" />
      </div>
      <span style={{ color }} className="text-[10px] font-bold">{score}%</span>
    </div>
  );
}

function ElapsedCounter({ since, status }: { since: string; status: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const ms   = now - new Date(since).getTime();
  const days = Math.floor(ms / 86_400_000);
  const hrs  = Math.floor((ms % 86_400_000) / 3_600_000);
  const mins = Math.floor((ms % 3_600_000)  / 60_000);
  const terminal = ['won', 'lost', 'cancelled', 'closed'].includes(status);
  const color = terminal      ? '#2a2a2a'
    : days >= 7               ? '#f87171'
    : days >= 3               ? '#fbbf24'
    : '#444';
  const label = days > 0 ? `${days}d ${hrs}h in stage`
    : hrs  > 0 ? `${hrs}h ${mins}m in stage`
    : `${mins}m in stage`;
  return <span style={{ color }} className="text-[9px] font-mono tabular-nums">{label}</span>;
}

// ─── Agent Search (mirrors CodeRegistry AgentSearch) ─────────────────────────

function AgentSearch({
  agents, value, onSelect, onNewAgent,
}: {
  agents: AgentProfile[];
  value: string;
  onSelect: (code: string) => void;
  onNewAgent: (a: AgentProfile) => void;
}) {
  const [open,     setOpen]     = useState(false);
  const [q,        setQ]        = useState('');
  const [showForm, setShowForm] = useState(false);
  const [newName,  setNewName]  = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [adding,   setAdding]   = useState(false);
  const [addErr,   setAddErr]   = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = agents.find(a => a.agent_code === value);
  const filtered = q
    ? agents.filter(a =>
        a.full_name.toLowerCase().includes(q.toLowerCase()) ||
        a.agent_code.toLowerCase().includes(q.toLowerCase()))
    : agents;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function handleAdd() {
    if (!newName.trim()) return;
    setAdding(true); setAddErr('');
    try {
      const res  = await fetch('/api/code-registry/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: newName.trim(), email: newEmail.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setAddErr('Failed to register agent. Try again.'); return; }
      const a: AgentProfile = { agent_code: json.agentCode, full_name: json.fullName };
      onNewAgent(a);
      onSelect(json.agentCode);
      setShowForm(false); setNewName(''); setNewEmail(''); setOpen(false);
    } finally { setAdding(false); }
  }

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen(o => !o)}
        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-sm rounded-lg px-3 py-2.5 cursor-pointer flex items-center justify-between hover:border-[#3a3a3a] transition-colors"
      >
        <span className={selected ? 'text-[#e0e0e0]' : 'text-[#555]'}>
          {selected
            ? <><span className="font-mono text-[#22c55e] mr-2">{selected.agent_code}</span>{selected.full_name}</>
            : 'Select agent…'}
        </span>
        <svg className="w-4 h-4 text-[#555] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-[#161616] border border-[#2a2a2a] rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-[#1e1e1e]">
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search agent name or code…"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#e0e0e0] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c]/60 placeholder-[#555]"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map(a => (
              <div
                key={a.agent_code}
                onClick={() => { onSelect(a.agent_code); setOpen(false); setQ(''); }}
                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#1e1e1e] transition-colors ${value === a.agent_code ? 'bg-[#1e1e1e]' : ''}`}
              >
                <span className="font-mono text-xs text-[#22c55e] w-6 shrink-0">{a.agent_code}</span>
                <p className="text-sm text-[#e0e0e0] truncate">{a.full_name}</p>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-sm text-[#555] text-center">No agents found</p>
            )}
          </div>
          <div className="border-t border-[#1e1e1e] p-2">
            {!showForm ? (
              <button
                onClick={() => { setShowForm(true); setAddErr(''); }}
                className="w-full text-sm text-[#c9a84c] hover:text-[#dfc070] py-2 flex items-center justify-center gap-2 transition-colors"
              >
                <span className="text-lg leading-none">+</span> Register New Agent
              </button>
            ) : (
              <div className="space-y-2 p-1">
                <input
                  autoFocus
                  value={newName}
                  onChange={e => { setNewName(e.target.value); setAddErr(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setShowForm(false); setNewName(''); setNewEmail(''); } }}
                  placeholder="Full name (e.g. Mohammed Al-Rashid)…"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#e0e0e0] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c]/60 placeholder-[#555]"
                />
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="Email for assignment notifications (optional)…"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#e0e0e0] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c]/60 placeholder-[#555]"
                />
                {addErr && <p className="text-[11px] text-[#ef4444]">{addErr}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleAdd}
                    disabled={adding || !newName.trim()}
                    className="flex-1 bg-[#c9a84c] hover:bg-[#dfc070] disabled:opacity-40 text-[#0f0f0f] text-sm font-bold py-2 rounded-lg transition-colors"
                  >
                    {adding ? 'Registering…' : 'Register'}
                  </button>
                  <button
                    onClick={() => { setShowForm(false); setNewName(''); setNewEmail(''); setAddErr(''); }}
                    className="px-3 text-[#888] hover:text-[#e0e0e0] text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                <p className="text-[10px] text-[#555]">Agent code auto-assigned from initials.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Staff Search (handler assignment for admins) ────────────────────────────

function StaffSearch({
  value, staffName, onSelect,
}: {
  value: string;
  staffName: string | null;
  onSelect: (email: string, name: string) => void;
}) {
  const [open,  setOpen]  = useState(false);
  const [q,     setQ]     = useState('');
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    authedFetch('/api/admin/users').then(r => r.json()).then(d => {
      setStaff((d.users ?? []).filter((u: { role: string; is_active: boolean }) => u.role === 'staff' && u.is_active));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = q
    ? staff.filter(s =>
        (s.full_name ?? '').toLowerCase().includes(q.toLowerCase()) ||
        s.email.toLowerCase().includes(q.toLowerCase()))
    : staff;

  if (!open) {
    return (
      <button
        onClick={() => { setQ(''); setOpen(true); }}
        className="w-full flex items-center gap-2 px-2 py-1 rounded-lg bg-[#0f0f0f] border border-[#1e1e1e] hover:border-[#c9a84c44] transition-colors text-left"
      >
        {value ? (
          <>
            <div className="w-5 h-5 rounded-full bg-[#c9a84c22] border border-[#c9a84c44] flex items-center justify-center shrink-0">
              <span className="text-[8px] font-bold text-[#c9a84c]">S</span>
            </div>
            <span className="text-xs text-[#ccc] truncate">{staffName ?? value}</span>
          </>
        ) : (
          <span className="text-[11px] text-[#444]">Assign handler…</span>
        )}
      </button>
    );
  }

  return (
    <div ref={ref} className="border border-[#333] rounded-lg bg-[#0a0a0a] overflow-hidden">
      <input
        autoFocus
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search staff…"
        className="w-full px-3 py-2 bg-transparent text-xs text-[#e0e0e0] outline-none border-b border-[#1a1a1a] placeholder-[#444]"
      />
      <div className="max-h-32 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-[11px] text-[#444] px-3 py-2">No staff found</p>
        ) : filtered.map(s => (
          <button
            key={s.email}
            onClick={() => { onSelect(s.email, s.full_name ?? s.email); setOpen(false); setQ(''); }}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#111] text-left transition-colors"
          >
            <div className="w-5 h-5 rounded-full bg-[#c9a84c22] border border-[#c9a84c44] flex items-center justify-center shrink-0">
              <span className="text-[8px] font-bold text-[#c9a84c]">S</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-[#ccc] truncate">{s.full_name ?? s.email}</p>
              <p className="text-[10px] text-[#555] truncate">{s.email}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Unit Search (searchable relational picker for inquiries) ────────────────

function UnitSearch({
  value, onSelect,
}: {
  value: AssignedUnit | null;
  onSelect: (unit: AssignedUnit | null) => void;
}) {
  const [open,    setOpen]    = useState(false);
  const [q,       setQ]       = useState('');
  const [results, setResults] = useState<AssignedUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (!term) { setResults([]); return; }

    const timer = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from('units')
        .select('id, unit_code, unit_no, property')
        .or(`unit_no.ilike.%${term}%,unit_code.ilike.%${term}%,property.ilike.%${term}%`)
        .eq('status', 'Available')
        .limit(10);
      setResults((data ?? []) as AssignedUnit[]);
      setLoading(false);
    }, 280);

    return () => clearTimeout(timer);
  }, [q, open]);

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => { setOpen(o => !o); setQ(''); setResults([]); }}
        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-sm rounded-lg px-3 py-2.5 cursor-pointer flex items-center justify-between hover:border-[#3a3a3a] transition-colors"
      >
        <span className={value ? 'text-[#e0e0e0]' : 'text-[#555]'}>
          {value
            ? <><span className="font-mono text-[#c9a84c] mr-2">{value.unit_code}</span>{value.unit_no} · {value.property}</>
            : 'Search by unit no., code or property…'}
        </span>
        <svg className="w-4 h-4 text-[#555] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-[#161616] border border-[#2a2a2a] rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-[#1e1e1e]">
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Type unit no., asset code or property…"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#e0e0e0] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c]/60 placeholder-[#555]"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-4">
                <span className="w-4 h-4 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : results.length > 0 ? results.map(u => (
              <div
                key={u.id}
                onClick={() => { onSelect(u); setOpen(false); setQ(''); }}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#1e1e1e] transition-colors"
              >
                <span className="font-mono text-xs text-[#c9a84c] shrink-0 w-20 truncate">{u.unit_code}</span>
                <div className="min-w-0">
                  <p className="text-sm text-[#e0e0e0] truncate">{u.unit_no}</p>
                  <p className="text-[10px] text-[#555] truncate">{u.property}</p>
                </div>
              </div>
            )) : q.trim() ? (
              <p className="px-3 py-3 text-sm text-[#555] text-center">No available units found</p>
            ) : (
              <p className="px-3 py-3 text-sm text-[#555] text-center">Start typing to search…</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Unit row mapper (mirrors UnitsInventory mapping) ────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbRowToUnit(row: any): UnitListing {
  return {
    id:                  row.unit_code ?? '',
    uuid:                row.id        ?? '',
    realtorName:         row.realtor_name        ?? '',
    realtorMOCI:         row.realtor_moci         ?? '',
    property:            row.property             ?? '',
    unitNo:              row.unit_no              ?? '',
    zoneCode:            Number(row.zone_code)    || 0,
    zone:                row.zone                 ?? '',
    type:                (row.type                ?? 'Apartment') as UnitType,
    config:              row.config               ?? '',
    bathrooms:           Number(row.bathrooms)    || 0,
    parking:             row.parking              ?? false,
    amenities:           row.amenities            ?? [],
    kitchen:             (row.kitchen             ?? 'Open') as KitchenType,
    furnishing:          (row.furnishing          ?? 'Unfurnished') as Furnishing,
    listingType:         (row.listing_type        ?? 'Rent') as ListingType,
    status:              (row.status              ?? 'Available') as Status,
    rent:                Number(row.rent)         || 0,
    serviceCharges:      Number(row.service_charges) || 0,
    depositAmount:       Number(row.deposit_amount)  || 0,
    agencyFee:           Number(row.agency_fee)      || 0,
    kahramaaApplicable:  row.kahramaa_applicable   ?? true,
    kahramaaAmount:      Number(row.kahramaa_amount) || 2000,
    qatarCoolApplicable: row.qatar_cool_applicable ?? true,
    qatarCoolAmount:     Number(row.qatar_cool_amount) || 3000,
    marafeqApplicable:   row.marafeq_applicable    ?? true,
    marafeqAmount:       Number(row.marafeq_amount)   || 3000,
    mociContractStatus:  (row.moci_contract_status ?? '') as MociContractStatus,
    mociContractNumber:  row.moci_contract_number  ?? '',
    legalDuration:       row.legal_duration        ?? '',
    contractStartDate:   row.contract_start_date   ?? '',
    contractEndDate:     row.contract_end_date      ?? '',
    maintenanceNotes:    row.unit_operational?.[0]?.maintenance_notes ?? '',
    accessLockbox:       row.unit_operational?.[0]?.access_lockbox    ?? '',
    assetHistoryLinks:   row.asset_history_links   ?? [],
    locationMapUrl:      row.location_map_url       ?? '',
    mediaUrl:            row.media_url              ?? '',
    listedDate:          row.listed_date            ?? '',
    lastUpdated:         row.updated_at             ?? '',
    aliasCode:           row.alias_code             ?? undefined,
  };
}

// ─── AI Extract Panel ─────────────────────────────────────────────────────────

function AIExtractPanel({ onExtract }: { onExtract: (data: Record<string, string>) => void }) {
  const [mode,         setMode]         = useState<'text' | 'image'>('text');
  const [text,         setText]         = useState('');
  const [imageFile,    setImageFile]    = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [fieldCount,   setFieldCount]   = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setFieldCount(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setFieldCount(null);
    }
  };

  const handleExtract = async () => {
    setLoading(true);
    setError(null);
    setFieldCount(null);
    try {
      let res: Response;
      if (mode === 'text') {
        res = await fetch('/api/inquiries/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
      } else {
        if (!imageFile) { setError('Please select an image first.'); setLoading(false); return; }
        const form = new FormData();
        form.append('image', imageFile);
        res = await fetch('/api/inquiries/extract', { method: 'POST', body: form });
      }
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error ?? 'Extraction failed'); return; }
      const count = Object.keys(data.extracted ?? {}).length;
      setFieldCount(count);
      onExtract(data.extracted ?? {});
    } catch {
      setError('Network error — check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const canExtract = mode === 'text' ? text.trim().length > 0 : imageFile !== null;

  return (
    <div className="mb-5 border border-[#1e3a2a] bg-[#080f0a] rounded-xl overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e3a2a]">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth={2} className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-xs font-bold text-[#4ade80]">AI Extract</span>
          <span className="text-[9px] text-[#2a5a3a] bg-[#122018] border border-[#1e3a2a] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide">Beta</span>
        </div>
        <div className="flex bg-[#111] border border-[#222] rounded-lg overflow-hidden text-[11px]">
          {(['text', 'image'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 py-1.5 font-semibold capitalize transition-colors ${mode === m ? 'bg-[#4ade80] text-[#0a0a0a]' : 'text-[#555] hover:text-[#aaa]'}`}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Panel body */}
      <div className="p-4 space-y-3">
        {mode === 'text' ? (
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Paste WhatsApp conversation or client message here…"
            rows={4}
            className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-[#e0e0e0] text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#4ade8066] placeholder-[#383838] resize-none"
          />
        ) : (
          <div>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#2a2a2a] rounded-xl p-6 text-center cursor-pointer hover:border-[#4ade8044] hover:bg-[#0d1a0f] transition-colors"
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="max-h-28 mx-auto rounded-lg object-contain" />
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#3a5a48" strokeWidth={1.5} className="w-8 h-8 mx-auto mb-2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 16M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xs text-[#555]">Drag & drop screenshot or click to browse</p>
                  <p className="text-[10px] text-[#333] mt-0.5">PNG · JPG · WEBP</p>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            {imageFile && (
              <button onClick={() => { setImageFile(null); setImagePreview(null); setFieldCount(null); }}
                className="mt-1.5 text-[10px] text-[#555] hover:text-[#f87171] transition-colors">
                Remove image
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            {error    && <p className="text-xs text-[#f87171] truncate">{error}</p>}
            {!error && fieldCount !== null && (
              <p className="text-xs text-[#4ade80]">
                {fieldCount} field{fieldCount !== 1 ? 's' : ''} extracted — review below before saving
              </p>
            )}
          </div>
          <button
            onClick={handleExtract}
            disabled={loading || !canExtract}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#4ade80] text-[#0a0a0a] text-xs font-bold rounded-lg hover:bg-[#22c55e] disabled:opacity-40 transition-colors shrink-0"
          >
            {loading ? (
              <>
                <span className="w-3 h-3 border-2 border-[#0a0a0a] border-t-transparent rounded-full animate-spin" />
                Extracting…
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Extract & Fill
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Inquiry Form ─────────────────────────────────────────────────────────────

function FieldWrapper({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs text-[#888] mb-1">{label}{required && <span className="text-rose-400 ml-0.5">*</span>}</label>
      {children}
    </div>
  );
}

const INP_CLS = "w-full bg-[#111] border border-[#2a2a2a] text-[#e0e0e0] text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#f43f5e] placeholder-[#444]";
const SEL_CLS = `${INP_CLS} cursor-pointer`;

const EMPTY_FORM = {
  client_name: '', client_phone: '', client_email: '', client_nationality: '',
  source: '', listing_type: 'Rent', property_type: '', config: '',
  bathrooms_min: '', budget_min: '', budget_max: '', size: '',
  preferred_zones: '', furnishing: '',
  follow_up_date: '', move_in_date: '', bills_included: '', notes: '',
};

function InquiryForm({ onSave, onCancel, initial, formError, mergeFields, mergeRevision }: {
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  initial?: Partial<typeof EMPTY_FORM>;
  formError?: string | null;
  mergeFields?: Record<string, string>;
  mergeRevision?: number;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const [saving, setSaving] = useState(false);
  const prevRevision = useRef<number | undefined>(mergeRevision);

  useEffect(() => {
    if (mergeRevision !== undefined && mergeRevision !== prevRevision.current && mergeFields) {
      prevRevision.current = mergeRevision;
      setForm(p => ({ ...p, ...mergeFields }));
    }
  }, [mergeRevision, mergeFields]);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload: Record<string, unknown> = {
      client_name:        form.client_name.trim(),
      client_phone:       form.client_phone        || null,
      client_email:       form.client_email        || null,
      client_nationality: form.client_nationality  || null,
      source:             form.source              || null,
      listing_type:       form.listing_type        || null,
      property_type:      form.property_type       || null,
      config:             form.config              || null,
      bathrooms_min:      form.bathrooms_min  ? Number(form.bathrooms_min)  : null,
      budget_min:         form.budget_min     ? Number(form.budget_min)     : null,
      budget_max:         form.budget_max     ? Number(form.budget_max)     : null,
      preferred_zones:    form.preferred_zones
        ? form.preferred_zones.split(',').map(z => z.trim()).filter(Boolean)
        : [],
      furnishing:         form.furnishing          || null,
      follow_up_date:     form.follow_up_date      || null,
      move_in_date:       form.move_in_date        || null,
      bills_included:     form.bills_included      || null,
      size:               form.size ? Number(form.size) : null,
      notes:              form.notes               || null,
      // assigned_agent is not collected here; set by admin after matching
    };
    await onSave(payload);
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <FieldWrapper label="Client Name" required>
          <input required value={form.client_name} onChange={e => set('client_name', e.target.value)} className={INP_CLS} placeholder="Full name" />
        </FieldWrapper>
        <FieldWrapper label="Phone">
          <input value={form.client_phone} onChange={e => set('client_phone', e.target.value)} className={INP_CLS} placeholder="+974 xxxx xxxx" />
        </FieldWrapper>
        <FieldWrapper label="Email">
          <input type="email" value={form.client_email} onChange={e => set('client_email', e.target.value)} className={INP_CLS} placeholder="email@example.com" />
        </FieldWrapper>
        <FieldWrapper label="Nationality">
          <input value={form.client_nationality} onChange={e => set('client_nationality', e.target.value)} className={INP_CLS} placeholder="e.g. Qatari" />
        </FieldWrapper>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FieldWrapper label="Source">
          <select value={form.source} onChange={e => set('source', e.target.value)} className={SEL_CLS}>
            <option value="">Select source</option>
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </FieldWrapper>
        <FieldWrapper label="Listing Type">
          <select value={form.listing_type} onChange={e => set('listing_type', e.target.value)} className={SEL_CLS}>
            <option value="Rent">Rent</option>
            <option value="Sale">Sale</option>
            <option value="Buy">Buy</option>
          </select>
        </FieldWrapper>
      </div>

      <div className="border-t border-[#1e1e1e] pt-4">
        <p className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-3">Requirements</p>
        <div className="grid grid-cols-2 gap-4">
          <FieldWrapper label="Property Type">
            <select value={form.property_type} onChange={e => set('property_type', e.target.value)} className={SEL_CLS}>
              <option value="">Any</option>
              {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </FieldWrapper>
          <FieldWrapper label="Configuration">
            <input value={form.config} onChange={e => set('config', e.target.value)} className={INP_CLS} placeholder="e.g. 2 BHK, Studio" />
          </FieldWrapper>
          <FieldWrapper label="Min Bathrooms">
            <input type="number" min={0} value={form.bathrooms_min} onChange={e => set('bathrooms_min', e.target.value)} className={INP_CLS} placeholder="e.g. 2" />
          </FieldWrapper>
          <FieldWrapper label="Furnishing">
            <select value={form.furnishing} onChange={e => set('furnishing', e.target.value)} className={SEL_CLS}>
              <option value="">Any</option>
              {FURNISHING_OPTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </FieldWrapper>
          <FieldWrapper label="Budget Min (QAR)">
            <input type="number" min={0} value={form.budget_min} onChange={e => set('budget_min', e.target.value)} className={INP_CLS} placeholder="e.g. 5000" />
          </FieldWrapper>
          <FieldWrapper label="Budget Max (QAR)">
            <input type="number" min={0} value={form.budget_max} onChange={e => set('budget_max', e.target.value)} className={INP_CLS} placeholder="e.g. 8000" />
          </FieldWrapper>
          <FieldWrapper label="Size (sqm)">
            <input type="number" min={0} value={form.size} onChange={e => set('size', e.target.value)} className={INP_CLS} placeholder="e.g. 120" />
          </FieldWrapper>
          <FieldWrapper label="Bills">
            <select value={form.bills_included} onChange={e => set('bills_included', e.target.value)} className={SEL_CLS}>
              <option value="">Any</option>
              <option value="Including">Including</option>
              <option value="Excluding">Excluding</option>
              <option value="Negotiable">Negotiable</option>
            </select>
          </FieldWrapper>
        </div>
        <div className="mt-4">
          <FieldWrapper label="Preferred Zones (comma-separated)">
            <input value={form.preferred_zones} onChange={e => set('preferred_zones', e.target.value)} className={INP_CLS} placeholder="e.g. The Pearl, West Bay, Lusail" />
          </FieldWrapper>
        </div>
      </div>

      <div className="border-t border-[#1e1e1e] pt-4">
        <p className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-3">Scheduling</p>
        <div className="grid grid-cols-2 gap-4">
          <FieldWrapper label="Follow-up Date">
            <input type="date" value={form.follow_up_date} onChange={e => set('follow_up_date', e.target.value)} className={INP_CLS} />
          </FieldWrapper>
          <FieldWrapper label="Move-in Date">
            <input type="date" value={form.move_in_date} onChange={e => set('move_in_date', e.target.value)} className={INP_CLS} />
          </FieldWrapper>
        </div>
        <div className="mt-4">
          <FieldWrapper label="Notes">
            <textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} className={`${INP_CLS} resize-none`} placeholder="Additional notes..." />
          </FieldWrapper>
        </div>
      </div>

      {/* Agent assignment happens post-matching — a note to set expectations */}
      <p className="text-[11px] text-[#444] border border-[#1e1e1e] rounded-lg px-3 py-2">
        Agent assignment is available in the inquiry drawer after a property match is confirmed.
      </p>

      {formError && (
        <div className="px-3 py-2 rounded-lg bg-[#f43f5e15] border border-[#f43f5e44] text-xs text-[#f87171]">
          {formError}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-[#888] hover:text-[#ccc] transition-colors">Cancel</button>
        <button type="submit" disabled={saving} className="px-5 py-2 bg-[#f43f5e] text-white text-sm font-semibold rounded-lg hover:bg-[#e11d48] disabled:opacity-40 transition-colors">
          {saving ? 'Saving…' : 'Save Inquiry'}
        </button>
      </div>
    </form>
  );
}

// ─── Matching Units Grid ───────────────────────────────────────────────────────

const SCORE_THRESHOLD_ACTIONS  = 50;   // "View Details" deep-link
const SCORE_THRESHOLD_PREMIUM  = 80;   // Full sharing suite

function MatchingGrid({ inquiryId, clientEmail }: {
  inquiryId:   string;
  clientEmail?: string;
}) {
  const [matches,     setMatches]     = useState<InquiryMatch[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [running,     setRunning]     = useState(false);
  const [filter,      setFilter]      = useState<'all' | 1 | 2 | 3>('all');
  const [previewUnit, setPreviewUnit] = useState<UnitListing | null>(null);
  const [fetchingId,  setFetchingId]  = useState<string | null>(null);

  const unitCache = useRef<Map<string, UnitListing>>(new Map());

  const loadMatches = useCallback(async () => {
    setLoading(true);
    const res  = await fetch(`/api/inquiries/${inquiryId}/match`);
    const data = await res.json();
    setMatches(data.matches ?? []);
    setLoading(false);
  }, [inquiryId]);

  useEffect(() => { loadMatches(); }, [loadMatches]);

  const rerun = async () => {
    setRunning(true);
    await fetch(`/api/inquiries/${inquiryId}/match`, { method: 'POST' });
    await loadMatches();
    setRunning(false);
  };

  const toggleShortlist = async (match: InquiryMatch) => {
    const res  = await fetch(`/api/inquiries/${inquiryId}/shortlist`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId: match.id, shortlisted: !match.is_shortlisted }),
    });
    const data = await res.json();
    if (data.match) {
      setMatches(prev => prev.map(m => m.id === match.id ? { ...m, is_shortlisted: data.match.is_shortlisted } : m));
    }
  };

  // Fetch full unit from DB, cache by unitId to avoid repeat fetches
  const fetchUnit = useCallback(async (unitId: string): Promise<UnitListing | null> => {
    if (unitCache.current.has(unitId)) return unitCache.current.get(unitId)!;
    setFetchingId(unitId);
    const { data, error } = await supabase
      .from('units')
      .select('*, unit_operational (maintenance_notes, access_lockbox)')
      .eq('id', unitId)
      .single();
    setFetchingId(null);
    if (error || !data) return null;
    const unit = mapDbRowToUnit(data);
    unitCache.current.set(unitId, unit);
    return unit;
  }, []);

  const handleViewDetails = async (unitId: string | null) => {
    if (!unitId) return;
    const unit = await fetchUnit(unitId);
    if (unit) setPreviewUnit(unit);
  };

  const handleWhatsApp = async (unitId: string | null) => {
    if (!unitId) return;
    const unit = await fetchUnit(unitId);
    if (!unit) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(generatePublicShareText(unit))}`, '_blank');
  };

  const handlePdf = (unitId: string | null) => {
    if (!unitId) return;
    window.open(`/report/${unitId}`, '_blank');
  };

  const handleEmail = async (unitId: string | null) => {
    if (!unitId) return;
    const unit = await fetchUnit(unitId);
    if (!unit) return;
    const subject = unit.aliasCode
      ? encodeURIComponent(`Match Found — Ref ${unit.aliasCode} · Privé Group Real Estate`)
      : encodeURIComponent(`Property Details: ${unit.property} – Unit ${unit.unitNo}`);
    const body = encodeURIComponent(generatePublicShareText(unit));
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const visible    = filter === 'all' ? matches : matches.filter(m => m.match_tier === filter);
  const shortlisted = matches.filter(m => m.is_shortlisted).length;
  const tier1      = matches.filter(m => m.match_tier === 1).length;
  const tier2      = matches.filter(m => m.match_tier === 2).length;
  const tier3      = matches.filter(m => m.match_tier === 3).length;

  return (
    <>
    <div className="flex flex-col h-full">
      {/* Grid header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-[#e0e0e0]">Matching Units</h3>
          <div className="flex gap-1.5">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#4ade8022] text-[#4ade80] border border-[#4ade8044]">T1 {tier1}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#fbbf2422] text-[#fbbf24] border border-[#fbbf2444]">T2 {tier2}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#94a3b822] text-[#94a3b8] border border-[#94a3b844]">T3 {tier3}</span>
            {shortlisted > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f43f5e22] text-[#f43f5e] border border-[#f43f5e44]">⭐ {shortlisted}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[#111] border border-[#222] rounded-lg overflow-hidden text-xs">
            {(['all', 1, 2, 3] as const).map(t => (
              <button key={t} onClick={() => setFilter(t)}
                className={`px-3 py-1.5 font-medium transition-colors ${filter === t ? 'bg-[#f43f5e] text-white' : 'text-[#666] hover:text-[#ccc]'}`}>
                {t === 'all' ? 'All' : `T${t}`}
              </button>
            ))}
          </div>
          <button onClick={rerun} disabled={running}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1a] border border-[#333] text-[#aaa] text-xs rounded-lg hover:border-[#f43f5e] hover:text-[#f43f5e] transition-colors disabled:opacity-40">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {running ? 'Running…' : 'Re-run'}
          </button>
        </div>
      </div>

      {/* Grid body */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#f43f5e] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
          <div className="text-3xl mb-3">🔍</div>
          <p className="text-sm text-[#666]">{matches.length === 0 ? 'No matches yet — click Re-run to search.' : 'No matches in this tier.'}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {visible.map(m => {
            const snap    = m.unit_snapshot;
            const tier    = TIER_META[m.match_tier];
            const score   = Math.round(m.match_score);
            const showActions  = score >= SCORE_THRESHOLD_ACTIONS;
            const showPremium  = score > SCORE_THRESHOLD_PREMIUM;
            const isFetching   = fetchingId === m.unit_id;

            return (
              <div key={m.id} className={`border rounded-xl p-3 transition-colors ${m.is_shortlisted ? 'border-[#f43f5e44] bg-[#f43f5e08]' : 'border-[#1e1e1e] bg-[#111] hover:border-[#2a2a2a]'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span style={{ color: tier.color, background: `${tier.color}22`, border: `1px solid ${tier.color}44` }}
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded" title={tier.title}>
                        {tier.label}
                      </span>
                      <span className="text-xs font-mono text-[#c9a84c]">{m.unit_code}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] shrink-0" title="Available" />
                      {showPremium && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#c9a84c22] text-[#c9a84c] border border-[#c9a84c44]">
                          PREMIUM
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-[#e0e0e0] truncate">{snap.property} · {snap.unit_no}</p>
                    <p className="text-xs text-[#666] mt-0.5">{snap.zone} · {snap.type} · {snap.config}</p>
                    <p className="text-sm font-semibold text-[#c9a84c] mt-1">QAR {fmt(snap.rent)}<span className="text-xs font-normal text-[#555]">/mo</span></p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-1">
                      {showActions && (
                        <button
                          onClick={() => handleViewDetails(m.unit_id)}
                          disabled={isFetching}
                          title="View Details"
                          className="p-1.5 rounded-lg text-[#555] hover:text-[#c9a84c] hover:bg-[#c9a84c10] disabled:opacity-40 transition-colors"
                        >
                          {isFetching
                            ? <span className="w-3.5 h-3.5 border border-[#555] border-t-transparent rounded-full animate-spin block" />
                            : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          }
                        </button>
                      )}
                      <button onClick={() => toggleShortlist(m)}
                        title={m.is_shortlisted ? 'Remove from shortlist' : 'Add to shortlist'}
                        className={`p-1.5 rounded-lg transition-colors ${m.is_shortlisted ? 'text-[#f43f5e] bg-[#f43f5e15]' : 'text-[#444] hover:text-[#f43f5e] hover:bg-[#f43f5e10]'}`}>
                        <svg viewBox="0 0 24 24" fill={m.is_shortlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      </button>
                    </div>
                    <ScoreBar score={score} />
                  </div>
                </div>

                {/* Match reason chips */}
                <div className="flex gap-1 mt-2 flex-wrap">
                  {m.match_reasons.budget && (
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${m.match_reasons.budget === 'exact' ? 'bg-[#4ade8022] text-[#4ade80]' : 'bg-[#fbbf2422] text-[#fbbf24]'}`}>
                      Budget {m.match_reasons.budget}
                    </span>
                  )}
                  {m.match_reasons.zone === 'exact' && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#38bdf822] text-[#38bdf8]">Zone ✓</span>}
                  {m.match_reasons.type === true      && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#a78bfa22] text-[#a78bfa]">Type ✓</span>}
                  {m.match_reasons.config === true    && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#fb923c22] text-[#fb923c]">Config ✓</span>}
                  {m.match_reasons.bathrooms === true && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#e879f922] text-[#e879f9]">Bath ✓</span>}
                </div>

                {/* ── Premium action row — score > 80 only ─────────────── */}
                {showPremium && (
                  <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-[#1a1a1a]">
                    <>
                        {/* PDF Report */}
                        <button
                          onClick={() => handlePdf(m.unit_id)}
                          title="Download PDF Proposal Report"
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] text-[#aaa] text-[11px] font-medium rounded-lg hover:border-[#f43f5e] hover:text-[#f43f5e] transition-colors"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                          </svg>
                          PDF
                        </button>

                        {/* WhatsApp */}
                        <button
                          onClick={() => handleWhatsApp(m.unit_id)}
                          disabled={isFetching}
                          title="Share via WhatsApp"
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] text-[#aaa] text-[11px] font-medium rounded-lg hover:border-[#25d366] hover:text-[#25d366] disabled:opacity-40 transition-colors"
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          WhatsApp
                        </button>

                        {/* Email */}
                        <button
                          onClick={() => handleEmail(m.unit_id)}
                          disabled={isFetching}
                          title="Send email proposal"
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] text-[#aaa] text-[11px] font-medium rounded-lg hover:border-[#c9a84c] hover:text-[#c9a84c] disabled:opacity-40 transition-colors"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          Email
                        </button>
                    </>
                  </div>
                )}
                {/* ── end action row ────────────────────────────────────── */}
              </div>
            );
          })}
        </div>
      )}
    </div>

    {/* UnitDetailsModal — rendered when View Details is triggered (score > 50) */}
    {previewUnit && (
      <UnitDetailsModal unit={previewUnit} onClose={() => setPreviewUnit(null)} />
    )}

    </>
  );
}

// ─── Inquiry Detail Drawer ────────────────────────────────────────────────────

function InquiryDrawer({ inquiry, onClose, onUpdate, agents, onAgentAdded }: {
  inquiry: Inquiry;
  onClose: () => void;
  onUpdate: (updated: Inquiry) => void;
  agents: AgentProfile[];
  onAgentAdded: (a: AgentProfile) => void;
}) {
  const { role } = useAuth();
  const isAdmin  = role === 'superuser' || role === 'administrator';

  const [tab, setTab]               = useState<'matches' | 'details'>('matches');
  const [status,        setStatus]  = useState(inquiry.status);
  const [pendingStatus, setPending] = useState(inquiry.status);
  const [saving, setSaving]         = useState(false);
  const [agentCode, setAgentCode]         = useState(inquiry.assigned_agent ?? '');
  const [staffEmail,      setStaffEmail]      = useState(inquiry.staff_email     ?? '');
  const [staffName,       setStaffName]       = useState<string | null>(inquiry.staff_name ?? null);
  const [assignedUnit1, setAssignedUnit1] = useState<AssignedUnit | null>(inquiry.assigned_unit  ?? null);
  const [assignedUnit2, setAssignedUnit2] = useState<AssignedUnit | null>(inquiry.assigned_unit2 ?? null);
  const [assignedUnit3, setAssignedUnit3] = useState<AssignedUnit | null>(inquiry.assigned_unit3 ?? null);

  const patch = async (fields: Record<string, unknown>) => {
    const res  = await authedFetch(`/api/inquiries/${inquiry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    const data = await res.json();
    if (data.inquiry) onUpdate(data.inquiry);
    return data;
  };

  const commitStatus = async () => {
    setStatus(pendingStatus);
    setSaving(true);
    await patch({ status: pendingStatus });
    setSaving(false);
  };

  const assignAgent = async (code: string) => {
    setAgentCode(code);
    await patch({ assigned_agent: code || null });
  };

  const assignUnit = async (slot: 1 | 2 | 3, unit: AssignedUnit | null) => {
    const field      = slot === 1 ? 'assigned_unit_id' : `assigned_unit_id_${slot}`;
    const respKey    = slot === 1 ? 'assigned_unit'    : `assigned_unit${slot}`;
    const setFn      = slot === 1 ? setAssignedUnit1 : slot === 2 ? setAssignedUnit2 : setAssignedUnit3;
    setFn(unit);
    const result = await patch({ [field]: unit?.id ?? null });
    if (result.inquiry?.[respKey]) setFn(result.inquiry[respKey]);
    else if (!unit) setFn(null);
  };

  const assignHandler = async (email: string, name: string) => {
    setStaffEmail(email);
    setStaffName(name || null);
    const now = email ? new Date().toISOString() : null;
    await patch({ staff_email: email || null, staff_name: name || null, staff_assigned_at: now });
  };

  const sm = STATUS_META[status] ?? STATUS_META.new;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-[#0d0d0d] border-l border-[#1e1e1e] flex flex-col shadow-2xl overflow-hidden">
        {/* Drawer header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#1e1e1e] shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-[#f43f5e]">{inquiry.ref_no}</span>
              <Badge label={sm.label} color={sm.color} bg={sm.bg} />
            </div>
            <h2 className="text-base font-semibold text-[#e0e0e0]">{inquiry.client_name}</h2>
            <p className="text-xs text-[#666] mt-0.5">
              {inquiry.client_phone && <span className="mr-3">{inquiry.client_phone}</span>}
              {inquiry.client_email && <span>{inquiry.client_email}</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-[#555] hover:text-[#ccc] rounded-lg hover:bg-[#1a1a1a] transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Requirements bar */}
        <div className="px-5 py-2.5 bg-[#111] border-b border-[#1a1a1a] flex gap-4 text-xs text-[#888] flex-wrap shrink-0">
          {inquiry.listing_type  && <span><span className="text-[#555]">Type</span> <span className="text-[#c9a84c] font-medium">{inquiry.listing_type}</span></span>}
          {inquiry.property_type && <span><span className="text-[#555]">Prop</span> <span className="text-[#aaa]">{inquiry.property_type}</span></span>}
          {inquiry.config        && <span><span className="text-[#555]">Config</span> <span className="text-[#aaa]">{inquiry.config}</span></span>}
          {(inquiry.budget_min || inquiry.budget_max) && (
            <span><span className="text-[#555]">Budget</span> <span className="text-[#4ade80] font-medium">QAR {fmt(inquiry.budget_min ?? 0)}–{fmt(inquiry.budget_max ?? 0)}</span></span>
          )}
          {(inquiry.preferred_zones?.length ?? 0) > 0 && (
            <span><span className="text-[#555]">Zones</span> <span className="text-[#38bdf8]">{inquiry.preferred_zones?.join(', ')}</span></span>
          )}
          {inquiry.match_count > 0 && (
            <span className="ml-auto font-semibold text-[#f43f5e]">{inquiry.match_count} match{inquiry.match_count !== 1 ? 'es' : ''}</span>
          )}
        </div>

        {/* Pipeline status row */}
        <div className="px-5 py-3 border-b border-[#1a1a1a] shrink-0 space-y-2.5">
          <div className="flex gap-1.5 flex-wrap">
            {STATUSES.map(s => {
              const m      = STATUS_META[s];
              const active = s === pendingStatus;
              return (
                <button key={s} onClick={() => setPending(s as Inquiry['status'])} disabled={saving}
                  style={active ? { background: m.bg, borderColor: m.color, color: m.color } : {}}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${active ? 'font-semibold' : 'border-[#222] text-[#555] hover:border-[#444] hover:text-[#888]'}`}>
                  {m.label}
                </button>
              );
            })}
          </div>
          {pendingStatus !== status && (
            <div className="flex items-center gap-2">
              <button
                onClick={commitStatus}
                disabled={saving}
                className="px-4 py-1.5 bg-[#f43f5e] text-white text-xs font-semibold rounded-lg hover:bg-[#e11d48] disabled:opacity-40 transition-colors"
              >
                {saving ? 'Updating…' : `Update → ${STATUS_META[pendingStatus]?.label}`}
              </button>
              <button
                onClick={() => setPending(status)}
                disabled={saving}
                className="text-xs text-[#555] hover:text-[#888] px-2 py-1.5 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Persistent consultant reassignment strip */}
        <div className="px-5 py-2.5 border-b border-[#1a1a1a] shrink-0 flex items-center gap-3">
          <span className="text-[10px] text-[#555] uppercase tracking-wider shrink-0 w-[72px]">Consultant</span>
          {agentCode && agents.find(a => a.agent_code === agentCode) ? (() => {
            const a = agents.find(a => a.agent_code === agentCode)!;
            return (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-6 h-6 rounded-full bg-[#22c55e22] border border-[#22c55e44] flex items-center justify-center shrink-0">
                  <span className="font-mono text-[9px] font-bold text-[#22c55e]">{a.agent_code}</span>
                </div>
                <span className="text-xs text-[#ccc] truncate flex-1">{a.full_name}</span>
                {isAdmin && (
                  <button
                    onClick={() => assignAgent('')}
                    className="text-[10px] text-[#555] hover:text-[#f43f5e] transition-colors px-2 py-1 shrink-0"
                  >
                    Reassign
                  </button>
                )}
              </div>
            );
          })() : isAdmin ? (
            <div className="flex-1">
              <AgentSearch
                agents={agents}
                value={agentCode}
                onSelect={assignAgent}
                onNewAgent={a => { onAgentAdded(a); assignAgent(a.agent_code); }}
              />
            </div>
          ) : (
            <span className="text-[11px] text-[#444]">—</span>
          )}
        </div>

        {/* Persistent handler strip */}
        <div className="px-5 py-2.5 border-b border-[#1a1a1a] shrink-0 flex items-center gap-3">
          <span className="text-[10px] text-[#555] uppercase tracking-wider shrink-0 w-[72px]">Handler</span>
          {isAdmin ? (
            staffEmail ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-6 h-6 rounded-full bg-[#c9a84c22] border border-[#c9a84c44] flex items-center justify-center shrink-0">
                  <span className="font-mono text-[9px] font-bold text-[#c9a84c]">S</span>
                </div>
                <span className="text-xs text-[#ccc] truncate flex-1">{staffName ?? staffEmail}</span>
                <button
                  onClick={() => assignHandler('', '')}
                  className="text-[10px] text-[#555] hover:text-[#f43f5e] transition-colors px-2 py-1 shrink-0"
                >
                  Unassign
                </button>
              </div>
            ) : (
              <div className="flex-1">
                <StaffSearch value={staffEmail} staffName={staffName} onSelect={assignHandler} />
              </div>
            )
          ) : (
            staffEmail ? (
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-[#c9a84c22] border border-[#c9a84c44] flex items-center justify-center shrink-0">
                  <span className="font-mono text-[9px] font-bold text-[#c9a84c]">S</span>
                </div>
                <span className="text-xs text-[#ccc] truncate">{staffName ?? staffEmail}</span>
              </div>
            ) : (
              <span className="text-[11px] text-[#444]">—</span>
            )
          )}
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-[#1a1a1a] shrink-0">
          {(['matches', 'details'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-3 text-xs font-semibold capitalize transition-colors border-b-2 ${tab === t ? 'border-[#f43f5e] text-[#f43f5e]' : 'border-transparent text-[#555] hover:text-[#888]'}`}>
              {t === 'matches' ? `Matching Units${inquiry.match_count > 0 ? ` (${inquiry.match_count})` : ''}` : 'Details'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden p-5">
          {tab === 'matches' ? (
            <MatchingGrid inquiryId={inquiry.id} clientEmail={inquiry.client_email ?? undefined} />
          ) : (
            <div className="space-y-3 text-sm overflow-y-auto h-full">
              {/* Unit assignment — up to 3 slots, all optional */}
              <div className="p-3 bg-[#111] border border-[#1e1e1e] rounded-xl mb-2 space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#555]">Assigned Units <span className="normal-case font-normal text-[#444]">(max 3)</span></p>
                {([
                  [1, assignedUnit1, setAssignedUnit1],
                  [2, assignedUnit2, setAssignedUnit2],
                  [3, assignedUnit3, setAssignedUnit3],
                ] as [1|2|3, AssignedUnit|null, React.Dispatch<React.SetStateAction<AssignedUnit|null>>][]).map(([slot, unit]) => (
                  <div key={slot}>
                    <p className="text-[9px] text-[#444] uppercase tracking-widest mb-1.5">Unit {slot}</p>
                    {unit ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-[#c9a84c22] border border-[#c9a84c44] flex items-center justify-center shrink-0">
                            <svg viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth={1.5} className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 22V12h6v10" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#e0e0e0] truncate">{unit.property} · {unit.unit_no}</p>
                            <p className="text-[10px] font-mono text-[#c9a84c]">{unit.unit_code}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => assignUnit(slot, null)}
                          className="text-[10px] text-[#555] hover:text-[#f87171] transition-colors px-2 py-1 rounded shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <UnitSearch value={null} onSelect={u => assignUnit(slot, u)} />
                    )}
                  </div>
                ))}
              </div>

              {[
                ['Source',       inquiry.source],
                ['Nationality',  inquiry.client_nationality],
                ['Furnishing',   inquiry.furnishing],
                ['Bathrooms min',inquiry.bathrooms_min],
                ['Size',         inquiry.size ? `${inquiry.size} sqm` : null],
                ['Bills',        inquiry.bills_included],
                ['Move-in',      inquiry.move_in_date],
                ['Follow-up',    inquiry.follow_up_date],
                ['Last Matched', inquiry.last_matched_at ? new Date(inquiry.last_matched_at).toLocaleString() : null],
                ['Created',      new Date(inquiry.created_at).toLocaleString()],
              ].map(([k, v]) => v != null ? (
                <div key={k as string} className="flex gap-4">
                  <span className="text-[#555] w-28 shrink-0">{k}</span>
                  <span className="text-[#ccc]">{String(v)}</span>
                </div>
              ) : null)}
              {inquiry.notes && (
                <div className="mt-4 p-3 bg-[#111] border border-[#1e1e1e] rounded-lg">
                  <p className="text-xs text-[#555] mb-1">Notes</p>
                  <p className="text-sm text-[#aaa]">{inquiry.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Notifications Panel ──────────────────────────────────────────────────────

const NOTIF_ICONS: Record<string, string> = {
  new_match:   '🎯',
  unit_blocked:'🔴',
  new_inquiry: '📥',
  daily_digest:'📊',
  follow_up:   '⏰',
};

function NotificationsPanel() {
  const [notifs, setNotifs]   = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res  = await authedFetch('/api/notifications');
    const data = await res.json();
    setNotifs(data.notifications ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const markRead = async (ids?: string[]) => {
    await authedFetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids ? { ids } : { markAll: true }),
    });
    setNotifs(prev => prev.map(n => (!ids || ids.includes(n.id)) ? { ...n, is_read: true } : n));
  };

  const unread = notifs.filter(n => !n.is_read).length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[#e0e0e0]">Notifications</h3>
          {unread > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f43f5e] text-white">{unread}</span>}
        </div>
        {unread > 0 && (
          <button onClick={() => markRead()} className="text-xs text-[#f43f5e] hover:underline">Mark all read</button>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#f43f5e] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notifs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="text-4xl mb-3">🔔</div>
          <p className="text-sm text-[#555]">No notifications yet.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2">
          {notifs.map(n => (
            <div key={n.id} onClick={() => !n.is_read && markRead([n.id])}
              className={`p-3 rounded-xl border transition-colors cursor-pointer ${n.is_read ? 'border-[#1a1a1a] bg-[#0d0d0d] opacity-60' : 'border-[#2a1a1f] bg-[#140810] hover:border-[#f43f5e33]'}`}>
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0">{NOTIF_ICONS[n.type] ?? '🔔'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-xs font-semibold ${n.is_read ? 'text-[#666]' : 'text-[#e0e0e0]'}`}>{n.title}</p>
                    {!n.is_read && <div className="w-2 h-2 rounded-full bg-[#f43f5e] shrink-0 mt-0.5" />}
                  </div>
                  {n.body && <p className="text-xs text-[#555] mt-0.5 line-clamp-2">{n.body}</p>}
                  <p className="text-[10px] text-[#444] mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const PIPELINE_STATUSES = ['all', ...STATUSES] as const;

export default function SynergyCenter({ onMenuClick, initialRef }: { onMenuClick?: () => void; initialRef?: string }) {
  const { role, user } = useAuth();
  const isStaff = role === 'staff';

  const [tab, setTab]                   = useState<'inquiries' | 'notifications'>('inquiries');
  const [inquiries, setInquiries]       = useState<Inquiry[]>([]);
  const [allStats, setAllStats]         = useState({ total: 0, new: 0, open: 0, won: 0, matches: 0 });
  const [agents, setAgents]             = useState<AgentProfile[]>([]);
  const [loading, setLoading]           = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch]             = useState('');
  const [showForm, setShowForm]         = useState(false);
  const [formError, setFormError]       = useState<string | null>(null);
  const [extractedFields, setExtractedFields] = useState<Record<string, string>>({});
  const [extractRevision, setExtractRevision] = useState(0);
  const [selected, setSelected]         = useState<Inquiry | null>(null);
  const [unreadCount, setUnreadCount]   = useState(0);
  // Guardrail modal — shown when staff tries to open another staff member's inquiry
  const [guardrail, setGuardrail]       = useState<Inquiry | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res  = await authedFetch('/api/inquiries');
      const data = await res.json();
      setInquiries(data.inquiries ?? []);
      if (data.allStats) setAllStats(data.allStats);
    } finally {
      setLoading(false);
    }
  };

  const loadAgents = async () => {
    try {
      const res  = await authedFetch('/api/code-registry/options');
      const data = await res.json();
      setAgents(data.agents ?? []);
    } catch { /* non-critical */ }
  };

  const loadUnread = async () => {
    const res  = await authedFetch('/api/notifications?unread=true');
    const data = await res.json();
    setUnreadCount(data.unreadCount ?? 0);
  };

  useEffect(() => { load(); loadAgents(); loadUnread(); }, []);

  // Auto-open inquiry when arriving via deep link
  useEffect(() => {
    if (initialRef && inquiries.length > 0 && !selected) {
      const match = inquiries.find(i => i.ref_no === initialRef);
      if (match) setSelected(match);
    }
  }, [initialRef, inquiries]);

  const openForm = () => { setFormError(null); setExtractedFields({}); setExtractRevision(0); setShowForm(true); };

  // Guard: staff can only open their own inquiries
  const handleSelectInquiry = (inquiry: Inquiry) => {
    if (isStaff && inquiry.staff_email && inquiry.staff_email !== user?.email) {
      setGuardrail(inquiry);
      return;
    }
    setSelected(inquiry);
  };

  const createInquiry = async (payload: Record<string, unknown>) => {
    setFormError(null);
    try {
      const res  = await authedFetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.inquiry) {
        setFormError(data.error ?? 'Failed to save inquiry. Please try again.');
        return;
      }

      setInquiries(prev => [data.inquiry, ...prev]);
      setShowForm(false);

      authedFetch(`/api/inquiries/${data.inquiry.id}/match`, { method: 'POST' })
        .finally(() => load());
    } catch {
      setFormError('Network error — please check your connection and try again.');
    }
  };

  const filtered = inquiries.filter(i => {
    const matchStatus = statusFilter === 'all' || i.status === statusFilter;
    const matchSearch = !search || i.client_name.toLowerCase().includes(search.toLowerCase())
      || i.ref_no?.toLowerCase().includes(search.toLowerCase())
      || i.client_phone?.includes(search);
    return matchStatus && matchSearch;
  });

  // Stats tiles always show ALL-record counts (from server allStats), not just the filtered list
  const stats = {
    total:   allStats.total,
    open:    allStats.open,
    won:     allStats.won,
    matches: allStats.matches,
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0]">
      <TopBar onMenuClick={onMenuClick} />

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Page title + tab switcher ── */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Synergy Center</h2>
            <p className="text-[#606060] text-sm mt-0.5">Inquiry Matching &amp; Auto-Shortlist Engine</p>
          </div>
          <div className="flex items-center gap-1 bg-[#141414] border border-[#1e1e1e] rounded-xl p-1">
            {([
              { key: 'inquiries',     label: 'Inquiries'      },
              { key: 'notifications', label: 'Notifications'  },
            ] as const).map(t => (
              <button key={t.key}
                onClick={() => { setTab(t.key); if (t.key === 'notifications') loadUnread(); }}
                className={`relative px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${tab === t.key ? 'bg-[#f43f5e] text-white' : 'text-[#555] hover:text-[#e0e0e0]'}`}>
                {t.label}
                {t.key === 'notifications' && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white text-[#f43f5e] text-[9px] font-black flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {tab === 'inquiries' && (<>

          {/* ── Metric cards (clickable — filter the list) ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {[
              { label: 'Total Inquiries', value: stats.total,                                            filterVal: 'all',          color: 'text-[#e0e0e0]',  ring: 'border-[#444]'       },
              { label: 'New',             value: allStats.new,                                           filterVal: 'new',          color: 'text-[#94a3b8]',  ring: 'border-[#94a3b8]'    },
              { label: 'Open',            value: stats.open,                                             filterVal: 'contacted',    color: 'text-[#f43f5e]',  ring: 'border-[#f43f5e]'    },
              { label: 'Won',             value: stats.won,                                              filterVal: 'won',          color: 'text-[#4ade80]',  ring: 'border-[#4ade80]'    },
              { label: 'Total Matches',   value: stats.matches,                                          filterVal: '__matches__',  color: 'text-[#c9a84c]',  ring: 'border-[#c9a84c]'    },
            ].map(card => {
              const active = statusFilter === card.filterVal && card.filterVal !== '__matches__';
              return (
                <button key={card.label}
                  onClick={() => { if (card.filterVal !== '__matches__') setStatusFilter(card.filterVal); }}
                  className={`bg-[#0d0d0d] border rounded-xl p-4 text-left transition-all ${active ? `${card.ring} ring-1 ring-current` : 'border-[#1a1a1a] hover:border-[#2a2a2a]'} ${card.filterVal === '__matches__' ? 'cursor-default' : 'cursor-pointer'}`}>
                  <p className="text-[11px] text-[#555] uppercase tracking-wider mb-2">{card.label}</p>
                  <p className={`text-2xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
                </button>
              );
            })}
          </div>

          {/* ── Filter row ── */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 min-w-[180px]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444] pointer-events-none">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, ref no. or phone…"
                className="w-full bg-[#0d0d0d] border border-[#1e1e1e] text-[#e0e0e0] text-sm rounded-lg pl-9 pr-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#f43f5e44] placeholder-[#444]"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {PIPELINE_STATUSES.map(s => {
                const m = s === 'all' ? null : STATUS_META[s];
                const active = statusFilter === s;
                return (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    style={active && m ? { background: m.bg, borderColor: m.color, color: m.color } : {}}
                    className={`shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors capitalize ${active && !m ? 'bg-[#f43f5e] text-white border-[#f43f5e]' : !active ? 'border-[#1e1e1e] text-[#555] hover:border-[#333] hover:text-[#888]' : ''}`}>
                    {s === 'all' ? 'All' : STATUS_META[s].label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Showing count ── */}
          {!loading && (
            <p className="text-[11px] text-[#444]">
              Showing <span className="text-[#666]">{filtered.length}</span> of <span className="text-[#666]">{inquiries.length}</span> inquiries
            </p>
          )}

          {/* ── Card grid ── */}
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-[#f43f5e] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-12 flex flex-col items-center gap-3">
              <div className="text-5xl">📋</div>
              <p className="text-sm text-[#555]">{inquiries.length === 0 ? 'No inquiries yet — click "+ New Inquiry" to get started.' : 'No inquiries match your filter.'}</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map(inq => {
                const sm2 = STATUS_META[inq.status] ?? STATUS_META.new;
                return (
                  <div key={inq.id} onClick={() => handleSelectInquiry(inq)}
                    className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4 cursor-pointer hover:border-[#f43f5e44] hover:bg-[#110810] transition-colors group">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="text-[10px] font-mono text-[#f43f5e] mb-0.5">{inq.ref_no}</p>
                        <p className="text-sm font-semibold text-[#e0e0e0] group-hover:text-white">{inq.client_name}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <Badge label={sm2.label} color={sm2.color} bg={sm2.bg} />
                        {inq.assigned_agent && (() => {
                          const a = agents.find(ag => ag.agent_code === inq.assigned_agent);
                          if (!a) return null;
                          return (
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-[#22c55e22] border border-[#22c55e44] flex items-center justify-center shrink-0">
                                <span className="font-mono text-[9px] font-bold text-[#22c55e]">{a.agent_code}</span>
                              </div>
                              <span className="text-[10px] text-[#666] truncate max-w-[72px]">{a.full_name.split(' ')[0]}</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#555] mb-2">
                      {inq.listing_type  && <span>{inq.listing_type}</span>}
                      {inq.property_type && <span>· {inq.property_type}</span>}
                      {inq.config        && <span>· {inq.config}</span>}
                    </div>
                    {(inq.budget_min || inq.budget_max) && (
                      <p className="text-xs text-[#4ade80] font-medium mb-2">
                        QAR {fmt(inq.budget_min ?? 0)} – {fmt(inq.budget_max ?? 0)}
                      </p>
                    )}
                    {[inq.assigned_unit, inq.assigned_unit2, inq.assigned_unit3].some(Boolean) && (
                      <div className="mt-2 pt-2 border-t border-[#1a1a1a] space-y-1">
                        {[inq.assigned_unit, inq.assigned_unit2, inq.assigned_unit3].map((u, i) => u ? (
                          <div key={i} className="flex items-center gap-1.5">
                            <svg viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth={1.5} className="w-3 h-3 shrink-0">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 22V12h6v10" />
                            </svg>
                            <span className="font-mono text-[9px] text-[#c9a84c]">{u.unit_code}</span>
                            <span className="text-[10px] text-[#666] truncate">{u.unit_no} · {u.property}</span>
                          </div>
                        ) : null)}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex flex-col gap-0.5">
                        <p className="text-[10px] text-[#383838]">{new Date(inq.created_at).toLocaleDateString()}</p>
                        <ElapsedCounter since={inq.status_changed_at ?? inq.created_at} status={inq.status} />
                      </div>
                      {inq.match_count > 0 ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f43f5e22] text-[#f43f5e] border border-[#f43f5e44]">
                          {inq.match_count} match{inq.match_count !== 1 ? 'es' : ''}
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#2a2a2a]">No matches</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* New Inquiry button — fixed bottom-right */}
          <div className="fixed bottom-6 right-6 z-40">
            <button onClick={openForm}
              className="flex items-center gap-2 px-5 py-3 bg-[#f43f5e] text-white text-sm font-semibold rounded-full shadow-lg hover:bg-[#e11d48] transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              New Inquiry
            </button>
          </div>

        </>)}

        {tab === 'notifications' && (
          <div style={{ minHeight: 'calc(100vh - 200px)' }}>
            <NotificationsPanel />
          </div>
        )}

      </main>

      {/* ── New Inquiry Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm py-8 px-4">
          <div className="w-full max-w-2xl bg-[#0d0d0d] border border-[#1e1e1e] rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e1e]">
              <div>
                <h2 className="text-base font-bold text-[#e0e0e0]">New Inquiry</h2>
                <p className="text-xs text-[#555]">Auto-matching runs after save</p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-2 text-[#555] hover:text-[#ccc] rounded-lg hover:bg-[#1a1a1a] transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5">
              <AIExtractPanel
                onExtract={data => { setExtractedFields(data); setExtractRevision(r => r + 1); }}
              />
              <InquiryForm
                onSave={createInquiry}
                onCancel={() => setShowForm(false)}
                formError={formError}
                mergeFields={extractedFields}
                mergeRevision={extractRevision}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Inquiry Detail Drawer ── */}
      {selected && (
        <InquiryDrawer
          inquiry={selected}
          onClose={() => setSelected(null)}
          onUpdate={updated => {
            setSelected(updated);
            setInquiries(prev => prev.map(i => i.id === updated.id ? updated : i));
          }}
          agents={agents}
          onAgentAdded={a => setAgents(prev => [...prev, a].sort((x, y) => x.agent_code.localeCompare(y.agent_code)))}
        />
      )}

      {/* ── Staff Reassignment Guardrail Modal ── */}
      {guardrail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm mx-4 bg-[#111] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 bg-[#0d0d0d] border-b border-[#1e1e1e] flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#e0e0e0]">Record Already Assigned</p>
                <p className="text-[11px] text-[#555] mt-0.5">{guardrail.ref_no}</p>
              </div>
            </div>

            {/* Assignment detail tile */}
            <div className="px-5 py-4 space-y-3">
              <div className="rounded-xl bg-[#181818] border border-[#2a2a2a] p-4 space-y-3">
                <div>
                  <p className="text-[10px] font-medium text-[#555] uppercase tracking-widest mb-0.5">Assigned Staff</p>
                  <p className="text-sm font-semibold text-[#e0e0e0]">{guardrail.staff_name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-[#555] uppercase tracking-widest mb-0.5">Email</p>
                  <p className="text-sm text-[#94a3b8] font-mono">{guardrail.staff_email ?? '—'}</p>
                </div>
                {guardrail.staff_assigned_at && (
                  <div>
                    <p className="text-[10px] font-medium text-[#555] uppercase tracking-widest mb-0.5">Assigned At</p>
                    <p className="text-sm text-[#666]">{new Date(guardrail.staff_assigned_at).toLocaleString('en-QA', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 px-4 py-3">
                <p className="text-[12px] text-amber-400/90 leading-relaxed">
                  This inquiry is managed by another staff member. To request reassignment, please contact an <span className="font-semibold">Administrator</span>.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 pb-5">
              <button
                type="button"
                onClick={() => setGuardrail(null)}
                className="w-full py-2.5 text-sm font-semibold text-[#0f0f0f] bg-amber-500 hover:bg-amber-400 rounded-xl transition-colors"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
