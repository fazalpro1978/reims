'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import TopBar from '../../../components/TopBar';
import { useNav } from '../../../components/AppShell';

const PAGE_SIZE = 25;

// ── Types ─────────────────────────────────────────────────────────────────────

interface SmartCodeRow {
  id: string;
  unit_code: string;
  unit_no: string;
  property: string;
  zone: string;
  zone_code: number;
  type: string;
  config: string;
  furnishing: string;
  status: string;
  rent: number;
  smart_code: string | null;
  master_code: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusPill({ s }: { s: string }) {
  const color =
    s === 'Available'         ? 'bg-emerald-900/60 text-emerald-300' :
    s === 'Leased'            ? 'bg-sky-900/60 text-sky-300'         :
    s === 'Reserved'          ? 'bg-amber-900/60 text-amber-300'     :
    s === 'Under_Maintenance' ? 'bg-red-900/60 text-red-300'         :
    'bg-[#2a2a2a] text-[#888]';
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>{s.replace('_', ' ')}</span>;
}

function DualCodeBadge({ masterCode, smartCode }: { masterCode: string | null; smartCode: string | null }) {
  if (!masterCode && !smartCode) return <span className="text-[10px] text-[#444]">—</span>;
  return (
    <div className="flex flex-col gap-0.5">
      {masterCode && (
        <span className="font-mono text-[10px] font-bold text-[#5b9bd5] tracking-wider leading-none">{masterCode}</span>
      )}
      {smartCode && (
        <span className="inline-block font-mono text-[10px] font-semibold text-[#1a1a1a] bg-[#4ade80] px-1.5 py-0.5 rounded leading-none w-fit">{smartCode}</span>
      )}
    </div>
  );
}

function exportToCsv(rows: SmartCodeRow[]) {
  const header = ['Smart Code', 'Master Code', 'Property', 'Unit Code', 'Unit No', 'Zone', 'Type', 'Config', 'Status'];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    header.join(','),
    ...rows.map(r => [
      r.smart_code ?? '',
      r.master_code ?? '',
      escape(r.property),
      r.unit_code,
      r.unit_no,
      escape(r.zone),
      r.type,
      r.config,
      r.status,
    ].join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `smart-code-registry-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Resolve Panel ─────────────────────────────────────────────────────────────

function ResolvePanel() {
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<SmartCodeRow | null>(null);
  const [err,     setErr]     = useState('');

  async function resolve() {
    const code = input.trim().toUpperCase();
    if (!code) return;
    setLoading(true); setErr(''); setResult(null);
    const { data, error } = await supabase
      .from('units')
      .select('id, unit_code, unit_no, property, zone, zone_code, type, config, furnishing, status, rent, smart_code, master_code')
      .eq('smart_code', code)
      .maybeSingle();
    setLoading(false);
    if (error || !data) { setErr('No unit found for that Smart Code.'); return; }
    setResult(data as SmartCodeRow);
  }

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
      <h2 className="text-xs font-semibold text-[#888] uppercase tracking-wider">Smart Code Lookup</h2>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => { setInput(e.target.value); setErr(''); }}
          onKeyDown={e => e.key === 'Enter' && resolve()}
          placeholder="Enter Smart Code, e.g. RAARAA66-311"
          className="flex-1 bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-[#e0e0e0] placeholder-[#444] focus:outline-none focus:border-[#4ade80] font-mono"
        />
        <button onClick={resolve} disabled={loading || !input.trim()}
          className="px-4 py-2 rounded-lg bg-[#1a2a1a] border border-[#2a4a2a] text-[#4ade80] text-sm font-semibold disabled:opacity-40 hover:bg-[#1f3a1f] transition-colors">
          {loading ? 'Looking up…' : 'Resolve'}
        </button>
      </div>
      {err && <p className="text-xs text-[#ef4444]">{err}</p>}
      {result && (
        <div className="border border-[#2a2a2a] rounded-lg overflow-hidden">
          <div className="bg-[#1a1a1a] px-4 py-2.5 flex items-center justify-between gap-4">
            <DualCodeBadge masterCode={result.master_code} smartCode={result.smart_code} />
            <StatusPill s={result.status} />
          </div>
          <div className="divide-y divide-[#1e1e1e]">
            {([
              ['Property',  result.property],
              ['Unit No',   result.unit_no],
              ['Unit Code', result.unit_code],
              ['Zone',      `${result.zone} (Zone ${result.zone_code})`],
              ['Type',      `${result.type} · ${result.config}`],
              ['Furnishing', result.furnishing],
              ['Rent',      `QAR ${Number(result.rent).toLocaleString()} / mo`],
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

// ── Registry Table ─────────────────────────────────────────────────────────────

function RegistryTable({ rows, loading }: { rows: SmartCodeRow[]; loading: boolean }) {
  if (loading) return <div className="flex items-center justify-center h-32 text-[#444] text-sm">Loading registry…</div>;
  if (!rows.length) return <div className="flex items-center justify-center h-32 text-[#444] text-sm">No Smart Code records found.</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-[#222]">
            {['Smart / Master Code', 'Property', 'Unit Code', 'Unit No', 'Zone', 'Type / Config', 'Status'].map(h => (
              <th key={h} className="px-3 py-2.5 text-left text-[10px] text-[#555] uppercase tracking-wider font-semibold whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="border-b border-[#1a1a1a] hover:bg-[#141414] transition-colors">
              <td className="px-3 py-2.5">
                <DualCodeBadge masterCode={row.master_code} smartCode={row.smart_code} />
              </td>
              <td className="px-3 py-2.5 max-w-[160px]"><span className="truncate block text-[#ccc]">{row.property}</span></td>
              <td className="px-3 py-2.5"><span className="font-mono text-[#888]">{row.unit_code}</span></td>
              <td className="px-3 py-2.5 text-[#888]">{row.unit_no}</td>
              <td className="px-3 py-2.5 whitespace-nowrap">
                <span className="font-mono text-[#c9a84c] font-semibold text-[10px]">Z-{row.zone_code}</span>
                <span className="text-[#555] ml-1.5 text-[10px] truncate max-w-[100px] block">{row.zone}</span>
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap text-[#888]">{row.type} · {row.config}</td>
              <td className="px-3 py-2.5"><StatusPill s={row.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Inner page ─────────────────────────────────────────────────────────────────

function SmartCodeRegistryInner() {
  const { can, loading } = useAuth();
  const router           = useRouter();
  const { openNav }      = useNav();

  const [rows,            setRows]            = useState<SmartCodeRow[]>([]);
  const [total,           setTotal]           = useState(0);
  const [registryLoading, setRegistryLoading] = useState(true);
  const [search,          setSearch]          = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page,            setPage]            = useState(1);
  const [exporting,       setExporting]       = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (!loading && !can('admin.aliases')) router.replace('/');
  }, [loading, can, router]);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchRows = useCallback(async (p = page) => {
    setRegistryLoading(true);
    const offset = (p - 1) * PAGE_SIZE;
    let query = supabase
      .from('units')
      .select('id, unit_code, unit_no, property, zone, zone_code, type, config, furnishing, status, rent, smart_code, master_code', { count: 'exact' })
      .not('smart_code', 'is', null)
      .order('smart_code')
      .range(offset, offset + PAGE_SIZE - 1);

    if (debouncedSearch) {
      query = query.or(
        `smart_code.ilike.%${debouncedSearch}%,master_code.ilike.%${debouncedSearch}%,unit_no.ilike.%${debouncedSearch}%,property.ilike.%${debouncedSearch}%`
      );
    }

    const { data, count, error } = await query;
    setRegistryLoading(false);
    if (!error) {
      setRows((data ?? []) as SmartCodeRow[]);
      setTotal(count ?? 0);
    }
  }, [debouncedSearch, page]);

  useEffect(() => { fetchRows(page); }, [fetchRows, page]);

  async function handleExport() {
    setExporting(true);
    const { data } = await supabase
      .from('units')
      .select('id, unit_code, unit_no, property, zone, zone_code, type, config, furnishing, status, rent, smart_code, master_code')
      .not('smart_code', 'is', null)
      .order('smart_code')
      .limit(5000);
    setExporting(false);
    if (data?.length) exportToCsv(data as SmartCodeRow[]);
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
            <h1 className="text-xl font-bold text-[#e0e0e0] tracking-tight">Smart Code Registry</h1>
            <p className="text-sm text-[#555] mt-1">Canonical Smart Codes and Master Codes assigned to units. Resolve a Smart Code to look up its full unit record.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#555] uppercase tracking-wider">Total</span>
              <span className="font-mono text-[#4ade80] font-bold">{total}</span>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting || total === 0}
              className="px-3 py-1.5 text-xs border border-[#2a2a2a] text-[#888] rounded-lg hover:border-[#3a3a3a] hover:bg-[#141414] transition-colors disabled:opacity-40"
            >
              {exporting ? 'Exporting…' : '↓ Export CSV'}
            </button>
          </div>
        </div>

        {/* Resolve panel — full width */}
        <ResolvePanel />

        {/* Search + Registry */}
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#2a2a2a] flex items-center gap-3">
            <span className="text-xs font-semibold text-[#888] uppercase tracking-wider shrink-0">Registry</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search smart code, master code, property…"
              className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-xs text-[#e0e0e0] placeholder-[#444] focus:outline-none focus:border-[#4ade80] font-mono max-w-[320px]"
            />
          </div>

          <RegistryTable rows={rows} loading={registryLoading} />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-[#1e1e1e] flex items-center justify-between">
              <span className="text-[11px] text-[#555]">
                Page {page} of {totalPages} · {total} total
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => goToPage(1)} disabled={page === 1}
                  className="px-2 py-1 text-[11px] text-[#555] hover:text-[#888] disabled:opacity-30 transition-colors">«</button>
                <button onClick={() => goToPage(page - 1)} disabled={page === 1}
                  className="px-2.5 py-1 text-xs text-[#888] border border-[#2a2a2a] rounded hover:bg-[#1e1e1e] disabled:opacity-30 transition-colors">Prev</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const p = start + i;
                  return p <= totalPages ? (
                    <button key={p} onClick={() => goToPage(p)}
                      className={`px-2.5 py-1 text-xs rounded border transition-colors ${p === page ? 'bg-[#4ade80]/20 border-[#4ade80]/40 text-[#4ade80] font-bold' : 'border-[#2a2a2a] text-[#555] hover:bg-[#1e1e1e] hover:text-[#888]'}`}>
                      {p}
                    </button>
                  ) : null;
                })}
                <button onClick={() => goToPage(page + 1)} disabled={page === totalPages}
                  className="px-2.5 py-1 text-xs text-[#888] border border-[#2a2a2a] rounded hover:bg-[#1e1e1e] disabled:opacity-30 transition-colors">Next</button>
                <button onClick={() => goToPage(totalPages)} disabled={page === totalPages}
                  className="px-2 py-1 text-[11px] text-[#555] hover:text-[#888] disabled:opacity-30 transition-colors">»</button>
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}

export default function SmartCodeRegistryPage() {
  return <SmartCodeRegistryInner />;
}
