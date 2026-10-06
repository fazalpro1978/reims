import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function assertSuperuser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const sb = adminClient();
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await sb.from('profiles').select('role,is_active,full_name,email').eq('id', user.id).single();
  if (!profile?.is_active || profile.role !== 'superuser') return null;
  return { fullName: profile.full_name as string, email: profile.email as string };
}

function platformLabel(platforms: string[] | null): string {
  if (!platforms || platforms.length === 0) return 'None';
  return platforms.map(p => p === 'dinges' ? 'AXIOM (dInges)' : p.toUpperCase()).join(', ');
}

const ROLE_LABEL: Record<string, string> = {
  superuser: 'Superuser', administrator: 'Administrator',
  staff: 'Staff', agent: 'Agent', public: 'Public',
};

export async function POST(req: NextRequest) {
  const caller = await assertSuperuser(req);
  if (!caller) return NextResponse.json({ error: 'Forbidden — Superuser only' }, { status: 403 });

  const { id } = await req.json() as { id?: string };
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const sb = adminClient();
  const { data: target, error } = await sb
    .from('profiles')
    .select('full_name,email,role,platforms,is_active,agent_code')
    .eq('id', id)
    .single();

  if (error || !target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const appUrl    = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://reims.propertyscape.io').replace(/\/$/, '');
  const logoBuf   = fs.readFileSync(path.join(process.cwd(), 'public/brand/logo-email.png'));
  const psBannerBuf = fs.readFileSync(path.join(process.cwd(), 'public/brand/propertyscape_banner.jpg'));

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: `Vanguard REOS <${process.env.RESEND_FROM ?? 'noreply@privegroupre.com'}>`,
    to:  target.email as string,
    cc:  caller.email !== target.email ? caller.email : undefined,
    subject: `Welcome to Vanguard REOS — Your Account is Ready`,
    attachments: [
      { filename: 'logo.png',      content: logoBuf,     contentType: 'image/png',  contentId: 'logo-prive' },
      { filename: 'ps-banner.jpg', content: psBannerBuf, contentType: 'image/jpeg', contentId: 'ps-banner'  },
    ],
    html: `
<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f0ece4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ece4;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- Gold header -->
        <tr>
          <td style="background:#c9a84c;padding:28px 28px 24px;">
            <img src="cid:logo-prive" alt="Privé Group Real Estate" style="height:52px;width:auto;display:block;margin-bottom:18px;" />
            <p style="margin:0 0 6px;font-size:11px;font-family:monospace;color:#fff4cc;letter-spacing:1px;text-transform:uppercase;">Vanguard REOS · Account Introduction</p>
            <h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;line-height:1.3;">Welcome — your account is ready</h1>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:24px 28px 0;">
            <p style="margin:0 0 2px;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Account</p>
            <p style="margin:0;font-size:18px;font-weight:700;color:#111;">${target.full_name ?? target.email}</p>
          </td>
        </tr>

        <!-- Details -->
        <tr>
          <td style="padding:20px 28px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:12px;color:#999;width:38%;">Email Address</td>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#222;">${target.email}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:12px;color:#999;">Role</td>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#c9a84c;font-weight:600;">${ROLE_LABEL[target.role as string] ?? target.role}</td>
              </tr>
              ${target.agent_code ? `
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:12px;color:#999;">Agent Code</td>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#222;font-family:monospace;font-weight:700;">${target.agent_code}</td>
              </tr>` : ''}
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:12px;color:#999;">Platform Access</td>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#1a6a9a;">${platformLabel(target.platforms as string[] | null)}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;font-size:12px;color:#999;">Account Status</td>
                <td style="padding:10px 0;font-size:13px;font-weight:600;color:${target.is_active ? '#2a7a3b' : '#c0392b'};">${target.is_active ? 'Active' : 'Suspended'}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:28px 28px 0;text-align:center;">
            <a href="${appUrl}" style="display:inline-block;background:#c9a84c;color:#fff;font-size:13px;font-weight:700;text-decoration:none;padding:12px 32px;border-radius:8px;letter-spacing:0.3px;">Get Started →</a>
            <p style="margin:12px 0 0;font-size:11px;color:#aaa;">${appUrl}</p>
          </td>
        </tr>

        <!-- Note -->
        <tr>
          <td style="padding:20px 28px 0;">
            <div style="background:#faf8f4;border-left:3px solid #c9a84c;border-radius:4px;padding:14px 16px;">
              <p style="margin:0;font-size:12px;color:#666;line-height:1.6;">If you have not set your password yet, use the <b>Forgot Password</b> link on the login page to create one. Contact your system administrator if you need assistance.</p>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 28px 28px;text-align:center;border-top:1px solid #f0f0f0;margin-top:24px;">
            <p style="margin:0 0 4px;font-size:11px;color:#bbb;">REIMS &middot; Vanguard Real Estate Operations System</p>
            <p style="margin:0 0 10px;font-size:10px;color:#ccc;font-style:italic;">Generated By: GRID-X Bot</p>
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="vertical-align:middle;padding-right:8px;font-size:10px;color:#bbb;white-space:nowrap;">Powered By</td>
                <td style="vertical-align:middle;">
                  <img src="cid:ps-banner" alt="PropertyScape" style="height:22px;width:auto;display:block;" />
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`,
  });

  return NextResponse.json({ ok: true });
}
