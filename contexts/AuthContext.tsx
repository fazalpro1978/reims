'use client';

import {
  createContext, useContext, useEffect, useState, useCallback, ReactNode,
} from 'react';
import { createClient, User } from '@supabase/supabase-js';
import { useRouter, usePathname } from 'next/navigation';

// ── Supabase client ───────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// ── Types ─────────────────────────────────────────────────────────────────────
export type UserRole = 'superuser' | 'administrator' | 'staff' | 'agent' | 'public';

export interface AuthProfile {
  id:         string;
  email:      string;
  fullName:   string;
  role:       UserRole;
  department: string;
  platforms:  string[];
  isActive:   boolean;
}

// ── Permission map (mirrors the ACM artifact exactly) ────────────────────────
const PERMISSIONS: Record<string, UserRole[]> = {
  // Units Inventory
  'units.view':              ['superuser','administrator','staff','agent','public'],
  'units.view_all':          ['superuser','administrator','staff'],   // agent=available only
  'units.view_financials':   ['superuser','administrator','staff'],
  'units.view_remarks':      ['superuser','administrator','staff'],
  'units.add':               ['superuser','administrator','staff'],
  'units.edit':              ['superuser','administrator','staff'],
  'units.delete':            ['superuser','administrator'],
  'units.bulk_edit':         ['superuser','administrator','staff'],
  // PDF Reports
  'report.generate':         ['superuser','administrator','staff','agent'],
  'report.download':         ['superuser','administrator','staff','agent'],
  'report.share_internal':   ['superuser','administrator','staff'],
  'report.share_public':     ['superuser','administrator','staff','agent'],
  // Code Registry
  'registry.view':           ['superuser','administrator','staff'],
  'registry.smart_codes':    ['superuser','administrator','staff'],
  'registry.realtors.view':  ['superuser','administrator','staff'],
  'registry.realtors.write': ['superuser','administrator'],
  'registry.realtors.delete':['superuser','administrator'],
  'registry.zones.view':     ['superuser','administrator','staff'],
  'registry.zones.write':    ['superuser','administrator'],
  'registry.zones.delete':   ['superuser'],
  // Neighborhood Guide
  'neighborhood.view':       ['superuser','administrator','staff','agent'],
  'neighborhood.edit':       ['superuser','administrator','staff'],
  // Admin
  'admin.access':            ['superuser','administrator'],
  'admin.users':             ['superuser','administrator'],
  'admin.settings':          ['superuser'],
  // dInges (server-side gate — these are checked in dInges middleware too)
  'dinges.access':           ['superuser','administrator'],
};

// ── Context shape ─────────────────────────────────────────────────────────────
interface AuthCtx {
  user:     AuthProfile | null;
  role:     UserRole | null;
  loading:  boolean;
  signOut:  () => Promise<void>;
  can:      (permission: string) => boolean;
}

const AuthContext = createContext<AuthCtx>({
  user: null, role: null, loading: true,
  signOut: async () => {},
  can: () => false,
});

export const useAuth = () => useContext(AuthContext);

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user,    setUser   ] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (authUser: User) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,full_name,role,department,platforms,is_active')
      .eq('id', authUser.id)
      .single();

    if (error || !data) {
      // Profile not created yet (race after invite) — use defaults
      setUser({
        id:         authUser.id,
        email:      authUser.email ?? '',
        fullName:   authUser.email?.split('@')[0] ?? '',
        role:       'staff',
        department: 'Privé Group Real Estate',
        platforms:  ['reims'],
        isActive:   true,
      });
      return;
    }

    if (!data.is_active) {
      await supabase.auth.signOut();
      router.replace('/login?reason=inactive');
      return;
    }

    setUser({
      id:         data.id,
      email:      data.email,
      fullName:   data.full_name ?? data.email.split('@')[0],
      role:       data.role as UserRole,
      department: data.department ?? '',
      platforms:  data.platforms ?? ['reims'],
      isActive:   data.is_active,
    });
  }, [router]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchProfile(session.user).finally(() => setLoading(false));
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // Route guard — redirect unauthenticated users to login
  useEffect(() => {
    if (loading) return;
    const isPublicRoute = pathname?.startsWith('/login') || pathname?.startsWith('/report');
    if (!user && !isPublicRoute) {
      router.replace('/login');
    }
  }, [user, loading, pathname, router]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.replace('/login');
  }, [router]);

  const can = useCallback((permission: string): boolean => {
    if (!user?.role) return false;
    const allowed = PERMISSIONS[permission];
    if (!allowed) return false;
    return allowed.includes(user.role);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, role: user?.role ?? null, loading, signOut, can }}>
      {children}
    </AuthContext.Provider>
  );
}
