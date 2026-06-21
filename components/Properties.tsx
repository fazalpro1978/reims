'use client';

import React, { useCallback, useEffect, useState } from 'react';
import TopBar from './TopBar';

// ── Types ────────────────────────────────────────────────────────────────────

interface Property {
  id: string;
  ref_no: string;
  title: string | null;
  listing_type: 'rent' | 'sale';
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  size_sqm: number | null;
  floor: string | null;
  furnished: 'furnished' | 'semi-furnished' | 'unfurnished' | null;
  price: number | null;
  price_currency: string;
  location: string | null;
  zone: string | null;
  compound: string | null;
  description: string | null;
  images: string[];
  amenities: string[];
  source: 'propertyfinder' | 'instagram' | 'tiktok' | 'manual';
  source_url: string | null;
  source_ref: string | null;
  status: 'active' | 'leased' | 'sold' | 'inactive';
  featured: boolean;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

type ListingType = 'all' | 'rent' | 'sale';
type SourceFilter = 'all' | 'propertyfinder' | 'instagram' | 'tiktok' | 'manual';
type StatusFilter = 'all' | 'active' | 'leased' | 'sold' | 'inactive';

interface FormState {
  title: string;
  listing_type: 'rent' | 'sale';
  property_type: string;
  bedrooms: string;
  bathrooms: string;
  size_sqm: string;
  floor: string;
  furnished: string;
  price: string;
  location: string;
  zone: string;
  compound: string;
  description: string;
  source: 'propertyfinder' | 'instagram' | 'tiktok' | 'manual';
  source_url: string;
  status: 'active' | 'leased' | 'sold' | 'inactive';
}

const EMPTY_FORM: FormState = {
  title: '', listing_type: 'rent', property_type: '', bedrooms: '',
  bathrooms: '', size_sqm: '', floor: '', furnished: '', price: '',
  location: '', zone: '', compound: '', description: '',
  source: 'manual', source_url: '', status: 'active',
};

// ── Constants ────────────────────────────────────────────────────────────────

const SOURCE_META: Record<Property['source'], { label: string; color: string; bg: string }> = {
  propertyfinder: { label: 'PropertyFinder', color: '#4ade80', bg: '#052e16' },
  instagram:      { label: 'Instagram',      color: '#f472b6', bg: '#2d0a1e' },
  tiktok:         { label: 'TikTok',         color: '#38bdf8', bg: '#0c1a26' },
  manual:         { label: 'Manual',         color: '#c9a84c', bg: '#1a1305' },
};

const STATUS_META: Record<Property['status'], { label: string; color: string }> = {
  active:   { label: 'Active',   color: '#4ade80' },
  leased:   { label: 'Leased',   color: '#c9a84c' },
  sold:     { label: 'Sold',     color: '#f43f5e' },
  inactive: { label: 'Inactive', color: '#6b7280' },
};

const PROPERTY_TYPES = ['Apartment', 'Villa', 'Townhouse', 'Penthouse', 'Studio',
  'Duplex', 'Compound', 'Office', 'Retail', 'Warehouse', 'Land'];

// ── Small helpers ────────────────────────────────────────────────────────────

function fmtPrice(p: number | null, currency: string, type: 'rent' | 'sale') {
  if (p == null) return '—';
  const n = p.toLocaleString('en-QA');
  return type === 'rent' ? `${currency} ${n}/mo` : `${currency} ${n}`;
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)  return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ── Icons ────────────────────────────────────────────────────────────────────

function IcRefresh({ spin }: { spin?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className={`w-4 h-4 ${spin ? 'animate-spin' : ''}`}>
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}

function IcPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IcSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function IcClose() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="w-[14px] h-[14px]">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function IcBuilding() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 opacity-20">
      <path d="M6 22V4a2 2 0 012-2h8a2 2 0 012 2v18H6zM2 22h20M10 6h.01M10 10h.01M10 14h.01M14 6h.01M14 10h.01M14 14h.01" />
    </svg>
  );
}

function IcMenu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function IcExternal() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
    </svg>
  );
}

// ── URL Import Panel (no AI credits needed) ──────────────────────────────────

function URLImportPanel({ onImported }: { onImported: (fields: Partial<FormState> & { images?: string[] }) => void }) {
  const [url, setUrl]         = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [ok, setOk]           = useState('');

  const importUrl = async () => {
    if (!url.trim()) return;
    setLoading(true); setError(''); setOk('');
    try {
      const res  = await fetch('/api/properties/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Import failed'); return; }

      const mapped: Partial<FormState> & { images?: string[] } = {
        source:     'propertyfinder',
        source_url: url.trim(),
      };
      if (json.title)         mapped.title         = String(json.title);
      if (json.listing_type)  mapped.listing_type  = json.listing_type;
      if (json.property_type) mapped.property_type = String(json.property_type);
      if (json.bedrooms != null) mapped.bedrooms   = String(json.bedrooms);
      if (json.price    != null) mapped.price      = String(json.price);
      if (json.location)      mapped.location      = String(json.location);
      if (json.description)   mapped.description   = String(json.description);
      if (json.image)         mapped.images        = [json.image];

      onImported(mapped);
      setOk('Fields filled from URL');
      setUrl('');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ background: '#0d1117', border: '1px solid #2a3a4a', borderRadius: 12, padding: 14, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <IcExternal />
        <span style={{ color: '#38bdf8', fontSize: 13, fontWeight: 600 }}>Import from URL</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#1e4a6a' }}>PropertyFinder · Bayut · Any listing</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={url} onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && importUrl()}
          placeholder="Paste PropertyFinder listing URL…"
          style={{ flex: 1, background: '#0a1520', border: '1px solid #1e3a4a', borderRadius: 8,
            color: '#e0e0e0', fontSize: 13, padding: '7px 10px', fontFamily: 'inherit' }} />
        <button onClick={importUrl} disabled={loading || !url.trim()}
          style={{ padding: '7px 16px', background: loading ? '#0a1520' : '#0369a1', border: 'none',
            borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: loading || !url.trim() ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Fetching…' : 'Import'}
        </button>
      </div>
      {error && <p style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>{error}</p>}
      {ok    && <p style={{ color: '#4ade80', fontSize: 12, marginTop: 8 }}>{ok}</p>}
    </div>
  );
}

// ── Add / Edit Listing Modal ─────────────────────────────────────────────────

function PropertyForm({
  initial, onSave, onClose,
}: {
  initial?: Property;
  onSave: (form: FormState, images?: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [importedImages, setImportedImages] = useState<string[]>([]);

  const [form, setForm]     = useState<FormState>(
    initial
      ? {
          title: initial.title ?? '',
          listing_type: initial.listing_type,
          property_type: initial.property_type ?? '',
          bedrooms: initial.bedrooms != null ? String(initial.bedrooms) : '',
          bathrooms: initial.bathrooms != null ? String(initial.bathrooms) : '',
          size_sqm: initial.size_sqm != null ? String(initial.size_sqm) : '',
          floor: initial.floor ?? '',
          furnished: initial.furnished ?? '',
          price: initial.price != null ? String(initial.price) : '',
          location: initial.location ?? '',
          zone: initial.zone ?? '',
          compound: initial.compound ?? '',
          description: initial.description ?? '',
          source: initial.source,
          source_url: initial.source_url ?? '',
          status: initial.status,
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setSaving(true); setSaveError('');
    try { await onSave(form, importedImages); onClose(); }
    catch (err) { setSaveError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  const inp = (style?: React.CSSProperties): React.CSSProperties => ({
    width: '100%', background: '#111', border: '1px solid #2a2a2a', borderRadius: 8,
    color: '#e0e0e0', fontSize: 13, padding: '7px 10px', boxSizing: 'border-box', fontFamily: 'inherit', ...style,
  });

  const label = (txt: string) => (
    <p style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>{txt}</p>
  );

  const col2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#111', border: '1px solid #222', borderRadius: 16,
        width: '100%', maxWidth: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e1e',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ color: '#c9a84c', fontSize: 16, fontWeight: 700, margin: 0 }}>
            {initial ? 'Edit Listing' : 'Add Listing'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 4 }}>
            <IcClose />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {!initial && (
            <URLImportPanel onImported={({ images, ...fields }) => {
              setForm(f => ({ ...f, ...fields }));
              if (images) setImportedImages(images);
            }} />
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              {label('Title')}
              <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Spacious 2BR in West Bay" style={inp()} />
            </div>

            <div style={col2}>
              <div>
                {label('Listing Type')}
                <select value={form.listing_type} onChange={e => set('listing_type', e.target.value as 'rent' | 'sale')} style={inp()}>
                  <option value="rent">Rent</option>
                  <option value="sale">Sale</option>
                </select>
              </div>
              <div>
                {label('Property Type')}
                <select value={form.property_type} onChange={e => set('property_type', e.target.value)} style={inp()}>
                  <option value="">Select…</option>
                  {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div style={col2}>
              <div>
                {label('Bedrooms')}
                <input type="number" min={0} value={form.bedrooms} onChange={e => set('bedrooms', e.target.value)} placeholder="Studio = leave blank" style={inp()} />
              </div>
              <div>
                {label('Bathrooms')}
                <input type="number" min={0} value={form.bathrooms} onChange={e => set('bathrooms', e.target.value)} style={inp()} />
              </div>
            </div>

            <div style={col2}>
              <div>
                {label('Price (QAR)')}
                <input type="number" min={0} value={form.price} onChange={e => set('price', e.target.value)} placeholder="Monthly if rent" style={inp()} />
              </div>
              <div>
                {label('Size (sqm)')}
                <input type="number" min={0} value={form.size_sqm} onChange={e => set('size_sqm', e.target.value)} style={inp()} />
              </div>
            </div>

            <div style={col2}>
              <div>
                {label('Location')}
                <input value={form.location} onChange={e => set('location', e.target.value)} style={inp()} />
              </div>
              <div>
                {label('Zone / Area')}
                <input value={form.zone} onChange={e => set('zone', e.target.value)} style={inp()} />
              </div>
            </div>

            <div style={col2}>
              <div>
                {label('Compound')}
                <input value={form.compound} onChange={e => set('compound', e.target.value)} style={inp()} />
              </div>
              <div>
                {label('Floor')}
                <input value={form.floor} onChange={e => set('floor', e.target.value)} style={inp()} />
              </div>
            </div>

            <div style={col2}>
              <div>
                {label('Furnished')}
                <select value={form.furnished} onChange={e => set('furnished', e.target.value)} style={inp()}>
                  <option value="">Not specified</option>
                  <option value="furnished">Furnished</option>
                  <option value="semi-furnished">Semi-Furnished</option>
                  <option value="unfurnished">Unfurnished</option>
                </select>
              </div>
              <div>
                {label('Status')}
                <select value={form.status} onChange={e => set('status', e.target.value as Property['status'])} style={inp()}>
                  <option value="active">Active</option>
                  <option value="leased">Leased</option>
                  <option value="sold">Sold</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div style={col2}>
              <div>
                {label('Source')}
                <select value={form.source} onChange={e => set('source', e.target.value as Property['source'])} style={inp()}>
                  <option value="manual">Manual</option>
                  <option value="propertyfinder">PropertyFinder</option>
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                </select>
              </div>
              <div>
                {label('Source URL')}
                <input value={form.source_url} onChange={e => set('source_url', e.target.value)} placeholder="https://…" style={inp()} />
              </div>
            </div>

            <div>
              {label('Description')}
              <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3}
                style={{ ...inp(), resize: 'vertical' }} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #1e1e1e', flexShrink: 0 }}>
          {saveError && (
            <p style={{ color: '#f87171', fontSize: 12, marginBottom: 8, padding: '6px 10px', background: '#1a0808', borderRadius: 6 }}>
              {saveError}
            </p>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: '9px 0', background: '#1a1a1a', border: '1px solid #2a2a2a',
                borderRadius: 8, color: '#888', fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={saving}
              style={{ flex: 2, padding: '9px 0', background: saving ? '#3d2e00' : '#c9a84c', border: 'none',
                borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
              {saving ? 'Saving…' : (initial ? 'Save Changes' : 'Add Listing')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Property Card ────────────────────────────────────────────────────────────

function PropertyCard({ p, onClick }: { p: Property; onClick: () => void }) {
  const src = SOURCE_META[p.source];
  const sts = STATUS_META[p.status];
  const img = p.images?.[0];

  return (
    <div onClick={onClick} style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12,
      overflow: 'hidden', cursor: 'pointer', transition: 'border-color .15s' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#2a2a2a')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e1e1e')}>

      {/* Image area — thumbnail links to source listing */}
      <div style={{ position: 'relative', height: 140, background: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {img
          ? (p.source_url
              ? <a href={p.source_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                  style={{ display: 'block', width: '100%', height: '100%' }}>
                  <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </a>
              : <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />)
          : <IcBuilding />
        }
        {/* Source badge */}
        <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, fontWeight: 700,
          color: src.color, background: src.bg, border: `1px solid ${src.color}33`,
          padding: '2px 7px', borderRadius: 20 }}>{src.label}</span>
        {/* Status badge */}
        <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, fontWeight: 700,
          color: sts.color, background: '#111', border: `1px solid ${sts.color}44`,
          padding: '2px 7px', borderRadius: 20 }}>{sts.label}</span>
        {/* Listing type */}
        <span style={{ position: 'absolute', bottom: 8, right: 8, fontSize: 10, fontWeight: 700,
          color: p.listing_type === 'rent' ? '#38bdf8' : '#a78bfa',
          background: '#111', border: `1px solid ${p.listing_type === 'rent' ? '#38bdf8' : '#a78bfa'}44`,
          padding: '2px 7px', borderRadius: 20, textTransform: 'uppercase' }}>
          {p.listing_type}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px' }}>
        <p style={{ color: '#4ade80', fontSize: 15, fontWeight: 700, margin: '0 0 2px' }}>
          {fmtPrice(p.price, p.price_currency, p.listing_type)}
        </p>
        <p style={{ color: '#e0e0e0', fontSize: 13, fontWeight: 600, margin: '0 0 6px',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {p.title || [p.property_type, p.bedrooms != null ? `${p.bedrooms}BR` : 'Studio'].filter(Boolean).join(' · ') || 'Untitled'}
        </p>
        <p style={{ color: '#888', fontSize: 12, margin: '0 0 8px',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {[p.compound, p.location, p.zone].filter(Boolean).join(' · ') || '—'}
        </p>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#666' }}>
          {p.bedrooms != null && <span>{p.bedrooms} Bed</span>}
          {p.bathrooms != null && <span>{p.bathrooms} Bath</span>}
          {p.size_sqm != null && <span>{p.size_sqm} sqm</span>}
        </div>
        <p style={{ color: '#444', fontSize: 10, marginTop: 8, fontFamily: 'monospace' }}>{p.ref_no}</p>
      </div>
    </div>
  );
}

// ── Property Drawer ──────────────────────────────────────────────────────────

function PropertyDrawer({ p, onClose, onEdit, onDelete }: {
  p: Property;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const src = SOURCE_META[p.source];
  const sts = STATUS_META[p.status];

  const row = (label: string, val: React.ReactNode) => (
    <div style={{ display: 'flex', padding: '8px 0', borderBottom: '1px solid #111' }}>
      <span style={{ width: 120, fontSize: 12, color: '#555', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: '#ccc', flex: 1 }}>{val ?? '—'}</span>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 55, display: 'flex' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.6)' }} />
      <div style={{ width: 380, background: '#111', borderLeft: '1px solid #1e1e1e',
        display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e1e1e',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <p style={{ fontFamily: 'monospace', fontSize: 11, color: '#555', marginBottom: 2 }}>{p.ref_no}</p>
            <h3 style={{ color: '#e0e0e0', fontSize: 15, fontWeight: 700, margin: 0 }}>
              {p.title || [p.property_type, p.bedrooms != null ? `${p.bedrooms}BR` : 'Studio'].filter(Boolean).join(' ') || 'Untitled'}
            </h3>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: src.color, background: src.bg,
                border: `1px solid ${src.color}33`, padding: '2px 7px', borderRadius: 20 }}>{src.label}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: sts.color, background: '#0d0d0d',
                border: `1px solid ${sts.color}44`, padding: '2px 7px', borderRadius: 20 }}>{sts.label}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', paddingTop: 2 }}>
            <IcClose />
          </button>
        </div>

        {/* Image */}
        {p.images?.[0] && (
          <div style={{ height: 180, flexShrink: 0, overflow: 'hidden' }}>
            <img src={p.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}

        {/* Details */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#4ade80', margin: '14px 0 4px' }}>
            {fmtPrice(p.price, p.price_currency, p.listing_type)}
          </p>

          {row('Type', [p.listing_type.toUpperCase(), p.property_type].filter(Boolean).join(' · '))}
          {row('Bedrooms', p.bedrooms != null ? p.bedrooms : 'Studio')}
          {row('Bathrooms', p.bathrooms)}
          {row('Size', p.size_sqm != null ? `${p.size_sqm} sqm` : null)}
          {row('Floor', p.floor)}
          {row('Furnished', p.furnished ? p.furnished.replace('-', ' ') : null)}
          {row('Location', p.location)}
          {row('Zone', p.zone)}
          {row('Compound', p.compound)}
          {row('Listed', timeAgo(p.created_at))}
          {p.synced_at && row('Last synced', timeAgo(p.synced_at))}

          {p.description && (
            <div style={{ marginTop: 12, padding: 12, background: '#0d0d0d', borderRadius: 8 }}>
              <p style={{ fontSize: 12, color: '#888', lineHeight: 1.6, margin: 0 }}>{p.description}</p>
            </div>
          )}

          {p.source_url && (
            <a href={p.source_url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12,
                color: '#38bdf8', fontSize: 12, textDecoration: 'none' }}>
              <IcExternal /> View on {SOURCE_META[p.source].label}
            </a>
          )}
        </div>

        {/* Footer actions */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #1e1e1e', display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={onDelete}
            style={{ padding: '8px 14px', background: '#1a0a0a', border: '1px solid #3f1919',
              borderRadius: 8, color: '#f87171', fontSize: 12, cursor: 'pointer' }}>
            Delete
          </button>
          <button onClick={onEdit}
            style={{ flex: 1, padding: '8px 0', background: '#c9a84c', border: 'none',
              borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Edit Listing
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function Properties({ onMenuClick }: { onMenuClick?: () => void }) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading]       = useState(true);
  const [syncing, setSyncing]       = useState(false);
  const [syncMsg, setSyncMsg]       = useState('');
  const [search, setSearch]         = useState('');
  const [sourceF, setSourceF]       = useState<SourceFilter>('all');
  const [typeF, setTypeF]           = useState<ListingType>('all');
  const [statusF, setStatusF]       = useState<StatusFilter>('all');
  const [showAdd, setShowAdd]       = useState(false);
  const [editing, setEditing]       = useState<Property | null>(null);
  const [drawer, setDrawer]         = useState<Property | null>(null);
  const [lastSync, setLastSync]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (sourceF !== 'all') params.set('source', sourceF);
    if (typeF   !== 'all') params.set('listing_type', typeF);
    if (statusF !== 'all') params.set('status', statusF);
    const res = await fetch(`/api/properties?${params}`);
    const json = await res.json();
    setProperties(json.properties ?? []);
    // Last sync time from PF listings
    const pfItems: Property[] = (json.properties ?? []).filter((p: Property) => p.source === 'propertyfinder' && p.synced_at);
    if (pfItems.length > 0) {
      const latest = pfItems.sort((a: Property, b: Property) => new Date(b.synced_at!).getTime() - new Date(a.synced_at!).getTime())[0];
      setLastSync(latest.synced_at);
    }
    setLoading(false);
  }, [sourceF, typeF, statusF]);

  useEffect(() => { load(); }, [load]);

  const syncPF = async () => {
    setSyncing(true); setSyncMsg('');
    try {
      const res  = await fetch('/api/properties/sync-pf', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) { setSyncMsg(`Error: ${json.error}`); return; }
      setSyncMsg(json.message ?? `Synced ${json.synced} listings`);
      await load();
    } catch { setSyncMsg('Network error'); }
    finally { setSyncing(false); }
  };

  const createProperty = async (form: FormState, images?: string[]) => {
    const str = (v: string) => v.trim() || null;
    const body: Record<string, unknown> = {
      title:         str(form.title),
      listing_type:  form.listing_type,
      property_type: str(form.property_type),
      bedrooms:      form.bedrooms  ? Number(form.bedrooms)  : null,
      bathrooms:     form.bathrooms ? Number(form.bathrooms) : null,
      size_sqm:      form.size_sqm  ? Number(form.size_sqm)  : null,
      floor:         str(form.floor),
      furnished:     str(form.furnished),
      price:         form.price     ? Number(form.price)     : null,
      location:      str(form.location),
      zone:          str(form.zone),
      compound:      str(form.compound),
      description:   str(form.description),
      source:        form.source,
      source_url:    str(form.source_url),
      status:        form.status,
      images:        images ?? [],
    };
    const res = await fetch('/api/properties', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) { const j = await res.json(); throw new Error(j.error); }
    await load();
  };

  const updateProperty = async (form: FormState) => {
    if (!editing) return;
    const str = (v: string) => v.trim() || null;
    const body: Record<string, unknown> = {
      title:         str(form.title),
      listing_type:  form.listing_type,
      property_type: str(form.property_type),
      bedrooms:      form.bedrooms  ? Number(form.bedrooms)  : null,
      bathrooms:     form.bathrooms ? Number(form.bathrooms) : null,
      size_sqm:      form.size_sqm  ? Number(form.size_sqm)  : null,
      floor:         str(form.floor),
      furnished:     str(form.furnished),
      price:         form.price     ? Number(form.price)     : null,
      location:      str(form.location),
      zone:          str(form.zone),
      compound:      str(form.compound),
      description:   str(form.description),
      source_url:    str(form.source_url),
      status:        form.status,
    };
    const res = await fetch(`/api/properties/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) { const j = await res.json(); throw new Error(j.error); }
    setEditing(null); setDrawer(null); await load();
  };

  const deleteProperty = async (id: string) => {
    if (!confirm('Delete this listing?')) return;
    await fetch(`/api/properties/${id}`, { method: 'DELETE' });
    setDrawer(null); await load();
  };

  // Client-side search filter
  const filtered = properties.filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [p.ref_no, p.title, p.property_type, p.location, p.zone, p.compound, p.source_ref]
      .some(v => v?.toLowerCase().includes(q));
  });

  const sources: SourceFilter[] = ['all', 'propertyfinder', 'instagram', 'tiktok', 'manual'];
  const types:   ListingType[]  = ['all', 'rent', 'sale'];
  const statuses: StatusFilter[] = ['all', 'active', 'leased', 'sold', 'inactive'];

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
    background: active ? '#c9a84c' : '#1a1a1a', color: active ? '#111' : '#888',
    transition: 'background .15s, color .15s',
  });

  return (
    <>
      {/* ── Standard global top bar — identical to all other workspace pages ── */}
      <TopBar onMenuClick={onMenuClick} />

      {/* ── Page content — max-w-screen-2xl mirrors Units Inventory ── */}
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Page header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#c9a84c]">Properties</h1>
            <p className="text-xs text-[#555] mt-0.5">
              {loading ? 'Loading…' : `${filtered.length} listing${filtered.length !== 1 ? 's' : ''}`}
              {lastSync && ` · PF synced ${timeAgo(lastSync)}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {syncMsg && <span className="text-xs text-[#4ade80]">{syncMsg}</span>}
            <button onClick={syncPF} disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-[#166534] bg-[#0a1a0f] text-[#4ade80] disabled:opacity-60 hover:bg-[#0f2a1a] transition-colors">
              <IcRefresh spin={syncing} /> {syncing ? 'Syncing…' : 'Sync PF'}
            </button>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold bg-[#c9a84c] text-[#111] hover:bg-[#dfc070] transition-colors">
              <IcPlus /> Add Listing
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center pb-2 border-b border-[#1a1a1a]">
          <div className="relative mr-2">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#555]"><IcSearch /></span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search listings…"
              className="pl-8 pr-3 py-1.5 bg-[#111] border border-[#222] rounded-lg text-sm text-[#e0e0e0] placeholder:text-[#444] focus:outline-none focus:ring-2 focus:ring-[#c9a84c]/40 focus:border-[#c9a84c]" />
          </div>
          <div className="flex gap-1">
            {sources.map(s => (
              <button key={s} onClick={() => setSourceF(s)} style={chipStyle(sourceF === s)}>
                {s === 'all' ? 'All Sources' : SOURCE_META[s as Property['source']].label}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {types.map(t => (
              <button key={t} onClick={() => setTypeF(t)} style={chipStyle(typeF === t)}>
                {t === 'all' ? 'All Types' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {statuses.map(s => (
              <button key={s} onClick={() => setStatusF(s)} style={chipStyle(statusF === s)}>
                {s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="text-center py-20 text-[#555]">Loading properties…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <IcBuilding />
            <p className="text-[#555] mt-3">No listings yet.</p>
            <p className="text-[#444] text-sm mt-1">
              Click <strong className="text-[#4ade80]">Sync PF</strong> to import from PropertyFinder,
              or <strong className="text-[#c9a84c]">Add Listing</strong> to add manually.
            </p>
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {filtered.map(p => (
              <PropertyCard key={p.id} p={p} onClick={() => setDrawer(p)} />
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      {showAdd && (
        <PropertyForm onSave={createProperty} onClose={() => setShowAdd(false)} />
      )}
      {editing && (
        <PropertyForm initial={editing} onSave={(form) => updateProperty(form)} onClose={() => setEditing(null)} />
      )}
      {drawer && !editing && (
        <PropertyDrawer
          p={drawer}
          onClose={() => setDrawer(null)}
          onEdit={() => { setEditing(drawer); }}
          onDelete={() => deleteProperty(drawer.id)}
        />
      )}
    </>
  );
}
