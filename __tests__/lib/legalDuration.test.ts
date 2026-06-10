import {
  parseLegalDuration,
  calcEndDate,
  calcDurationFromDates,
} from '../../lib/legalDuration';

// ─────────────────────────────────────────────────────────────────────────────
// parseLegalDuration
// ─────────────────────────────────────────────────────────────────────────────

describe('parseLegalDuration', () => {
  it('parses "1 Year"', () => {
    expect(parseLegalDuration('1 Year')).toEqual({ value: 1, unit: 'Years' });
  });

  it('parses "2 Years"', () => {
    expect(parseLegalDuration('2 Years')).toEqual({ value: 2, unit: 'Years' });
  });

  it('parses "6 Months"', () => {
    expect(parseLegalDuration('6 Months')).toEqual({ value: 6, unit: 'Months' });
  });

  it('parses "3 Weeks"', () => {
    expect(parseLegalDuration('3 Weeks')).toEqual({ value: 3, unit: 'Weeks' });
  });

  it('parses "30 Days"', () => {
    expect(parseLegalDuration('30 Days')).toEqual({ value: 30, unit: 'Days' });
  });

  it('is case-insensitive ("12 MONTHS")', () => {
    expect(parseLegalDuration('12 MONTHS')).toEqual({ value: 12, unit: 'Months' });
  });

  it('handles singular "day"', () => {
    expect(parseLegalDuration('1 day')).toEqual({ value: 1, unit: 'Days' });
  });

  it('handles decimal values ("1.5 years")', () => {
    expect(parseLegalDuration('1.5 years')).toEqual({ value: 1.5, unit: 'Years' });
  });

  it('returns default {1, Years} for empty string', () => {
    expect(parseLegalDuration('')).toEqual({ value: 1, unit: 'Years' });
  });

  it('returns default {1, Years} for unrecognised string', () => {
    expect(parseLegalDuration('forever')).toEqual({ value: 1, unit: 'Years' });
  });

  it('trims leading/trailing whitespace', () => {
    expect(parseLegalDuration('  2 months  ')).toEqual({ value: 2, unit: 'Months' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calcEndDate
// ─────────────────────────────────────────────────────────────────────────────

describe('calcEndDate', () => {
  it('returns empty string when start is empty', () => {
    expect(calcEndDate('', 1, 'Years')).toBe('');
  });

  it('adds 1 year correctly', () => {
    expect(calcEndDate('2025-01-01', 1, 'Years')).toBe('2026-01-01');
  });

  it('adds 6 months correctly', () => {
    expect(calcEndDate('2025-01-01', 6, 'Months')).toBe('2025-07-01');
  });

  it('adds 2 weeks (14 days)', () => {
    expect(calcEndDate('2025-06-01', 2, 'Weeks')).toBe('2025-06-15');
  });

  it('adds 30 days', () => {
    expect(calcEndDate('2025-06-01', 30, 'Days')).toBe('2025-07-01');
  });

  it('handles year boundary (Dec → Jan)', () => {
    expect(calcEndDate('2025-12-01', 1, 'Months')).toBe('2026-01-01');
  });

  it('handles leap year correctly', () => {
    // 2024 is a leap year — adding 1 day to Feb 28 gives Feb 29
    expect(calcEndDate('2024-02-28', 1, 'Days')).toBe('2024-02-29');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calcDurationFromDates
// ─────────────────────────────────────────────────────────────────────────────

describe('calcDurationFromDates', () => {
  it('returns {1, Years} when start is empty', () => {
    expect(calcDurationFromDates('', '2026-01-01')).toEqual({ value: 1, unit: 'Years' });
  });

  it('returns {1, Years} when end is empty', () => {
    expect(calcDurationFromDates('2025-01-01', '')).toEqual({ value: 1, unit: 'Years' });
  });

  it('returns {1, Days} when end is before start', () => {
    const r = calcDurationFromDates('2025-06-01', '2024-06-01');
    expect(r).toEqual({ value: 1, unit: 'Days' });
  });

  it('detects exact 1-year span', () => {
    expect(calcDurationFromDates('2025-01-01', '2026-01-01')).toEqual({ value: 1, unit: 'Years' });
  });

  it('detects exact 2-year span (no leap year)', () => {
    // 2025-01-01 → 2027-01-01: 365+365=730 days, 730%365===0 → 2 Years
    expect(calcDurationFromDates('2025-01-01', '2027-01-01')).toEqual({ value: 2, unit: 'Years' });
  });

  it('detects exact month span (30 days)', () => {
    // 30 days = 1 month
    expect(calcDurationFromDates('2025-06-01', '2025-07-01')).toEqual({ value: 1, unit: 'Months' });
  });

  it('detects exact week span (14 days)', () => {
    expect(calcDurationFromDates('2025-06-01', '2025-06-15')).toEqual({ value: 2, unit: 'Weeks' });
  });

  it('returns days for non-divisible span', () => {
    expect(calcDurationFromDates('2025-06-01', '2025-06-16')).toEqual({ value: 15, unit: 'Days' });
  });
});
