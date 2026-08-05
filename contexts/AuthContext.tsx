'use client';

import {
  createContext, useContext, useEffect, useState, useCallback, ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '../lib/supabase/client';

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
  'units.add':               ['superuser','administrator'],
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
  'admin.aliases':           ['superuser','administrator','staff'],
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
  reloadPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null, role: null, loading: true,
  signOut: async () => {},
  can: () => false,
  reloadPermissions: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// ── Dynamic permission loader ─────────────────────────────────────────────────
async function loadDbPermissions(): Promise<Record<string, UserRole[]> | null> {
  try {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('permission_key,role,level');

    if (error || !data || data.length === 0) return null;

    const map: Record<string, UserRole[]> = {};
    for (const row of data) {
      if (row.level === 'none') continue;
      if (!map[row.permission_key]) map[row.permission_key] = [];
      map[row.permission_key].push(row.role as UserRole);
    }
    return map;
  } catch { return null; }
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user,         setUser        ] = useState<AuthProfile | null>(null);
  const [loading,      setLoading     ] = useState(true);
  const [dynamicPerms, setDynamicPerms] = useState<Record<string, UserRole[]> | null>(null);

  const reloadPermissions = useCallback(async () => {
    const perms = await loadDbPermissions();
    setDynamicPerms(perms);
  }, []);

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
      // Still attempt to load permissions even for fallback profile
      loadDbPermissions().then(setDynamicPerms);
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

    // Load DB permissions in background; fall back to hardcoded if table is empty/missing
    loadDbPermissions().then(setDynamicPerms);
  }, [router]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }
      // TOKEN_REFRESHED only updates the JWT — profile hasn't changed, skip the fetch
      if (event === 'TOKEN_REFRESHED') {
        setLoading(false);
        return;
      }
      fetchProfile(session.user).finally(() => setLoading(false));
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
    // Prefer DB-loaded permissions; fall back to hardcoded constant
    const source  = dynamicPerms ?? PERMISSIONS;
    const allowed = source[permission];
    if (!allowed) return false;
    return allowed.includes(user.role);
  }, [user, dynamicPerms]);

  return (
    <AuthContext.Provider value={{ user, role: user?.role ?? null, loading, signOut, can, reloadPermissions }}>
      {children}
    </AuthContext.Provider>
  );
}
