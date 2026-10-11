'use client';
import React, { useState, useEffect, useCallback } from 'react';
import TopBar from './TopBar';
import { authedFetch } from '../lib/authedFetch';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client {
  ref_no: string;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  client_nationality: string | null;
  status: string;
  created_at: string;
  staff_name: string | null;
  assigned_agent: string | null;
}

type ViewMode = 'grid' | 'table';
type ExportFmt = 'xlsx' | 'xls';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  new: '#94a3b8', contacted: '#38bdf8', viewing: '#fbbf24',
  negotiating: '#fb923c', won: '#4ade80', lost: '#f87171',
  cancelled: '#f87171', closed: '#64748b',
};

const STATUS_LABELS = ['new', 'contacted', 'viewing', 'negotiating', 'won', 'lost', 'cancelled', 'closed'];

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '?';
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function waLink(phone: string, name: string) {
  const msg = encodeURIComponent(`Hello ${name}, thank you for your interest. We have some great properties available for you.`);
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${msg}`;
}

// ─── Export ──────────────────────────────────────────────────────────────────

async function exportClients(clients: Client[], fmt: ExportFmt) {
  const XLSX = (await import('xlsx')).default;

  const rows = clients.map((c, i) => ({
    '#':            i + 1,
    'Ref No':       c.ref_no,
    'Client Name':  c.client_name,
    'Nationality':  c.client_nationality ?? '',
    'Phone':        c.client_phone ?? '',
    'Email':        c.client_email ?? '',
    'Status':       cap(c.status),
    'Consultant':   c.assigned_agent ?? '',
    'Handler':      c.staff_name ?? '',
    'Date Added':   new Date(c.created_at).toLocaleDateString('en-GB'),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws['!cols'] = [
    { wch: 4 }, { wch: 16 }, { wch: 22 }, { wch: 14 },
    { wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clients');

  const bookType = fmt === 'xls' ? 'xls' : 'xlsx';
  const filename = `REIMS_Clients_${new Date().toISOString().slice(0, 10)}.${fmt}`;
  XLSX.writeFile(wb, filename, { bookType });
}

// ─── Status Pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? '#888';
  return (
    <span
      className="text-[9px] font-bold px-2 py-0.5 rounded-full capitalize whitespace-nowrap"
      style={{ color, background: `${color}18`, border: `1px solid ${color}30` }}
    >
      {status}
    </span>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function IcGrid() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}

function IcTable() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path strokeLinecap="round" d="M3 9h18M3 15h18M9 3v18"/>
    </svg>
  );
}

function IcDownload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 11l5 5 5-5M12 3v13"/>
    </svg>
  );
}

// ─── Client Panel ─────────────────────────────────────────────────────────────

function ClientPanel({ client, onClose }: { client: Client; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="relative w-full max-w-[420px] h-full bg-[#0d0d0d] border-l border-[#1e1e1e] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 p-5 border-b border-[#1a1a1a]">
          <div className="w-12 h-12 rounded-xl bg-[#c9a84c18] border border-[#c9a84c30] flex items-center justify-center shrink-0">
            <span className="text-[#c9a84c] font-bold text-base">{initials(client.client_name)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-base truncate">{client.client_name}</h3>
            <p className="text-[10px] font-mono text-[#f43f5e] mt-0.5">{client.ref_no}</p>
          </div>
          <button onClick={onClose} className="text-[#444] hover:text-[#888] transition-colors mt-0.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4 flex items-center justify-between">
            <p className="text-xs text-[#555] uppercase tracking-wider font-semibold">Stage Status</p>
            <StatusPill status={client.status} />
          </div>

          <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4 space-y-3">
            <p className="text-[10px] text-[#555] uppercase tracking-wider font-semibold">Contact Details</p>
            {[
              ['Phone',       client.client_phone],
              ['Email',       client.client_email],
              ['Nationality', client.client_nationality],
              ['Date Added',  new Date(client.created_at).toLocaleDateString('en-GB')],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k as string} className="flex items-center justify-between gap-4">
                <p className="text-xs text-[#888] shrink-0">{k}</p>
                <p className="text-xs text-[#e0e0e0] text-right truncate">{v}</p>
              </div>
            ))}
          </div>

          {(client.staff_name || client.assigned_agent) && (
            <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4 space-y-3">
              <p className="text-[10px] text-[#555] uppercase tracking-wider font-semibold">Team</p>
              {client.assigned_agent && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#888]">Consultant</p>
                  <p className="text-xs text-[#e0e0e0]">{client.assigned_agent}</p>
                </div>
              )}
              {client.staff_name && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#888]">Handler</p>
                  <p className="text-xs text-[#e0e0e0]">{client.staff_name}</p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {client.client_phone && (
              <a href={waLink(client.client_phone, client.client_name)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg bg-[#22c55e18] border border-[#22c55e30] text-[#22c55e] hover:bg-[#22c55e25] transition-colors">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 2C6.477 2 2 6.477 2 12c0 1.89.524 3.659 1.438 5.168L2 22l4.985-1.41A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
                </svg>
                WhatsApp
              </a>
            )}
            {client.client_email && (
              <a href={`mailto:${client.client_email}`}
                className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg bg-[#38bdf818] border border-[#38bdf830] text-[#38bdf8] hover:bg-[#38bdf825] transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5">
                  <rect x="2" y="4" width="20" height="16" rx="2"/><path strokeLinecap="round" d="M2 7l10 6 10-6"/>
                </svg>
                Email
              </a>
            )}
            {client.client_phone && (
              <a href={`tel:${client.client_phone}`}
                className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg bg-[#a78bfa18] border border-[#a78bfa30] text-[#a78bfa] hover:bg-[#a78bfa25] transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.7A2 2 0 012.18 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.15a16 16 0 006.29 6.29l1.42-1.42a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                </svg>
                Call
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Table View ───────────────────────────────────────────────────────────────

function TableView({ clients, onSelect }: { clients: Client[]; onSelect: (c: Client) => void }) {
  const TH = "text-[10px] font-semibold uppercase tracking-wider text-[#555] px-3 py-3 text-left whitespace-nowrap";
  const TD = "px-3 py-3 text-xs text-[#ccc] border-t border-[#111] whitespace-nowrap";

  return (
    <div className="overflow-x-auto rounded-xl border border-[#1a1a1a] bg-[#0d0d0d]">
      <table className="w-full min-w-[860px]">
        <thead>
          <tr className="bg-[#0a0a0a]">
            <th className={TH}>#</th>
            <th className={TH}>Ref No</th>
            <th className={TH}>Client Name</th>
            <th className={TH}>Nationality</th>
            <th className={TH}>Phone</th>
            <th className={TH}>Email</th>
            <th className={TH}>Status</th>
            <th className={TH}>Consultant</th>
            <th className={TH}>Handler</th>
            <th className={TH}>Date Added</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c, i) => (
            <tr
              key={c.ref_no}
              onClick={() => onSelect(c)}
              className="cursor-pointer hover:bg-[#111] transition-colors group"
            >
              <td className={`${TD} text-[#444] tabular-nums`}>{i + 1}</td>
              <td className={`${TD} font-mono text-[#f43f5e] text-[10px]`}>{c.ref_no}</td>
              <td className={`${TD} font-medium text-[#e0e0e0] group-hover:text-white`}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-[#c9a84c18] border border-[#c9a84c25] flex items-center justify-center shrink-0">
                    <span className="text-[#c9a84c] font-bold text-[9px]">{initials(c.client_name)}</span>
                  </div>
                  {c.client_name}
                </div>
              </td>
              <td className={`${TD} text-[#888]`}>{c.client_nationality ?? '—'}</td>
              <td className={`${TD} font-mono`}>{c.client_phone ?? '—'}</td>
              <td className={`${TD} text-[#777] max-w-[180px] truncate`}>{c.client_email ?? '—'}</td>
              <td className={TD}><StatusPill status={c.status} /></td>
              <td className={`${TD} text-[#777]`}>{c.assigned_agent ?? '—'}</td>
              <td className={`${TD} text-[#777]`}>{c.staff_name ?? '—'}</td>
              <td className={`${TD} text-[#555] tabular-nums`}>{new Date(c.created_at).toLocaleDateString('en-GB')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Export Dropdown ──────────────────────────────────────────────────────────

function ExportMenu({ clients }: { clients: Client[] }) {
  const [open,     setOpen]     = useState(false);
  const [exporting, setExporting] = useState(false);

  const run = async (fmt: ExportFmt) => {
    setOpen(false);
    setExporting(true);
    try { await exportClients(clients, fmt); }
    finally { setExporting(false); }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={exporting || clients.length === 0}
        className="flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-lg border border-[#1e1e1e] text-[#888] hover:border-[#c9a84c44] hover:text-[#c9a84c] transition-colors disabled:opacity-40"
      >
        <IcDownload />
        {exporting ? 'Exporting…' : 'Export Data'}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-20 bg-[#111] border border-[#1e1e1e] rounded-xl overflow-hidden shadow-xl min-w-[160px]">
            {(['xlsx', 'xls'] as ExportFmt[]).map(fmt => (
              <button
                key={fmt}
                onClick={() => run(fmt)}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-xs text-[#ccc] hover:bg-[#1a1a1a] hover:text-white transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-[#4ade80]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <span>Download <span className="font-bold uppercase text-[#4ade80]">.{fmt}</span></span>
              </button>
            ))}
            <div className="px-4 py-2 border-t border-[#1a1a1a]">
              <p className="text-[10px] text-[#333]">{clients.length} record{clients.length !== 1 ? 's' : ''} · filtered view</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClientsDirectory({ onMenuClick }: { onMenuClick?: () => void }) {
  const [clients,      setClients]      = useState<Client[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected,     setSelected]     = useState<Client | null>(null);
  const [view,         setView]         = useState<ViewMode>('grid');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search)       params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const res  = await authedFetch(`/api/clients?${params}`);
      const data = await res.json();
      setClients(data.clients ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const active   = clients.filter(c => !['won','lost','cancelled','closed'].includes(c.status)).length;
  const won      = clients.filter(c => c.status === 'won').length;
  const newCount = clients.filter(c => c.status === 'new').length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0]">
      <TopBar onMenuClick={onMenuClick} />

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Title + actions */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Client Directory</h2>
            <p className="text-[#606060] text-sm mt-0.5">
              {total.toLocaleString()} client{total !== 1 ? 's' : ''} · sourced from Synergy inquiries
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Export */}
            <ExportMenu clients={clients} />

            {/* View toggle */}
            <div className="flex items-center bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg p-0.5 gap-0.5">
              {(['grid', 'table'] as ViewMode[]).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  title={v === 'grid' ? 'Card view' : 'Table view'}
                  className={`p-2 rounded-md transition-colors ${view === v ? 'bg-[#1a1a1a] text-[#e0e0e0]' : 'text-[#444] hover:text-[#888]'}`}
                >
                  {v === 'grid' ? <IcGrid /> : <IcTable />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Clients',    value: total,    color: 'text-[#e0e0e0]' },
            { label: 'Active Inquiries', value: active,   color: 'text-[#38bdf8]' },
            { label: 'New',              value: newCount, color: 'text-[#94a3b8]' },
            { label: 'Won',              value: won,      color: 'text-[#4ade80]' },
          ].map(s => (
            <div key={s.label} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4">
              <p className="text-[11px] text-[#555] uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444] pointer-events-none">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, phone, email or ref no…"
              className="w-full bg-[#0d0d0d] border border-[#1e1e1e] text-[#e0e0e0] text-sm rounded-lg pl-9 pr-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#c9a84c44] placeholder-[#444]"
            />
          </div>
          <select
            value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="bg-[#0d0d0d] border border-[#1e1e1e] text-[#e0e0e0] text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#c9a84c66]"
          >
            <option value="">All Statuses</option>
            {STATUS_LABELS.map(s => (
              <option key={s} value={s}>{cap(s)}</option>
            ))}
          </select>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : clients.length === 0 ? (
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-12 flex flex-col items-center gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} className="w-14 h-14 text-[#222]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
            </svg>
            <p className="text-sm text-[#555]">No clients found.</p>
          </div>
        ) : view === 'table' ? (
          <TableView clients={clients} onSelect={setSelected} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {clients.map(c => (
              <div
                key={c.ref_no}
                onClick={() => setSelected(c)}
                className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4 cursor-pointer hover:border-[#c9a84c33] hover:bg-[#0f0e09] transition-colors group"
              >
                {/* Top: avatar + name + status */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#c9a84c18] border border-[#c9a84c25] flex items-center justify-center shrink-0">
                      <span className="text-[#c9a84c] font-bold text-xs">{initials(c.client_name)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#e0e0e0] group-hover:text-white truncate">{c.client_name}</p>
                      {c.client_nationality && <p className="text-[10px] text-[#444]">{c.client_nationality}</p>}
                    </div>
                  </div>
                  <StatusPill status={c.status} />
                </div>

                {/* Contact */}
                <div className="space-y-1 mb-3">
                  {c.client_phone && <p className="text-xs font-mono text-[#666]">{c.client_phone}</p>}
                  {c.client_email && <p className="text-[11px] text-[#555] truncate">{c.client_email}</p>}
                </div>

                {/* Team */}
                {(c.staff_name || c.assigned_agent) && (
                  <div className="flex gap-3 mb-3">
                    {c.assigned_agent && (
                      <p className="text-[10px] text-[#444]">
                        <span className="text-[#333]">Consultant </span>{c.assigned_agent}
                      </p>
                    )}
                    {c.staff_name && (
                      <p className="text-[10px] text-[#444]">
                        <span className="text-[#333]">Handler </span>{c.staff_name}
                      </p>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-[#131313]">
                  <span className="text-[10px] font-mono text-[#f43f5e]">{c.ref_no}</span>
                  <span className="text-[10px] text-[#383838]">{new Date(c.created_at).toLocaleDateString('en-GB')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {selected && (
        <ClientPanel client={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
