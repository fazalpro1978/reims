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

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
<html>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;color:#e0e0e0;">
  <div style="max-width:520px;margin:32px auto;background:#111;border:1px solid #222;border-radius:16px;overflow:hidden;">

    <!-- Header banner with logo -->
    <div style="background:#f43f5e;padding:20px 24px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <img src="cid:logo-prive" alt="Privé Group Real Estate" style="height:38px;width:auto;" />
      </div>
      <p style="margin:0;font-size:11px;font-family:monospace;color:#fff;opacity:0.7;">${inq.ref_no}</p>
      <h1 style="margin:4px 0 0;font-size:18px;font-weight:700;color:#fff;line-height:1.3;">A new task is assigned to you — Please action</h1>
    </div>

    <!-- Body -->
    <div style="padding:24px;">
      <p style="margin:0 0 4px;font-size:13px;color:#888;">Client</p>
      <p style="margin:0 0 20px;font-size:16px;font-weight:600;color:#fff;">${inq.client_name}</p>

      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #1e1e1e;font-size:12px;color:#666;width:40%;">Phone</td>
          <td style="padding:8px 0;border-bottom:1px solid #1e1e1e;font-size:12px;color:#ccc;">${inq.client_phone ?? '—'}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #1e1e1e;font-size:12px;color:#666;">Email</td>
          <td style="padding:8px 0;border-bottom:1px solid #1e1e1e;font-size:12px;color:#ccc;">${inq.client_email ?? '—'}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #1e1e1e;font-size:12px;color:#666;">Listing Type</td>
          <td style="padding:8px 0;border-bottom:1px solid #1e1e1e;font-size:12px;color:#c9a84c;">${inq.listing_type ?? '—'}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #1e1e1e;font-size:12px;color:#666;">Property</td>
          <td style="padding:8px 0;border-bottom:1px solid #1e1e1e;font-size:12px;color:#ccc;">${inq.property_type ?? '—'} · ${inq.config ?? '—'}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #1e1e1e;font-size:12px;color:#666;">Budget</td>
          <td style="padding:8px 0;border-bottom:1px solid #1e1e1e;font-size:12px;color:#4ade80;font-weight:600;">${budgetLine}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:12px;color:#666;">Zones</td>
          <td style="padding:8px 0;font-size:12px;color:#38bdf8;">${Array.isArray(inq.preferred_zones) ? (inq.preferred_zones as string[]).join(', ') : (inq.preferred_zones ?? '—')}</td>
        </tr>
      </table>

      ${inq.notes ? `<div style="margin-top:16px;padding:12px;background:#0d0d0d;border:1px solid #1e1e1e;border-radius:8px;font-size:12px;color:#888;">${inq.notes}</div>` : ''}

      <!-- Footer -->
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #1e1e1e;text-align:center;">
        <p style="margin:0 0 4px;font-size:11px;color:#444;">REIMS · Vanguard Real Estate Operations System</p>
        <p style="margin:0;font-size:10px;color:#333;font-style:italic;">Generated By: GRID-X Bot <span style="color:#555;">(Coming Soon…)</span></p>
      </div>
    </div>
  </div>
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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
