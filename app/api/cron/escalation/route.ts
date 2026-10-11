import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const resend = new Resend(process.env.RESEND_API_KEY);

const RECIPIENTS = ['ahmedali@privegroupre.com', 'a.shahan@privegroupre.com'];

const ESCALATION: Record<string, { warn: number; crit: number } | null> = {
  new:         { warn: 1,  crit: 2  },
  contacted:   { warn: 3,  crit: 7  },
  viewing:     { warn: 7,  crit: 14 },
  negotiating: { warn: 14, crit: 30 },
  won:         null,
  lost:        null,
  cancelled:   null,
  closed:      null,
};

const TERMINAL = new Set(['won', 'lost', 'cancelled', 'closed']);

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

function tierFor(status: string, days: number): 'warn' | 'crit' | null {
  const thresholds = ESCALATION[status];
  if (!thresholds) return null;
  if (days >= thresholds.crit) return 'crit';
  if (days >= thresholds.warn) return 'warn';
  return null;
}

function formatBudget(min: number | null, max: number | null): string {
  if (!min && !max) return '—';
  const fmt = (n: number) => `QAR ${n.toLocaleString()}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  return fmt(min ?? max ?? 0);
}

function buildEmailHtml(inq: {
  ref_no: string;
  client_name: string | null;
  status: string;
  staff_name: string | null;
  assigned_agent: string | null;
  budget_min: number | null;
  budget_max: number | null;
  property_type: string | null;
  config: string | null;
  days: number;
  tier: 'warn' | 'crit';
}): string {
  const isWarn = inq.tier === 'warn';
  const tierColor   = isWarn ? '#F59E0B' : '#EF4444';
  const tierBg      = isWarn ? '#78350F' : '#7F1D1D';
  const tierLabel   = isWarn ? '⚑ Warning' : '!! Critical';
  const tierMsg     = isWarn
    ? `This inquiry has been in <strong>${inq.status}</strong> status for <strong>${Math.floor(inq.days)} day${Math.floor(inq.days) !== 1 ? 's' : ''}</strong>, exceeding the <strong>warning threshold</strong>. Immediate follow-up is recommended to keep the deal on track.`
    : `This inquiry has been in <strong>${inq.status}</strong> status for <strong>${Math.floor(inq.days)} day${Math.floor(inq.days) !== 1 ? 's' : ''}</strong>, exceeding the <strong>critical threshold</strong>. This deal is at serious risk — escalation action required now.`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://reims.propertyscape.io';
  const tileUrl = `${appUrl}/synergy?inquiry=${encodeURIComponent(inq.ref_no)}`;

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>REIMS Escalation Alert — ${inq.ref_no}</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- Header -->
      <tr>
        <td style="background:#111111;border-radius:12px 12px 0 0;padding:28px 32px;border-bottom:1px solid #1F1F1F;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <span style="font-size:11px;font-weight:700;letter-spacing:0.15em;color:#6B7280;text-transform:uppercase;">REIMS · Synergy Centre</span>
                <div style="font-size:20px;font-weight:700;color:#FFFFFF;margin-top:6px;">Inquiry Escalation Alert</div>
              </td>
              <td align="right">
                <span style="display:inline-block;background:${tierBg};color:${tierColor};border:1px solid ${tierColor};border-radius:6px;padding:6px 14px;font-size:13px;font-weight:700;letter-spacing:0.04em;">${tierLabel}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Tier message -->
      <tr>
        <td style="background:#111111;padding:24px 32px 20px;border-left:3px solid ${tierColor};">
          <p style="margin:0;font-size:14px;line-height:1.6;color:#D1D5DB;">${tierMsg}</p>
        </td>
      </tr>

      <!-- Inquiry details card -->
      <tr>
        <td style="background:#161616;padding:24px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:10px;overflow:hidden;">
            <!-- Ref No header -->
            <tr>
              <td colspan="2" style="padding:16px 20px 14px;border-bottom:1px solid #2A2A2A;">
                <span style="font-size:11px;color:#6B7280;letter-spacing:0.1em;text-transform:uppercase;display:block;margin-bottom:4px;">Reference</span>
                <span style="font-size:22px;font-weight:700;color:#FFFFFF;font-family:'Courier New',monospace;">${inq.ref_no}</span>
              </td>
            </tr>
            <!-- Detail rows -->
            <tr>
              <td width="50%" style="padding:14px 20px;border-bottom:1px solid #2A2A2A;border-right:1px solid #2A2A2A;vertical-align:top;">
                <span style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:4px;">Client</span>
                <span style="font-size:14px;font-weight:600;color:#FFFFFF;">${inq.client_name || '—'}</span>
              </td>
              <td width="50%" style="padding:14px 20px;border-bottom:1px solid #2A2A2A;vertical-align:top;">
                <span style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:4px;">Status</span>
                <span style="font-size:14px;font-weight:600;color:${tierColor};">${capitalize(inq.status)}</span>
              </td>
            </tr>
            <tr>
              <td width="50%" style="padding:14px 20px;border-bottom:1px solid #2A2A2A;border-right:1px solid #2A2A2A;vertical-align:top;">
                <span style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:4px;">Time in Stage</span>
                <span style="font-size:14px;font-weight:600;color:#FFFFFF;">${Math.floor(inq.days)} day${Math.floor(inq.days) !== 1 ? 's' : ''}</span>
              </td>
              <td width="50%" style="padding:14px 20px;border-bottom:1px solid #2A2A2A;vertical-align:top;">
                <span style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:4px;">Budget</span>
                <span style="font-size:14px;font-weight:600;color:#FFFFFF;">${formatBudget(inq.budget_min, inq.budget_max)}</span>
              </td>
            </tr>
            <tr>
              <td width="50%" style="padding:14px 20px;border-right:1px solid #2A2A2A;vertical-align:top;">
                <span style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:4px;">Consultant</span>
                <span style="font-size:14px;font-weight:600;color:#FFFFFF;">${inq.staff_name || '—'}</span>
              </td>
              <td width="50%" style="padding:14px 20px;vertical-align:top;">
                <span style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:4px;">Property</span>
                <span style="font-size:14px;font-weight:600;color:#FFFFFF;">${[inq.property_type, inq.config].filter(Boolean).join(' · ') || '—'}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- CTA -->
      <tr>
        <td style="background:#161616;padding:0 32px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center">
                <a href="${tileUrl}" style="display:inline-block;background:#FFFFFF;color:#000000;text-decoration:none;font-size:14px;font-weight:700;padding:13px 32px;border-radius:8px;letter-spacing:0.02em;">Open in Synergy Centre →</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#0E0E0E;border-radius:0 0 12px 12px;padding:20px 32px;border-top:1px solid #1F1F1F;">
          <p style="margin:0;font-size:12px;color:#4B5563;text-align:center;">This is an automated alert from REIMS · Privé Group Real Estate · <a href="${appUrl}" style="color:#6B7280;text-decoration:none;">reims.propertyscape.io</a></p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  // Validate Vercel cron secret
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch all non-terminal inquiries
    const { data: inquiries, error } = await admin
      .from('inquiries')
      .select('id, ref_no, client_name, status, status_changed_at, created_at, staff_name, assigned_agent, budget_min, budget_max, property_type, config, escalation_notified_tier')
      .not('status', 'in', `(${Array.from(TERMINAL).join(',')})`);

    if (error) {
      console.error('[cron/escalation] DB error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results: { ref_no: string; action: string }[] = [];

    for (const inq of inquiries ?? []) {
      const clock = inq.status_changed_at ?? inq.created_at;
      const days  = daysSince(clock);
      const currentTier = tierFor(inq.status, days);

      if (!currentTier) continue;

      const alreadyNotified = inq.escalation_notified_tier;

      // Skip if already notified at this tier or higher
      if (alreadyNotified === 'crit') continue;
      if (alreadyNotified === 'warn' && currentTier === 'warn') continue;

      // This inquiry needs a notification: either new warn, or escalating to crit
      const subject = currentTier === 'crit'
        ? `🔴 Critical: ${inq.ref_no} — ${inq.status} for ${Math.floor(days)} days`
        : `⚑ Warning: ${inq.ref_no} — ${inq.status} for ${Math.floor(days)} days`;

      const html = buildEmailHtml({
        ref_no:        inq.ref_no,
        client_name:   inq.client_name,
        status:        inq.status,
        staff_name:    inq.staff_name,
        assigned_agent: inq.assigned_agent,
        budget_min:    inq.budget_min,
        budget_max:    inq.budget_max,
        property_type: inq.property_type,
        config:        inq.config,
        days,
        tier:          currentTier,
      });

      const { error: sendErr } = await resend.emails.send({
        from:    process.env.RESEND_FROM!,
        to:      RECIPIENTS,
        subject,
        html,
      });

      if (sendErr) {
        console.error(`[cron/escalation] Resend error for ${inq.ref_no}:`, sendErr);
        results.push({ ref_no: inq.ref_no, action: `send_failed: ${sendErr.message}` });
        continue;
      }

      // Mark as notified
      await admin
        .from('inquiries')
        .update({ escalation_notified_tier: currentTier })
        .eq('id', inq.id);

      results.push({ ref_no: inq.ref_no, action: `notified_${currentTier}` });
    }

    console.log(`[cron/escalation] Checked ${inquiries?.length ?? 0} inquiries, sent ${results.length} alerts`);
    return NextResponse.json({ checked: inquiries?.length ?? 0, alerts: results });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[cron/escalation] Unexpected:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
