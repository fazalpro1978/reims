import { supabase } from './supabase/client';

export async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.body && !((init.headers as Record<string, string>)?.['Content-Type'])
        ? { 'Content-Type': 'application/json' }
        : {}),
    },
  });
}
