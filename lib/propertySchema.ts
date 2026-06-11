// ─────────────────────────────────────────────────────────────────────────────
// Property Schema — Vanguard REOS
// Strict validation schema sourced verbatim from PropertyFinder_All_In_One_Dropdown_Matrix
// Core Type → Sub-Type → Configuration hierarchy + Units Inventory CONFIG mapping
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. Strict PropertyFinder hierarchy (verbatim column values) ───────────────

export const PROPERTY_MATRIX = {
  Apartment: {
    'Standard Apartment (Flat)':  ['Studio', '1 BHK', '2 BHK', '3 BHK', '4+ BHK'],
    'Serviced / Hotel Apartment': ['Studio', '1 BHK', '2 BHK', '3 BHK'],
    'Penthouse':                  ['3 BHK', '4 BHK', '5+ BHK'],
    'Duplex':                     ['2 BHK', '3 BHK'],
    'Villa Apartment':            ['Studio', '1 BHK', '2 BHK'],
    'Loft':                       ['1 BHK'],
  },
  Villa: {
    'Stand-Alone Villa': ['3 BHK', '4 BHK', '5 BHK', '6+ BHK'],
    'Compound Villa':    ['3 BHK', '4 BHK', '5+ BHK'],
    'Townhouse':         ['2 BHK', '3 BHK', '4 BHK'],
    'Twin House':        ['3 BHK', '4 BHK'],
  },
  'System Add-On': {
    'Room Filter Extension': ["+ Maid's Room", "+ Driver's Room", '+ Study / Office'],
  },
} as const;

export type CoreType   = keyof typeof PROPERTY_MATRIX;
export type SubType<C extends CoreType> = keyof typeof PROPERTY_MATRIX[C];

// All valid Configuration values across the entire matrix
export const ALL_CONFIGURATIONS = [
  'Studio',
  '1 BHK', '2 BHK', '3 BHK', '4 BHK', '4+ BHK',
  '5 BHK', '5+ BHK', '6+ BHK',
  "+ Maid's Room", "+ Driver's Room", '+ Study / Office',
] as const;

export type Configuration = typeof ALL_CONFIGURATIONS[number];

// ── 2. Type-code lookup (Core Type → Sub-Type → Configuration → 2-char code) ──

export const TYPE_CODE_MAP: Record<string, Record<string, Record<string, string>>> = {
  Apartment: {
    'Standard Apartment (Flat)':  { Studio: 'ST', '1 BHK': '1B', '2 BHK': '2B', '3 BHK': '3B', '4+ BHK': '4B' },
    'Serviced / Hotel Apartment': { Studio: 'S0', '1 BHK': 'S1', '2 BHK': 'S2', '3 BHK': 'S3' },
    Penthouse:                    { '3 BHK': 'P3', '4 BHK': 'P4', '5+ BHK': 'P5' },
    Duplex:                       { '2 BHK': 'D2', '3 BHK': 'D3' },
    'Villa Apartment':            { Studio: 'V0', '1 BHK': 'V1', '2 BHK': 'V2' },
    Loft:                         { '1 BHK': 'LF' },
  },
  Villa: {
    'Stand-Alone Villa': { '3 BHK': 'A3', '4 BHK': 'A4', '5 BHK': 'A5', '6+ BHK': 'A6' },
    'Compound Villa':    { '3 BHK': 'C3', '4 BHK': 'C4', '5+ BHK': 'C5' },
    Townhouse:           { '2 BHK': 'T2', '3 BHK': 'T3', '4 BHK': 'T4' },
    'Twin House':        { '3 BHK': 'W3', '4 BHK': 'W4' },
  },
  'System Add-On': {
    'Room Filter Extension': { "+ Maid's Room": 'MR', "+ Driver's Room": 'DR', '+ Study / Office': 'SO' },
  },
};

export function resolveTypeCode(
  coreType: string, subType: string, configuration: string,
): string | null {
  return TYPE_CODE_MAP[coreType]?.[subType]?.[configuration] ?? null;
}

// ── 3. Units Inventory CONFIG → PropertyFinder schema mapping ─────────────────
//
// Rules:
//   - configuration: verbatim PropertyFinder Configuration value if a direct
//     case-sensitive match exists; null otherwise.
//   - '4 BHK + Maid' / '4 BHK + Maid (Private)' / '5 BHK + Maid (Private)':
//     composite strings — no single verbatim Configuration match → null.
//   - 'Penthouse': matches Sub-Type column only, not Configuration → null config.
//   - coreType / subType: null when the inventory string alone is ambiguous
//     across multiple matrix rows (requires user selection to disambiguate).

export type ConfigMapEntry = {
  /** Verbatim string stored in Units Inventory */
  inventoryConfig: string;
  /** Matching PropertyFinder 'Core Property Type' value, or null if ambiguous */
  coreType: CoreType | null;
  /** Matching PropertyFinder 'Sub-Type / Filter Name' value, or null if ambiguous */
  subType: string | null;
  /** Matching PropertyFinder 'Dropdown Value: Configuration' verbatim value, or null */
  configuration: string | null;
  /** Pre-resolved 2-char type code, or null when any dimension is ambiguous/unmatched */
  typeCode: string | null;
  /** Human-readable reason when configuration is null */
  nullReason?: string;
};

export const INVENTORY_CONFIG_MAP: ConfigMapEntry[] = [
  {
    inventoryConfig: 'Studio',
    coreType:        null,     // ambiguous: Standard Apt, Serviced Apt, or Villa Apt
    subType:         null,
    configuration:   'Studio',
    typeCode:        null,     // sub-type required to resolve
  },
  {
    inventoryConfig: '1 BHK',
    coreType:        null,     // ambiguous: Standard Apt, Serviced Apt, Villa Apt, Loft
    subType:         null,
    configuration:   '1 BHK',
    typeCode:        null,
  },
  {
    inventoryConfig: '2 BHK',
    coreType:        null,     // ambiguous: Standard Apt, Serviced Apt, Duplex, Villa Apt, Townhouse
    subType:         null,
    configuration:   '2 BHK',
    typeCode:        null,
  },
  {
    inventoryConfig: '3 BHK',
    coreType:        null,     // ambiguous: Standard Apt, Serviced Apt, Penthouse, Duplex, Stand-Alone Villa, etc.
    subType:         null,
    configuration:   '3 BHK',
    typeCode:        null,
  },
  {
    inventoryConfig: '4 BHK + Maid',
    coreType:        null,
    subType:         null,
    configuration:   null,
    typeCode:        null,
    nullReason:      'Composite string — not a verbatim Configuration value in PropertyFinder matrix',
  },
  {
    inventoryConfig: '4 BHK + Maid (Private)',
    coreType:        null,
    subType:         null,
    configuration:   null,
    typeCode:        null,
    nullReason:      'Composite string — not a verbatim Configuration value in PropertyFinder matrix',
  },
  {
    inventoryConfig: '5 BHK + Maid (Private)',
    coreType:        null,
    subType:         null,
    configuration:   null,
    typeCode:        null,
    nullReason:      'Composite string — not a verbatim Configuration value in PropertyFinder matrix',
  },
  {
    inventoryConfig: 'Penthouse',
    coreType:        'Apartment',
    subType:         'Penthouse',
    configuration:   null,
    typeCode:        null,
    nullReason:      "Matches 'Sub-Type / Filter Name' column only — no verbatim match in Configuration column; BHK count required",
  },
];

// ── 4. All valid UNIT_CONFIGS for dropdowns (full PropertyFinder matrix) ───────
//
// Flat list of every verbatim Configuration value from the matrix,
// plus the legacy compound strings maintained for backward compatibility.

export const UNIT_CONFIGS_FULL: string[] = [
  // Apartment — Standard
  'Studio', '1 BHK', '2 BHK', '3 BHK', '4+ BHK',
  // Apartment — Serviced (Studio/1/2/3 BHK already above)
  // Apartment — Penthouse
  '5+ BHK',
  // Apartment — Duplex (2/3 BHK already above)
  // Apartment — Villa Apartment (Studio/1/2 BHK already above)
  // Villa
  '4 BHK', '5 BHK', '6+ BHK',
  // System Add-Ons
  "+ Maid's Room", "+ Driver's Room", '+ Study / Office',
  // Legacy Units Inventory compound strings (preserved for existing records)
  '4 BHK + Maid', '4 BHK + Maid (Private)', '5 BHK + Maid (Private)', 'Penthouse',
];

// ── 5. Validation helpers ──────────────────────────────────────────────────────

/**
 * Strict regex for Configuration inputs in the Code Registry inline-add form.
 * Valid examples: 'Studio', '1 BHK', '2 BHK + Maid', '3 BHK + Maid (Private)'
 */
export const CONFIGURATION_REGEX =
  /^(Studio|\d+\+? BHK( \+ [A-Za-z''\/\- ]+(\([A-Za-z ]+\))?)?)$/;

/** Returns true if value is a verbatim Configuration from the PropertyFinder matrix */
export function isValidConfiguration(value: string): boolean {
  return (ALL_CONFIGURATIONS as readonly string[]).includes(value);
}

/** Returns the mapping entry for a given inventory config string */
export function getConfigMapping(inventoryConfig: string): ConfigMapEntry | null {
  return INVENTORY_CONFIG_MAP.find(e => e.inventoryConfig === inventoryConfig) ?? null;
}

/** Given a coreType, returns all valid sub-types */
type MatrixRecord = Record<string, Record<string, readonly string[]>>;

export function getSubTypes(coreType: string): string[] {
  const branch = (PROPERTY_MATRIX as unknown as MatrixRecord)[coreType];
  return branch ? Object.keys(branch) : [];
}

/** Given a coreType + subType, returns all valid configurations */
export function getConfigurations(coreType: string, subType: string): string[] {
  const branch = (PROPERTY_MATRIX as unknown as MatrixRecord)[coreType];
  return branch ? [...(branch[subType] ?? [])] : [];
}
