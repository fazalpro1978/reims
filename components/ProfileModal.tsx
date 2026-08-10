'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { authedFetch } from '../lib/authedFetch';
import { supabase } from '../lib/supabase/client';
import Avatar from './Avatar';
import { AVATAR_PRESETS } from '../lib/avatarPresets';

interface ProfileData {
  id:              string;
  email:           string;
  full_name:       string | null;
  role:            string;
  company:         string | null;
  phone:           string | null;
  avatar_url:      string | null;
  avatar_preset:   string | null;
  avatarSignedUrl: string | null;
}

type Tab = 'profile' | 'avatar' | 'security';
interface Strength { len: boolean; upper: boolean; num: boolean; special: boolean; }

function pwLevel(s: Strength) { return [s.len, s.upper, s.num, s.special].filter(Boolean).length; }

const STR_COLORS = ['', '#ef4444', '#f59e0b', '#f59e0b', '#10b981'];
const STR_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];

const fieldSx: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: '#0d0d14', border: '1px solid #2a2a3e', borderRadius: 7,
  padding: '9px 12px', fontSize: 12, color: '#d0d0e8', outline: 'none',
};
const roSx: React.CSSProperties = {
  ...fieldSx, background: '#0a0a12', border: '1px solid #1a1a2a',
  color: '#44445a', cursor: 'default',
};
const labelSx: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 700, color: '#44445a',
  textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 5,
};
const btnPrimary = (busy: boolean): React.CSSProperties => ({
  background: busy ? '#1a1a2e' : '#c9a84c', color: busy ? '#555' : '#0f0f0f',
  border: 'none', borderRadius: 7, padding: '9px 20px',
  fontSize: 12, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
});

function Tab2({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
      fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase',
      color: active ? '#c9a84c' : '#44445a',
      borderBottom: `2px solid ${active ? '#c9a84c' : 'transparent'}`,
      transition: 'color .15s, border-color .15s',
    }}>
      {label}
    </button>
  );
}

export default function ProfileModal({
  onClose,
  onAvatarChange,
}: {
  onClose: () => void;
  onAvatarChange?: (signedUrl: string | null, preset: string | null) => void;
}) {
  const [tab,      setTab     ] = useState<Tab>('profile');
  const [profile,  setProfile ] = useState<ProfileData | null>(null);
  const [loading,  setLoading ] = useState(true);

  // Profile tab
  const [fullName, setFullName] = useState('');
  const [company,  setCompany ] = useState('');
  const [phone,    setPhone   ] = useState('');
  const [saving,   setSaving  ] = useState(false);
  const [saveMsg,  setSaveMsg ] = useState('');
  const [saveErr,  setSaveErr ] = useState('');

  // Avatar tab
  const [photoUrl,    setPhotoUrl   ] = useState<string | null>(null);
  const [selPreset,   setSelPreset  ] = useState<string | null>(null);
  const [uploading,   setUploading  ] = useState(false);
  const [uploadErr,   setUploadErr  ] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Security tab
  const [newPw,    setNewPw   ] = useState('');
  const [confirm,  setConfirm ] = useState('');
  const [showPw,   setShowPw  ] = useState(false);
  const [strength, setStrength] = useState<Strength>({ len: false, upper: false, num: false, special: false });
  const [pwBusy,   setPwBusy  ] = useState(false);
  const [pwMsg,    setPwMsg   ] = useState('');
  const [pwErr,    setPwErr   ] = useState('');

  useEffect(() => {
    authedFetch('/api/profile')
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (j?.profile) {
          const p: ProfileData = j.profile;
          setProfile(p);
          setFullName(p.full_name ?? '');
          setCompany(p.company ?? '');
          setPhone(p.phone ?? '');
          setPhotoUrl(p.avatarSignedUrl);
          setSelPreset(p.avatar_preset);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const initials = profile?.full_name
    ? profile.full_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : (profile?.email?.slice(0, 2).toUpperCase() ?? '?');

  // ── Profile save
  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setSaveErr(''); setSaveMsg('');
    const res = await authedFetch('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify({ full_name: fullName, company, phone }),
    });
    setSaving(false);
    if (res.ok) setSaveMsg('Profile updated.');
    else setSaveErr((await res.json()).error ?? 'Update failed.');
  }

  // ── Avatar: preset
  async function applyPreset(id: string) {
    setSelPreset(id);
    setPhotoUrl(null);
    const res = await authedFetch('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify({ avatar_preset: id, avatar_url: null }),
    });
    if (res.ok) onAvatarChange?.(null, id);
    else setUploadErr('Failed to save preset.');
  }

  async function clearAvatar() {
    setSelPreset(null);
    await authedFetch('/api/profile', { method: 'PATCH', body: JSON.stringify({ avatar_preset: null }) });
    onAvatarChange?.(null, null);
  }

  // ── Avatar: file upload
  async function handleFile(file: File) {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.type)) { setUploadErr('Only PNG, JPG, or WebP images are supported.'); return; }
    if (file.size > 5 * 1024 * 1024) { setUploadErr('Image must be under 5 MB.'); return; }
    setUploadErr('');
    setUploading(true);

    // Optimistic local preview
    const reader = new FileReader();
    reader.onload = e => setPhotoUrl(e.target?.result as string);
    reader.readAsDataURL(file);

    const fd = new FormData();
    fd.append('file', file);
    const res = await authedFetch('/api/profile/avatar', { method: 'POST', body: fd });
    const json = await res.json();
    setUploading(false);

    if (!res.ok) {
      setUploadErr(json.error ?? 'Upload failed.');
      setPhotoUrl(profile?.avatarSignedUrl ?? null);
    } else {
      setSelPreset(null);
      setPhotoUrl(json.signedUrl);
      onAvatarChange?.(json.signedUrl, null);
    }
  }

  async function removePhoto() {
    setUploading(true);
    await authedFetch('/api/profile/avatar', { method: 'DELETE' });
    setUploading(false);
    setPhotoUrl(null);
    onAvatarChange?.(null, selPreset);
  }

  // ── Password change
  function onPwInput(v: string) {
    setNewPw(v);
    setStrength({ len: v.length >= 8, upper: /[A-Z]/.test(v), num: /[0-9]/.test(v), special: /[^A-Za-z0-9]/.test(v) });
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (newPw !== confirm) { setPwErr('Passwords do not match.'); return; }
    if (pwLevel(strength) < 4) { setPwErr('Password does not meet all requirements.'); return; }
    setPwBusy(true); setPwErr(''); setPwMsg('');
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwBusy(false);
    if (error) { setPwErr(error.message); return; }
    setPwMsg('Password updated successfully.');
    setNewPw(''); setConfirm('');
    setStrength({ len: false, upper: false, num: false, special: false });
  }

  const level = pwLevel(strength);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(4px)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 'min(520px, 94vw)', background: '#111118', border: '1px solid #2a2a3e', borderRadius: 14, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,.8)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #1e1e2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#e0e0e0' }}>My Profile</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#44445a', cursor: 'pointer', fontSize: 16, padding: '2px 6px', lineHeight: 1 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1e1e2e', flexShrink: 0 }}>
          <Tab2 label="Profile"  active={tab === 'profile'}  onClick={() => setTab('profile')} />
          <Tab2 label="Avatar"   active={tab === 'avatar'}   onClick={() => setTab('avatar')} />
          <Tab2 label="Security" active={tab === 'security'} onClick={() => setTab('security')} />
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#44445a', fontSize: 12 }}>Loading…</div>
          ) : (
            <>
              {/* ── PROFILE TAB ── */}
              {tab === 'profile' && (
                <form onSubmit={saveProfile} style={{ padding: '20px 22px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={labelSx}>Email</label>
                      <div style={roSx}>{profile?.email}</div>
                    </div>
                    <div>
                      <label style={labelSx}>Role</label>
                      <div style={{ ...roSx, textTransform: 'capitalize' }}>{profile?.role}</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={labelSx}>Full Name <span style={{ color: '#ef4444' }}>*</span></label>
                    <input value={fullName} required onChange={e => setFullName(e.target.value)} style={fieldSx}
                      onFocus={e => { e.target.style.borderColor = '#c9a84c'; }}
                      onBlur={e => { e.target.style.borderColor = '#2a2a3e'; }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                    <div>
                      <label style={labelSx}>Company</label>
                      <input value={company} onChange={e => setCompany(e.target.value)} style={fieldSx}
                        onFocus={e => { e.target.style.borderColor = '#c9a84c'; }}
                        onBlur={e => { e.target.style.borderColor = '#2a2a3e'; }} />
                    </div>
                    <div>
                      <label style={labelSx}>Phone</label>
                      <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} style={fieldSx}
                        onFocus={e => { e.target.style.borderColor = '#c9a84c'; }}
                        onBlur={e => { e.target.style.borderColor = '#2a2a3e'; }} />
                    </div>
                  </div>

                  {saveMsg && <p style={{ fontSize: 11, color: '#10b981', marginBottom: 10 }}>✓ {saveMsg}</p>}
                  {saveErr && <p style={{ fontSize: 11, color: '#ef4444', marginBottom: 10 }}>{saveErr}</p>}

                  <button type="submit" disabled={saving} style={btnPrimary(saving)}>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </form>
              )}

              {/* ── AVATAR TAB ── */}
              {tab === 'avatar' && (
                <div style={{ padding: '20px 22px' }}>
                  {/* Current avatar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, padding: '14px 16px', background: '#0d0d14', borderRadius: 10, border: '1px solid #1e1e2e' }}>
                    <Avatar size={68} photoUrl={photoUrl} preset={photoUrl ? null : selPreset} initials={initials} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: '0 0 3px', fontSize: 12, fontWeight: 700, color: '#d0d0e8' }}>
                        {photoUrl ? 'Photo upload' : selPreset ? 'Preset avatar' : 'Initials (default)'}
                      </p>
                      <p style={{ margin: '0 0 8px', fontSize: 10, color: '#44445a' }}>
                        Appears in the navigation bar and across the platform.
                      </p>
                      {photoUrl && (
                        <button type="button" onClick={removePhoto} disabled={uploading}
                          style={{ background: 'none', border: '1px solid #3a1a1a', borderRadius: 5, color: '#ef4444', fontSize: 10, padding: '4px 10px', cursor: 'pointer', opacity: uploading ? 0.5 : 1 }}>
                          Remove Photo
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Upload zone */}
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ ...labelSx, marginBottom: 8 }}>Upload Photo</p>
                    <div
                      onClick={() => !uploading && fileRef.current?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                      style={{ border: '1px dashed #2a2a3e', borderRadius: 8, padding: '18px', textAlign: 'center', cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.6 : 1, transition: 'border-color .15s' }}
                      onMouseEnter={e => { if (!uploading) (e.currentTarget as HTMLElement).style.borderColor = '#44445a'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#2a2a3e'; }}
                    >
                      <p style={{ margin: '0 0 3px', fontSize: 12, color: '#555577' }}>
                        {uploading ? 'Uploading…' : 'Drag & drop or click to upload'}
                      </p>
                      <p style={{ margin: 0, fontSize: 10, color: '#2a2a3e' }}>PNG, JPG, WebP · Max 5 MB</p>
                    </div>
                    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
                    {uploadErr && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>{uploadErr}</p>}
                  </div>

                  {/* Presets */}
                  <div>
                    <p style={{ ...labelSx, marginBottom: 10 }}>Preset Avatars</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {AVATAR_PRESETS.map(p => (
                        <button key={p.id} type="button" title={p.label} onClick={() => applyPreset(p.id)}
                          style={{
                            width: 44, height: 44, borderRadius: '50%', border: selPreset === p.id && !photoUrl ? '2px solid #c9a84c' : '2px solid transparent',
                            background: p.bg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: 0, outline: 'none', boxShadow: selPreset === p.id && !photoUrl ? '0 0 0 3px rgba(201,168,76,.25)' : 'none',
                            transition: 'box-shadow .15s',
                          }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: p.text, userSelect: 'none', lineHeight: 1 }}>
                            {initials.charAt(0)}
                          </span>
                        </button>
                      ))}

                      {/* Default / initials option */}
                      <button type="button" title="Default initials" onClick={clearAvatar}
                        style={{
                          width: 44, height: 44, borderRadius: '50%',
                          border: !selPreset && !photoUrl ? '2px solid #c9a84c' : '2px solid #2a2a3e',
                          background: '#0d0d14', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: 0, outline: 'none', color: '#44445a', fontSize: 9, fontWeight: 700,
                        }}>
                        ABC
                      </button>
                    </div>
                    <p style={{ fontSize: 10, color: '#2a2a3e', marginTop: 8 }}>Click a colour to apply. Your initials are shown inside.</p>
                  </div>
                </div>
              )}

              {/* ── SECURITY TAB ── */}
              {tab === 'security' && (
                <form onSubmit={changePassword} style={{ padding: '20px 22px' }}>
                  <p style={{ margin: '0 0 16px', fontSize: 11, color: '#44445a', lineHeight: 1.6 }}>
                    Choose a strong new password. Changes take effect immediately.
                  </p>

                  <div style={{ marginBottom: 12 }}>
                    <label style={labelSx}>New Password</label>
                    <div style={{ position: 'relative' }}>
                      <input type={showPw ? 'text' : 'password'} required value={newPw} onChange={e => onPwInput(e.target.value)}
                        style={{ ...fieldSx, paddingRight: 36 }}
                        onFocus={e => { e.target.style.borderColor = '#c9a84c'; }}
                        onBlur={e => { e.target.style.borderColor = '#2a2a3e'; }} />
                      <button type="button" onClick={() => setShowPw(v => !v)}
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#44445a', cursor: 'pointer', padding: 0, display: 'flex' }}>
                        {showPw
                          ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} style={{ width: 14, height: 14 }}><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>
                          : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} style={{ width: 14, height: 14 }}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        }
                      </button>
                    </div>
                    {newPw && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
                          {[1,2,3,4].map(i => (
                            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= level ? STR_COLORS[level] : '#1e1e2e', transition: 'background .2s' }} />
                          ))}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px' }}>
                          {([['len','8+ chars'],['upper','Uppercase'],['num','Number'],['special','Special']] as [keyof Strength, string][]).map(([k,l]) => (
                            <span key={k} style={{ fontSize: 10, color: strength[k] ? '#10b981' : '#333', display: 'flex', alignItems: 'center', gap: 3 }}>
                              {strength[k] ? '✓' : '○'} {l}
                            </span>
                          ))}
                        </div>
                        {level > 0 && <p style={{ margin: '4px 0 0', fontSize: 10, color: STR_COLORS[level] }}>{STR_LABELS[level]}</p>}
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <label style={labelSx}>Confirm Password</label>
                    <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)}
                      style={fieldSx}
                      onFocus={e => { e.target.style.borderColor = '#c9a84c'; }}
                      onBlur={e => { e.target.style.borderColor = '#2a2a3e'; }} />
                    {confirm && confirm !== newPw && (
                      <p style={{ fontSize: 10, color: '#ef4444', marginTop: 4 }}>Passwords do not match</p>
                    )}
                  </div>

                  {pwMsg && <p style={{ fontSize: 11, color: '#10b981', marginBottom: 10 }}>✓ {pwMsg}</p>}
                  {pwErr && <p style={{ fontSize: 11, color: '#ef4444', marginBottom: 10 }}>{pwErr}</p>}

                  <button type="submit" disabled={pwBusy} style={btnPrimary(pwBusy)}>
                    {pwBusy ? 'Updating…' : 'Update Password'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
