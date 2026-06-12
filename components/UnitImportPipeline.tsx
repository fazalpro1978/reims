'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import TopBar from './TopBar';

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = 'upload' | 'identifying' | 'verify' | 'validating' | 'validate' | 'importing' | 'done';

type ExtractedUnit = Record<string, unknown> & {
  unit_code?: string;
  property?: string;
  unit_no?: string;
  zone?: string;
  type?: string;
  config?: string;
  status?: string;
  rent?: number | null;
  furnishing?: string;
  listing_type?: string;
};

type VerifiedUnit = ExtractedUnit & {
  _isUpdate: boolean;
  _existingSnap?: { property: string; status: string; rent: number };
  _errors: string[];
  _warnings: string[];
};

type ImportResult = { inserted: number; updated: number; errors: string[] };

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_TYPE      = new Set(['Apartment','Villa','Townhouse','Penthouse','Studio','Duplex','Office']);
const VALID_FURNISHING = new Set(['Fully Furnished','Semi-Furnished','Unfurnished']);
const VALID_STATUS    = new Set(['Available','Leased','Reserved','Under_Maintenance']);
const VALID_KITCHEN   = new Set(['Open','Closed','Yes','Pantry']);
const VALID_LISTING   = new Set(['Rent','Sale']);

function validateUnit(u: ExtractedUnit): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!u.unit_code)                          errors.push('unit_code missing');
  if (!u.property)                           errors.push('property missing');
  if (!u.unit_no)                            warnings.push('unit_no missing');
  if (u.type  && !VALID_TYPE.has(u.type as string))       errors.push(`invalid type: ${u.type}`);
  if (u.status && !VALID_STATUS.has(u.status as string))  errors.push(`invalid status: ${u.status}`);
  if (u.furnishing && !VALID_FURNISHING.has(u.furnishing as string)) warnings.push(`unknown furnishing: ${u.furnishing}`);
  if (u.kitchen && !VALID_KITCHEN.has(u.kitchen as string))          warnings.push(`unknown kitchen: ${u.kitchen}`);
  if (u.listing_type && !VALID_LISTING.has(u.listing_type as string)) warnings.push(`unknown listing_type: ${u.listing_type}`);
  if (u.rent != null && (isNaN(Number(u.rent)) || Number(u.rent) < 0)) errors.push('rent must be a positive number');

  return { errors, warnings };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StageIndicator({ stage }: { stage: Stage }) {
  const steps = [
    { key: 'upload',     label: '1. Upload'      },
    { key: 'verify',     label: '2. Verification' },
    { key: 'validate',   label: '3. Validation'   },
    { key: 'done',       label: 'Import'          },
  ] as const;

  const order: Record<string, number> = { upload: 0, identifying: 0, verify: 1, validating: 2, validate: 2, importing: 3, done: 3 };
  const current = order[stage] ?? 0;

  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => {
        const done    = current > i;
        const active  = current === i;
        return (
          <React.Fragment key={s.key}>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors ${
              done   ? 'text-[#22c55e]' :
              active ? 'text-[#c9a84c] bg-[#c9a84c]/10' :
                       'text-[#444]'
            }`}>
              {done ? (
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[9px] shrink-0 ${
                  active ? 'border-[#c9a84c] text-[#c9a84c]' : 'border-[#333] text-[#444]'
                }`}>{i + 1}</span>
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

function FieldCell({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-[#333] italic text-[10px]">—</span>;
  }
  return <span className="text-xs text-[#c8c8c8]">{String(value)}</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UnitImportPipeline({ onMenuClick, embedded = false }: { onMenuClick?: () => void; embedded?: boolean }) {
  const [stage, setStage] = useState<Stage>('upload');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Extraction state
  const [fileName, setFileName]     = useState('');
  const [extractError, setExtractError] = useState('');

  // Verified units (after Stage 1 extraction + Stage 2 check)
  const [units, setUnits]           = useState<VerifiedUnit[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  // Import result
  const [result, setResult]         = useState<ImportResult | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setEditingIdx(null); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // ── Stage 1: Upload + Identify ──────────────────────────────────────────────

  async function handleFile(file: File) {
    setFileName(file.name);
    setExtractError('');
    setStage('identifying');

    try {
      const form = new FormData();
      form.append('file', file);

      const res = await fetch('/api/units/extract', { method: 'POST', body: form });
      const json = await res.json();

      if (!res.ok || json.error) {
        setExtractError(json.error ?? 'Extraction failed');
        setStage('upload');
        return;
      }

      const extracted: ExtractedUnit[] = json.units ?? [];
      if (extracted.length === 0) {
        setExtractError('No units could be extracted from this file. Check that it contains property listing data.');
        setStage('upload');
        return;
      }

      // Stage 2: check which unit_codes already exist
      const codes = extracted.map((u) => u.unit_code).filter(Boolean) as string[];
      const checkRes = await fetch('/api/units/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_codes: codes }),
      });
      const { existing = {} } = await checkRes.json();

      const verified: VerifiedUnit[] = extracted.map((u) => {
        const snap = u.unit_code ? existing[u.unit_code as string] : undefined;
        const { errors, warnings } = validateUnit(u);
        return {
          ...u,
          _isUpdate: !!snap,
          _existingSnap: snap,
          _errors: errors,
          _warnings: warnings,
        };
      });

      setUnits(verified);
      setStage('verify');
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Extraction failed');
      setStage('upload');
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  // ── Stage 3: Validate ───────────────────────────────────────────────────────

  function runValidation() {
    setStage('validating');
    // Re-run validation synchronously (no async needed, already done during verify)
    const revalidated = units.map((u) => {
      const { errors, warnings } = validateUnit(u);
      return { ...u, _errors: errors, _warnings: warnings };
    });
    setUnits(revalidated);
    setStage('validate');
  }

  // ── Final import ────────────────────────────────────────────────────────────

  async function runImport() {
    setStage('importing');
    const valid = units.filter((u) => u._errors.length === 0);
    const rows = valid.map(({ _isUpdate, _existingSnap, _errors, _warnings, ...rest }) => rest);

    const res = await fetch('/api/units/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    });
    const json = await res.json();
    setResult(json);
    setStage('done');
  }

  // ── Edit unit inline ────────────────────────────────────────────────────────

  function updateUnit(idx: number, field: string, value: unknown) {
    setUnits((prev) =>
      prev.map((u, i) => {
        if (i !== idx) return u;
        const updated = { ...u, [field]: value };
        const { errors, warnings } = validateUnit(updated);
        return { ...updated, _errors: errors, _warnings: warnings };
      }),
    );
  }

  function removeUnit(idx: number) {
    setUnits((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Computed ────────────────────────────────────────────────────────────────

  const newCount      = units.filter((u) => !u._isUpdate).length;
  const updateCount   = units.filter((u) => u._isUpdate).length;
  const errorCount    = units.filter((u) => u._errors.length > 0).length;
  const warningCount  = units.filter((u) => u._errors.length === 0 && u._warnings.length > 0).length;
  const validCount    = units.filter((u) => u._errors.length === 0).length;

  const KEY_COLS = ['unit_code','property','unit_no','zone','type','config','furnishing','status','rent'] as const;

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
                  <path d="M19 12H5M12 5l-7 7 7 7" />
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

        {/* ── STAGE: UPLOAD ── */}
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
              onClick={() => fileRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                stage === 'identifying'
                  ? 'border-[#c9a84c]/50 bg-[#c9a84c]/5 cursor-default'
                  : dragging
                  ? 'border-[#c9a84c] bg-[#c9a84c]/8'
                  : 'border-[#2a2a2a] hover:border-[#3a3a3a] hover:bg-[#141414]'
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                disabled={stage === 'identifying'}
              />

              {stage === 'identifying' ? (
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <svg className="w-8 h-8 text-[#c9a84c] animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-[#c9a84c]">Extracting data with AI…</p>
                  <p className="text-xs text-[#555]">Reading {fileName}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <svg className="w-10 h-10 text-[#333]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
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
              <p className="text-[#888] font-semibold text-[11px] uppercase tracking-widest mb-2">Accepted sources</p>
              {[
                'Developer availability lists (Excel / PDF)',
                'Broker flyers with mixed marketing + unit tables',
                'WhatsApp screenshots and image exports',
                'Multi-building vacancy sheets with section headers',
                'Side-by-side multi-type table layouts',
                'Unstructured PDF listings with free-form text',
              ].map((t) => (
                <p key={t} className="flex items-start gap-2">
                  <span className="text-[#c9a84c] mt-0.5">·</span>{t}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* ── STAGE: VERIFY ── */}
        {stage === 'verify' && (
          <div className="space-y-5">
            {/* Summary bar */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-base font-bold text-white">
                  Stage 2 — Verification
                </h2>
                <p className="text-xs text-[#555] mt-0.5">
                  Review extracted records. Edit or remove rows before validation.
                </p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#22c55e]" /><span className="text-[#888]">{newCount} new</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#c9a84c]" /><span className="text-[#888]">{updateCount} updates</span>
                  </span>
                  {errorCount > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#ef4444]" /><span className="text-[#888]">{errorCount} errors</span>
                    </span>
                  )}
                </div>
                <button
                  onClick={runValidation}
                  className="px-4 py-2 bg-[#c9a84c] hover:bg-[#dfc070] text-[#0f0f0f] text-xs font-bold rounded-lg transition-colors"
                >
                  Next: Validate →
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-[#1e1e1e] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1e1e1e] bg-[#0d0d0d]">
                      <th className="w-8 px-3 py-2.5 text-[#444]">#</th>
                      <th className="w-20 px-2 py-2.5 text-left text-[10px] font-bold text-[#555] uppercase tracking-widest whitespace-nowrap">Status</th>
                      {KEY_COLS.map((k) => (
                        <th key={k} className="px-2 py-2.5 text-left text-[10px] font-bold text-[#555] uppercase tracking-widest whitespace-nowrap">
                          {k.replace(/_/g, ' ')}
                        </th>
                      ))}
                      <th className="w-16 px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {units.map((u, i) => {
                      const hasError = u._errors.length > 0;
                      const hasWarn  = !hasError && u._warnings.length > 0;
                      return (
                        <tr
                          key={i}
                          className={`border-b border-[#141414] group ${
                            hasError ? 'bg-red-500/5'
                            : hasWarn ? 'bg-amber-500/5'
                            : u._isUpdate ? 'bg-[#c9a84c]/3'
                            : ''
                          }`}
                        >
                          <td className="px-3 py-2 text-[#444] text-center">{i + 1}</td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            {hasError ? (
                              <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-1.5 py-0.5">Error</span>
                            ) : u._isUpdate ? (
                              <span className="text-[9px] font-bold text-[#c9a84c] bg-[#c9a84c]/10 border border-[#c9a84c]/20 rounded-full px-1.5 py-0.5">Update</span>
                            ) : (
                              <span className="text-[9px] font-bold text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-full px-1.5 py-0.5">New</span>
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
                                <FieldCell value={u[k]} />
                              )}
                            </td>
                          ))}
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                              >
                                ×
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Errors detail */}
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

        {/* ── STAGE: VALIDATING ── */}
        {stage === 'validating' && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <svg className="w-8 h-8 text-[#c9a84c] animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
            </svg>
            <p className="text-sm text-[#888]">Running validation checks…</p>
          </div>
        )}

        {/* ── STAGE: VALIDATE ── */}
        {stage === 'validate' && (
          <div className="space-y-5">
            {/* Summary */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-base font-bold text-white">Stage 3 — Validation</h2>
                <p className="text-xs text-[#555] mt-0.5">Data integrity checks complete. Review before final import.</p>
              </div>
              <button
                onClick={runImport}
                disabled={validCount === 0}
                className="px-5 py-2 bg-[#c9a84c] hover:bg-[#dfc070] disabled:opacity-40 disabled:cursor-not-allowed text-[#0f0f0f] text-sm font-bold rounded-lg transition-colors"
              >
                Import {validCount} Records
              </button>
            </div>

            {/* Score cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Ready to Import', count: validCount,   color: '#22c55e' },
                { label: 'New Records',     count: newCount,     color: '#3b82f6' },
                { label: 'Updates',         count: updateCount,  color: '#c9a84c' },
                { label: 'Errors (skipped)',count: errorCount,   color: '#ef4444' },
              ].map((c) => (
                <div key={c.label} className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
                  <p className="text-2xl font-bold" style={{ color: c.color }}>{c.count}</p>
                  <p className="text-[11px] text-[#555] mt-0.5">{c.label}</p>
                </div>
              ))}
            </div>

            {/* Per-row validation table */}
            {(errorCount > 0 || warningCount > 0) && (
              <div className="rounded-xl border border-[#1e1e1e] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#1e1e1e] bg-[#0d0d0d]">
                  <p className="text-xs font-bold text-[#888] uppercase tracking-widest">Validation Report</p>
                </div>
                <div className="divide-y divide-[#141414]">
                  {units
                    .filter((u) => u._errors.length > 0 || u._warnings.length > 0)
                    .map((u, i) => (
                      <div key={i} className="px-4 py-3 flex items-start gap-3">
                        <span className="font-mono text-xs text-white w-28 shrink-0 pt-0.5">
                          {String(u.unit_code ?? `Row ${i + 1}`)}
                        </span>
                        <div className="space-y-1 flex-1 min-w-0">
                          {u._errors.map((e, j) => (
                            <p key={j} className="text-xs text-red-400 flex items-center gap-1.5">
                              <span className="text-red-500">✕</span>{e}
                            </p>
                          ))}
                          {u._warnings.map((w, j) => (
                            <p key={j} className="text-xs text-amber-400 flex items-center gap-1.5">
                              <span className="text-amber-500">⚠</span>{w}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {errorCount === 0 && warningCount === 0 && (
              <div className="rounded-xl border border-[#22c55e]/20 bg-[#22c55e]/5 px-4 py-3 text-sm text-[#22c55e]">
                All {validCount} records passed validation. Ready to import.
              </div>
            )}
          </div>
        )}

        {/* ── STAGE: IMPORTING ── */}
        {stage === 'importing' && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <svg className="w-8 h-8 text-[#c9a84c] animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
            </svg>
            <p className="text-sm text-[#888]">Writing to database…</p>
          </div>
        )}

        {/* ── STAGE: DONE ── */}
        {stage === 'done' && result && (
          <div className="max-w-lg mx-auto space-y-6 pt-8">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/30 flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-[#22c55e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white">Import Complete</h2>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Inserted',  count: result.inserted, color: '#22c55e' },
                { label: 'Updated',   count: result.updated,  color: '#c9a84c' },
                { label: 'Errors',    count: result.errors.length, color: result.errors.length > 0 ? '#ef4444' : '#555' },
              ].map((c) => (
                <div key={c.label} className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4 text-center">
                  <p className="text-2xl font-bold" style={{ color: c.color }}>{c.count}</p>
                  <p className="text-[11px] text-[#555] mt-0.5">{c.label}</p>
                </div>
              ))}
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-1">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-400">{e}</p>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <Link
                href="/"
                className="flex-1 text-center py-2.5 bg-[#c9a84c] hover:bg-[#dfc070] text-[#0f0f0f] text-sm font-bold rounded-lg transition-colors"
              >
                View Inventory
              </Link>
              <button
                onClick={() => {
                  setStage('upload');
                  setUnits([]);
                  setResult(null);
                  setFileName('');
                  setExtractError('');
                }}
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
