'use client';
import React from 'react';
import Link from 'next/link';

export type ImportResult = { inserted: number; updated: number; errors: string[] };

export function StageIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((label, i) => {
        const done   = current > i;
        const active = current === i;
        return (
          <React.Fragment key={label}>
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
              {label}
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

export function FieldCell({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-[#333] italic text-[10px]">—</span>;
  }
  return <span className="text-xs text-[#c8c8c8]">{String(value)}</span>;
}

export function ImportDoneScreen({ result, onReset }: { result: ImportResult; onReset: () => void }) {
  return (
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
          onClick={onReset}
          className="flex-1 py-2.5 bg-[#1a1a1a] hover:bg-[#252525] text-[#888] hover:text-white text-sm font-bold rounded-lg border border-[#2a2a2a] transition-colors"
        >
          Import Another File
        </button>
      </div>
    </div>
  );
}
