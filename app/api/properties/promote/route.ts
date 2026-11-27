import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';
import { UNIT_COLS, contactsFor, zoneNames } from '@/lib/propertyDemand';
import { buildDraft, canDraft } from '@/lib/listingDraft';
import { mapAmenities } from '@/lib/portalReadiness';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const furnMap = (f?: string | null) => {
  const s = (f ?? '').toLowerCase();
  return s.startsWith('semi') ? 'semi-furnished' : s.startsWith('un') ? 'unfurnished' : s.includes('furnish') ? 'furnished' : null;
};

// POST /api/properties/promote  { unit_id }
// Creates a draft (status 'inactive') listing from an inventory unit, with an EN + AR title/description for review.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff']);
  if (!auth.ok) return auth.response;

  const { unit_id } = await req.json().catch(() => ({})) as { unit_id?: string };
  if (!unit_id) return NextResponse.json({ error: 'unit_id is required' }, { status: 400 });

  const { data: unit } = await admin.from('units').select(UNIT_COLS).eq('id', unit_id).maybeSingle();
  if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
  const u = unit as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  // One listing per unit (needs the 20261127 migration)
  const dup = await admin.from('properties').select('id, ref_no').eq('unit_id', unit_id).maybeSingle();
  if (dup.error) return NextResponse.json({ error: 'Promotion needs the 20261127_properties_inventory_promotion migration' }, { status: 503 });
  if (dup.data) return NextResponse.json({ error: `Already listed as ${dup.data.ref_no}`, code: 'ALREADY_LISTED', property: dup.data }, { status: 409 });
  if (!canDraft({ type: u.type, config: u.config })) {
    return NextResponse.json({ error: 'Unit needs a property type and configuration before it can be listed' }, { status: 422 });
  }

  const zone = (await zoneNames([u.zone_code])).get(String(u.zone_code)) ?? null;
  const contact = (await contactsFor(admin, [unit_id])).get(unit_id) ?? { name: null, phone: null };
  const draft = buildDraft({ type: u.type, config: u.config, bathrooms: u.bathrooms, furnishing: u.furnishing, rent: u.rent,
    listing_type: u.listing_type, property: u.property, zoneName: zone, parking: u.parking, kitchen: u.kitchen });
  const { mapped, unmapped } = mapAmenities(u.amenities);
  const bedMatch = /(\d+)/.exec(u.config ?? '');

  const { data, error } = await admin.from('properties').insert({
    title: draft.title, description: draft.description, title_ar: draft.title_ar, description_ar: draft.description_ar,
    listing_type: /^sale$/i.test(u.listing_type ?? '') ? 'sale' : 'rent',
    property_type: u.type, bedrooms: bedMatch ? Number(bedMatch[1]) : null,
    bathrooms: u.bathrooms != null ? Number(u.bathrooms) : null,
    size_sqm: u.size_sqm ?? null, floor: u.floor ?? null, furnished: furnMap(u.furnishing),
    price: u.rent != null ? Number(u.rent) : null, location: u.property, zone, compound: u.property,
    amenities: mapped, images: [], media_link: u.media_url ?? null,
    source: 'inventory', source_ref: u.smart_code ?? unit_id, status: 'inactive', // draft until a person reviews it
    unit_id, master_code: u.master_code ?? null, smart_code: u.smart_code ?? null,
    contact_name: contact.name, contact_phone: contact.phone, promoted_by: auth.auth.fullName,
  }).select('*').single();

  if (error) return NextResponse.json({ error: 'Could not create the listing' }, { status: 500 });
  return NextResponse.json({ property: data, unmappedAmenities: unmapped }, { status: 201 });
}
