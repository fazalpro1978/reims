// Shared report schema — used by the export API and the modal UI

export type ReportColDef = {
  key:   string;  // unique col key (dedup across categories)
  label: string;  // CSV header label
  db:    string;  // units table column name
};

export type ReportCategoryDef = {
  key:     string;
  label:   string;
  icon:    string;
  columns: ReportColDef[];
};

export const REPORT_CATEGORIES: ReportCategoryDef[] = [
  {
    key: 'operational',
    label: 'Operational & Inventory',
    icon: '🏢',
    columns: [
      { key: 'property',    label: 'Property',        db: 'property' },
      { key: 'unit_no',     label: 'Unit No',         db: 'unit_no' },
      { key: 'zone_code',   label: 'Zone Code',       db: 'zone_code' },
      { key: 'zone',        label: 'Zone / District', db: 'zone' },
      { key: 'type',        label: 'Type',            db: 'type' },
      { key: 'config',      label: 'Config',          db: 'config' },
      { key: 'status',      label: 'Status',          db: 'status' },
      { key: 'furnishing',  label: 'Furnishing',      db: 'furnishing' },
      { key: 'bathrooms',   label: 'Bathrooms',       db: 'bathrooms' },
      { key: 'floor',       label: 'Floor',           db: 'floor' },
      { key: 'size_sqm',    label: 'Size (sqm)',      db: 'size_sqm' },
      { key: 'parking',     label: 'Parking',         db: 'parking' },
      { key: 'kitchen',     label: 'Kitchen',         db: 'kitchen' },
      { key: 'view_types',  label: 'Views',           db: 'view_types' },
      { key: 'amenities',   label: 'Amenities',       db: 'amenities' },
      { key: 'listed_date', label: 'Listed Date',     db: 'listed_date' },
      { key: 'updated_at',  label: 'Last Updated',    db: 'updated_at' },
    ],
  },
  {
    key: 'ingestion',
    label: 'Ingestion & Validation',
    icon: '📥',
    columns: [
      { key: 'unit_code',        label: 'Unit Code',  db: 'unit_code' },
      { key: 'property',         label: 'Property',   db: 'property' },
      { key: 'unit_no',          label: 'Unit No',    db: 'unit_no' },
      { key: 'zone_code',        label: 'Zone Code',  db: 'zone_code' },
      { key: 'zone',             label: 'Zone',       db: 'zone' },
      { key: 'type',             label: 'Type',       db: 'type' },
      { key: 'config',           label: 'Config',     db: 'config' },
      { key: 'status',           label: 'Status',     db: 'status' },
      { key: 'furnishing',       label: 'Furnishing', db: 'furnishing' },
      { key: 'rent',             label: 'Rent (QAR)', db: 'rent' },
      { key: 'location_map_url', label: 'Map URL',    db: 'location_map_url' },
      { key: 'media_url',        label: 'Media URL',  db: 'media_url' },
      { key: 'notes',            label: 'Notes',      db: 'notes' },
    ],
  },
  {
    key: 'governance',
    label: 'Identifier & Governance',
    icon: '🔏',
    columns: [
      { key: 'unit_code',            label: 'Unit Code',        db: 'unit_code' },
      { key: 'property',             label: 'Property',         db: 'property' },
      { key: 'unit_no',              label: 'Unit No',          db: 'unit_no' },
      { key: 'realtor_name',         label: 'Realtor Name',     db: 'realtor_name' },
      { key: 'realtor_moci',         label: 'Realtor MOCI',     db: 'realtor_moci' },
      { key: 'moci_contract_number', label: 'MOCI Contract No', db: 'moci_contract_number' },
      { key: 'moci_contract_status', label: 'MOCI Status',      db: 'moci_contract_status' },
      { key: 'legal_duration',       label: 'Legal Duration',   db: 'legal_duration' },
      { key: 'contract_start_date',  label: 'Contract Start',   db: 'contract_start_date' },
      { key: 'contract_end_date',    label: 'Contract End',     db: 'contract_end_date' },
    ],
  },
  {
    key: 'financial',
    label: 'Financial & Utility Summary',
    icon: '💰',
    columns: [
      { key: 'property',                         label: 'Property',              db: 'property' },
      { key: 'unit_no',                          label: 'Unit No',               db: 'unit_no' },
      { key: 'rent',                             label: 'Rent (QAR)',            db: 'rent' },
      { key: 'service_charges',                  label: 'Service Charges (QAR)', db: 'service_charges' },
      { key: 'deposit_amount',                   label: 'Deposit (QAR)',         db: 'deposit_amount' },
      { key: 'agency_fee',                       label: 'Agency Fee (QAR)',      db: 'agency_fee' },
      { key: 'kahramaa_applicable',              label: 'Kahramaa Applicable',   db: 'kahramaa_applicable' },
      { key: 'kahramaa_amount',                  label: 'Kahramaa (QAR)',        db: 'kahramaa_amount' },
      { key: 'qatar_cool_applicable',            label: 'Qatar Cool Applicable', db: 'qatar_cool_applicable' },
      { key: 'qatar_cool_amount',                label: 'Qatar Cool (QAR)',      db: 'qatar_cool_amount' },
      { key: 'marafeq_applicable',               label: 'Marafeq Applicable',    db: 'marafeq_applicable' },
      { key: 'marafeq_amount',                   label: 'Marafeq (QAR)',         db: 'marafeq_amount' },
      { key: 'water_electricity',                label: 'Water & Electricity',   db: 'water_electricity' },
      { key: 'water_electricity_limit_applicable',label: 'W&E Limit Applicable', db: 'water_electricity_limit_applicable' },
      { key: 'water_electricity_limit_amount',   label: 'W&E Limit (QAR)',       db: 'water_electricity_limit_amount' },
      { key: 'month_free_applicable',            label: 'Month Free Applicable', db: 'month_free_applicable' },
      { key: 'month_free_days',                  label: 'Month Free Days',       db: 'month_free_days' },
      { key: 'pro_rata_applicable',              label: 'Pro-Rata Applicable',   db: 'pro_rata_applicable' },
      { key: 'booking_fee',                      label: 'Booking Fee (QAR)',     db: 'booking_fee' },
      { key: 'booking_validity',                 label: 'Booking Validity',      db: 'booking_validity' },
      { key: 'booking_validity_period',          label: 'Booking Period',        db: 'booking_validity_period' },
    ],
  },
  {
    key: 'registry',
    label: 'Registry & Entity Mapping',
    icon: '🗂️',
    columns: [
      { key: 'unit_code',    label: 'Unit Code',     db: 'unit_code' },
      { key: 'property',     label: 'Property',      db: 'property' },
      { key: 'unit_no',      label: 'Unit No',       db: 'unit_no' },
      { key: 'zone_code',    label: 'Zone Code',     db: 'zone_code' },
      { key: 'zone',         label: 'Zone',          db: 'zone' },
      { key: 'realtor_name', label: 'Realtor Name',  db: 'realtor_name' },
      { key: 'realtor_moci', label: 'Realtor MOCI',  db: 'realtor_moci' },
      { key: 'listing_type', label: 'Listing Type',  db: 'listing_type' },
    ],
  },
  {
    key: 'executive',
    label: 'Executive & Portfolio Summary',
    icon: '📊',
    columns: [
      { key: 'property',        label: 'Property',        db: 'property' },
      { key: 'unit_no',         label: 'Unit No',         db: 'unit_no' },
      { key: 'zone',            label: 'Zone',            db: 'zone' },
      { key: 'status',          label: 'Status',          db: 'status' },
      { key: 'type',            label: 'Type',            db: 'type' },
      { key: 'config',          label: 'Config',          db: 'config' },
      { key: 'furnishing',      label: 'Furnishing',      db: 'furnishing' },
      { key: 'rent',            label: 'Rent (QAR)',      db: 'rent' },
      { key: 'service_charges', label: 'Service Charges', db: 'service_charges' },
      { key: 'deposit_amount',  label: 'Deposit (QAR)',   db: 'deposit_amount' },
      { key: 'listed_date',     label: 'Listed Date',     db: 'listed_date' },
    ],
  },
  {
    key: 'synergy',
    label: 'Synergy — CRM & Pipeline',
    icon: '🔗',
    columns: [
      { key: 'unit_code',              label: 'Unit Code',            db: 'unit_code' },
      { key: 'property',               label: 'Property',             db: 'property' },
      { key: 'unit_no',                label: 'Unit No',              db: 'unit_no' },
      { key: 'zone',                   label: 'Zone',                 db: 'zone' },
      { key: 'type',                   label: 'Type',                 db: 'type' },
      { key: 'config',                 label: 'Config',               db: 'config' },
      { key: 'status',                 label: 'Status',               db: 'status' },
      { key: 'furnishing',             label: 'Furnishing',           db: 'furnishing' },
      { key: 'rent',                   label: 'Rent (QAR)',           db: 'rent' },
      { key: 'notes',                  label: 'Notes',                db: 'notes' },
      { key: 'remarks',                label: 'Remarks',              db: 'remarks' },
      { key: 'booking_fee',            label: 'Booking Fee (QAR)',    db: 'booking_fee' },
      { key: 'booking_validity',       label: 'Booking Validity',     db: 'booking_validity' },
      { key: 'booking_validity_period',label: 'Booking Period',       db: 'booking_validity_period' },
    ],
  },
];

// Always-present mandatory primary key identifiers
export const MANDATORY_COLS: ReportColDef[] = [
  { key: 'property', label: 'Property', db: 'property' },
  { key: 'unit_no',  label: 'Unit No',  db: 'unit_no'  },
];

/**
 * Given a set of selected category keys, resolve the ordered, de-duplicated
 * list of DB columns to SELECT and CSV headers to emit. Mandatory cols are
 * always prepended.
 */
export function resolveColumns(
  selectedCategories: string[],
  selectedCols?: Record<string, string[]>,  // catKey → col keys; if absent, use all cols in category
): { dbCol: string; label: string }[] {
  const seen   = new Set<string>();
  const result: { dbCol: string; label: string }[] = [];

  // Mandatory first
  for (const m of MANDATORY_COLS) {
    if (!seen.has(m.db)) {
      seen.add(m.db);
      result.push({ dbCol: m.db, label: m.label });
    }
  }

  for (const catKey of selectedCategories) {
    const cat = REPORT_CATEGORIES.find(c => c.key === catKey);
    if (!cat) continue;
    const allowedKeys = selectedCols?.[catKey];
    for (const col of cat.columns) {
      if (allowedKeys && !allowedKeys.includes(col.key)) continue;
      if (!seen.has(col.db)) {
        seen.add(col.db);
        result.push({ dbCol: col.db, label: col.label });
      }
    }
  }

  return result;
}
