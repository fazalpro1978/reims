// ─────────────────────────────────────────────────────────────────────────────
// Listing draft generator — standard Privé format (from "Property Finder Requirements2").
//   Title        ≤ 50 chars        Description ≤ 2000 chars
// English + Arabic. Deterministic templates (no AI call): the same facts always give the same text.
// The Arabic text is a TEMPLATE draft — have a native speaker review before publishing.
// Edit the constants below to change the standard wording in one place.
// ─────────────────────────────────────────────────────────────────────────────

export const TITLE_MAX = 50;
export const DESC_MAX  = 2000;

export interface DraftFacts {
  type?: string | null;            // Apartment, Villa, …
  config?: string | null;          // "2 BHK", "Studio", …
  bathrooms?: number | string | null;
  furnishing?: string | null;
  rent?: number | string | null;
  listing_type?: string | null;
  property?: string | null;        // building / compound
  zoneName?: string | null;
  parking?: boolean | string | null;
  kitchen?: string | null;
}

// Standard terms — shown exactly as in the approved sample. Confirm per listing before publishing.
export const TERMS_EN = ['Minimum 12-month contract', 'Half-month agency commission applies'];
export const TERMS_AR = ['الحد الأدنى لمدة العقد 12 شهراً', 'تُطبّق عمولة وساطة بقيمة نصف شهر'];
export const CLOSING_EN = 'Connecting you with property the Privé way.';
export const CLOSING_AR = 'نصلك بالعقار المناسب على طريقة بريفيه.';

const AR_TYPE: Record<string, string> = {
  apartment: 'شقة', villa: 'فيلا', townhouse: 'تاون هاوس', duplex: 'دوبلكس', penthouse: 'بنتهاوس',
  studio: 'استوديو', office: 'مكتب', shop: 'محل', compound: 'مجمع سكني', 'staff accommodation': 'سكن موظفين',
};
const AR_FURN: Record<string, string> = { furnished: 'مفروشة بالكامل', semi: 'نصف مفروشة', unfurnished: 'غير مفروشة' };

const t = (v: unknown) => (v == null ? '' : String(v).trim());
const qar = (v: unknown) => `QAR ${Number(v).toLocaleString('en-US')}`;
const cap = (s: string) => s.replace(/\b\w/g, m => m.toUpperCase());

function furnKey(f: string | null | undefined): 'furnished' | 'semi' | 'unfurnished' | null {
  const s = t(f).toLowerCase();
  if (!s) return null;
  if (s.startsWith('semi')) return 'semi';
  if (s.startsWith('un')) return 'unfurnished';
  if (s.includes('furnish')) return 'furnished';
  return null;
}
const furnEn = (k: ReturnType<typeof furnKey>) => (k === 'furnished' ? 'Fully Furnished' : k === 'semi' ? 'Semi-Furnished' : k === 'unfurnished' ? 'Unfurnished' : '');

function beds(config: string | null | undefined): number | 'studio' | null {
  const s = t(config).toLowerCase();
  if (!s) return null;
  if (s.includes('studio')) return 'studio';
  const m = s.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}
const arBeds = (n: number) => (n === 1 ? 'غرفة نوم واحدة' : n === 2 ? 'غرفتي نوم' : `${n} غرف نوم`);
const arBaths = (b: string) => (b === '1' ? 'حمام واحد' : `${b} حمامات`);
const AR_MASC = new Set(['مكتب', 'محل', 'مجمع سكني', 'استوديو', 'دوبلكس', 'تاون هاوس', 'سكن موظفين']);
const yes = (v: unknown) => v === true || /^(true|yes|y|1)$/i.test(t(v));

export interface ListingDraft { title: string; description: string; title_ar: string; description_ar: string; terms_assumed: boolean }

// A draft needs at least a type and either a configuration or a studio — otherwise it would be empty boilerplate.
export const canDraft = (f: DraftFacts) => !!t(f.type) && !!t(f.config);

export function buildDraft(f: DraftFacts): ListingDraft {
  const type  = cap(t(f.type) || 'Property');
  const k     = furnKey(f.furnishing);
  const furn  = furnEn(k);
  const b     = beds(f.config);
  const bedsEn = b === 'studio' ? 'Studio' : b ? `${b}-Bedroom` : '';
  const place = t(f.zoneName) || t(f.property);
  const rentOk = t(f.rent) !== '' && Number(f.rent) > 0;
  const isRent = !/^sale$/i.test(t(f.listing_type));
  const baths = t(f.bathrooms);

  // Title: "Fully Furnished 2-Bedroom Apartment As Salatah" — drop the place, then trim, to fit 50.
  const core = [furn, bedsEn, b === 'studio' && /^apartment$/i.test(type) ? 'Apartment' : type].filter(Boolean).join(' ');
  let title = place ? `${core} ${place}` : core;
  if (title.length > TITLE_MAX) title = core;
  if (title.length > TITLE_MAX) title = title.slice(0, TITLE_MAX).replace(/\s+\S*$/, '');

  const headline = [
    [furn, bedsEn, type].filter(Boolean).join(' '),
    t(f.property) || t(f.zoneName),
    rentOk ? `${qar(f.rent)}${isRent ? '' : ''}` : '',
  ].filter(Boolean).join(' | ');

  const featuresEn = [
    b === 'studio' ? 'Studio layout' : b ? `${b} Bedroom${b > 1 ? 's' : ''}` : '',
    baths ? `${baths} Bathroom${baths === '1' ? '' : 's'}` : '',
    furn,
    /^no/i.test(t(f.kitchen)) ? '' : 'Fully Equipped Kitchen',
    yes(f.parking) ? 'Parking Available' : '',
    'Comfortable living and dining area',
    rentOk ? `${isRent ? 'Monthly Rent' : 'Price'}: ${qar(f.rent)}` : '',
  ].filter(Boolean);

  const intro = `Discover comfortable living in this ${[furn.toLowerCase(), bedsEn.toLowerCase(), type.toLowerCase()].filter(Boolean).join(' ')}` +
    `${t(f.property) ? ` at ${t(f.property)}` : ''}${t(f.zoneName) ? `, located in the ${t(f.zoneName)} area` : ''}. ` +
    'Ideal for families or professionals seeking a well-maintained home in a convenient Doha location.';

  const description = [
    headline,
    intro,
    ['Property Features:', '', ...featuresEn.map(x => `- ${x}`)].join('\n'),
    'Located in a convenient area with easy access to nearby services, shops, restaurants, and key destinations across Doha.',
    'Contact us today to arrange a viewing.',
    ['Terms & Conditions:', '', ...TERMS_EN.map(x => `- ${x}`)].join('\n'),
    CLOSING_EN,
  ].join('\n\n').slice(0, DESC_MAX);

  // ── Arabic ────────────────────────────────────────────────────────────────
  const typeAr = AR_TYPE[t(f.type).toLowerCase()] ?? t(f.type);
  const furnAr = k ? AR_FURN[k] : '';
  const bedsAr = b === 'studio' ? 'استوديو' : b ? arBeds(b) : '';
  const coreAr = b === 'studio' ? `استوديو ${furnAr}`.trim() : [typeAr, bedsAr && `${bedsAr}`, furnAr].filter(Boolean).join(' ');
  let title_ar = `${isRent ? 'للإيجار: ' : 'للبيع: '}${coreAr}${place ? ` - ${place}` : ''}`;
  if (title_ar.length > TITLE_MAX) title_ar = `${isRent ? 'للإيجار: ' : 'للبيع: '}${coreAr}`.slice(0, TITLE_MAX);

  const featuresAr = [
    b === 'studio' ? 'تصميم استوديو' : b ? arBeds(b) : '',
    baths ? arBaths(baths) : '',
    furnAr,
    /^no/i.test(t(f.kitchen)) ? '' : 'مطبخ مجهز بالكامل',
    yes(f.parking) ? 'موقف سيارات متوفر' : '',
    'منطقة معيشة وطعام مريحة',
    rentOk ? `${isRent ? 'الإيجار الشهري' : 'السعر'}: ${qar(f.rent)}` : '',
  ].filter(Boolean);

  const description_ar = [
    [coreAr, t(f.property) || t(f.zoneName), rentOk ? qar(f.rent) : ''].filter(Boolean).join(' | '),
    `اكتشف حياة مريحة في ${AR_MASC.has(typeAr) ? 'هذا' : 'هذه'} ${typeAr}${t(f.property) ? ` في ${t(f.property)}` : ''}${t(f.zoneName) ? `، الواقعة في منطقة ${t(f.zoneName)}` : ''}. مناسبة للعائلات أو المهنيين الباحثين عن منزل جيد الصيانة في موقع مناسب بالدوحة.`,
    ['مميزات العقار:', '', ...featuresAr.map(x => `- ${x}`)].join('\n'),
    'يقع العقار في منطقة مناسبة مع سهولة الوصول إلى الخدمات والمتاجر والمطاعم والوجهات الرئيسية في أنحاء الدوحة.',
    'تواصل معنا اليوم لترتيب موعد المعاينة.',
    ['الشروط والأحكام:', '', ...TERMS_AR.map(x => `- ${x}`)].join('\n'),
    CLOSING_AR,
  ].join('\n\n').slice(0, DESC_MAX);

  return { title, description, title_ar, description_ar, terms_assumed: true };
}
