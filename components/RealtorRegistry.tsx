'use client';

import React, { useEffect, useState } from 'react';
import TopBar from './TopBar';

const CLASSIFICATIONS = [
  'Semi-Government & Master Developer',
  'Elite Private Developer & Conglomerate',
  'Top International & Local Brokerage',
  'Institutional Property Manager',
  'Independent',
] as const;

const CLS_COLOR: Record<string, string> = {
  'Semi-Government & Master Developer':     '#3b82f6',
  'Elite Private Developer & Conglomerate': '#a855f7',
  'Top International & Local Brokerage':    '#f97316',
  'Institutional Property Manager':         '#14b8a6',
  'Independent':                            '#6b7280',
};

type Realtor = { id: string; name: string; moci_id: string | null; classification: string | null };

export default function RealtorRegistry({ onMenuClick }: { onMenuClick?: () => void }) {
  const [realtors, setRealtors] = useState<Realtor[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [adding,   setAdding]   = useState(false);
  const [name,     setName]     = useState('');
  const [cls,      setCls]      = useState('');
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');
  const [toast,    setToast]    = useState('');
  const [filter,   setFilter]   = useState('');

  useEffect(() => {
    fetch('/api/realtors')
      .then(r => r.json())
      .then(d => setRealtors(d.realtors ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!name.trim()) { setErr('Company name is required.'); return; }
    if (!cls)         { setErr('Classification is required.'); return; }
    if (realtors.some(r => r.name.toLowerCase() === name.trim().toLowerCase())) {
      setErr(`"${name.trim()}" already exists.`); return;
    }
    setSaving(true); setErr('');
    try {
      const res  = await fetch('/api/realtors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), classification: cls }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(typeof json.error === 'string' ? json.error : 'Failed');
      setRealtors(prev => [...prev, json.realtor].sort((a, b) => a.name.localeCompare(b.name)));
      setName(''); setCls(''); setAdding(false);
      setToast(`"${json.realtor.name}" registered`);
      setTimeout(() => setToast(''), 3000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const filtered = filter
    ? realtors.filter(r =>
        r.name.toLowerCase().includes(filter.toLowerCase()) ||
        (r.classification ?? '').toLowerCase().includes(filter.toLowerCase())
      )
    : realtors;

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
      <TopBar onMenuClick={onMenuClick} />

      {/* ── Page header ── */}
      <div className="sticky top-[53px] z-20 bg-[#0f0f0f] border-b border-[#1e1e1e]">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-base font-bold text-[#e0e0e0] tracking-wide">Realtor Information</h1>
            <p className="text-[11px] text-[#555] mt-0.5">
              Shared brokerage registry · used across Units Inventory, Axiom Pipeline, and Code Registry
            </p>
          </div>
          <button
            onClick={() => { setAdding(a => !a); setErr(''); setName(''); setCls(''); }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#fbbf24] hover:bg-[#fcd34d] text-[#0f0f0f] text-sm font-bold rounded-xl transition-colors shrink-0"
          >
            <span className="text-lg leading-none">+</span> Add Realtor
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 py-6 w-full space-y-5">

        {/* ── Toast ── */}
        {toast && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#22c55e]/10 border border-[#22c55e]/25 text-[#22c55e] text-sm font-medium">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0"><path d="M20 6L9 17l-5-5" /></svg>
            {toast} — synced across all workspaces
          </div>
        )}

        {/* ── Inline add form ── */}
        {adding && (
          <div className="rounded-2xl border border-[#fbbf24]/20 bg-[#fbbf24]/5 p-5 space-y-4">
            <p className="text-[10px] font-bold text-[#fbbf24] uppercase tracking-widest">Register New Realtor</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1.5">Company Name *</p>
                <input
                  autoFocus
                  value={name}
                  onChange={e => { setName(e.target.value); setErr(''); }}
                  onKeyDown={e => e.key === 'Enter' && save()}
                  placeholder="e.g. Privé Real Estate"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-[#e0e0e0] placeholder-[#444] focus:outline-none focus:border-[#fbbf24] transition-colors"
                />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1.5">Classification *</p>
                <select
                  value={cls}
                  onChange={e => { setCls(e.target.value); setErr(''); }}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-[#e0e0e0] focus:outline-none focus:border-[#fbbf24] transition-colors"
                >
                  <option value="">Select classification…</option>
                  {CLASSIFICATIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {err && <p className="text-xs text-[#ef4444]">{err}</p>}
            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={saving || !name.trim() || !cls}
                className="flex-1 bg-[#fbbf24] hover:bg-[#fcd34d] disabled:bg-[#222] disabled:text-[#555] text-[#0f0f0f] text-sm font-bold py-2.5 rounded-xl transition-all"
              >
                {saving ? 'Registering…' : 'Register Realtor'}
              </button>
              <button
                onClick={() => { setAdding(false); setErr(''); }}
                className="px-4 text-sm text-[#666] hover:text-[#e0e0e0] border border-[#2a2a2a] hover:border-[#444] rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Search bar ── */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Search by name or classification…"
            className="w-full bg-[#141414] border border-[#1e1e1e] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[#e0e0e0] placeholder-[#444] focus:outline-none focus:border-[#fbbf24]/40 transition-colors"
          />
        </div>

        {/* ── Table ── */}
        <div className="rounded-2xl border border-[#1e1e1e] overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-[#0d0d0d] border-b border-[#1e1e1e]">
            <span className="col-span-5 text-[9px] font-bold text-[#555] uppercase tracking-wider">Company Name</span>
            <span className="col-span-5 text-[9px] font-bold text-[#555] uppercase tracking-wider">Classification</span>
            <span className="col-span-2 text-[9px] font-bold text-[#555] uppercase tracking-wider">MOCI ID</span>
          </div>

          {loading && (
            <div className="px-4 py-12 text-center text-sm text-[#555]">Loading registry…</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-[#555]">
              {filter ? `No results for "${filter}"` : 'No realtors registered yet. Add the first one above.'}
            </div>
          )}
          {filtered.map((r, i) => (
            <div
              key={r.id}
              className={`grid grid-cols-12 gap-3 px-4 py-3 border-b border-[#181818] hover:bg-[#141414] transition-colors ${
                i === filtered.length - 1 ? 'border-b-0' : ''
              }`}
            >
              <span className="col-span-5 text-sm text-[#e0e0e0] font-medium truncate">{r.name}</span>
              <span className="col-span-5 flex items-center gap-1.5 min-w-0">
                {r.classification ? (
                  <>
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: CLS_COLOR[r.classification] ?? '#6b7280' }}
                    />
                    <span
                      className="text-xs truncate"
                      style={{ color: CLS_COLOR[r.classification] ?? '#6b7280' }}
                    >
                      {r.classification}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-[#333]">—</span>
                )}
              </span>
              <span className="col-span-2 text-[11px] font-mono text-[#c9a84c] truncate">
                {r.moci_id ?? '—'}
              </span>
            </div>
          ))}
        </div>

        {realtors.length > 0 && (
          <p className="text-[11px] text-[#444] text-right">
            {filtered.length} of {realtors.length} realtor{realtors.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}
