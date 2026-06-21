'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import TopBar from './TopBar';
import { mimeLabel, isPreviewable } from '@/lib/mimeUtils';

// ─── Types ─────────────────────────────────────────────────────────────────

interface Contract {
  id: string;
  drive_file_id: string;
  name: string;
  mime_type: string | null;
  client_name: string | null;
  asset_token: string | null;
  folder_path: string | null;
  drive_url: string | null;
  file_size: number | null;
  drive_created_at: string | null;
  drive_modified_at: string | null;
  synced_at: string;
}

type MimeFilter = '' | 'application/pdf' | 'application/vnd.google-apps.document' | 'image/jpeg' | 'image/png';

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtSize(bytes: number | null | undefined): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mimeIcon(mime: string | null | undefined): string {
  if (!mime) return '📄';
  if (mime === 'application/pdf') return '📕';
  if (mime.startsWith('image/')) return '🖼';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return '📊';
  if (mime.includes('document') || mime.includes('word')) return '📝';
  return '📄';
}

// ─── Preview Modal ──────────────────────────────────────────────────────────

function PreviewModal({ contract, onClose }: { contract: Contract; onClose: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isImage   = contract.mime_type?.startsWith('image/') ?? false;
  const previewSrc = `/api/contracts/${contract.id}/stream`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex flex-col bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden"
           style={{ width: '90vw', maxWidth: 960, height: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e1e] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-lg">{mimeIcon(contract.mime_type)}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#e0e0e0] truncate">{contract.name}</p>
              <p className="text-xs text-[#555] truncate">
                {contract.client_name ?? '—'}{contract.asset_token ? ` · ${contract.asset_token}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {contract.drive_url && (
              <a
                href={contract.drive_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-[#888] hover:text-[#c9a84c] hover:border-[#c9a84c] transition-colors"
              >
                Open in Drive ↗
              </a>
            )}
            <button
              onClick={onClose}
              className="text-[#555] hover:text-[#e0e0e0] text-xl leading-none px-2 transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Preview area */}
        <div className="flex-1 overflow-hidden bg-[#0d0d0d]">
          {isImage ? (
            <div className="w-full h-full flex items-center justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewSrc}
                alt={contract.name}
                className="max-w-full max-h-full object-contain rounded"
              />
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={previewSrc}
              title={contract.name}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin"
            />
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ContractsLegal({ onMenuClick }: { onMenuClick?: () => void }) {
  const [contracts, setContracts]     = useState<Contract[]>([]);
  const [loading, setLoading]         = useState(true);
  const [syncing, setSyncing]         = useState(false);
  const [syncMsg, setSyncMsg]         = useState<string | null>(null);
  const [search, setSearch]           = useState('');
  const [mimeFilter, setMimeFilter]   = useState<MimeFilter>('');
  const [preview, setPreview]         = useState<Contract | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search)     params.set('q', search);
      if (mimeFilter) params.set('mime', mimeFilter);
      const res  = await fetch(`/api/contracts?${params}`);
      const data = await res.json();
      setContracts(data.contracts ?? []);
    } finally {
      setLoading(false);
    }
  }, [search, mimeFilter]);

  useEffect(() => { load(); }, [load]);

  const syncDrive = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res  = await fetch('/api/contracts/sync-drive', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setSyncMsg(`Error: ${data.error}`); return; }
      setSyncMsg(data.message ?? `Synced ${data.synced} new file(s) of ${data.total_found} found.`);
      await load();
    } finally {
      setSyncing(false);
    }
  };

  const mimeChips: { label: string; value: MimeFilter }[] = [
    { label: 'All',        value: '' },
    { label: 'PDF',        value: 'application/pdf' },
    { label: 'Google Doc', value: 'application/vnd.google-apps.document' },
    { label: 'Image / QID', value: 'image/jpeg' },
  ];

  return (
    <>
      <TopBar onMenuClick={onMenuClick} />
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-[#e0e0e0]">Contracts &amp; Legal</h1>
            <p className="text-sm text-[#555] mt-0.5">Document registry synced from Google Drive compliance folders</p>
          </div>
          <button
            onClick={syncDrive}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#c9a84c] text-black text-sm font-semibold hover:bg-[#b8952a] disabled:opacity-50 transition-colors"
          >
            {syncing ? (
              <span className="inline-block w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
              </svg>
            )}
            {syncing ? 'Syncing…' : 'Sync Google Drive'}
          </button>
        </div>

        {syncMsg && (
          <div className={`text-sm px-4 py-3 rounded-lg border ${syncMsg.startsWith('Error') ? 'border-red-800 bg-red-950 text-red-300' : 'border-green-800 bg-green-950 text-green-300'}`}>
            {syncMsg}
          </div>
        )}

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by client name or 14-digit asset token…"
              className="w-full pl-9 pr-4 py-2.5 bg-[#111] border border-[#222] rounded-lg text-sm text-[#e0e0e0] placeholder-[#444] focus:outline-none focus:border-[#c9a84c] transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888]">✕</button>
            )}
          </div>

          {/* Mime type chips */}
          <div className="flex gap-2 flex-wrap">
            {mimeChips.map(chip => (
              <button
                key={chip.value}
                onClick={() => setMimeFilter(chip.value)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  mimeFilter === chip.value
                    ? 'bg-[#c9a84c] text-black border-[#c9a84c]'
                    : 'bg-[#111] text-[#888] border-[#222] hover:border-[#c9a84c] hover:text-[#c9a84c]'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex gap-6 text-xs text-[#555]">
          <span><span className="text-[#e0e0e0] font-semibold">{contracts.length}</span> documents</span>
          {search && <span>filtered by &ldquo;<span className="text-[#c9a84c]">{search}</span>&rdquo;</span>}
        </div>

        {/* Document grid / table */}
        <div className="border border-[#1e1e1e] rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_100px_80px] gap-4 px-4 py-3 bg-[#0d0d0d] border-b border-[#1e1e1e] text-xs font-medium text-[#555] uppercase tracking-wide">
            <span>Document</span>
            <span>Client</span>
            <span>Asset Token</span>
            <span>Modified</span>
            <span>Type</span>
            <span className="text-right">Size</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-[#444] text-sm">
              <span className="inline-block w-5 h-5 border-2 border-[#333] border-t-[#c9a84c] rounded-full animate-spin mr-3" />
              Loading documents…
            </div>
          ) : contracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="text-4xl mb-4">📁</div>
              <p className="text-[#555] text-sm font-medium">No documents found</p>
              <p className="text-[#444] text-xs mt-1">
                {search ? 'Try a different search term.' : 'Click "Sync Google Drive" to pull documents from your compliance folders.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#1a1a1a]">
              {contracts.map(c => (
                <div
                  key={c.id}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_100px_80px] gap-4 px-4 py-3.5 items-center hover:bg-[#0d0d0d] transition-colors group"
                >
                  {/* Name + preview button */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg shrink-0">{mimeIcon(c.mime_type)}</span>
                    <div className="min-w-0">
                      <button
                        onClick={() => isPreviewable(c.mime_type) ? setPreview(c) : window.open(c.drive_url ?? '#', '_blank')}
                        className="text-sm text-[#e0e0e0] hover:text-[#c9a84c] text-left truncate block max-w-full transition-colors"
                        title={c.name}
                      >
                        {c.name}
                      </button>
                      {c.folder_path && (
                        <p className="text-xs text-[#444] truncate">{c.folder_path}</p>
                      )}
                    </div>
                  </div>

                  <span className="text-sm text-[#aaa] truncate">{c.client_name ?? '—'}</span>

                  <span className="text-sm font-mono text-[#888] truncate">{c.asset_token ?? '—'}</span>

                  <span className="text-sm text-[#666]">{fmtDate(c.drive_modified_at)}</span>

                  <span className="text-xs px-2 py-1 rounded-md bg-[#1a1a1a] text-[#888] w-fit">
                    {mimeLabel(c.mime_type)}
                  </span>

                  <span className="text-xs text-[#555] text-right">{fmtSize(c.file_size)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>

      {preview && <PreviewModal contract={preview} onClose={() => setPreview(null)} />}
    </>
  );
}
