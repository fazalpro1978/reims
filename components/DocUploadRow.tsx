'use client';

import React, { useEffect, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// DocUploadRow — reusable document upload + view row
//
// Props:
//   label        Display label (e.g. "QID", "Property Reg Certificate")
//   storagePath  Current storage path in unit-documents bucket ('' if none)
//   filename     Original filename to display when uploaded
//   category     Storage sub-folder: e.g. `{unitUuid}/client/qid`
//   accept       MIME types or extensions (default: PDF only)
//   onChange     Called with (storagePath, filename) after a successful upload
// ─────────────────────────────────────────────────────────────────────────────

interface DocUploadRowProps {
  label:       string;
  storagePath: string;
  filename:    string;
  category:    string;   // full path prefix, e.g. "{uuid}/client/qid"
  accept?:     string;
  onChange:    (storagePath: string, filename: string) => void;
}

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

export default function DocUploadRow({
  label,
  storagePath,
  filename,
  category,
  accept = '.pdf,application/pdf',
  onChange,
}: DocUploadRowProps) {
  const inputRef               = useRef<HTMLInputElement>(null);
  const [state, setState]      = useState<UploadState>(storagePath ? 'done' : 'idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Sync state when storagePath arrives asynchronously (parent fetches from DB after mount)
  useEffect(() => {
    if (storagePath) setState('done');
  }, [storagePath]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setState('uploading');
    setErrorMsg('');

    const form = new FormData();
    form.append('file', file);
    // Sanitise filename: strip special chars
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    form.append('path', `${category}/${safeName}`);

    try {
      const res  = await fetch('/api/upload', { method: 'POST', body: form });
      const json = await res.json();

      if (!res.ok) {
        setErrorMsg(json.error ?? 'Upload failed');
        setState('error');
        return;
      }

      onChange(json.path, file.name);
      setState('done');
    } catch {
      setErrorMsg('Network error — please retry');
      setState('error');
    }
  };

  const handleView = async () => {
    if (!storagePath) return;
    try {
      const res  = await fetch(`/api/signed-url?path=${encodeURIComponent(storagePath)}`);
      const json = await res.json();
      if (json.signedUrl) window.open(json.signedUrl, '_blank');
      else alert('Could not generate view link: ' + (json.error ?? 'unknown error'));
    } catch {
      alert('Network error while generating view link');
    }
  };

  const handleRemove = () => {
    onChange('', '');
    setState('idle');
    setErrorMsg('');
  };

  return (
    <div className="flex items-center gap-2.5 min-h-[32px]">
      {/* Label */}
      <span className="w-[110px] shrink-0 text-[10px] font-bold text-[#888888] uppercase tracking-wider">
        {label}
      </span>

      {/* State: idle / uploading / done / error */}
      {state === 'idle' && (
        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-dashed border-[#2e2e2e] hover:border-[#c9a84c] bg-[#0d0d0d] hover:bg-[#c9a84c]/5 cursor-pointer transition-colors group">
          <svg className="w-3.5 h-3.5 text-[#666666] group-hover:text-[#c9a84c] shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span className="text-xs text-[#666666] group-hover:text-[#c9a84c] transition-colors whitespace-nowrap">
            Upload file
          </span>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleFile}
            className="sr-only"
          />
        </label>
      )}

      {state === 'uploading' && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#111111] border border-[#2a2a2a]">
          <span className="inline-block w-3.5 h-3.5 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="text-xs text-[#888888]">Uploading…</span>
        </div>
      )}

      {state === 'done' && (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-1 min-w-0 px-2.5 py-1.5 rounded-md bg-[#0a1a0f] border border-emerald-800/60">
            <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-xs text-emerald-300 font-mono truncate flex-1 min-w-0">
              {filename || storagePath.split('/').pop()}
            </span>
          </div>
          <button
            type="button"
            onClick={handleView}
            title="View document"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-[#38bdf8] hover:bg-[#38bdf8]/10 border border-transparent hover:border-[#38bdf8]/30 transition-colors whitespace-nowrap shrink-0"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View
          </button>
          <button
            type="button"
            onClick={handleRemove}
            title="Remove document"
            className="p-1.5 text-[#666666] hover:text-red-400 transition-colors rounded shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {state === 'error' && (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-1 min-w-0 px-2.5 py-1.5 rounded-md bg-[#1a0a0a] border border-red-800/60">
            <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <path strokeLinecap="round" d="M12 8v4M12 16h.01" />
            </svg>
            <span className="text-xs text-red-400 truncate">{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setState('idle')}
            className="text-xs text-[#888888] hover:text-[#c9a84c] transition-colors whitespace-nowrap shrink-0"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
