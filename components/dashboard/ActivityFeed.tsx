'use client';

import { useState, useEffect, useRef } from 'react';
import { authedFetch } from '../../lib/authedFetch';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../../contexts/AuthContext';

interface ActivityEvent {
  id:          string;
  event_type:  string;
  entity_id:   string;
  description: string;
  actor_email: string | null;
  meta:        Record<string, string>;
  created_at:  string;
}

const EVENT_ICON: Record<string, { icon: string; color: string }> = {
  unit_added:           { icon: '＋', color: '#2dd496' },
  unit_status_changed:  { icon: '⇄',  color: '#5b9cf6' },
  unit_updated:         { icon: '✎',  color: '#a47cf5' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)   return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function ActivityFeed() {
  const { user }  = useAuth();
  const [events,  setEvents ] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [pulse,   setPulse  ] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Initial load
  useEffect(() => {
    if (!user) return;
    authedFetch('/api/dashboard/activity')
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.events) setEvents(j.events); })
      .finally(() => setLoading(false));
  }, [user]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const ch = supabase
      .channel('activity_log_feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log' },
        (payload) => {
          const ev = payload.new as ActivityEvent;
          setEvents(prev => [ev, ...prev].slice(0, 25));
          setPulse(true);
          setTimeout(() => setPulse(false), 600);
        }
      )
      .subscribe();

    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const defaultIcon = { icon: '●', color: '#44445a' };

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <h3 style={{ ...headingStyle, margin: 0 }}>Activity Feed</h3>
        <span
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: pulse ? '#2dd496' : '#2dd49660',
            boxShadow: pulse ? '0 0 6px #2dd496' : 'none',
            transition: 'all .3s',
            marginLeft: 'auto',
          }}
          title="Live"
        />
        <span style={{ fontSize: 9, color: '#44445a', letterSpacing: '.06em' }}>LIVE</span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ height: 38, borderRadius: 6, background: '#1a1a24', opacity: 1 - i * 0.15 }} />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <p style={{ fontSize: 12, color: '#44445a', margin: 0 }}>
            No activity yet — changes to units will appear here in real time.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'flex', flexDirection: 'column',
            maxHeight: 360, overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: '#22222e transparent',
          }}
        >
          {events.map((ev, i) => {
            const { icon, color } = EVENT_ICON[ev.event_type] ?? defaultIcon;
            return (
              <div
                key={ev.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '9px 4px',
                  borderBottom: i < events.length - 1 ? '1px solid #1a1a24' : 'none',
                  animation: i === 0 ? 'fadeSlideIn .3s ease' : 'none',
                }}
              >
                {/* Event type badge */}
                <span
                  style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: `${color}18`,
                    border: `1px solid ${color}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, color, flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  {icon}
                </span>

                {/* Description */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 11, color: '#c8c8e8', lineHeight: 1.4 }}>
                    {ev.description}
                  </p>
                  {ev.actor_email && (
                    <p style={{ margin: '2px 0 0', fontSize: 9.5, color: '#44445a' }}>
                      by {ev.actor_email}
                    </p>
                  )}
                </div>

                {/* Time */}
                <span style={{ fontSize: 9.5, color: '#44445a', flexShrink: 0, marginTop: 2 }}>
                  {timeAgo(ev.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#111118',
  border: '1px solid #22222e',
  borderRadius: 12,
  padding: '20px',
};

const headingStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  color: '#44445a',
};
