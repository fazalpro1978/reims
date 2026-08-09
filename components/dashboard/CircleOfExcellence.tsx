'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { authedFetch } from '../../lib/authedFetch';
import { useAuth } from '../../contexts/AuthContext';

// photo_url / certificate_url = storage PATHS stored in DB
// photo_signed_url / cert_signed_url = 24 h signed URLs for display (computed by API)
interface Spotlight {
  id:               string;
  employee_name:    string;
  employee_title:   string | null;
  month_year:       string | null;
  message:          string | null;
  photo_url:        string | null;  // path
  certificate_url:  string | null;  // path
  certificate_type: 'image' | 'pdf' | null;
  photo_signed_url: string | null;  // for <img>
  cert_signed_url:  string | null;  // for <iframe>/<img>
  created_at:       string;
}

interface FormState {
  employee_name:    string;
  employee_title:   string;
  month_year:       string;
  message:          string;
  photo_url:        string; // path
  certificate_url:  string; // path
  certificate_type: 'image' | 'pdf' | null;
}

const EMPTY_FORM: FormState = {
  employee_name: '', employee_title: '', month_year: '',
  message: '', photo_url: '', certificate_url: '', certificate_type: null,
};

function spotlightToForm(s: Spotlight): FormState {
  return {
    employee_name:    s.employee_name,
    employee_title:   s.employee_title   ?? '',
    month_year:       s.month_year       ?? '',
    message:          s.message          ?? '',
    photo_url:        s.photo_url        ?? '', // path, not signed URL
    certificate_url:  s.certificate_url  ?? '', // path, not signed URL
    certificate_type: s.certificate_type ?? null,
  };
}

// ── Upload zone sub-component ────────────────────────────────────────────────

function UploadZone({
  label, accept, preview, loading, onFile,
}: {
  label: string; accept: string; preview: string; loading: boolean; onFile: (f: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) onFile(f);
  }, [onFile]);

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: '#44445a' }}>{label}</p>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          height: 100, borderRadius: 8, cursor: 'pointer',
          border: `1.5px dashed ${dragging ? '#c9a84c' : '#2a2a3e'}`,
          background: dragging ? 'rgba(201,168,76,.05)' : '#0d0d14',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'border-color .15s, background .15s',
          position: 'relative', overflow: 'hidden',
        }}
      >
        {loading ? (
          <span style={{ fontSize: 10, color: '#c9a84c' }}>Uploading…</span>
        ) : preview ? (
          <>
            <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 7 }} />
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity .15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = '0'; }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', letterSpacing: '.06em' }}>REPLACE</span>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, marginBottom: 4, color: '#2a2a3e' }}>↑</div>
            <p style={{ margin: 0, fontSize: 10, color: '#3a3a5a' }}>Click or drag to upload</p>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CircleOfExcellence() {
  const { user, role } = useAuth();
  const isAdmin = role === 'superuser' || role === 'administrator';

  const [spotlight,    setSpotlight   ] = useState<Spotlight | null>(null);
  const [loading,      setLoading     ] = useState(true);
  const [editing,      setEditing     ] = useState(false);
  const [saving,       setSaving      ] = useState(false);
  const [saveErr,      setSaveErr     ] = useState('');
  const [certOpen,     setCertOpen    ] = useState(false);

  const [form,         setForm        ] = useState<FormState>(EMPTY_FORM);
  const [photoLoad,    setPhotoLoad   ] = useState(false);
  const [certLoad,     setCertLoad    ] = useState(false);
  // Separate preview states hold SIGNED URLs from the upload response (1 h)
  const [photoPreview, setPhotoPreview] = useState('');
  const [certPreview,  setCertPreview ] = useState('');

  useEffect(() => {
    if (!user) return;
    authedFetch('/api/dashboard/circle-of-excellence')
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.spotlight) setSpotlight(j.spotlight); })
      .finally(() => setLoading(false));
  }, [user]);

  const openEdit = () => {
    if (spotlight) {
      setForm(spotlightToForm(spotlight));
      // signed URLs from the last GET — good for previewing while editing
      setPhotoPreview(spotlight.photo_signed_url ?? '');
      setCertPreview(spotlight.certificate_type === 'image' ? (spotlight.cert_signed_url ?? '') : '');
    } else {
      setForm(EMPTY_FORM);
      setPhotoPreview('');
      setCertPreview('');
    }
    setSaveErr('');
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setSaveErr(''); };

  const publish = async () => {
    if (!form.employee_name.trim()) { setSaveErr('Employee name is required.'); return; }
    setSaving(true); setSaveErr('');
    try {
      const res = await authedFetch('/api/dashboard/circle-of-excellence', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form), // sends paths, not signed URLs
      });
      const j = await res.json();
      if (!res.ok) { setSaveErr(j.error ?? 'Save failed'); return; }
      setSpotlight(j.spotlight); // API returns fresh signed URLs
      setEditing(false);
    } catch { setSaveErr('Network error'); }
    finally { setSaving(false); }
  };

  const handlePhotoFile = async (file: File) => {
    setPhotoLoad(true); setSaveErr('');
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('slot', 'photo');
      const res = await authedFetch('/api/dashboard/circle-of-excellence/upload', { method: 'POST', body: fd });
      const j = await res.json();
      if (!res.ok) { setSaveErr(j.error ?? 'Photo upload failed'); return; }
      setForm(f => ({ ...f, photo_url: j.path }));       // store PATH
      setPhotoPreview(j.previewUrl);                      // short-lived signed URL for preview
    } catch { setSaveErr('Photo upload failed'); }
    finally { setPhotoLoad(false); }
  };

  const handleCertFile = async (file: File) => {
    setCertLoad(true); setSaveErr('');
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('slot', 'certificate');
      const res = await authedFetch('/api/dashboard/circle-of-excellence/upload', { method: 'POST', body: fd });
      const j = await res.json();
      if (!res.ok) { setSaveErr(j.error ?? 'Certificate upload failed'); return; }
      setForm(f => ({ ...f, certificate_url: j.path, certificate_type: j.fileType })); // store PATH
      setCertPreview(j.fileType === 'image' ? j.previewUrl : ''); // image preview only
    } catch { setSaveErr('Certificate upload failed'); }
    finally { setCertLoad(false); }
  };

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={cardStyle}>
        <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 11, color: '#2a2a3e' }}>Loading…</span>
        </div>
      </div>
    );
  }

  // ── Edit mode ───────────────────────────────────────────────────────────────

  if (editing) {
    return (
      <div style={{ ...cardStyle, borderColor: 'rgba(201,168,76,.35)', boxShadow: '0 0 0 1px rgba(201,168,76,.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, color: '#c9a84c' }}>✦</span>
            <h3 style={headingStyle}>Circle of Excellence</h3>
            <span style={adminBadge}>PUBLISHING</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={cancelEdit} style={ghostBtn}>Cancel</button>
            <button onClick={publish} disabled={saving} style={{ ...ghostBtn, background: saving ? 'rgba(201,168,76,.1)' : '#c9a84c', color: saving ? '#c9a84c' : '#0f0f0f', fontWeight: 700, borderColor: '#c9a84c', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Publishing…' : 'Publish ✦'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px', gap: 10, marginBottom: 12 }}>
          <label style={labelWrap}>
            <span style={labelText}>Employee Name *</span>
            <input style={inputStyle} placeholder="e.g. Sarah Al-Mansoori" value={form.employee_name} onChange={e => setForm(f => ({ ...f, employee_name: e.target.value }))} />
          </label>
          <label style={labelWrap}>
            <span style={labelText}>Job Title / Role</span>
            <input style={inputStyle} placeholder="e.g. Senior Property Manager" value={form.employee_title} onChange={e => setForm(f => ({ ...f, employee_title: e.target.value }))} />
          </label>
          <label style={labelWrap}>
            <span style={labelText}>Period</span>
            <input style={inputStyle} placeholder="e.g. August 2026" value={form.month_year} onChange={e => setForm(f => ({ ...f, month_year: e.target.value }))} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <UploadZone label="Profile Photo (PNG / JPG / WebP)" accept="image/png,image/jpeg,image/webp" preview={photoPreview} loading={photoLoad} onFile={handlePhotoFile} />
          <UploadZone label="Certificate (PDF / PNG / JPG / WebP)" accept="image/png,image/jpeg,image/webp,application/pdf" preview={certPreview} loading={certLoad} onFile={handleCertFile} />
          {form.certificate_url && form.certificate_type === 'pdf' && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: '#44445a' }}>Certificate Preview</p>
              <div style={{ height: 100, border: '1.5px solid #2a2a3e', borderRadius: 8, overflow: 'hidden', background: '#0d0d14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#3a3a5a', letterSpacing: '.08em' }}>PDF UPLOADED ✓</span>
              </div>
            </div>
          )}
        </div>

        <label style={labelWrap}>
          <span style={labelText}>Announcement / Praise</span>
          <textarea style={{ ...inputStyle, height: 88, resize: 'vertical', lineHeight: 1.6 }} placeholder="Write a custom announcement, praise, or recognition message…" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
        </label>

        {saveErr && <p style={{ margin: '10px 0 0', fontSize: 11, color: '#ef4444' }}>{saveErr}</p>}
      </div>
    );
  }

  // ── No spotlight (admin prompt / hidden for others) ──────────────────────────

  if (!spotlight?.employee_name) {
    if (!isAdmin) return null;
    return (
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20, color: '#2a2a3e' }}>✦</span>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#44445a', letterSpacing: '.09em', textTransform: 'uppercase' }}>Circle of Excellence</p>
            <p style={{ margin: '3px 0 0', fontSize: 11, color: '#2a2a3e' }}>No spotlight published yet.</p>
          </div>
        </div>
        <button onClick={openEdit} style={{ ...ghostBtn, borderColor: '#c9a84c', color: '#c9a84c' }}>+ Add Spotlight</button>
      </div>
    );
  }

  // ── View mode ───────────────────────────────────────────────────────────────

  // Use signed URLs for display; paths never leave the server
  const displayPhoto = spotlight.photo_signed_url;
  const displayCert  = spotlight.cert_signed_url;
  const hasCert      = !!displayCert;

  return (
    <>
      {certOpen && hasCert && (
        <div onClick={() => setCertOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(860px, 90vw)', height: 'min(640px, 85vh)', background: '#111118', borderRadius: 12, border: '1px solid #2a2a3e', overflow: 'hidden', position: 'relative' }}>
            <button onClick={() => setCertOpen(false)} style={{ position: 'absolute', top: 10, right: 10, zIndex: 1, background: 'rgba(0,0,0,.6)', border: 'none', borderRadius: 6, color: '#888', fontSize: 13, cursor: 'pointer', padding: '4px 8px' }}>✕</button>
            {spotlight.certificate_type === 'pdf'
              ? <iframe src={displayCert} style={{ width: '100%', height: '100%', border: 'none' }} title="Certificate" />
              : <img src={displayCert} alt="Certificate" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
            }
          </div>
        </div>
      )}

      <div style={{ ...cardStyle, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #c9a84c, #dfc070, #c9a84c, transparent)', opacity: .65 }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, color: '#c9a84c' }}>✦</span>
            <h3 style={headingStyle}>Circle of Excellence</h3>
            {spotlight.month_year && (
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: '#c9a84c', background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.2)', padding: '2px 7px', borderRadius: 4 }}>
                {spotlight.month_year.toUpperCase()}
              </span>
            )}
          </div>
          {isAdmin && <button onClick={openEdit} style={{ ...ghostBtn, fontSize: 10 }}>Edit ✎</button>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: hasCert ? '1fr 200px' : '1fr', gap: 20, alignItems: 'start' }}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
            {displayPhoto ? (
              <div style={{ width: 96, height: 96, borderRadius: '50%', border: '2px solid rgba(201,168,76,.5)', boxShadow: '0 0 20px rgba(201,168,76,.15)', overflow: 'hidden', flexShrink: 0 }}>
                <img src={displayPhoto} alt={spotlight.employee_name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
            ) : (
              <div style={{ width: 96, height: 96, borderRadius: '50%', border: '2px solid rgba(201,168,76,.25)', background: 'rgba(201,168,76,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: '#c9a84c', flexShrink: 0 }}>
                {spotlight.employee_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
              </div>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#e8e0c8', lineHeight: 1.2, letterSpacing: '-.01em' }}>{spotlight.employee_name}</p>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.12em', color: '#c9a84c', textTransform: 'uppercase' }}>Employee of the Month</span>
              </div>
              {spotlight.employee_title && (
                <p style={{ margin: '2px 0 10px', fontSize: 11, color: '#5a5a7a', fontWeight: 500 }}>{spotlight.employee_title}</p>
              )}
              {spotlight.message && (
                <div style={{ borderLeft: '2px solid rgba(201,168,76,.4)', paddingLeft: 12, marginTop: 8 }}>
                  <p style={{ margin: 0, fontSize: 12.5, color: '#9090b0', lineHeight: 1.7, fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    &ldquo;{spotlight.message}&rdquo;
                  </p>
                </div>
              )}
            </div>
          </div>

          {hasCert && (
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#3a3a5a' }}>Certificate</p>
              <button onClick={() => setCertOpen(true)}
                style={{ width: '100%', padding: 0, border: '1px solid #2a2a3e', borderRadius: 8, background: '#0d0d14', cursor: 'pointer', overflow: 'hidden', display: 'block', transition: 'border-color .15s, box-shadow .15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(201,168,76,.4)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 12px rgba(201,168,76,.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2a3e'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; }}
              >
                {spotlight.certificate_type === 'pdf' ? (
                  <div style={{ height: 130, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <span style={{ fontSize: 28, color: '#3a3a5a' }}>📄</span>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.08em', color: '#3a3a5a', textTransform: 'uppercase' }}>View PDF</span>
                  </div>
                ) : (
                  <div style={{ height: 130, overflow: 'hidden', position: 'relative' }}>
                    <img src={displayCert} alt="Certificate" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', color: '#fff', textTransform: 'uppercase', background: 'rgba(0,0,0,.5)', padding: '4px 8px', borderRadius: 4 }}>View Full</span>
                    </div>
                  </div>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = { background: '#111118', border: '1px solid #22222e', borderRadius: 12, padding: '20px' };
const headingStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#44445a', margin: 0 };
const adminBadge: React.CSSProperties = { fontSize: 9, fontWeight: 700, letterSpacing: '.08em', color: '#c9a84c', background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.25)', padding: '2px 6px', borderRadius: 4 };
const ghostBtn: React.CSSProperties = { background: 'transparent', border: '1px solid #2a2a3e', borderRadius: 6, color: '#44445a', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', padding: '5px 11px', cursor: 'pointer', transition: 'color .15s, border-color .15s' };
const labelWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5 };
const labelText: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: '#44445a' };
const inputStyle: React.CSSProperties = { background: '#0d0d14', border: '1px solid #2a2a3e', borderRadius: 7, color: '#c8c8e8', fontSize: 12, padding: '8px 11px', width: '100%', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };
