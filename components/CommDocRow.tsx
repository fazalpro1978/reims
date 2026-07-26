'use client';

import React, { useEffect, useRef, useState } from 'react';
import { authedFetch } from '../lib/authedFetch';

// ─────────────────────────────────────────────────────────────────────────────
// CommDocRow — document row for Commission & Legal tab
//
// Layout per row:
//   ┌─ Label (static or editable) ────────────────── [● confirmed] ─┐
//   │  [↑ Upload File]  or  [✓ filename  View  ✕]                   │
//   │  [https://... link input ─────────────] [Save Link]           │
//   └───────────────────────────────────────────────────────────────┘
//
// Props:
//   label         Static display label (e.g. "QID")
//   doc           Current doc state { path, name, url, label? }
//   category      Storage path prefix for bucket uploads
//   labelEditable If true, the label becomes an editable text input
//                 and the typed value is stored in doc.label
//   accept        MIME/extension filter
//   onChange      Called with updated DocEntry on any change
// ─────────────────────────────────────────────────────────────────────────────

export interface DocEntry {
  path:   string;
  name:   string;
  url:    string;
  label?: string; // only used when labelEditable=true
}

interface CommDocRowProps {
  label:          string;
  doc:            DocEntry;
  category:       string;
  labelEditable?: boolean;
  accept?:        string;
  onChange:       (doc: DocEntry) => void;
}

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

export default function CommDocRow({
  label,
  doc,
  category,
  labelEditable = false,
  accept = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png',
  onChange,
}: CommDocRowProps) {
  const inputRef                   = useRef<HTMLInputElement>(null);
  const [uploadState, setUpload]   = useState<UploadState>(doc.path ? 'done' : 'idle');
  const [uploadError, setErrMsg]   = useState('');
  const [urlDraft,    setUrlDraft] = useState(doc.url);
  const [urlSaved,    setUrlSaved] = useState(!!doc.url);

  // Sync when parent async-loads saved doc data after mount
  useEffect(() => { if (doc.path) setUpload('done'); }, [doc.path]);
  useEffect(() => { setUrlDraft(doc.url); setUrlSaved(!!doc.url); }, [doc.url]);

  const confirmed = uploadState === 'done' || urlSaved;

  // ── File upload ─────────────────────────────────────────────────────────────

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUpload('uploading');
    setErrMsg('');
    const form = new FormData();
    form.append('file', file);
    form.append('path', `${category}/${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
    try {
      const res  = await authedFetch('/api/upload', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) { setErrMsg(json.error ?? 'Upload failed'); setUpload('error'); return; }
      onChange({ ...doc, path: json.path, name: file.name });
      setUpload('done');
    } catch {
      setErrMsg('Network error — please retry');
      setUpload('error');
    }
  };

  const handleView = async () => {
    if (!doc.path) return;
    try {
      const res  = await fetch(`/api/signed-url?path=${encodeURIComponent(doc.path)}`);
      const json = await res.json();
      if (json.signedUrl) window.open(json.signedUrl, '_blank');
      else alert('Could not generate view link: ' + (json.error ?? 'unknown'));
    } catch { alert('Network error'); }
  };

  const handleRemoveFile = () => { onChange({ ...doc, path: '', name: '' }); setUpload('idle'); setErrMsg(''); };

  // ── External URL ────────────────────────────────────────────────────────────

  const handleSaveUrl = () => {
    const t = urlDraft.trim();
    onChange({ ...doc, url: t });
    setUrlSaved(!!t);
  };

  const handleClearUrl = () => { setUrlDraft(''); setUrlSaved(false); onChange({ ...doc, url: '' }); };

  // ── Shared style helpers ─────────────────────────────────────────────────────

  const rowBase = `rounded-lg border px-3 py-2.5 space-y-2 transition-colors ${
    confirmed
      ? 'border-emerald-800/40 bg-[#0c140c]'
      : 'border-[#1e1e1e] bg-[#141414]'
  }`;

  return (
    <div className={rowBase}>

      {/* ── Row header: label + status ── */}
      <div className="flex items-center justify-between gap-2">
        {labelEditable ? (
          <input
            type="text"
            placeholder="Document name (e.g. NOC Letter, Insurance…)"
            value={doc.label ?? ''}
            onChange={e => onChange({ ...doc, label: e.target.value })}
            className="flex-1 text-xs font-semibold text-[#d0d0d0] bg-transparent border-b border-[#2a2a2a] focus:border-[#c9a84c] focus:outline-none pb-0.5 placeholder:text-[#3a3a3a] transition-colors"
          />
        ) : (
          <span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">
            {label}
          </span>
        )}

        {confirmed && (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 uppercase tracking-wider shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            Verified
          </span>
        )}
      </div>

      {/* ── File upload row ── */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-bold text-[#3a3a3a] uppercase tracking-wider w-[52px] shrink-0">
          File
        </span>
        <div className="flex-1 min-w-0">
          {uploadState === 'idle' && (
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-dashed border-[#2a2a2a] hover:border-[#c9a84c] bg-transparent hover:bg-[#c9a84c]/5 cursor-pointer transition-colors group">
              <svg className="w-3 h-3 text-[#555555] group-hover:text-[#c9a84c] shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span className="text-[11px] text-[#555555] group-hover:text-[#c9a84c] transition-colors whitespace-nowrap">Upload file</span>
              <input ref={inputRef} type="file" accept={accept} onChange={handleFile} className="sr-only" />
            </label>
          )}

          {uploadState === 'uploading' && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-[#2a2a2a]">
              <span className="inline-block w-3 h-3 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="text-[11px] text-[#777777]">Uploading…</span>
            </div>
          )}

          {uploadState === 'done' && (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1.5 flex-1 min-w-0 px-2 py-1.5 rounded-md bg-[#0a1a0f] border border-emerald-800/50">
                <svg className="w-3 h-3 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-[11px] text-emerald-300 font-mono truncate">
                  {doc.name || doc.path.split('/').pop()}
                </span>
              </div>
              <button type="button" onClick={handleView} title="View document"
                className="p-1.5 text-[#38bdf8] hover:bg-[#38bdf8]/10 rounded transition-colors shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
              <button type="button" onClick={handleRemoveFile} title="Remove file"
                className="p-1.5 text-[#555555] hover:text-red-400 rounded transition-colors shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {uploadState === 'error' && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-red-400 truncate">{uploadError}</span>
              <button type="button" onClick={() => setUpload('idle')}
                className="text-[11px] text-[#777777] hover:text-[#c9a84c] shrink-0">Retry</button>
            </div>
          )}
        </div>
      </div>

      {/* ── External link row ── */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-bold text-[#3a3a3a] uppercase tracking-wider w-[52px] shrink-0">
          Link
        </span>
        <div className="flex-1 min-w-0">
          {urlSaved ? (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1.5 flex-1 min-w-0 px-2 py-1.5 rounded-md bg-[#0a1020] border border-sky-800/50">
                <svg className="w-3 h-3 text-sky-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <a href={doc.url} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] text-sky-300 font-mono truncate hover:underline">
                  {doc.url}
                </a>
              </div>
              <button type="button" onClick={handleClearUrl} title="Remove link"
                className="p-1.5 text-[#555555] hover:text-red-400 rounded transition-colors shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="url"
                placeholder="Paste external URL or cloud link…"
                value={urlDraft}
                onChange={e => setUrlDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveUrl()}
                className="flex-1 min-w-0 text-[11px] text-[#c0c0c0] bg-[#0d0d0d] border border-[#2a2a2a] rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#c9a84c] focus:border-[#c9a84c] placeholder:text-[#3a3a3a] font-mono"
              />
              <button
                type="button"
                onClick={handleSaveUrl}
                disabled={!urlDraft.trim()}
                className="px-2.5 py-1.5 text-[10px] font-bold text-[#0f0f0f] bg-[#c9a84c] hover:bg-[#dfc070] disabled:opacity-25 disabled:cursor-not-allowed rounded-md transition-colors shrink-0 whitespace-nowrap uppercase tracking-wide"
              >
                Save Link
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
