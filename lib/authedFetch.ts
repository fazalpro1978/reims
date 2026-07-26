import { supabase } from './supabase/client';

export async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const isFormData = init.body instanceof FormData;
  const hasContentType = !!(init.headers as Record<string, string>)?.['Content-Type'];
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(!isFormData && init.body && !hasContentType ? { 'Content-Type': 'application/json' } : {}),
    },
  });
}
