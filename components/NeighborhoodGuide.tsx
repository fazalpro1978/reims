'use client';

import React, { useState, useEffect } from 'react';
import { authedFetch } from '../lib/authedFetch';

// ── Types ─────────────────────────────────────────────────────────────────────

export type NCard = {
  id: string;
  name: string;
  subcategory: string;
  distance: string;
  rating: number | null;
  notes: string;
  mapsUrl: string;
};

export type NGuide = {
  lifestyle: NCard[];
  parks: NCard[];
  commute: NCard[];
};

type Pillar = keyof NGuide;
type FormFields = { name: string; subcategory: string; distance: string; rating: string; notes: string; mapsUrl: string };

// ── Constants ─────────────────────────────────────────────────────────────────

const PILLAR_LABELS: Record<Pillar, string> = {
  lifestyle: 'Lifestyle & Family Infrastructure',
  parks:     'Parks & Outdoor Spaces',
  commute:   'Logistics & Commuting',
};

const PILLAR_ACCENTS: Record<Pillar, string> = {
  lifestyle: '#c9a84c',
  parks:     '#4ade80',
  commute:   '#60a5fa',
};

const SUBCATS: Record<Pillar, string[]> = {
  lifestyle: [
    'Shopping Mall', 'Hypermarket / Supermarket', 'International School',
    'Private School', 'Nursery / Preschool', 'Cinema / Entertainment',
    'Restaurant / Dining', 'Mosque', 'Clinic / Medical Centre', 'Community Centre',
  ],
  parks: [
    'Family Park', 'Community Park', 'Waterfront / Corniche', 'Walking Track',
    'Cycling Path', 'Sports Facility', 'Public Beach', 'Public Garden', 'Playground',
  ],
  commute: [
    'Government Hospital', 'Private Hospital', 'Metro Station', 'Bus Stop',
    'Hamad International Airport', 'Highway Access', 'Ferry Terminal',
  ],
};

const PILLAR_ICONS: Record<Pillar, React.ReactNode> = {
  lifestyle: (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  ),
  parks: (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  commute: (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  ),
};

const emptyForm = (pillar: Pillar): FormFields => ({
  name: '', subcategory: SUBCATS[pillar][0], distance: '', rating: '', notes: '', mapsUrl: '',
});

// ── Sub-components ────────────────────────────────────────────────────────────

function StarRating({ value }: { value: number | null }) {
  if (value == null) return null;
  const full  = Math.floor(value);
  const half  = value - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span className="text-[#c9a84c] text-[10px] leading-none" title={`${value}/5`}>
      {'★'.repeat(full)}{half ? '½' : ''}{'☆'.repeat(empty)}
      <span className="ml-1 text-[#888888] font-mono">{value.toFixed(1)}</span>
    </span>
  );
}

function CardRow({
  card, pillar, isAdmin, onEdit, onDelete,
}: {
  card: NCard; pillar: Pillar; isAdmin: boolean;
  onEdit: (c: NCard) => void; onDelete: (id: string) => void;
}) {
  const accent = PILLAR_ACCENTS[pillar];
  return (
    <div className="flex items-start gap-2.5 py-2.5 border-b border-[#1e1e1e] last:border-0 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-[#e0e0e0]">{card.name}</span>
          <span
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full border"
            style={{ color: accent, borderColor: `${accent}40`, background: `${accent}12` }}
          >
            {card.subcategory}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {card.distance && (
            <span className="text-[11px] text-[#888888] flex items-center gap-1">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {card.distance}
            </span>
          )}
          <StarRating value={card.rating} />
        </div>
        {card.notes && <p className="text-[11px] text-[#666666] mt-0.5 leading-relaxed">{card.notes}</p>}
        {card.mapsUrl && (
          <a
            href={card.mapsUrl} target="_blank" rel="noopener noreferrer"
            className="text-[11px] text-blue-400 hover:text-blue-300 mt-0.5 inline-flex items-center gap-0.5"
          >
            View on Maps
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>
      {isAdmin && (
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button" onClick={() => onEdit(card)}
            className="p-1 rounded text-[#555555] hover:text-[#c9a84c] hover:bg-[#c9a84c]/10 transition-colors"
            title="Edit"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            type="button" onClick={() => onDelete(card.id)}
            className="p-1 rounded text-[#555555] hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Delete"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

function CardForm({
  pillar, form, onChange, onSubmit, onCancel, isEditing,
}: {
  pillar: Pillar;
  form: FormFields;
  onChange: (f: Partial<FormFields>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isEditing: boolean;
}) {
  const accent = PILLAR_ACCENTS[pillar];
  const inputCls = "w-full text-xs text-[#e0e0e0] bg-[#0f0f0f] border border-[#333333] rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:border-[#c9a84c] placeholder-[#444444]";

  return (
    <div className="mt-2 p-3 rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className="text-[9px] font-bold text-[#555555] uppercase tracking-wider mb-1 block">Place Name *</label>
          <input
            type="text" placeholder="e.g. Villaggio Mall" value={form.name}
            onChange={e => onChange({ name: e.target.value })}
            className={inputCls}
            autoFocus
          />
        </div>
        <div className="col-span-2">
          <label className="text-[9px] font-bold text-[#555555] uppercase tracking-wider mb-1 block">Category</label>
          <select
            value={form.subcategory}
            onChange={e => onChange({ subcategory: e.target.value })}
            className={inputCls + ' bg-[#0f0f0f]'}
          >
            {SUBCATS[pillar].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[9px] font-bold text-[#555555] uppercase tracking-wider mb-1 block">Distance</label>
          <input
            type="text" placeholder="e.g. 1.2 km" value={form.distance}
            onChange={e => onChange({ distance: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-[9px] font-bold text-[#555555] uppercase tracking-wider mb-1 block">Rating (0–5)</label>
          <input
            type="number" min={0} max={5} step={0.1} placeholder="4.5" value={form.rating}
            onChange={e => onChange({ rating: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="col-span-2">
          <label className="text-[9px] font-bold text-[#555555] uppercase tracking-wider mb-1 block">Notes (optional)</label>
          <input
            type="text" placeholder="Short description" value={form.notes}
            onChange={e => onChange({ notes: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="col-span-2">
          <label className="text-[9px] font-bold text-[#555555] uppercase tracking-wider mb-1 block">Google Maps URL (optional)</label>
          <input
            type="text" placeholder="https://maps.app.goo.gl/..." value={form.mapsUrl}
            onChange={e => onChange({ mapsUrl: e.target.value })}
            className={inputCls}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button" onClick={onSubmit}
          disabled={!form.name.trim()}
          className="px-3 py-1.5 text-xs font-bold rounded-md transition-colors disabled:opacity-40"
          style={{ background: accent, color: '#0f0f0f' }}
        >
          {isEditing ? 'Update' : 'Add Place'}
        </button>
        <button
          type="button" onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-[#666666] hover:text-[#888888] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NeighborhoodGuide({
  unitUuid,
  zoneCode,
  isAdmin,
}: {
  unitUuid: string;
  zoneCode: number;
  isAdmin: boolean;
}) {
  const [guide, setGuide] = useState<NGuide>({ lifestyle: [], parks: [], commute: [] });
  const [source, setSource]   = useState<'unit' | 'zone' | 'none'>('none');
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const [addingTo,   setAddingTo]  = useState<Pillar | null>(null);
  const [editingId,  setEditingId] = useState<string | null>(null);
  const [form, setForm]            = useState<FormFields>(emptyForm('lifestyle'));

  useEffect(() => {
    setLoading(true);
    setGuide({ lifestyle: [], parks: [], commute: [] });
    setSource('none');
    setAddingTo(null);
    setEditingId(null);
    if (!zoneCode) { setLoading(false); return; }
    fetch(`/api/neighborhood?unitUuid=${encodeURIComponent(unitUuid)}&zoneCode=${zoneCode}`)
      .then(r => r.json())
      .then(({ data, source: s }) => {
        if (data) {
          setGuide({ lifestyle: data.lifestyle_data ?? [], parks: data.parks_data ?? [], commute: data.commute_data ?? [] });
          setSource(s);
        } else {
          setSource('none');
        }
      })
      .catch(() => setSource('none'))
      .finally(() => setLoading(false));
  }, [unitUuid, zoneCode]);

  const doSave = async (asZoneLevel: boolean) => {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await authedFetch('/api/neighborhood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitUuid, zoneCode, isZoneLevel: asZoneLevel, lifestyle: guide.lifestyle, parks: guide.parks, commute: guide.commute }),
      });
      const { error } = await res.json();
      if (error) throw new Error(error);
      setSource(asZoneLevel ? 'zone' : 'unit');
      setSaveMsg(asZoneLevel ? `Saved as Zone ${zoneCode} shared guide` : 'Guide saved for this property');
      setTimeout(() => setSaveMsg(''), 3500);
    } catch (e: unknown) {
      setSaveMsg('Save failed: ' + (e instanceof Error ? e.message : 'unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const startAdd = (pillar: Pillar) => { setAddingTo(pillar); setEditingId(null); setForm(emptyForm(pillar)); };
  const startEdit = (pillar: Pillar, card: NCard) => {
    setAddingTo(pillar); setEditingId(card.id);
    setForm({ name: card.name, subcategory: card.subcategory, distance: card.distance, rating: card.rating != null ? String(card.rating) : '', notes: card.notes, mapsUrl: card.mapsUrl });
  };
  const cancelForm = () => { setAddingTo(null); setEditingId(null); };

  const submitForm = (pillar: Pillar) => {
    if (!form.name.trim()) return;
    const card: NCard = {
      id: editingId ?? crypto.randomUUID(),
      name: form.name.trim(),
      subcategory: form.subcategory,
      distance: form.distance.trim(),
      rating: form.rating !== '' ? Math.min(5, Math.max(0, parseFloat(form.rating))) : null,
      notes: form.notes.trim(),
      mapsUrl: form.mapsUrl.trim(),
    };
    setGuide(prev => ({
      ...prev,
      [pillar]: editingId
        ? prev[pillar].map(c => c.id === editingId ? card : c)
        : [...prev[pillar], card],
    }));
    cancelForm();
  };

  const deleteCard = (pillar: Pillar, id: string) => {
    setGuide(prev => ({ ...prev, [pillar]: prev[pillar].filter(c => c.id !== id) }));
  };

  const totalCards = guide.lifestyle.length + guide.parks.length + guide.commute.length;

  return (
    <div className="rounded-xl border border-[#2a2a2a] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 bg-[#111111] border-b border-[#2a2a2a] flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[#666666] uppercase tracking-wider">Neighborhood Guide</h3>
        <div className="flex items-center gap-2">
          {!loading && (
            <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${
              source === 'unit' ? 'border-[#c9a84c]/30 bg-[#c9a84c]/8 text-[#c9a84c]' :
              source === 'zone' ? 'border-blue-500/30 bg-blue-500/8 text-blue-400' :
                                  'border-[#333333] text-[#555555]'
            }`}>
              {source === 'unit' ? 'Property-specific' : source === 'zone' ? `Zone ${zoneCode} shared` : 'No guide yet'}
            </span>
          )}
          {!loading && totalCards > 0 && (
            <span className="text-[9px] text-[#555555] font-mono">{totalCards} place{totalCards !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="px-4 py-6 text-center text-xs text-[#555555]">Loading neighborhood data…</div>
      ) : (
        <div className="px-4 py-3 space-y-4">
          {/* Zone guide banner */}
          {source === 'zone' && isAdmin && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/8 border border-blue-500/20 text-[11px] text-blue-300">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Showing Zone {zoneCode} shared guide. Edit and save to create a property-specific version.
            </div>
          )}

          {/* Three pillars */}
          {(['lifestyle', 'parks', 'commute'] as Pillar[]).map(pillar => {
            const accent    = PILLAR_ACCENTS[pillar];
            const cards     = guide[pillar];
            const isAdding  = addingTo === pillar && editingId === null;
            const isEditingThis = addingTo === pillar && editingId !== null;

            return (
              <div key={pillar}>
                {/* Pillar header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5" style={{ color: accent }}>
                    {PILLAR_ICONS[pillar]}
                    <span className="text-[10px] font-bold uppercase tracking-widest">{PILLAR_LABELS[pillar]}</span>
                    {cards.length > 0 && (
                      <span className="text-[9px] font-mono text-[#555555]">({cards.length})</span>
                    )}
                  </div>
                  {isAdmin && !isAdding && (
                    <button
                      type="button"
                      onClick={() => startAdd(pillar)}
                      className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors"
                      style={{ color: accent, borderColor: `${accent}40`, background: `${accent}0d` }}
                    >
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Add
                    </button>
                  )}
                </div>

                {/* Cards */}
                <div className="rounded-lg border border-[#1e1e1e] bg-[#0a0a0a] px-3 min-h-[40px]">
                  {cards.length === 0 && !isAdding ? (
                    <p className="py-3 text-[11px] text-[#444444] text-center">No places added yet</p>
                  ) : (
                    cards.map(card => (
                      isEditingThis && editingId === card.id ? (
                        <div key={card.id} className="py-2">
                          <CardForm
                            pillar={pillar} form={form}
                            onChange={f => setForm(prev => ({ ...prev, ...f }))}
                            onSubmit={() => submitForm(pillar)}
                            onCancel={cancelForm}
                            isEditing={true}
                          />
                        </div>
                      ) : (
                        <CardRow
                          key={card.id} card={card} pillar={pillar} isAdmin={isAdmin}
                          onEdit={c => startEdit(pillar, c)}
                          onDelete={id => deleteCard(pillar, id)}
                        />
                      )
                    ))
                  )}
                  {isAdding && (
                    <div className="py-2">
                      <CardForm
                        pillar={pillar} form={form}
                        onChange={f => setForm(prev => ({ ...prev, ...f }))}
                        onSubmit={() => submitForm(pillar)}
                        onCancel={cancelForm}
                        isEditing={false}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Save controls */}
          {isAdmin && (
            <div className="flex items-center justify-between pt-2 border-t border-[#1e1e1e]">
              <div className="flex items-center gap-2">
                <button
                  type="button" onClick={() => doSave(false)} disabled={saving}
                  className="px-3 py-1.5 text-xs font-bold rounded-md bg-[#c9a84c] text-[#0f0f0f] hover:bg-[#dfc070] disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving…' : 'Save Guide'}
                </button>
                <button
                  type="button" onClick={() => doSave(true)} disabled={saving}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 disabled:opacity-50 transition-colors"
                >
                  Set as Zone {zoneCode} Guide
                </button>
              </div>
              {saveMsg && (
                <span className={`text-[11px] font-medium ${saveMsg.startsWith('Save failed') ? 'text-red-400' : 'text-emerald-400'}`}>
                  {saveMsg}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
