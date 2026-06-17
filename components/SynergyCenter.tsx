'use client';
import React, { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Inquiry {
  id: string;
  ref_no: string;
  client_name: string;
  client_phone?: string;
  client_email?: string;
  client_nationality?: string;
  source?: string;
  listing_type?: string;
  property_type?: string;
  config?: string;
  bathrooms_min?: number;
  budget_min?: number;
  budget_max?: number;
  preferred_zones?: string[];
  furnishing?: string;
  status: 'new' | 'contacted' | 'viewing' | 'negotiating' | 'won' | 'lost';
  assigned_agent?: string;
  follow_up_date?: string;
  notes?: string;
  last_matched_at?: string;
  match_count: number;
  created_at: string;
}

interface InquiryMatch {
  id: string;
  inquiry_id: string;
  unit_id: string;
  unit_code: string;
  unit_snapshot: {
    property: string; unit_no: string; zone: string; zone_code: number;
    type: string; config: string; rent: number; bathrooms: number;
    furnishing: string; status: string; listing_type: string;
  };
  match_tier: 1 | 2 | 3;
  match_score: number;
  match_reasons: {
    budget: 'exact' | 'flex' | false;
    type: boolean | null;
    config: boolean | null;
    bathrooms: boolean | null;
    zone: 'exact' | false | null;
    furnishing: boolean | null;
  };
  is_shortlisted: boolean;
  shortlisted_at?: string;
  computed_at: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string;
  inquiry_id?: string;
  is_read: boolean;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('en-QA');

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  new:          { label: 'New',          color: '#94a3b8', bg: '#1e293b' },
  contacted:    { label: 'Contacted',    color: '#38bdf8', bg: '#0c1a26' },
  viewing:      { label: 'Viewing',      color: '#fbbf24', bg: '#1a1500' },
  negotiating:  { label: 'Negotiating', color: '#fb923c', bg: '#1a0f00' },
  won:          { label: 'Won',          color: '#4ade80', bg: '#0a1a0a' },
  lost:         { label: 'Lost',         color: '#f87171', bg: '#1a0a0a' },
};

const TIER_META = {
  1: { label: 'T1', color: '#4ade80', title: 'Exact Match' },
  2: { label: 'T2', color: '#fbbf24', title: '±10% Flex'  },
  3: { label: 'T3', color: '#94a3b8', title: 'Zone Buffer' },
};

const SOURCES = ['Walk-in','WhatsApp','Website','Referral','Bayut','Property Finder','Phone','Other'];
const STATUSES = ['new','contacted','viewing','negotiating','won','lost'];
const PROPERTY_TYPES = ['Apartment','Villa','Townhouse','Penthouse','Studio','Duplex','Office'];
const FURNISHING_OPTS = ['Fully Furnished','Semi-Furnished','Unfurnished'];

function Badge({ label, color, bg }: { label: string; color: string; bg?: string }) {
  return (
    <span style={{ color, background: bg ?? `${color}22`, border: `1px solid ${color}44` }}
      className="text-[10px] font-bold px-2 py-0.5 rounded-full">
      {label}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? '#4ade80' : score >= 40 ? '#fbbf24' : '#f87171';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-[#222] rounded-full overflow-hidden">
        <div style={{ width: `${score}%`, background: color }} className="h-full rounded-full" />
      </div>
      <span style={{ color }} className="text-[10px] font-bold">{score}%</span>
    </div>
  );
}

// ─── Inquiry Form ─────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  client_name: '', client_phone: '', client_email: '', client_nationality: '',
  source: '', listing_type: 'Rent', property_type: '', config: '',
  bathrooms_min: '', budget_min: '', budget_max: '',
  preferred_zones: '', furnishing: '', assigned_agent: '', follow_up_date: '', notes: '',
};

function InquiryForm({ onSave, onCancel, initial }: {
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  initial?: Partial<typeof EMPTY_FORM>;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload: Record<string, unknown> = {
      client_name:     form.client_name.trim(),
      client_phone:    form.client_phone   || null,
      client_email:    form.client_email   || null,
      client_nationality: form.client_nationality || null,
      source:          form.source         || null,
      listing_type:    form.listing_type   || null,
      property_type:   form.property_type  || null,
      config:          form.config         || null,
      bathrooms_min:   form.bathrooms_min  ? Number(form.bathrooms_min)  : null,
      budget_min:      form.budget_min     ? Number(form.budget_min)     : null,
      budget_max:      form.budget_max     ? Number(form.budget_max)     : null,
      preferred_zones: form.preferred_zones
        ? form.preferred_zones.split(',').map(z => z.trim()).filter(Boolean)
        : [],
      furnishing:      form.furnishing     || null,
      assigned_agent:  form.assigned_agent || null,
      follow_up_date:  form.follow_up_date || null,
      notes:           form.notes          || null,
    };
    await onSave(payload);
    setSaving(false);
  };

  const F = ({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) => (
    <div>
      <label className="block text-xs text-[#888] mb-1">{label}{required && <span className="text-rose-400 ml-0.5">*</span>}</label>
      {children}
    </div>
  );

  const inp = "w-full bg-[#111] border border-[#2a2a2a] text-[#e0e0e0] text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#f43f5e] placeholder-[#444]";
  const sel = `${inp} cursor-pointer`;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <F label="Client Name" required>
          <input required value={form.client_name} onChange={e => set('client_name', e.target.value)} className={inp} placeholder="Full name" />
        </F>
        <F label="Phone">
          <input value={form.client_phone} onChange={e => set('client_phone', e.target.value)} className={inp} placeholder="+974 xxxx xxxx" />
        </F>
        <F label="Email">
          <input type="email" value={form.client_email} onChange={e => set('client_email', e.target.value)} className={inp} placeholder="email@example.com" />
        </F>
        <F label="Nationality">
          <input value={form.client_nationality} onChange={e => set('client_nationality', e.target.value)} className={inp} placeholder="e.g. Qatari" />
        </F>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <F label="Source">
          <select value={form.source} onChange={e => set('source', e.target.value)} className={sel}>
            <option value="">Select source</option>
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </F>
        <F label="Listing Type">
          <select value={form.listing_type} onChange={e => set('listing_type', e.target.value)} className={sel}>
            <option value="Rent">Rent</option>
            <option value="Sale">Sale</option>
          </select>
        </F>
      </div>

      <div className="border-t border-[#1e1e1e] pt-4">
        <p className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-3">Requirements</p>
        <div className="grid grid-cols-2 gap-4">
          <F label="Property Type">
            <select value={form.property_type} onChange={e => set('property_type', e.target.value)} className={sel}>
              <option value="">Any</option>
              {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </F>
          <F label="Configuration">
            <input value={form.config} onChange={e => set('config', e.target.value)} className={inp} placeholder="e.g. 2 BHK, Studio" />
          </F>
          <F label="Min Bathrooms">
            <input type="number" min={0} value={form.bathrooms_min} onChange={e => set('bathrooms_min', e.target.value)} className={inp} placeholder="e.g. 2" />
          </F>
          <F label="Furnishing">
            <select value={form.furnishing} onChange={e => set('furnishing', e.target.value)} className={sel}>
              <option value="">Any</option>
              {FURNISHING_OPTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </F>
          <F label="Budget Min (QAR)">
            <input type="number" min={0} value={form.budget_min} onChange={e => set('budget_min', e.target.value)} className={inp} placeholder="e.g. 5000" />
          </F>
          <F label="Budget Max (QAR)">
            <input type="number" min={0} value={form.budget_max} onChange={e => set('budget_max', e.target.value)} className={inp} placeholder="e.g. 8000" />
          </F>
        </div>
        <div className="mt-4">
          <F label="Preferred Zones (comma-separated)">
            <input value={form.preferred_zones} onChange={e => set('preferred_zones', e.target.value)} className={inp} placeholder="e.g. The Pearl, West Bay, Lusail" />
          </F>
        </div>
      </div>

      <div className="border-t border-[#1e1e1e] pt-4">
        <p className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-3">Assignment</p>
        <div className="grid grid-cols-2 gap-4">
          <F label="Assigned Agent">
            <input value={form.assigned_agent} onChange={e => set('assigned_agent', e.target.value)} className={inp} placeholder="Agent name" />
          </F>
          <F label="Follow-up Date">
            <input type="date" value={form.follow_up_date} onChange={e => set('follow_up_date', e.target.value)} className={inp} />
          </F>
        </div>
        <div className="mt-4">
          <F label="Notes">
            <textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} className={`${inp} resize-none`} placeholder="Additional notes..." />
          </F>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-[#888] hover:text-[#ccc] transition-colors">Cancel</button>
        <button type="submit" disabled={saving} className="px-5 py-2 bg-[#f43f5e] text-white text-sm font-semibold rounded-lg hover:bg-[#e11d48] disabled:opacity-40 transition-colors">
          {saving ? 'Saving…' : 'Save Inquiry'}
        </button>
      </div>
    </form>
  );
}

// ─── Matching Units Grid ───────────────────────────────────────────────────────

function MatchingGrid({ inquiryId, onClose }: { inquiryId: string; onClose: () => void }) {
  const [matches, setMatches]   = useState<InquiryMatch[]>([]);
  const [loading, setLoading]   = useState(true);
  const [running, setRunning]   = useState(false);
  const [filter, setFilter]     = useState<'all' | 1 | 2 | 3>('all');

  const loadMatches = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/inquiries/${inquiryId}/match`);
    const data = await res.json();
    setMatches(data.matches ?? []);
    setLoading(false);
  }, [inquiryId]);

  useEffect(() => { loadMatches(); }, [loadMatches]);

  const rerun = async () => {
    setRunning(true);
    await fetch(`/api/inquiries/${inquiryId}/match`, { method: 'POST' });
    await loadMatches();
    setRunning(false);
  };

  const toggleShortlist = async (match: InquiryMatch) => {
    const res = await fetch(`/api/inquiries/${inquiryId}/shortlist`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId: match.id, shortlisted: !match.is_shortlisted }),
    });
    const data = await res.json();
    if (data.match) {
      setMatches(prev => prev.map(m => m.id === match.id ? { ...m, is_shortlisted: data.match.is_shortlisted } : m));
    }
  };

  const visible = filter === 'all' ? matches : matches.filter(m => m.match_tier === filter);
  const shortlisted = matches.filter(m => m.is_shortlisted).length;
  const tier1 = matches.filter(m => m.match_tier === 1).length;
  const tier2 = matches.filter(m => m.match_tier === 2).length;
  const tier3 = matches.filter(m => m.match_tier === 3).length;

  return (
    <div className="flex flex-col h-full">
      {/* Grid header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-[#e0e0e0]">Matching Units</h3>
          <div className="flex gap-1.5">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#4ade8022] text-[#4ade80] border border-[#4ade8044]">T1 {tier1}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#fbbf2422] text-[#fbbf24] border border-[#fbbf2444]">T2 {tier2}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#94a3b822] text-[#94a3b8] border border-[#94a3b844]">T3 {tier3}</span>
            {shortlisted > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f43f5e22] text-[#f43f5e] border border-[#f43f5e44]">⭐ {shortlisted}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Tier filter */}
          <div className="flex bg-[#111] border border-[#222] rounded-lg overflow-hidden text-xs">
            {(['all', 1, 2, 3] as const).map(t => (
              <button key={t} onClick={() => setFilter(t)}
                className={`px-3 py-1.5 font-medium transition-colors ${filter === t ? 'bg-[#f43f5e] text-white' : 'text-[#666] hover:text-[#ccc]'}`}>
                {t === 'all' ? 'All' : `T${t}`}
              </button>
            ))}
          </div>
          <button onClick={rerun} disabled={running}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1a] border border-[#333] text-[#aaa] text-xs rounded-lg hover:border-[#f43f5e] hover:text-[#f43f5e] transition-colors disabled:opacity-40">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {running ? 'Running…' : 'Re-run'}
          </button>
        </div>
      </div>

      {/* Grid body */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#f43f5e] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
          <div className="text-3xl mb-3">🔍</div>
          <p className="text-sm text-[#666]">{matches.length === 0 ? 'No matches yet — click Re-run to search.' : 'No matches in this tier.'}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {visible.map(m => {
            const snap = m.unit_snapshot;
            const tier = TIER_META[m.match_tier];
            return (
              <div key={m.id} className={`border rounded-xl p-3 transition-colors ${m.is_shortlisted ? 'border-[#f43f5e44] bg-[#f43f5e08]' : 'border-[#1e1e1e] bg-[#111] hover:border-[#2a2a2a]'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span style={{ color: tier.color, background: `${tier.color}22`, border: `1px solid ${tier.color}44` }}
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded" title={tier.title}>
                        {tier.label}
                      </span>
                      <span className="text-xs font-mono text-[#c9a84c]">{m.unit_code}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] shrink-0" title="Available" />
                    </div>
                    <p className="text-sm font-medium text-[#e0e0e0] truncate">{snap.property} · {snap.unit_no}</p>
                    <p className="text-xs text-[#666] mt-0.5">{snap.zone} · {snap.type} · {snap.config}</p>
                    <p className="text-sm font-semibold text-[#c9a84c] mt-1">QAR {fmt(snap.rent)}<span className="text-xs font-normal text-[#555]">/mo</span></p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <button onClick={() => toggleShortlist(m)}
                      title={m.is_shortlisted ? 'Remove from shortlist' : 'Add to shortlist'}
                      className={`p-1.5 rounded-lg transition-colors ${m.is_shortlisted ? 'text-[#f43f5e] bg-[#f43f5e15]' : 'text-[#444] hover:text-[#f43f5e] hover:bg-[#f43f5e10]'}`}>
                      <svg viewBox="0 0 24 24" fill={m.is_shortlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </button>
                    <ScoreBar score={Math.round(m.match_score)} />
                  </div>
                </div>
                {/* Match reason chips */}
                <div className="flex gap-1 mt-2 flex-wrap">
                  {m.match_reasons.budget && (
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${m.match_reasons.budget === 'exact' ? 'bg-[#4ade8022] text-[#4ade80]' : 'bg-[#fbbf2422] text-[#fbbf24]'}`}>
                      Budget {m.match_reasons.budget}
                    </span>
                  )}
                  {m.match_reasons.zone === 'exact' && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#38bdf822] text-[#38bdf8]">Zone ✓</span>}
                  {m.match_reasons.type === true && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#a78bfa22] text-[#a78bfa]">Type ✓</span>}
                  {m.match_reasons.config === true && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#fb923c22] text-[#fb923c]">Config ✓</span>}
                  {m.match_reasons.bathrooms === true && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#e879f922] text-[#e879f9]">Bath ✓</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Inquiry Detail Drawer ────────────────────────────────────────────────────

function InquiryDrawer({ inquiry, onClose, onUpdate }: {
  inquiry: Inquiry;
  onClose: () => void;
  onUpdate: (updated: Inquiry) => void;
}) {
  const [tab, setTab] = useState<'matches' | 'details'>('matches');
  const [status, setStatus] = useState(inquiry.status);
  const [saving, setSaving] = useState(false);

  const updateStatus = async (s: string) => {
    setStatus(s as Inquiry['status']);
    setSaving(true);
    const res = await fetch(`/api/inquiries/${inquiry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: s }),
    });
    const data = await res.json();
    if (data.inquiry) onUpdate(data.inquiry);
    setSaving(false);
  };

  const sm = STATUS_META[status] ?? STATUS_META.new;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-[#0d0d0d] border-l border-[#1e1e1e] flex flex-col shadow-2xl overflow-hidden">
        {/* Drawer header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#1e1e1e] shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-[#f43f5e]">{inquiry.ref_no}</span>
              <Badge label={sm.label} color={sm.color} bg={sm.bg} />
            </div>
            <h2 className="text-base font-semibold text-[#e0e0e0]">{inquiry.client_name}</h2>
            <p className="text-xs text-[#666] mt-0.5">
              {inquiry.client_phone && <span className="mr-3">{inquiry.client_phone}</span>}
              {inquiry.client_email && <span>{inquiry.client_email}</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-[#555] hover:text-[#ccc] rounded-lg hover:bg-[#1a1a1a] transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Requirements bar */}
        <div className="px-5 py-2.5 bg-[#111] border-b border-[#1a1a1a] flex gap-4 text-xs text-[#888] flex-wrap shrink-0">
          {inquiry.listing_type  && <span><span className="text-[#555]">Type</span> <span className="text-[#c9a84c] font-medium">{inquiry.listing_type}</span></span>}
          {inquiry.property_type && <span><span className="text-[#555]">Prop</span> <span className="text-[#aaa]">{inquiry.property_type}</span></span>}
          {inquiry.config        && <span><span className="text-[#555]">Config</span> <span className="text-[#aaa]">{inquiry.config}</span></span>}
          {(inquiry.budget_min || inquiry.budget_max) && (
            <span><span className="text-[#555]">Budget</span> <span className="text-[#4ade80] font-medium">QAR {fmt(inquiry.budget_min ?? 0)}–{fmt(inquiry.budget_max ?? 0)}</span></span>
          )}
          {(inquiry.preferred_zones?.length ?? 0) > 0 && (
            <span><span className="text-[#555]">Zones</span> <span className="text-[#38bdf8]">{inquiry.preferred_zones?.join(', ')}</span></span>
          )}
          {inquiry.match_count > 0 && (
            <span className="ml-auto font-semibold text-[#f43f5e]">{inquiry.match_count} match{inquiry.match_count !== 1 ? 'es' : ''}</span>
          )}
        </div>

        {/* Pipeline status row */}
        <div className="px-5 py-3 border-b border-[#1a1a1a] shrink-0">
          <div className="flex gap-1.5 flex-wrap">
            {STATUSES.map(s => {
              const m = STATUS_META[s];
              const active = s === status;
              return (
                <button key={s} onClick={() => updateStatus(s)} disabled={saving}
                  style={active ? { background: m.bg, borderColor: m.color, color: m.color } : {}}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${active ? 'font-semibold' : 'border-[#222] text-[#555] hover:border-[#444] hover:text-[#888]'}`}>
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-[#1a1a1a] shrink-0">
          {(['matches', 'details'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-3 text-xs font-semibold capitalize transition-colors border-b-2 ${tab === t ? 'border-[#f43f5e] text-[#f43f5e]' : 'border-transparent text-[#555] hover:text-[#888]'}`}>
              {t === 'matches' ? `Matching Units${inquiry.match_count > 0 ? ` (${inquiry.match_count})` : ''}` : 'Details'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden p-5">
          {tab === 'matches' ? (
            <MatchingGrid inquiryId={inquiry.id} onClose={onClose} />
          ) : (
            <div className="space-y-3 text-sm overflow-y-auto h-full">
              {[
                ['Source', inquiry.source],
                ['Nationality', inquiry.client_nationality],
                ['Furnishing', inquiry.furnishing],
                ['Bathrooms min', inquiry.bathrooms_min],
                ['Assigned Agent', inquiry.assigned_agent],
                ['Follow-up', inquiry.follow_up_date],
                ['Last Matched', inquiry.last_matched_at ? new Date(inquiry.last_matched_at).toLocaleString() : '—'],
                ['Created', new Date(inquiry.created_at).toLocaleString()],
              ].map(([k, v]) => v ? (
                <div key={k as string} className="flex gap-4">
                  <span className="text-[#555] w-28 shrink-0">{k}</span>
                  <span className="text-[#ccc]">{String(v)}</span>
                </div>
              ) : null)}
              {inquiry.notes && (
                <div className="mt-4 p-3 bg-[#111] border border-[#1e1e1e] rounded-lg">
                  <p className="text-xs text-[#555] mb-1">Notes</p>
                  <p className="text-sm text-[#aaa]">{inquiry.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Notifications Panel ──────────────────────────────────────────────────────

const NOTIF_ICONS: Record<string, string> = {
  new_match:   '🎯',
  unit_blocked:'🔴',
  new_inquiry: '📥',
  daily_digest:'📊',
  follow_up:   '⏰',
};

function NotificationsPanel() {
  const [notifs, setNotifs]   = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res  = await fetch('/api/notifications');
    const data = await res.json();
    setNotifs(data.notifications ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const markRead = async (ids?: string[]) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids ? { ids } : { markAll: true }),
    });
    setNotifs(prev => prev.map(n => (!ids || ids.includes(n.id)) ? { ...n, is_read: true } : n));
  };

  const unread = notifs.filter(n => !n.is_read).length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[#e0e0e0]">Notifications</h3>
          {unread > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f43f5e] text-white">{unread}</span>}
        </div>
        {unread > 0 && (
          <button onClick={() => markRead()} className="text-xs text-[#f43f5e] hover:underline">Mark all read</button>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#f43f5e] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notifs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="text-4xl mb-3">🔔</div>
          <p className="text-sm text-[#555]">No notifications yet.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2">
          {notifs.map(n => (
            <div key={n.id} onClick={() => !n.is_read && markRead([n.id])}
              className={`p-3 rounded-xl border transition-colors cursor-pointer ${n.is_read ? 'border-[#1a1a1a] bg-[#0d0d0d] opacity-60' : 'border-[#2a1a1f] bg-[#140810] hover:border-[#f43f5e33]'}`}>
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0">{NOTIF_ICONS[n.type] ?? '🔔'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-xs font-semibold ${n.is_read ? 'text-[#666]' : 'text-[#e0e0e0]'}`}>{n.title}</p>
                    {!n.is_read && <div className="w-2 h-2 rounded-full bg-[#f43f5e] shrink-0 mt-0.5" />}
                  </div>
                  {n.body && <p className="text-xs text-[#555] mt-0.5 line-clamp-2">{n.body}</p>}
                  <p className="text-[10px] text-[#444] mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const PIPELINE_STATUSES = ['all', ...STATUSES] as const;

export default function SynergyCenter({ onMenuClick }: { onMenuClick?: () => void }) {
  const [tab, setTab]                   = useState<'inquiries' | 'notifications'>('inquiries');
  const [inquiries, setInquiries]       = useState<Inquiry[]>([]);
  const [loading, setLoading]           = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch]             = useState('');
  const [showForm, setShowForm]         = useState(false);
  const [selected, setSelected]         = useState<Inquiry | null>(null);
  const [unreadCount, setUnreadCount]   = useState(0);

  const load = async () => {
    setLoading(true);
    const res  = await fetch('/api/inquiries');
    const data = await res.json();
    setInquiries(data.inquiries ?? []);
    setLoading(false);
  };

  const loadUnread = async () => {
    const res  = await fetch('/api/notifications?unread=true');
    const data = await res.json();
    setUnreadCount(data.unreadCount ?? 0);
  };

  useEffect(() => { load(); loadUnread(); }, []);

  const createInquiry = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/inquiries', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.inquiry) {
      setInquiries(prev => [data.inquiry, ...prev]);
      setShowForm(false);
      // Auto-run matching
      fetch(`/api/inquiries/${data.inquiry.id}/match`, { method: 'POST' })
        .then(() => load());
    }
  };

  const filtered = inquiries.filter(i => {
    const matchStatus = statusFilter === 'all' || i.status === statusFilter;
    const matchSearch = !search || i.client_name.toLowerCase().includes(search.toLowerCase())
      || i.ref_no?.toLowerCase().includes(search.toLowerCase())
      || i.client_phone?.includes(search);
    return matchStatus && matchSearch;
  });

  const stats = {
    total:    inquiries.length,
    open:     inquiries.filter(i => !['won','lost'].includes(i.status)).length,
    won:      inquiries.filter(i => i.status === 'won').length,
    matches:  inquiries.reduce((s, i) => s + (i.match_count ?? 0), 0),
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0]">
      {/* ── Page header ── */}
      <header className="sticky top-0 z-30 bg-[#0d0d0d] border-b border-[#1a1a1a] px-4 sm:px-6 py-3 flex items-center gap-4">
        <button onClick={onMenuClick} className="lg:hidden p-2 rounded-lg text-[#888] hover:text-[#c9a84c] hover:bg-[#1a1a1a] transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="w-5 h-5">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-[#e0e0e0]">Synergy Center</h1>
          <p className="text-[11px] text-[#555]">Inquiry Matching & Auto-Shortlist Engine</p>
        </div>
        {/* Stats pills */}
        <div className="hidden sm:flex items-center gap-2 text-xs">
          <span className="px-3 py-1 rounded-full bg-[#1a1a1a] text-[#888]">{stats.total} Inquiries</span>
          <span className="px-3 py-1 rounded-full bg-[#f43f5e15] text-[#f43f5e] border border-[#f43f5e22]">{stats.open} Open</span>
          <span className="px-3 py-1 rounded-full bg-[#4ade8015] text-[#4ade80] border border-[#4ade8022]">{stats.matches} Matches</span>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#f43f5e] text-white text-sm font-semibold rounded-lg hover:bg-[#e11d48] transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          New Inquiry
        </button>
      </header>

      {/* ── Tab bar ── */}
      <div className="flex border-b border-[#1a1a1a] px-4 sm:px-6">
        <button onClick={() => setTab('inquiries')}
          className={`px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${tab === 'inquiries' ? 'border-[#f43f5e] text-[#f43f5e]' : 'border-transparent text-[#555] hover:text-[#888]'}`}>
          Inquiries
        </button>
        <button onClick={() => { setTab('notifications'); loadUnread(); }}
          className={`relative px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${tab === 'notifications' ? 'border-[#f43f5e] text-[#f43f5e]' : 'border-transparent text-[#555] hover:text-[#888]'}`}>
          Notifications
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#f43f5e] text-white text-[9px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      <main className="px-4 sm:px-6 py-5">
        {tab === 'inquiries' ? (
          <>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, ref, phone…"
                className="flex-1 bg-[#111] border border-[#222] text-[#e0e0e0] text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#f43f5e] placeholder-[#444]"
              />
              <div className="flex gap-1.5 overflow-x-auto">
                {PIPELINE_STATUSES.map(s => {
                  const m = s === 'all' ? null : STATUS_META[s];
                  const active = statusFilter === s;
                  return (
                    <button key={s} onClick={() => setStatusFilter(s)}
                      style={active && m ? { background: m.bg, borderColor: m.color, color: m.color } : {}}
                      className={`shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors capitalize ${active && !m ? 'bg-[#f43f5e] text-white border-[#f43f5e]' : !active ? 'border-[#222] text-[#555] hover:border-[#444] hover:text-[#888]' : ''}`}>
                      {s === 'all' ? 'All' : STATUS_META[s].label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Inquiry list */}
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="w-8 h-8 border-2 border-[#f43f5e] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="text-5xl mb-4">📋</div>
                <p className="text-sm text-[#555]">{inquiries.length === 0 ? 'No inquiries yet. Click "+ New Inquiry" to get started.' : 'No inquiries match your filter.'}</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map(inq => {
                  const sm2 = STATUS_META[inq.status] ?? STATUS_META.new;
                  return (
                    <div key={inq.id} onClick={() => setSelected(inq)}
                      className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4 cursor-pointer hover:border-[#f43f5e44] hover:bg-[#110810] transition-colors group">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-[10px] font-mono text-[#f43f5e] mb-0.5">{inq.ref_no}</p>
                          <p className="text-sm font-semibold text-[#e0e0e0] group-hover:text-white">{inq.client_name}</p>
                        </div>
                        <Badge label={sm2.label} color={sm2.color} bg={sm2.bg} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#555] mb-3">
                        {inq.listing_type && <span>{inq.listing_type}</span>}
                        {inq.property_type && <span>· {inq.property_type}</span>}
                        {inq.config && <span>· {inq.config}</span>}
                      </div>
                      {(inq.budget_min || inq.budget_max) && (
                        <p className="text-xs text-[#4ade80] font-medium mb-2">
                          QAR {fmt(inq.budget_min ?? 0)} – {fmt(inq.budget_max ?? 0)}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-[10px] text-[#444]">{new Date(inq.created_at).toLocaleDateString()}</p>
                        {inq.match_count > 0 ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f43f5e22] text-[#f43f5e] border border-[#f43f5e44]">
                            {inq.match_count} match{inq.match_count !== 1 ? 'es' : ''}
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#333]">No matches</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="max-w-2xl mx-auto" style={{ height: 'calc(100vh - 140px)' }}>
            <NotificationsPanel />
          </div>
        )}
      </main>

      {/* ── New Inquiry Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm py-8 px-4">
          <div className="w-full max-w-2xl bg-[#0d0d0d] border border-[#1e1e1e] rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e1e]">
              <div>
                <h2 className="text-base font-bold text-[#e0e0e0]">New Inquiry</h2>
                <p className="text-xs text-[#555]">Auto-matching runs after save</p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-2 text-[#555] hover:text-[#ccc] rounded-lg hover:bg-[#1a1a1a] transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5">
              <InquiryForm onSave={createInquiry} onCancel={() => setShowForm(false)} />
            </div>
          </div>
        </div>
      )}

      {/* ── Inquiry Detail Drawer ── */}
      {selected && (
        <InquiryDrawer
          inquiry={selected}
          onClose={() => setSelected(null)}
          onUpdate={updated => {
            setSelected(updated);
            setInquiries(prev => prev.map(i => i.id === updated.id ? updated : i));
          }}
        />
      )}
    </div>
  );
}
