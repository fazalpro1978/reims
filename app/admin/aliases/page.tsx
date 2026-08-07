'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { authedFetch } from '../../../lib/authedFetch';
import TopBar from '../../../components/TopBar';
import { useNav } from '../../../components/AppShell';

const PAGE_SIZE = 25;

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
  id: string; unit_code: string; unit_no: string; property: string;
  zone: string; zone_code: number; type: string; config: string;
  status: string; rent: number; furnishing: string;
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

function exportToCsv(rows: AliasRow[]) {
  const header = ['Alias Code', 'Zone Tag', 'Zone Label', 'Zone Code', 'Property', 'Unit Code', 'Unit No', 'Registered'];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    header.join(','),
    ...rows.map(r => [
      r.alias_code,
      r.zone_tag?.zone_tag ?? '',
      escape(r.zone_tag?.zone_label ?? `Zone ${r.zone_code}`),
      r.zone_code,
      escape(r.unit?.property ?? ''),
      r.unit?.unit_code ?? '',
      r.unit?.unit_no ?? '',
      new Date(r.created_at).toISOString().split('T')[0],
    ].join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `alias-registry-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Resolution Panel ──────────────────────────────────────────────────────────

function ResolutionPanel() {
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<{ resolution: { aliasCode: string; zoneCode: number; zoneIndex: number; createdAt: string }; unit: ResolvedUnit } | null>(null);
  const [err,     setErr]     = useState('');

  async function resolve() {
    const code = input.trim().toUpperCase();
    if (!code) return;
    setLoading(true); setErr(''); setResult(null);
    const res  = await authedFetch(`/api/aliases/${encodeURIComponent(code)}`);
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
        <button onClick={resolve} disabled={loading || !input.trim()}
          className="px-4 py-2 rounded-lg bg-[#818cf8] text-white text-sm font-semibold disabled:opacity-40 hover:bg-[#6366f1] transition-colors">
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

// ── Generate Panel ────────────────────────────────────────────────────────────

function GeneratePanel({ onGenerated }: { onGenerated: () => void }) {
  const [unitId,  setUnitId]  = useState('');
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
      <p className="text-[11px] text-[#555]">Enter a unit code (e.g. APFG00-B00-F01-A001) or UUID. Already-aliased units return the existing code.</p>
      <div className="flex gap-2">
        <input
          value={unitId}
          onChange={e => { setUnitId(e.target.value); setErr(''); setResult(''); }}
          onKeyDown={e => e.key === 'Enter' && generate()}
          placeholder="Unit code or UUID"
          className="flex-1 bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-xs text-[#e0e0e0] placeholder-[#444] focus:outline-none focus:border-[#818cf8] font-mono"
        />
        <button onClick={generate} disabled={loading || !unitId.trim()}
          className="px-4 py-2 rounded-lg bg-[#1a2a1a] border border-[#2a4a2a] text-[#4ade80] text-sm font-semibold disabled:opacity-40 hover:bg-[#1f3a1f] transition-colors">
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
  if (loading) return <div className="flex items-center justify-center h-32 text-[#444] text-sm">Loading registry…</div>;
  if (!aliases.length) return <div className="flex items-center justify-center h-32 text-[#444] text-sm">No alias records found.</div>;

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
              <td className="px-3 py-2.5"><span className="font-mono font-bold text-[#818cf8]">{row.alias_code}</span></td>
              <td className="px-3 py-2.5 whitespace-nowrap">
                <span className="font-mono text-[#c9a84c] font-semibold">{row.zone_tag?.zone_tag ?? '—'}</span>
                <span className="text-[#555] ml-1.5 text-[10px] truncate max-w-[100px] block">{row.zone_tag?.zone_label ?? `Zone ${row.zone_code}`}</span>
              </td>
              <td className="px-3 py-2.5 max-w-[160px]"><span className="truncate block text-[#ccc]">{row.unit?.property ?? '—'}</span></td>
              <td className="px-3 py-2.5"><span className="font-mono text-[#888]">{row.unit?.unit_code ?? '—'}</span></td>
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

// ── Inner page ────────────────────────────────────────────────────────────────

function AliasRegistryInner() {
  const { can, loading } = useAuth();
  const router           = useRouter();
  const { openNav }      = useNav();

  const [aliases,         setAliases]         = useState<AliasRow[]>([]);
  const [total,           setTotal]           = useState(0);
  const [registryLoading, setRegistryLoading] = useState(true);
  const [search,          setSearch]          = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page,            setPage]            = useState(1);
  const [exporting,       setExporting]       = useState(false);
  const [rebuilding,      setRebuilding]      = useState(false);
  const [rebuildResult,   setRebuildResult]   = useState<{ rebuilt: number; message?: string } | null>(null);
  const [confirmRebuild,  setConfirmRebuild]  = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (!loading && !can('admin.aliases')) router.replace('/');
  }, [loading, can, router]);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchAliases = useCallback(async (p = page) => {
    setRegistryLoading(true);
    const offset = (p - 1) * PAGE_SIZE;
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (debouncedSearch) params.set('q', debouncedSearch);
    const res  = await authedFetch(`/api/aliases?${params}`);
    const json = await res.json();
    setRegistryLoading(false);
    if (res.ok) { setAliases(json.aliases); setTotal(json.total); }
  }, [debouncedSearch, page]);

  useEffect(() => { fetchAliases(page); }, [fetchAliases, page]);

  async function handleExport() {
    setExporting(true);
    const params = new URLSearchParams({ limit: '5000', offset: '0' });
    if (debouncedSearch) params.set('q', debouncedSearch);
    const res  = await authedFetch(`/api/aliases?${params}`);
    const json = await res.json();
    setExporting(false);
    if (res.ok && json.aliases?.length) exportToCsv(json.aliases);
  }

  async function handleRebuild() {
    setRebuilding(true); setConfirmRebuild(false); setRebuildResult(null);
    const res  = await authedFetch('/api/aliases/rebuild', { method: 'POST' });
    const json = await res.json();
    setRebuilding(false);
    setRebuildResult(json);
    if (res.ok) fetchAliases(page);
  }

  function goToPage(p: number) {
    const clamped = Math.max(1, Math.min(p, totalPages));
    setPage(clamped);
  }

  if (loading || !can('admin.aliases')) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <TopBar onMenuClick={openNav} />
      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-[#e0e0e0] tracking-tight">Alias Registry</h1>
            <p className="text-sm text-[#555] mt-1">Public alias codes that hide building identity from prospects. Admins resolve codes to real units.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#555] uppercase tracking-wider">Total</span>
              <span className="font-mono text-[#818cf8] font-bold">{total}</span>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting || total === 0}
              className="px-3 py-1.5 text-xs border border-[#2a2a2a] text-[#888] rounded-lg hover:border-[#3a3a3a] hover:bg-[#141414] transition-colors disabled:opacity-40"
            >
              {exporting ? 'Exporting…' : '↓ Export CSV'}
            </button>
            {!confirmRebuild ? (
              <button
                onClick={() => setConfirmRebuild(true)}
                className="px-3 py-1.5 text-xs border border-[#c9a84c]/30 text-[#c9a84c] rounded-lg hover:bg-[#c9a84c]/10 transition-colors"
              >
                ↺ Rebuild Registry
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-[#c9a84c]/10 border border-[#c9a84c]/30 rounded-lg px-3 py-1.5">
                <span className="text-[11px] text-[#c9a84c]">Re-sync from units?</span>
                <button onClick={handleRebuild} disabled={rebuilding}
                  className="text-[11px] font-bold text-[#c9a84c] hover:text-white transition-colors disabled:opacity-50">
                  {rebuilding ? 'Rebuilding…' : 'Yes'}
                </button>
                <button onClick={() => setConfirmRebuild(false)} className="text-[11px] text-[#555] hover:text-[#888] transition-colors">Cancel</button>
              </div>
            )}
          </div>
        </div>

        {/* Rebuild result */}
        {rebuildResult && (
          <div className={`rounded-lg border px-4 py-3 text-xs ${rebuildResult.rebuilt > 0 ? 'border-[#c9a84c]/30 bg-[#c9a84c]/5 text-[#c9a84c]' : 'border-[#2a2a2a] text-[#888]'}`}>
            {rebuildResult.rebuilt > 0
              ? `✓ Rebuilt ${rebuildResult.rebuilt} missing alias record${rebuildResult.rebuilt !== 1 ? 's' : ''} from units table.`
              : rebuildResult.message ?? 'Registry is already in sync.'}
          </div>
        )}

        {/* Two-column top panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ResolutionPanel />
          <GeneratePanel onGenerated={() => fetchAliases(1)} />
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

          <RegistryTable aliases={aliases} loading={registryLoading} />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-[#1e1e1e] flex items-center justify-between">
              <span className="text-[11px] text-[#555]">
                Page {page} of {totalPages} · {total} total
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => goToPage(1)}
                  disabled={page === 1}
                  className="px-2 py-1 text-[11px] text-[#555] hover:text-[#888] disabled:opacity-30 transition-colors"
                >«</button>
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1}
                  className="px-2.5 py-1 text-xs text-[#888] border border-[#2a2a2a] rounded hover:bg-[#1e1e1e] disabled:opacity-30 transition-colors"
                >Prev</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const p = start + i;
                  return p <= totalPages ? (
                    <button key={p} onClick={() => goToPage(p)}
                      className={`px-2.5 py-1 text-xs rounded border transition-colors ${p === page ? 'bg-[#818cf8]/20 border-[#818cf8]/40 text-[#818cf8] font-bold' : 'border-[#2a2a2a] text-[#555] hover:bg-[#1e1e1e] hover:text-[#888]'}`}>
                      {p}
                    </button>
                  ) : null;
                })}
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page === totalPages}
                  className="px-2.5 py-1 text-xs text-[#888] border border-[#2a2a2a] rounded hover:bg-[#1e1e1e] disabled:opacity-30 transition-colors"
                >Next</button>
                <button
                  onClick={() => goToPage(totalPages)}
                  disabled={page === totalPages}
                  className="px-2 py-1 text-[11px] text-[#555] hover:text-[#888] disabled:opacity-30 transition-colors"
                >»</button>
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}

export default function AliasRegistryPage() {
  return <AliasRegistryInner />;
}
