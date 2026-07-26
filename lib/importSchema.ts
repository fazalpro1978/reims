import { UNIT_CONFIGS_FULL } from './propertySchema';

export type FieldKind = 'string' | 'integer' | 'numeric' | 'enum' | 'url';

export type MasterFieldDef = {
  key: string;
  label: string;
  dbColumn: string;
  kind: FieldKind;
  required: boolean;
  enumValues?: readonly string[];
  aliases: string[];
};

export const ENUM_PROPERTY_TYPE = ['Apartment', 'Villa', 'Townhouse', 'Penthouse', 'Studio', 'Duplex', 'Office'] as const;
export const ENUM_FURNISHING    = ['Fully Furnished', 'Semi-Furnished', 'Unfurnished'] as const;
export const ENUM_STATUS        = ['Available', 'Leased', 'Reserved', 'Under_Maintenance'] as const;
export const ENUM_KITCHEN       = ['Open', 'Closed', 'Yes', 'Pantry'] as const;

// ─── Master schema — fixed order, exactly as specified ────────────────────────

export const MASTER_FIELDS: MasterFieldDef[] = [
  {
    key: 'realtor_moci_id', label: 'Realtor MOCI ID', dbColumn: 'realtor_moci',
    kind: 'string', required: true,
    aliases: ['realtor moci id', 'realtor moci', 'moci', 'moci number', 'license number', 'realtor license'],
  },
  {
    key: 'property_unit_no', label: 'Property Unit No', dbColumn: 'unit_no',
    kind: 'string', required: true,
    aliases: ['property unit no', 'unit no', 'unit number', 'room', 'room no', 'room number', 'unit'],
  },
  {
    key: 'zone_number', label: 'Zone Number', dbColumn: 'zone_code',
    kind: 'integer', required: true,
    aliases: ['zone number', 'zone code', 'zone', 'area code'],
  },
  {
    key: 'property_type', label: 'Property Type', dbColumn: 'type',
    kind: 'enum', required: true, enumValues: ENUM_PROPERTY_TYPE,
    aliases: ['property type', 'unit type'],
  },
  {
    key: 'property_subtype', label: 'Property Subtype', dbColumn: 'config',
    kind: 'string', required: true, enumValues: UNIT_CONFIGS_FULL,
    aliases: ['property subtype', 'subtype', 'config', 'configuration', 'bhk'],
  },
  {
    key: 'furnishing_status', label: 'Furnishing Status', dbColumn: 'furnishing',
    kind: 'enum', required: true, enumValues: ENUM_FURNISHING,
    aliases: ['furnishing status', 'furnishing', 'furnished'],
  },
  {
    key: 'rent_qar_monthly', label: 'Rent (QAR / Monthly)', dbColumn: 'rent',
    kind: 'numeric', required: false,
    aliases: ['rent qar monthly', 'rent', 'monthly rent', 'rate', 'price', 'rate no comm', 'rate no comm.'],
  },
  {
    key: 'status', label: 'Status', dbColumn: 'status',
    kind: 'enum', required: false, enumValues: ENUM_STATUS,
    aliases: ['status', 'availability'],
  },
  {
    key: 'map_url', label: 'Map URL', dbColumn: 'location_map_url',
    kind: 'url', required: false,
    aliases: ['map url', 'location map url', 'map link', 'google maps'],
  },
  {
    key: 'media_storage_url', label: 'Media Storage URL', dbColumn: 'media_url',
    kind: 'url', required: false,
    aliases: ['media storage url', 'media url', 'photos', 'images', 'gallery'],
  },
];

// ─── Batch-level fields — required DB columns absent from the master list ─────

export const BATCH_FIELDS: MasterFieldDef[] = [
  { key: 'realtor_name', label: 'Realtor Name', dbColumn: 'realtor_name', kind: 'string', required: true, aliases: [] },
  { key: 'property',     label: 'Property Name', dbColumn: 'property',     kind: 'string', required: true, aliases: [] },
  { key: 'bathrooms',    label: 'Bathrooms',     dbColumn: 'bathrooms',    kind: 'numeric', required: true, aliases: [] },
  { key: 'kitchen',      label: 'Kitchen',       dbColumn: 'kitchen',      kind: 'enum', required: true, enumValues: ENUM_KITCHEN, aliases: [] },
];

// ─── Header normalization + mapping suggestion ────────────────────────────────

export function normalizeHeader(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

/** Suggests which source header matches each master field. Never guesses a value — only a column pointer, always overridable, always allowed to stay null. */
export function suggestMapping(headers: string[]): Record<string, string | null> {
  const normHeaders = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  const result: Record<string, string | null> = {};
  for (const field of MASTER_FIELDS) {
    const candidates = [field.key, field.label, ...field.aliases].map(normalizeHeader);
    const match = normHeaders.find((h) => candidates.includes(h.norm));
    result[field.key] = match ? match.raw : null;
  }
  return result;
}

// ─── Deterministic unit_code fallback ──────────────────────────────────────────

export function slugifyProperty(name: string): string {
  const slug = name.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 20);
  return slug || 'UNIT';
}

// ─── Type-casting + validation ────────────────────────────────────────────────

export type CastResult = { value: unknown; error?: string };

export function castAndValidateField(field: MasterFieldDef, rawValue: unknown): CastResult {
  const str = rawValue === null || rawValue === undefined ? '' : String(rawValue).trim();

  if (str === '') {
    return { value: null, error: field.required ? `${field.label} is required` : undefined };
  }

  switch (field.kind) {
    case 'string': {
      if (field.enumValues && !field.enumValues.some((v) => v.toLowerCase() === str.toLowerCase())) {
        return { value: str, error: `Unrecognized ${field.label}: "${str}"` };
      }
      const canonical = field.enumValues?.find((v) => v.toLowerCase() === str.toLowerCase());
      return { value: canonical ?? str };
    }

    case 'integer': {
      const cleaned = str.replace(/[^\d-]/g, '');
      const n = parseInt(cleaned, 10);
      if (isNaN(n)) return { value: null, error: `Non-numeric value for ${field.label}: "${str}"` };
      return { value: n };
    }

    case 'numeric': {
      const cleaned = str.replace(/[^\d.-]/g, '');
      const n = parseFloat(cleaned);
      if (isNaN(n)) return { value: null, error: `Non-numeric value for ${field.label}: "${str}"` };
      if (n < 0) return { value: n, error: `${field.label} must be ≥ 0` };
      return { value: n };
    }

    case 'enum': {
      const canonical = field.enumValues?.find((v) => v.toLowerCase() === str.toLowerCase());
      if (!canonical) return { value: str, error: `Unmatched enum for ${field.label}: "${str}"` };
      return { value: canonical };
    }

    case 'url': {
      if (!/^https?:\/\/\S+$/i.test(str)) {
        return { value: str, error: `Broken URL for ${field.label}: "${str}"` };
      }
      return { value: str };
    }

    default:
      return { value: str };
  }
}

// ─── Final translation to units-table column names ────────────────────────────

/** values keys: master field keys + batch field keys + 'zone' + 'unit_code' (already cast). Returns object keyed by real `units` DB columns. */
export function toDbRow(values: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const f of [...MASTER_FIELDS, ...BATCH_FIELDS]) {
    if (f.key in values) row[f.dbColumn] = values[f.key] ?? null;
  }
  if ('zone' in values) row.zone = values.zone;
  if ('unit_code' in values) row.unit_code = values.unit_code;
  return row;
}
