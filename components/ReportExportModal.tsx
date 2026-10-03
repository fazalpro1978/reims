'use client';

import { useState, useEffect, useCallback, CSSProperties } from 'react';
import { supabase } from '@/lib/supabase/client';
import { REPORT_CATEGORIES } from '@/lib/reportSchema';

interface Props {
  onClose: () => void;
}

type ColMap = Record<string, Set<string>>;  // catKey → Set<colKey>

const GOLD   = '#c9a84c';
const BG     = '#0d0d14';
const PANEL  = '#13131c';
const BORDER = '#1e1e2e';
const TEXT   = '#e2e2ee';
const MUTED  = '#5a5a7a';

export default function ReportExportModal({ onClose }: Props) {
  const [selected,     setSelected]     = useState<ColMap>(() => {
    // Default: all categories, all columns selected
    const init: ColMap = {};
    for (const cat of REPORT_CATEGORIES) {
      init[cat.key] = new Set(cat.columns.map(c => c.key));
    }
    return init;
  });
  const [activecat,    setActivecat]    = useState<string>(REPORT_CATEGORIES[0].key);
  const [unitCount,    setUnitCount]    = useState<number | null>(null);
  const [downloading,  setDownloading]  = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  // Fetch preview count once on mount
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      try {
        const res = await fetch('/api/reports/export', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const json = await res.json() as { count: number };
          setUnitCount(json.count);
        }
      } catch { /* silent */ }
    })();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const selectedCatsCount = Object.values(selected).filter(s => s.size > 0).length;
  const totalCols         = Object.values(selected).reduce((n, s) => n + s.size, 0);

  const toggleCategory = useCallback((catKey: string) => {
    setSelected(prev => {
      const cat = REPORT_CATEGORIES.find(c => c.key === catKey)!;
      const cur = prev[catKey] ?? new Set();
      const full = cur.size === cat.columns.length;
      return { ...prev, [catKey]: full ? new Set() : new Set(cat.columns.map(c => c.key)) };
    });
  }, []);

  const toggleCol = useCallback((catKey: string, colKey: string) => {
    setSelected(prev => {
      const cur = new Set(prev[catKey] ?? []);
      cur.has(colKey) ? cur.delete(colKey) : cur.add(colKey);
      return { ...prev, [catKey]: cur };
    });
  }, []);

  const selectAll = useCallback(() => {
    const all: ColMap = {};
    for (const cat of REPORT_CATEGORIES) all[cat.key] = new Set(cat.columns.map(c => c.key));
    setSelected(all);
  }, []);

  const deselectAll = useCallback(() => {
    const none: ColMap = {};
    for (const cat of REPORT_CATEGORIES) none[cat.key] = new Set();
    setSelected(none);
  }, []);

  const handleDownload = async () => {
    setError(null);
    setDownloading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expired — please log in again.');

      const categories    = REPORT_CATEGORIES
        .filter(c => (selected[c.key]?.size ?? 0) > 0)
        .map(c => c.key);
      const selectedCols: Record<string, string[]> = {};
      for (const k of categories) selectedCols[k] = Array.from(selected[k]);

      const res = await fetch('/api/reports/export', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ categories, selectedCols }),
      });

      if (!res.ok) {
        const j = await res.json() as { error?: string };
        throw new Error(j.error ?? 'Export failed');
      }

      const blob      = await res.blob();
      const cd        = res.headers.get('Content-Disposition') ?? '';
      const fnMatch   = cd.match(/filename="([^"]+)"/);
      const filename  = fnMatch?.[1] ?? 'REIMS-Export.csv';

      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setDownloading(false);
    }
  };

  const activeCat = REPORT_CATEGORIES.find(c => c.key === activecat)!;
  const activeSel = selected[activecat] ?? new Set<string>();
  const catFull   = activeSel.size === activeCat.columns.length;
  const catEmpty  = activeSel.size === 0;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position:  'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(4px)',
        display:   'flex', alignItems: 'center', justifyContent: 'center',
        padding:   '24px 16px',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 860, maxHeight: '90vh',
          background: BG, borderRadius: 16,
          border: `1px solid ${BORDER}`,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,.6)',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: `1px solid ${BORDER}`,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 12,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: TEXT, letterSpacing: '-.02em' }}>
              Generate Report
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: MUTED }}>
              Select categories and columns · live data as of {new Date().toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
              {unitCount !== null ? ` · ${unitCount.toLocaleString()} units` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <button onClick={selectAll}   style={ghostBtn}>Select All</button>
            <button onClick={deselectAll} style={ghostBtn}>Deselect All</button>
            <button onClick={onClose} style={{ ...ghostBtn, padding: '5px 8px', color: MUTED }}>✕</button>
          </div>
        </div>

        {/* ── Body: Category sidebar + Column panel ── */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

          {/* Left — category list */}
          <div style={{
            width: 230, flexShrink: 0,
            borderRight: `1px solid ${BORDER}`,
            overflowY: 'auto', padding: '10px 0',
          }}>
            {REPORT_CATEGORIES.map(cat => {
              const sel = selected[cat.key] ?? new Set();
              const isActive = activecat === cat.key;
              const pct = cat.columns.length > 0 ? sel.size / cat.columns.length : 0;
              return (
                <button
                  key={cat.key}
                  onClick={() => setActivecat(cat.key)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '9px 16px',
                    background: isActive ? 'rgba(201,168,76,.08)' : 'transparent',
                    borderLeft: `2px solid ${isActive ? GOLD : 'transparent'}`,
                    border: 'none', cursor: 'pointer',
                    transition: 'background .1s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={sel.size > 0}
                      ref={el => { if (el) el.indeterminate = sel.size > 0 && sel.size < cat.columns.length; }}
                      onChange={e => { e.stopPropagation(); toggleCategory(cat.key); }}
                      onClick={e => e.stopPropagation()}
                      style={{ accentColor: GOLD, width: 13, height: 13, flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? TEXT : '#8888aa', flex: 1 }}>
                      {cat.icon} {cat.label}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ marginTop: 4, marginLeft: 21, height: 2, background: BORDER, borderRadius: 1 }}>
                    <div style={{
                      height: '100%', borderRadius: 1, transition: 'width .15s',
                      background: GOLD, width: `${Math.round(pct * 100)}%`,
                    }} />
                  </div>
                  <div style={{ marginLeft: 21, marginTop: 2, fontSize: 10, color: MUTED }}>
                    {sel.size} / {cat.columns.length} columns
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right — column checkboxes */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {/* Category header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>
                  {activeCat.icon} {activeCat.label}
                </div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                  {activeSel.size} of {activeCat.columns.length} columns selected
                </div>
              </div>
              <button
                onClick={() => toggleCategory(activecat)}
                style={{ ...ghostBtn, fontSize: 10 }}
              >
                {catFull ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {/* Column grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '6px 12px',
            }}>
              {activeCat.columns.map(col => {
                const isMandatory = col.db === 'property' || col.db === 'unit_no';
                const checked     = activeSel.has(col.key) || isMandatory;
                return (
                  <label
                    key={col.key}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 10px', borderRadius: 7,
                      border: `1px solid ${checked ? 'rgba(201,168,76,.2)' : BORDER}`,
                      background: checked ? 'rgba(201,168,76,.05)' : PANEL,
                      cursor: isMandatory ? 'default' : 'pointer',
                      transition: 'all .1s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isMandatory}
                      onChange={() => { if (!isMandatory) toggleCol(activecat, col.key); }}
                      style={{ accentColor: GOLD, width: 13, height: 13, flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 11, color: checked ? TEXT : '#6666aa' }}>
                      {col.label}
                    </span>
                    {isMandatory && (
                      <span style={{ fontSize: 9, color: GOLD, marginLeft: 'auto', letterSpacing: '.05em' }}>
                        REQ
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '14px 24px',
          borderTop: `1px solid ${BORDER}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ fontSize: 11, color: MUTED }}>
            {selectedCatsCount} {selectedCatsCount === 1 ? 'category' : 'categories'} · {totalCols} columns selected
            {unitCount !== null && ` · ${unitCount.toLocaleString()} rows`}
          </div>

          {error && (
            <div style={{ fontSize: 11, color: '#e05555', flex: 1 }}>⚠ {error}</div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={ghostBtn}>Cancel</button>
            <button
              onClick={handleDownload}
              disabled={downloading || selectedCatsCount === 0}
              style={{
                padding: '8px 20px', borderRadius: 8,
                fontSize: 11, fontWeight: 700, letterSpacing: '.04em',
                textTransform: 'uppercase', cursor: downloading || selectedCatsCount === 0 ? 'not-allowed' : 'pointer',
                border: `1px solid ${GOLD}`,
                background: downloading || selectedCatsCount === 0 ? 'rgba(201,168,76,.06)' : 'rgba(201,168,76,.14)',
                color: downloading || selectedCatsCount === 0 ? MUTED : GOLD,
                transition: 'all .12s',
              }}
            >
              {downloading ? 'Exporting…' : '⬇ Download CSV'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const ghostBtn: CSSProperties = {
  padding: '6px 12px', borderRadius: 7,
  fontSize: 11, fontWeight: 600, letterSpacing: '.03em',
  cursor: 'pointer', border: '1px solid #2a2a3e',
  background: 'transparent', color: '#8888aa', transition: 'all .1s',
};
