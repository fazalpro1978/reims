'use client';

import React, { useEffect, useState } from 'react';
import TopBar from './TopBar';

const QATAR_MUNICIPALITIES = [
  'Doha', 'Al Rayyan', 'Lusail', 'Al Wakrah',
  'Al Khor', 'Al Shamal', 'Al Daayen', 'Umm Salal',
];

const MUNI_COLOR: Record<string, string> = {
  'Doha':       '#3b82f6', 'Al Rayyan': '#f97316', 'Lusail':     '#a855f7',
  'Al Wakrah':  '#14b8a6', 'Al Khor':  '#fbbf24',  'Al Shamal':  '#f43f5e',
  'Al Daayen':  '#22d3ee', 'Umm Salal':'#4ade80',
};

type Zone = { zone_code: number; district_name: string; municipality: string };

export default function ZoneRegistry({ onMenuClick }: { onMenuClick?: () => void }) {
  const [zones,     setZones]     = useState<Zone[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [adding,    setAdding]    = useState(false);
  const [muni,      setMuni]      = useState('');
  const [customMuni,setCustomMuni]= useState('');
  const [zoneNum,   setZoneNum]   = useState('');
  const [district,  setDistrict]  = useState('');
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState('');
  const [toast,     setToast]     = useState('');
  const [filter,    setFilter]    = useState('');
  const [muniFilter,setMuniFilter]= useState('');

  const effectiveMuni = muni === '__custom__' ? customMuni.trim() : muni;
  const preview = zoneNum && district.trim() ? `Zone ${zoneNum} — ${district.trim()}` : null;

  useEffect(() => {
    fetch('/api/zones')
      .then(r => r.json())
      .then(d => setZones(d.zones ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!effectiveMuni)   { setErr('Municipality is required.'); return; }
    const code = Number(zoneNum);
    if (!zoneNum || !Number.isInteger(code) || code <= 0) {
      setErr('Zone Number must be a positive integer.'); return;
    }
    if (!district.trim()) { setErr('District/Zone Name is required.'); return; }
    if (zones.some(z => z.zone_code === code)) {
      setErr(`Zone ${code} already exists.`); return;
    }
    setSaving(true); setErr('');
    try {
      const res  = await fetch('/api/code-registry/zone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zoneCode: code, districtName: district.trim(), municipality: effectiveMuni }),
      });
      const json = await res.json();
      if (res.status === 409) throw new Error(json.error || `Zone ${code} already exists.`);
      if (!res.ok || json.error) throw new Error(typeof json.error === 'string' ? json.error : 'Failed');
      const newZone: Zone = { zone_code: code, district_name: district.trim().replace(/^zone\s*\d+\s*[-–—]\s*/i, '').trim(), municipality: effectiveMuni };
      setZones(prev => [...prev, newZone].sort((a, b) => a.zone_code - b.zone_code));
      setMuni(''); setCustomMuni(''); setZoneNum(''); setDistrict(''); setAdding(false);
      setToast(preview ?? `Zone ${code} registered`);
      setTimeout(() => setToast(''), 3000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  // Unique municipalities for filter
  const muniOptions = Array.from(new Set(zones.map(z => z.municipality).filter(Boolean))).sort();

  const filtered = zones.filter(z => {
    const matchText = !filter || (
      `Zone ${z.zone_code} — ${z.district_name}`.toLowerCase().includes(filter.toLowerCase()) ||
      z.municipality.toLowerCase().includes(filter.toLowerCase())
    );
    const matchMuni = !muniFilter || z.municipality === muniFilter;
    return matchText && matchMuni;
  });

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
      <TopBar onMenuClick={onMenuClick} />

      {/* ── Page header ── */}
      <div className="sticky top-[53px] z-20 bg-[#0f0f0f] border-b border-[#1e1e1e]">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-base font-bold text-[#e0e0e0] tracking-wide">Zone / District Registry</h1>
            <p className="text-[11px] text-[#555] mt-0.5">
              Master zone list · referenced across Units Inventory, Axiom Pipeline, and Code Registry
            </p>
          </div>
          <button
            onClick={() => { setAdding(a => !a); setErr(''); setMuni(''); setCustomMuni(''); setZoneNum(''); setDistrict(''); }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#34d399] hover:bg-[#6ee7b7] text-[#0f0f0f] text-sm font-bold rounded-xl transition-colors shrink-0"
          >
            <span className="text-lg leading-none">+</span> Add Zone
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 py-6 w-full space-y-5">

        {/* ── Toast ── */}
        {toast && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#22c55e]/10 border border-[#22c55e]/25 text-[#22c55e] text-sm font-medium">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0"><path d="M20 6L9 17l-5-5" /></svg>
            {toast} — added to all workspaces
          </div>
        )}

        {/* ── Inline add form ── */}
        {adding && (
          <div className="rounded-2xl border border-[#34d399]/20 bg-[#34d399]/5 p-5 space-y-4">
            <p className="text-[10px] font-bold text-[#34d399] uppercase tracking-widest">Register New Zone</p>
            <div>
              <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1.5">Municipality *</p>
              <select
                value={muni}
                onChange={e => { setMuni(e.target.value); setErr(''); }}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-[#e0e0e0] focus:outline-none focus:border-[#34d399] transition-colors"
              >
                <option value="">Select municipality…</option>
                {QATAR_MUNICIPALITIES.map(m => <option key={m} value={m}>{m}</option>)}
                <option value="__custom__">Other (type below)</option>
              </select>
              {muni === '__custom__' && (
                <input
                  autoFocus
                  value={customMuni}
                  onChange={e => { setCustomMuni(e.target.value); setErr(''); }}
                  placeholder="Enter municipality name"
                  className="mt-2 w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-[#e0e0e0] placeholder-[#444] focus:outline-none focus:border-[#34d399] transition-colors"
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1.5">Zone Number *</p>
                <input
                  type="number"
                  min={1}
                  value={zoneNum}
                  onChange={e => { setZoneNum(e.target.value); setErr(''); }}
                  placeholder="e.g. 61"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-[#e0e0e0] placeholder-[#444] focus:outline-none focus:border-[#34d399] transition-colors"
                />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1.5">District / Zone Name *</p>
                <input
                  value={district}
                  onChange={e => { setDistrict(e.target.value); setErr(''); }}
                  placeholder="e.g. Al Kharayej"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-[#e0e0e0] placeholder-[#444] focus:outline-none focus:border-[#34d399] transition-colors"
                />
              </div>
            </div>
            {preview && (
              <p className="text-[11px] text-[#34d399] font-mono bg-[#34d399]/5 border border-[#34d399]/20 rounded-xl px-3 py-2">
                Preview: {preview}
              </p>
            )}
            {err && <p className="text-xs text-[#ef4444]">{err}</p>}
            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={saving || !effectiveMuni || !zoneNum || !district.trim()}
                className="flex-1 bg-[#34d399] hover:bg-[#6ee7b7] disabled:bg-[#222] disabled:text-[#555] text-[#0f0f0f] text-sm font-bold py-2.5 rounded-xl transition-all"
              >
                {saving ? 'Registering…' : 'Register Zone'}
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

        {/* ── Filters ── */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
            </svg>
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Search by zone name or number…"
              className="w-full bg-[#141414] border border-[#1e1e1e] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[#e0e0e0] placeholder-[#444] focus:outline-none focus:border-[#34d399]/40 transition-colors"
            />
          </div>
          <select
            value={muniFilter}
            onChange={e => setMuniFilter(e.target.value)}
            className="bg-[#141414] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-sm text-[#888] focus:outline-none focus:border-[#34d399]/40 transition-colors"
          >
            <option value="">All municipalities</option>
            {muniOptions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* ── Table ── */}
        <div className="rounded-2xl border border-[#1e1e1e] overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-[#0d0d0d] border-b border-[#1e1e1e]">
            <span className="col-span-2 text-[9px] font-bold text-[#555] uppercase tracking-wider">Zone</span>
            <span className="col-span-5 text-[9px] font-bold text-[#555] uppercase tracking-wider">District / Zone Name</span>
            <span className="col-span-5 text-[9px] font-bold text-[#555] uppercase tracking-wider">Municipality</span>
          </div>

          {loading && (
            <div className="px-4 py-12 text-center text-sm text-[#555]">Loading zones…</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-[#555]">
              {filter || muniFilter ? 'No zones match the current filter.' : 'No zones registered yet. Add the first one above.'}
            </div>
          )}
          {filtered.map((z, i) => (
            <div
              key={z.zone_code}
              className={`grid grid-cols-12 gap-3 px-4 py-3 border-b border-[#181818] hover:bg-[#141414] transition-colors ${
                i === filtered.length - 1 ? 'border-b-0' : ''
              }`}
            >
              <span className="col-span-2 text-sm font-mono font-bold text-[#34d399]">
                {z.zone_code}
              </span>
              <span className="col-span-5 text-sm text-[#e0e0e0] font-medium truncate">
                Zone {z.zone_code} — {z.district_name}
              </span>
              <span className="col-span-5 flex items-center gap-1.5 min-w-0">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: MUNI_COLOR[z.municipality] ?? '#6b7280' }}
                />
                <span
                  className="text-xs truncate"
                  style={{ color: MUNI_COLOR[z.municipality] ?? '#888' }}
                >
                  {z.municipality}
                </span>
              </span>
            </div>
          ))}
        </div>

        {zones.length > 0 && (
          <p className="text-[11px] text-[#444] text-right">
            {filtered.length} of {zones.length} zone{zones.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}
