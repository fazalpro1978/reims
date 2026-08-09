import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';
import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';

const AGENT_BROKER_PATCHABLE = ['assigned_unit_id', 'assigned_unit_id_2', 'assigned_unit_id_3'];

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const UNIT_JOIN = '*, assigned_unit:units!assigned_unit_id(id, unit_code, unit_no, property, alias_code, zone, type, config, furnishing, rent), assigned_unit2:units!assigned_unit_id_2(id, unit_code, unit_no, property, alias_code), assigned_unit3:units!assigned_unit_id_3(id, unit_code, unit_no, property, alias_code)';

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
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff', 'agent', 'broker']);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();

    // Agents/brokers: own inquiries only, unit assignment fields only
    if (auth.auth.role === 'agent' || auth.auth.role === 'broker') {
      const { data: existing } = await admin
        .from('inquiries')
        .select('staff_email')
        .eq('id', params.id)
        .single();
      if (!existing || existing.staff_email !== auth.auth.email) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Staff can only patch their own inquiries (as handler OR as consultant)
    if (auth.auth.role === 'staff') {
      const { data: agentRow } = await admin
        .from('cr_agents')
        .select('agent_code')
        .eq('email', auth.auth.email)
        .maybeSingle();
      const staffCode = agentRow?.agent_code ?? null;

      const { data: existing } = await admin
        .from('inquiries')
        .select('staff_email, assigned_agent')
        .eq('id', params.id)
        .single();

      const isHandler    = existing?.staff_email === auth.auth.email;
      const isConsultant = staffCode && existing?.assigned_agent === staffCode;

      if (!isHandler && !isConsultant) {
        return NextResponse.json({ error: 'Forbidden — contact an Administrator to reassign this inquiry' }, { status: 403 });
      }
    }

    // Allowlist only patchable fields — never forward arbitrary body keys.
    const allowed: Record<string, unknown> = {};
    const staffPatchable = [
      'status', 'assigned_agent',
      'assigned_unit_id', 'assigned_unit_id_2', 'assigned_unit_id_3',
      'follow_up_date', 'move_in_date', 'bills_included', 'size', 'notes',
    ];
    // SU/AD can also reassign the staff owner
    const adminPatchable = [...staffPatchable, 'staff_email', 'staff_name', 'staff_assigned_at'];
    const patchable = (auth.auth.role === 'agent' || auth.auth.role === 'broker')
      ? AGENT_BROKER_PATCHABLE
      : (auth.auth.role === 'staff') ? staffPatchable : adminPatchable;
    for (const key of patchable) {
      if (key in body) allowed[key] = body[key] ?? null;
    }

    // Capture existing assignment values before update to detect changes
    let prevStaffEmail: string | null = null;
    let prevAgentCode: string | null = null;
    const trackingAssignment = 'staff_email' in allowed || 'assigned_agent' in allowed;
    if (trackingAssignment) {
      const { data: prev } = await admin
        .from('inquiries')
        .select('staff_email, assigned_agent')
        .eq('id', params.id)
        .single();
      prevStaffEmail = prev?.staff_email ?? null;
      prevAgentCode  = prev?.assigned_agent ?? null;
    }

    const { data, error } = await admin
      .from('inquiries')
      .update(allowed)
      .eq('id', params.id)
      .select(UNIT_JOIN)
      .single();

    if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });

    // Insert in-app bell notifications for assignment changes
    if (trackingAssignment && data) {
      const inq = data as Record<string, unknown>;
      const notifBody = `${inq.ref_no ?? ''} — ${inq.client_name ?? ''}`.trim().replace(/^—\s*/, '').replace(/\s*—\s*$/, '');

      const newStaffEmail = (allowed['staff_email'] as string | null) ?? null;
      if ('staff_email' in allowed && newStaffEmail && newStaffEmail !== prevStaffEmail) {
        admin.from('notifications').insert({
          type: 'card_assigned',
          title: 'Inquiry assigned to you',
          body: notifBody,
          inquiry_id: params.id,
          target_user_email: newStaffEmail,
        }).then(() => {}).catch(() => {});
      }

      const newAgentCode = (allowed['assigned_agent'] as string | null) ?? null;
      if ('assigned_agent' in allowed && newAgentCode && newAgentCode !== prevAgentCode) {
        admin.from('cr_agents').select('email').eq('agent_code', newAgentCode).maybeSingle()
          .then(({ data: agentRow }) => {
            if (agentRow?.email) {
              admin.from('notifications').insert({
                type: 'card_assigned',
                title: 'Inquiry assigned to you',
                body: notifBody,
                inquiry_id: params.id,
                target_user_email: agentRow.email,
              }).then(() => {}).catch(() => {});
            }
          }).catch(() => {});
      }
    }

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
            <img src="cid:logo-prive" alt="Privé Group Real Estate" style="height:52px;width:auto;display:block;margin-bottom:18px;" />
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

    // ── Requester "match found" email ────────────────────────────────────────
    // Fires when a primary unit is assigned and the requester has an email.
    const newUnitId = allowed['assigned_unit_id'];
    if (newUnitId && typeof newUnitId === 'string' && process.env.RESEND_API_KEY) {
      const inq = data as Record<string, unknown>;
      const clientEmail = inq.client_email as string | null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const unit = (inq.assigned_unit as any) ?? null;

      if (clientEmail && unit) {
        const aliasCode  = unit.alias_code as string | null;
        const displayId  = aliasCode ?? `${unit.property} – Unit ${unit.unit_no}`;
        const zone       = unit.zone  as string ?? '';
        const type       = unit.type  as string ?? '';
        const config     = unit.config as string ?? '';
        const furnishing = unit.furnishing as string ?? '';
        const rent       = Number(unit.rent ?? 0);
        const fmt        = (n: number) => n.toLocaleString('en-QA');
        const refNo      = inq.ref_no as string ?? '';
        const appUrl     = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');

        const logoBuf = fs.readFileSync(path.join(process.cwd(), 'public/brand/logo-email.png'));
        const resend  = new Resend(process.env.RESEND_API_KEY);

        await resend.emails.send({
          from: `Privé Group Real Estate <${process.env.RESEND_FROM ?? 'noreply@privegroupre.com'}>`,
          to:   clientEmail,
          subject: aliasCode
            ? `Match Found — Ref ${aliasCode} · Privé Group Real Estate`
            : `We Found a Match for You · Privé Group Real Estate`,
          attachments: [{ filename: 'logo.png', content: logoBuf, contentType: 'image/png', contentId: 'logo-prive' }],
          html: `
<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f0ece4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ece4;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#1a1a1a;padding:28px 28px 24px;">
            <img src="cid:logo-prive" alt="Privé Group Real Estate" style="height:48px;width:auto;display:block;margin-bottom:18px;" />
            ${refNo ? `<p style="margin:0 0 6px;font-size:10px;font-family:monospace;color:#888;letter-spacing:1px;">${refNo}</p>` : ''}
            <h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;line-height:1.3;">We&rsquo;ve found a property match for you</h1>
          </td>
        </tr>

        <!-- Alias / Reference -->
        <tr>
          <td style="padding:24px 28px 0;">
            <p style="margin:0 0 2px;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Property Reference</p>
            <p style="margin:0;font-size:22px;font-weight:800;color:#c9a84c;font-family:monospace;letter-spacing:1px;">${displayId}</p>
          </td>
        </tr>

        <!-- Details -->
        <tr>
          <td style="padding:20px 28px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${zone       ? `<tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:12px;color:#999;width:38%;">District / Area</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#222;">${zone}</td></tr>` : ''}
              ${type       ? `<tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:12px;color:#999;">Property Type</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#222;">${type}</td></tr>` : ''}
              ${config     ? `<tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:12px;color:#999;">Configuration</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#c9a84c;font-weight:600;">${config}</td></tr>` : ''}
              ${furnishing ? `<tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:12px;color:#999;">Furnishing</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#222;">${furnishing}</td></tr>` : ''}
              ${rent       ? `<tr><td style="padding:10px 0;font-size:12px;color:#999;">Monthly Rent</td><td style="padding:10px 0;font-size:14px;color:#2a7a3b;font-weight:700;">QAR ${fmt(rent)} / month</td></tr>` : ''}
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:24px 28px;">
            <p style="margin:0 0 16px;font-size:13px;color:#555;line-height:1.6;">Our team will be in touch shortly to arrange a viewing. If you have any questions in the meantime, please don&rsquo;t hesitate to reach out.</p>
            <a href="mailto:admin@privegroupre.com" style="display:inline-block;background:#c9a84c;color:#fff;font-size:12px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:8px;letter-spacing:0.5px;">Contact Us</a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 28px 24px;border-top:1px solid #f0f0f0;text-align:center;">
            <p style="margin:0 0 3px;font-size:11px;color:#bbb;">Privé Group Real Estate &middot; Brokerage Licence 773 &middot; CR 187753</p>
            <p style="margin:0;font-size:11px;color:#bbb;">Tel / WhatsApp: +974 7707 5959 &middot; admin@privegroupre.com</p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`,
        }).catch(() => { /* non-critical */ });
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
