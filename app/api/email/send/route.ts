import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface UnitPayload {
  property: string;
  unitNo: string;
  zone: string;
  zoneCode: number;
  type: string;
  config: string;
  furnishing: string;
  status: string;
  rent: number;
  serviceCharges: number;
  depositAmount: number;
  bathrooms: number;
  parking: boolean;
  amenities: string[];
  locationMapUrl?: string;
  mediaUrl?: string;
}

function buildHtml(unit: UnitPayload, note?: string): string {
  const fmt = (n: number) => `QAR ${Number(n).toLocaleString('en-QA')}`;
  const row = (label: string, value: string) =>
    `<tr><td style="padding:8px 0;color:#888;font-size:13px;width:140px;vertical-align:top">${label}</td><td style="padding:8px 0;color:#111;font-size:13px;font-weight:500">${value}</td></tr>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:20px;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">

  <div style="background:#0a0a0a;padding:24px 32px;border-bottom:3px solid #c9a84c">
    <p style="color:#c9a84c;font-size:10px;font-weight:700;letter-spacing:2px;margin:0 0 4px 0;text-transform:uppercase">Privé Group Real Estate</p>
    <h1 style="color:#fff;font-size:22px;margin:0;font-weight:600">Property Listing</h1>
  </div>

  <div style="padding:32px">
    <h2 style="font-size:20px;color:#111;margin:0 0 4px 0">${unit.property}</h2>
    <p style="color:#888;font-size:13px;margin:0 0 24px 0">Unit ${unit.unitNo} &nbsp;·&nbsp; ${unit.zone} (Zone ${unit.zoneCode})</p>

    <div style="background:#fffbf0;border:1px solid #c9a84c44;border-radius:8px;padding:16px 20px;margin-bottom:24px">
      <p style="color:#888;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 4px 0">Monthly Rent</p>
      <p style="color:#c9a84c;font-size:28px;font-weight:700;margin:0">${fmt(unit.rent)}</p>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      ${row('Type', `${unit.type} &nbsp;·&nbsp; ${unit.config}`)}
      ${row('Furnishing', unit.furnishing)}
      ${row('Bathrooms', String(unit.bathrooms))}
      ${row('Parking', unit.parking ? 'Included' : 'Not included')}
      ${row('Service Charges', fmt(unit.serviceCharges))}
      ${row('Security Deposit', fmt(unit.depositAmount))}
      ${row('Status', unit.status.replace(/_/g, ' '))}
    </table>

    ${unit.amenities?.length ? `<p style="color:#888;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 8px">Amenities</p><p style="color:#555;font-size:13px;margin:0 0 24px">${unit.amenities.join(' &nbsp;·&nbsp; ')}</p>` : ''}

    ${note ? `<div style="background:#f8f8f8;border-left:3px solid #c9a84c;padding:12px 16px;margin-bottom:24px;border-radius:0 6px 6px 0"><p style="color:#555;font-size:13px;margin:0;font-style:italic">${note}</p></div>` : ''}

    ${unit.locationMapUrl || unit.mediaUrl ? `
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      ${unit.locationMapUrl ? row('Location Map', `<a href="${unit.locationMapUrl}" style="color:#c9a84c">View on map</a>`) : ''}
      ${unit.mediaUrl       ? row('Media / Photos', `<a href="${unit.mediaUrl}" style="color:#c9a84c">View media</a>`) : ''}
    </table>` : ''}

    <div style="text-align:center;padding:8px 0">
      <p style="color:#aaa;font-size:12px;margin:0">To arrange a viewing or discuss this property, please contact us directly.</p>
    </div>
  </div>

  <div style="background:#0a0a0a;padding:20px 32px;text-align:center">
    <p style="color:#aaa;font-size:12px;margin:0 0 4px">Privé Group Real Estate &nbsp;·&nbsp; Brokerage Licence No 773 &nbsp;·&nbsp; CR No 187753</p>
    <p style="color:#666;font-size:11px;margin:0">Tel / WhatsApp: +974 7707 5959 &nbsp;·&nbsp; admin@privegroupre.com</p>
  </div>
</div>
</body></html>`;
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY is not configured' }, { status: 503 });
    }

    const { to, unit, note } = (await req.json()) as {
      to: string;
      unit: UnitPayload;
      note?: string;
    };

    if (!to?.includes('@')) {
      return NextResponse.json({ error: 'Invalid recipient email address' }, { status: 400 });
    }
    if (!unit?.property) {
      return NextResponse.json({ error: 'Unit data is required' }, { status: 400 });
    }

    const { data, error } = await resend.emails.send({
      from:    'Privé Group Real Estate <noreply@privegroupre.com>',
      to:      [to],
      subject: `Property Listing — ${unit.property}, Unit ${unit.unitNo} (${unit.config})`,
      html:    buildHtml(unit, note),
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: data?.id }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Send failed' },
      { status: 500 },
    );
  }
}
