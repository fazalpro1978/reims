import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function validatePassword(pw: string): string | null {
  if (pw.length < 8)           return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(pw))       return 'Password must contain at least one uppercase letter.';
  if (!/[0-9]/.test(pw))       return 'Password must contain at least one number.';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Password must contain at least one special character.';
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, full_name, company, phone } = await req.json();

    if (!email?.trim() || !password || !full_name?.trim()) {
      return NextResponse.json({ error: 'Email, name, and password are required.' }, { status: 400 });
    }

    const pwErr = validatePassword(password);
    if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });

    // Create the Supabase auth user — trigger sets is_active=false, registration_status='pending'
    const { data, error } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true, // skip email confirmation — we gate via admin approval instead
      user_metadata: {
        full_name: full_name.trim(),
        company:   company?.trim() ?? '',
        phone:     phone?.trim()   ?? '',
        self_registered: true,
      },
    });

    if (error) {
      const msg = error.message.includes('already registered') || error.message.includes('already been registered')
        ? 'An account with this email already exists.'
        : error.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // Notify all active admins/superusers via email (non-blocking)
    void (async () => {
      if (!process.env.RESEND_API_KEY) return;
      try {
        const { data: admins } = await admin
          .from('profiles')
          .select('email, full_name')
          .in('role', ['superuser', 'administrator'])
          .eq('is_active', true);

        const recipients = (admins ?? []).map(a => a.email).filter(Boolean);
        if (recipients.length === 0) recipients.push(process.env.RESEND_FROM ?? 'admin@privegroupre.com');

        const resend = new Resend(process.env.RESEND_API_KEY);
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://reims.propertyscape.io').replace(/\/$/, '');

        await resend.emails.send({
          from: `Vanguard REOS <${process.env.RESEND_FROM ?? 'noreply@privegroupre.com'}>`,
          to:   recipients,
          subject: `New Access Request — ${full_name.trim()} · Action Required`,
          html: `
<!DOCTYPE html><html lang="en"><body style="margin:0;padding:0;background:#0f0f0f;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;">
  <tr><td align="center" style="padding:32px 16px;">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#111118;border-radius:12px;overflow:hidden;border:1px solid #22222e;">
      <tr><td style="background:#c9a84c;padding:24px 28px;">
        <p style="margin:0 0 4px;font-size:10px;font-family:monospace;color:#0f0f0f;letter-spacing:1px;text-transform:uppercase;">Vanguard REOS · Access Request</p>
        <h1 style="margin:0;font-size:18px;font-weight:700;color:#0f0f0f;">New registration pending approval</h1>
      </td></tr>
      <tr><td style="padding:24px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:8px 0;border-bottom:1px solid #1e1e2e;font-size:11px;color:#666;width:36%;">Name</td><td style="padding:8px 0;border-bottom:1px solid #1e1e2e;font-size:13px;color:#e0e0e0;">${full_name.trim()}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #1e1e2e;font-size:11px;color:#666;">Email</td><td style="padding:8px 0;border-bottom:1px solid #1e1e2e;font-size:13px;color:#e0e0e0;">${email.trim()}</td></tr>
          ${company?.trim() ? `<tr><td style="padding:8px 0;border-bottom:1px solid #1e1e2e;font-size:11px;color:#666;">Company</td><td style="padding:8px 0;border-bottom:1px solid #1e1e2e;font-size:13px;color:#e0e0e0;">${company.trim()}</td></tr>` : ''}
          ${phone?.trim()   ? `<tr><td style="padding:8px 0;font-size:11px;color:#666;">Phone</td><td style="padding:8px 0;font-size:13px;color:#e0e0e0;">${phone.trim()}</td></tr>` : ''}
        </table>
      </td></tr>
      <tr><td style="padding:16px 28px 28px;">
        <a href="${appUrl}" style="display:inline-block;background:#c9a84c;color:#0f0f0f;font-size:12px;font-weight:700;text-decoration:none;padding:11px 22px;border-radius:8px;letter-spacing:.5px;">Review in REIMS →</a>
      </td></tr>
      <tr><td style="padding:16px 28px 20px;border-top:1px solid #1e1e2e;text-align:center;">
        <p style="margin:0;font-size:10px;color:#333;">Vanguard REOS · Access requests can be approved in the notification bell on login.</p>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`,
        });
      } catch {}
    })();

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 });
  }
}
