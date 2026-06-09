import { supabase } from './supabase/client';

// ─────────────────────────────────────────────────────────────────────────────
// Central audit event logger — writes immutable entries to audit_log table.
// All events include: timestamp (DB default), operator identity, action type,
// tab context, affected field, old/new values, and a free-form payload object.
// ─────────────────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'RECORD_VIEW'       // modal opened / record visited
  | 'TAB_NAVIGATE'      // user switched to a different tab
  | 'RECORD_SAVE'       // save button triggered in any tab
  | 'FIELD_UPDATE'      // individual field changed (blur listener)
  | 'STATUS_CHANGE'     // unit status explicitly changed
  | 'FILE_UPLOAD'       // document binary uploaded to private storage
  | 'LINK_SAVED'        // external URL / cloud link saved against a doc slot
  | 'FILE_REMOVED'      // uploaded document removed
  | 'LINK_REMOVED'      // external link cleared
  | 'RECORD_DUPLICATE'; // record cloned via Duplicate action

export interface AuditEvent {
  unitId:    string;
  action:    AuditAction;
  tab?:      string;
  field?:    string;
  oldValue?: string;
  newValue?: string;
  payload?:  Record<string, unknown>;
}

// Operator identity — hardcoded until auth layer is wired
const OPERATOR = 'Administrator';

export async function logEvent(e: AuditEvent): Promise<void> {
  if (!e.unitId) return;
  try {
    await supabase.from('audit_log').insert({
      unit_id:     e.unitId,
      action_type: e.action,
      operator:    OPERATOR,
      tab_context: e.tab      ?? null,
      field:       e.field    ?? null,
      old_value:   e.oldValue ?? null,
      new_value:   e.newValue ?? null,
      payload:     e.payload  ?? {},
    });
  } catch {
    // Audit failures are silent — never block the user action
  }
}
