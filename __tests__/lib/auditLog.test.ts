// Mock the supabase client before importing the module under test
const mockInsert = jest.fn();
jest.mock('../../lib/supabase/client', () => ({
  supabase: {
    from: () => ({ insert: mockInsert }),
  },
}));

import { logEvent } from '../../lib/auditLog';

beforeEach(() => {
  mockInsert.mockReset();
  mockInsert.mockResolvedValue({ error: null });
});

describe('logEvent', () => {
  it('does nothing when unitId is empty', async () => {
    await logEvent({ unitId: '', action: 'RECORD_VIEW' });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('inserts a row with the correct shape', async () => {
    await logEvent({ unitId: 'abc-123', action: 'RECORD_VIEW', tab: 'property' });
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const [row] = mockInsert.mock.calls[0];
    expect(row).toMatchObject({
      unit_id:     'abc-123',
      action_type: 'RECORD_VIEW',
      operator:    'Administrator',
      tab_context: 'property',
    });
  });

  it('sets tab_context to null when tab is omitted', async () => {
    await logEvent({ unitId: 'abc-123', action: 'RECORD_SAVE' });
    const [row] = mockInsert.mock.calls[0];
    expect(row.tab_context).toBeNull();
  });

  it('stores field, old/new values when provided', async () => {
    await logEvent({
      unitId:   'abc-123',
      action:   'FIELD_UPDATE',
      tab:      'operational',
      field:    'unit_status',
      oldValue: 'Available',
      newValue: 'Leased',
    });
    const [row] = mockInsert.mock.calls[0];
    expect(row.field).toBe('unit_status');
    expect(row.old_value).toBe('Available');
    expect(row.new_value).toBe('Leased');
  });

  it('stores payload when provided', async () => {
    await logEvent({
      unitId:  'abc-123',
      action:  'FILE_UPLOAD',
      payload: { storagePath: 'units/abc/doc.pdf' },
    });
    const [row] = mockInsert.mock.calls[0];
    expect(row.payload).toEqual({ storagePath: 'units/abc/doc.pdf' });
  });

  it('defaults payload to {} when omitted', async () => {
    await logEvent({ unitId: 'abc-123', action: 'TAB_NAVIGATE' });
    const [row] = mockInsert.mock.calls[0];
    expect(row.payload).toEqual({});
  });

  it('is silent when Supabase insert throws', async () => {
    mockInsert.mockRejectedValue(new Error('DB down'));
    await expect(logEvent({ unitId: 'abc-123', action: 'RECORD_VIEW' })).resolves.toBeUndefined();
  });

  it('covers all 10 AuditAction values without throwing', async () => {
    const actions = [
      'RECORD_VIEW', 'TAB_NAVIGATE', 'RECORD_SAVE', 'FIELD_UPDATE',
      'STATUS_CHANGE', 'FILE_UPLOAD', 'LINK_SAVED', 'FILE_REMOVED',
      'LINK_REMOVED', 'RECORD_DUPLICATE',
    ] as const;
    for (const action of actions) {
      mockInsert.mockResolvedValueOnce({ error: null });
      await expect(logEvent({ unitId: 'x', action })).resolves.toBeUndefined();
    }
    expect(mockInsert).toHaveBeenCalledTimes(actions.length);
  });
});
