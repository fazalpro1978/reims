import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { read, utils } from 'xlsx';
import { exec } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { promisify } from 'util';

const execAsync = promisify(exec);
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Schema description sent to Claude ───────────────────────────────────────

const SCHEMA_PROMPT = `
You are a real estate data extraction specialist. Extract all property unit listings from the provided content and return them as a JSON array.

TARGET SCHEMA (return exactly these field names):
- unit_code: string — unique identifier. If not present, generate as PROPERTY_ABBREV-UNITNO (e.g. "RRM4-317")
- property: string — building/property name. Inherit from section header rows if not on each row.
- unit_no: string — apartment/unit number
- zone_code: number — Qatar zone number if present (1–99), else null
- zone: string — area/district name (e.g. "The Pearl", "Old Airport", "West Bay")
- type: one of: Apartment | Villa | Townhouse | Penthouse | Studio | Duplex | Office
  (Flat/APT → Apartment; single room/Studio → Studio; BHK with large size → Apartment)
- config: string — bedroom config normalized to: Studio | 1 BHK | 2 BHK | 3 BHK | 4 BHK | 5 BHK | 6 BHK
  Extract from combined fields like "2 BHK FULLY FURNISHED" or "1BR"
- bathrooms: number — if not present, null
- parking: boolean — true if parking mentioned as included
- kitchen: one of: Open | Closed | Yes | Pantry — null if not mentioned
- furnishing: one of: Fully Furnished | Semi-Furnished | Unfurnished
  (FF/Fully Furnished → Fully Furnished; SF → Semi-Furnished; blank → Unfurnished unless stated otherwise)
- listing_type: Rent | Sale (default Rent unless sale price column present)
- status: one of: Available | Leased | Reserved | Under_Maintenance
  Normalize: Vacant/READY/Empty/Available → Available
             Booked/Reserved → Reserved
             Rented/Leased/Occupied → Leased
             Maintenance/UNDER MAINTENANCE → Under_Maintenance
             FULL (building full) → skip these entries
- rent: number — monthly rent in QAR. Strip "QAR", "QR", "/month", commas, spaces. null if sale-only.
- service_charges: number — monthly, QAR. null if not present.
- deposit_amount: number — one-time, QAR. null if not present.
- agency_fee: number — QAR. null if not present.
- realtor_name: string — developer/owner/company name if present
- realtor_moci: string — MOCI/license number if present
- moci_contract_status: one of: REGISTERED | PENDING | RENEWAL_DUE | EXPIRED | DRAFT — null if not present
- moci_contract_number: string — contract/MOC number if present
- legal_duration: string — e.g. "1 Year", "2 Years". null if not present.
- contract_start_date: string — ISO 8601 (YYYY-MM-DD). null if not present.
- contract_end_date: string — ISO 8601 (YYYY-MM-DD). Convert dates like "14/07/2026" → "2026-07-14". null if not present.
- location_map_url: string — Google Maps or any map URL if present. null otherwise.
- notes: string — amenities, offers (e.g. "1 month free"), broker notes, viewing times, watchman contacts. null if none.

IMPORTANT RULES:
1. Section header rows (e.g. "RRM-4", "Old Airport Building - Caretaker: Mr. X") are NOT units — extract their name/context and apply to following rows.
2. Merged cells in Excel or spanning rows in images: apply the spanning value to all rows it covers.
3. Side-by-side table layouts (e.g. Studio columns 1-4, One Bedroom columns 6-9): extract BOTH tables as separate units.
4. "FULL" status means the entire building is occupied — skip individual entries if the building is flagged FULL.
5. Rows with no unit number AND no rent are likely headers/footers — skip them.
6. If a row has a contract expiry but no status, infer: if expiry is past → Leased (expired), if future → Leased.
7. Size/SQM fields: store in notes as "Size: X sqm" — do not map to any schema field.
8. Multiple flats listed together (e.g. "Flat 7, 15 & 20"): create ONE entry per flat number.
9. For sale listings (Price column present, no monthly rent): set listing_type=Sale, rent=null.
10. Always output valid JSON only — no markdown, no explanation, just the array.

Return format: JSON array of unit objects. If no units found, return [].
`;

// ─── Excel → structured text ──────────────────────────────────────────────────

function excelToText(buffer: Buffer): string {
  const wb = read(buffer, { type: 'buffer', cellDates: true, raw: false });
  const parts: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: '',
      blankrows: true,
      raw: false,
    });

    if (rows.length === 0) continue;

    parts.push(`=== SHEET: ${sheetName} ===`);
    for (let i = 0; i < rows.length; i++) {
      const vals = (rows[i] as unknown[]).map((v) =>
        v === null || v === undefined || v === '' ? '_' : String(v).trim(),
      );
      if (vals.every((v) => v === '_')) continue;
      parts.push(`R${i + 1}: ${vals.join(' | ')}`);
    }
    parts.push('');
  }

  return parts.join('\n');
}

// ─── PDF → text ───────────────────────────────────────────────────────────────

async function pdfToText(buffer: Buffer): Promise<string> {
  const tmpPath = join(tmpdir(), `extract_${Date.now()}.pdf`);
  try {
    await writeFile(tmpPath, buffer);
    const { stdout } = await execAsync(`pdftotext -layout "${tmpPath}" -`);
    return stdout;
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
    const isPdf = ext === 'pdf';
    const isExcel = ['xlsx', 'xls', 'csv'].includes(ext);

    let extractedUnits: unknown[] = [];

    if (isImage) {
      // Send image directly to Claude Vision
      const base64 = buffer.toString('base64');
      const mediaType = ext === 'png' ? 'image/png'
        : ext === 'webp' ? 'image/webp'
        : 'image/jpeg';

      const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8096,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: SCHEMA_PROMPT },
          ],
        }],
      });

      const text = msg.content.find((b) => b.type === 'text')?.text ?? '[]';
      extractedUnits = JSON.parse(text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, ''));

    } else if (isPdf) {
      const text = await pdfToText(buffer);

      const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8096,
        messages: [{
          role: 'user',
          content: `${SCHEMA_PROMPT}\n\n=== PDF CONTENT ===\n${text}`,
        }],
      });

      const raw = msg.content.find((b) => b.type === 'text')?.text ?? '[]';
      extractedUnits = JSON.parse(raw.trim().replace(/^```json\n?/, '').replace(/\n?```$/, ''));

    } else if (isExcel) {
      const text = excelToText(buffer);

      const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8096,
        messages: [{
          role: 'user',
          content: `${SCHEMA_PROMPT}\n\n=== EXCEL CONTENT ===\n${text}`,
        }],
      });

      const raw = msg.content.find((b) => b.type === 'text')?.text ?? '[]';
      extractedUnits = JSON.parse(raw.trim().replace(/^```json\n?/, '').replace(/\n?```$/, ''));

    } else {
      return NextResponse.json(
        { error: `Unsupported file type: .${ext}. Accepted: xlsx, xls, csv, pdf, jpg, jpeg, png, webp` },
        { status: 400 },
      );
    }

    return NextResponse.json({
      units: extractedUnits,
      fileName: file.name,
      count: Array.isArray(extractedUnits) ? extractedUnits.length : 0,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Extraction failed';
    console.error('[units/extract]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
