import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';

// Service role client — bypasses RLS, server-only
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key);
}

// Auth guard — only superuser / administrator
async function assertAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;

  const supabase = adminClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role,is_active,full_name,email')
    .eq('id', user.id)
    .single();

  if (!profile?.is_active || !['superuser','administrator'].includes(profile.role)) return null;
  return { uid: user.id, role: profile.role as string, fullName: profile.full_name as string, email: profile.email as string };
}

function fmtTimestamp(d: Date): string {
  const dd   = String(d.getDate()).padStart(2, '0');
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const hh   = String(d.getHours()).padStart(2, '0');
  const min  = String(d.getMinutes()).padStart(2, '0');
  return `${dd}${mm} ${hh}:${min}`;
}

function platformLabel(platforms: string[] | null): string {
  if (!platforms || platforms.length === 0) return 'None';
  return platforms.map(p => p === 'dinges' ? 'AXIOM (dInges)' : p).join(', ');
}

async function sendAccountUpdateEmail(opts: {
  callerName: string;
  targetName: string;
  targetEmail: string;
  before: { role: string; is_active: boolean; platforms: string[] | null };
  after:  { role: string; is_active: boolean; platforms: string[] | null };
}) {
  const { callerName, targetName, targetEmail, before, after } = opts;

  const auditRows: string[] = [];
  if (before.role      !== after.role)      auditRows.push(`Role: <b>${before.role}</b> → <b>${after.role}</b>`);
  if (before.is_active !== after.is_active) auditRows.push(`Status: <b>${before.is_active ? 'Active' : 'Suspended'}</b> → <b>${after.is_active ? 'Active' : 'Suspended'}</b>`);
  const bp = (before.platforms ?? []).slice().sort().join(',');
  const ap = (after.platforms  ?? []).slice().sort().join(',');
  if (bp !== ap) auditRows.push(`Platform Access: <b>${platformLabel(before.platforms)}</b> → <b>${platformLabel(after.platforms)}</b>`);

  if (auditRows.length === 0) return; // nothing meaningful changed

  const now       = new Date();
  const timestamp = fmtTimestamp(now);
  const logoBuf     = fs.readFileSync(path.join(process.cwd(), 'public/brand/logo-email.png'));
  const psBannerBuf = fs.readFileSync(path.join(process.cwd(), 'public/brand/propertyscape_banner.jpg'));
  const auditCC   = process.env.SUPERUSER_AUDIT_EMAIL ?? 'ahmedali@privegroupre.com';

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: `Vanguard REOS <${process.env.RESEND_FROM ?? 'noreply@privegroupre.com'}>`,
    to:  targetEmail,
    cc:  auditCC !== targetEmail ? auditCC : undefined,
    subject: `Account Updated — ${targetName} · REIMS`,
    attachments: [
      { filename: 'logo.png',    content: logoBuf,     contentType: 'image/png', contentId: 'logo-prive' },
      { filename: 'ps-banner.jpg', content: psBannerBuf, contentType: 'image/jpeg', contentId: 'ps-banner' },
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
            <p style="margin:0 0 6px;font-size:11px;font-family:monospace;color:#fff4cc;letter-spacing:1px;text-transform:uppercase;">User Management · Account Update</p>
            <h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;line-height:1.3;">Your account has been updated by a System Administrator</h1>
          </td>
        </tr>

        <!-- User block -->
        <tr>
          <td style="padding:24px 28px 0;">
            <p style="margin:0 0 2px;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Account</p>
            <p style="margin:0;font-size:18px;font-weight:700;color:#111;">${targetName}</p>
          </td>
        </tr>

        <!-- Details table -->
        <tr>
          <td style="padding:20px 28px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:12px;color:#999;width:38%;">Email Address</td>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#222;">${targetEmail}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:12px;color:#999;">Updated By</td>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#222;">${callerName} &middot; <span style="color:#999;">${timestamp}</span></td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:12px;color:#999;">Account Status</td>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;font-weight:600;color:${after.is_active ? '#2a7a3b' : '#c0392b'};">${after.is_active ? 'Active' : 'Suspended'}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:12px;color:#999;">Role</td>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#c9a84c;font-weight:600;text-transform:capitalize;">${after.role}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;font-size:12px;color:#999;">Platform Access</td>
                <td style="padding:10px 0;font-size:13px;color:#1a6a9a;">${platformLabel(after.platforms)}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Changes audit -->
        <tr>
          <td style="padding:20px 28px 0;">
            <div style="background:#faf8f4;border-left:3px solid #c9a84c;border-radius:4px;padding:14px 16px;">
              <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Changes Audit Summary</p>
              ${auditRows.map(r => `<p style="margin:0 0 6px;font-size:12px;color:#444;line-height:1.5;">${r}</p>`).join('')}
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
  }).catch(() => { /* non-critical — don't fail the PUT if email errors */ });
}

// GET /api/admin/users — list all profiles
export async function GET(req: NextRequest) {
  const admin = await assertAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = adminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,full_name,role,department,platforms,is_active,created_at')
    .order('created_at');

  if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });
  return NextResponse.json({ users: data });
}

// PUT /api/admin/users — update role / is_active
// Body: { id: string, role?: string, is_active?: boolean, platforms?: string[] }
export async function PUT(req: NextRequest) {
  const admin = await assertAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as { id?: string; role?: string; is_active?: boolean; platforms?: string[] };
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Administrators cannot promote to superuser
  if (admin.role === 'administrator' && body.role === 'superuser') {
    return NextResponse.json({ error: 'Administrators cannot assign the Superuser role' }, { status: 403 });
  }

  const supabase = adminClient();

  // Fetch current state before patching (needed for axiom flag + email diff)
  const { data: before } = await supabase
    .from('profiles')
    .select('role,is_active,platforms,full_name,email')
    .eq('id', body.id)
    .single();

  const patch: Record<string, unknown> = {};
  if (body.role       !== undefined) patch.role       = body.role;
  if (body.is_active  !== undefined) patch.is_active  = body.is_active;
  if (body.platforms  !== undefined) patch.platforms  = body.platforms;

  // Derive axiom_upload_authorised from platforms + role so AXIOM reads a single boolean
  const effectiveRole      = (body.role      ?? before?.role      ?? '') as string;
  const effectivePlatforms = (body.platforms ?? before?.platforms ?? []) as string[];
  if (body.role !== undefined || body.platforms !== undefined) {
    patch.axiom_upload_authorised =
      ['superuser', 'administrator'].includes(effectiveRole) || effectivePlatforms.includes('dinges');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });

  // Email notification — superuser-triggered changes only
  if (admin.role === 'superuser' && before && data) {
    sendAccountUpdateEmail({
      callerName:  admin.fullName || admin.email,
      targetName:  before.full_name  as string,
      targetEmail: before.email      as string,
      before: {
        role:      before.role      as string,
        is_active: before.is_active as boolean,
        platforms: before.platforms as string[] | null,
      },
      after: {
        role:      (data.role      ?? before.role)      as string,
        is_active: (data.is_active ?? before.is_active) as boolean,
        platforms: (data.platforms ?? before.platforms) as string[] | null,
      },
    }).catch(() => { /* non-critical */ });
  }

  return NextResponse.json({ user: data });
}
