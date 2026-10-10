'use client';
import React, { useState, useEffect, useCallback } from 'react';
import TopBar from './TopBar';
import { authedFetch } from '../lib/authedFetch';
import { useAuth } from '../contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientInquiry {
  id: string;
  ref_no: string;
  status: string;
  listing_type?: string;
  property_type?: string;
  config?: string;
  budget_min?: number;
  budget_max?: number;
  follow_up_date?: string;
  created_at: string;
  match_count: number;
}

interface Client {
  id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  nationality?: string | null;
  source: string;
  tags: string[];
  whatsapp_opt_in: boolean;
  whatsapp_opt_in_at?: string | null;
  email_opt_in: boolean;
  email_opt_in_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  inquiries?: ClientInquiry[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('en-QA');

const STATUS_COLOR: Record<string, string> = {
  new: '#94a3b8', contacted: '#38bdf8', viewing: '#fbbf24',
  negotiating: '#fb923c', won: '#4ade80', lost: '#f87171',
  cancelled: '#f87171', closed: '#64748b',
};

const PRESET_TAGS = ['VIP', 'Hot Lead', 'Investor', 'Past Tenant', 'Referral', 'Cold', 'Do Not Contact'];

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();
}

function waLink(phone: string, name: string) {
  const msg = encodeURIComponent(`Hello ${name}, thank you for your interest. We have some great properties available for you.`);
  const num = phone.replace(/\D/g, '');
  return `https://wa.me/${num}?text=${msg}`;
}

// ─── Tag Pill ─────────────────────────────────────────────────────────────────

function TagPill({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#c9a84c18] border border-[#c9a84c30] text-[#c9a84c]">
      {label}
      {onRemove && (
        <button onClick={onRemove} className="hover:text-white transition-colors leading-none">×</button>
      )}
    </span>
  );
}

// ─── Client Profile Panel ─────────────────────────────────────────────────────

function ClientPanel({
  client: initial, isAdmin,
  onClose, onUpdated,
}: {
  client: Client; isAdmin: boolean;
  onClose: () => void; onUpdated: (c: Client) => void;
}) {
  const [client, setClient]     = useState<Client>(initial);
  const [saving, setSaving]     = useState(false);
  const [saveOk, setSaveOk]     = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [notes, setNotes]       = useState(initial.notes ?? '');

  useEffect(() => { setClient(initial); setNotes(initial.notes ?? ''); }, [initial]);

  const patch = useCallback(async (updates: Record<string, unknown>) => {
    setSaving(true); setSaveOk(false);
    const res  = await authedFetch(`/api/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (res.ok && data.client) {
      const updated = { ...data.client, inquiries: client.inquiries };
      setClient(updated);
      onUpdated(updated);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2000);
    }
    setSaving(false);
  }, [client]);

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (!t || client.tags.includes(t)) return;
    const next = [...client.tags, t];
    setClient(c => ({ ...c, tags: next }));
    patch({ tags: next });
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    const next = client.tags.filter(t => t !== tag);
    setClient(c => ({ ...c, tags: next }));
    patch({ tags: next });
  };

  const toggleOptIn = (field: 'whatsapp_opt_in' | 'email_opt_in') => {
    const next = !client[field];
    setClient(c => ({ ...c, [field]: next }));
    patch({ [field]: next });
  };

  const saveNotes = () => patch({ notes });

  const inqs = client.inquiries ?? [];
  const activeInqs = inqs.filter(i => !['won','lost','cancelled','closed'].includes(i.status));

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="relative w-full max-w-[520px] h-full bg-[#0d0d0d] border-l border-[#1e1e1e] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-[#1a1a1a]">
          <div className="w-12 h-12 rounded-xl bg-[#c9a84c18] border border-[#c9a84c30] flex items-center justify-center shrink-0">
            <span className="text-[#c9a84c] font-bold text-base">{initials(client.full_name)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-base truncate">{client.full_name}</h3>
            <div className="flex gap-3 mt-0.5">
              {client.phone && <span className="text-[#888] text-xs font-mono">{client.phone}</span>}
              {client.email && <span className="text-[#555] text-xs truncate">{client.email}</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-[#444] hover:text-[#888] transition-colors mt-0.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Quick contact buttons */}
          <div className="flex gap-2 flex-wrap">
            {client.phone && (
              <a
                href={waLink(client.phone, client.full_name)}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg bg-[#22c55e18] border border-[#22c55e30] text-[#22c55e] hover:bg-[#22c55e25] transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.524 3.659 1.438 5.168L2 22l4.985-1.41A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.95 7.95 0 01-4.29-1.254l-.308-.183-3.184.9.906-3.107-.2-.32A7.96 7.96 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z"/>
                </svg>
                WhatsApp
              </a>
            )}
            {client.email && (
              <a
                href={`mailto:${client.email}`}
                className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg bg-[#38bdf818] border border-[#38bdf830] text-[#38bdf8] hover:bg-[#38bdf825] transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path strokeLinecap="round" d="M2 7l10 6 10-6"/>
                </svg>
                Email
              </a>
            )}
            {client.phone && (
              <a
                href={`tel:${client.phone}`}
                className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg bg-[#a78bfa18] border border-[#a78bfa30] text-[#a78bfa] hover:bg-[#a78bfa25] transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.7A2 2 0 012.18 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.15a16 16 0 006.29 6.29l1.42-1.42a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                </svg>
                Call
              </a>
            )}
          </div>

          {/* Opt-in status */}
          <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4 space-y-3">
            <p className="text-[10px] text-[#555] uppercase tracking-wider font-semibold">Consent / Opt-in</p>
            {(['whatsapp_opt_in', 'email_opt_in'] as const).map(field => {
              const on = client[field];
              const atField = field === 'whatsapp_opt_in' ? 'whatsapp_opt_in_at' : 'email_opt_in_at';
              const at = client[atField];
              return (
                <div key={field} className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#e0e0e0] font-medium">
                      {field === 'whatsapp_opt_in' ? 'WhatsApp' : 'Email'} messages
                    </p>
                    {at && <p className="text-[10px] text-[#444]">Since {new Date(at).toLocaleDateString()}</p>}
                  </div>
                  <button
                    onClick={() => toggleOptIn(field)}
                    disabled={saving}
                    className={`w-10 h-5 rounded-full border transition-all flex items-center ${on ? 'bg-[#22c55e] border-[#22c55e]' : 'bg-[#1a1a1a] border-[#2a2a2a]'}`}
                  >
                    <span className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${on ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <p className="text-[10px] text-[#555] uppercase tracking-wider font-semibold">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {client.tags.map(t => (
                <TagPill key={t} label={t} onRemove={() => removeTag(t)} />
              ))}
              {client.tags.length === 0 && <span className="text-[11px] text-[#333]">No tags</span>}
            </div>
            <div className="flex gap-2 mt-2">
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } }}
                placeholder="Add tag…"
                list="preset-tags"
                className="flex-1 bg-[#111] border border-[#2a2a2a] text-[#e0e0e0] text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#c9a84c66] placeholder-[#444]"
              />
              <datalist id="preset-tags">
                {PRESET_TAGS.map(t => <option key={t} value={t} />)}
              </datalist>
              <button
                onClick={() => addTag(tagInput)}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#c9a84c18] border border-[#c9a84c30] text-[#c9a84c] hover:bg-[#c9a84c25] transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <p className="text-[10px] text-[#555] uppercase tracking-wider font-semibold">Notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Internal notes about this client…"
              className="w-full bg-[#111] border border-[#2a2a2a] text-[#e0e0e0] text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#c9a84c66] placeholder-[#444] resize-none"
            />
            <button
              onClick={saveNotes} disabled={saving || notes === (client.notes ?? '')}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#c9a84c18] border border-[#c9a84c30] text-[#c9a84c] hover:bg-[#c9a84c25] transition-colors disabled:opacity-40"
            >
              {saveOk ? '✓ Saved' : saving ? 'Saving…' : 'Save notes'}
            </button>
          </div>

          {/* Inquiry history */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-[#555] uppercase tracking-wider font-semibold">Inquiry History</p>
              <span className="text-[10px] text-[#444]">{inqs.length} total · {activeInqs.length} active</span>
            </div>
            {inqs.length === 0 ? (
              <p className="text-[11px] text-[#333] py-2">No inquiries linked.</p>
            ) : (
              <div className="space-y-1.5">
                {inqs.map(inq => (
                  <div key={inq.id} className="flex items-center justify-between bg-[#111] border border-[#1a1a1a] rounded-lg px-3 py-2">
                    <div>
                      <p className="text-[10px] font-mono text-[#f43f5e]">{inq.ref_no}</p>
                      <p className="text-xs text-[#888]">
                        {[inq.listing_type, inq.property_type, inq.config].filter(Boolean).join(' · ')}
                      </p>
                      {(inq.budget_min || inq.budget_max) && (
                        <p className="text-[10px] text-[#4ade80]">QAR {fmt(inq.budget_min ?? 0)}–{fmt(inq.budget_max ?? 0)}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: STATUS_COLOR[inq.status] ?? '#888', background: `${STATUS_COLOR[inq.status] ?? '#888'}18`, border: `1px solid ${STATUS_COLOR[inq.status] ?? '#888'}30` }}>
                        {inq.status}
                      </span>
                      {inq.match_count > 0 && (
                        <span className="text-[9px] text-[#f43f5e]">{inq.match_count} match{inq.match_count !== 1 ? 'es' : ''}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1a1a1a] flex items-center justify-between">
          <span className="text-[10px] text-[#333]">Client since {new Date(client.created_at).toLocaleDateString()}</span>
          {saveOk && <span className="text-[10px] text-[#22c55e] font-semibold">✓ Saved</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClientsDirectory({ onMenuClick }: { onMenuClick?: () => void }) {
  const { role } = useAuth();
  const isAdmin  = role === 'superuser' || role === 'administrator';

  const [clients,  setClients]  = useState<Client[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [optFilter, setOptFilter] = useState('');
  const [selected, setSelected] = useState<Client | null>(null);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [showBulkMsg, setShowBulkMsg] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (search)    params.set('search', search);
      if (tagFilter) params.set('tag', tagFilter);
      if (optFilter) params.set('opt_in', optFilter);
      const res  = await authedFetch(`/api/clients?${params}`);
      const data = await res.json();
      setClients(data.clients ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [search, tagFilter, optFilter]);

  useEffect(() => { load(); }, [load]);

  const handleUpdated = (updated: Client) => {
    setClients(prev => prev.map(c => c.id === updated.id ? updated : c));
    if (selected?.id === updated.id) setSelected(updated);
  };

  const allTags = Array.from(new Set(clients.flatMap(c => c.tags))).sort();

  const toggleBulk = (id: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const bulkClients = clients.filter(c => bulkSelected.has(c.id));
  const waOptedBulk = bulkClients.filter(c => c.whatsapp_opt_in && c.phone);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0]">
      <TopBar onMenuClick={onMenuClick} />

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Title */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Client Directory</h2>
            <p className="text-[#606060] text-sm mt-0.5">
              {total.toLocaleString()} client{total !== 1 ? 's' : ''} · sourced from Synergy inquiries
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setBulkMode(v => !v); setBulkSelected(new Set()); }}
              className={`text-xs font-semibold px-3.5 py-2 rounded-lg border transition-colors ${bulkMode ? 'bg-[#f43f5e18] border-[#f43f5e44] text-[#f43f5e]' : 'border-[#1e1e1e] text-[#555] hover:border-[#333] hover:text-[#888]'}`}
            >
              {bulkMode ? `Bulk: ${bulkSelected.size} selected` : 'Bulk select'}
            </button>
            {bulkMode && bulkSelected.size > 0 && (
              <button
                onClick={() => setShowBulkMsg(true)}
                className="text-xs font-semibold px-3.5 py-2 rounded-lg bg-[#22c55e18] border border-[#22c55e30] text-[#22c55e] hover:bg-[#22c55e25] transition-colors"
              >
                Message {bulkSelected.size} →
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Clients',      value: total,                                                                              color: 'text-[#e0e0e0]' },
            { label: 'WhatsApp Opted-in',  value: clients.filter(c => c.whatsapp_opt_in).length,                                     color: 'text-[#22c55e]' },
            { label: 'Email Opted-in',     value: clients.filter(c => c.email_opt_in).length,                                        color: 'text-[#38bdf8]' },
            { label: 'Active Inquiries',   value: clients.filter(c => (c.inquiries ?? []).some(i => !['won','lost','cancelled','closed'].includes(i.status))).length, color: 'text-[#f43f5e]' },
          ].map(s => (
            <div key={s.label} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4">
              <p className="text-[11px] text-[#555] uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filter row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444] pointer-events-none">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, phone or email…"
              className="w-full bg-[#0d0d0d] border border-[#1e1e1e] text-[#e0e0e0] text-sm rounded-lg pl-9 pr-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#c9a84c44] placeholder-[#444]"
            />
          </div>
          {allTags.length > 0 && (
            <select
              value={tagFilter} onChange={e => setTagFilter(e.target.value)}
              className="bg-[#0d0d0d] border border-[#1e1e1e] text-[#e0e0e0] text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#c9a84c66]"
            >
              <option value="">All Tags</option>
              {allTags.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          <select
            value={optFilter} onChange={e => setOptFilter(e.target.value)}
            className="bg-[#0d0d0d] border border-[#1e1e1e] text-[#e0e0e0] text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#c9a84c66]"
          >
            <option value="">All Opt-in</option>
            <option value="wa">WhatsApp opted-in</option>
            <option value="em">Email opted-in</option>
          </select>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : clients.length === 0 ? (
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-12 flex flex-col items-center gap-3">
            <div className="text-5xl">👥</div>
            <p className="text-sm text-[#555]">No clients found.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {clients.map(c => {
              const isBulked = bulkSelected.has(c.id);
              const inqCount = (c.inquiries ?? []).length;
              const activeCount = (c.inquiries ?? []).filter(i => !['won','lost','cancelled','closed'].includes(i.status)).length;
              return (
                <div
                  key={c.id}
                  onClick={() => bulkMode ? toggleBulk(c.id) : setSelected(c)}
                  className={`bg-[#0d0d0d] border rounded-xl p-4 cursor-pointer transition-colors group ${isBulked ? 'border-[#22c55e55] bg-[#0a150a]' : 'border-[#1a1a1a] hover:border-[#c9a84c33] hover:bg-[#0f0e09]'}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {bulkMode && (
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${isBulked ? 'bg-[#22c55e] border-[#22c55e]' : 'border-[#333]'}`}>
                          {isBulked && <svg viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth={2} className="w-2.5 h-2.5"><path d="M2 6l2.5 2.5L10 3"/></svg>}
                        </div>
                      )}
                      <div className="w-9 h-9 rounded-lg bg-[#c9a84c18] border border-[#c9a84c25] flex items-center justify-center shrink-0">
                        <span className="text-[#c9a84c] font-bold text-xs">{initials(c.full_name)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#e0e0e0] group-hover:text-white truncate">{c.full_name}</p>
                        {c.nationality && <p className="text-[10px] text-[#444]">{c.nationality}</p>}
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {c.whatsapp_opt_in && (
                        <span title="WhatsApp opted-in" className="text-[#22c55e]">
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 opacity-70">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 2C6.477 2 2 6.477 2 12c0 1.89.524 3.659 1.438 5.168L2 22l4.985-1.41A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
                          </svg>
                        </span>
                      )}
                      {c.email_opt_in && (
                        <span title="Email opted-in" className="text-[#38bdf8]">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5 opacity-70">
                            <rect x="2" y="4" width="20" height="16" rx="2"/>
                            <path strokeLinecap="round" d="M2 7l10 6 10-6"/>
                          </svg>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 mb-3">
                    {c.phone && <p className="text-xs font-mono text-[#666]">{c.phone}</p>}
                    {c.email && <p className="text-[11px] text-[#555] truncate">{c.email}</p>}
                  </div>

                  {c.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap mb-3">
                      {c.tags.slice(0, 3).map(t => <TagPill key={t} label={t} />)}
                      {c.tags.length > 3 && <span className="text-[9px] text-[#444]">+{c.tags.length - 3}</span>}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-[#131313]">
                    <span className="text-[10px] text-[#383838]">{inqCount} inq{inqCount !== 1 ? 's' : ''}</span>
                    {activeCount > 0 && (
                      <span className="text-[10px] font-bold text-[#f43f5e]">{activeCount} active</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Client profile panel */}
      {selected && !bulkMode && (
        <ClientPanel
          client={selected}
          isAdmin={isAdmin}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
        />
      )}

      {/* Bulk message modal */}
      {showBulkMsg && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowBulkMsg(false)}>
          <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-2xl p-6 w-full max-w-lg space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-semibold">Message {bulkSelected.size} clients</h3>

            <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4 space-y-2">
              <p className="text-xs text-[#888]">
                <span className="text-[#22c55e] font-semibold">{waOptedBulk.length}</span> of {bulkSelected.size} have WhatsApp opted-in with a phone number.
              </p>
              <p className="text-[11px] text-[#555]">
                Each link opens your WhatsApp with the contact and a pre-filled message. Works with any WhatsApp or WhatsApp Business account.
              </p>
            </div>

            {waOptedBulk.length > 0 && (
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {waOptedBulk.map(c => (
                  <a
                    key={c.id}
                    href={waLink(c.phone!, c.full_name)}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-[#22c55e0d] border border-[#22c55e20] hover:bg-[#22c55e18] transition-colors"
                  >
                    <span className="text-sm text-[#e0e0e0]">{c.full_name}</span>
                    <span className="text-xs font-mono text-[#22c55e]">{c.phone} ↗</span>
                  </a>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowBulkMsg(false)} className="text-xs text-[#555] hover:text-[#888] px-4 py-2">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
