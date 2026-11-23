import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthResult } from './serverAuth';
import { canAccessInquiry } from './inquiryAccess';

// Returns null when the caller may access the inquiry, otherwise the 403/404 response to send.
export async function authorizeInquiry(admin: SupabaseClient, auth: AuthResult, inquiryId: string): Promise<NextResponse | null> {
  const { data: inq } = await admin
    .from('inquiries')
    .select('staff_email, assigned_agent, created_by_email')
    .eq('id', inquiryId)
    .maybeSingle();
  if (!inq) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let agentCode: string | null = null;
  if (auth.role === 'staff') {
    const { data: agentRow } = await admin.from('cr_agents').select('agent_code').eq('email', auth.email).maybeSingle();
    agentCode = agentRow?.agent_code ?? null;
  }
  return canAccessInquiry(auth.role, inq, auth.email, agentCode)
    ? null
    : NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
