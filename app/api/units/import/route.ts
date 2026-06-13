import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const SKIP_AUDIT = new Set(['updated_at', 'created_at', 'id', 'unit_code']);

export async function POST(req: NextRequest) {
  try {
    const { rows, runId, sourceFile } = (await req.json()) as {
      rows: Array<{
        resolvedData: Record<string, unknown>;
        unitId: string | null;
        action: 'new' | 'update' | 'conflict';
        conflictResolutions?: Record<string, unknown>; // user-chosen values for conflict fields
      }>;
      runId?: string;
      sourceFile?: string;
    };

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'rows array required' }, { status: 400 });
    }

    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];
    const now = new Date().toISOString();

    for (const row of rows) {
      const data = { ...row.resolvedData, ...row.conflictResolutions };

      // ── INSERT new unit ────────────────────────────────────────────────────
      if (row.action === 'new' || !row.unitId) {
        const { data: inserted_rows, error } = await admin
          .from('units')
          .insert(data)
          .select('id')
          .single();

        if (error) { errors.push(`Insert ${data.unit_code}: ${error.message}`); continue; }
        inserted++;

        // Seed initial version snapshot
        if (inserted_rows?.id) {
          await admin.from('unit_versions').insert({
            unit_id:   inserted_rows.id,
            snapshot:  data,
            trigger:   'ingestion',
            run_id:    runId ?? null,
          });

          // Seed creation change log
          await admin.from('unit_changes').insert({
            unit_id:     inserted_rows.id,
            run_id:      runId ?? null,
            field_name:  '__created__',
            old_value:   null,
            new_value:   JSON.stringify(data),
            changed_by:  'system:ingestion',
            source_file: sourceFile ?? null,
            change_type: 'create',
          });
        }
        continue;
      }

      // ── UPDATE existing unit ───────────────────────────────────────────────
      // 1. Fetch current state for snapshot + diff
      const { data: current } = await admin
        .from('units')
        .select('*')
        .eq('id', row.unitId)
        .single();

      if (!current) { errors.push(`Unit ${row.unitId} not found`); continue; }

      // 2. Snapshot current state before overwriting
      await admin.from('unit_versions').insert({
        unit_id:  row.unitId,
        snapshot: current,
        trigger:  'ingestion',
        run_id:   runId ?? null,
      });

      // 3. Compute field-level diff for audit
      const changedFields: Array<{ field_name: string; old_value: string | null; new_value: string | null }> = [];
      for (const [field, newVal] of Object.entries(data)) {
        if (SKIP_AUDIT.has(field)) continue;
        const oldVal = current[field];
        if (String(oldVal ?? '') !== String(newVal ?? '')) {
          changedFields.push({
            field_name: field,
            old_value:  oldVal != null ? String(oldVal) : null,
            new_value:  newVal != null ? String(newVal) : null,
          });
        }
      }

      // 4. Apply update
      const { error } = await admin
        .from('units')
        .update({ ...data, updated_at: now })
        .eq('id', row.unitId);

      if (error) { errors.push(`Update ${data.unit_code}: ${error.message}`); continue; }
      updated++;

      // 5. Write field-level audit entries
      if (changedFields.length > 0) {
        await admin.from('unit_changes').insert(
          changedFields.map((cf) => ({
            unit_id:     row.unitId,
            run_id:      runId ?? null,
            field_name:  cf.field_name,
            old_value:   cf.old_value,
            new_value:   cf.new_value,
            changed_by:  'system:ingestion',
            source_file: sourceFile ?? null,
            change_type: 'update',
          })),
        );
      }
    }

    // ── Update ingestion_run counters ──────────────────────────────────────
    if (runId) {
      await admin
        .from('ingestion_runs')
        .update({
          status:       errors.length === rows.length ? 'rejected' : 'imported',
          new_count:    inserted,
          update_count: updated,
          skipped_count: errors.length,
        })
        .eq('id', runId);
    }

    return NextResponse.json({ inserted, updated, errors });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Import failed' },
      { status: 500 },
    );
  }
}
