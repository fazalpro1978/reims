'use client';

import React, { useEffect, useState } from 'react';
import TopBar from './TopBar';
import { authedFetch } from '../lib/authedFetch';
import { useAuth } from '../contexts/AuthContext';

const QATAR_MUNICIPALITIES = [
  'Doha', 'Al Rayyan', 'Lusail', 'Al Wakrah',
  'Al Khor', 'Al Shamal', 'Al Daayen', 'Umm Salal',
];

const MUNI_COLOR: Record<string, string> = {
  'Doha Municipality':        '#3b82f6',
  'Al Rayyan Municipality':   '#f97316',
  'Al Wakrah Municipality':   '#14b8a6',
  'Al Khor Municipality':     '#fbbf24',
  'Al Shamal Municipality':   '#f43f5e',
  'Al Daayen Municipality':   '#22d3ee',
  'Umm Salal Municipality':   '#4ade80',
  'Al Shahaniya Municipality':'#a855f7',
};

type Zone = { zone_code: number; district_name: string; municipality: string; area_km2?: number | null; population?: number | null };

function IcEdit() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="w-[14px] h-[14px]">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
function IcTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="w-[14px] h-[14px]">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}
function IcCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-[13px] h-[13px]">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export default function ZoneRegistry({ onMenuClick }: { onMenuClick?: () => void }) {
  const { role } = useAuth();
  const isReadOnly = role !== 'superuser' && role !== 'administrator';
  const [readOnlyAlert, setReadOnlyAlert] = useState(false);

  const [zones,      setZones]      = useState<Zone[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [adding,     setAdding]     = useState(false);
  const [muni,       setMuni]       = useState('');
  const [customMuni, setCustomMuni] = useState('');
  const [zoneNum,    setZoneNum]    = useState('');
  const [district,   setDistrict]   = useState('');
  const [saving,     setSaving]     = useState(false);
  const [err,        setErr]        = useState('');
  const [toast,      setToast]      = useState('');
  const [filter,     setFilter]     = useState('');
  const [muniFilter, setMuniFilter] = useState('');

  // Edit state
  const [editCode,    setEditCode]    = useState<number | null>(null);
  const [editDistrict,setEditDistrict]= useState('');
  const [editMuni,    setEditMuni]    = useState('');
  const [editCustom,  setEditCustom]  = useState('');
  const [editSaving,  setEditSaving]  = useState(false);
  const [editErr,     setEditErr]     = useState('');

  // Delete state
  const [deleteCode, setDeleteCode] = useState<number | null>(null);
  const [deleting,   setDeleting]   = useState(false);

  const effectiveMuni = muni === '__custom__' ? customMuni.trim() : muni;
  const editEffMuni   = editMuni === '__custom__' ? editCustom.trim() : editMuni;
  const preview = zoneNum && district.trim() ? `Zone ${zoneNum} — ${district.trim()}` : null;
  const editPreview = editCode && editDistrict.trim() ? `Zone ${editCode} — ${editDistrict.trim()}` : null;

  useEffect(() => {
    authedFetch('/api/zones')
      .then(r => r.json())
      .then(d => setZones(d.zones ?? []))
      .finally(() => setLoading(false));
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  // ── Add ──────────────────────────────────────────────────────────────────────
  async function save() {
    if (isReadOnly) { setReadOnlyAlert(true); return; }
    if (!effectiveMuni)   { setErr('Municipality is required.'); return; }
    const code = Number(zoneNum);
    if (!zoneNum || !Number.isInteger(code) || code <= 0) { setErr('Zone Number must be a positive integer.'); return; }
    if (!district.trim()) { setErr('District/Zone Name is required.'); return; }
    if (zones.some(z => z.zone_code === code)) { setErr(`Zone ${code} already exists.`); return; }
    setSaving(true); setErr('');
    try {
      const res  = await fetch('/api/code-registry/zone', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zoneCode: code, districtName: district.trim(), municipality: effectiveMuni }),
      });
      const json = await res.json();
      if (res.status === 409) throw new Error(json.error || `Zone ${code} already exists.`);
      if (!res.ok || json.error) throw new Error(typeof json.error === 'string' ? json.error : 'Failed');
      const newZone: Zone = {
        zone_code: code,
        district_name: district.trim().replace(/^zone\s*\d+\s*[-–—]\s*/i, '').trim(),
        municipality: effectiveMuni,
      };
      setZones(prev => [...prev, newZone].sort((a, b) => a.zone_code - b.zone_code));
      setMuni(''); setCustomMuni(''); setZoneNum(''); setDistrict(''); setAdding(false);
      showToast(preview ?? `Zone ${code} registered`);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed to save'); }
    finally     { setSaving(false); }
  }

  // ── Edit ─────────────────────────────────────────────────────────────────────
  function openEdit(z: Zone) {
    if (isReadOnly) { setReadOnlyAlert(true); return; }
    setEditCode(z.zone_code);
    setEditDistrict(z.district_name);
    const isKnown = QATAR_MUNICIPALITIES.includes(z.municipality);
    setEditMuni(isKnown ? z.municipality : '__custom__');
    setEditCustom(isKnown ? '' : z.municipality);
    setEditErr(''); setDeleteCode(null);
  }

  async function saveEdit() {
    if (isReadOnly) { setReadOnlyAlert(true); return; }
    if (!editEffMuni)        { setEditErr('Municipality is required.'); return; }
    if (!editDistrict.trim()) { setEditErr('District Name is required.'); return; }
    setEditSaving(true); setEditErr('');
    try {
      const res  = await authedFetch('/api/zones', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_code: editCode, district_name: editDistrict.trim(), municipality: editEffMuni }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(typeof json.error === 'string' ? json.error : 'Failed');
      const updated: Zone = json.zone;
      setZones(prev => prev.map(z => z.zone_code === editCode ? updated : z));
      setEditCode(null);
      showToast(`Zone ${updated.zone_code} updated`);
    } catch (e) { setEditErr(e instanceof Error ? e.message : 'Failed to update'); }
    finally     { setEditSaving(false); }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  async function confirmDelete() {
    if (isReadOnly) { setReadOnlyAlert(true); return; }
    if (deleteCode === null) return;
    setDeleting(true);
    try {
      const res  = await authedFetch('/api/zones', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_code: deleteCode }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(typeof json.error === 'string' ? json.error : 'Failed');
      setZones(prev => prev.filter(z => z.zone_code !== deleteCode));
      setDeleteCode(null);
      showToast(`Zone ${deleteCode} removed`);
    } catch (e) { showToast('Delete failed — ' + (e instanceof Error ? e.message : 'error')); }
    finally     { setDeleting(false); }
  }

  const muniOptions = Array.from(new Set(zones.map(z => z.municipality).filter(Boolean))).sort();

  const filtered = zones.filter(z => {
    const matchText = !filter || (
      `Zone ${z.zone_code} — ${z.district_name}`.toLowerCase().includes(filter.toLowerCase()) ||
      String(z.zone_code).includes(filter) ||
      z.municipality.toLowerCase().includes(filter.toLowerCase())
    );
    const matchMuni = !muniFilter || z.municipality === muniFilter;
    return matchText && matchMuni;
  });

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
      <TopBar onMenuClick={onMenuClick} />

      {/* ── Read-Only Intercept Modal ── */}
      {readOnlyAlert && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm mx-4 bg-[#181818] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-[#111] border-b border-[#2a2a2a] flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#e0e0e0]">Read-Only Access</p>
                <p className="text-[11px] text-[#555] mt-0.5">Zone / District Registry</p>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-[#aaa] leading-relaxed">
                You have <span className="text-[#e0e0e0] font-semibold">view-only</span> access to this registry. Add, edit, and delete actions are restricted to Administrators.
              </p>
              <p className="text-[12px] text-[#666]">
                To create, modify, or remove a zone record, please contact your Administrator to process the request.
              </p>
              <button
                onClick={() => setReadOnlyAlert(false)}
                className="w-full py-2 text-sm font-bold text-[#0f0f0f] bg-[#34d399] hover:bg-[#6ee7b7] rounded-lg transition-colors"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page header ── */}
      <div className="sticky top-[53px] z-20 bg-[#0f0f0f] border-b border-[#1e1e1e]">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-base font-bold text-[#e0e0e0] tracking-wide">Zone / District Registry</h1>
            <p className="text-[11px] text-[#555] mt-0.5">
              Master zone list · referenced across Units Inventory, Axiom Pipeline, and Code Registry
            </p>
          </div>
          {isReadOnly ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-xs text-[#555] font-medium">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              View Only
            </span>
          ) : (
            <button
              onClick={() => { setAdding(a => !a); setErr(''); setMuni(''); setCustomMuni(''); setZoneNum(''); setDistrict(''); setEditCode(null); setDeleteCode(null); }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#34d399] hover:bg-[#6ee7b7] text-[#0f0f0f] text-sm font-bold rounded-xl transition-colors shrink-0"
            >
              <span className="text-lg leading-none">+</span> Add Zone
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 py-6 w-full space-y-5">

        {/* ── Toast ── */}
        {toast && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#22c55e]/10 border border-[#22c55e]/25 text-[#22c55e] text-sm font-medium">
            <IcCheck />
            {toast}
          </div>
        )}

        {/* ── Inline add form — admin only ── */}
        {adding && !isReadOnly && (
          <div className="rounded-2xl border border-[#34d399]/20 bg-[#34d399]/5 p-5 space-y-4">
            <p className="text-[10px] font-bold text-[#34d399] uppercase tracking-widest">Register New Zone</p>
            <div>
              <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1.5">Municipality *</p>
              <select value={muni} onChange={e => { setMuni(e.target.value); setErr(''); }}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-[#e0e0e0] focus:outline-none focus:border-[#34d399] transition-colors">
                <option value="">Select municipality…</option>
                {QATAR_MUNICIPALITIES.map(m => <option key={m} value={m}>{m}</option>)}
                <option value="__custom__">Other (type below)</option>
              </select>
              {muni === '__custom__' && (
                <input autoFocus value={customMuni} onChange={e => { setCustomMuni(e.target.value); setErr(''); }}
                  placeholder="Enter municipality name"
                  className="mt-2 w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-[#e0e0e0] placeholder-[#444] focus:outline-none focus:border-[#34d399] transition-colors" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1.5">Zone Number *</p>
                <input type="number" min={1} value={zoneNum} onChange={e => { setZoneNum(e.target.value); setErr(''); }}
                  placeholder="e.g. 61"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-[#e0e0e0] placeholder-[#444] focus:outline-none focus:border-[#34d399] transition-colors" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1.5">District / Zone Name *</p>
                <input value={district} onChange={e => { setDistrict(e.target.value); setErr(''); }}
                  placeholder="e.g. Al Kharayej"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-[#e0e0e0] placeholder-[#444] focus:outline-none focus:border-[#34d399] transition-colors" />
              </div>
            </div>
            {preview && (
              <p className="text-[11px] text-[#34d399] font-mono bg-[#34d399]/5 border border-[#34d399]/20 rounded-xl px-3 py-2">
                Preview: {preview}
              </p>
            )}
            {err && <p className="text-xs text-[#ef4444]">{err}</p>}
            <div className="flex gap-2">
              <button onClick={save} disabled={saving || !effectiveMuni || !zoneNum || !district.trim()}
                className="flex-1 bg-[#34d399] hover:bg-[#6ee7b7] disabled:bg-[#222] disabled:text-[#555] text-[#0f0f0f] text-sm font-bold py-2.5 rounded-xl transition-all">
                {saving ? 'Registering…' : 'Register Zone'}
              </button>
              <button onClick={() => { setAdding(false); setErr(''); }}
                className="px-4 text-sm text-[#666] hover:text-[#e0e0e0] border border-[#2a2a2a] hover:border-[#444] rounded-xl transition-colors">
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
            <input value={filter} onChange={e => setFilter(e.target.value)}
              placeholder="Search by zone name or number…"
              className="w-full bg-[#141414] border border-[#1e1e1e] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[#e0e0e0] placeholder-[#444] focus:outline-none focus:border-[#34d399]/40 transition-colors" />
          </div>
          <select value={muniFilter} onChange={e => setMuniFilter(e.target.value)}
            className="bg-[#141414] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-sm text-[#888] focus:outline-none focus:border-[#34d399]/40 transition-colors">
            <option value="">All municipalities</option>
            {muniOptions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* ── Table ── */}
        <div className="rounded-2xl border border-[#1e1e1e] overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-[#0d0d0d] border-b border-[#1e1e1e]">
            <span className="col-span-1 text-[9px] font-bold text-[#555] uppercase tracking-wider">Zone</span>
            <span className="col-span-4 text-[9px] font-bold text-[#555] uppercase tracking-wider">District / Zone Name</span>
            <span className="col-span-3 text-[9px] font-bold text-[#555] uppercase tracking-wider">Municipality</span>
            <span className="col-span-2 text-[9px] font-bold text-[#555] uppercase tracking-wider text-right">Area (km²)</span>
            <span className="col-span-1 text-[9px] font-bold text-[#555] uppercase tracking-wider text-right">Pop.</span>
            <span className="col-span-1 text-[9px] font-bold text-[#555] uppercase tracking-wider text-right">Actions</span>
          </div>

          {loading && <div className="px-4 py-12 text-center text-sm text-[#555]">Loading zones…</div>}
          {!loading && filtered.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-[#555]">
              {filter || muniFilter ? 'No zones match the current filter.' : 'No zones registered yet.'}
            </div>
          )}

          {filtered.map((z, i) => (
            <div key={z.zone_code} className={`border-b border-[#181818] ${i === filtered.length - 1 ? 'border-b-0' : ''}`}>

              {/* ── Edit row ── */}
              {editCode === z.zone_code ? (
                <div className="px-4 py-3 bg-[#1a1a1a] space-y-3">
                  <p className="text-[10px] font-bold text-[#34d399] uppercase tracking-widest">
                    Edit Zone {z.zone_code}
                    <span className="ml-2 text-[#555] normal-case tracking-normal font-normal">(Zone Number cannot be changed)</span>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1">Municipality *</p>
                      <select value={editMuni} onChange={e => { setEditMuni(e.target.value); setEditErr(''); }}
                        className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-[#e0e0e0] focus:outline-none focus:border-[#34d399] transition-colors">
                        <option value="">Select…</option>
                        {QATAR_MUNICIPALITIES.map(m => <option key={m} value={m}>{m}</option>)}
                        <option value="__custom__">Other (type below)</option>
                      </select>
                      {editMuni === '__custom__' && (
                        <input value={editCustom} onChange={e => setEditCustom(e.target.value)}
                          placeholder="Municipality name"
                          className="mt-1.5 w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-[#e0e0e0] focus:outline-none focus:border-[#34d399] transition-colors" />
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1">District / Zone Name *</p>
                      <input autoFocus value={editDistrict} onChange={e => { setEditDistrict(e.target.value); setEditErr(''); }}
                        onKeyDown={e => e.key === 'Enter' && saveEdit()}
                        className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-[#e0e0e0] focus:outline-none focus:border-[#34d399] transition-colors" />
                    </div>
                  </div>
                  {editPreview && (
                    <p className="text-[11px] text-[#34d399] font-mono bg-[#34d399]/5 border border-[#34d399]/20 rounded-lg px-3 py-1.5">
                      Preview: {editPreview}
                    </p>
                  )}
                  {editErr && <p className="text-xs text-[#ef4444]">{editErr}</p>}
                  <div className="flex gap-2">
                    <button onClick={saveEdit} disabled={editSaving || !editEffMuni || !editDistrict.trim()}
                      className="px-4 py-1.5 bg-[#34d399] hover:bg-[#6ee7b7] disabled:opacity-40 text-[#0f0f0f] text-sm font-bold rounded-lg transition-colors">
                      {editSaving ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button onClick={() => setEditCode(null)}
                      className="px-4 py-1.5 text-sm text-[#666] hover:text-[#e0e0e0] border border-[#2a2a2a] hover:border-[#444] rounded-lg transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>

              ) : deleteCode === z.zone_code ? (
                /* ── Delete confirm row ── */
                <div className="px-4 py-3 bg-[#1c0a0a] border border-[#ef4444]/20 flex items-center gap-4">
                  <p className="flex-1 text-sm text-[#ef4444]">
                    Delete <span className="font-bold">Zone {z.zone_code} — {z.district_name}</span>? This cannot be undone.
                  </p>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={confirmDelete} disabled={deleting}
                      className="px-3 py-1.5 bg-[#ef4444] hover:bg-[#dc2626] disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-colors">
                      {deleting ? 'Deleting…' : 'Yes, Delete'}
                    </button>
                    <button onClick={() => setDeleteCode(null)}
                      className="px-3 py-1.5 text-xs text-[#666] hover:text-[#e0e0e0] border border-[#2a2a2a] hover:border-[#444] rounded-lg transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>

              ) : (
                /* ── Normal row ── */
                <div className="group grid grid-cols-12 gap-2 px-4 py-3 hover:bg-[#141414] transition-colors">
                  <span className="col-span-1 text-sm font-mono font-bold text-[#34d399]">{z.zone_code}</span>
                  <span className="col-span-4 text-sm text-[#e0e0e0] font-medium truncate" title={`Zone ${z.zone_code} — ${z.district_name}`}>
                    Zone {z.zone_code} — {z.district_name}
                  </span>
                  <span className="col-span-3 flex items-center gap-1.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: MUNI_COLOR[z.municipality] ?? '#6b7280' }} />
                    <span className="text-xs truncate" style={{ color: MUNI_COLOR[z.municipality] ?? '#888' }}>{z.municipality}</span>
                  </span>
                  <span className="col-span-2 text-xs text-[#888] text-right tabular-nums self-center">
                    {z.area_km2 != null ? z.area_km2.toLocaleString() : '—'}
                  </span>
                  <span className="col-span-1 text-xs text-[#666] text-right tabular-nums self-center">
                    {z.population != null ? z.population.toLocaleString() : '—'}
                  </span>
                  {/* Action buttons — hidden for read-only roles */}
                  {!isReadOnly && (
                    <div className="col-span-1 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(z)}
                        title="Edit"
                        className="w-6 h-6 rounded-md flex items-center justify-center text-[#888] hover:text-[#34d399] hover:bg-[#34d399]/10 transition-colors"
                      >
                        <IcEdit />
                      </button>
                      <button
                        onClick={() => { setDeleteCode(z.zone_code); setEditCode(null); }}
                        title="Delete"
                        className="w-6 h-6 rounded-md flex items-center justify-center text-[#888] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors"
                      >
                        <IcTrash />
                      </button>
                    </div>
                  )}
                  {isReadOnly && <div className="col-span-1" />}
                </div>
              )}
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
