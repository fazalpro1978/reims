'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { authedFetch } from '@/lib/authedFetch';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AliasRow {
  alias_code: string;
  unit_id: string;
  zone_code: number;
  zone_index: number;
  created_at: string;
  unit: { unit_code: string; property: string; unit_no: string; zone: string } | null;
  zone_tag: { zone_tag: string; zone_label: string } | null;
}

interface ResolvedUnit {
  id: string;
  unit_code: string;
  unit_no: string;
  property: string;
  zone: string;
  zone_code: number;
  type: string;
  config: string;
  status: string;
  rent: number;
  furnishing: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-QA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatusPill({ s }: { s: string }) {
  const color =
    s === 'Available'         ? 'bg-emerald-900/60 text-emerald-300' :
    s === 'Leased'            ? 'bg-sky-900/60 text-sky-300'         :
    s === 'Reserved'          ? 'bg-amber-900/60 text-amber-300'     :
    s === 'Under_Maintenance' ? 'bg-red-900/60 text-red-300'         :
    'bg-[#2a2a2a] text-[#888]';
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>{s.replace('_', ' ')}</span>;
}

// ── Resolution Panel ──────────────────────────────────────────────────────────

function ResolutionPanel() {
  const [input, setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<{ resolution: { aliasCode: string; zoneCode: number; zoneIndex: number; createdAt: string }; unit: ResolvedUnit } | null>(null);
  const [err, setErr]         = useState('');

  async function resolve() {
    const code = input.trim().toUpperCase();
    if (!code) return;
    setLoading(true); setErr(''); setResult(null);
    const res = await authedFetch(`/api/aliases/${encodeURIComponent(code)}`);
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setErr(json.error ?? 'Not found'); return; }
    setResult(json);
  }

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
      <h2 className="text-xs font-semibold text-[#888] uppercase tracking-wider">Alias Resolution</h2>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => { setInput(e.target.value); setErr(''); }}
          onKeyDown={e => e.key === 'Enter' && resolve()}
          placeholder="Enter alias code, e.g. WB61-023"
          className="flex-1 bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-[#e0e0e0] placeholder-[#444] focus:outline-none focus:border-[#818cf8] font-mono"
        />
        <button
          onClick={resolve}
          disabled={loading || !input.trim()}
          className="px-4 py-2 rounded-lg bg-[#818cf8] text-white text-sm font-semibold disabled:opacity-40 hover:bg-[#6366f1] transition-colors"
        >
          {loading ? 'Resolving…' : 'Resolve'}
        </button>
      </div>

      {err && <p className="text-xs text-[#ef4444]">{err}</p>}

      {result && (
        <div className="border border-[#2a2a2a] rounded-lg overflow-hidden">
          <div className="bg-[#1a1a1a] px-4 py-2.5 flex items-center justify-between">
            <span className="font-mono text-[#818cf8] font-bold text-sm">{result.resolution.aliasCode}</span>
            <StatusPill s={result.unit.status} />
          </div>
          <div className="divide-y divide-[#1e1e1e]">
            {([
              ['Property',   result.unit.property],
              ['Unit No',    result.unit.unit_no],
              ['Unit Code',  result.unit.unit_code],
              ['Zone',       `${result.unit.zone} (Zone ${result.unit.zone_code})`],
              ['Type',       `${result.unit.type} · ${result.unit.config}`],
              ['Furnishing', result.unit.furnishing],
              ['Rent',       `QAR ${Number(result.unit.rent).toLocaleString()} / mo`],
              ['Registered', fmtDate(result.resolution.createdAt)],
            ] as [string, string][]).map(([label, val]) => (
              <div key={label} className="flex px-4 py-2 gap-4">
                <span className="text-[11px] text-[#555] w-[96px] shrink-0">{label}</span>
                <span className="text-[11px] text-[#ccc]">{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Generate Alias Button ─────────────────────────────────────────────────────

function GeneratePanel({ onGenerated }: { onGenerated: () => void }) {
  const [unitId, setUnitId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState('');
  const [err,     setErr]     = useState('');

  async function generate() {
    const id = unitId.trim();
    if (!id) return;
    setLoading(true); setErr(''); setResult('');
    const res  = await authedFetch('/api/aliases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitId: id }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setErr(json.error ?? 'Failed'); return; }
    setResult(json.aliasCode);
    setUnitId('');
    onGenerated();
  }

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
      <h2 className="text-xs font-semibold text-[#888] uppercase tracking-wider">Generate Alias</h2>
      <p className="text-[11px] text-[#555]">Paste a unit UUID to generate its alias code. Already-aliased units return the existing code.</p>
      <div className="flex gap-2">
        <input
          value={unitId}
          onChange={e => { setUnitId(e.target.value); setErr(''); setResult(''); }}
          onKeyDown={e => e.key === 'Enter' && generate()}
          placeholder="Unit UUID"
          className="flex-1 bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-xs text-[#e0e0e0] placeholder-[#444] focus:outline-none focus:border-[#818cf8] font-mono"
        />
        <button
          onClick={generate}
          disabled={loading || !unitId.trim()}
          className="px-4 py-2 rounded-lg bg-[#1a2a1a] border border-[#2a4a2a] text-[#4ade80] text-sm font-semibold disabled:opacity-40 hover:bg-[#1f3a1f] transition-colors"
        >
          {loading ? 'Generating…' : 'Generate'}
        </button>
      </div>
      {err    && <p className="text-xs text-[#ef4444]">{err}</p>}
      {result && (
        <div className="flex items-center gap-3 bg-[#1a2a1a] border border-[#2a4a2a] rounded-lg px-4 py-2.5">
          <span className="text-xs text-[#555]">Alias Code</span>
          <span className="font-mono font-bold text-[#4ade80] text-sm">{result}</span>
        </div>
      )}
    </div>
  );
}

// ── Registry Table ────────────────────────────────────────────────────────────

function RegistryTable({ aliases, loading }: { aliases: AliasRow[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-[#444] text-sm">
        Loading registry…
      </div>
    );
  }

  if (!aliases.length) {
    return (
      <div className="flex items-center justify-center h-32 text-[#444] text-sm">
        No alias records found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-[#222]">
            {['Alias Code', 'Zone', 'Property', 'Unit Code', 'Unit No', 'Index', 'Registered'].map(h => (
              <th key={h} className="px-3 py-2.5 text-left text-[10px] text-[#555] uppercase tracking-wider font-semibold whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {aliases.map(row => (
            <tr key={row.alias_code} className="border-b border-[#1a1a1a] hover:bg-[#141414] transition-colors">
              <td className="px-3 py-2.5">
                <span className="font-mono font-bold text-[#818cf8]">{row.alias_code}</span>
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap">
                <span className="font-mono text-[#c9a84c] font-semibold">{row.zone_tag?.zone_tag ?? '—'}</span>
                <span className="text-[#555] ml-1.5 text-[10px] truncate max-w-[100px] block">{row.zone_tag?.zone_label ?? `Zone ${row.zone_code}`}</span>
              </td>
              <td className="px-3 py-2.5 max-w-[160px]">
                <span className="truncate block text-[#ccc]">{row.unit?.property ?? '—'}</span>
              </td>
              <td className="px-3 py-2.5">
                <span className="font-mono text-[#888]">{row.unit?.unit_code ?? '—'}</span>
              </td>
              <td className="px-3 py-2.5 text-[#888]">{row.unit?.unit_no ?? '—'}</td>
              <td className="px-3 py-2.5 text-center text-[#555] font-mono">{row.zone_index}</td>
              <td className="px-3 py-2.5 text-[#555] whitespace-nowrap">{fmtDate(row.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AliasRegistryPage() {
  const { role } = useAuth();
  const isAdmin = role === 'superuser' || role === 'administrator';

  const [aliases,  setAliases]  = useState<AliasRow[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchAliases = useCallback(async () => {
    setLoading(true);
    const qs = debouncedSearch ? `?q=${encodeURIComponent(debouncedSearch)}` : '';
    const res  = await authedFetch(`/api/aliases${qs}`);
    const json = await res.json();
    setLoading(false);
    if (res.ok) { setAliases(json.aliases); setTotal(json.total); }
  }, [debouncedSearch]);

  useEffect(() => { fetchAliases(); }, [fetchAliases]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-[#555] text-sm">Access restricted to Administrators.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0]">
      <div className="max-w-6xl mx-auto px-5 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Alias Registry</h1>
            <p className="text-[12px] text-[#555] mt-1">
              Public alias codes that hide building identity from prospects. Admins resolve codes to real units.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-[#555] uppercase tracking-wider">Total</span>
            <span className="font-mono text-[#818cf8] font-bold">{total}</span>
          </div>
        </div>

        {/* Two-column top panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ResolutionPanel />
          <GeneratePanel onGenerated={fetchAliases} />
        </div>

        {/* Search + Registry */}
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#2a2a2a] flex items-center gap-3">
            <span className="text-xs font-semibold text-[#888] uppercase tracking-wider shrink-0">Registry</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search alias code…"
              className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-xs text-[#e0e0e0] placeholder-[#444] focus:outline-none focus:border-[#818cf8] font-mono max-w-[280px]"
            />
          </div>
          <RegistryTable aliases={aliases} loading={loading} />
        </div>

      </div>
    </div>
  );
}
