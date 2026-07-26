'use client';

// PropertyScape · Vanguard REOS — Role Matrix Component

import { useState, useEffect, useCallback } from 'react';
import { authedFetch } from '../lib/authedFetch';
import { useAuth } from '../contexts/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────

type AccessLevel = 'full' | 'limited' | 'none';
type Role = 'superuser' | 'administrator' | 'staff' | 'agent' | 'public';

interface MatrixRowDef {
  key:      string;
  label:    string;
  notes?:   string;
  defaults: Record<Role, AccessLevel>;
  // roles for which 'limited' is a valid level (default: only full/none)
  limitedRoles?: Role[];
}

interface MatrixSection {
  label:    string;
  platform: 'reims' | 'axiom';
  rows:     MatrixRowDef[];
}

type MatrixState = Record<string, Record<Role, AccessLevel>>;

// ── Role metadata ─────────────────────────────────────────────────────────────

const ROLES: Role[] = ['superuser', 'administrator', 'staff', 'agent', 'public'];

const ROLE_META: Record<Role, { code: string; label: string; color: string }> = {
  superuser:     { code: 'SU', label: 'Superuser',     color: '#c9a84c' },
  administrator: { code: 'AD', label: 'Administrator', color: '#3b82f6' },
  staff:         { code: 'ST', label: 'Staff',         color: '#10b981' },
  agent:         { code: 'AG', label: 'Agent',         color: '#8b5cf6' },
  public:        { code: 'PU', label: 'Public',        color: '#64748b' },
};

// ── Matrix definition (sourced from PDF v1.0 · 21 July 2026) ─────────────────

const MATRIX: MatrixSection[] = [
  {
    label: 'Units Inventory', platform: 'reims',
    rows: [
      { key: 'units.view', label: 'View all unit listings',
        defaults: { superuser:'full', administrator:'full', staff:'full', agent:'limited', public:'limited' },
        limitedRoles: ['agent','public'],
        notes: 'Available units only; status & financial data hidden · Property name, code, type & config only' },
      { key: 'units.view_financials', label: 'View financial & commission data',
        defaults: { superuser:'full', administrator:'full', staff:'full', agent:'none', public:'none' } },
      { key: 'units.view_remarks', label: 'View operator remarks',
        defaults: { superuser:'full', administrator:'full', staff:'full', agent:'none', public:'none' } },
      { key: 'units.add', label: 'Add new unit',
        defaults: { superuser:'full', administrator:'full', staff:'full', agent:'none', public:'none' } },
      { key: 'units.edit', label: 'Edit unit details',
        defaults: { superuser:'full', administrator:'full', staff:'full', agent:'none', public:'none' } },
      { key: 'units.delete', label: 'Delete unit',
        defaults: { superuser:'full', administrator:'full', staff:'none', agent:'none', public:'none' } },
      { key: 'units.bulk_edit', label: 'Bulk field edits',
        defaults: { superuser:'full', administrator:'full', staff:'limited', agent:'none', public:'none' },
        limitedRoles: ['staff'],
        notes: 'Can bulk-edit fields; bulk-delete reserved for Admin+' },
    ],
  },
  {
    label: 'PDF Reports', platform: 'reims',
    rows: [
      { key: 'report.generate', label: 'Generate PDF report',
        defaults: { superuser:'full', administrator:'full', staff:'full', agent:'full', public:'none' } },
      { key: 'report.edit', label: 'Edit report before download',
        defaults: { superuser:'full', administrator:'full', staff:'full', agent:'full', public:'none' },
        notes: 'Title, salutation, financials & section visibility overrides' },
      { key: 'report.download', label: 'Download PDF',
        defaults: { superuser:'full', administrator:'full', staff:'full', agent:'full', public:'none' } },
      { key: 'report.share_internal', label: 'Share via WhatsApp (internal)',
        defaults: { superuser:'full', administrator:'full', staff:'full', agent:'none', public:'none' },
        notes: 'Internal format includes commission detail — Agent excluded' },
      { key: 'report.share_public', label: 'Share via public quick-share link',
        defaults: { superuser:'full', administrator:'full', staff:'full', agent:'full', public:'none' } },
    ],
  },
  {
    label: 'Code Registry', platform: 'reims',
    rows: [
      { key: 'registry.view', label: 'View Smart Codes',
        defaults: { superuser:'full', administrator:'full', staff:'full', agent:'none', public:'none' } },
      { key: 'registry.smart_codes', label: 'Generate & assign Smart Codes',
        defaults: { superuser:'full', administrator:'full', staff:'full', agent:'none', public:'none' } },
      { key: 'registry.search', label: 'Search code registry',
        defaults: { superuser:'full', administrator:'full', staff:'full', agent:'none', public:'none' } },
      { key: 'registry.realtors.view', label: 'View Realtor registry',
        defaults: { superuser:'full', administrator:'full', staff:'full', agent:'none', public:'none' } },
      { key: 'registry.realtors.add', label: 'Add realtor',
        defaults: { superuser:'full', administrator:'full', staff:'none', agent:'none', public:'none' } },
      { key: 'registry.realtors.edit', label: 'Edit realtor',
        defaults: { superuser:'full', administrator:'full', staff:'none', agent:'none', public:'none' } },
      { key: 'registry.realtors.delete', label: 'Delete realtor',
        defaults: { superuser:'full', administrator:'full', staff:'none', agent:'none', public:'none' } },
      { key: 'registry.zones.view', label: 'View Zone / District registry',
        defaults: { superuser:'full', administrator:'full', staff:'full', agent:'none', public:'none' } },
      { key: 'registry.zones.add', label: 'Add zone / district',
        defaults: { superuser:'full', administrator:'full', staff:'none', agent:'none', public:'none' } },
      { key: 'registry.zones.edit', label: 'Edit zone / district',
        defaults: { superuser:'full', administrator:'full', staff:'none', agent:'none', public:'none' } },
      { key: 'registry.zones.delete', label: 'Delete zone / district',
        defaults: { superuser:'full', administrator:'none', staff:'none', agent:'none', public:'none' } },
    ],
  },
  {
    label: 'Neighborhood Guide', platform: 'reims',
    rows: [
      { key: 'neighborhood.view', label: 'View neighborhood data',
        defaults: { superuser:'full', administrator:'full', staff:'full', agent:'full', public:'none' } },
      { key: 'neighborhood.edit', label: 'Edit & manage entries',
        defaults: { superuser:'full', administrator:'full', staff:'limited', agent:'none', public:'none' },
        limitedRoles: ['staff'],
        notes: 'Can edit content; cannot delete entries' },
    ],
  },
  {
    label: 'Platform Administration', platform: 'reims',
    rows: [
      { key: 'admin.access', label: 'Access Admin Console',
        defaults: { superuser:'full', administrator:'full', staff:'none', agent:'none', public:'none' } },
      { key: 'admin.users', label: 'User management & invitations',
        defaults: { superuser:'full', administrator:'full', staff:'none', agent:'none', public:'none' } },
      { key: 'admin.roles', label: 'Role assignment',
        defaults: { superuser:'full', administrator:'full', staff:'none', agent:'none', public:'none' } },
      { key: 'admin.settings', label: 'System settings & configuration',
        defaults: { superuser:'full', administrator:'none', staff:'none', agent:'none', public:'none' } },
    ],
  },
  {
    label: 'Upload', platform: 'axiom',
    rows: [
      { key: 'axiom.upload', label: 'Upload files (Excel, PDF, Image)',
        defaults: { superuser:'full', administrator:'full', staff:'none', agent:'none', public:'none' } },
    ],
  },
  {
    label: 'Stage 1 — Match & Review', platform: 'axiom',
    rows: [
      { key: 'axiom.match.view', label: 'View matched extraction results',
        defaults: { superuser:'full', administrator:'full', staff:'none', agent:'none', public:'none' } },
      { key: 'axiom.match.edit', label: 'Edit & resolve field conflicts',
        defaults: { superuser:'full', administrator:'full', staff:'none', agent:'none', public:'none' } },
      { key: 'axiom.match.realtor', label: 'Assign realtor to records',
        defaults: { superuser:'full', administrator:'full', staff:'none', agent:'none', public:'none' } },
    ],
  },
  {
    label: 'Stage 2 — Validation', platform: 'axiom',
    rows: [
      { key: 'axiom.validation.view', label: 'View validation table',
        defaults: { superuser:'full', administrator:'full', staff:'none', agent:'none', public:'none' } },
      { key: 'axiom.validation.edit', label: 'Edit cell data inline',
        defaults: { superuser:'full', administrator:'full', staff:'none', agent:'none', public:'none' } },
      { key: 'axiom.validation.accept_reject', label: 'Accept / Reject individual rows',
        defaults: { superuser:'full', administrator:'full', staff:'none', agent:'none', public:'none' } },
    ],
  },
  {
    label: 'Stage 3 — Analysis', platform: 'axiom',
    rows: [
      { key: 'axiom.analysis.view', label: 'View analysis & diff summary',
        defaults: { superuser:'full', administrator:'full', staff:'none', agent:'none', public:'none' } },
    ],
  },
  {
    label: 'Stage 4 — REIMS Queue', platform: 'axiom',
    rows: [
      { key: 'axiom.queue.view', label: 'View import queue',
        defaults: { superuser:'full', administrator:'full', staff:'none', agent:'none', public:'none' } },
      { key: 'axiom.queue.import', label: 'Execute live import to REIMS',
        defaults: { superuser:'full', administrator:'full', staff:'none', agent:'none', public:'none' } },
    ],
  },
  {
    label: 'Batch History', platform: 'axiom',
    rows: [
      { key: 'axiom.batch.view', label: 'View batch history & logs',
        defaults: { superuser:'full', administrator:'full', staff:'none', agent:'none', public:'none' } },
      { key: 'axiom.batch.run_details', label: 'View individual run details',
        defaults: { superuser:'full', administrator:'full', staff:'none', agent:'none', public:'none' } },
      { key: 'axiom.batch.delete', label: 'Delete / purge batch runs',
        defaults: { superuser:'full', administrator:'full', staff:'none', agent:'none', public:'none' } },
    ],
  },
  {
    label: 'System Configuration', platform: 'axiom',
    rows: [
      { key: 'axiom.config.rules', label: 'Manage extraction rules',
        defaults: { superuser:'full', administrator:'full', staff:'none', agent:'none', public:'none' } },
      { key: 'axiom.config.mapping', label: 'Configure field mapping overrides',
        defaults: { superuser:'full', administrator:'none', staff:'none', agent:'none', public:'none' } },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDefaultState(): MatrixState {
  const state: MatrixState = {};
  for (const section of MATRIX) {
    for (const row of section.rows) {
      state[row.key] = { ...row.defaults };
    }
  }
  return state;
}

function mergeWithDB(
  defaults: MatrixState,
  dbRows: { permission_key: string; role: string; level: string }[],
): MatrixState {
  const merged = structuredClone(defaults);
  for (const row of dbRows) {
    const key  = row.permission_key;
    const role = row.role as Role;
    const lvl  = row.level as AccessLevel;
    if (merged[key]) merged[key][role] = lvl;
  }
  return merged;
}

function stateToRows(state: MatrixState): { permission_key: string; role: string; level: string }[] {
  return Object.entries(state).flatMap(([key, roles]) =>
    Object.entries(roles).map(([role, level]) => ({ permission_key: key, role, level }))
  );
}

function allowedLevels(row: MatrixRowDef, role: Role): AccessLevel[] {
  if (role === 'superuser') return ['full'];
  if (row.limitedRoles?.includes(role)) return ['full', 'limited', 'none'];
  return ['full', 'none'];
}

function nextLevel(current: AccessLevel, levels: AccessLevel[]): AccessLevel {
  const idx = levels.indexOf(current);
  return levels[(idx + 1) % levels.length];
}

// ── Cell component ────────────────────────────────────────────────────────────

function LevelBadge({
  level,
  color,
  locked,
  onClick,
}: {
  level:   AccessLevel;
  color:   string;
  locked:  boolean;
  onClick: () => void;
}) {
  const icon   = level === 'full' ? '●' : level === 'limited' ? '◑' : '—';
  const active = level !== 'none';

  return (
    <button
      onClick={locked ? undefined : onClick}
      title={locked ? 'Superuser — always full access' : `${level === 'full' ? 'Full' : level === 'limited' ? 'Limited' : 'No'} access · click to cycle`}
      disabled={locked}
      className="w-[52px] h-8 rounded-lg flex items-center justify-center text-[15px] font-bold transition-all duration-150 select-none"
      style={{
        background: active ? `${color}18` : 'transparent',
        border:     `1px solid ${active ? `${color}35` : '#1e1e1e'}`,
        color:      active ? color : '#333',
        cursor:     locked ? 'default' : 'pointer',
        opacity:    locked ? 0.85 : 1,
      }}
      onMouseEnter={e => { if (!locked && !active) (e.currentTarget as HTMLElement).style.borderColor = `${color}40`; }}
      onMouseLeave={e => { if (!locked && !active) (e.currentTarget as HTMLElement).style.borderColor = '#1e1e1e'; }}
    >
      {icon}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RoleMatrix() {
  const { role: myRole } = useAuth();
  const isSuperuser = myRole === 'superuser';

  const defaults                          = buildDefaultState();
  const [matrix,      setMatrix     ]     = useState<MatrixState>(defaults);
  const [savedMatrix, setSavedMatrix]     = useState<MatrixState>(defaults);
  const [loading,     setLoading    ]     = useState(true);
  const [saving,      setSaving     ]     = useState(false);
  const [saveStatus,  setSaveStatus ]     = useState<'idle' | 'ok' | 'err'>('idle');
  const [platform,    setPlatform   ]     = useState<'reims' | 'axiom'>('reims');

  const isDirty = JSON.stringify(matrix) !== JSON.stringify(savedMatrix);

  // Load from API
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await authedFetch('/api/admin/role-permissions');
      const json = await res.json();
      if (res.ok && Array.isArray(json.rows) && json.rows.length > 0) {
        const merged = mergeWithDB(defaults, json.rows);
        setMatrix(merged);
        setSavedMatrix(merged);
      }
    } catch { /* fall through to defaults */ }
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Toggle a cell
  function toggle(key: string, role: Role) {
    if (!isSuperuser || role === 'superuser') return;
    const section = MATRIX.flatMap(s => s.rows).find(r => r.key === key);
    if (!section) return;
    const levels  = allowedLevels(section, role);
    setMatrix(prev => ({
      ...prev,
      [key]: { ...prev[key], [role]: nextLevel(prev[key][role], levels) },
    }));
    setSaveStatus('idle');
  }

  // Save to API
  async function save() {
    if (!isSuperuser) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      const res = await authedFetch('/api/admin/role-permissions', {
        method: 'POST',
        body: JSON.stringify({ rows: stateToRows(matrix) }),
      });
      if (res.ok) {
        setSavedMatrix(structuredClone(matrix));
        setSaveStatus('ok');
      } else {
        setSaveStatus('err');
      }
    } catch { setSaveStatus('err'); }
    setSaving(false);
    setTimeout(() => setSaveStatus('idle'), 3000);
  }

  function reset() {
    setMatrix(structuredClone(savedMatrix));
    setSaveStatus('idle');
  }

  const sections = MATRIX.filter(s => s.platform === platform);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 rounded-full border-2 border-[#c9a84c]/30 border-t-[#c9a84c] animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <p className="text-[10px] text-[#555] uppercase tracking-[0.18em] font-bold mb-1">
            Version 1.0 · 21 July 2026 · Prepared by Administration
          </p>
          {!isSuperuser && (
            <p className="text-[11px] text-[#8b5cf6] bg-[#8b5cf615] border border-[#8b5cf620] rounded-lg px-3 py-1.5 inline-block">
              View only — contact Superuser to modify permissions
            </p>
          )}
        </div>

        {/* Platform tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-[#111] border border-[#1e1e1e]">
          {(['reims', 'axiom'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all"
              style={{
                background: platform === p ? (p === 'reims' ? '#c9a84c18' : '#3daee918') : 'transparent',
                border:     `1px solid ${platform === p ? (p === 'reims' ? '#c9a84c40' : '#3daee940') : 'transparent'}`,
                color:      platform === p ? (p === 'reims' ? '#c9a84c' : '#3daee9') : '#555',
              }}
            >
              {p === 'reims' ? '01 · Vanguard REOS' : '02 · AXIOM'}
            </button>
          ))}
        </div>
      </div>

      {/* Access key legend */}
      <div className="flex items-center gap-4 mb-5 px-4 py-2.5 rounded-xl bg-[#0d0d0d] border border-[#1a1a1a]">
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#444]">Access Key</span>
        {[
          { icon: '●', label: 'Full Access',    color: '#c9a84c' },
          { icon: '◑', label: 'Limited Access', color: '#10b981' },
          { icon: '—', label: 'No Access',      color: '#333' },
        ].map(k => (
          <div key={k.label} className="flex items-center gap-1.5">
            <span className="text-sm font-bold" style={{ color: k.color }}>{k.icon}</span>
            <span className="text-[10px] text-[#555]">{k.label}</span>
          </div>
        ))}
      </div>

      {/* Matrix table */}
      <div className="overflow-x-auto rounded-xl border border-[#1e1e1e]">
        <table className="w-full border-collapse" style={{ minWidth: 780 }}>
          {/* Column headers */}
          <thead>
            <tr className="bg-[#0d0d0d] border-b border-[#1e1e1e]">
              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#555] w-[260px]">
                Feature / Capability
              </th>
              {ROLES.map(role => {
                const m = ROLE_META[role];
                return (
                  <th key={role} className="py-3 text-center w-[64px]">
                    <div className="flex flex-col items-center gap-0.5">
                      <span
                        className="text-[11px] font-black tracking-wider"
                        style={{ color: m.color }}
                      >
                        {m.code}
                      </span>
                      <span className="text-[9px] text-[#444] font-medium">{m.label}</span>
                    </div>
                  </th>
                );
              })}
              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#555]">
                Restriction Notes
              </th>
            </tr>
          </thead>

          <tbody>
            {sections.map((section, si) => (
              <>
                {/* Section header */}
                <tr key={`sec-${si}`} className="border-b border-[#1a1a1a]">
                  <td
                    colSpan={7}
                    className="px-4 py-2 text-[9px] font-black uppercase tracking-[0.22em]"
                    style={{
                      background: '#0a0a0a',
                      color: platform === 'reims' ? '#c9a84c99' : '#3daee999',
                      borderLeft: `2px solid ${platform === 'reims' ? '#c9a84c' : '#3daee9'}`,
                    }}
                  >
                    {section.label}
                  </td>
                </tr>

                {/* Feature rows */}
                {section.rows.map((row, ri) => (
                  <tr
                    key={row.key}
                    className="border-b border-[#111] transition-colors hover:bg-[#0d0d0d]"
                    style={{ background: ri % 2 === 0 ? '#080808' : '#060606' }}
                  >
                    {/* Feature label */}
                    <td className="px-4 py-2.5">
                      <span className="text-[12px] text-[#b0b0b0] font-medium">{row.label}</span>
                    </td>

                    {/* Role cells */}
                    {ROLES.map(role => (
                      <td key={role} className="py-2 text-center">
                        <div className="flex justify-center">
                          <LevelBadge
                            level={matrix[row.key]?.[role] ?? 'none'}
                            color={ROLE_META[role].color}
                            locked={role === 'superuser' || !isSuperuser}
                            onClick={() => toggle(row.key, role)}
                          />
                        </div>
                      </td>
                    ))}

                    {/* Notes */}
                    <td className="px-4 py-2.5">
                      {row.notes && (
                        <span className="text-[10px] text-[#444] leading-snug">{row.notes}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer actions — superuser only */}
      {isSuperuser && (
        <div className="flex items-center justify-between mt-5 px-4 py-3 rounded-xl bg-[#0d0d0d] border border-[#1e1e1e]">
          <div className="flex items-center gap-3">
            {isDirty && (
              <span className="text-[11px] text-[#f59e0b] font-medium">
                ● Unsaved changes
              </span>
            )}
            {saveStatus === 'ok' && (
              <span className="text-[11px] text-[#10b981] font-medium">
                ✓ Saved successfully
              </span>
            )}
            {saveStatus === 'err' && (
              <span className="text-[11px] text-[#ef4444] font-medium">
                ✕ Save failed — run the migration SQL first
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isDirty && (
              <button
                onClick={reset}
                className="px-4 py-2 text-xs text-[#888] hover:text-[#bbb] border border-[#2a2a2a] hover:border-[#3a3a3a] rounded-lg transition-colors"
              >
                Discard
              </button>
            )}
            <button
              onClick={save}
              disabled={saving || !isDirty}
              className="px-5 py-2 text-xs font-bold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: isDirty ? '#c9a84c' : '#1a1a1a',
                color:      isDirty ? '#0f0f0f' : '#444',
                border:     `1px solid ${isDirty ? '#c9a84c' : '#2a2a2a'}`,
              }}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
