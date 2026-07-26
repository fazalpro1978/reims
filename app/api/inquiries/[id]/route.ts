import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const UNIT_JOIN = '*, assigned_unit:units!assigned_unit_id(id, unit_code, unit_no, property), assigned_unit2:units!assigned_unit_id_2(id, unit_code, unit_no, property), assigned_unit3:units!assigned_unit_id_3(id, unit_code, unit_no, property)';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await admin
    .from('inquiries')
    .select(UNIT_JOIN)
    .eq('id', params.id)
    .single();

  if (error) return NextResponse.json({ error: 'Database error' }, { status: 404 });
  return NextResponse.json({ inquiry: data });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();

    // Allowlist only patchable fields — never forward arbitrary body keys.
    const allowed: Record<string, unknown> = {};
    const patchable = [
      'status', 'assigned_agent',
      'assigned_unit_id', 'assigned_unit_id_2', 'assigned_unit_id_3',
      'follow_up_date', 'move_in_date', 'bills_included', 'size', 'notes',
    ];
    for (const key of patchable) {
      if (key in body) allowed[key] = body[key] ?? null;
    }

    const { data, error } = await admin
      .from('inquiries')
      .update(allowed)
      .eq('id', params.id)
      .select(UNIT_JOIN)
      .single();

    if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });

    // Send assignment email if assigned_agent changed to a non-null value
    const newAgent = allowed['assigned_agent'];
    if (newAgent && typeof newAgent === 'string' && process.env.RESEND_API_KEY) {
      const { data: agent } = await admin
        .from('cr_agents')
        .select('full_name, email')
        .eq('agent_code', newAgent)
        .single();

      if (agent?.email) {
        const inq = data as Record<string, unknown>;
        const fmt = (n: number) => n.toLocaleString('en-QA');
        const budgetLine = (inq.budget_min || inq.budget_max)
          ? `QAR ${fmt(Number(inq.budget_min ?? 0))} – ${fmt(Number(inq.budget_max ?? 0))}/mo`
          : 'Not specified';

        const logoBuf = fs.readFileSync(path.join(process.cwd(), 'public/brand/logo-email.png'));
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://reims-git-main-fazalpro-s-projects.vercel.app').replace(/\/$/, '');
        const inquiryLink = `${appUrl}/synergy?inquiry=${encodeURIComponent(String(inq.ref_no))}`;

        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: `Vanguard REOS <${process.env.RESEND_FROM ?? 'noreply@privegroupre.com'}>`,
          to: agent.email,
          subject: `New Task Assigned — ${inq.ref_no} · Please Action`,
          attachments: [{
            filename: 'logo.png',
            content: logoBuf,
            contentType: 'image/png',
            contentId: 'logo-prive',
          }],
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
            <img src="cid:logo-prive" alt="Prive Group Real Estate" style="height:52px;width:auto;display:block;margin-bottom:18px;" />
            <a href="${inquiryLink}" style="display:inline-block;font-size:11px;font-family:monospace;color:#fff;letter-spacing:1px;text-decoration:underline;margin-bottom:8px;">${inq.ref_no}</a>
            <h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;line-height:1.3;">A new task is assigned to you &mdash; Please action</h1>
          </td>
        </tr>

        <!-- Client name -->
        <tr>
          <td style="padding:24px 28px 0;">
            <p style="margin:0 0 2px;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Client</p>
            <p style="margin:0;font-size:18px;font-weight:700;color:#111;">${inq.client_name}</p>
          </td>
        </tr>

        <!-- Details table -->
        <tr>
          <td style="padding:20px 28px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:12px;color:#999;width:38%;">Phone</td>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#222;">${inq.client_phone ?? '—'}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:12px;color:#999;">Email</td>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#222;">${inq.client_email ?? '—'}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:12px;color:#999;">Listing Type</td>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#c9a84c;font-weight:600;">${inq.listing_type ?? '—'}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:12px;color:#999;">Property</td>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#222;">${inq.property_type ?? '—'} &middot; ${inq.config ?? '—'}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:12px;color:#999;">Budget</td>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#2a7a3b;font-weight:700;">${budgetLine}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;font-size:12px;color:#999;">Zones</td>
                <td style="padding:10px 0;font-size:13px;color:#1a6a9a;">${Array.isArray(inq.preferred_zones) ? (inq.preferred_zones as string[]).join(', ') : (inq.preferred_zones ?? '—')}</td>
              </tr>
            </table>
          </td>
        </tr>

        ${inq.notes ? `
        <!-- Notes -->
        <tr>
          <td style="padding:16px 28px 0;">
            <div style="padding:14px 16px;background:#faf8f4;border-left:3px solid #c9a84c;border-radius:4px;font-size:12px;color:#555;line-height:1.6;">${inq.notes}</div>
          </td>
        </tr>` : ''}

        <!-- Footer -->
        <tr>
          <td style="padding:24px 28px 28px;text-align:center;border-top:1px solid #f0f0f0;margin-top:24px;">
            <p style="margin:0 0 4px;font-size:11px;color:#bbb;">REIMS &middot; Vanguard Real Estate Operations System</p>
            <p style="margin:0;font-size:10px;color:#ccc;font-style:italic;">Generated By: GRID-X Bot (Coming Soon&hellip;)</p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`,
        }).catch(() => { /* non-critical — don't fail the PATCH if email errors */ });
      }
    }

    return NextResponse.json({ inquiry: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await admin.from('inquiries').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
