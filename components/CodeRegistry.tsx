'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { authedFetch } from '../lib/authedFetch';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';
import { PROPERTY_MATRIX, CONFIGURATION_REGEX } from '../lib/propertySchema';
import TopBar from './TopBar';

// ── Types ─────────────────────────────────────────────────────────────────────

type PropConfig = {
  type_code: string; core_type: string; sub_type: string;
  configuration: string; integration_scenario: string; features: string;
  category: 'C' | 'R';
};
type Entity = {
  entity_code: string; company_name: string; classification: string; is_manual: boolean;
};
type Agent = { agent_code: string; full_name: string };
type Zone  = { zone_code: number; district_name: string; municipality: string };

type RegistryRecord = {
  id: string; smart_code: string; status: string; category: 'C' | 'R';
  type_code: string; core_type: string; sub_type: string; configuration: string;
  entity_code: string; company_name: string; classification: string;
  agent_code: string; agent_name: string;
  zone_code: number; district_name: string; municipality: string;
  sequence_number: number;
  building_name: string | null; floor_ref: string | null;
  unit_ref: string | null; notes: string | null;
  created_at: string;
};

type HistoryEntry = {
  id: string; registry_id: string; smart_code: string;
  from_status: string | null; to_status: string;
  changed_by: string; changed_at: string; notes: string | null;
};

type Options = {
  configs: PropConfig[]; entities: Entity[]; agents: Agent[]; zones: Zone[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const CLASSIFICATIONS = [
  'Semi-Government & Master Developer',
  'Elite Private Developer & Conglomerate',
  'Top International & Local Brokerage',
  'Institutional Property Manager',
  'Independent',
];

function seg(val: string | null, placeholder: string, color: string) {
  return { val, placeholder, color, filled: !!val };
}

function buildPreviewSegments(
  category: string, typeCode: string, entityCode: string, agentCode: string, zoneCode: number | null,
) {
  return [
    seg(category   || null, '·',     '#ef4444'),
    seg(typeCode   || null, '··',    '#a855f7'),
    seg(entityCode || null, '···',   '#3b82f6'),
    seg(agentCode  || null, '··',    '#22c55e'),
    seg(zoneCode != null ? String(zoneCode).padStart(2, '0') : null, '··', '#f97316'),
    seg(null, '····', '#c9a84c'),
  ];
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold text-[#888888] uppercase tracking-widest mb-1">
      {children}
    </label>
  );
}

function Select({
  value, onChange, children, disabled,
}: { value: string; onChange: (v: string) => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#e0e0e0] text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#c9a84c]/60 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </select>
  );
}

function Input({
  value, onChange, placeholder, mono, type = 'text',
}: { value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#e0e0e0] text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#c9a84c]/60 placeholder-[#555] ${mono ? 'font-mono' : ''}`}
    />
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-5 space-y-4">
      <p className="text-[10px] font-bold text-[#555] uppercase tracking-[0.18em]">{title}</p>
      {children}
    </div>
  );
}

function PlusBtn({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="Add new entry"
      className="w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[#1e1e1e] border border-[#2a2a2a] text-[#c9a84c] text-[13px] leading-none hover:bg-[#c9a84c]/10 hover:border-[#c9a84c]/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
    >+</button>
  );
}

function InlineAdd({
  placeholder, onSave, onCancel, validate,
}: {
  placeholder: string;
  onSave: (v: string) => Promise<void>;
  onCancel: () => void;
  validate?: (v: string) => string | null;
}) {
  const [val, setVal]       = useState('');
  const [err, setErr]       = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const t = val.trim();
    if (!t) return;
    if (validate) { const e = validate(t); if (e) { setErr(e); return; } }
    setSaving(true);
    try { await onSave(t); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed to save'); }
    finally { setSaving(false); }
  }

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex gap-2">
        <input
          autoFocus
          value={val}
          onChange={e => { setVal(e.target.value); setErr(null); }}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
          placeholder={placeholder}
          className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] text-[#e0e0e0] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c]/60 placeholder-[#555]"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !val.trim()}
          className="px-3 bg-[#c9a84c] hover:bg-[#dfc070] disabled:opacity-40 text-[#0f0f0f] text-sm font-bold rounded-lg transition-colors"
        >
          {saving ? '…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-2 text-[#666] hover:text-[#e0e0e0] text-sm transition-colors"
        >✕</button>
      </div>
      {err && <p className="text-[11px] text-[#ef4444]">{err}</p>}
    </div>
  );
}

function Toast({ message, type = 'success', onDone }: { message: string; type?: 'success' | 'error'; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);
  const isErr = type === 'error';
  return (
    <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] border text-sm px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 pointer-events-none select-none ${
      isErr
        ? 'bg-[#1a0808] border-[#ef4444]/50 text-[#ef4444]'
        : 'bg-[#0a1a0a] border-[#22c55e]/40 text-[#22c55e]'
    }`}>
      <span className="text-base leading-none">{isErr ? '✕' : '✓'}</span>
      {message}
    </div>
  );
}

// ── Code Preview ─────────────────────────────────────────────────────────────

function CodePreview({
  category, typeCode, entityCode, agentCode, zoneCode, generatedCode, nextSeq,
}: {
  category: string; typeCode: string; entityCode: string; agentCode: string;
  zoneCode: number | null; generatedCode?: string; nextSeq?: number;
}) {
  const seqDisplay = nextSeq != null ? String(nextSeq).padStart(4, '0') : null;
  const segments   = buildPreviewSegments(category, typeCode, entityCode, agentCode, zoneCode);
  // Swap the SEQ segment placeholder for the actual next seq when known
  if (seqDisplay && !generatedCode) segments[5] = seg(seqDisplay, '····', '#c9a84c');
  const labels = ['CAT', 'TYPE', 'ENTITY', 'AGENT', 'ZONE', 'SEQ'];

  const assembled = generatedCode ?? [
    category   || '·',
    typeCode   || '··',
    entityCode || '···',
    agentCode  || '··',
    zoneCode != null ? String(zoneCode).padStart(2, '0') : '··',
    seqDisplay ?? '····',
  ].join('');

  return (
    <div className="bg-[#0d0d0d] border border-[#222] rounded-xl p-5">
      <p className="text-[10px] font-bold text-[#555] uppercase tracking-[0.18em] mb-4">
        Smart Code Preview
      </p>

      {/* Segments */}
      <div className="flex items-end gap-1 mb-3 flex-wrap">
        {segments.map((s, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div
              className="px-2.5 py-1.5 rounded-md text-sm font-mono font-bold min-w-[2rem] text-center"
              style={{
                background: s.filled ? `${s.color}18` : '#1a1a1a',
                border:     `1px solid ${s.filled ? s.color + '50' : '#2a2a2a'}`,
                color:      s.filled ? s.color : '#444',
              }}
            >
              {s.filled ? s.val : s.placeholder}
            </div>
            <span className="text-[9px] text-[#444] uppercase tracking-widest font-bold">
              {labels[i]}
            </span>
          </div>
        ))}
      </div>

      {/* Assembled */}
      <div className="mt-3 pt-3 border-t border-[#1e1e1e] space-y-1.5">
        <div className="flex items-center gap-3">
          <span className="font-mono text-lg tracking-[0.15em] text-[#e0e0e0]">{assembled}</span>
          {generatedCode && (
            <button
              onClick={() => copyToClipboard(generatedCode)}
              title="Copy code"
              className="text-[#c9a84c] hover:text-[#dfc070] text-xs border border-[#c9a84c]/30 rounded px-2 py-0.5 transition-colors"
            >
              Copy
            </button>
          )}
        </div>
        {!generatedCode && nextSeq != null && (
          <p className="text-[11px] text-[#555]">
            Auto-assigned: <span className="text-[#c9a84c] font-mono">{nextSeq}</span>
            <span className="ml-1">(next in sequence)</span>
          </p>
        )}
      </div>
    </div>
  );
}

// ── Agent Search ─────────────────────────────────────────────────────────────

function AgentSearch({
  agents, value, onSelect, onNewAgent,
}: {
  agents: Agent[];
  value: string;
  onSelect: (code: string) => void;
  onNewAgent: (a: Agent) => void;
}) {
  const [open,     setOpen]     = useState(false);
  const [q,        setQ]        = useState('');
  const [showForm, setShowForm] = useState(false);
  const [newName,  setNewName]  = useState('');
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
        body: JSON.stringify({ fullName: newName.trim() }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setAddErr('Failed to register agent. Try again.'); return; }
      const a: Agent = { agent_code: json.agentCode, full_name: json.fullName };
      onNewAgent(a);
      onSelect(json.agentCode);
      setShowForm(false); setNewName(''); setOpen(false);
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
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setShowForm(false); setNewName(''); } }}
                  placeholder="Full name (e.g. Mohammed Al-Rashid)…"
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
                    onClick={() => { setShowForm(false); setNewName(''); setAddErr(''); }}
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

// ── Zone Inline Add ───────────────────────────────────────────────────────────

function ZoneInlineAdd({
  municipalities, onSave, onCancel,
}: {
  municipalities: string[];
  onSave: (zone: Zone) => void;
  onCancel: () => void;
}) {
  const [municipality,  setMunicipality]  = useState('');
  const [customMuni,    setCustomMuni]    = useState('');
  const [zoneNumber,    setZoneNumber]    = useState('');
  const [districtName,  setDistrictName]  = useState('');
  const [saving,        setSaving]        = useState(false);
  const [err,           setErr]           = useState('');

  const effectiveMuni = municipality === '__new__' ? customMuni.trim() : municipality;
  const zoneNum = Number(zoneNumber);
  const canSave = !!(districtName.trim() && effectiveMuni && Number.isInteger(zoneNum) && zoneNum > 0);

  async function handleSave() {
    if (!canSave) {
      setErr('Municipality, Zone Number, and District Name are all required. Zone Number must be a positive integer.');
      return;
    }
    setSaving(true); setErr('');
    try {
      const res = await fetch('/api/code-registry/zone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zoneCode: zoneNum, districtName: districtName.trim(), municipality: effectiveMuni }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setErr(typeof json.error === 'string' ? json.error : 'Failed to register zone. Try again.');
        return;
      }
      onSave({ zone_code: json.zoneCode, district_name: json.districtName, municipality: json.municipality });
    } finally { setSaving(false); }
  }

  return (
    <div className="mt-3 rounded-xl border border-[#c9a84c]/20 bg-[#c9a84c]/5 p-4 space-y-3">
      <p className="text-[10px] font-bold text-[#c9a84c] uppercase tracking-widest">Register New Zone</p>

      {/* Municipality */}
      <div>
        <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-widest mb-1">Municipality *</label>
        <select
          value={municipality}
          onChange={e => { setMunicipality(e.target.value); setErr(''); }}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#e0e0e0] text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#c9a84c]/60"
        >
          <option value="">Select existing…</option>
          {municipalities.map(m => <option key={m}>{m}</option>)}
          <option value="__new__">+ Add new municipality…</option>
        </select>
        {municipality === '__new__' && (
          <input
            autoFocus
            value={customMuni}
            onChange={e => { setCustomMuni(e.target.value); setErr(''); }}
            placeholder="New municipality name…"
            className="mt-1.5 w-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#e0e0e0] text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#c9a84c]/60 placeholder-[#555]"
          />
        )}
      </div>

      {/* Zone Number — user-assigned, no auto-increment */}
      <div>
        <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-widest mb-1">Zone Number *</label>
        <input
          type="number"
          min={1}
          value={zoneNumber}
          onChange={e => { setZoneNumber(e.target.value); setErr(''); }}
          placeholder="e.g. 61"
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#e0e0e0] text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#c9a84c]/60 placeholder-[#555]"
        />
        <p className="text-[10px] text-[#555] mt-1">Must be unique. Zone codes are assigned by the administrator — not auto-generated.</p>
      </div>

      {/* District / Zone Name */}
      <div>
        <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-widest mb-1">District / Zone Name *</label>
        <input
          value={districtName}
          onChange={e => { setDistrictName(e.target.value); setErr(''); }}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
          placeholder="e.g. West Bay, The Pearl…"
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#e0e0e0] text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#c9a84c]/60 placeholder-[#555]"
        />
        {zoneNumber && districtName && Number.isInteger(zoneNum) && zoneNum > 0 && (
          <p className="text-[10px] text-[#888] mt-1">
            Will display as: <span className="text-[#c9a84c] font-mono">Zone {zoneNum} — {districtName.trim()}</span>
          </p>
        )}
      </div>

      {err && <p className="text-[11px] text-[#ef4444]">{err}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !canSave}
          className="flex-1 bg-[#c9a84c] hover:bg-[#dfc070] disabled:opacity-40 text-[#0f0f0f] text-sm font-bold py-2 rounded-lg transition-colors"
        >
          {saving ? 'Registering…' : 'Register Zone'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 text-[#888] hover:text-[#e0e0e0] text-sm border border-[#2a2a2a] rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Entity Inline Add ─────────────────────────────────────────────────────────

function EntityInlineAdd({
  onSave, onCancel,
}: { onSave: (e: Entity) => void; onCancel: () => void }) {
  const [name,    setName]    = useState('');
  const [cls,     setCls]     = useState('Independent');
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true); setErr('');
    try {
      const res  = await fetch('/api/code-registry/entity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: name.trim(), classification: cls }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setErr('Failed to register company. Try again.'); return; }
      onSave({ entity_code: json.entityCode, company_name: json.companyName, classification: cls, is_manual: true });
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-xl border border-[#c9a84c]/20 bg-[#c9a84c]/5 p-4 space-y-3">
      <p className="text-[10px] font-bold text-[#c9a84c] uppercase tracking-widest">Register New Company</p>
      <div>
        <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-widest mb-1">Company Name</label>
        <input
          autoFocus
          value={name}
          onChange={e => { setName(e.target.value); setErr(''); }}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
          placeholder="e.g. Al Rayyan Real Estate Co."
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#e0e0e0] text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#c9a84c]/60 placeholder-[#555]"
        />
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-widest mb-1">Classification</label>
        <select
          value={cls}
          onChange={e => setCls(e.target.value)}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#e0e0e0] text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#c9a84c]/60"
        >
          {CLASSIFICATIONS.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      {err && <p className="text-[11px] text-[#ef4444]">{err}</p>}
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving || !name.trim()}
          className="flex-1 bg-[#c9a84c] hover:bg-[#dfc070] disabled:opacity-40 text-[#0f0f0f] text-sm font-bold py-2 rounded-lg transition-colors">
          {saving ? 'Registering…' : 'Register Company'}
        </button>
        <button onClick={onCancel} className="px-4 text-[#888] hover:text-[#e0e0e0] text-sm border border-[#2a2a2a] rounded-lg transition-colors">
          Cancel
        </button>
      </div>
      <p className="text-[10px] text-[#555]">Entity code auto-assigned from company name.</p>
    </div>
  );
}

// ── Agent Inline Add ──────────────────────────────────────────────────────────

function AgentInlineAdd({
  onSave, onCancel,
}: { onSave: (a: Agent) => void; onCancel: () => void }) {
  const [name,   setName]   = useState('');
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true); setErr('');
    try {
      const res  = await fetch('/api/code-registry/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: name.trim() }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setErr('Failed to register agent. Try again.'); return; }
      onSave({ agent_code: json.agentCode, full_name: json.fullName });
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-xl border border-[#c9a84c]/20 bg-[#c9a84c]/5 p-4 space-y-3">
      <p className="text-[10px] font-bold text-[#c9a84c] uppercase tracking-widest">Register New Agent</p>
      <div>
        <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-widest mb-1">Full Name</label>
        <input
          autoFocus
          value={name}
          onChange={e => { setName(e.target.value); setErr(''); }}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
          placeholder="e.g. Mohammed Al-Rashid"
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#e0e0e0] text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#c9a84c]/60 placeholder-[#555]"
        />
      </div>
      {err && <p className="text-[11px] text-[#ef4444]">{err}</p>}
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving || !name.trim()}
          className="flex-1 bg-[#c9a84c] hover:bg-[#dfc070] disabled:opacity-40 text-[#0f0f0f] text-sm font-bold py-2 rounded-lg transition-colors">
          {saving ? 'Registering…' : 'Register Agent'}
        </button>
        <button onClick={onCancel} className="px-4 text-[#888] hover:text-[#e0e0e0] text-sm border border-[#2a2a2a] rounded-lg transition-colors">
          Cancel
        </button>
      </div>
      <p className="text-[10px] text-[#555]">Agent code auto-assigned from initials.</p>
    </div>
  );
}

// ── Entity Search ─────────────────────────────────────────────────────────────

function EntitySearch({
  entities, value, onSelect, onNewEntity,
}: {
  entities: Entity[];
  value: string;
  onSelect: (code: string) => void;
  onNewEntity: (e: Entity) => void;
}) {
  const [q, setQ]         = useState('');
  const [open, setOpen]   = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName]   = useState('');
  const [newCls, setNewCls]     = useState('Independent');
  const [adding, setAdding]     = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = entities.find(e => e.entity_code === value);
  const filtered = q
    ? entities.filter(e =>
        e.company_name.toLowerCase().includes(q.toLowerCase()) ||
        e.entity_code.toLowerCase().includes(q.toLowerCase()))
    : entities;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function handleAdd() {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res  = await fetch('/api/code-registry/entity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: newName.trim(), classification: newCls }),
      });
      const json = await res.json();
      if (json.entityCode) {
        const e: Entity = {
          entity_code: json.entityCode, company_name: json.companyName,
          classification: newCls, is_manual: true,
        };
        onNewEntity(e);
        onSelect(json.entityCode);
        setShowForm(false); setNewName(''); setOpen(false);
      }
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
            ? <><span className="font-mono text-[#3b82f6] mr-2">{selected.entity_code}</span>{selected.company_name}</>
            : 'Select developer / company…'}
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
              placeholder="Search company or code…"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#e0e0e0] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c]/60 placeholder-[#555]"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.map(e => (
              <div
                key={e.entity_code}
                onClick={() => { onSelect(e.entity_code); setOpen(false); setQ(''); }}
                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#1e1e1e] transition-colors ${value === e.entity_code ? 'bg-[#1e1e1e]' : ''}`}
              >
                <span className="font-mono text-xs text-[#3b82f6] w-8 shrink-0">{e.entity_code}</span>
                <div className="min-w-0">
                  <p className="text-sm text-[#e0e0e0] truncate">{e.company_name}</p>
                  <p className="text-[10px] text-[#555] truncate">{e.classification}{e.is_manual ? ' · Manual' : ''}</p>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-sm text-[#555] text-center">No results</p>
            )}
          </div>
          <div className="border-t border-[#1e1e1e] p-2">
            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="w-full text-sm text-[#c9a84c] hover:text-[#dfc070] py-2 flex items-center justify-center gap-2 transition-colors"
              >
                <span className="text-lg leading-none">+</span> Register New Company
              </button>
            ) : (
              <div className="space-y-2 p-1">
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Company name…"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#e0e0e0] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c]/60 placeholder-[#555]"
                />
                <select
                  value={newCls}
                  onChange={e => setNewCls(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#e0e0e0] text-sm rounded-lg px-3 py-2 focus:outline-none"
                >
                  {CLASSIFICATIONS.map(c => <option key={c}>{c}</option>)}
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={handleAdd}
                    disabled={adding || !newName.trim()}
                    className="flex-1 bg-[#c9a84c] hover:bg-[#dfc070] disabled:opacity-40 text-[#0f0f0f] text-sm font-bold py-2 rounded-lg transition-colors"
                  >
                    {adding ? 'Registering…' : 'Register'}
                  </button>
                  <button
                    onClick={() => { setShowForm(false); setNewName(''); }}
                    className="px-3 text-[#888] hover:text-[#e0e0e0] text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Register Tab ──────────────────────────────────────────────────────────────

function RegisterTab({
  options, onEntityAdded, onConfigAdded, onAgentAdded, onZoneAdded,
}: {
  options: Options;
  onEntityAdded:  (e: Entity) => void;
  onConfigAdded:  (c: PropConfig) => void;
  onAgentAdded:   (a: Agent) => void;
  onZoneAdded:    (z: Zone) => void;
}) {
  const { configs, entities, agents, zones } = options;

  const [category,       setCategory]       = useState<'C' | 'R' | ''>('');
  const [coreType,       setCoreType]       = useState('');
  const [subType,        setSubType]        = useState('');
  const [typeCode,       setTypeCode]       = useState('');
  const [entityCode,     setEntityCode]     = useState('');
  const [agentCode,      setAgentCode]      = useState('');
  const [municipality,   setMunicipality]   = useState('');
  const [zoneCode,       setZoneCode]       = useState<number | null>(null);
  const [buildingName,   setBuildingName]   = useState('');
  const [floorRef,       setFloorRef]       = useState('');
  const [notes,          setNotes]          = useState('');
  const [nextSeq,        setNextSeq]        = useState<number | undefined>(undefined);

  const [submitting,    setSubmitting]    = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [error,         setError]         = useState<string | null>(null);

  // Inline-add state
  const [extraCoreTypes, setExtraCoreTypes] = useState<string[]>([]);
  const [extraSubTypes,  setExtraSubTypes]  = useState<Record<string, string[]>>({});
  const [addingCoreType, setAddingCoreType] = useState(false);
  const [addingSubType,  setAddingSubType]  = useState(false);
  const [addingConfig,   setAddingConfig]   = useState(false);
  const [addingEntity,   setAddingEntity]   = useState(false);
  const [addingAgent,    setAddingAgent]    = useState(false);
  const [addingZone,     setAddingZone]     = useState(false);
  const [toast,          setToast]          = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!category || !typeCode || !entityCode || !agentCode || !zoneCode) {
      setNextSeq(undefined);
      return;
    }
    const zone = String(zoneCode).padStart(2, '0');
    const prefix = `${category}${typeCode}${entityCode}${agentCode}${zone}`;
    authedFetch(`/api/code-registry/next-seq?prefix=${encodeURIComponent(prefix)}`)
      .then(r => r.json())
      .then(d => setNextSeq(d.nextSeq))
      .catch(() => {});
  }, [category, typeCode, entityCode, agentCode, zoneCode]);

  const categoryFilteredConfigs = category
    ? configs.filter(c => (c.category ?? 'R') === category)
    : configs;
  const coreTypes  = Array.from(new Set([...categoryFilteredConfigs.map(c => c.core_type), ...extraCoreTypes]));
  const subTypes   = Array.from(new Set([
    ...categoryFilteredConfigs.filter(c => c.core_type === coreType).map(c => c.sub_type),
    ...(extraSubTypes[coreType] ?? []),
  ]));
  const configOpts     = categoryFilteredConfigs.filter(c => c.core_type === coreType && c.sub_type === subType);
  const municipalities = Array.from(new Set(zones.map(z => z.municipality))).sort();
  const filteredZones  = zones.filter(z => z.municipality === municipality);

  function handleCategory(v: string) {
    setCategory(v as 'C' | 'R' | '');
    setCoreType(''); setSubType(''); setTypeCode('');
  }
  function handleCoreType(v: string) {
    setCoreType(v); setSubType(''); setTypeCode('');
  }
  function handleSubType(v: string) {
    setSubType(v); setTypeCode('');
  }
  function handleConfig(tc: string) { setTypeCode(tc); }
  function handleMunicipality(v: string) { setMunicipality(v); setZoneCode(null); }
  function handleZone(v: string) { setZoneCode(v ? parseInt(v) : null); }

  function resetForm() {
    setCategory('');
    setCoreType(''); setSubType(''); setTypeCode('');
    setEntityCode(''); setAgentCode('');
    setMunicipality(''); setZoneCode(null);
    setBuildingName(''); setFloorRef(''); setNotes('');
    setGeneratedCode(null); setError(null);
    setAddingEntity(false); setAddingAgent(false); setAddingZone(false);
  }

  async function handleSubmit() {
    if (!category || !typeCode || !entityCode || !agentCode || !zoneCode) {
      setError('Please complete all required fields: Category, Type, Entity, Agent, and Zone.');
      return;
    }
    setSubmitting(true); setError(null);
    try {
      const res  = await fetch('/api/code-registry/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typeCode, entityCode, agentCode, zoneCode, buildingName, floorRef, notes }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setError('Registration failed. Please try again.'); return; }
      setGeneratedCode(json.smartCode);
    } catch { setError('Network error. Please try again.'); }
    finally   { setSubmitting(false); }
  }

  const allFilled = !!(category && typeCode && entityCode && agentCode && zoneCode);

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      {/* Success banner */}
      {generatedCode && (
        <div className="bg-[#0a1a0a] border border-[#22c55e]/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[#22c55e] text-lg">✓</span>
            <span className="text-[#22c55e] font-semibold text-sm">Smart Code Registered Successfully</span>
          </div>
          <div className="font-mono text-2xl tracking-[0.2em] text-white mb-3">{generatedCode}</div>
          <div className="flex gap-3">
            <button
              onClick={() => copyToClipboard(generatedCode)}
              className="text-sm text-[#c9a84c] border border-[#c9a84c]/30 rounded-lg px-4 py-2 hover:bg-[#c9a84c]/10 transition-colors"
            >
              Copy Code
            </button>
            <button
              onClick={resetForm}
              className="text-sm text-[#888] border border-[#2a2a2a] rounded-lg px-4 py-2 hover:bg-[#1e1e1e] transition-colors"
            >
              Register Another
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-[#1a0a0a] border border-[#ef4444]/30 rounded-xl px-4 py-3 text-sm text-[#ef4444]">
          {error}
        </div>
      )}

      {/* Category */}
      <SectionCard title="Market Category *">
        <div className="grid grid-cols-2 gap-3">
          {([
            { val: 'R', label: 'Residential', desc: 'Apartments, Villas, Townhouses…', color: '#3b82f6' },
            { val: 'C', label: 'Commercial',  desc: 'Offices, Retail, Warehouses…',   color: '#f97316' },
          ] as const).map((opt) => (
            <button
              key={opt.val}
              onClick={() => handleCategory(opt.val)}
              className={`rounded-xl border p-4 text-left transition-all ${
                category === opt.val
                  ? 'border-opacity-60 bg-opacity-8'
                  : 'border-[#2a2a2a] bg-[#0d0d0d] hover:border-[#3a3a3a]'
              }`}
              style={category === opt.val ? {
                borderColor: opt.color + '60',
                backgroundColor: opt.color + '10',
              } : {}}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-6 h-6 rounded-md text-xs font-bold flex items-center justify-center font-mono"
                  style={{ background: opt.color + '20', color: opt.color }}
                >
                  {opt.val}
                </span>
                <span className="text-sm font-bold text-white">{opt.label}</span>
                {category === opt.val && (
                  <svg className="w-4 h-4 ml-auto shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" style={{ color: opt.color }}>
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                )}
              </div>
              <p className="text-[11px] text-[#555]">{opt.desc}</p>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* Property Configuration */}
      <SectionCard title={`Property Configuration${category ? ` — ${category === 'R' ? 'Residential' : 'Commercial'}` : ''}`}>
        {!category && (
          <p className="text-xs text-[#555] italic">Select a market category above first.</p>
        )}
        <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 ${!category ? 'opacity-40 pointer-events-none' : ''}`}>
          {/* Core Type */}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <label className="text-[11px] font-semibold text-[#888888] uppercase tracking-widest">Core Type *</label>
              <PlusBtn
                onClick={() => { setAddingCoreType(t => !t); setAddingSubType(false); setAddingConfig(false); }}
              />
            </div>
            <Select value={coreType} onChange={handleCoreType}>
              <option value="">Select…</option>
              {coreTypes.map(t => <option key={t}>{t}</option>)}
            </Select>
            {addingCoreType && (
              <InlineAdd
                placeholder="e.g. Commercial"
                onSave={async (v) => {
                  if (coreTypes.map(t => t.toLowerCase()).includes(v.toLowerCase())) {
                    setToast({ msg: `"${v}" already exists as a Core Type`, type: 'error' });
                    setAddingCoreType(false);
                    return;
                  }
                  setExtraCoreTypes(prev => [...prev, v]);
                  setCoreType(v); setSubType(''); setTypeCode('');
                  setAddingCoreType(false);
                  setToast({ msg: `Core Type "${v}" added`, type: 'success' });
                }}
                onCancel={() => setAddingCoreType(false)}
              />
            )}
          </div>

          {/* Sub-Type */}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <label className="text-[11px] font-semibold text-[#888888] uppercase tracking-widest">Sub-Type *</label>
              <PlusBtn
                onClick={() => { setAddingSubType(t => !t); setAddingCoreType(false); setAddingConfig(false); }}
                disabled={!coreType}
              />
            </div>
            <Select value={subType} onChange={handleSubType} disabled={!coreType}>
              <option value="">Select…</option>
              {subTypes.map(s => <option key={s}>{s}</option>)}
            </Select>
            {addingSubType && (
              <InlineAdd
                placeholder="e.g. Office Space"
                onSave={async (v) => {
                  if (subTypes.map(s => s.toLowerCase()).includes(v.toLowerCase())) {
                    setToast({ msg: `"${v}" already exists under ${coreType}`, type: 'error' });
                    setAddingSubType(false);
                    return;
                  }
                  setExtraSubTypes(prev => ({
                    ...prev,
                    [coreType]: [...(prev[coreType] ?? []), v],
                  }));
                  setSubType(v); setTypeCode('');
                  setAddingSubType(false);
                  setToast({ msg: `Sub-Type "${v}" added`, type: 'success' });
                }}
                onCancel={() => setAddingSubType(false)}
              />
            )}
          </div>

          {/* Configuration */}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <label className="text-[11px] font-semibold text-[#888888] uppercase tracking-widest">Configuration *</label>
              <PlusBtn
                onClick={() => { setAddingConfig(t => !t); setAddingCoreType(false); setAddingSubType(false); }}
                disabled={!subType}
              />
            </div>
            <Select value={typeCode} onChange={handleConfig} disabled={!subType}>
              <option value="">Select…</option>
              {configOpts.map(c => (
                <option key={c.type_code} value={c.type_code}>
                  {c.configuration} [{c.type_code}]
                </option>
              ))}
            </Select>
            {addingConfig && (
              <InlineAdd
                placeholder="e.g. 1 BHK or 2 BHK + Maid"
                validate={(v) =>
                  CONFIGURATION_REGEX.test(v)
                    ? null
                    : "Format: Studio, 1 BHK, 2 BHK + Maid, or 2 BHK + Maid (Private)"
                }
                onSave={async (v) => {
                  const duplicate = configs.find(
                    c => c.core_type === coreType && c.sub_type === subType &&
                         c.configuration.toLowerCase() === v.toLowerCase()
                  );
                  if (duplicate) {
                    setToast({ msg: `"${v}" already exists under ${coreType} › ${subType}`, type: 'error' });
                    setAddingConfig(false);
                    return;
                  }
                  const res = await fetch('/api/code-registry/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ coreType, subType, configuration: v, category }),
                  });
                  const json = await res.json();
                  if (res.status === 409) {
                    setToast({ msg: json.message ?? `"${v}" already exists`, type: 'error' });
                    setAddingConfig(false);
                    return;
                  }
                  if (!res.ok || json.error) throw new Error('Failed to save configuration');
                  const newCfg: PropConfig = {
                    type_code:            json.type_code,
                    core_type:            json.core_type,
                    sub_type:             json.sub_type,
                    configuration:        json.configuration,
                    integration_scenario: json.integration_scenario ?? '',
                    features:             json.features ?? '',
                    category:             json.category ?? category ?? 'R',
                  };
                  onConfigAdded(newCfg);
                  setTypeCode(json.type_code);
                  setAddingConfig(false);
                  setToast({ msg: `Configuration "${v}" [${json.type_code}] saved`, type: 'success' });
                }}
                onCancel={() => setAddingConfig(false)}
              />
            )}
          </div>
        </div>
        {typeCode && (
          <p className="text-[11px] text-[#555]">
            {configOpts.find(c => c.type_code === typeCode)?.integration_scenario}
          </p>
        )}
      </SectionCard>

      {/* Entity */}
      <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold text-[#555] uppercase tracking-[0.18em]">Developer / Company *</p>
          <PlusBtn onClick={() => { setAddingEntity(e => !e); setAddingAgent(false); }} />
        </div>
        <EntitySearch
          entities={entities}
          value={entityCode}
          onSelect={setEntityCode}
          onNewEntity={e => { onEntityAdded(e); setEntityCode(e.entity_code); }}
        />
        {addingEntity && (
          <EntityInlineAdd
            onSave={(e) => {
              onEntityAdded(e);
              setEntityCode(e.entity_code);
              setAddingEntity(false);
              setToast({ msg: `Company "${e.company_name}" [${e.entity_code}] registered`, type: 'success' });
            }}
            onCancel={() => setAddingEntity(false)}
          />
        )}
      </div>

      {/* Agent */}
      <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold text-[#555] uppercase tracking-[0.18em]">Agent *</p>
          <PlusBtn onClick={() => { setAddingAgent(a => !a); setAddingEntity(false); }} />
        </div>
        <AgentSearch
          agents={agents}
          value={agentCode}
          onSelect={setAgentCode}
          onNewAgent={a => {
            onAgentAdded(a);
            setAgentCode(a.agent_code);
            setToast({ msg: `Agent "${a.full_name}" [${a.agent_code}] registered`, type: 'success' });
          }}
        />
        {addingAgent && (
          <AgentInlineAdd
            onSave={(a) => {
              onAgentAdded(a);
              setAgentCode(a.agent_code);
              setAddingAgent(false);
              setToast({ msg: `Agent "${a.full_name}" [${a.agent_code}] registered`, type: 'success' });
            }}
            onCancel={() => setAddingAgent(false)}
          />
        )}
      </div>

      {/* Zone */}
      <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold text-[#555] uppercase tracking-[0.18em]">Zone *</p>
          <PlusBtn onClick={() => setAddingZone(z => !z)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel>Municipality</FieldLabel>
            <Select value={municipality} onChange={handleMunicipality}>
              <option value="">Select municipality…</option>
              {municipalities.map(m => <option key={m}>{m}</option>)}
            </Select>
          </div>
          <div>
            <FieldLabel>District / Zone</FieldLabel>
            <Select value={zoneCode?.toString() ?? ''} onChange={handleZone} disabled={!municipality}>
              <option value="">Select zone…</option>
              {filteredZones.map(z => (
                <option key={z.zone_code} value={z.zone_code}>
                  Zone {String(z.zone_code).padStart(2, '0')} — {z.district_name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {addingZone && (
          <ZoneInlineAdd
            municipalities={municipalities}
            onSave={(z) => {
              onZoneAdded(z);
              setMunicipality(z.municipality);
              setZoneCode(z.zone_code);
              setAddingZone(false);
              setToast({ msg: `Zone "${z.district_name}" [${String(z.zone_code).padStart(2,'0')}] registered`, type: 'success' });
            }}
            onCancel={() => setAddingZone(false)}
          />
        )}
      </div>

      {/* Property Reference */}
      <SectionCard title="Property Reference (Optional)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel>Building Name</FieldLabel>
            <Input value={buildingName} onChange={setBuildingName} placeholder="e.g. Tornado Tower" />
          </div>
          <div>
            <FieldLabel>Floor</FieldLabel>
            <Input value={floorRef} onChange={setFloorRef} placeholder="e.g. 14" />
          </div>
        </div>
        <div>
          <FieldLabel>Notes</FieldLabel>
          <Input value={notes} onChange={setNotes} placeholder="Optional remarks…" />
        </div>
      </SectionCard>

      {/* Code Preview */}
      <CodePreview
        category={category} typeCode={typeCode} entityCode={entityCode}
        agentCode={agentCode} zoneCode={zoneCode}
        generatedCode={generatedCode ?? undefined}
        nextSeq={nextSeq}
      />

      {/* Submit */}
      {!generatedCode && (
        <button
          onClick={handleSubmit}
          disabled={submitting || !allFilled}
          className="w-full py-3.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: allFilled ? 'linear-gradient(135deg,#c9a84c,#dfc070)' : '#1e1e1e',
            color:      allFilled ? '#0f0f0f' : '#555',
          }}
        >
          {submitting ? 'Registering…' : 'Generate & Register Smart Code'}
        </button>
      )}
    </div>
  );
}

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['Active', 'Closed', 'Cancelled', 'Archived'] as const;

function statusMeta(s: string) {
  switch (s) {
    case 'Active':    return { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.3)'   };
    case 'Closed':    return { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.3)'  };
    case 'Cancelled': return { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)'   };
    case 'Archived':  return { color: '#888888', bg: 'rgba(136,136,136,0.1)', border: 'rgba(136,136,136,0.3)' };
    default:          return { color: '#888888', bg: 'rgba(136,136,136,0.1)', border: 'rgba(136,136,136,0.3)' };
  }
}

function StatusBadge({ status }: { status: string }) {
  const m = statusMeta(status);
  return (
    <span style={{ color: m.color, background: m.bg, border: `1px solid ${m.border}` }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap">
      <span style={{ background: m.color }} className="w-1.5 h-1.5 rounded-full shrink-0" />
      {status}
    </span>
  );
}

// ── Detail / History slide-out modal ──────────────────────────────────────────

function CrDetailModal({
  record: init,
  onClose,
  onStatusChange,
}: {
  record: RegistryRecord;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [tab,     setTab]     = useState<'details' | 'history'>('details');
  const [record,  setRecord]  = useState(init);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingH, setLoadingH] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetch(`/api/code-registry/record/${init.id}`)
      .then(r => r.json())
      .then(d => setHistory(d.history ?? []))
      .finally(() => setLoadingH(false));
  }, [init.id]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  async function handleStatusChange(newStatus: string) {
    if (newStatus === record.status || updating) return;
    setUpdating(true);
    try {
      const res = await fetch('/api/code-registry/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: record.id, smartCode: record.smart_code, fromStatus: record.status, toStatus: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) return;
      setRecord(r => ({ ...r, status: newStatus }));
      if (json.historyEntry) setHistory(h => [json.historyEntry, ...h]);
      onStatusChange(record.id, newStatus);
    } finally { setUpdating(false); }
  }

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex gap-3 py-2.5 border-b border-[#1a1a1a] last:border-0">
      <span className="text-[10px] font-bold text-[#555] uppercase tracking-widest w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-[#c8c8c8] min-w-0 break-words">{value}</span>
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[290] bg-black/55 backdrop-blur-[2px]" onClick={onClose} />

      {/* Slide panel */}
      <div className="fixed inset-y-0 right-0 z-[300] w-full max-w-[480px] flex flex-col bg-[#111111] border-l border-[#1e1e1e] shadow-[−8px_0_48px_rgba(0,0,0,0.7)]">

        {/* Header */}
        <div className="shrink-0 px-5 py-4 border-b border-[#1e1e1e] flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1">Smart Code</p>
            <p className="font-mono text-xl font-bold tracking-[0.15em] text-white">{record.smart_code}</p>
            <div className="mt-2">
              <StatusBadge status={record.status} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-[#1a1a1a] hover:bg-[#252525] border border-[#2a2a2a] flex items-center justify-center text-[#666] hover:text-[#e0e0e0] transition-colors shrink-0 mt-0.5"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="w-3.5 h-3.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab bar */}
        <div className="shrink-0 flex border-b border-[#1e1e1e]">
          {(['details', 'history'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors ${
                tab === t
                  ? 'text-[#c9a84c] border-b-2 border-[#c9a84c]'
                  : 'text-[#555] hover:text-[#888]'
              }`}
            >
              {t === 'details' ? 'Details' : 'History Log'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'details' ? (
            <div className="px-5 py-4 space-y-0">
              {/* Status change */}
              <div className="flex gap-3 py-2.5 border-b border-[#1a1a1a] items-center">
                <span className="text-[10px] font-bold text-[#555] uppercase tracking-widest w-28 shrink-0">Status</span>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map(s => {
                    const m = statusMeta(s);
                    const active = s === record.status;
                    return (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        disabled={updating}
                        style={active ? { color: m.color, background: m.bg, border: `1px solid ${m.border}` } : {}}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all ${
                          active
                            ? 'cursor-default'
                            : 'text-[#555] bg-[#1a1a1a] border border-[#2a2a2a] hover:text-[#e0e0e0] hover:border-[#3a3a3a]'
                        } disabled:opacity-50`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Row label="Category"    value={
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  record.category === 'C'
                    ? 'bg-[#f97316]/10 text-[#f97316] border border-[#f97316]/20'
                    : 'bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20'
                }`}>
                  {record.category} — {record.category === 'C' ? 'Commercial' : 'Residential'}
                </span>
              } />
              <Row label="Sequence"    value={<span className="font-mono text-[#c9a84c]">#{record.sequence_number}</span>} />
              <Row label="Type Code"   value={<span className="font-mono text-xs text-[#a855f7] bg-[#a855f7]/10 px-1.5 py-0.5 rounded">{record.type_code}</span>} />
              <Row label="Core Type"   value={record.core_type} />
              <Row label="Sub-Type"    value={record.sub_type} />
              <Row label="Config"      value={record.configuration} />
              <Row label="Company"     value={<>{record.company_name}<br /><span className="text-[#555] text-[10px] font-mono">{record.entity_code}</span></>} />
              <Row label="Class."      value={<span className="text-[#888] text-xs">{record.classification}</span>} />
              <Row label="Agent"       value={<><span className="font-mono text-[#22c55e] text-xs mr-1">{record.agent_code}</span>{record.agent_name}</>} />
              <Row label="Zone"        value={<>Zone {String(record.zone_code).padStart(2, '0')} — {record.district_name}<br /><span className="text-[#555] text-xs">{record.municipality}</span></>} />
              {record.building_name && <Row label="Building"  value={record.building_name} />}
              {record.floor_ref     && <Row label="Floor"     value={record.floor_ref} />}
              {record.notes         && <Row label="Notes"     value={<span className="text-[#888]">{record.notes}</span>} />}
              <Row label="Registered" value={<span className="text-[#555] text-xs">{new Date(record.created_at).toLocaleString('en-GB')}</span>} />
            </div>
          ) : (
            <div className="px-5 py-4">
              {loadingH ? (
                <p className="text-[#555] text-sm text-center py-8">Loading…</p>
              ) : history.length === 0 ? (
                <p className="text-[#555] text-sm text-center py-8">No status changes recorded yet.</p>
              ) : (
                <div className="space-y-0">
                  {history.map((h, i) => {
                    const m = statusMeta(h.to_status);
                    return (
                      <div key={h.id} className="relative pl-5 pb-5">
                        {/* Timeline line */}
                        {i < history.length - 1 && (
                          <div className="absolute left-[7px] top-5 bottom-0 w-px bg-[#1e1e1e]" />
                        )}
                        {/* Dot */}
                        <div className="absolute left-0 top-1 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center"
                          style={{ borderColor: m.color, background: m.bg }}>
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }} />
                        </div>
                        {/* Content */}
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {h.from_status && (
                              <>
                                <StatusBadge status={h.from_status} />
                                <svg className="w-3 h-3 text-[#444]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                              </>
                            )}
                            <StatusBadge status={h.to_status} />
                          </div>
                          <p className="text-[10px] text-[#555] mt-1">
                            {new Date(h.changed_at).toLocaleString('en-GB')} · {h.changed_by}
                          </p>
                          {h.notes && <p className="text-xs text-[#888] mt-0.5 italic">{h.notes}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Registry PDF report ───────────────────────────────────────────────────────

function buildCrReportHTML(records: RegistryRecord[], salutation: string): string {
  const generatedAt = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const rows = records.map((r, i) => `
    <tr style="background:${i % 2 === 1 ? '#f8fafc' : '#ffffff'}">
      <td style="padding:5pt 7pt 5pt 0;border-bottom:1px solid #e2e8f0;font-family:monospace;font-size:9pt;font-weight:700;color:#6d28d9;letter-spacing:0.04em;white-space:nowrap">${r.smart_code}</td>
      <td style="padding:5pt 7pt;border-bottom:1px solid #e2e8f0;font-size:8.5pt;white-space:nowrap">
        <span style="background:#f3e8ff;color:#6d28d9;padding:1pt 5pt;border-radius:3pt;font-weight:700">${r.type_code}</span>
        <span style="color:#555;margin-left:4pt">${r.configuration}</span>
      </td>
      <td style="padding:5pt 7pt;border-bottom:1px solid #e2e8f0;font-size:8.5pt">${r.company_name}<br><span style="color:#94a3b8;font-size:7.5pt">${r.entity_code}</span></td>
      <td style="padding:5pt 7pt;border-bottom:1px solid #e2e8f0;font-size:8.5pt;white-space:nowrap"><span style="font-family:monospace;color:#15803d;font-weight:700">${r.agent_code}</span> <span style="color:#555">${r.agent_name}</span></td>
      <td style="padding:5pt 7pt;border-bottom:1px solid #e2e8f0;font-size:8.5pt">${r.district_name}<br><span style="color:#94a3b8;font-size:7.5pt">Zone ${String(r.zone_code).padStart(2, '0')} · ${r.municipality}</span></td>
      <td style="padding:5pt 7pt;border-bottom:1px solid #e2e8f0;font-size:8.5pt;color:#475569">${[r.building_name, r.floor_ref && `Fl.${r.floor_ref}`].filter(Boolean).join(' · ') || '—'}</td>
      <td style="padding:5pt 0 5pt 7pt;border-bottom:1px solid #e2e8f0;font-size:8.5pt;color:#475569;white-space:nowrap">${new Date(r.created_at).toLocaleDateString('en-GB')}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Smart Code Registry Report</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:10pt;color:#1a1a1a;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@media screen{
  body{background:#bfc4cc!important;padding:24px 0 48px}
  .rpt-toolbar{width:210mm;margin:0 auto 10px;padding:0 2px;display:flex;align-items:center;justify-content:space-between;gap:10px}
  .rpt-toolbar-label{font-size:10px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.08em;white-space:nowrap}
  .rpt-toolbar-greeting{display:flex;align-items:center;gap:6px;flex:1}
  .rpt-toolbar-greeting label{font-size:9px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.08em;white-space:nowrap}
  .rpt-toolbar-greeting input{flex:1;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);border-radius:4px;color:#fff;font-size:11px;padding:5px 10px;outline:none}
  .rpt-toolbar-greeting input:focus{border-color:#c9a84c}
  .rpt-toolbar-btns{display:flex;gap:8px}
  .rpt-btn-print{background:#c9a84c;color:#0f0f0f;border:none;padding:7px 20px;font-size:11px;font-weight:700;border-radius:5px;cursor:pointer}
  .rpt-btn-print:hover{background:#dfc070}
  .rpt-btn-close{background:rgba(255,255,255,0.12);color:#fff;border:1px solid rgba(255,255,255,0.22);padding:7px 14px;font-size:11px;font-weight:600;border-radius:5px;cursor:pointer}
  .rpt-btn-close:hover{background:rgba(255,255,255,0.22)}
  .rpt-page{width:210mm;min-height:297mm;margin:0 auto;background:#fff;box-shadow:0 8px 40px rgba(0,0,0,0.30);padding:18mm 16mm 22mm}
}
@media print{
  .rpt-toolbar{display:none!important}
  body{background:#fff!important}
  .rpt-page{padding:0;box-shadow:none}
  tr{page-break-inside:avoid}
}
@page{
  size:A4 portrait;
  margin:16mm 14mm 26mm 14mm;
  @bottom-left{content:"Generated: ${generatedAt}";font-family:Arial,sans-serif;font-size:7.5pt;color:#64748b}
  @bottom-center{content:"Page " counter(page) " / " counter(pages);font-family:Arial,sans-serif;font-size:7.5pt;color:#64748b}
  @bottom-right{content:"Privé Group Real Estate  ·  privegroupre.com  ·  Confidential";font-family:Arial,sans-serif;font-size:7.5pt;font-weight:700;color:#1a1a1a}
}
.rpt-brand-tbl{width:100%;border-collapse:collapse;margin-bottom:8pt}
.rpt-brand-name{font-size:16pt;font-weight:700;color:#0f172a;margin-bottom:4pt;line-height:1.15}
.rpt-brand-addr{font-size:9pt;color:#64748b;line-height:1.55;margin-bottom:2pt}
.rpt-brand-lic{font-size:9pt;color:#64748b;font-style:italic;line-height:1.4}
.rpt-logo-img{height:68px;width:auto;display:block;margin-left:auto}
.rpt-hr-gold{border:none;border-top:2px solid #c9a84c;margin:7pt 0 9pt}
.rpt-hr-light{border:none;border-top:1px solid #e2e8f0;margin:9pt 0 8pt}
.rpt-report-title{font-size:14pt;font-weight:700;color:#c9a84c;letter-spacing:0.01em;line-height:1.3}
.rpt-salutation{font-size:10.5pt;font-weight:500;color:#334155;margin-top:5pt;margin-bottom:2pt;line-height:1.5;font-style:italic}
.rpt-sec-lbl{font-size:7pt;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.18em;margin-top:10pt;margin-bottom:5pt}
.rpt-reg-tbl{width:100%;border-collapse:collapse}
.rpt-reg-tbl th{font-size:7pt;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.12em;text-align:left;padding:5pt 7pt 5pt 0;border-bottom:2px solid #c9a84c;white-space:nowrap}
.rpt-reg-tbl th:last-child{padding-right:0}
</style>
</head>
<body>
<div class="rpt-toolbar">
  <span class="rpt-toolbar-label">${records.length} Record${records.length !== 1 ? 's' : ''}</span>
  <div class="rpt-toolbar-btns">
    <button class="rpt-btn-print" onclick="window.print()">PRINT REPORT</button>
    <button class="rpt-btn-close" onclick="window.parent.postMessage('cr-modal-close','*')">Close</button>
  </div>
</div>
<div class="rpt-page">
  <table class="rpt-brand-tbl"><tbody><tr>
    <td style="vertical-align:top;width:62%">
      <p class="rpt-brand-name">Privé Group Real Estate Qatar</p>
      <p class="rpt-brand-addr">Old Salata area, Office 902, Building No 08, GITCO Tower,<br>Emrair St, Doha&#8209;Qatar</p>
      <p class="rpt-brand-lic">Brokerage Licence No 773 | CR No 187753</p>
    </td>
    <td style="vertical-align:top;text-align:right;width:38%">
      <img src="/brand/logo-print.png" alt="Privé Group Real Estate" class="rpt-logo-img"/>
    </td>
  </tr></tbody></table>
  <hr class="rpt-hr-gold"/>
  <p class="rpt-report-title">Smart Code Registry Report</p>
  ${salutation ? `<p class="rpt-salutation">${salutation}</p>` : ''}
  <hr class="rpt-hr-light"/>
  <p class="rpt-sec-lbl" style="margin-top:0">Registry Records — ${records.length} entr${records.length !== 1 ? 'ies' : 'y'}</p>
  <table class="rpt-reg-tbl">
    <thead><tr>
      <th>Smart Code</th>
      <th style="padding-left:7pt">Type</th>
      <th style="padding-left:7pt">Company</th>
      <th style="padding-left:7pt">Agent</th>
      <th style="padding-left:7pt">Zone / District</th>
      <th style="padding-left:7pt">Building</th>
      <th style="padding-left:7pt">Registered</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>
</body>
</html>`;
}

function buildCrWaText(records: RegistryRecord[]): string {
  const lines = records.map((r, i) =>
    `${i + 1}. *${r.smart_code}*\n` +
    `   ${r.core_type} › ${r.sub_type} › ${r.configuration} [${r.type_code}]\n` +
    `   Company: ${r.company_name}\n` +
    `   Agent: ${r.agent_name} (${r.agent_code})\n` +
    `   Zone ${String(r.zone_code).padStart(2, '0')} — ${r.district_name}, ${r.municipality}` +
    (r.building_name ? `\n   Building: ${r.building_name}` : '') +
    `\n   Registered: ${new Date(r.created_at).toLocaleDateString('en-GB')}`
  ).join('\n\n');
  return `*Privé Group Real Estate — Smart Code Registry*\n\n${lines}\n\n_Connecting you with property, the Privé way_`;
}

function buildCrEmailBody(records: RegistryRecord[]): string {
  const lines = records.map((r, i) =>
    `${i + 1}. ${r.smart_code}\n` +
    `   ${r.core_type} › ${r.sub_type} › ${r.configuration} [${r.type_code}]\n` +
    `   Company: ${r.company_name} (${r.entity_code})\n` +
    `   Agent: ${r.agent_name} (${r.agent_code})\n` +
    `   Zone ${String(r.zone_code).padStart(2, '0')} — ${r.district_name}, ${r.municipality}` +
    (r.building_name ? `\n   Building: ${r.building_name}` : '') +
    `\n   Registered: ${new Date(r.created_at).toLocaleDateString('en-GB')}`
  ).join('\n\n');
  const subject = `Smart Code Registry — ${records.length} Record${records.length !== 1 ? 's' : ''}`;
  const body = `Smart Code Registry Export\nPrivé Group Real Estate\n${'─'.repeat(40)}\n\n${lines}\n\n${'─'.repeat(40)}\nConnecting you with property, the Privé way`;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// ── PDF Modal ─────────────────────────────────────────────────────────────────

function CrPdfModal({ records, onClose }: { records: RegistryRecord[]; onClose: () => void }) {
  const [salutation, setSalutation] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const html = buildCrReportHTML(records, salutation);

  function handleDownload() {
    const blob = new Blob([buildCrReportHTML(records, salutation)], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Smart_Code_Registry_${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Close on Escape or postMessage from iframe
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onMsg = (e: MessageEvent)  => { if (e.data === 'cr-modal-close') onClose(); };
    document.addEventListener('keydown', onKey);
    window.addEventListener('message', onMsg);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('message', onMsg);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-[#0a0a0a]">
      {/* Toolbar */}
      <div className="shrink-0 bg-[#111111] border-b border-[#1e1e1e] px-5 py-3 flex items-center gap-4">
        <span className="text-[11px] font-bold text-[#555] uppercase tracking-widest shrink-0">
          {records.length} Record{records.length !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <label className="text-[9px] font-bold text-[#555] uppercase tracking-widest shrink-0">Salutation</label>
          <input
            value={salutation}
            onChange={e => setSalutation(e.target.value)}
            placeholder="e.g. Dear Mr. Ahmed Al-Rashid,"
            className="flex-1 min-w-0 bg-[#1a1a1a] border border-[#2a2a2a] text-[#e0e0e0] text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#c9a84c]/60 placeholder-[#444]"
          />
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleDownload}
            className="bg-[#c9a84c] hover:bg-[#dfc070] text-[#0f0f0f] text-sm font-bold px-4 py-2 rounded-lg transition-colors"
          >
            Download PDF
          </button>
          <button
            onClick={onClose}
            className="bg-[#1a1a1a] hover:bg-[#242424] border border-[#2a2a2a] text-[#888] hover:text-[#e0e0e0] text-sm px-4 py-2 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* A4 Preview via srcdoc iframe */}
      <div className="flex-1 overflow-hidden bg-[#bfc4cc]">
        <iframe
          ref={iframeRef}
          srcDoc={html}
          title="Registry PDF Preview"
          className="w-full h-full border-0"
          sandbox="allow-same-origin allow-scripts allow-modals"
        />
      </div>
    </div>
  );
}

// ── Smart Codes Tab (AXIOM Inventory Search) ──────────────────────────────────

type UnitRecord = {
  id: string; realtor_name: string;
  master_code: string | null; smart_code: string | null;
  property: string; unit_no: string; zone_code: number; zone: string;
  type: string; config: string; bathrooms: number; parking: boolean | null;
  kitchen: string | null; furnishing: string | null; rent: number;
  status: string; created_at: string;
};

function UnitStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    Available:         { label: 'Available',   cls: 'text-[#22c55e] bg-[#22c55e]/10 border-[#22c55e]/20' },
    Leased:            { label: 'Leased',      cls: 'text-[#f97316] bg-[#f97316]/10 border-[#f97316]/20' },
    Reserved:          { label: 'Reserved',    cls: 'text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/20' },
    Under_Maintenance: { label: 'Maintenance', cls: 'text-[#a855f7] bg-[#a855f7]/10 border-[#a855f7]/20' },
  };
  const e = map[status] ?? { label: status, cls: 'text-[#888] bg-[#1a1a1a] border-[#2a2a2a]' };
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${e.cls}`}>
      {e.label}
    </span>
  );
}

function KitchenBadge({ kitchen }: { kitchen: string | null }) {
  if (!kitchen) return <span className="text-[#444] text-[10px]">—</span>;
  const cls: Record<string, string> = {
    Open:   'text-[#22c55e] bg-[#22c55e]/10 border-[#22c55e]/20',
    Closed: 'text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/20',
    Yes:    'text-[#22c55e] bg-[#22c55e]/10 border-[#22c55e]/20',
    Pantry: 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20',
  };
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cls[kitchen] ?? 'text-[#888] bg-[#1a1a1a] border-[#2a2a2a]'}`}>
      {kitchen}
    </span>
  );
}

const UNIT_TYPES   = ['Apartment','Villa','Penthouse','Studio','Duplex','Office','Retail','Warehouse'];
const UNIT_CONFIGS = ['Studio','1 BHK','2 BHK','3 BHK','4 BHK','5 BHK','Office'];

function SmartCodesTab({ options }: { options: Options }) {
  const { agents, zones } = options;

  const [q,           setQ]         = useState('');
  const [unitType,    setUnitType]  = useState('');
  const [config,      setConfig]    = useState('');
  const [company,     setCompany]   = useState('');
  const [agentCode,   setAgentCode] = useState('');
  const [municipality, setMuni]     = useState('');
  const [zoneCode,    setZoneCode]  = useState('');
  const [dateFrom,    setDateFrom]  = useState('');
  const [dateTo,      setDateTo]    = useState('');
  const [page,     setPage]     = useState(1);
  const [results,  setResults]  = useState<UnitRecord[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);

  const municipalities = Array.from(new Set(zones.map(z => z.municipality))).sort();
  const filteredZones  = zones.filter(z => !municipality || z.municipality === municipality);

  const search = useCallback(async (p = 1) => {
    setLoading(true); setSearched(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (q)           params.set('q',         q);
      if (unitType)    params.set('type',       unitType);
      if (config)      params.set('config',     config);
      if (company)     params.set('company',    company);
      if (agentCode)   params.set('agentCode',  agentCode);
      if (zoneCode)    params.set('zoneCode',   zoneCode);
      if (!zoneCode && municipality) {
        const codes = zones.filter(z => z.municipality === municipality).map(z => z.zone_code).join(',');
        if (codes) params.set('zoneCodes', codes);
      }
      if (dateFrom)    params.set('dateFrom',   dateFrom);
      if (dateTo)      params.set('dateTo',     dateTo);
      const res  = await authedFetch(`/api/code-registry/smart-codes?${params}`);
      const json = await res.json();
      setResults(json.data ?? []); setTotal(json.total ?? 0); setPage(p);
    } finally { setLoading(false); }
  }, [q, unitType, config, company, agentCode, zoneCode, municipality, dateFrom, dateTo, zones]);

  function exportExcel() {
    if (!results.length) return;
    const rows = results.map(r => ({
      'Realtor':     r.realtor_name,
      'Master Code': r.master_code ?? '',
      'Smart Code':  r.smart_code  ?? '',
      'Property':    r.property,
      'Unit No':     r.unit_no,
      'Zone Code':   r.zone_code,
      'Zone':        r.zone,
      'Type':        r.type,
      'Config':      r.config,
      'Bathrooms':   r.bathrooms,
      'Parking':     r.parking ? 'Yes' : 'No',
      'Kitchen':     r.kitchen  ?? '',
      'Furnishing':  r.furnishing ?? '',
      'Rent (QAR)':  r.rent,
      'Status':      r.status,
      'Imported':    new Date(r.created_at).toLocaleDateString('en-GB'),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Smart Codes');
    XLSX.writeFile(wb, `Smart_Codes_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function clearAll() {
    setQ(''); setUnitType(''); setConfig(''); setCompany(''); setAgentCode('');
    setMuni(''); setZoneCode(''); setDateFrom(''); setDateTo('');
    setResults([]); setTotal(0); setSearched(false);
  }

  const pageSize   = 25;
  const totalPages = Math.ceil(total / pageSize);
  const sel = 'bg-[#1a1a1a] border border-[#2a2a2a] text-[#e0e0e0] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c]/60 w-full';

  return (
    <div className="space-y-4">
      {/* Filter Panel */}
      <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-5 space-y-4">
        <p className="text-[10px] font-bold text-[#555] uppercase tracking-[0.18em]">Search AXIOM Inventory</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <FieldLabel>Smart Code / Master Code / Property</FieldLabel>
            <input
              type="text" value={q} onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search(1)}
              placeholder="Search code, property, realtor…"
              className={sel + ' placeholder-[#555]'}
            />
          </div>
          <div>
            <FieldLabel>Type</FieldLabel>
            <select value={unitType} onChange={e => setUnitType(e.target.value)} className={sel}>
              <option value="">All types</option>
              {UNIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Config</FieldLabel>
            <select value={config} onChange={e => setConfig(e.target.value)} className={sel}>
              <option value="">All configs</option>
              {UNIT_CONFIGS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Company / Realtor</FieldLabel>
            <input
              type="text" value={company} onChange={e => setCompany(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search(1)}
              placeholder="Realtor name…"
              className={sel + ' placeholder-[#555]'}
            />
          </div>
          <div>
            <FieldLabel>Agent</FieldLabel>
            <select value={agentCode} onChange={e => setAgentCode(e.target.value)} className={sel}>
              <option value="">All agents</option>
              {agents.map(a => (
                <option key={a.agent_code} value={a.agent_code}>
                  {a.agent_code} — {a.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Municipality</FieldLabel>
            <select value={municipality} onChange={e => { setMuni(e.target.value); setZoneCode(''); }} className={sel}>
              <option value="">All municipalities</option>
              {municipalities.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Zone</FieldLabel>
            <select value={zoneCode} onChange={e => setZoneCode(e.target.value)} className={sel}>
              <option value="">All zones</option>
              {filteredZones.map(z => (
                <option key={z.zone_code} value={z.zone_code}>
                  Z{String(z.zone_code).padStart(2, '0')} — {z.district_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>From</FieldLabel>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={sel} />
          </div>
          <div>
            <FieldLabel>To</FieldLabel>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={sel} />
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button
            onClick={() => search(1)}
            className="bg-[#c9a84c] hover:bg-[#dfc070] text-[#0f0f0f] text-sm font-bold px-5 py-2.5 rounded-lg transition-colors"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
          <button
            onClick={clearAll}
            className="text-[#888] hover:text-[#e0e0e0] text-sm border border-[#2a2a2a] px-4 py-2.5 rounded-lg transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Results */}
      {searched && (
        <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e1e1e] gap-3 flex-wrap">
            <p className="text-sm text-[#888]">
              {loading ? 'Loading…' : `${total.toLocaleString()} unit${total !== 1 ? 's' : ''} found`}
            </p>
            <button
              onClick={exportExcel}
              disabled={!results.length}
              className="flex items-center gap-2 text-xs font-semibold text-[#22c55e] border border-[#22c55e]/30 px-3 py-1.5 rounded-lg hover:bg-[#22c55e]/10 disabled:opacity-40 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Excel
            </button>
          </div>

          {results.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: '960px' }}>
                  <thead>
                    <tr className="border-b border-[#1e1e1e]">
                      {['Realtor','Smart Code','Property / Unit','Zone / District','Type · Config','Bath','P','Kitchen','Furnishing','Rent (QAR/mo)','Status',''].map((h, i) => (
                        <th key={i} className="text-left px-3 py-2.5 text-[10px] font-bold text-[#555] uppercase tracking-widest whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(r => (
                      <tr key={r.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors group">
                        {/* Realtor */}
                        <td className="px-3 py-2.5 max-w-[130px]">
                          <p className="text-xs text-[#e0e0e0] truncate">{r.realtor_name}</p>
                        </td>
                        {/* Smart Code — dual-stacked: master (blue) on top, smart (green chip) below */}
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col gap-0.5">
                            {r.master_code ? (
                              <button
                                onClick={() => copyToClipboard(r.master_code!)}
                                className="font-mono text-[11px] text-[#3b82f6] tracking-widest text-left hover:text-[#60a5fa] transition-colors leading-tight"
                                title="Copy master code"
                              >
                                {r.master_code}
                              </button>
                            ) : (
                              <span className="text-[10px] text-[#333] leading-tight">—</span>
                            )}
                            {r.smart_code ? (
                              <button
                                onClick={() => copyToClipboard(r.smart_code!)}
                                className="inline-flex items-center self-start text-[10px] font-mono font-semibold text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/20 px-1.5 py-0.5 rounded hover:bg-[#22c55e]/20 transition-colors"
                                title="Copy smart code"
                              >
                                {r.smart_code}
                              </button>
                            ) : (
                              <span className="text-[10px] text-[#333]">—</span>
                            )}
                          </div>
                        </td>
                        {/* Property / Unit */}
                        <td className="px-3 py-2.5 max-w-[160px]">
                          <p className="text-xs font-semibold text-[#e0e0e0] truncate">{r.property}</p>
                          <p className="text-[10px] text-[#666] mt-0.5">{r.unit_no}</p>
                        </td>
                        {/* Zone / District */}
                        <td className="px-3 py-2.5 max-w-[130px]">
                          <p className="text-[10px] font-semibold font-mono text-[#c9a84c]">
                            Z-{String(r.zone_code).padStart(2, '0')}
                          </p>
                          <p className="text-[10px] text-[#666] truncate">{r.zone}</p>
                        </td>
                        {/* Type · Config */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <p className="text-xs text-[#e0e0e0]">
                            <span className="text-[#888]">{r.type}</span>
                            {r.config && <> · <span className="font-semibold">{r.config}</span></>}
                          </p>
                        </td>
                        {/* Bath */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <svg className="w-3 h-3 text-[#888] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                            <span className="text-xs text-[#e0e0e0]">{r.bathrooms || '—'}</span>
                          </div>
                        </td>
                        {/* Parking */}
                        <td className="px-3 py-2.5 text-center">
                          {r.parking
                            ? <svg className="w-3.5 h-3.5 text-[#22c55e] mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            : <span className="text-[#333] text-xs">—</span>}
                        </td>
                        {/* Kitchen */}
                        <td className="px-3 py-2.5">
                          <KitchenBadge kitchen={r.kitchen} />
                        </td>
                        {/* Furnishing */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <p className="text-[10px] text-[#888]">
                            {r.furnishing === 'Fully Furnished' ? 'Fully Furn.'
                              : r.furnishing === 'Semi-Furnished' ? 'Semi-Furn.'
                              : r.furnishing ?? '—'}
                          </p>
                        </td>
                        {/* Rent */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <p className="text-xs font-semibold text-[#e0e0e0]">
                            {r.rent ? `QAR ${r.rent.toLocaleString()}` : '—'}
                          </p>
                        </td>
                        {/* Status */}
                        <td className="px-3 py-2.5">
                          <UnitStatusBadge status={r.status} />
                        </td>
                        {/* Copy row */}
                        <td className="px-2 py-2.5">
                          <button
                            onClick={() => {
                              const text = [r.master_code, r.smart_code, `${r.property} ${r.unit_no}`, r.zone,
                                `${r.type} ${r.config}`, `QAR ${r.rent?.toLocaleString()}`, r.status].filter(Boolean).join(' | ');
                              copyToClipboard(text);
                            }}
                            className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded hover:bg-[#252525] flex items-center justify-center text-[#666] hover:text-[#e0e0e0] transition-all"
                            title="Copy row"
                          >⋮</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-[#1e1e1e]">
                  <button disabled={page <= 1} onClick={() => search(page - 1)} className="text-sm text-[#888] hover:text-[#e0e0e0] disabled:opacity-30 transition-colors">← Previous</button>
                  <span className="text-xs text-[#555]">Page {page} of {totalPages}</span>
                  <button disabled={page >= totalPages} onClick={() => search(page + 1)} className="text-sm text-[#888] hover:text-[#e0e0e0] disabled:opacity-30 transition-colors">Next →</button>
                </div>
              )}
            </>
          ) : (
            !loading && (
              <div className="px-5 py-12 text-center text-[#555] text-sm">
                No records found. Adjust filters and search again.
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ── Realtor Registry Tab ──────────────────────────────────────────────────────

type RealtorRow = { id: string; name: string; classification: string | null; moci_id: string | null };

function RealtorRegistryTab() {
  const { role } = useAuth();
  const isReadOnly = role !== 'superuser' && role !== 'administrator';
  const [readOnlyAlert, setReadOnlyAlert] = useState(false);

  const [realtors, setRealtors]     = useState<RealtorRow[]>([]);
  const [loading,  setLoading]      = useState(true);
  const [search,   setSearch]       = useState('');
  const [adding,   setAdding]       = useState(false);
  const [newName,  setNewName]      = useState('');
  const [newClass, setNewClass]     = useState('');
  const [saving,   setSaving]       = useState(false);
  const [err,      setErr]          = useState('');
  const [toast,    setToast]        = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    authedFetch('/api/realtors')
      .then(r => r.json())
      .then(d => setRealtors(d.realtors ?? []))
      .catch(() => setErr('Failed to load realtors.'))
      .finally(() => setLoading(false));
  }, []);

  async function saveRealtor() {
    if (isReadOnly) { setReadOnlyAlert(true); return; }
    if (!newName.trim()) { setErr('Company name is required.'); return; }
    if (!newClass) { setErr('Classification is required.'); return; }
    if (realtors.some(r => r.name.toLowerCase() === newName.trim().toLowerCase())) {
      setErr(`"${newName.trim()}" already exists.`);
      return;
    }
    setSaving(true); setErr('');
    try {
      const res = await authedFetch('/api/realtors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), classification: newClass }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(typeof json.error === 'string' ? json.error : 'Failed to save');
      const r: RealtorRow = json.realtor;
      setRealtors(prev => [...prev, r].sort((a, b) => a.name.localeCompare(b.name)));
      setAdding(false);
      setNewName(''); setNewClass('');
      setToast({ msg: `Realtor "${r.name}" registered`, type: 'success' });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const clsColor: Record<string, string> = {
    'Semi-Government & Master Developer':      '#3b82f6',
    'Elite Private Developer & Conglomerate':  '#a855f7',
    'Top International & Local Brokerage':     '#f97316',
    'Institutional Property Manager':          '#14b8a6',
    'Independent':                             '#888888',
  };

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      {/* ── Read-Only Intercept Modal ── */}
      {readOnlyAlert && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm mx-4 bg-[#181818] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-[#111] border-b border-[#2a2a2a] flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#e0e0e0]">Read-Only Access</p>
                <p className="text-[11px] text-[#555] mt-0.5">Code Registry — Realtors</p>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-[#aaa] leading-relaxed">
                You have <span className="text-[#e0e0e0] font-semibold">view-only</span> access to the Realtor Registry. Add, edit, and delete actions are restricted to Administrators.
              </p>
              <p className="text-[12px] text-[#666]">
                To create, modify, or remove a realtor record, please contact your Administrator to process the request.
              </p>
              <button
                onClick={() => setReadOnlyAlert(false)}
                className="w-full py-2 text-sm font-bold text-[#0f0f0f] bg-[#c9a84c] hover:bg-[#dfc070] rounded-lg transition-colors"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header strip */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-[#e0e0e0]">Realtor Registry</h2>
          <p className="text-[11px] text-[#555] mt-0.5">Shared brokerage registry — used across Units Inventory, Axiom Pipeline, and Smart Code generation</p>
        </div>
        {isReadOnly ? (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-xs text-[#555] font-medium">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
            View Only
          </span>
        ) : (
          <button
            onClick={() => { setAdding(a => !a); setErr(''); setNewName(''); setNewClass(''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#c9a84c] hover:bg-[#dfc070] text-[#0f0f0f] text-xs font-bold rounded-lg transition-colors"
          >
            <span className="text-base leading-none">+</span> Add Realtor
          </button>
        )}
      </div>

      {/* Inline add form — admin only */}
      {adding && !isReadOnly && (
        <div className="rounded-xl border border-[#c9a84c]/20 bg-[#c9a84c]/5 p-5 space-y-4">
          <p className="text-[10px] font-bold text-[#c9a84c] uppercase tracking-widest">Register New Realtor</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Company Name *</FieldLabel>
              <Input
                value={newName}
                onChange={setNewName}
                placeholder="e.g. Privé Real Estate"
              />
            </div>
            <div>
              <FieldLabel>Classification *</FieldLabel>
              <Select value={newClass} onChange={setNewClass}>
                <option value="">Select classification…</option>
                {CLASSIFICATIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
          </div>

          {err && <p className="text-[11px] text-[#ef4444]">{err}</p>}

          <div className="flex gap-2">
            <button
              onClick={saveRealtor}
              disabled={saving || !newName.trim() || !newClass}
              className="flex-1 bg-[#c9a84c] hover:bg-[#dfc070] disabled:opacity-40 text-[#0f0f0f] text-sm font-bold py-2 rounded-lg transition-colors"
            >
              {saving ? 'Registering…' : 'Register Realtor'}
            </button>
            <button
              onClick={() => { setAdding(false); setErr(''); }}
              className="px-4 text-[#888] hover:text-[#e0e0e0] text-sm border border-[#2a2a2a] rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" strokeLinecap="round"/>
        </svg>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or classification…"
          className="w-full bg-[#141414] border border-[#1e1e1e] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[#e0e0e0] placeholder-[#555] focus:outline-none focus:border-[#c9a84c]/40 transition-colors"
        />
      </div>

      {/* Realtor list */}
      {(() => {
        const filtered = search
          ? realtors.filter(r =>
              r.name.toLowerCase().includes(search.toLowerCase()) ||
              (r.classification ?? '').toLowerCase().includes(search.toLowerCase())
            )
          : realtors;
        return (
          <>
            <div className="rounded-xl border border-[#1e1e1e] overflow-hidden">
              <div className="bg-[#0d0d0d] border-b border-[#1e1e1e] px-4 py-2.5 grid grid-cols-12 gap-2">
                <span className="col-span-5 text-[9px] font-bold text-[#555] uppercase tracking-wider">Company Name</span>
                <span className="col-span-5 text-[9px] font-bold text-[#555] uppercase tracking-wider">Classification</span>
                <span className="col-span-2 text-[9px] font-bold text-[#555] uppercase tracking-wider">MOCI ID</span>
              </div>
              {loading && <div className="px-4 py-8 text-center text-xs text-[#555]">Loading…</div>}
              {!loading && filtered.length === 0 && (
                <div className="px-4 py-8 text-center text-xs text-[#555]">
                  {search ? `No results for "${search}"` : 'No realtors registered yet.'}
                </div>
              )}
              {filtered.map(r => (
                <div key={r.id} className="px-4 py-2.5 grid grid-cols-12 gap-2 border-b border-[#1a1a1a] hover:bg-[#111] transition-colors">
                  <span className="col-span-5 text-sm font-medium text-[#e0e0e0] truncate">{r.name}</span>
                  <span className="col-span-5 text-xs truncate" style={{ color: clsColor[r.classification ?? ''] ?? '#888' }}>
                    {r.classification ?? <span className="text-[#333]">—</span>}
                  </span>
                  <span className="col-span-2 text-[11px] font-mono text-[#c9a84c] truncate">{r.moci_id ?? '—'}</span>
                </div>
              ))}
            </div>
            {realtors.length > 0 && (
              <p className="text-[10px] text-[#444] text-right">
                {filtered.length} of {realtors.length} realtor{realtors.length !== 1 ? 's' : ''}
              </p>
            )}
          </>
        );
      })()}
    </div>
  );
}

// ── Zone Registry Tab ─────────────────────────────────────────────────────────

const MUNICIPALITIES = [
  'Al Daayen Municipality', 'Al Khor and Al Thakhira Municipality',
  'Al Rayyan Municipality', 'Al Shamal Municipality', 'Al Wakrah Municipality',
  'Doha Municipality', 'Umm Slal Municipality', 'Al Shahaniya Municipality',
];

function ZoneRegistryTab() {
  const { role } = useAuth();
  const isReadOnly = role !== 'superuser' && role !== 'administrator';
  const [readOnlyAlert, setReadOnlyAlert] = useState(false);

  const [zones,      setZones]      = useState<Zone[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [muniFilter, setMuniFilter] = useState('');
  const [adding,     setAdding]     = useState(false);
  const [newCode,  setNewCode]  = useState('');
  const [newName,  setNewName]  = useState('');
  const [newMuni,  setNewMuni]  = useState('');
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');
  const [toast,    setToast]    = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    authedFetch('/api/zones')
      .then(r => r.json())
      .then(d => setZones(d.zones ?? []))
      .catch(() => setErr('Failed to load zones.'))
      .finally(() => setLoading(false));
  }, []);

  async function saveZone() {
    if (isReadOnly) { setReadOnlyAlert(true); return; }
    const code = Number(newCode);
    if (!Number.isInteger(code) || code <= 0) { setErr('Zone number must be a positive integer.'); return; }
    if (!newName.trim()) { setErr('District / Zone name is required.'); return; }
    if (!newMuni) { setErr('Municipality is required.'); return; }
    if (zones.some(z => z.zone_code === code)) { setErr(`Zone code ${code} is already registered.`); return; }
    const cleanName = newName.trim().replace(/^zone\s*\d+\s*[-–—]\s*/i, '').trim();
    if (zones.some(z => z.district_name.toLowerCase() === cleanName.toLowerCase())) {
      setErr(`"${cleanName}" is already registered under a different zone code.`); return;
    }
    setSaving(true); setErr('');
    try {
      const res = await authedFetch('/api/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_code: code, district_name: cleanName, municipality: newMuni }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(typeof json.error === 'string' ? json.error : 'Failed to save');
      const z: Zone = json.zone;
      setZones(prev => [...prev, z].sort((a, b) => a.zone_code - b.zone_code));
      setAdding(false);
      setNewCode(''); setNewName(''); setNewMuni('');
      setToast({ msg: `Zone ${z.zone_code} — ${z.district_name} registered`, type: 'success' });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      {readOnlyAlert && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm mx-4 bg-[#181818] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-[#111] border-b border-[#2a2a2a] flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#e0e0e0]">Read-Only Access</p>
                <p className="text-[11px] text-[#555] mt-0.5">Code Registry — Zone / District</p>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-[#aaa] leading-relaxed">
                You have <span className="text-[#e0e0e0] font-semibold">view-only</span> access to the Zone Registry. Add, edit, and delete actions are restricted to Administrators.
              </p>
              <p className="text-[12px] text-[#666]">
                To create, modify, or remove a zone record, please contact your Administrator to process the request.
              </p>
              <button
                onClick={() => setReadOnlyAlert(false)}
                className="w-full py-2 text-sm font-bold text-[#0f0f0f] bg-[#c9a84c] hover:bg-[#dfc070] rounded-lg transition-colors"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-[#e0e0e0]">Zone / District Registry</h2>
          <p className="text-[11px] text-[#555] mt-0.5">Shared zone registry — used across Units Inventory, Axiom Pipeline, and Smart Code generation</p>
        </div>
        {isReadOnly ? (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-xs text-[#555] font-medium">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
            View Only
          </span>
        ) : (
          <button
            onClick={() => { setAdding(a => !a); setErr(''); setNewCode(''); setNewName(''); setNewMuni(''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#c9a84c] hover:bg-[#dfc070] text-[#0f0f0f] text-xs font-bold rounded-lg transition-colors"
          >
            <span className="text-base leading-none">+</span> Add Zone
          </button>
        )}
      </div>

      {adding && !isReadOnly && (
        <div className="rounded-xl border border-[#c9a84c]/20 bg-[#c9a84c]/5 p-5 space-y-4">
          <p className="text-[10px] font-bold text-[#c9a84c] uppercase tracking-widest">Register New Zone</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <FieldLabel>Zone Number *</FieldLabel>
              <Input type="number" value={newCode} onChange={setNewCode} placeholder="e.g. 61" />
            </div>
            <div>
              <FieldLabel>District / Zone Name *</FieldLabel>
              <Input value={newName} onChange={setNewName} placeholder="e.g. West Bay" />
            </div>
            <div>
              <FieldLabel>Municipality *</FieldLabel>
              <Select value={newMuni} onChange={setNewMuni}>
                <option value="">Select…</option>
                {MUNICIPALITIES.map(m => <option key={m}>{m}</option>)}
              </Select>
            </div>
          </div>
          {err && <p className="text-[11px] text-[#ef4444]">{err}</p>}
          <div className="flex gap-2">
            <button
              onClick={saveZone}
              disabled={saving || !newCode || !newName.trim() || !newMuni}
              className="flex-1 bg-[#c9a84c] hover:bg-[#dfc070] disabled:opacity-40 text-[#0f0f0f] text-sm font-bold py-2 rounded-lg transition-colors"
            >
              {saving ? 'Registering…' : 'Register Zone'}
            </button>
            <button
              onClick={() => { setAdding(false); setErr(''); }}
              className="px-4 text-[#888] hover:text-[#e0e0e0] text-sm border border-[#2a2a2a] rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search + municipality filter */}
      {(() => {
        const muniOptions = Array.from(new Set(zones.map(z => z.municipality).filter(Boolean))).sort();
        const filtered = zones.filter(z => {
          const matchText = !search || (
            `Zone ${z.zone_code} — ${z.district_name}`.toLowerCase().includes(search.toLowerCase()) ||
            String(z.zone_code).includes(search) ||
            (z.municipality ?? '').toLowerCase().includes(search.toLowerCase())
          );
          const matchMuni = !muniFilter || z.municipality === muniFilter;
          return matchText && matchMuni;
        });
        return (
          <>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" strokeLinecap="round"/>
                </svg>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by zone name or number…"
                  className="w-full bg-[#141414] border border-[#1e1e1e] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[#e0e0e0] placeholder-[#555] focus:outline-none focus:border-[#c9a84c]/40 transition-colors"
                />
              </div>
              <select
                value={muniFilter}
                onChange={e => setMuniFilter(e.target.value)}
                className="bg-[#141414] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-sm text-[#888] focus:outline-none focus:border-[#c9a84c]/40 transition-colors"
              >
                <option value="">All municipalities</option>
                {muniOptions.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="rounded-xl border border-[#1e1e1e] overflow-hidden">
              <div className="bg-[#0d0d0d] border-b border-[#1e1e1e] px-4 py-2.5 grid grid-cols-12 gap-2">
                <span className="col-span-2 text-[9px] font-bold text-[#555] uppercase tracking-wider">Zone #</span>
                <span className="col-span-5 text-[9px] font-bold text-[#555] uppercase tracking-wider">District / Zone</span>
                <span className="col-span-5 text-[9px] font-bold text-[#555] uppercase tracking-wider">Municipality</span>
              </div>
              {loading && <div className="px-4 py-8 text-center text-xs text-[#555]">Loading…</div>}
              {!loading && filtered.length === 0 && (
                <div className="px-4 py-8 text-center text-xs text-[#555]">
                  {search || muniFilter ? 'No zones match the current filter.' : 'No zones registered yet.'}
                </div>
              )}
              {filtered.map(z => (
                <div key={z.zone_code} className="px-4 py-2.5 grid grid-cols-12 gap-2 border-b border-[#1a1a1a] hover:bg-[#111] transition-colors">
                  <span className="col-span-2 text-sm font-mono font-semibold text-[#c9a84c]">{z.zone_code}</span>
                  <span className="col-span-5 text-sm font-medium text-[#e0e0e0] truncate">{z.district_name}</span>
                  <span className="col-span-5 text-xs text-[#666] truncate">{z.municipality ?? '—'}</span>
                </div>
              ))}
            </div>
            {zones.length > 0 && (
              <p className="text-[10px] text-[#444] text-right">
                {filtered.length} of {zones.length} zone{zones.length !== 1 ? 's' : ''}
              </p>
            )}
          </>
        );
      })()}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CodeRegistry({ onMenuClick }: { onMenuClick?: () => void }) {
  const [options,    setOptions]    = useState<Options | null>(null);
  const [activeTab,  setActiveTab]  = useState<'register' | 'smart-codes' | 'realtors' | 'zones'>('register');
  const [loadError,  setLoadError]  = useState(false);

  useEffect(() => {
    authedFetch('/api/code-registry/options')
      .then(r => r.json())
      .then(setOptions)
      .catch(() => setLoadError(true));
  }, []);

  function handleEntityAdded(e: Entity) {
    setOptions(prev => prev ? { ...prev, entities: [...prev.entities, e].sort((a, b) => a.company_name.localeCompare(b.company_name)) } : prev);
  }

  function handleConfigAdded(c: PropConfig) {
    setOptions(prev => prev ? { ...prev, configs: [...prev.configs, c] } : prev);
  }

  function handleAgentAdded(a: Agent) {
    setOptions(prev => prev ? { ...prev, agents: [...prev.agents, a].sort((x, y) => x.agent_code.localeCompare(y.agent_code)) } : prev);
  }

  function handleZoneAdded(z: Zone) {
    setOptions(prev => prev ? { ...prev, zones: [...prev.zones, z].sort((x, y) => x.zone_code - y.zone_code) } : prev);
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <p className="text-[#ef4444] text-sm">Failed to load Code Registry data. Please refresh.</p>
      </div>
    );
  }

  if (!options) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#c9a84c]/30 border-t-[#c9a84c] rounded-full animate-spin mx-auto" />
          <p className="text-[#555] text-sm">Loading Code Registry…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#e0e0e0]">
      <TopBar onMenuClick={onMenuClick} />
      {/* Section sub-header */}
      <div className="sticky top-[61px] z-20 bg-[#0f0f0f]/95 backdrop-blur border-b border-[#1a1a1a]">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-[#e0e0e0] tracking-wide">Code Registry</h1>
            <p className="text-[11px] text-[#555] mt-0.5">14-Digit Smart Serial Code Generator by Vanguard REOS</p>
          </div>
          <div className="flex items-center gap-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-1">
            {(['register', 'smart-codes', 'realtors', 'zones'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-[#c9a84c] text-[#0f0f0f]'
                    : 'text-[#888] hover:text-[#e0e0e0]'
                }`}
              >
                {tab === 'register' ? 'Register' : tab === 'smart-codes' ? 'Smart Codes' : tab === 'realtors' ? 'Realtors' : 'Zone / District'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-5 py-6">
        {activeTab === 'register'
          ? <RegisterTab options={options} onEntityAdded={handleEntityAdded} onConfigAdded={handleConfigAdded} onAgentAdded={handleAgentAdded} onZoneAdded={handleZoneAdded} />
          : activeTab === 'smart-codes'
          ? <SmartCodesTab options={options} />
          : activeTab === 'realtors'
          ? <RealtorRegistryTab />
          : <ZoneRegistryTab />
        }
      </div>
    </div>
  );
}
