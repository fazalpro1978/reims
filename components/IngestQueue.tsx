'use client';
import React, { useState } from 'react';
import TopBar from './TopBar';

type VettedRecord = {
  id: string;
  run_id: string;
  payload: Record<string, unknown>;
  source_file: string | null;
  match_type: string;
  approved_at: string | null;
  approved_by: string | null;
};

type PullResult = { records: VettedRecord[]; count: number };
type ApplyResult = { inserted: number; updated: number; acknowledged: number; errors: string[] };

function MatchBadge({ type }: { type: string }) {
  if (type === 'new') return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e]">NEW</span>;
  if (type === 'update') return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#c9a84c]/10 border border-[#c9a84c]/30 text-[#c9a84c]">UPDATE</span>;
  return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#888]/10 border border-[#888]/30 text-[#888]">{type.toUpperCase()}</span>;
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'number') return v.toLocaleString();
  return String(v);
}

export default function IngestQueue({ onMenuClick }: { onMenuClick?: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'checking' | 'preview' | 'importing' | 'done' | 'error'>('idle');
  const [records, setRecords] = useState<VettedRecord[]>([]);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function checkQueue() {
    setPhase('checking');
    setErrorMsg('');
    try {
      const res = await fetch('/api/ingest/pull', { cache: 'no-store' });
      const data: PullResult & { error?: string } = await res.json();
      if (!res.ok || data.error) { setErrorMsg(data.error ?? 'Failed to fetch queue'); setPhase('error'); return; }
      setRecords(data.records ?? []);
      setPhase('preview');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
      setPhase('error');
    }
  }

  async function importAll() {
    setPhase('importing');
    try {
      const res = await fetch('/api/ingest/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      });
      const data: ApplyResult & { error?: string } = await res.json();
      if (!res.ok || data.error) { setErrorMsg(data.error ?? 'Import failed'); setPhase('error'); return; }
      setResult(data);
      setPhase('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
      setPhase('error');
    }
  }

  function reset() { setPhase('idle'); setRecords([]); setResult(null); setErrorMsg(''); }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <TopBar onMenuClick={onMenuClick} />

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-lg font-bold text-white">dInges Queue</h1>
          <p className="text-xs text-[#555] mt-0.5">Pull approved records from the Ingestion Service and sync them into REIMS.</p>
        </div>

        {/* ── IDLE ─────────────────────────────────────────────────── */}
        {phase === 'idle' && (
          <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-[#f97316]/10 border border-[#f97316]/20 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Check for Approved Records</p>
              <p className="text-xs text-[#555] mt-1">Queries the dInges vetted queue for records approved and waiting to be synced into REIMS.</p>
            </div>
            <button
              onClick={checkQueue}
              className="px-6 py-2 bg-[#c9a84c] hover:bg-[#dfc070] text-[#0f0f0f] text-sm font-bold rounded-lg transition-colors"
            >
              Check dInges Queue
            </button>
          </div>
        )}

        {/* ── CHECKING ─────────────────────────────────────────────── */}
        {phase === 'checking' && (
          <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-12 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[#888]">Querying dInges vetted queue…</p>
          </div>
        )}

        {/* ── PREVIEW ──────────────────────────────────────────────── */}
        {phase === 'preview' && (
          <>
            {records.length === 0 ? (
              <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-10 flex flex-col items-center gap-3 text-center">
                <p className="text-2xl">✓</p>
                <p className="text-sm font-semibold text-[#22c55e]">Queue is clear</p>
                <p className="text-xs text-[#555]">No approved records are waiting to be synced.</p>
                <button onClick={reset} className="mt-2 text-xs text-[#c9a84c] underline">Check again</button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary bar */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <span className="text-2xl font-bold text-[#c9a84c]">{records.length}</span>
                    <span className="text-sm text-[#888] ml-2">record{records.length !== 1 ? 's' : ''} ready to import</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={reset} className="px-3 py-1.5 text-xs border border-[#2a2a2a] text-[#888] rounded-lg hover:border-[#3a3a3a] hover:bg-[#141414] transition-colors">
                      Cancel
                    </button>
                    <button
                      onClick={importAll}
                      className="px-5 py-1.5 bg-[#c9a84c] hover:bg-[#dfc070] text-[#0f0f0f] text-xs font-bold rounded-lg transition-colors"
                    >
                      Import All {records.length} →
                    </button>
                  </div>
                </div>

                {/* Record table */}
                <div className="rounded-xl border border-[#1e1e1e] overflow-hidden">
                  <table className="w-full text-xs table-fixed">
                    <colgroup>
                      <col style={{ width: '9%' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '7%' }} />
                      <col style={{ width: '9%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '12%' }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-[#1e1e1e] bg-[#0d0d0d]">
                        {['Match', 'Property', 'Unit', 'Type', 'Config', 'Furnishing', 'Rent/mo', 'Status', 'Source File'].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-[#555] uppercase tracking-widest truncate">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r) => {
                        const p = r.payload;
                        return (
                          <tr key={r.id} className="border-b border-[#1a1a1a] hover:bg-[#141414] transition-colors">
                            <td className="px-3 py-2.5"><MatchBadge type={r.match_type} /></td>
                            <td className="px-3 py-2.5 text-white font-medium truncate" title={fmt(p.property)}>{fmt(p.property)}</td>
                            <td className="px-3 py-2.5 text-[#888] font-mono truncate">{fmt(p.unit_no)}</td>
                            <td className="px-3 py-2.5 text-[#888] truncate">{fmt(p.type)}</td>
                            <td className="px-3 py-2.5 text-[#888] truncate">{fmt(p.config)}</td>
                            <td className="px-3 py-2.5 text-[#888] truncate">{fmt(p.furnishing)}</td>
                            <td className="px-3 py-2.5 text-white font-semibold truncate">
                              {p.rent ? `QAR ${Number(p.rent).toLocaleString()}` : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-[#888] truncate">{fmt(p.status)}</td>
                            <td className="px-3 py-2.5 text-[#555] truncate" title={r.source_file ?? ''}>{r.source_file ?? '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <p className="text-[11px] text-[#444]">
                  Clicking <span className="text-[#c9a84c]">Import All</span> will upsert these records into REIMS and acknowledge receipt to dInges — they will be removed from the vetted queue.
                </p>
              </div>
            )}
          </>
        )}

        {/* ── IMPORTING ────────────────────────────────────────────── */}
        {phase === 'importing' && (
          <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-12 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[#888]">Writing {records.length} record{records.length !== 1 ? 's' : ''} into REIMS…</p>
          </div>
        )}

        {/* ── DONE ─────────────────────────────────────────────────── */}
        {phase === 'done' && result && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#22c55e]/20 bg-[#22c55e]/5 p-6 flex items-start gap-4">
              <div className="w-9 h-9 rounded-full bg-[#22c55e]/20 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2.5} strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-[#22c55e]">Import Complete</p>
                <div className="flex gap-6 mt-3">
                  {[
                    { label: 'Inserted', value: result.inserted, color: '#22c55e' },
                    { label: 'Updated', value: result.updated, color: '#c9a84c' },
                    { label: 'Acknowledged', value: result.acknowledged, color: '#888' },
                  ].map((s) => (
                    <div key={s.label}>
                      <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-[10px] text-[#555]">{s.label}</p>
                    </div>
                  ))}
                </div>
                {result.errors.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {result.errors.map((e, i) => (
                      <p key={i} className="text-[11px] text-[#ef4444]">{e}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button onClick={reset} className="text-xs text-[#c9a84c] underline">Check queue again</button>
          </div>
        )}

        {/* ── ERROR ────────────────────────────────────────────────── */}
        {phase === 'error' && (
          <div className="rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/5 px-5 py-4 space-y-2">
            <p className="text-sm font-semibold text-[#ef4444]">Error</p>
            <p className="text-xs text-[#ef4444]/80">{errorMsg}</p>
            <button onClick={reset} className="text-xs text-[#888] underline mt-1">Try again</button>
          </div>
        )}
      </div>
    </div>
  );
}
