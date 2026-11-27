'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { authedFetch } from '../lib/authedFetch';
import { PORTALS, PortalId, PortalAudit } from '../lib/portalReadiness';

interface DemandUnit {
  id: string; master_code: string | null; smart_code: string | null; property: string | null; unit_no: string | null;
  type: string | null; config: string | null; rent: number | null; zone_name: string | null; furnishing: string | null;
  demand: { total: number; tier1: number; tier2: number; tier3: number };
  contact: { name: string | null; phone: string | null };
  media_url: string | null;
  audit: Record<PortalId, PortalAudit>;
  listed: boolean;
}
interface Tally { label: string; count: number; stock?: number }
interface Patterns {
  activeInquiries: number; availableUnits: number;
  listingType: Tally[]; propertyType: Tally[]; config: Tally[]; budget: Tally[]; furnishing: Tally[]; zones: Tally[];
}

const Tick = ({ ok, title }: { ok: boolean; title?: string }) => (
  <span title={title} className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold ${ok ? 'bg-[#052e16] text-[#4ade80]' : 'bg-[#2a0d12] text-[#f43f5e]'}`}>{ok ? '✓' : '✗'}</span>
);

function Readiness({ a, provisional }: { a: PortalAudit; provisional: boolean }) {
  const tip = [
    a.missingRequired.length ? `Missing (required): ${a.missingRequired.join(', ')}` : 'All required fields present',
    a.missingRecommended.length ? `Recommended: ${a.missingRecommended.join(', ')}` : '',
    provisional ? 'Provisional rules' : '',
  ].filter(Boolean).join('\n');
  return (
    <div title={tip} className="flex flex-col gap-1 items-start">
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${a.ready ? 'bg-[#052e16] text-[#4ade80]' : 'bg-[#2a1a05] text-[#f59e0b]'}`}>
        {a.ready ? 'Ready' : 'Needs info'}
      </span>
      <span className="text-[10px] text-[#666]">{a.score}%{a.missingRequired.length ? ` · ${a.missingRequired.length} missing` : ''}</span>
    </div>
  );
}

function Bars({ title, rows, showStock }: { title: string; rows: Tally[]; showStock?: boolean }) {
  const max = Math.max(1, ...rows.map(r => r.count));
  return (
    <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#555] mb-2">{title}</p>
      <div className="space-y-1.5">
        {rows.slice(0, 6).map(r => (
          <div key={r.label} className="text-xs">
            <div className="flex justify-between gap-2 text-[#bbb]">
              <span className="truncate">{r.label}</span>
              <span className="shrink-0 text-[#c9a84c]">{r.count}{showStock && r.stock != null ? <span className="text-[#555]"> · stock {r.stock}</span> : null}</span>
            </div>
            <div className="h-1 rounded bg-[#1a1a1a] mt-0.5"><div className="h-1 rounded bg-[#c9a84c]" style={{ width: `${(r.count / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DemandReadiness({ onPromoted }: { onPromoted?: () => void }) {
  const [data, setData]       = useState<{ patterns: Patterns; units: DemandUnit[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [limit, setLimit]     = useState(25);
  const [busy, setBusy]       = useState<string | null>(null);
  const [msg, setMsg]         = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const res = await authedFetch(`/api/properties/demand?limit=${limit}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setError(json.error ?? 'Could not load demand analysis'); else setData(json);
    setLoading(false);
  }, [limit]);
  useEffect(() => { load(); }, [load]);

  const promote = async (u: DemandUnit) => {
    setBusy(u.id);
    const res = await authedFetch('/api/properties/promote', { method: 'POST', body: JSON.stringify({ unit_id: u.id }) });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok || res.status === 409) {
      setMsg(m => ({ ...m, [u.id]: res.ok
        ? `Draft ${json.property?.ref_no ?? ''} created${json.unmappedAmenities?.length ? ` · unmapped amenities: ${json.unmappedAmenities.join(', ')}` : ''}`
        : json.error }));
      setData(d => d && ({ ...d, units: d.units.map(x => x.id === u.id ? { ...x, listed: true } : x) }));
      if (res.ok) onPromoted?.();
    } else {
      setMsg(m => ({ ...m, [u.id]: json.error ?? 'Failed' }));
    }
  };

  if (loading) return <div className="text-center py-20 text-[#555]">Analysing demand…</div>;
  if (error)   return <div className="text-center py-20 text-[#f43f5e] text-sm">{error}</div>;
  if (!data)   return null;
  const { patterns: p, units } = data;
  const prov = PORTALS.find(x => x.provisional);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#c9a84c]">Demand &amp; Readiness</h2>
          <p className="text-xs text-[#555] mt-0.5">
            {p.activeInquiries} active inquiries · {p.availableUnits} available units · top {units.length} units by demand
          </p>
        </div>
        <label className="text-xs text-[#666] flex items-center gap-2">Show top
          <select value={limit} onChange={e => setLimit(Number(e.target.value))}
            className="bg-[#111] border border-[#222] rounded px-2 py-1 text-[#ccc]">
            {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      {/* Demand patterns vs stock */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        <Bars title="Bedrooms (demand · stock)" rows={p.config} showStock />
        <Bars title="Property type (demand · stock)" rows={p.propertyType} showStock />
        <Bars title="Budget (QAR / month)" rows={p.budget} />
        <Bars title="Preferred zones" rows={p.zones} />
        <Bars title="Furnishing" rows={p.furnishing} />
      </div>

      {prov && (
        <p className="text-[11px] text-[#f59e0b]">
          Portal rules are <strong>provisional</strong> — PropertyFinder from the supplied listing form; Qatar Living is a copy until its requirements are provided.
          Floor, size, parking and amenities are recommended only. Rules live in <code>lib/portalReadiness.ts</code>.
        </p>
      )}

      {units.length === 0 ? (
        <p className="text-center py-12 text-[#555] text-sm">No available units match the active inquiries.</p>
      ) : (
        <div className="overflow-x-auto border border-[#1e1e1e] rounded-xl">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#0d0d0d] text-[#555] uppercase tracking-wider text-[10px] text-left">
                <th className="px-3 py-2">Codes</th>
                <th className="px-3 py-2">Unit</th>
                <th className="px-3 py-2">Demand</th>
                {PORTALS.map(pt => <th key={pt.id} className="px-3 py-2">{pt.label}{pt.provisional ? ' *' : ''}</th>)}
                <th className="px-3 py-2 text-center">Info</th>
                <th className="px-3 py-2 text-center">Pictures</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {units.map(u => {
                const infoOk = PORTALS.every(pt => u.audit[pt.id].infoComplete);
                const picOk  = PORTALS.every(pt => u.audit[pt.id].picturesOk);
                const missing = Array.from(new Set(PORTALS.flatMap(pt => u.audit[pt.id].missingRequired.filter(m => m !== 'Pictures (link)'))));
                return (
                  <tr key={u.id} className="border-t border-[#1a1a1a] align-top hover:bg-[#0f0f0f]">
                    <td className="px-3 py-2.5">
                      <div className="font-mono text-[10px] text-[#60a5fa] whitespace-nowrap">{u.master_code ?? '—'}</div>
                      <div className="mt-1"><span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#052e16] text-[#4ade80] whitespace-nowrap">{u.smart_code ?? '—'}</span></div>
                    </td>
                    <td className="px-3 py-2.5 text-[#ccc]">
                      <div>{u.property ?? '—'}{u.unit_no ? ` · ${u.unit_no}` : ''}</div>
                      <div className="text-[#666]">{[u.type, u.config, u.furnishing].filter(Boolean).join(' · ')}</div>
                      <div className="text-[#666]">{u.zone_name ?? '—'}{u.rent ? ` · QAR ${u.rent.toLocaleString()}` : ''}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-[#c9a84c] font-bold">{u.demand.total}</div>
                      <div className="text-[10px] text-[#666]">best {u.demand.tier1} · good {u.demand.tier2} · fair {u.demand.tier3}</div>
                    </td>
                    {PORTALS.map(pt => (
                      <td key={pt.id} className="px-3 py-2.5"><Readiness a={u.audit[pt.id]} provisional={pt.provisional} /></td>
                    ))}
                    <td className="px-3 py-2.5 text-center"><Tick ok={infoOk} title={infoOk ? 'Complete info' : `Missing: ${missing.join(', ')}`} /></td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Tick ok={picOk} title={picOk ? 'Picture link present (not verified)' : 'No picture link'} />
                        {u.media_url && <a href={u.media_url} target="_blank" rel="noopener noreferrer" title="Open picture link" className="text-[#38bdf8]">🔗</a>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[#aaa]">
                      {u.contact.name || u.contact.phone
                        ? <>{u.contact.name && <div>{u.contact.name}</div>}{u.contact.phone && <div className="text-[#666]">{u.contact.phone}</div>}</>
                        : <span className="text-[#f43f5e]">none</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {u.listed
                        ? <span className="text-[10px] text-[#4ade80]">Listed</span>
                        : <button onClick={() => promote(u)} disabled={busy === u.id}
                            className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#c9a84c] text-[#111] hover:bg-[#dfc070] disabled:opacity-50">
                            {busy === u.id ? '…' : 'Promote →'}
                          </button>}
                      {msg[u.id] && <div className="text-[10px] text-[#888] mt-1 max-w-[180px] whitespace-normal ml-auto">{msg[u.id]}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
