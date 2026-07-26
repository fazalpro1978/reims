'use client';
import React, { useState, useRef, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { MASTER_FIELDS, BATCH_FIELDS, suggestMapping } from '@/lib/importSchema';

export type MappedPayload = {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
  mapping: Record<string, string | null>;
  batch: Record<string, string>;
};

function sheetTo2D(buf: ArrayBuffer): string[][] {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true, raw: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
  return rows.map((r) => (r as unknown[]).map((c) => (c === null || c === undefined ? '' : String(c).trim())));
}

function guessHeaderRow(grid: string[][]): number {
  let best = 0;
  let bestNonEmpty = -1;
  for (let i = 0; i < Math.min(grid.length, 30); i++) {
    const nonEmpty = grid[i].filter((c) => c !== '').length;
    if (nonEmpty > bestNonEmpty) { bestNonEmpty = nonEmpty; best = i; }
  }
  return best;
}

export default function UnitImportMapper({ onMapped }: { onMapped: (payload: MappedPayload) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging]   = useState(false);
  const [fileName, setFileName]   = useState('');
  const [grid, setGrid]           = useState<string[][] | null>(null);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping]     = useState<Record<string, string | null>>({});
  const [batch, setBatch]         = useState<Record<string, string>>({});
  const [parseError, setParseError] = useState('');

  async function handleFile(file: File) {
    setParseError('');
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const g = sheetTo2D(buf);
      if (g.length === 0) { setParseError('File appears to be empty.'); return; }
      const hRow = guessHeaderRow(g);
      setGrid(g);
      setHeaderRow(hRow);
      const headers = g[hRow].map((h, i) => h || `Column ${i + 1}`);
      setMapping(suggestMapping(headers));
      setBatch({});
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Could not read this file.');
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const headers = useMemo(() => {
    if (!grid) return [];
    return grid[headerRow].map((h, i) => h || `Column ${i + 1}`);
  }, [grid, headerRow]);

  const dataRows = useMemo(() => {
    if (!grid) return [];
    return grid
      .slice(headerRow + 1)
      .filter((r) => r.some((c) => c !== ''))
      .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
  }, [grid, headerRow, headers]);

  function sampleFor(header: string): string {
    for (const row of dataRows) {
      if (row[header] && row[header] !== '') return row[header];
      if (dataRows.indexOf(row) > 20) break;
    }
    return '—';
  }

  const requiredUnmapped = MASTER_FIELDS.filter((f) => f.required && !mapping[f.key]).length;
  const batchMissing     = BATCH_FIELDS.filter((f) => !batch[f.key]?.trim()).length;

  function proceed() {
    if (!grid) return;
    onMapped({ fileName, headers, rows: dataRows, mapping, batch });
  }

  // ── Upload state ──────────────────────────────────────────────────────────

  if (!grid) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white">Structured Import — Mapping</h2>
          <p className="text-sm text-[#555] mt-1">
            Drop a CSV or Excel file. You&apos;ll match its columns to the master schema yourself — nothing is guessed.
          </p>
        </div>

        <a
          href="/api/units/template"
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg border border-[#2a2a2a] text-sm text-[#c9a84c] hover:border-[#c9a84c] hover:bg-[#c9a84c]/5 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download Schema Template
        </a>

        {parseError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{parseError}</div>
        )}

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
            dragging ? 'border-[#c9a84c] bg-[#c9a84c]/8' : 'border-[#2a2a2a] hover:border-[#3a3a3a] hover:bg-[#141414]'
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <div className="space-y-3">
            <div className="flex justify-center">
              <svg className="w-10 h-10 text-[#333]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-[#e0e0e0]">Drop file here or click to browse</p>
              <p className="text-xs text-[#444] mt-1">CSV · XLSX · XLS</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Header-row selection + mapping state ────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-white">Stage 1 — Mapping</h2>
          <p className="text-xs text-[#555] mt-0.5">{fileName} · {dataRows.length} data row(s) detected</p>
        </div>
        <button
          onClick={() => { setGrid(null); setMapping({}); setBatch({}); }}
          className="text-xs text-[#666] hover:text-[#c9a84c] transition-colors"
        >
          ← Choose a different file
        </button>
      </div>

      {/* Header row picker */}
      <div className="rounded-xl border border-[#1e1e1e] overflow-hidden">
        <div className="px-4 py-2.5 bg-[#141414] border-b border-[#1e1e1e]">
          <p className="text-xs font-bold text-[#888] uppercase tracking-widest">Select Header Row</p>
          <p className="text-[11px] text-[#555] mt-0.5">Click the row that contains your column titles. Everything below it is treated as data.</p>
        </div>
        <div className="max-h-56 overflow-y-auto">
          {grid.slice(0, 30).map((row, i) => (
            <button
              key={i}
              onClick={() => { setHeaderRow(i); setMapping(suggestMapping(row.map((h, j) => h || `Column ${j + 1}`))); }}
              className={`w-full text-left px-4 py-1.5 text-[11px] font-mono border-b border-[#161616] truncate transition-colors ${
                i === headerRow ? 'bg-[#c9a84c]/10 text-[#c9a84c]' : 'text-[#666] hover:bg-[#141414] hover:text-[#999]'
              }`}
            >
              <span className="text-[#444] mr-2">R{i + 1}</span>{row.filter(Boolean).join(' | ') || '(blank row)'}
            </button>
          ))}
        </div>
      </div>

      {/* Match & Review */}
      <div className="rounded-xl border border-[#1e1e1e] overflow-hidden">
        <div className="px-4 py-2.5 bg-[#141414] border-b border-[#1e1e1e] flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#888] uppercase tracking-widest">Match &amp; Review</p>
            <p className="text-[11px] text-[#555] mt-0.5">Map each master field to a source column, or leave it unmapped — unmapped fields become null, never a guess.</p>
          </div>
          {requiredUnmapped > 0 && (
            <span className="text-[11px] text-amber-400 shrink-0">{requiredUnmapped} required field(s) unmapped</span>
          )}
        </div>
        <div className="divide-y divide-[#161616]">
          {MASTER_FIELDS.map((f) => (
            <div key={f.key} className="grid grid-cols-[1fr_1fr_1fr] gap-4 px-4 py-3 items-center">
              <div>
                <p className="text-sm text-[#e0e0e0]">
                  {f.label} {f.required && <span className="text-red-400 text-xs">*</span>}
                </p>
                <p className="text-[10px] text-[#555] font-mono">{f.key}{f.enumValues ? ` · enum` : ''}</p>
              </div>
              <select
                value={mapping[f.key] ?? ''}
                onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value || null }))}
                className="bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2.5 py-1.5 text-xs text-[#e0e0e0] focus:outline-none focus:border-[#c9a84c]"
              >
                <option value="">— Not mapped (null) —</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              <span className="text-xs text-[#666] truncate">
                {mapping[f.key] ? `e.g. "${sampleFor(mapping[f.key]!)}"` : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Batch fields */}
      <div className="rounded-xl border border-[#1e1e1e] overflow-hidden">
        <div className="px-4 py-2.5 bg-[#141414] border-b border-[#1e1e1e]">
          <p className="text-xs font-bold text-[#888] uppercase tracking-widest">Batch Details</p>
          <p className="text-[11px] text-[#555] mt-0.5">Required fields not present in the master schema — applied to every row, overridable per-row in Validation.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 p-4">
          {BATCH_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="text-[11px] text-[#888]">{f.label} <span className="text-red-400">*</span></label>
              {f.enumValues ? (
                <select
                  value={batch[f.key] ?? ''}
                  onChange={(e) => setBatch((b) => ({ ...b, [f.key]: e.target.value }))}
                  className="w-full mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2.5 py-1.5 text-xs text-[#e0e0e0] focus:outline-none focus:border-[#c9a84c]"
                >
                  <option value="">—</option>
                  {f.enumValues.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              ) : (
                <input
                  value={batch[f.key] ?? ''}
                  onChange={(e) => setBatch((b) => ({ ...b, [f.key]: e.target.value }))}
                  className="w-full mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2.5 py-1.5 text-xs text-[#e0e0e0] focus:outline-none focus:border-[#c9a84c]"
                  placeholder={f.label}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-[#555]">
          {requiredUnmapped + batchMissing > 0
            ? `${requiredUnmapped + batchMissing} field(s) still need attention — they'll surface as row-level errors in Validation.`
            : 'All required fields are accounted for.'}
        </p>
        <button
          onClick={proceed}
          className="px-4 py-2 bg-[#c9a84c] hover:bg-[#dfc070] text-[#0f0f0f] text-xs font-bold rounded-lg transition-colors"
        >
          Next: Validate Mapping →
        </button>
      </div>
    </div>
  );
}
