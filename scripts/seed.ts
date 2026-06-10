// ─────────────────────────────────────────────────────────────────────────────
// Seed script — inserts all 55 mock units into Supabase (testing + production)
// Run: npx tsx scripts/seed.ts
// ─────────────────────────────────────────────────────────────────────────────

import { mockUnits } from '../lib/mockData';

const ENVIRONMENTS = [
  {
    name: 'reims-testing',
    url: 'https://hsulqoavwmsvffsbzoan.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzdWxxb2F2d21zdmZmc2J6b2FuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDg0NjgyOSwiZXhwIjoyMDk2NDIyODI5fQ.zgKW_Q7D0saX5NwKYgPmp7MFyvQyYasof-Gd8F4wBdw',
  },
  {
    name: 'reims-production',
    url: 'https://hbpxufqrdqaycwovirns.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhicHh1ZnFyZHFheWN3b3Zpcm5zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDg0Mzg3OSwiZXhwIjoyMDk2NDE5ODc5fQ.DKEwAyd5Vk8Tgr7fat1mzjgBhe2Y_nB1pZ8nYWhxoVk',
  },
];

// Map UnitListing → units table row
function toUnitRow(u: typeof mockUnits[0]) {
  return {
    unit_code:            u.id,
    realtor_name:         u.realtorName,
    realtor_moci:         u.realtorMOCI,
    property:             u.property,
    unit_no:              u.unitNo,
    zone_code:            u.zoneCode,
    zone:                 u.zone,
    type:                 u.type,
    config:               u.config,
    bathrooms:            u.bathrooms,
    parking:              u.parking,
    kitchen:              u.kitchen,
    furnishing:           u.furnishing,
    listing_type:         u.listingType,
    status:               u.status,
    rent:                 u.rent,
    service_charges:      u.serviceCharges,
    deposit_amount:       u.depositAmount,
    agency_fee:           u.agencyFee,
    moci_contract_status: u.mociContractStatus,
    moci_contract_number: u.mociContractNumber,
    legal_duration:       u.legalDuration,
    contract_start_date:  u.contractStartDate || null,
    contract_end_date:    u.contractEndDate   || null,
    asset_history_links:  u.assetHistoryLinks,
    location_map_url:     u.locationMapUrl,
    media_url:            u.mediaUrl,
    listed_date:          u.listedDate || null,
  };
}

// Map UnitListing → unit_operational row (keyed by unit_code for join after insert)
function toOperationalRow(u: typeof mockUnits[0], unitId: string) {
  return {
    unit_id:          unitId,
    maintenance_notes: u.maintenanceNotes,
    access_lockbox:    u.accessLockbox,
  };
}

async function post(url: string, key: string, table: string, rows: object[]) {
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey:          key,
      Authorization:   `Bearer ${key}`,
      'Content-Type':  'application/json',
      Prefer:          'return=representation',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`POST /${table} failed ${res.status}: ${err}`);
  }
  return res.json() as Promise<{ id: string; unit_code: string }[]>;
}

async function seedEnv(env: typeof ENVIRONMENTS[0]) {
  console.log(`\n── ${env.name} ──────────────────────────`);

  // 1. Insert units
  const unitRows = mockUnits.map(toUnitRow);
  console.log(`  Inserting ${unitRows.length} units...`);
  const inserted = await post(env.url, env.key, 'units', unitRows);
  console.log(`  ✓ ${inserted.length} units inserted`);

  // 2. Build unit_code → uuid map
  const codeToId: Record<string, string> = {};
  for (const row of inserted) codeToId[row.unit_code] = row.id;

  // 3. Insert unit_operational rows
  const opRows = mockUnits
    .filter(u => codeToId[u.id])
    .map(u => toOperationalRow(u, codeToId[u.id]));
  console.log(`  Inserting ${opRows.length} operational records...`);
  const opInserted = await post(env.url, env.key, 'unit_operational', opRows);
  console.log(`  ✓ ${opInserted.length} operational records inserted`);
}

async function main() {
  console.log('Vanguard REOS Seed Script');
  console.log('==================');
  for (const env of ENVIRONMENTS) {
    await seedEnv(env);
  }
  console.log('\n✓ Seed complete.\n');
}

main().catch(err => {
  console.error('\n✗ Seed failed:', err.message);
  process.exit(1);
});
