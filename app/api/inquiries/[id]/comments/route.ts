import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const resend = new Resend(process.env.RESEND_API_KEY);

// ─── Mention parser ───────────────────────────────────────────────────────────
// Extracts @Name tokens from comment body
function parseMentionNames(body: string): string[] {
  // Captures up to 3-word names after @ — stops before any non-letter char
  const matches = body.match(/@([A-Za-z]+(?:\s[A-Za-z]+){0,2})(?=[^A-Za-z]|$)/g) ?? [];
  const seen = new Set<string>();
  return matches.map(m => m.slice(1).trim()).filter(n => { if (seen.has(n)) return false; seen.add(n); return true; });
}

// ─── Email builder ─────────────────────────────────────────────────────────────
function buildMentionEmail(ctx: {
  recipient_name: string;
  sender_name: string;
  body: string;
  ref_no: string;
  client_name: string | null;
  status: string;
  phone: string | null;
  inquiry_id: string;
}): string {
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL || 'https://reims.propertyscape.io';
  const tileUrl = `${appUrl}/synergy?inquiry=${encodeURIComponent(ctx.ref_no)}`;
  // wa.me deep link: pre-filled with reference + sender context
  const waMsg   = encodeURIComponent(
    `Hi, I was mentioned on REIMS inquiry ${ctx.ref_no} (${ctx.client_name ?? 'Client'}). Checking in on this.`,
  );
  const waUrl   = ctx.phone
    ? `https://wa.me/${ctx.phone.replace(/\D/g, '')}?text=${waMsg}`
    : null;

  // Highlight @mentions in preview
  const bodyHtml = ctx.body
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/@([A-Za-z][A-Za-z\s]{0,30}?)(?=\s|$)/g,
      '<strong style="color:#c9a84c;">@$1</strong>');

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>REIMS — You were mentioned on ${ctx.ref_no}</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- Header -->
      <tr>
        <td style="background:#111111;border-radius:12px 12px 0 0;padding:24px 32px 20px;border-bottom:1px solid #1F1F1F;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <img src="${appUrl}/prive-logo.png" alt="Privé Group" width="48" height="48" style="display:block;border-radius:8px;margin-bottom:12px;" />
                <span style="font-size:11px;font-weight:700;letter-spacing:0.15em;color:#6B7280;text-transform:uppercase;">REIMS · Synergy Centre</span>
                <div style="font-size:20px;font-weight:700;color:#FFFFFF;margin-top:6px;">You were mentioned</div>
              </td>
              <td align="right" valign="top">
                <span style="display:inline-block;background:#1a1400;color:#c9a84c;border:1px solid #c9a84c55;border-radius:6px;padding:6px 14px;font-size:13px;font-weight:700;letter-spacing:0.04em;">@ Mention</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Sender context -->
      <tr>
        <td style="background:#111111;padding:20px 32px 16px;border-left:3px solid #c9a84c;">
          <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.6;">
            <strong style="color:#FFFFFF;">${ctx.sender_name}</strong> mentioned you in a thread comment on inquiry <strong style="color:#c9a84c;font-family:'Courier New',monospace;">${ctx.ref_no}</strong>.
          </p>
        </td>
      </tr>

      <!-- Comment preview -->
      <tr>
        <td style="background:#161616;padding:20px 32px;">
          <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:10px;padding:16px 20px;">
            <p style="margin:0 0 6px;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#6B7280;">Comment</p>
            <p style="margin:0;font-size:14px;color:#E5E7EB;line-height:1.7;">${bodyHtml}</p>
          </div>
        </td>
      </tr>

      <!-- Inquiry metadata -->
      <tr>
        <td style="background:#161616;padding:0 32px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:10px;overflow:hidden;">
            <tr>
              <td colspan="2" style="padding:14px 20px 12px;border-bottom:1px solid #2A2A2A;">
                <span style="font-size:11px;color:#6B7280;letter-spacing:0.1em;text-transform:uppercase;display:block;margin-bottom:4px;">Reference</span>
                <span style="font-size:20px;font-weight:700;color:#FFFFFF;font-family:'Courier New',monospace;">${ctx.ref_no}</span>
              </td>
            </tr>
            <tr>
              <td width="50%" style="padding:12px 20px;border-right:1px solid #2A2A2A;vertical-align:top;">
                <span style="font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:4px;">Client</span>
                <span style="font-size:13px;font-weight:600;color:#FFFFFF;">${ctx.client_name || '—'}</span>
              </td>
              <td width="50%" style="padding:12px 20px;vertical-align:top;">
                <span style="font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:4px;">Status</span>
                <span style="font-size:13px;font-weight:600;color:#c9a84c;">${capitalize(ctx.status)}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- CTAs -->
      <tr>
        <td style="background:#161616;padding:0 32px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding-right:8px;">
                <a href="${tileUrl}" style="display:inline-block;background:#FFFFFF;color:#000000;text-decoration:none;font-size:13px;font-weight:700;padding:12px 24px;border-radius:8px;letter-spacing:0.02em;">Open in Synergy Centre →</a>
              </td>
              ${waUrl ? `
              <td align="center" style="padding-left:8px;">
                <a href="${waUrl}" style="display:inline-block;background:#25D366;color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:700;padding:12px 24px;border-radius:8px;letter-spacing:0.02em;">Reply on WhatsApp</a>
              </td>` : ''}
            </tr>
          </table>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#0E0E0E;border-radius:0 0 12px 12px;padding:18px 32px;border-top:1px solid #1F1F1F;">
          <p style="margin:0;font-size:11px;color:#4B5563;text-align:center;line-height:1.8;">
            REIMS · Vanguard Real Estate Operations System<br/>
            Generated By: <span style="color:#6B7280;">GRID-X Bot</span> &nbsp;·&nbsp; Powered By: <a href="https://propertyscape.io" style="color:#6B7280;text-decoration:none;">PropertyScape.io</a>
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ─── GET /api/inquiries/[id]/comments ─────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req, [
    'superuser', 'administrator', 'staff', 'agent', 'broker', 'third_party',
  ]);
  if (!auth.ok) return auth.response;

  const { data, error } = await admin
    .from('inquiry_comments')
    .select('id, author_id, author_name, body, mentions, created_at')
    .eq('inquiry_id', params.id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comments: data ?? [] });
}

// ─── POST /api/inquiries/[id]/comments ────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req, [
    'superuser', 'administrator', 'staff', 'agent', 'broker',
  ]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({})) as { body?: string };
  if (!body.body?.trim()) {
    return NextResponse.json({ error: 'Comment body is required' }, { status: 400 });
  }

  // Fetch inquiry for metadata
  const { data: inq } = await admin
    .from('inquiries')
    .select('ref_no, client_name, status')
    .eq('id', params.id)
    .single();

  // Parse @mentions and resolve to staff profiles
  const mentionedNames = parseMentionNames(body.body);
  let mentionedProfiles: { id: string; email: string; full_name: string | null; phone: string | null }[] = [];

  if (mentionedNames.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, email, full_name, phone')
      .in('full_name', mentionedNames)
      .eq('is_active', true);
    mentionedProfiles = profiles ?? [];
  }

  // Insert comment
  const { data: comment, error: insertErr } = await admin
    .from('inquiry_comments')
    .insert({
      inquiry_id:  params.id,
      author_id:   auth.auth.uid,
      author_name: auth.auth.fullName || auth.auth.email,
      body:        body.body.trim(),
      mentions:    mentionedProfiles.map(p => p.id),
    })
    .select('id, author_id, author_name, body, mentions, created_at')
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // Auto-archive into ledger (unit_code NULL = inquiry-level comment)
  await admin.from('cr_synergy_unit_activity_logs').insert({
    lead_id:        params.id,
    unit_code:      null,
    smart_code:     null,
    author_id:      auth.auth.uid,
    author_name:    auth.auth.fullName || auth.auth.email,
    pipeline_stage: 'comment',
    note:           body.body.trim(),
  });

  // Dispatch email + wa.me to each @mentioned staff member
  if (mentionedProfiles.length > 0 && inq) {
    const appUrl  = process.env.NEXT_PUBLIC_APP_URL || 'https://reims.propertyscape.io';
    const senderName = auth.auth.fullName || auth.auth.email;

    await Promise.allSettled(
      mentionedProfiles.map(profile =>
        resend.emails.send({
          from:    process.env.RESEND_FROM!,
          to:      [profile.email],
          subject: `[REIMS] ${senderName} mentioned you on ${inq.ref_no}`,
          html:    buildMentionEmail({
            recipient_name: profile.full_name ?? profile.email,
            sender_name:    senderName,
            body:           body.body!.trim(),
            ref_no:         inq.ref_no,
            client_name:    inq.client_name,
            status:         inq.status,
            phone:          profile.phone,
            inquiry_id:     params.id,
          }),
        }),
      ),
    );
  }

  return NextResponse.json({ comment }, { status: 201 });
}
