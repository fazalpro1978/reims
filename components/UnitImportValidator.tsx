'use client';
import React, { useEffect, useState } from 'react';
import { authedFetch } from '../lib/authedFetch';
import {
  MASTER_FIELDS, BATCH_FIELDS, castAndValidateField, slugifyProperty, toDbRow,
} from '@/lib/importSchema';
import { StageIndicator, FieldCell, ImportDoneScreen, type ImportResult } from './ImportShared';
import type { MappedPayload } from './UnitImportMapper';

const ALL_FIELDS = [...MASTER_FIELDS, ...BATCH_FIELDS];

const DISPLAY_COLS = [
  'unit_code', 'realtor_moci_id', 'property', 'property_unit_no', 'zone_number', 'zone',
  'property_type', 'property_subtype', 'furnishing_status', 'rent_qar_monthly', 'status',
  'bathrooms', 'kitchen', 'realtor_name',
] as const;

type ValidatedRow = {
  raw: Record<string, string>;
  cast: Record<string, unknown>;
  zone: string | null;
  unit_code: string | null;
  errors: string[];
  isUpdate: boolean;
  existingSnap?: { property: string; status: string; rent: number };
};

function computeRow(raw: Record<string, string>, zoneMap: Map<number, string>): Omit<ValidatedRow, 'isUpdate' | 'existingSnap'> {
  const cast: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const f of ALL_FIELDS) {
    const { value, error } = castAndValidateField(f, raw[f.key] ?? '');
    cast[f.key] = value;
    if (error) errors.push(error);
  }

  let zone: string | null = null;
  if (cast.zone_number != null) {
    const z = zoneMap.get(cast.zone_number as number);
    if (z) zone = z;
    else errors.push(`Unknown zone code: ${cast.zone_number}`);
  }

  let unit_code: string | null = null;
  if (cast.property && cast.property_unit_no) {
    unit_code = `${slugifyProperty(String(cast.property))}-${cast.property_unit_no}`;
  }

  return { raw, cast, zone, unit_code, errors };
}

export default function UnitImportValidator({ payload, onReset }: { payload: MappedPayload; onReset: () => void }) {
  const [phase, setPhase] = useState<'validating' | 'review' | 'importing' | 'done'>('validating');
  const [rows, setRows] = useState<ValidatedRow[]>([]);
  const [zoneMap, setZoneMap] = useState<Map<number, string>>(new Map());
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const optsRes = await authedFetch('/api/code-registry/options');
        const opts = await optsRes.json();
        const zoneMap = new Map<number, string>(
          (opts.zones ?? []).map((z: { zone_code: number; district_name: string }) => [z.zone_code, z.district_name]),
        );
        setZoneMap(zoneMap);

        const initialRows = payload.rows.map((row) => {
          const raw: Record<string, string> = {};
          for (const f of MASTER_FIELDS) {
            const sourceCol = payload.mapping[f.key];
            raw[f.key] = sourceCol ? String(row[sourceCol] ?? '') : '';
          }
          for (const f of BATCH_FIELDS) {
            raw[f.key] = payload.batch[f.key] ?? '';
          }
          return computeRow(raw, zoneMap);
        });

        const codes = initialRows.map((r) => r.unit_code).filter(Boolean) as string[];
        const checkRes = await fetch('/api/units/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unit_codes: codes }),
        });
        const { existing = {} } = await checkRes.json();

        setRows(initialRows.map((r) => ({
          ...r,
          isUpdate: !!(r.unit_code && existing[r.unit_code]),
          existingSnap: r.unit_code ? existing[r.unit_code] : undefined,
        })));
        setPhase('review');
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Validation failed to initialize');
      }
    })();
  }, [payload]);

  function updateCell(idx: number, key: string, value: string) {
    setRows((prev) => prev.map((r, i) => {
      if (i !== idx) return r;
      const raw = { ...r.raw, [key]: value };
      const recomputed = computeRow(raw, zoneMap);
      return { ...r, ...recomputed, isUpdate: r.isUpdate, existingSnap: r.existingSnap };
    }));
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  async function runImport() {
    setPhase('importing');
    const validRows = rows.filter((r) => r.errors.length === 0);
    const dbRows = validRows.map((r) => toDbRow({ ...r.cast, zone: r.zone, unit_code: r.unit_code }));

    const res = await fetch('/api/units/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: dbRows }),
    });
    const json = await res.json();
    setResult(json);
    setPhase('done');
  }

  const newCount     = rows.filter((r) => !r.isUpdate).length;
  const updateCount  = rows.filter((r) => r.isUpdate).length;
  const errorCount   = rows.filter((r) => r.errors.length > 0).length;
  const validCount   = rows.filter((r) => r.errors.length === 0).length;

  if (loadError) {
    return <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{loadError}</div>;
  }

  if (phase === 'validating' || phase === 'importing') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <svg className="w-8 h-8 text-[#c9a84c] animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
        </svg>
        <p className="text-sm text-[#888]">{phase === 'validating' ? 'Running deterministic validation…' : 'Writing to database…'}</p>
      </div>
    );
  }

  if (phase === 'done' && result) {
    return <ImportDoneScreen result={result} onReset={onReset} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <StageIndicator current={1} steps={['1. Mapping', '2. Validation', 'Import']} />
        </div>
        <button
          onClick={runImport}
          disabled={validCount === 0}
          className="px-5 py-2 bg-[#c9a84c] hover:bg-[#dfc070] disabled:opacity-40 disabled:cursor-not-allowed text-[#0f0f0f] text-sm font-bold rounded-lg transition-colors"
        >
          Import {validCount} Records
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Ready to Import', count: validCount,  color: '#22c55e' },
          { label: 'New Records',     count: newCount,    color: '#3b82f6' },
          { label: 'Updates',         count: updateCount, color: '#c9a84c' },
          { label: 'Errors (blocked)',count: errorCount,  color: '#ef4444' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
            <p className="text-2xl font-bold" style={{ color: c.color }}>{c.count}</p>
            <p className="text-[11px] text-[#555] mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#1e1e1e] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1e1e1e] bg-[#0d0d0d]">
                <th className="w-8 px-3 py-2.5 text-[#444]">#</th>
                <th className="w-20 px-2 py-2.5 text-left text-[10px] font-bold text-[#555] uppercase tracking-widest whitespace-nowrap">Status</th>
                {DISPLAY_COLS.map((k) => (
                  <th key={k} className="px-2 py-2.5 text-left text-[10px] font-bold text-[#555] uppercase tracking-widest whitespace-nowrap">
                    {k.replace(/_/g, ' ')}
                  </th>
                ))}
                <th className="w-16 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const hasError = r.errors.length > 0;
                return (
                  <tr key={i} className={`border-b border-[#141414] group ${
                    hasError ? 'bg-red-500/5' : r.isUpdate ? 'bg-[#c9a84c]/3' : ''
                  }`}>
                    <td className="px-3 py-2 text-[#444] text-center">{i + 1}</td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {hasError ? (
                        <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-1.5 py-0.5">Error</span>
                      ) : r.isUpdate ? (
                        <span className="text-[9px] font-bold text-[#c9a84c] bg-[#c9a84c]/10 border border-[#c9a84c]/20 rounded-full px-1.5 py-0.5">Update</span>
                      ) : (
                        <span className="text-[9px] font-bold text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-full px-1.5 py-0.5">New</span>
                      )}
                    </td>
                    {DISPLAY_COLS.map((k) => {
                      const derived = k === 'unit_code' || k === 'zone';
                      const value = derived ? (k === 'unit_code' ? r.unit_code : r.zone) : r.cast[k];
                      return (
                        <td key={k} className="px-2 py-2 max-w-[140px]">
                          {editingIdx === i && !derived ? (
                            <input
                              className="w-full bg-[#1a1a1a] border border-[#333] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-[#c9a84c]"
                              value={r.raw[k] ?? ''}
                              onChange={(e) => updateCell(i, k, e.target.value)}
                            />
                          ) : (
                            <FieldCell value={value} />
                          )}
                        </td>
                      );
                    })}
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
                          onClick={() => removeRow(i)}
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

      {errorCount > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-1.5">
          <p className="text-xs font-bold text-red-400 mb-2">Rows with errors (blocked until fixed):</p>
          {rows.filter((r) => r.errors.length > 0).map((r, i) => (
            <p key={i} className="text-xs text-[#888]">
              <span className="text-white font-mono">{r.unit_code ?? `Row ${i + 1}`}</span>
              {' — '}{r.errors.join(' · ')}
            </p>
          ))}
        </div>
      )}

      {errorCount === 0 && (
        <div className="rounded-xl border border-[#22c55e]/20 bg-[#22c55e]/5 px-4 py-3 text-sm text-[#22c55e]">
          All {validCount} records passed validation. Ready to import.
        </div>
      )}
    </div>
  );
}
