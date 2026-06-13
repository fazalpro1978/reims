'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import TopBar from './TopBar';

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = 'upload' | 'identifying' | 'verify' | 'validating' | 'validate' | 'importing' | 'done';
type RowAction = 'new' | 'update' | 'conflict';

type ConflictField = { existing: unknown; incoming: unknown };

type VerifiedUnit = Record<string, unknown> & {
  _rowIndex:           number;
  _unitId:             string | null;
  _action:             RowAction;
  _matchType:          string;
  _matchConfidence:    number;
  _conflictFields:     Record<string, ConflictField> | null;
  _conflictResolved:   Record<string, unknown>;   // user choices for conflict fields
  _errors:             string[];
  _warnings:           string[];
  _existingSnap:       { status: string; rent: number; furnishing: string } | null;
};

type ImportResult = { inserted: number; updated: number; errors: string[] };

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_TYPE       = new Set(['Apartment','Villa','Townhouse','Penthouse','Studio','Duplex','Office']);
const VALID_FURNISHING = new Set(['Fully Furnished','Semi-Furnished','Unfurnished']);
const VALID_STATUS     = new Set(['Available','Leased','Reserved','Under_Maintenance']);
const VALID_KITCHEN    = new Set(['Open','Closed','Yes','Pantry']);
const VALID_LISTING    = new Set(['Rent','Sale']);

function validateUnit(u: VerifiedUnit): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!u.unit_code)  errors.push('unit_code missing');
  if (!u.property)   errors.push('property missing');
  if (!u.unit_no)    warnings.push('unit_no missing');
  if (u.type      && !VALID_TYPE.has(u.type as string))       errors.push(`invalid type: ${u.type}`);
  if (u.status    && !VALID_STATUS.has(u.status as string))   errors.push(`invalid status: ${u.status}`);
  if (u.furnishing && !VALID_FURNISHING.has(u.furnishing as string)) warnings.push(`unknown furnishing: ${u.furnishing}`);
  if (u.kitchen   && !VALID_KITCHEN.has(u.kitchen as string))        warnings.push(`unknown kitchen: ${u.kitchen}`);
  if (u.listing_type && !VALID_LISTING.has(u.listing_type as string)) warnings.push(`unknown listing_type: ${u.listing_type}`);
  if (u.rent != null && (isNaN(Number(u.rent)) || Number(u.rent) < 0)) errors.push('rent must be positive');
  return { errors, warnings };
}

// ─── Stage indicator ──────────────────────────────────────────────────────────

function StageIndicator({ stage }: { stage: Stage }) {
  const steps = [
    { key: 'upload',   label: '1. Upload'      },
    { key: 'verify',   label: '2. Verification' },
    { key: 'validate', label: '3. Validation'   },
    { key: 'done',     label: 'Import'          },
  ] as const;
  const order: Record<string, number> = {
    upload: 0, identifying: 0, verify: 1, validating: 2, validate: 2, importing: 3, done: 3,
  };
  const current = order[stage] ?? 0;
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => {
        const done   = current > i;
        const active = current === i;
        return (
          <React.Fragment key={s.key}>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors ${
              done ? 'text-[#22c55e]' : active ? 'text-[#c9a84c] bg-[#c9a84c]/10' : 'text-[#444]'
            }`}>
              {done ? (
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              ) : (
                <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[9px] shrink-0 ${active ? 'border-[#c9a84c] text-[#c9a84c]' : 'border-[#333] text-[#444]'}`}>{i + 1}</span>
              )}
              {s.label}
            </div>
            {i < steps.length - 1 && (
              <div className={`w-6 h-px shrink-0 ${current > i ? 'bg-[#22c55e]/50' : 'bg-[#2a2a2a]'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <svg className="w-8 h-8 text-[#c9a84c] animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
      </svg>
      <p className="text-sm text-[#888]">{label}</p>
    </div>
  );
}

// ─── Conflict resolution cell ─────────────────────────────────────────────────

function ConflictResolver({
  field, conflict, resolved, onResolve,
}: {
  field: string;
  conflict: ConflictField;
  resolved: unknown;
  onResolve: (val: unknown) => void;
}) {
  const isExisting = resolved === conflict.existing;
  const isIncoming = resolved === conflict.incoming;
  return (
    <div className="mt-1.5 rounded-lg border border-[#a855f7]/20 bg-[#a855f7]/5 p-2 space-y-1.5">
      <p className="text-[9px] font-bold text-[#a855f7] uppercase tracking-widest">{field.replace(/_/g, ' ')} — choose value</p>
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => onResolve(conflict.existing)}
          className={`flex-1 min-w-0 px-2 py-1.5 rounded-md text-[10px] font-semibold border transition-all text-left ${
            isExisting ? 'bg-[#22c55e]/15 border-[#22c55e]/40 text-[#22c55e]' : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#888] hover:border-[#3a3a3a] hover:text-[#e0e0e0]'
          }`}
        >
          <span className="text-[8px] block mb-0.5 opacity-70">KEEP EXISTING</span>
          {String(conflict.existing ?? '—')}
        </button>
        <button
          onClick={() => onResolve(conflict.incoming)}
          className={`flex-1 min-w-0 px-2 py-1.5 rounded-md text-[10px] font-semibold border transition-all text-left ${
            isIncoming ? 'bg-[#c9a84c]/15 border-[#c9a84c]/40 text-[#c9a84c]' : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#888] hover:border-[#3a3a3a] hover:text-[#e0e0e0]'
          }`}
        >
          <span className="text-[8px] block mb-0.5 opacity-70">ACCEPT INCOMING</span>
          {String(conflict.incoming ?? '—')}
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function UnitImportPipeline({
  onMenuClick,
  embedded = false,
}: {
  onMenuClick?: () => void;
  embedded?: boolean;
}) {
  const [stage, setStage]           = useState<Stage>('upload');
  const [dragging, setDragging]     = useState(false);
  const [fileName, setFileName]     = useState('');
  const [fileHash, setFileHash]     = useState('');
  const [extractError, setExtractError] = useState('');
  const [units, setUnits]           = useState<VerifiedUnit[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [result, setResult]         = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setExpandedIdx(null); setEditingIdx(null); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // ── File → extract → match ──────────────────────────────────────────────────

  async function handleFile(file: File) {
    setFileName(file.name);
    setExtractError('');
    setStage('identifying');

    try {
      // Compute hash for duplicate-upload detection
      const bytes = await file.arrayBuffer();
      const hashBuf = await crypto.subtle.digest('SHA-256', bytes);
      const hash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, '0')).join('');
      setFileHash(hash);

      // Stage 1: Claude extraction
      const form = new FormData();
      form.append('file', file);
      const extRes = await fetch('/api/units/extract', { method: 'POST', body: form });
      const extJson = await extRes.json();

      if (!extRes.ok || extJson.error) {
        setExtractError(extJson.error ?? 'Extraction failed'); setStage('upload'); return;
      }

      const extracted: Record<string, unknown>[] = extJson.units ?? [];
      if (extracted.length === 0) {
        setExtractError('No units found in this file.'); setStage('upload'); return;
      }

      // Stage 2: Match against existing inventory
      const matchRes = await fetch('/api/units/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: extracted }),
      });
      const matchJson = await matchRes.json();
      const matchResults: Array<{
        rowIndex: number; unitId: string | null; matchType: string; matchConfidence: number;
        rawData: Record<string, unknown>; resolvedData: Record<string, unknown>;
        action: RowAction; conflictFields: Record<string, ConflictField> | null;
        existingSnapshot: { status: string; rent: number; furnishing: string } | null;
      }> = matchJson.results ?? [];

      const verified: VerifiedUnit[] = matchResults.map((m) => {
        const unit: VerifiedUnit = {
          ...m.resolvedData,
          _rowIndex:         m.rowIndex,
          _unitId:           m.unitId,
          _action:           m.action,
          _matchType:        m.matchType,
          _matchConfidence:  m.matchConfidence,
          _conflictFields:   m.conflictFields,
          _conflictResolved: {},
          _errors:           [],
          _warnings:         [],
          _existingSnap:     m.existingSnapshot,
        };
        const { errors, warnings } = validateUnit(unit);
        unit._errors   = errors;
        unit._warnings = warnings;
        return unit;
      });

      setUnits(verified);
      setStage('verify');
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Extraction failed');
      setStage('upload');
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  // ── Unit editing ────────────────────────────────────────────────────────────

  function updateUnit(idx: number, field: string, value: unknown) {
    setUnits((prev) => prev.map((u, i) => {
      if (i !== idx) return u;
      const updated = { ...u, [field]: value };
      const { errors, warnings } = validateUnit(updated as VerifiedUnit);
      return { ...updated, _errors: errors, _warnings: warnings } as VerifiedUnit;
    }));
  }

  function resolveConflict(idx: number, field: string, value: unknown) {
    setUnits((prev) => prev.map((u, i) => {
      if (i !== idx) return u;
      const newResolved = { ...u._conflictResolved, [field]: value };
      const allResolved = u._conflictFields
        ? Object.keys(u._conflictFields).every((f) => f in newResolved)
        : true;
      return { ...u, _conflictResolved: newResolved, _action: allResolved ? 'update' : 'conflict' } as VerifiedUnit;
    }));
  }

  function removeUnit(idx: number) {
    setUnits((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Import ──────────────────────────────────────────────────────────────────

  async function runImport() {
    setStage('importing');
    const validUnits = units.filter((u) => u._errors.length === 0);

    const rows = validUnits.map(({ _rowIndex, _unitId, _action, _matchType, _matchConfidence,
      _conflictFields, _conflictResolved, _errors, _warnings, _existingSnap, ...rest }) => ({
      resolvedData:        rest,
      unitId:              _unitId,
      action:              _action === 'conflict' ? 'update' : _action,
      conflictResolutions: _conflictResolved,
    }));

    const res = await fetch('/api/units/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, sourceFile: fileName }),
    });
    const json = await res.json();
    setResult(json);
    setStage('done');
  }

  // ── Computed ────────────────────────────────────────────────────────────────

  const newCount      = units.filter((u) => u._action === 'new').length;
  const updateCount   = units.filter((u) => u._action === 'update').length;
  const conflictCount = units.filter((u) => u._action === 'conflict').length;
  const errorCount    = units.filter((u) => u._errors.length > 0).length;
  const validCount    = units.filter((u) => u._errors.length === 0).length;
  const unresolvedConflicts = units.filter((u) => u._action === 'conflict').length;

  const KEY_COLS = ['unit_code','property','unit_no','zone','type','config','furnishing','status','rent'] as const;

  const canProceedToValidate = unresolvedConflicts === 0;
  const canImport = validCount > 0;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={embedded ? '' : 'min-h-screen bg-[#0f0f0f]'}>
      {!embedded && <TopBar onMenuClick={onMenuClick} />}

      {/* Sub-header */}
      <div className={`${embedded ? '' : 'sticky top-[61px] z-40'} bg-[#0f0f0f]/95 backdrop-blur border-b border-[#1a1a1a]`}>
        <div className="max-w-screen-xl mx-auto px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {!embedded && (
              <Link href="/" className="text-[#555] hover:text-[#c9a84c] transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-4 h-4">
                  <path d="M19 12H5M12 5l-7 7 7 7"/>
                </svg>
              </Link>
            )}
            <div>
              <h1 className="text-sm font-bold text-white">Property Data Ingestion</h1>
              {fileName && <p className="text-[10px] text-[#555]">{fileName}</p>}
            </div>
          </div>
          <StageIndicator stage={stage} />
        </div>
      </div>

      <main className="max-w-screen-xl mx-auto px-5 py-8">

        {/* ── UPLOAD ── */}
        {(stage === 'upload' || stage === 'identifying') && (
          <div className="max-w-lg mx-auto space-y-4">
            <div>
              <h2 className="text-lg font-bold text-white">Import Property Data</h2>
              <p className="text-sm text-[#555] mt-1">
                Drop any file — Excel, PDF, image, or screenshot. Claude reads the structure automatically.
              </p>
            </div>

            {extractError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {extractError}
              </div>
            )}

            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => stage !== 'identifying' && fileRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                stage === 'identifying' ? 'border-[#c9a84c]/50 bg-[#c9a84c]/5 cursor-default'
                : dragging ? 'border-[#c9a84c] bg-[#c9a84c]/8'
                : 'border-[#2a2a2a] hover:border-[#3a3a3a] hover:bg-[#141414]'
              }`}
            >
              <input ref={fileRef} type="file" className="hidden"
                accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                disabled={stage === 'identifying'} />
              {stage === 'identifying' ? (
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <svg className="w-8 h-8 text-[#c9a84c] animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-[#c9a84c]">Extracting &amp; matching records…</p>
                  <p className="text-xs text-[#555]">{fileName}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <svg className="w-10 h-10 text-[#333]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#e0e0e0]">Drop file here or click to browse</p>
                    <p className="text-xs text-[#444] mt-1">Excel · PDF · JPG · PNG · WebP</p>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl bg-[#141414] border border-[#1e1e1e] p-4 space-y-1.5 text-xs text-[#555]">
              <p className="text-[#888] font-semibold text-[11px] uppercase tracking-widest mb-2">Handles any format</p>
              {[
                'Developer availability lists (Excel / PDF)',
                'Broker flyers with mixed marketing + unit tables',
                'WhatsApp screenshots and image exports',
                'Multi-building sheets with section headers and merged cells',
                'Automatically identifies new records vs updates to existing units',
                'Detects conflicts and flags them for your review before writing',
              ].map((t) => (
                <p key={t} className="flex items-start gap-2"><span className="text-[#c9a84c] mt-0.5">·</span>{t}</p>
              ))}
            </div>
          </div>
        )}

        {/* ── VERIFY ── */}
        {stage === 'verify' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-base font-bold text-white">Stage 2 — Verification</h2>
                <p className="text-xs text-[#555] mt-0.5">
                  Review extracted records. Resolve all conflicts before proceeding.
                </p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#22c55e]"/><span className="text-[#888]">{newCount} new</span></span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#c9a84c]"/><span className="text-[#888]">{updateCount} updates</span></span>
                  {conflictCount > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#a855f7]"/><span className="text-[#888]">{conflictCount} conflicts</span></span>}
                  {errorCount > 0    && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#ef4444]"/><span className="text-[#888]">{errorCount} errors</span></span>}
                </div>
                <button
                  onClick={() => { setStage('validating'); setTimeout(() => setStage('validate'), 300); }}
                  disabled={!canProceedToValidate}
                  title={!canProceedToValidate ? 'Resolve all conflicts first' : undefined}
                  className="px-4 py-2 bg-[#c9a84c] hover:bg-[#dfc070] disabled:opacity-40 disabled:cursor-not-allowed text-[#0f0f0f] text-xs font-bold rounded-lg transition-colors"
                >
                  Next: Validate →
                </button>
              </div>
            </div>

            {unresolvedConflicts > 0 && (
              <div className="rounded-xl border border-[#a855f7]/25 bg-[#a855f7]/8 px-4 py-3 text-xs text-[#a855f7]">
                <strong>{unresolvedConflicts} conflict{unresolvedConflicts > 1 ? 's' : ''}</strong> must be resolved before you can continue.
                Expand each conflict row (▸) and choose which value to keep.
              </div>
            )}

            <div className="rounded-xl border border-[#1e1e1e] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1e1e1e] bg-[#0d0d0d]">
                      <th className="w-8 px-3 py-2.5 text-[#444]">#</th>
                      <th className="w-24 px-2 py-2.5 text-left text-[10px] font-bold text-[#555] uppercase tracking-widest whitespace-nowrap">Status</th>
                      {KEY_COLS.map((k) => (
                        <th key={k} className="px-2 py-2.5 text-left text-[10px] font-bold text-[#555] uppercase tracking-widest whitespace-nowrap">
                          {k.replace(/_/g, ' ')}
                        </th>
                      ))}
                      <th className="w-16 px-2 py-2.5"/>
                    </tr>
                  </thead>
                  <tbody>
                    {units.map((u, i) => {
                      const hasError    = u._errors.length > 0;
                      const isConflict  = u._action === 'conflict';
                      const isExpanded  = expandedIdx === i;

                      const rowBg = hasError ? 'bg-red-500/5'
                        : isConflict ? 'bg-[#a855f7]/5'
                        : u._action === 'update' ? 'bg-[#c9a84c]/3'
                        : '';

                      return (
                        <React.Fragment key={i}>
                          <tr className={`border-b border-[#141414] group ${rowBg} ${isExpanded ? 'border-b-0' : ''}`}>
                            <td className="px-3 py-2 text-[#444] text-center">{i + 1}</td>
                            <td className="px-2 py-2 whitespace-nowrap">
                              {hasError ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-1.5 py-0.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-400"/>Error
                                </span>
                              ) : isConflict ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#a855f7] bg-[#a855f7]/10 border border-[#a855f7]/20 rounded-full px-1.5 py-0.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7]"/>Conflict
                                </span>
                              ) : u._action === 'update' ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#c9a84c] bg-[#c9a84c]/10 border border-[#c9a84c]/20 rounded-full px-1.5 py-0.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#c9a84c]"/>Update
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-full px-1.5 py-0.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]"/>New
                                </span>
                              )}
                            </td>
                            {KEY_COLS.map((k) => (
                              <td key={k} className="px-2 py-2 max-w-[140px]">
                                {editingIdx === i ? (
                                  <input
                                    className="w-full bg-[#1a1a1a] border border-[#333] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-[#c9a84c]"
                                    value={u[k] != null ? String(u[k]) : ''}
                                    onChange={(e) => updateUnit(i, k, e.target.value)}
                                  />
                                ) : (
                                  <span className={`text-xs ${u[k] ? 'text-[#c8c8c8]' : 'text-[#333] italic'}`}>
                                    {u[k] != null && u[k] !== '' ? String(u[k]) : '—'}
                                  </span>
                                )}
                              </td>
                            ))}
                            <td className="px-2 py-2">
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {isConflict && (
                                  <button
                                    onClick={() => setExpandedIdx(isExpanded ? null : i)}
                                    className="w-6 h-6 rounded flex items-center justify-center text-[#a855f7] hover:bg-[#a855f7]/10 transition-colors text-[11px]"
                                    title="Resolve conflicts"
                                  >
                                    {isExpanded ? '▾' : '▸'}
                                  </button>
                                )}
                                <button
                                  onClick={() => setEditingIdx(editingIdx === i ? null : i)}
                                  className="w-6 h-6 rounded flex items-center justify-center text-[#555] hover:text-[#c9a84c] hover:bg-[#c9a84c]/10 transition-colors"
                                  title={editingIdx === i ? 'Done' : 'Edit'}
                                >
                                  {editingIdx === i ? '✓' : '✎'}
                                </button>
                                <button
                                  onClick={() => removeUnit(i)}
                                  className="w-6 h-6 rounded flex items-center justify-center text-[#555] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                  title="Remove"
                                >×</button>
                              </div>
                            </td>
                          </tr>

                          {/* Conflict resolution panel */}
                          {isExpanded && isConflict && u._conflictFields && (
                            <tr className={`border-b border-[#141414] ${rowBg}`}>
                              <td colSpan={KEY_COLS.length + 3} className="px-4 pb-3 pt-0">
                                <div className="space-y-2">
                                  <p className="text-[10px] font-bold text-[#a855f7] uppercase tracking-widest pt-2">
                                    Conflicts — existing inventory vs incoming file
                                  </p>
                                  {Object.entries(u._conflictFields).map(([field, cf]) => (
                                    <ConflictResolver
                                      key={field}
                                      field={field}
                                      conflict={cf}
                                      resolved={u._conflictResolved[field] ?? cf.existing}
                                      onResolve={(val) => resolveConflict(i, field, val)}
                                    />
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {errorCount > 0 && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-1.5">
                <p className="text-xs font-bold text-red-400 mb-2">Rows with errors (will be skipped unless fixed):</p>
                {units.filter((u) => u._errors.length > 0).map((u, i) => (
                  <p key={i} className="text-xs text-[#888]">
                    <span className="text-white font-mono">{String(u.unit_code ?? `Row ${i + 1}`)}</span>
                    {' — '}{u._errors.join(' · ')}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {stage === 'validating' && <Spinner label="Running validation checks…" />}

        {/* ── VALIDATE ── */}
        {stage === 'validate' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-base font-bold text-white">Stage 3 — Validation</h2>
                <p className="text-xs text-[#555] mt-0.5">Data integrity checks complete.</p>
              </div>
              <button onClick={runImport} disabled={!canImport}
                className="px-5 py-2 bg-[#c9a84c] hover:bg-[#dfc070] disabled:opacity-40 disabled:cursor-not-allowed text-[#0f0f0f] text-sm font-bold rounded-lg transition-colors">
                Import {validCount} Records
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Ready to Import', count: validCount,   color: '#22c55e' },
                { label: 'New Records',     count: newCount,     color: '#3b82f6' },
                { label: 'Updates',         count: updateCount,  color: '#c9a84c' },
                { label: 'Errors (skipped)',count: errorCount,   color: errorCount > 0 ? '#ef4444' : '#555' },
              ].map((c) => (
                <div key={c.label} className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
                  <p className="text-2xl font-bold" style={{ color: c.color }}>{c.count}</p>
                  <p className="text-[11px] text-[#555] mt-0.5">{c.label}</p>
                </div>
              ))}
            </div>

            {(errorCount > 0 || units.some((u) => u._warnings.length > 0)) && (
              <div className="rounded-xl border border-[#1e1e1e] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#1e1e1e] bg-[#0d0d0d]">
                  <p className="text-xs font-bold text-[#888] uppercase tracking-widest">Validation Report</p>
                </div>
                <div className="divide-y divide-[#141414]">
                  {units.filter((u) => u._errors.length > 0 || u._warnings.length > 0).map((u, i) => (
                    <div key={i} className="px-4 py-3 flex items-start gap-3">
                      <span className="font-mono text-xs text-white w-28 shrink-0 pt-0.5">
                        {String(u.unit_code ?? `Row ${i + 1}`)}
                      </span>
                      <div className="space-y-1 flex-1 min-w-0">
                        {u._errors.map((e, j) => (
                          <p key={j} className="text-xs text-red-400 flex items-center gap-1.5">
                            <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>{e}
                          </p>
                        ))}
                        {u._warnings.map((w, j) => (
                          <p key={j} className="text-xs text-amber-400 flex items-center gap-1.5">
                            <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 9v4M12 17h.01"/></svg>{w}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {errorCount === 0 && !units.some((u) => u._warnings.length > 0) && (
              <div className="rounded-xl border border-[#22c55e]/20 bg-[#22c55e]/5 px-4 py-3 text-sm text-[#22c55e]">
                All {validCount} records passed validation. Ready to import.
              </div>
            )}
          </div>
        )}

        {stage === 'importing' && <Spinner label="Writing to database…" />}

        {/* ── DONE ── */}
        {stage === 'done' && result && (
          <div className="max-w-lg mx-auto space-y-6 pt-8">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/30 flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-[#22c55e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <h2 className="text-xl font-bold text-white">Import Complete</h2>
              <p className="text-xs text-[#555]">Version snapshots and field-level change log recorded.</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Inserted', count: result.inserted, color: '#22c55e' },
                { label: 'Updated',  count: result.updated,  color: '#c9a84c' },
                { label: 'Errors',   count: result.errors.length, color: result.errors.length > 0 ? '#ef4444' : '#555' },
              ].map((c) => (
                <div key={c.label} className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4 text-center">
                  <p className="text-2xl font-bold" style={{ color: c.color }}>{c.count}</p>
                  <p className="text-[11px] text-[#555] mt-0.5">{c.label}</p>
                </div>
              ))}
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-1">
                {result.errors.map((e, i) => <p key={i} className="text-xs text-red-400">{e}</p>)}
              </div>
            )}

            <div className="flex gap-3">
              <Link href="/" className="flex-1 text-center py-2.5 bg-[#c9a84c] hover:bg-[#dfc070] text-[#0f0f0f] text-sm font-bold rounded-lg transition-colors">
                View Inventory
              </Link>
              <button
                onClick={() => { setStage('upload'); setUnits([]); setResult(null); setFileName(''); setExtractError(''); setFileHash(''); }}
                className="flex-1 py-2.5 bg-[#1a1a1a] hover:bg-[#252525] text-[#888] hover:text-white text-sm font-bold rounded-lg border border-[#2a2a2a] transition-colors"
              >
                Import Another File
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
