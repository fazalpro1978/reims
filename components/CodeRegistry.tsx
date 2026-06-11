'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { PROPERTY_MATRIX, CONFIGURATION_REGEX } from '../lib/propertySchema';

// ── Types ─────────────────────────────────────────────────────────────────────

type PropConfig = {
  type_code: string; core_type: string; sub_type: string;
  configuration: string; integration_scenario: string; features: string;
};
type Entity = {
  entity_code: string; company_name: string; classification: string; is_manual: boolean;
};
type Agent = { agent_code: string; full_name: string };
type Zone  = { zone_code: number; district_name: string; municipality: string };

type RegistryRecord = {
  id: string; smart_code: string;
  type_code: string; core_type: string; sub_type: string; configuration: string;
  entity_code: string; company_name: string; classification: string;
  agent_code: string; agent_name: string;
  zone_code: number; district_name: string; municipality: string;
  sequence_number: number;
  building_name: string | null; floor_ref: string | null;
  unit_ref: string | null; notes: string | null;
  created_at: string;
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
  typeCode: string, entityCode: string, agentCode: string, zoneCode: number | null,
) {
  return [
    seg(typeCode   || null, '··',    '#a855f7'),
    seg(entityCode || null, '···',   '#3b82f6'),
    seg(agentCode  || null, '··',    '#22c55e'),
    seg(zoneCode != null ? String(zoneCode).padStart(2, '0') : null, '··', '#f97316'),
    seg(null, '·····', '#c9a84c'),
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
  value, onChange, placeholder, mono,
}: { value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return (
    <input
      type="text"
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

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] bg-[#0a1a0a] border border-[#22c55e]/40 text-[#22c55e] text-sm px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 pointer-events-none select-none">
      <span className="text-base leading-none">✓</span>
      {message}
    </div>
  );
}

// ── Code Preview ─────────────────────────────────────────────────────────────

function CodePreview({
  typeCode, entityCode, agentCode, zoneCode, generatedCode,
}: {
  typeCode: string; entityCode: string; agentCode: string;
  zoneCode: number | null; generatedCode?: string;
}) {
  const segments = buildPreviewSegments(typeCode, entityCode, agentCode, zoneCode);
  const labels   = ['TYPE', 'ENTITY', 'AGENT', 'ZONE', 'SEQ'];

  const assembled = generatedCode ?? [
    typeCode   || '··',
    entityCode || '···',
    agentCode  || '··',
    zoneCode != null ? String(zoneCode).padStart(2, '0') : '··',
    '·····',
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
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#1e1e1e]">
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
  options, onEntityAdded, onConfigAdded,
}: {
  options: Options;
  onEntityAdded: (e: Entity) => void;
  onConfigAdded: (c: PropConfig) => void;
}) {
  const { configs, entities, agents, zones } = options;

  const [coreType,       setCoreType]       = useState('');
  const [subType,        setSubType]        = useState('');
  const [typeCode,       setTypeCode]       = useState('');
  const [entityCode,     setEntityCode]     = useState('');
  const [agentCode,      setAgentCode]      = useState('');
  const [municipality,   setMunicipality]   = useState('');
  const [zoneCode,       setZoneCode]       = useState<number | null>(null);
  const [buildingName,   setBuildingName]   = useState('');
  const [floorRef,       setFloorRef]       = useState('');
  const [unitRef,        setUnitRef]        = useState('');
  const [notes,          setNotes]          = useState('');

  const [submitting,    setSubmitting]    = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [error,         setError]         = useState<string | null>(null);

  // Inline-add state
  const [extraCoreTypes, setExtraCoreTypes] = useState<string[]>([]);
  const [extraSubTypes,  setExtraSubTypes]  = useState<Record<string, string[]>>({});
  const [addingCoreType, setAddingCoreType] = useState(false);
  const [addingSubType,  setAddingSubType]  = useState(false);
  const [addingConfig,   setAddingConfig]   = useState(false);
  const [toast,          setToast]          = useState<string | null>(null);

  const coreTypes  = Array.from(new Set([...configs.map(c => c.core_type), ...extraCoreTypes]));
  const subTypes   = Array.from(new Set([
    ...configs.filter(c => c.core_type === coreType).map(c => c.sub_type),
    ...(extraSubTypes[coreType] ?? []),
  ]));
  const configOpts     = configs.filter(c => c.core_type === coreType && c.sub_type === subType);
  const municipalities = Array.from(new Set(zones.map(z => z.municipality))).sort();
  const filteredZones  = zones.filter(z => z.municipality === municipality);

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
    setCoreType(''); setSubType(''); setTypeCode('');
    setEntityCode(''); setAgentCode('');
    setMunicipality(''); setZoneCode(null);
    setBuildingName(''); setFloorRef(''); setUnitRef(''); setNotes('');
    setGeneratedCode(null); setError(null);
  }

  async function handleSubmit() {
    if (!typeCode || !entityCode || !agentCode || !zoneCode) {
      setError('Please complete all required fields: Type, Entity, Agent, and Zone.');
      return;
    }
    setSubmitting(true); setError(null);
    try {
      const res  = await fetch('/api/code-registry/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typeCode, entityCode, agentCode, zoneCode, buildingName, floorRef, unitRef, notes }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setError('Registration failed. Please try again.'); return; }
      setGeneratedCode(json.smartCode);
    } catch { setError('Network error. Please try again.'); }
    finally   { setSubmitting(false); }
  }

  const allFilled = !!(typeCode && entityCode && agentCode && zoneCode);

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

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

      {/* Property Configuration */}
      <SectionCard title="Property Configuration">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  setExtraCoreTypes(prev => prev.includes(v) ? prev : [...prev, v]);
                  setCoreType(v); setSubType(''); setTypeCode('');
                  setAddingCoreType(false);
                  setToast(`Core Type "${v}" added`);
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
                  setExtraSubTypes(prev => ({
                    ...prev,
                    [coreType]: (prev[coreType] ?? []).includes(v)
                      ? (prev[coreType] ?? [])
                      : [...(prev[coreType] ?? []), v],
                  }));
                  setSubType(v); setTypeCode('');
                  setAddingSubType(false);
                  setToast(`Sub-Type "${v}" added`);
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
                  const res = await fetch('/api/code-registry/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ coreType, subType, configuration: v }),
                  });
                  const json = await res.json();
                  if (!res.ok || json.error) throw new Error('Failed to save configuration');
                  const newCfg: PropConfig = {
                    type_code:            json.type_code,
                    core_type:            json.core_type,
                    sub_type:             json.sub_type,
                    configuration:        json.configuration,
                    integration_scenario: json.integration_scenario ?? '',
                    features:             json.features ?? '',
                  };
                  onConfigAdded(newCfg);
                  setTypeCode(json.type_code);
                  setAddingConfig(false);
                  setToast(`Configuration "${v}" [${json.type_code}] saved`);
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
      <SectionCard title="Developer / Company *">
        <EntitySearch
          entities={entities}
          value={entityCode}
          onSelect={setEntityCode}
          onNewEntity={e => { onEntityAdded(e); setEntityCode(e.entity_code); }}
        />
      </SectionCard>

      {/* Agent */}
      <SectionCard title="Agent *">
        <Select value={agentCode} onChange={setAgentCode}>
          <option value="">Select agent…</option>
          {agents.map(a => (
            <option key={a.agent_code} value={a.agent_code}>
              {a.agent_code} — {a.full_name}
            </option>
          ))}
        </Select>
      </SectionCard>

      {/* Zone */}
      <SectionCard title="Zone *">
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
      </SectionCard>

      {/* Property Reference */}
      <SectionCard title="Property Reference (Optional)">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <FieldLabel>Building Name</FieldLabel>
            <Input value={buildingName} onChange={setBuildingName} placeholder="e.g. Tornado Tower" />
          </div>
          <div>
            <FieldLabel>Floor</FieldLabel>
            <Input value={floorRef} onChange={setFloorRef} placeholder="e.g. 14" />
          </div>
          <div>
            <FieldLabel>Unit Reference</FieldLabel>
            <Input value={unitRef} onChange={setUnitRef} placeholder="e.g. TT-14-123" />
          </div>
        </div>
        <div>
          <FieldLabel>Notes</FieldLabel>
          <Input value={notes} onChange={setNotes} placeholder="Optional remarks…" />
        </div>
      </SectionCard>

      {/* Code Preview */}
      <CodePreview
        typeCode={typeCode} entityCode={entityCode}
        agentCode={agentCode} zoneCode={zoneCode}
        generatedCode={generatedCode ?? undefined}
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

// ── Search Tab ────────────────────────────────────────────────────────────────

function SearchTab({ options }: { options: Options }) {
  const { configs, entities, agents, zones } = options;

  const [typeCode,     setTypeFilter]   = useState('');
  const [entityCode,   setEntityFilter] = useState('');
  const [agentCode,    setAgentFilter]  = useState('');
  const [municipality, setMuniFilter]   = useState('');
  const [zoneCode,     setZoneFilter]   = useState('');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [q,            setQ]            = useState('');
  const [page,         setPage]         = useState(1);

  const [results,  setResults]  = useState<RegistryRecord[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);

  const filteredZones  = zones.filter(z => !municipality || z.municipality === municipality);
  const municipalities = Array.from(new Set(zones.map(z => z.municipality))).sort();
  const uniqueSubTypes = Array.from(new Set(configs.map(c => c.sub_type)));

  const search = useCallback(async (p = 1) => {
    setLoading(true); setSearched(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (typeCode)    params.set('typeCode',    typeCode);
      if (entityCode)  params.set('entityCode',  entityCode);
      if (agentCode)   params.set('agentCode',   agentCode);
      if (zoneCode)    params.set('zoneCode',    zoneCode);
      if (municipality) params.set('municipality', municipality);
      if (dateFrom)    params.set('dateFrom',    dateFrom);
      if (dateTo)      params.set('dateTo',      dateTo);
      if (q)           params.set('q',           q);
      const res  = await fetch(`/api/code-registry/search?${params}`);
      const json = await res.json();
      setResults(json.data ?? []); setTotal(json.total ?? 0); setPage(p);
    } finally { setLoading(false); }
  }, [typeCode, entityCode, agentCode, zoneCode, municipality, dateFrom, dateTo, q]);

  function exportExcel() {
    if (!results.length) return;
    const rows = results.map(r => ({
      'Smart Code':     r.smart_code,
      'Core Type':      r.core_type,
      'Sub-Type':       r.sub_type,
      'Configuration':  r.configuration,
      'Entity Code':    r.entity_code,
      'Company':        r.company_name,
      'Classification': r.classification,
      'Agent Code':     r.agent_code,
      'Agent Name':     r.agent_name,
      'Zone Code':      r.zone_code,
      'District':       r.district_name,
      'Municipality':   r.municipality,
      'Sequence No':    r.sequence_number,
      'Building':       r.building_name ?? '',
      'Floor':          r.floor_ref ?? '',
      'Unit Ref':       r.unit_ref ?? '',
      'Notes':          r.notes ?? '',
      'Registered':     new Date(r.created_at).toLocaleDateString('en-GB'),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Code Registry');
    XLSX.writeFile(wb, `Code_Registry_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  const pageSize = 25;
  const totalPages = Math.ceil(total / pageSize);

  const sel = "bg-[#1a1a1a] border border-[#2a2a2a] text-[#e0e0e0] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c]/60 w-full";

  return (
    <div className="space-y-4">
      {/* Filter Panel */}
      <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-5 space-y-4">
        <p className="text-[10px] font-bold text-[#555] uppercase tracking-[0.18em]">Filters</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <FieldLabel>Sub-Type</FieldLabel>
            <select value={typeCode} onChange={e => setTypeFilter(e.target.value)} className={sel}>
              <option value="">All types</option>
              {uniqueSubTypes.map(s => {
                const matched = configs.filter(c => c.sub_type === s);
                return matched.map(c => (
                  <option key={c.type_code} value={c.type_code}>
                    [{c.type_code}] {c.configuration} — {s}
                  </option>
                ));
              })}
            </select>
          </div>
          <div>
            <FieldLabel>Company</FieldLabel>
            <select value={entityCode} onChange={e => setEntityFilter(e.target.value)} className={sel}>
              <option value="">All companies</option>
              {entities.map(e => (
                <option key={e.entity_code} value={e.entity_code}>
                  [{e.entity_code}] {e.company_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Agent</FieldLabel>
            <select value={agentCode} onChange={e => setAgentFilter(e.target.value)} className={sel}>
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
            <select value={municipality} onChange={e => { setMuniFilter(e.target.value); setZoneFilter(''); }} className={sel}>
              <option value="">All municipalities</option>
              {municipalities.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Zone</FieldLabel>
            <select value={zoneCode} onChange={e => setZoneFilter(e.target.value)} className={sel}>
              <option value="">All zones</option>
              {filteredZones.map(z => (
                <option key={z.zone_code} value={z.zone_code}>
                  Zone {String(z.zone_code).padStart(2,'0')} — {z.district_name}
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
          <div>
            <FieldLabel>Search</FieldLabel>
            <input
              type="text" value={q} onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search(1)}
              placeholder="Code, company, district…"
              className={sel + ' placeholder-[#555]'}
            />
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
            onClick={() => {
              setTypeFilter(''); setEntityFilter(''); setAgentFilter('');
              setMuniFilter(''); setZoneFilter(''); setDateFrom(''); setDateTo(''); setQ('');
              setResults([]); setTotal(0); setSearched(false);
            }}
            className="text-[#888] hover:text-[#e0e0e0] text-sm border border-[#2a2a2a] px-4 py-2.5 rounded-lg transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Results */}
      {searched && (
        <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e1e1e]">
            <p className="text-sm text-[#888]">
              {loading ? 'Loading…' : `${total.toLocaleString()} record${total !== 1 ? 's' : ''} found`}
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
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1e1e1e]">
                      {['Smart Code','Type','Company','Agent','Zone / District','Building','Registered'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-[#555] uppercase tracking-widest whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(r => (
                      <tr key={r.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors group">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-[#e0e0e0] tracking-wider">{r.smart_code}</span>
                            <button
                              onClick={() => copyToClipboard(r.smart_code)}
                              className="opacity-0 group-hover:opacity-100 text-[10px] text-[#c9a84c] border border-[#c9a84c]/30 rounded px-1.5 py-0.5 transition-all"
                            >
                              Copy
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs font-mono text-[#a855f7] bg-[#a855f7]/10 px-1.5 py-0.5 rounded">{r.type_code}</span>
                          <span className="ml-2 text-[#888] text-xs">{r.configuration}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-[#e0e0e0] text-xs">{r.company_name}</p>
                          <p className="text-[#555] text-[10px]">{r.entity_code}</p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs font-mono text-[#22c55e]">{r.agent_code}</span>
                          <span className="ml-1 text-[#888] text-xs">{r.agent_name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-[#e0e0e0] text-xs">{r.district_name}</p>
                          <p className="text-[#555] text-[10px]">Zone {String(r.zone_code).padStart(2,'0')} · {r.municipality}</p>
                        </td>
                        <td className="px-4 py-3 text-[#888] text-xs">
                          {[r.building_name, r.floor_ref && `Fl.${r.floor_ref}`, r.unit_ref].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="px-4 py-3 text-[#555] text-xs whitespace-nowrap">
                          {new Date(r.created_at).toLocaleDateString('en-GB')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-[#1e1e1e]">
                  <button
                    disabled={page <= 1}
                    onClick={() => search(page - 1)}
                    className="text-sm text-[#888] hover:text-[#e0e0e0] disabled:opacity-30 transition-colors"
                  >← Previous</button>
                  <span className="text-xs text-[#555]">Page {page} of {totalPages}</span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => search(page + 1)}
                    className="text-sm text-[#888] hover:text-[#e0e0e0] disabled:opacity-30 transition-colors"
                  >Next →</button>
                </div>
              )}
            </>
          ) : (
            !loading && (
              <div className="px-5 py-12 text-center text-[#555] text-sm">
                No codes registered yet. Use the Register tab to generate your first Smart Code.
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CodeRegistry() {
  const [options,    setOptions]    = useState<Options | null>(null);
  const [activeTab,  setActiveTab]  = useState<'register' | 'search'>('register');
  const [loadError,  setLoadError]  = useState(false);

  useEffect(() => {
    fetch('/api/code-registry/options')
      .then(r => r.json())
      .then(setOptions)
      .catch(() => setLoadError(true));
  }, []);

  function handleEntityAdded(e: Entity) {
    if (!options) return;
    setOptions(prev => prev ? { ...prev, entities: [...prev.entities, e].sort((a, b) => a.company_name.localeCompare(b.company_name)) } : prev);
  }

  function handleConfigAdded(c: PropConfig) {
    if (!options) return;
    setOptions(prev => prev ? { ...prev, configs: [...prev.configs, c] } : prev);
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
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#0f0f0f]/95 backdrop-blur border-b border-[#1a1a1a]">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-[#e0e0e0] tracking-wide">Code Registry</h1>
            <p className="text-[11px] text-[#555] mt-0.5">14-Digit Smart Serial Code Generator · Qatar Real Estate</p>
          </div>
          <div className="flex items-center gap-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-1">
            {(['register', 'search'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${
                  activeTab === tab
                    ? 'bg-[#c9a84c] text-[#0f0f0f]'
                    : 'text-[#888] hover:text-[#e0e0e0]'
                }`}
              >
                {tab === 'register' ? 'Register' : 'Search Registry'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-5 py-6">
        {activeTab === 'register'
          ? <RegisterTab options={options} onEntityAdded={handleEntityAdded} onConfigAdded={handleConfigAdded} />
          : <SearchTab options={options} />
        }
      </div>
    </div>
  );
}
