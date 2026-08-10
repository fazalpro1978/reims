import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';
import { Resend } from 'resend';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator']);
  if (!auth.ok) return auth.response;

  const { data } = await admin
    .from('profiles')
    .select('id, email, full_name, company, phone, created_at')
    .eq('registration_status', 'pending')
    .order('created_at', { ascending: true });

  return NextResponse.json({ registrations: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator']);
  if (!auth.ok) return auth.response;

  const { id, action, role } = await req.json(); // action: 'approve' | 'reject'

  if (!id || !action) {
    return NextResponse.json({ error: 'Missing id or action' }, { status: 400 });
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('email, full_name')
    .eq('id', id)
    .single();

  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (action === 'approve') {
    const { error } = await admin
      .from('profiles')
      .update({
        is_active:           true,
        registration_status: 'approved',
        role:                role ?? 'staff',
        updated_at:          new Date().toISOString(),
      })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Notify the registrant
    void (async () => {
      if (!process.env.RESEND_API_KEY) return;
      try {
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://reims.propertyscape.io').replace(/\/$/, '');
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from:    `Vanguard REOS <${process.env.RESEND_FROM ?? 'noreply@privegroupre.com'}>`,
          to:      profile.email,
          subject: 'Your access request has been approved · Vanguard REOS',
          html: `
<!DOCTYPE html><html lang="en"><body style="margin:0;padding:0;background:#0f0f0f;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;">
  <tr><td align="center" style="padding:32px 16px;">
    <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#111118;border-radius:12px;overflow:hidden;border:1px solid #22222e;">
      <tr><td style="background:#10b981;padding:24px 28px;">
        <h1 style="margin:0;font-size:18px;font-weight:700;color:#fff;">Access approved ✓</h1>
      </td></tr>
      <tr><td style="padding:24px 28px;">
        <p style="margin:0 0 16px;font-size:13px;color:#c0c0c0;line-height:1.6;">Hi ${profile.full_name ?? profile.email.split('@')[0]}, your access request has been approved. You can now sign in to Vanguard REOS.</p>
        <a href="${appUrl}/login" style="display:inline-block;background:#c9a84c;color:#0f0f0f;font-size:12px;font-weight:700;text-decoration:none;padding:11px 22px;border-radius:8px;">Sign In →</a>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`,
        });
      } catch {}
    })();

  } else if (action === 'reject') {
    const { error } = await admin
      .from('profiles')
      .update({ registration_status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Optionally: delete the auth user so they can re-register with a different email
    await admin.auth.admin.deleteUser(id).catch(() => {});

  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
