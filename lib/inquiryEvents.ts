import type { SupabaseClient } from '@supabase/supabase-js';

export type InquiryEventType = 'created' | 'match_auto' | 'match_manual' | 'match_bulk';

// Best-effort audit write: a failure here (e.g. migration not yet run) must never break the user's action.
export async function logInquiryEvent(
  admin: SupabaseClient,
  inquiryId: string,
  type: InquiryEventType,
  actor: { name: string; email: string | null },
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    let code: string | null = null;
    if (actor.email) {
      const { data } = await admin.from('cr_agents').select('agent_code').eq('email', actor.email).maybeSingle();
      code = data?.agent_code ?? null;
    }
    await admin.from('cr_inquiry_events').insert({
      inquiry_id: inquiryId, event_type: type,
      actor_name: actor.name, actor_email: actor.email, actor_code: code, details,
    });
  } catch { /* audit is best-effort */ }
}
