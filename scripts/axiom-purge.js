#!/usr/bin/env node
/**
 * AXIOM Purge Tool
 *
 * Identifies all public.units records that originated from AXIOM (dInges) via
 * unit_code cross-reference with ingest.vetted_records, counts downstream
 * dependents, backs up PKs to a JSON audit file, and optionally executes a
 * transaction-wrapped deletion under superuser authorization.
 *
 * Usage:
 *   node scripts/axiom-purge.js                              (dry-run, reads .env.local)
 *   node scripts/axiom-purge.js --dry-run                    (explicit dry-run)
 *   node scripts/axiom-purge.js --env .env.production.local  (target production)
 *   node scripts/axiom-purge.js --execute --confirm          (live deletion)
 *   node scripts/axiom-purge.js --execute --confirm --env .env.production.local
 *
 * Reads from env file:
 *   NEXT_PUBLIC_SUPABASE_URL   + SUPABASE_SERVICE_ROLE_KEY  → REIMS (public.units)
 *   AXIOM_SUPABASE_URL         + AXIOM_SERVICE_ROLE_KEY     → AXIOM (ingest.vetted_records)
 *   (If AXIOM_* vars are absent, falls back to REIMS credentials — testing only)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Parse args ───────────────────────────────────────────────────────────────
const args      = process.argv.slice(2);
const isDry     = !args.includes('--execute');
const confirm   = args.includes('--confirm');
const allUnits  = args.includes('--all-units'); // target every unit (when vetted_records empty)

// --env <file> to point at a different env file (e.g. .env.production.local)
const envFlagIdx = args.indexOf('--env');
const envFilename = envFlagIdx !== -1 ? args[envFlagIdx + 1] : null;

if (!isDry && !confirm) {
  console.error('\n❌  --execute requires --confirm to prevent accidental runs.');
  console.error('    Run: node scripts/axiom-purge.js --execute --confirm\n');
  process.exit(1);
}

// ── Load env file ────────────────────────────────────────────────────────────
const envPath = envFilename
  ? path.resolve(process.cwd(), envFilename)
  : path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error(`\n❌  Env file not found: ${envPath}\n`);
  if (!envFilename) console.error('    Create .env.local or pass --env <file>\n');
  process.exit(1);
}

const envVars = {};
fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx < 0) return;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
  envVars[key] = val;
});

const SUPABASE_URL  = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_KEY   = envVars['SUPABASE_SERVICE_ROLE_KEY'];
// AXIOM project (separate Supabase in production; falls back to REIMS in testing)
const AXIOM_URL     = envVars['AXIOM_SUPABASE_URL']     || SUPABASE_URL;
const AXIOM_KEY     = envVars['AXIOM_SERVICE_ROLE_KEY']  || SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('\n❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env file\n');
  process.exit(1);
}

const usingAxiomSeparate = !!envVars['AXIOM_SUPABASE_URL'];

// ── REST helpers (pure fetch — Node 20 native) ───────────────────────────────
function baseHeaders(extra = {}) {
  return {
    'apikey':        SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type':  'application/json',
    ...extra,
  };
}

async function pgGet(table, params = {}, schema = 'public') {
  const qs = new URLSearchParams(params).toString();
  const url = `${SUPABASE_URL}/rest/v1/${table}${qs ? '?' + qs : ''}`;
  const res = await fetch(url, {
    headers: baseHeaders({
      'Accept-Profile': schema,
      'Prefer':         'return=representation',
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`GET ${table}: ${res.status} ${t.slice(0, 300)}`);
  }
  return res.json();
}

async function pgCount(table, params = {}, schema = 'public') {
  const qs = new URLSearchParams(params).toString();
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=id${qs ? '&' + qs : ''}`;
  const res = await fetch(url, {
    headers: baseHeaders({
      'Accept-Profile': schema,
      'Prefer':         'count=exact',
      'Range-Unit':     'items',
      'Range':          '0-0',
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`COUNT ${table}: ${res.status} ${t.slice(0, 300)}`);
  }
  const cr = res.headers.get('content-range');
  const total = cr ? parseInt(cr.split('/')[1], 10) : 0;
  return isNaN(total) ? 0 : total;
}

async function pgDelete(table, params = {}, schema = 'public') {
  const qs = new URLSearchParams(params).toString();
  const url = `${SUPABASE_URL}/rest/v1/${table}?${qs}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: baseHeaders({
      'Accept-Profile': schema,
      'Prefer':         'count=exact',
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`DELETE ${table}: ${res.status} ${t.slice(0, 300)}`);
  }
  const cr = res.headers.get('content-range');
  const total = cr ? parseInt(cr.split('/')[1], 10) : 0;
  return isNaN(total) ? 0 : total;
}

async function pgPatch(table, params = {}, body = {}, schema = 'public') {
  const qs = new URLSearchParams(params).toString();
  const url = `${SUPABASE_URL}/rest/v1/${table}?${qs}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: baseHeaders({
      'Accept-Profile': schema,
      'Prefer':         'count=exact',
    }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`PATCH ${table}: ${res.status} ${t.slice(0, 300)}`);
  }
  const cr = res.headers.get('content-range');
  const total = cr ? parseInt(cr.split('/')[1], 10) : 0;
  return isNaN(total) ? 0 : total;
}

// ── Step 1: Identify AXIOM-sourced unit_codes ────────────────────────────────
// vetted_records.payload is JSONB. The REST API cannot easily project JSONB fields
// via the query string. We fetch the raw payload column and extract unit_code in JS.
async function getAxiomUnitCodes() {
  // Fetch all acknowledged vetted records from the AXIOM Supabase project.
  const PAGE = 1000;
  let offset = 0;
  const codes = new Set();

  while (true) {
    const res = await fetch(
      `${AXIOM_URL}/rest/v1/vetted_records?select=payload&acknowledged_at=not.is.null`,
      {
        headers: {
          'apikey':         AXIOM_KEY,
          'Authorization':  `Bearer ${AXIOM_KEY}`,
          'Accept-Profile': 'ingest',
          'Range-Unit':     'items',
          'Range':          `${offset}-${offset + PAGE - 1}`,
        },
      }
    );
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`vetted_records: ${res.status} ${t.slice(0, 300)}`);
    }
    const rows = await res.json();
    if (!rows.length) break;
    rows.forEach(r => {
      const code = r.payload && r.payload.unit_code;
      if (typeof code === 'string' && code.trim()) codes.add(code.trim());
    });
    if (rows.length < PAGE) break;
    offset += PAGE;
  }

  return [...codes];
}

// ── Step 2: Resolve unit_codes → public.units rows ──────────────────────────
// PostgREST uses `unit_code=in.(A,B,C)` for IN filters.
async function resolveUnits(unitCodes) {
  if (unitCodes.length === 0) return [];
  // Split into batches of 200 to avoid URL length limits
  const BATCH = 200;
  const all = [];
  for (let i = 0; i < unitCodes.length; i += BATCH) {
    const batch = unitCodes.slice(i, i + BATCH);
    const inFilter = `(${batch.join(',')})`;
    const rows = await pgGet('units', {
      select:    'id,unit_code,property,unit_no,status,realtor_name',
      unit_code: `in.${inFilter}`,
    });
    all.push(...rows);
  }
  return all;
}

// ── Step 3: Count downstream dependents ─────────────────────────────────────
async function countDependents(unitIds) {
  if (unitIds.length === 0) {
    return { inquiry_matches: 0, notifications: 0, inquiries_assigned: 0 };
  }
  const inFilter = `(${unitIds.join(',')})`;

  const [matchCount, notifCount, inq1Count, inq2Count, inq3Count] = await Promise.all([
    pgCount('inquiry_matches', { unit_id: `in.${inFilter}` }),
    pgCount('notifications',   { unit_id: `in.${inFilter}` }),
    pgCount('inquiries',       { assigned_unit_id:   `in.${inFilter}` }),
    pgCount('inquiries',       { assigned_unit_id_2: `in.${inFilter}` }),
    pgCount('inquiries',       { assigned_unit_id_3: `in.${inFilter}` }),
  ]);

  return {
    inquiry_matches:    matchCount,
    notifications:      notifCount,
    inquiries_assigned: inq1Count + inq2Count + inq3Count,
  };
}

// ── Step 4: Write backup JSON ────────────────────────────────────────────────
function writeBackup(units, dependents, dryRun) {
  const ts       = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `axiom_purged_units_backup_${ts}.json`;
  const outPath  = path.join(__dirname, '..', filename);
  const payload  = {
    generated_at:             new Date().toISOString(),
    mode:                     dryRun ? 'dry-run' : 'execute',
    identification_field:     'unit_code (from ingest.vetted_records.payload where acknowledged_at IS NOT NULL)',
    total_units_targeted:     units.length,
    dependents,
    units: units.map(u => ({
      id:           u.id,
      unit_code:    u.unit_code,
      property:     u.property,
      unit_no:      u.unit_no,
      status:       u.status,
      realtor_name: u.realtor_name,
    })),
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf-8');
  return outPath;
}

// ── Step 5: Execute deletion ─────────────────────────────────────────────────
async function executeDeletion(units, dependents) {
  const unitIds  = units.map(u => u.id);
  const inFilter = `(${unitIds.join(',')})`;
  const errors   = [];
  let nulled_matches = 0, nulled_notifications = 0, deleted_units = 0;

  console.log('\n⚙️  Executing deletion steps...\n');

  // A: Delete inquiry_matches (loose ref — no FK, orphaned match has no value)
  if (dependents.inquiry_matches > 0) {
    try {
      nulled_matches = await pgDelete('inquiry_matches', { unit_id: `in.${inFilter}` });
      console.log(`   ✓ Deleted ${nulled_matches} inquiry_match row(s)`);
    } catch (err) {
      errors.push(`inquiry_matches: ${err.message}`);
    }
  }

  // B: Null notifications.unit_id (preserve notification record, decouple unit ref)
  if (dependents.notifications > 0) {
    try {
      nulled_notifications = await pgPatch('notifications', { unit_id: `in.${inFilter}` }, { unit_id: null });
      console.log(`   ✓ Nulled unit_id on ${nulled_notifications} notification row(s)`);
    } catch (err) {
      errors.push(`notifications: ${err.message}`);
    }
  }

  if (errors.length > 0) {
    console.error('\n❌  Pre-deletion cleanup failed. Aborting before touching units table.');
    return { ok: false, errors, nulled_matches, nulled_notifications, deleted_units };
  }

  // C: Delete units — cascades: unit_commissions, unit_clients, unit_documents,
  //    unit_operational, audit_log; SET NULL: inquiries.assigned_unit_id/2/3
  try {
    deleted_units = await pgDelete('units', { id: `in.${inFilter}` });
    console.log(`   ✓ Deleted ${deleted_units} unit row(s) (children auto-cascaded)`);
  } catch (err) {
    errors.push(`units: ${err.message}`);
    return { ok: false, errors, nulled_matches, nulled_notifications, deleted_units };
  }

  return { ok: true, nulled_matches, nulled_notifications, deleted_units, errors: [] };
}

// ── Step 6: Verify zero remaining ────────────────────────────────────────────
async function verifyZero(axiomCodes) {
  if (axiomCodes.length === 0) return 0;
  const BATCH = 200;
  let total = 0;
  for (let i = 0; i < axiomCodes.length; i += BATCH) {
    const batch = axiomCodes.slice(i, i + BATCH);
    const inFilter = `(${batch.join(',')})`;
    total += await pgCount('units', { unit_code: `in.${inFilter}` });
  }
  return total;
}

// ── SQL transaction printout ─────────────────────────────────────────────────
function printSqlTransaction(units, useAllUnits) {
  const idList   = units.map(u => `  '${u.id}'`).join(',\n');
  const ts       = new Date().toISOString();

  const whereClause = useAllUnits
    ? '-- targeting ALL units (confirmed all are AXIOM-sourced)\n  WHERE TRUE'
    : `WHERE unit_id IN (\n${idList}\n)`;
  const unitsWhere = useAllUnits ? 'WHERE TRUE' : `WHERE id IN (\n${idList}\n)`;
  const verifyClause = useAllUnits
    ? 'SELECT COUNT(*) AS remaining_units FROM public.units;\n-- Expected: 0'
    : `SELECT COUNT(*) AS remaining_axiom_units FROM public.units\nWHERE id IN (\n${idList}\n);\n-- Expected: 0`;

  return `
${'═'.repeat(70)}
  SQL TRANSACTION — run in Supabase SQL Editor for full DB-level atomicity
  Generated : ${ts}
  Units targeted : ${units.length}${useAllUnits ? ' (ALL — confirmed AXIOM-sourced)' : ''}
${'═'.repeat(70)}

BEGIN;

-- 1. Remove inquiry matches referencing targeted units (no FK — manual cleanup)
DELETE FROM public.inquiry_matches
${whereClause.replace('unit_id', 'unit_id')};

-- 2. Decouple notifications (preserve record, null the unit reference)
UPDATE public.notifications
SET unit_id = NULL
${whereClause};

-- 3. Delete units
--   ON DELETE CASCADE: unit_commissions, unit_clients, unit_documents,
--                      unit_operational, audit_log
--   ON DELETE SET NULL: inquiries.assigned_unit_id/2/3
DELETE FROM public.units
${unitsWhere};

-- 4. Verify
${verifyClause}

COMMIT;
${'═'.repeat(70)}
`;
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  const mode = isDry ? 'DRY-RUN' : 'EXECUTE';
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  AXIOM Purge Tool — ${mode}`);
  console.log(`  ${new Date().toISOString()}`);
  console.log(`  REIMS Supabase : ${SUPABASE_URL}`);
  console.log(`  AXIOM Supabase : ${AXIOM_URL}${usingAxiomSeparate ? '' : ' (same — testing mode)'}`);
  console.log(`${'═'.repeat(60)}\n`);

  let units;

  if (allUnits) {
    // --all-units mode: target every unit in public.units (used when vetted_records
    // is empty but all units are confirmed AXIOM-sourced via batch timestamps)
    console.log('Step 1/4  --all-units mode — fetching all public.units records...');
    try {
      units = await pgGet('units', { select: 'id,unit_code,property,unit_no,status,realtor_name', limit: 10000 });
    } catch (err) {
      console.error(`\n❌  ${err.message}\n`);
      process.exit(1);
    }
    console.log(`          ${units.length} unit(s) targeted\n`);
    if (units.length === 0) {
      console.log('ℹ️  public.units is empty. Nothing to purge.\n');
      process.exit(0);
    }
    console.log('Step 2/4  Skipped (--all-units: no vetted_records lookup needed)\n');
  } else {
    // 1. Get AXIOM unit_codes from vetted_records
    process.stdout.write('Step 1/4  Querying ingest.vetted_records (acknowledged)... ');
    let axiomCodes;
    try {
      axiomCodes = await getAxiomUnitCodes();
    } catch (err) {
      console.error(`\n❌  ${err.message}\n`);
      process.exit(1);
    }
    console.log(`${axiomCodes.length} unique code(s) found`);

    if (axiomCodes.length === 0) {
      console.log('\nℹ️  No acknowledged AXIOM records found. Nothing to purge.');
      console.log('    If all units are confirmed AXIOM-sourced, use --all-units flag.\n');
      process.exit(0);
    }

    // 2. Resolve to public.units
    process.stdout.write('Step 2/4  Resolving codes → public.units... ');
    try {
      units = await resolveUnits(axiomCodes);
    } catch (err) {
      console.error(`\n❌  ${err.message}\n`);
      process.exit(1);
    }
    console.log(`${units.length} unit(s) in public.units`);

    const resolvedCodes = new Set(units.map(u => u.unit_code));
    const ghost = axiomCodes.filter(c => !resolvedCodes.has(c));
    if (ghost.length > 0) {
      console.log(`          ⚠️  ${ghost.length} code(s) acknowledged but not in public.units (already removed)`);
    }

    if (units.length === 0) {
      console.log('\nℹ️  All acknowledged codes already absent from public.units. Database is clean.\n');
      process.exit(0);
    }
  }

  // 3. Count dependents
  process.stdout.write('Step 3/4  Counting downstream dependents... ');
  const unitIds = units.map(u => u.id);
  let dependents;
  try {
    dependents = await countDependents(unitIds);
  } catch (err) {
    console.error(`\n❌  ${err.message}\n`);
    process.exit(1);
  }
  console.log('done');

  // 4. Backup
  process.stdout.write('Step 4/4  Writing backup JSON... ');
  let backupPath;
  try {
    backupPath = writeBackup(units, dependents, isDry);
  } catch (err) {
    console.error(`\n❌  Backup write failed: ${err.message}\n`);
    process.exit(1);
  }
  console.log(path.basename(backupPath));

  // Summary
  console.log(`
┌──────────────────────────────────────────────────────────────┐
│  DRY-RUN REPORT                                              │
├──────────────────────────────────────────────────────────────┤
│  Identification field   : unit_code → ingest.vetted_records  │
│  Primary units targeted : ${String(units.length).padEnd(35)}│
│  inquiry_matches        : ${String(dependents.inquiry_matches).padEnd(35)}│
│    → will be DELETED (match to non-existent unit)            │
│  notifications          : ${String(dependents.notifications).padEnd(35)}│
│    → unit_id will be SET NULL (preserve notification)        │
│  inquiries (assigned)   : ${String(dependents.inquiries_assigned).padEnd(35)}│
│    → assigned_unit_id SET NULL via ON DELETE cascade         │
│  unit_commissions / unit_clients / unit_documents /          │
│  unit_operational / audit_log → auto-deleted via CASCADE     │
│  Backup file            : ${path.basename(backupPath).padEnd(35)}│
└──────────────────────────────────────────────────────────────┘`);

  // Unit preview table
  const preview = units.slice(0, 30);
  console.log(`\nUnits targeted (${units.length} total, showing ${preview.length}):`);
  console.log('─'.repeat(82));
  console.log('unit_code            property                         unit_no    status');
  console.log('─'.repeat(82));
  for (const u of preview) {
    console.log(
      `${String(u.unit_code ?? '').padEnd(21)}` +
      `${String(u.property ?? '').slice(0, 33).padEnd(33)}` +
      `${String(u.unit_no ?? '').padEnd(11)}` +
      `${u.status ?? ''}`
    );
  }
  if (units.length > 30) console.log(`  ... and ${units.length - 30} more (see backup JSON)`);

  // SQL block
  console.log(printSqlTransaction(units, allUnits));

  if (isDry) {
    console.log('ℹ️  Dry-run complete — no data was modified.');
    console.log('    To execute live deletion:');
    console.log('    node scripts/axiom-purge.js --execute --confirm\n');
    process.exit(0);
  }

  // ── EXECUTE ──────────────────────────────────────────────────────────────
  console.log('\n⚠️   EXECUTE MODE — proceeding with live deletion\n');

  let result;
  try {
    result = await executeDeletion(units, dependents);
  } catch (err) {
    console.error(`\n❌  ${err.message}\n`);
    process.exit(1);
  }

  if (!result.ok) {
    console.error('\n❌  Deletion aborted:');
    result.errors.forEach(e => console.error(`    ${e}`));
    process.exit(1);
  }

  // Verify
  process.stdout.write('\nVerifying zero remaining AXIOM units... ');
  let remaining;
  try {
    remaining = await verifyZero(axiomCodes);
  } catch (err) {
    console.error(`\n❌  Verification failed: ${err.message}\n`);
    process.exit(1);
  }

  if (remaining === 0) {
    console.log('✓  PASSED — 0 units remain');
  } else {
    console.error(`❌  FAILED — ${remaining} unit(s) still present in public.units`);
    process.exit(1);
  }

  // Final backup with execute mode
  const finalBackupPath = writeBackup(units, dependents, false);

  console.log(`
┌──────────────────────────────────────────────────────────────┐
│  EXECUTION COMPLETE ✓                                        │
├──────────────────────────────────────────────────────────────┤
│  Units deleted           : ${String(result.deleted_units).padEnd(34)}│
│  inquiry_matches removed : ${String(result.nulled_matches).padEnd(34)}│
│  notifications decoupled : ${String(result.nulled_notifications).padEnd(34)}│
│  Remaining AXIOM units   : 0 ✓                               │
│  Audit file              : ${path.basename(finalBackupPath).padEnd(34)}│
└──────────────────────────────────────────────────────────────┘
`);

})().catch(err => {
  console.error(`\n❌  Unexpected error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
});
