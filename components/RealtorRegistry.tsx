'use client';

import React, { useEffect, useState } from 'react';
import TopBar from './TopBar';
import { authedFetch } from '../lib/authedFetch';
import { useAuth } from '../contexts/AuthContext';

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

// ── Small icon buttons ────────────────────────────────────────────────────────
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

export default function RealtorRegistry({ onMenuClick }: { onMenuClick?: () => void }) {
  const { role } = useAuth();
  const isReadOnly = role !== 'superuser' && role !== 'administrator';
  const [readOnlyAlert, setReadOnlyAlert] = useState(false);

  const [realtors,   setRealtors]   = useState<Realtor[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [adding,     setAdding]     = useState(false);
  const [name,       setName]       = useState('');
  const [cls,        setCls]        = useState('');
  const [saving,     setSaving]     = useState(false);
  const [err,        setErr]        = useState('');
  const [toast,      setToast]      = useState('');
  const [filter,     setFilter]     = useState('');

  // Edit state
  const [editId,     setEditId]     = useState<string | null>(null);
  const [editName,   setEditName]   = useState('');
  const [editCls,    setEditCls]    = useState('');
  const [editMoci,   setEditMoci]   = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editErr,    setEditErr]    = useState('');

  // Delete state
  const [deleteId,   setDeleteId]   = useState<string | null>(null);
  const [deleting,   setDeleting]   = useState(false);

  useEffect(() => {
    authedFetch('/api/realtors')
      .then(r => r.json())
      .then(d => setRealtors(d.realtors ?? []))
      .finally(() => setLoading(false));
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  // ── Add ──────────────────────────────────────────────────────────────────────
  async function save() {
    if (isReadOnly) { setReadOnlyAlert(true); return; }
    if (!name.trim()) { setErr('Company name is required.'); return; }
    if (!cls)         { setErr('Classification is required.'); return; }
    if (realtors.some(r => r.name.toLowerCase() === name.trim().toLowerCase())) {
      setErr(`"${name.trim()}" already exists.`); return;
    }
    setSaving(true); setErr('');
    try {
      const res  = await authedFetch('/api/realtors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), classification: cls }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(typeof json.error === 'string' ? json.error : 'Failed');
      setRealtors(prev => [...prev, json.realtor].sort((a, b) => a.name.localeCompare(b.name)));
      setName(''); setCls(''); setAdding(false);
      showToast(`"${json.realtor.name}" registered`);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed to save'); }
    finally     { setSaving(false); }
  }

  // ── Edit ─────────────────────────────────────────────────────────────────────
  function openEdit(r: Realtor) {
    if (isReadOnly) { setReadOnlyAlert(true); return; }
    setEditId(r.id); setEditName(r.name); setEditCls(r.classification ?? '');
    setEditMoci(r.moci_id ?? ''); setEditErr(''); setDeleteId(null);
  }

  async function saveEdit() {
    if (isReadOnly) { setReadOnlyAlert(true); return; }
    if (!editName.trim()) { setEditErr('Name is required.'); return; }
    if (!editCls)         { setEditErr('Classification is required.'); return; }
    setEditSaving(true); setEditErr('');
    try {
      const res  = await authedFetch('/api/realtors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editId, name: editName.trim(), classification: editCls, moci_id: editMoci || null }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(typeof json.error === 'string' ? json.error : 'Failed');
      setRealtors(prev =>
        prev.map(r => r.id === editId ? json.realtor : r).sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditId(null);
      showToast(`"${json.realtor.name}" updated`);
    } catch (e) { setEditErr(e instanceof Error ? e.message : 'Failed to update'); }
    finally     { setEditSaving(false); }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  async function confirmDelete() {
    if (isReadOnly) { setReadOnlyAlert(true); return; }
    if (!deleteId) return;
    const target = realtors.find(r => r.id === deleteId);
    setDeleting(true);
    try {
      const res  = await authedFetch('/api/realtors', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteId }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(typeof json.error === 'string' ? json.error : 'Failed');
      setRealtors(prev => prev.filter(r => r.id !== deleteId));
      setDeleteId(null);
      showToast(`"${target?.name}" removed`);
    } catch (e) { showToast('Delete failed — ' + (e instanceof Error ? e.message : 'error')); }
    finally     { setDeleting(false); }
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
                <p className="text-[11px] text-[#555] mt-0.5">Realtor Information Registry</p>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-[#aaa] leading-relaxed">
                You have <span className="text-[#e0e0e0] font-semibold">view-only</span> access to this registry. Add, edit, and delete actions are restricted to Administrators.
              </p>
              <p className="text-[12px] text-[#666]">
                To create, modify, or remove a realtor record, please contact your Administrator to process the request.
              </p>
              <button
                onClick={() => setReadOnlyAlert(false)}
                className="w-full py-2 text-sm font-bold text-[#0f0f0f] bg-[#fbbf24] hover:bg-[#fcd34d] rounded-lg transition-colors"
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
            <h1 className="text-base font-bold text-[#e0e0e0] tracking-wide">Realtor Information</h1>
            <p className="text-[11px] text-[#555] mt-0.5">
              Shared brokerage registry · used across Units Inventory, Axiom Pipeline, and Code Registry
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
              onClick={() => { setAdding(a => !a); setErr(''); setName(''); setCls(''); setEditId(null); setDeleteId(null); }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#fbbf24] hover:bg-[#fcd34d] text-[#0f0f0f] text-sm font-bold rounded-xl transition-colors shrink-0"
            >
              <span className="text-lg leading-none">+</span> Add Realtor
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
          <div className="rounded-2xl border border-[#fbbf24]/20 bg-[#fbbf24]/5 p-5 space-y-4">
            <p className="text-[10px] font-bold text-[#fbbf24] uppercase tracking-widest">Register New Realtor</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1.5">Company Name *</p>
                <input
                  autoFocus value={name}
                  onChange={e => { setName(e.target.value); setErr(''); }}
                  onKeyDown={e => e.key === 'Enter' && save()}
                  placeholder="e.g. Privé Real Estate"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-[#e0e0e0] placeholder-[#444] focus:outline-none focus:border-[#fbbf24] transition-colors"
                />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1.5">Classification *</p>
                <select value={cls} onChange={e => { setCls(e.target.value); setErr(''); }}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-[#e0e0e0] focus:outline-none focus:border-[#fbbf24] transition-colors">
                  <option value="">Select classification…</option>
                  {CLASSIFICATIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {err && <p className="text-xs text-[#ef4444]">{err}</p>}
            <div className="flex gap-2">
              <button onClick={save} disabled={saving || !name.trim() || !cls}
                className="flex-1 bg-[#fbbf24] hover:bg-[#fcd34d] disabled:bg-[#222] disabled:text-[#555] text-[#0f0f0f] text-sm font-bold py-2.5 rounded-xl transition-all">
                {saving ? 'Registering…' : 'Register Realtor'}
              </button>
              <button onClick={() => { setAdding(false); setErr(''); }}
                className="px-4 text-sm text-[#666] hover:text-[#e0e0e0] border border-[#2a2a2a] hover:border-[#444] rounded-xl transition-colors">
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
          <input value={filter} onChange={e => setFilter(e.target.value)}
            placeholder="Search by name or classification…"
            className="w-full bg-[#141414] border border-[#1e1e1e] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[#e0e0e0] placeholder-[#444] focus:outline-none focus:border-[#fbbf24]/40 transition-colors"
          />
        </div>

        {/* ── Table ── */}
        <div className="rounded-2xl border border-[#1e1e1e] overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-[#0d0d0d] border-b border-[#1e1e1e]">
            <span className="col-span-4 text-[9px] font-bold text-[#555] uppercase tracking-wider">Company Name</span>
            <span className="col-span-4 text-[9px] font-bold text-[#555] uppercase tracking-wider">Classification</span>
            <span className="col-span-2 text-[9px] font-bold text-[#555] uppercase tracking-wider">MOCI ID</span>
            <span className="col-span-2 text-[9px] font-bold text-[#555] uppercase tracking-wider text-right">Actions</span>
          </div>

          {loading && <div className="px-4 py-12 text-center text-sm text-[#555]">Loading registry…</div>}
          {!loading && filtered.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-[#555]">
              {filter ? `No results for "${filter}"` : 'No realtors registered yet.'}
            </div>
          )}

          {filtered.map((r, i) => (
            <div key={r.id} className={`border-b border-[#181818] ${i === filtered.length - 1 ? 'border-b-0' : ''}`}>

              {/* ── Edit row ── */}
              {editId === r.id ? (
                <div className="px-4 py-3 bg-[#1a1a1a] space-y-3">
                  <p className="text-[10px] font-bold text-[#fbbf24] uppercase tracking-widest">Edit Realtor</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1">Company Name *</p>
                      <input autoFocus value={editName} onChange={e => { setEditName(e.target.value); setEditErr(''); }}
                        onKeyDown={e => e.key === 'Enter' && saveEdit()}
                        className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-[#e0e0e0] focus:outline-none focus:border-[#fbbf24] transition-colors" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1">Classification *</p>
                      <select value={editCls} onChange={e => { setEditCls(e.target.value); setEditErr(''); }}
                        className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-[#e0e0e0] focus:outline-none focus:border-[#fbbf24] transition-colors">
                        <option value="">Select…</option>
                        {CLASSIFICATIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1">MOCI ID</p>
                      <input value={editMoci} onChange={e => setEditMoci(e.target.value)}
                        placeholder="Optional"
                        className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-[#e0e0e0] font-mono focus:outline-none focus:border-[#fbbf24] transition-colors" />
                    </div>
                  </div>
                  {editErr && <p className="text-xs text-[#ef4444]">{editErr}</p>}
                  <div className="flex gap-2">
                    <button onClick={saveEdit} disabled={editSaving || !editName.trim() || !editCls}
                      className="px-4 py-1.5 bg-[#fbbf24] hover:bg-[#fcd34d] disabled:opacity-40 text-[#0f0f0f] text-sm font-bold rounded-lg transition-colors">
                      {editSaving ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button onClick={() => setEditId(null)}
                      className="px-4 py-1.5 text-sm text-[#666] hover:text-[#e0e0e0] border border-[#2a2a2a] hover:border-[#444] rounded-lg transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>

              ) : deleteId === r.id ? (
                /* ── Delete confirm row ── */
                <div className="px-4 py-3 bg-[#1c0a0a] border border-[#ef4444]/20 flex items-center gap-4">
                  <p className="flex-1 text-sm text-[#ef4444]">
                    Delete <span className="font-bold">"{r.name}"</span>? This cannot be undone.
                  </p>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={confirmDelete} disabled={deleting}
                      className="px-3 py-1.5 bg-[#ef4444] hover:bg-[#dc2626] disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-colors">
                      {deleting ? 'Deleting…' : 'Yes, Delete'}
                    </button>
                    <button onClick={() => setDeleteId(null)}
                      className="px-3 py-1.5 text-xs text-[#666] hover:text-[#e0e0e0] border border-[#2a2a2a] hover:border-[#444] rounded-lg transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>

              ) : (
                /* ── Normal row ── */
                <div className="group relative grid grid-cols-12 gap-3 px-4 py-3 hover:bg-[#141414] transition-colors">
                  <span className="col-span-4 text-sm text-[#e0e0e0] font-medium truncate">{r.name}</span>
                  <span className="col-span-4 flex items-center gap-1.5 min-w-0">
                    {r.classification ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CLS_COLOR[r.classification] ?? '#6b7280' }} />
                        <span className="text-xs truncate" style={{ color: CLS_COLOR[r.classification] ?? '#6b7280' }}>{r.classification}</span>
                      </>
                    ) : <span className="text-xs text-[#333]">—</span>}
                  </span>
                  <span className="col-span-2 text-[11px] font-mono text-[#c9a84c] truncate">{r.moci_id ?? '—'}</span>
                  {/* Action buttons — hidden for read-only roles */}
                  {!isReadOnly && (
                    <div className="col-span-2 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(r)}
                        title="Edit"
                        className="w-6 h-6 rounded-md flex items-center justify-center text-[#888] hover:text-[#fbbf24] hover:bg-[#fbbf24]/10 transition-colors"
                      >
                        <IcEdit />
                      </button>
                      <button
                        onClick={() => { setDeleteId(r.id); setEditId(null); }}
                        title="Delete"
                        className="w-6 h-6 rounded-md flex items-center justify-center text-[#888] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors"
                      >
                        <IcTrash />
                      </button>
                    </div>
                  )}
                  {isReadOnly && <div className="col-span-2" />}
                </div>
              )}
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
