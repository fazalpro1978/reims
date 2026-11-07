'use client';
import React, { useState, useMemo } from 'react';
import { authedFetch } from '../lib/authedFetch';
import { useAuth } from '../contexts/AuthContext';
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
type EditingCell = { id: string; field: string; value: string; originalValue?: unknown };
type OverwriteWarning = { id: string; field: string; originalValue: unknown };

const NUMERIC_FIELDS = new Set(['zone_code', 'bathrooms', 'rent']);
const SELECT_OPTIONS: Record<string, string[]> = {
  type:       ['Apartment', 'Villa', 'Townhouse', 'Studio', 'Duplex', 'Penthouse', 'Office', 'Retail'],
  config:     ['Studio', '1 BHK', '2 BHK', '3 BHK', '4 BHK', '5 BHK', '6 BHK', '7 BHK'],
  furnishing: ['Furnished', 'Unfurnished', 'Semi-Furnished', 'Fully Furnished', 'Partially Furnished'],
  kitchen:    ['Open', 'Closed', 'Yes'],
  parking:    ['Yes', 'No'],
};

// ── Helper components ────────────────────────────────────────────────────────

function MatchBadge({ type }: { type: string }) {
  if (type === 'new')
    return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e]">NEW</span>;
  if (type === 'update')
    return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#c9a84c]/10 border border-[#c9a84c]/30 text-[#c9a84c]">UPDATE</span>;
  return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#888]/10 border border-[#888]/30 text-[#888]">{type.toUpperCase()}</span>;
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'number') return v.toLocaleString();
  return String(v);
}

// NullCell — renders a "+" placeholder for null fields that opens an inline editor.
// Non-null values are read-only for staff; superuser/administrator get a click-to-overwrite
// flow (warning confirmation first). Defined outside IngestQueue to avoid remount-on-render.
function NullCell({
  recordId, field, value, editing, originalValue,
  onStart, onChangeValue, onCommit, onCancel,
  canOverwrite = false, color = '#6b7280',
}: {
  recordId: string; field: string; value: unknown;
  editing: EditingCell | null;
  originalValue?: unknown;
  onStart: (id: string, field: string) => void;
  onChangeValue: (val: string) => void;
  onCommit: (val?: string) => void;
  onCancel: () => void;
  canOverwrite?: boolean;
  color?: string;
}) {
  const isNull = value === null || value === undefined || value === '';
  const isEditing = editing?.id === recordId && editing?.field === field;
  const opts = SELECT_OPTIONS[field] ?? null;

  if (isEditing) {
    const wasLabel = originalValue !== null && originalValue !== undefined && originalValue !== ''
      ? <span className="text-[9px] text-[#c9a84c]/60 mb-0.5 block truncate">was: {fmt(originalValue)}</span>
      : null;
    if (opts) {
      return (
        <div>
          {wasLabel}
          <select
            autoFocus
            defaultValue=""
            onChange={e => onCommit(e.target.value)}
            onBlur={onCancel}
            onClick={e => e.stopPropagation()}
            className="w-full bg-[#0d0d0d] border border-[#c9a84c]/60 rounded px-1 text-[10px] text-white outline-none cursor-pointer"
          >
            <option value="" disabled>—</option>
            {opts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      );
    }
    return (
      <div>
        {wasLabel}
        <input
          autoFocus
          type={NUMERIC_FIELDS.has(field) ? 'number' : 'text'}
          value={editing!.value}
          onChange={e => onChangeValue(e.target.value)}
          onBlur={() => onCommit()}
          onKeyDown={e => {
            if (e.key === 'Enter')  { e.preventDefault(); onCommit(); }
            if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
          }}
          onClick={e => e.stopPropagation()}
          className="w-full bg-[#0d0d0d] border border-[#c9a84c]/60 rounded px-1 text-[10px] outline-none"
          style={{ color }}
        />
      </div>
    );
  }

  if (!isNull) {
    if (canOverwrite) {
      return (
        <span
          className="truncate cursor-pointer border-b border-dashed border-[#c9a84c]/30 hover:border-[#c9a84c]/70 hover:text-[#c9a84c] transition-colors"
          style={{ color }}
          onClick={e => { e.stopPropagation(); onStart(recordId, field); }}
          title={`Overwrite ${field} (privileged)`}
        >{fmt(value)}</span>
      );
    }
    return <span className="truncate" style={{ color }}>{fmt(value)}</span>;
  }

  return (
    <span
      className="text-[#2a2a2a] hover:text-[#c9a84c]/50 cursor-pointer transition-colors select-none text-[12px] font-light"
      onClick={e => { e.stopPropagation(); onStart(recordId, field); }}
      title={`Click to set ${field}`}
    >+</span>
  );
}

// ── Persistent edit overlay (localStorage) ───────────────────────────────────
// Edits are keyed by vetted_record id. Merged over fetched records so they
// survive re-fetch and page refresh. Cleared on import success or discard.

const LS_KEY = 'reims-ingest-edits';
type EditMap = Record<string, Record<string, unknown>>; // id → { field: value }

function loadEdits(): EditMap {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}'); } catch { return {}; }
}
function saveEdits(map: EditMap) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(map)); } catch { /* quota */ }
}
function clearEdits() {
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
}
function mergeEdits(records: VettedRecord[]): VettedRecord[] {
  const map = loadEdits();
  if (!Object.keys(map).length) return records;
  return records.map(r => {
    const overrides = map[r.id];
    if (!overrides) return r;
    return { ...r, payload: { ...r.payload, ...overrides } };
  });
}

// ── Main component ────────────────────────────────────────────────────────────

export default function IngestQueue({ onMenuClick }: { onMenuClick?: () => void }) {
  const { role } = useAuth();
  const canOverwrite = role === 'superuser' || role === 'administrator';

  const [phase, setPhase] = useState<'idle' | 'checking' | 'preview' | 'importing' | 'done' | 'error'>('idle');
  const [records, setRecords]       = useState<VettedRecord[]>([]);
  const [result, setResult]         = useState<ApplyResult | null>(null);
  const [errorMsg, setErrorMsg]     = useState('');
  const [clearing, setClearing]     = useState(false);
  const [clearResult, setClearResult] = useState<{ cleared: number } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [discarding, setDiscarding] = useState(false);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [overwriteWarning, setOverwriteWarning] = useState<OverwriteWarning | null>(null);
  const [partialResult, setPartialResult] = useState<(ApplyResult & { count: number }) | null>(null);
  const [importingSelected, setImportingSelected] = useState(false);

  // ── Run grouping ──────────────────────────────────────────────────────────

  const runGroups = useMemo(() => {
    const groups = new Map<string, VettedRecord[]>();
    for (const r of records) {
      const list = groups.get(r.run_id) ?? [];
      list.push(r);
      groups.set(r.run_id, list);
    }
    return groups;
  }, [records]);

  const latestRunId = useMemo(() => {
    let latest: string | null = null;
    let latestTime = 0;
    runGroups.forEach((recs, id) => {
      for (const r of recs) {
        const t = r.approved_at ? new Date(r.approved_at).getTime() : 0;
        if (t > latestTime) { latestTime = t; latest = id; }
      }
    });
    return latest;
  }, [runGroups]);

  const sortedRunEntries = useMemo(() =>
    Array.from(runGroups.entries()).sort((a, b) => {
      const aTime = Math.max(...a[1].map(r => r.approved_at ? new Date(r.approved_at).getTime() : 0));
      const bTime = Math.max(...b[1].map(r => r.approved_at ? new Date(r.approved_at).getTime() : 0));
      return bTime - aTime;
    }),
  [runGroups]);

  // ── Queue actions ─────────────────────────────────────────────────────────

  async function checkQueue() {
    setPhase('checking');
    setErrorMsg('');
    try {
      const res = await authedFetch('/api/ingest/pull', { cache: 'no-store' });
      const data: PullResult & { error?: string } = await res.json();
      if (!res.ok || data.error) { setErrorMsg(data.error ?? 'Failed to fetch queue'); setPhase('error'); return; }
      // Merge any locally-persisted edits back over the freshly-fetched records
      setRecords(mergeEdits(data.records ?? []));
      setPhase('preview');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
      setPhase('error');
    }
  }

  async function importAll() {
    setPhase('importing');
    try {
      const res = await authedFetch('/api/ingest/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      });
      const data: ApplyResult & { error?: string } = await res.json();
      if (!res.ok || data.error) { setErrorMsg(data.error ?? 'Import failed'); setPhase('error'); return; }
      clearEdits(); // imported — edits no longer needed
      setResult(data);
      setPhase('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
      setPhase('error');
    }
  }

  async function importSelected() {
    if (selectedIds.size === 0 || importingSelected) return;
    const toImport = records.filter(r => selectedIds.has(r.id));
    setImportingSelected(true);
    setPartialResult(null);
    try {
      const res = await authedFetch('/api/ingest/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: toImport }),
      });
      const data: ApplyResult & { error?: string } = await res.json();
      if (!res.ok || data.error) { setErrorMsg(data.error ?? 'Import failed'); setPhase('error'); return; }
      // Remove imported records from queue; keep the rest
      const importedIds = new Set(toImport.map(r => r.id));
      setRecords(prev => prev.filter(r => !importedIds.has(r.id)));
      setSelectedIds(new Set());
      // Clean up localStorage for the imported records
      const map = loadEdits();
      importedIds.forEach(id => { delete map[id]; });
      saveEdits(map);
      setPartialResult({ ...data, count: toImport.length });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
      setPhase('error');
    } finally {
      setImportingSelected(false);
    }
  }

  function reset() {
    clearEdits();
    setPhase('idle'); setRecords([]); setResult(null); setErrorMsg('');
    setClearResult(null); setConfirmClear(false); setPartialResult(null); setImportingSelected(false);
    setSelectedIds(new Set()); setEditingCell(null); setOverwriteWarning(null);
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSelectedIds(prev => prev.size === records.length ? new Set() : new Set(records.map(r => r.id)));
  }

  async function discardIds(ids: string[]) {
    if (ids.length === 0 || discarding) return;
    setDiscarding(true);
    try {
      const res = await authedFetch('/api/ingest/discard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (res.ok) {
        const idsSet = new Set(ids);
        setRecords(prev => prev.filter(r => !idsSet.has(r.id)));
        setSelectedIds(prev => { const n = new Set(prev); for (const id of ids) n.delete(id); return n; });
        // Remove discarded records from persisted edits
        const map = loadEdits();
        for (const id of ids) delete map[id];
        saveEdits(map);
      } else {
        const d = await res.json();
        setErrorMsg(d.error ?? 'Discard failed');
        setPhase('error');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Discard failed');
      setPhase('error');
    } finally {
      setDiscarding(false);
    }
  }

  function discardSelected() { discardIds(Array.from(selectedIds)); }
  function discardRun(run_id: string) {
    discardIds(records.filter(r => r.run_id === run_id).map(r => r.id));
  }

  async function clearQueue() {
    setClearing(true);
    setConfirmClear(false);
    try {
      const res = await fetch('/api/ingest/clear', { method: 'POST', cache: 'no-store' });
      const data: { cleared?: number; error?: string } = await res.json();
      if (!res.ok || data.error) { setErrorMsg(data.error ?? 'Clear failed'); setPhase('error'); return; }
      setClearResult({ cleared: data.cleared ?? 0 });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
      setPhase('error');
    } finally {
      setClearing(false);
    }
  }

  // ── Inline cell editing ───────────────────────────────────────────────────

  function startEdit(id: string, field: string) {
    const record = records.find(r => r.id === id);
    if (!record) return;
    const current = record.payload[field];
    const hasValue = current !== null && current !== undefined && current !== '';
    if (hasValue) {
      if (!canOverwrite) return; // read-only for non-privileged roles
      // Privileged: show overwrite confirmation before opening editor
      setOverwriteWarning({ id, field, originalValue: current });
      return;
    }
    setEditingCell({ id, field, value: '' });
  }

  function confirmOverwrite(prefill: 'current' | 'blank') {
    if (!overwriteWarning) return;
    const initValue = prefill === 'current' ? String(overwriteWarning.originalValue) : '';
    setEditingCell({ id: overwriteWarning.id, field: overwriteWarning.field, value: initValue, originalValue: overwriteWarning.originalValue });
    setOverwriteWarning(null);
  }

  function commitEdit(newValue?: string) {
    if (!editingCell) return;
    const val = (newValue ?? editingCell.value).trim();
    if (!val) { setEditingCell(null); return; }
    const parsed: unknown = NUMERIC_FIELDS.has(editingCell.field) ? Number(val) : val;
    setRecords(prev => prev.map(r => {
      if (r.id !== editingCell.id) return r;
      return { ...r, payload: { ...r.payload, [editingCell.field]: parsed } };
    }));
    // Persist edit so it survives re-fetch and page refresh
    const map = loadEdits();
    map[editingCell.id] = { ...(map[editingCell.id] ?? {}), [editingCell.field]: parsed };
    saveEdits(map);
    setEditingCell(null);
  }

  const cellProps = {
    editing: editingCell,
    originalValue: editingCell?.originalValue,
    canOverwrite,
    onStart: startEdit,
    onChangeValue: (val: string) => setEditingCell(prev => prev ? { ...prev, value: val } : prev),
    onCommit: commitEdit,
    onCancel: () => setEditingCell(null),
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <TopBar onMenuClick={onMenuClick} />

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-lg font-bold text-white">Axiom Queue</h1>
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
              <p className="text-xs text-[#555] mt-1">Queries the Axiom vetted queue for records approved and waiting to be synced into REIMS.</p>
            </div>
            <button
              onClick={checkQueue}
              className="px-6 py-2 bg-[#c9a84c] hover:bg-[#dfc070] text-[#0f0f0f] text-sm font-bold rounded-lg transition-colors"
            >
              Check Axiom Queue
            </button>
          </div>
        )}

        {/* ── CHECKING ─────────────────────────────────────────────── */}
        {phase === 'checking' && (
          <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-12 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[#888]">Querying Axiom vetted queue…</p>
          </div>
        )}

        {/* ── PREVIEW ──────────────────────────────────────────────── */}
        {phase === 'preview' && (
          <>
            {records.length === 0 ? (
              <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-10 flex flex-col items-center gap-4 text-center">
                <p className="text-2xl">✓</p>
                <p className="text-sm font-semibold text-[#22c55e]">Queue is clear</p>
                <p className="text-xs text-[#555]">No approved records are waiting to be synced.</p>

                {clearResult !== null && (
                  <p className="text-xs text-[#888]">
                    {clearResult.cleared === 0
                      ? 'Nothing to clear — queue was already empty in Axiom.'
                      : `${clearResult.cleared} stuck record${clearResult.cleared !== 1 ? 's' : ''} force-acknowledged and removed from Axiom.`}
                  </p>
                )}

                <div className="flex flex-col items-center gap-2 mt-1">
                  <button onClick={reset} className="text-xs text-[#c9a84c] underline">Check again</button>

                  {!confirmClear ? (
                    <button
                      onClick={() => setConfirmClear(true)}
                      className="text-xs text-[#555] hover:text-[#888] underline transition-colors"
                    >
                      Records exist but aren't showing? Force clear queue →
                    </button>
                  ) : (
                    <div className="mt-1 rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/5 px-5 py-3 flex flex-col items-center gap-2">
                      <p className="text-xs text-[#ef4444] font-semibold">Force-acknowledge all pending records in Axiom?</p>
                      <p className="text-[11px] text-[#666]">This removes all unsynced records from the Axiom queue without importing them into REIMS. Use only if records are stuck.</p>
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => setConfirmClear(false)}
                          className="px-3 py-1 text-xs border border-[#2a2a2a] text-[#888] rounded-lg hover:bg-[#1a1a1a] transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={clearQueue}
                          disabled={clearing}
                          className="px-4 py-1 text-xs bg-[#ef4444] hover:bg-[#dc2626] text-white font-bold rounded-lg transition-colors disabled:opacity-50"
                        >
                          {clearing ? 'Clearing…' : 'Yes, Force Clear'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary bar + run breakdown — sticky so discard controls stay visible while scrolling */}
                <div className="sticky top-[54px] z-20 bg-[#0a0a0a] pb-2 -mx-6 px-6 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-[#c9a84c]">{records.length}</span>
                    <span className="text-sm text-[#888]">record{records.length !== 1 ? 's' : ''} ready to import</span>
                    {selectedIds.size > 0 && (
                      <span className="text-xs text-[#ef4444] font-semibold">{selectedIds.size} selected</span>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={reset} className="px-3 py-1.5 text-xs border border-[#2a2a2a] text-[#888] rounded-lg hover:border-[#3a3a3a] hover:bg-[#141414] transition-colors">
                      Cancel
                    </button>
                    {selectedIds.size > 0 && (
                      <>
                        <button
                          onClick={discardSelected}
                          disabled={discarding || importingSelected}
                          className="px-4 py-1.5 text-xs border border-[#ef4444]/40 bg-[#ef4444]/10 text-[#ef4444] font-bold rounded-lg hover:bg-[#ef4444]/20 transition-colors disabled:opacity-50"
                        >
                          {discarding ? 'Discarding…' : `Discard Selected (${selectedIds.size})`}
                        </button>
                        <button
                          onClick={importSelected}
                          disabled={importingSelected || discarding}
                          className="px-4 py-1.5 text-xs border border-[#c9a84c]/40 bg-[#c9a84c]/10 text-[#c9a84c] font-bold rounded-lg hover:bg-[#c9a84c]/20 transition-colors disabled:opacity-50"
                        >
                          {importingSelected ? 'Importing…' : `Import Selected (${selectedIds.size})`}
                        </button>
                      </>
                    )}
                    <button
                      onClick={importAll}
                      disabled={importingSelected}
                      className="px-5 py-1.5 bg-[#c9a84c] hover:bg-[#dfc070] text-[#0f0f0f] text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                    >
                      Import All {records.length} →
                    </button>
                  </div>
                </div>

                {/* ── Run breakdown (shown only when multiple runs are present) ── */}
                {runGroups.size > 1 && (
                  <div className="rounded-lg border border-[#1e1e1e] bg-[#0d0d0d] px-4 py-3">
                    <p className="text-[9px] font-bold text-[#444] uppercase tracking-wider mb-2.5">
                      {runGroups.size} runs in queue — discard stale runs before importing
                    </p>
                    <div className="space-y-2">
                      {sortedRunEntries.map(([runId, recs]) => {
                        const isLatest = runId === latestRunId;
                        const latestApproval = recs
                          .map(r => r.approved_at)
                          .filter(Boolean)
                          .sort()
                          .at(-1);
                        const sourceFile = recs[0]?.source_file;
                        return (
                          <div key={runId} className="flex items-center justify-between gap-3 min-w-0">
                            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isLatest ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`} />
                              <span className={`font-mono text-[10px] flex-shrink-0 ${isLatest ? 'text-[#555]' : 'text-[#ef4444]/70'}`}>{runId.slice(0, 8)}</span>
                              <span className={`text-[10px] flex-shrink-0 ${isLatest ? 'text-[#555]' : 'text-[#ef4444]/70'}`}>
                                {recs.length} record{recs.length !== 1 ? 's' : ''}
                              </span>
                              {latestApproval && (
                                <span className={`text-[10px] flex-shrink-0 ${isLatest ? 'text-[#444]' : 'text-[#ef4444]/50'}`}>
                                  {new Date(latestApproval).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                                </span>
                              )}
                              {sourceFile && (
                                <span className={`text-[10px] truncate ${isLatest ? 'text-[#333]' : 'text-[#ef4444]/40'}`} title={sourceFile}>{sourceFile}</span>
                              )}
                              {isLatest ? (
                                <span className="text-[9px] font-bold text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/20 px-1.5 py-px rounded-full flex-shrink-0">
                                  current
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/30 px-1.5 py-px rounded-full flex-shrink-0">
                                  STALE
                                </span>
                              )}
                            </div>
                            {!isLatest && (
                              <button
                                onClick={() => discardRun(runId)}
                                disabled={discarding}
                                className="text-[10px] text-[#ef4444]/60 hover:text-[#ef4444] font-semibold transition-colors disabled:opacity-40 flex-shrink-0"
                              >
                                {discarding ? '…' : 'Discard →'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                </div>{/* end sticky header */}

                {/* ── Partial import result banner ── */}
                {partialResult && (
                  <div className="rounded-lg border border-[#22c55e]/20 bg-[#22c55e]/5 px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2.5} strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                      <span className="text-xs text-[#22c55e] font-semibold">
                        {partialResult.count} record{partialResult.count !== 1 ? 's' : ''} imported
                      </span>
                      <span className="text-[10px] text-[#555]">
                        {partialResult.inserted > 0 && `${partialResult.inserted} inserted`}
                        {partialResult.inserted > 0 && partialResult.updated > 0 && ' · '}
                        {partialResult.updated > 0 && `${partialResult.updated} updated`}
                      </span>
                    </div>
                    <button onClick={() => setPartialResult(null)} className="text-[10px] text-[#444] hover:text-[#666] transition-colors">dismiss</button>
                  </div>
                )}

                {/* ── Record table ── */}
                <div className="rounded-xl border border-[#1e1e1e] w-full overflow-x-auto">
                  <table className="table-fixed w-full text-[11px]">
                    <colgroup>
                      <col style={{ width: '2%'  }} />{/* Checkbox */}
                      <col style={{ width: '4%'  }} />{/* Match */}
                      <col style={{ width: '7%'  }} />{/* Realtor */}
                      <col style={{ width: '10%' }} />{/* Property */}
                      <col style={{ width: '8%'  }} />{/* Smart Code */}
                      <col style={{ width: '3%'  }} />{/* Unit */}
                      <col style={{ width: '4%'  }} />{/* Zone # */}
                      <col style={{ width: '10%' }} />{/* Zone */}
                      <col style={{ width: '7%'  }} />{/* Type */}
                      <col style={{ width: '5%'  }} />{/* Config */}
                      <col style={{ width: '4%'  }} />{/* Bath */}
                      <col style={{ width: '5%'  }} />{/* Kitchen */}
                      <col style={{ width: '4%'  }} />{/* Parking */}
                      <col style={{ width: '9%'  }} />{/* Furnishing */}
                      <col style={{ width: '8%'  }} />{/* Rent/mo */}
                      <col style={{ width: '5%'  }} />{/* Status */}
                      <col style={{ width: '5%'  }} />{/* Source File */}
                    </colgroup>
                    <thead>
                      <tr className="border-b border-[#1e1e1e] bg-[#0d0d0d]">
                        <th className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.size === records.length && records.length > 0}
                            onChange={toggleAll}
                            className="w-3 h-3 accent-[#ef4444] cursor-pointer"
                          />
                        </th>
                        {['Match','Realtor','Property','Smart Code','Unit','Zone #','Zone','Type','Config','Bath','Kitchen','Parking','Furnishing','Rent/mo','Status','Source File'].map(h => (
                          <th key={h} className="px-2 py-2 text-left text-[9px] font-bold text-[#555] uppercase tracking-wider truncate">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r) => {
                        const p = r.payload;
                        const checked = selectedIds.has(r.id);
                        return (
                          <tr
                            key={r.id}
                            className={`border-b border-[#1a1a1a] transition-colors cursor-pointer ${checked ? 'bg-[#ef4444]/5' : 'hover:bg-[#141414]'}`}
                            onClick={() => toggleSelect(r.id)}
                          >
                            {/* Checkbox */}
                            <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSelect(r.id)}
                                className="w-3 h-3 accent-[#ef4444] cursor-pointer"
                              />
                            </td>

                            {/* Match */}
                            <td className="px-2 py-2"><MatchBadge type={r.match_type} /></td>

                            {/* Realtor */}
                            <td className="px-2 py-2 text-[#888] truncate" title={fmt(p.realtor_name)}>{fmt(p.realtor_name)}</td>

                            {/* Property */}
                            <td className="px-2 py-2 text-white font-medium truncate" title={fmt(p.property)}>{fmt(p.property)}</td>

                            {/* Smart Code */}
                            <td className="px-2 py-2">
                              {(p.master_code != null || p.smart_code != null) ? (
                                <div className="flex flex-col gap-0.5">
                                  {p.master_code != null && (
                                    <span className="font-mono text-[9px] font-bold text-blue-400 tracking-widest leading-tight truncate">{String(p.master_code)}</span>
                                  )}
                                  {p.smart_code != null && (
                                    <span className="font-mono text-[9px] font-bold text-green-400 bg-green-400/10 px-1 py-px rounded leading-tight truncate">{String(p.smart_code)}</span>
                                  )}
                                </div>
                              ) : <span className="text-[#555]">—</span>}
                            </td>

                            {/* Unit */}
                            <td className="px-2 py-2 text-[#888] font-mono truncate">{fmt(p.unit_no)}</td>

                            {/* Zone # — editable */}
                            <td className="px-2 py-2">
                              <NullCell recordId={r.id} field="zone_code" value={p.zone_code} color="#c9a84c" {...cellProps} />
                            </td>

                            {/* Zone — editable */}
                            <td className="px-2 py-2">
                              <NullCell recordId={r.id} field="zone" value={p.zone} color="#6b7280" {...cellProps} />
                            </td>

                            {/* Type — editable (select) */}
                            <td className="px-2 py-2">
                              <NullCell recordId={r.id} field="type" value={p.type} color="#6b7280" {...cellProps} />
                            </td>

                            {/* Config — editable (select) */}
                            <td className="px-2 py-2">
                              <NullCell recordId={r.id} field="config" value={p.config} color="#6b7280" {...cellProps} />
                            </td>

                            {/* Bath — editable */}
                            <td className="px-2 py-2">
                              <NullCell recordId={r.id} field="bathrooms" value={p.bathrooms} color="#6b7280" {...cellProps} />
                            </td>

                            {/* Kitchen — editable (select) */}
                            <td className="px-2 py-2">
                              <NullCell recordId={r.id} field="kitchen" value={p.kitchen} color="#6b7280" {...cellProps} />
                            </td>

                            {/* Parking — editable (Yes/No) */}
                            <td className="px-2 py-2">
                              <NullCell
                                recordId={r.id} field="parking"
                                value={p.parking === true || p.parking === 1 || String(p.parking).toLowerCase() === 'yes' ? 'Yes'
                                     : p.parking === false || p.parking === 0 || String(p.parking).toLowerCase() === 'no' ? 'No'
                                     : p.parking}
                                color="#6b7280" {...cellProps}
                              />
                            </td>

                            {/* Furnishing — editable (select) */}
                            <td className="px-2 py-2">
                              <NullCell recordId={r.id} field="furnishing" value={p.furnishing} color="#6b7280" {...cellProps} />
                            </td>

                            {/* Rent/mo — editable */}
                            <td className="px-2 py-2">
                              <NullCell recordId={r.id} field="rent" value={p.rent} color="#ffffff" {...cellProps} />
                            </td>

                            {/* Status */}
                            <td className="px-2 py-2 text-[#888] truncate">{fmt(p.status)}</td>

                            {/* Source File */}
                            <td className="px-2 py-2 text-[#555] truncate" title={r.source_file ?? ''}>{r.source_file ?? '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <p className="text-[11px] text-[#444]">
                  Clicking <span className="text-[#c9a84c]">Import All</span> will upsert these records into REIMS and acknowledge receipt to Axiom — they will be removed from the vetted queue.
                  {' '}<span className="text-[#333]">Null cells (shown as <span className="text-[#444] font-mono">+</span>) can be filled before import.</span>
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
                    { label: 'Inserted',     value: result.inserted,     color: '#22c55e' },
                    { label: 'Updated',      value: result.updated,      color: '#c9a84c' },
                    { label: 'Acknowledged', value: result.acknowledged, color: '#888'    },
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

      {/* ── Overwrite Warning Modal ───────────────────────────────────────────── */}
      {overwriteWarning && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setOverwriteWarning(null)}
        >
          <div
            className="bg-[#111] border border-[#c9a84c]/30 rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#c9a84c]/10 border border-[#c9a84c]/30 flex items-center justify-center shrink-0 mt-0.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Overwrite existing value?</p>
                <p className="text-[11px] text-[#666] mt-0.5">This field already has data. Changes apply to the import payload only — the source record is not modified.</p>
              </div>
            </div>

            {/* Current value display */}
            <div className="rounded-lg bg-[#0d0d0d] border border-[#1e1e1e] px-3 py-2.5">
              <p className="text-[9px] text-[#555] uppercase tracking-widest mb-1">{overwriteWarning.field}</p>
              <p className="text-xs text-[#c9a84c] font-mono">{fmt(overwriteWarning.originalValue)}</p>
            </div>

            {/* Suggestions */}
            <div className="space-y-1.5">
              <p className="text-[9px] text-[#555] uppercase tracking-widest">Choose how to edit</p>
              <button
                onClick={() => confirmOverwrite('current')}
                className="w-full text-left px-3 py-2 rounded-lg bg-[#1a1a1a] hover:bg-[#c9a84c]/10 border border-[#2a2a2a] hover:border-[#c9a84c]/30 transition-colors group"
              >
                <p className="text-xs font-medium text-white group-hover:text-[#c9a84c] transition-colors">Edit from current value</p>
                <p className="text-[10px] text-[#555] mt-0.5">Pre-fills the editor with the existing value — edit or replace it freely.</p>
              </button>
              <button
                onClick={() => confirmOverwrite('blank')}
                className="w-full text-left px-3 py-2 rounded-lg bg-[#1a1a1a] hover:bg-[#1e1e1e] border border-[#2a2a2a] transition-colors"
              >
                <p className="text-xs font-medium text-[#888]">Start from blank</p>
                <p className="text-[10px] text-[#555] mt-0.5">Clears the field and opens an empty editor.</p>
              </button>
            </div>

            {/* Cancel */}
            <button
              onClick={() => setOverwriteWarning(null)}
              className="w-full text-center text-xs text-[#444] hover:text-[#666] transition-colors pt-1"
            >
              Cancel — keep existing value
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
