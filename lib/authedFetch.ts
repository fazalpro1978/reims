import { supabase } from './supabase/client';

// authedFetch NEVER throws — network errors become a synthetic 503 Response
// so every caller's `if (!res.ok)` check handles them without try/catch.
export async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const isFormData = init.body instanceof FormData;
    const hasContentType = !!(init.headers as Record<string, string>)?.['Content-Type'];
    return await fetch(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(!isFormData && init.body && !hasContentType ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error — please retry';
    return new Response(JSON.stringify({ error: message }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
