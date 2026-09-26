'use client';

import { useRouter } from 'next/navigation';
import { useUserPrefs } from '../../hooks/useUserPrefs';

interface ModuleDef {
  id:    string;
  label: string;
  sub:   string;
  href:  string;
  color: string;
  icon:  React.ReactNode;
}

const ALL_MODULES: ModuleDef[] = [
  {
    id: 'inventory', label: 'Inventory', sub: 'Units & availability',
    href: '/inventory', color: '#22d3ee',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    id: 'synergy', label: 'Synergy', sub: 'CRM & pipeline',
    href: '/synergy', color: '#f43f5e',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}>
        <circle cx="8" cy="8" r="3" /><circle cx="16" cy="16" r="3" />
        <path d="M10.5 10.5l3 3" />
      </svg>
    ),
  },
  {
    id: 'properties', label: 'Properties', sub: 'Building register',
    href: '/properties', color: '#a78bfa',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}>
        <path d="M6 22V4a2 2 0 012-2h8a2 2 0 012 2v18H6zM2 22h20M10 6h.01M10 10h.01M14 6h.01M14 10h.01" />
      </svg>
    ),
  },
  {
    id: 'ingest-queue', label: 'AXIOM Queue', sub: 'Import pipeline',
    href: '/ingest-queue', color: '#f97316',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}>
        <path d="M12 3v12M8 11l4 4 4-4" />
        <path d="M20 21H4a1 1 0 01-1-1v-2a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-1 1z" />
      </svg>
    ),
  },
  {
    id: 'code-registry', label: 'Registry', sub: 'Smart codes',
    href: '/code-registry', color: '#e879f9',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}>
        <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" />
        <line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
      </svg>
    ),
  },
  {
    id: 'realtors', label: 'Realtors', sub: 'Broker register',
    href: '/realtors', color: '#fbbf24',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}>
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2M12 12v4M10 14h4" />
      </svg>
    ),
  },
  {
    id: 'zones', label: 'Zones', sub: 'District map',
    href: '/zones', color: '#34d399',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}>
        <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    id: 'contracts', label: 'Contracts', sub: 'Legal documents',
    href: '/contracts', color: '#fb923c',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
    ),
  },
];

export default function QuickAccess() {
  const router = useRouter();
  const { prefs } = useUserPrefs();

  const pinned = ALL_MODULES.filter(m => prefs.pinnedModules.includes(m.id));

  if (pinned.length === 0) return null;

  return (
    <div style={{
      display: 'flex',
      gap: 8,
      marginBottom: 12,
      flexWrap: 'wrap',
    }}>
      {pinned.map(mod => (
        <button
          key={mod.id}
          onClick={() => router.push(mod.href)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: '#111118',
            border: '1px solid #22222e',
            borderRadius: 10,
            padding: '10px 14px',
            cursor: 'pointer',
            transition: 'border-color .15s, background .15s',
            minWidth: 140,
            flex: '1 1 140px',
            maxWidth: 200,
            textAlign: 'left',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = mod.color;
            (e.currentTarget as HTMLElement).style.background  = `${mod.color}0d`;
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = '#22222e';
            (e.currentTarget as HTMLElement).style.background  = '#111118';
          }}
        >
          <span style={{ color: mod.color, flexShrink: 0 }}>{mod.icon}</span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e2ee', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {mod.label}
            </span>
            <span style={{ fontSize: 10, color: '#44445a', whiteSpace: 'nowrap' }}>{mod.sub}</span>
          </span>
        </button>
      ))}

      {/* Settings shortcut */}
      <button
        onClick={() => router.push('/settings')}
        title="Customise quick access"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: '1px dashed #22222e',
          borderRadius: 10,
          padding: '10px 14px',
          cursor: 'pointer',
          color: '#44445a',
          transition: 'border-color .15s, color .15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = '#c9a84c';
          (e.currentTarget as HTMLElement).style.color       = '#c9a84c';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = '#22222e';
          (e.currentTarget as HTMLElement).style.color       = '#44445a';
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </button>
    </div>
  );
}

// Export module list for use in Settings page
export { ALL_MODULES };
