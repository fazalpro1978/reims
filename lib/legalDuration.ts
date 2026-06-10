export type DurationUnit = 'Days' | 'Weeks' | 'Months' | 'Years';

export function parseLegalDuration(s: string): { value: number; unit: DurationUnit } {
  const m = s.trim().match(/^(\d+(?:\.\d+)?)\s*(day|days|week|weeks|month|months|year|years)/i);
  if (!m) return { value: 1, unit: 'Years' };
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  if (u.startsWith('day'))   return { value: n, unit: 'Days' };
  if (u.startsWith('week'))  return { value: n, unit: 'Weeks' };
  if (u.startsWith('month')) return { value: n, unit: 'Months' };
  return { value: n, unit: 'Years' };
}

export function calcEndDate(start: string, value: number, unit: DurationUnit): string {
  if (!start) return '';
  const d = new Date(start);
  if (unit === 'Days')   d.setDate(d.getDate() + value);
  if (unit === 'Weeks')  d.setDate(d.getDate() + value * 7);
  if (unit === 'Months') d.setMonth(d.getMonth() + value);
  if (unit === 'Years')  d.setFullYear(d.getFullYear() + value);
  return d.toISOString().split('T')[0];
}

export function calcDurationFromDates(start: string, end: string): { value: number; unit: DurationUnit } {
  if (!start || !end) return { value: 1, unit: 'Years' };
  const diffDays = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
  if (diffDays <= 0) return { value: 1, unit: 'Days' };
  if (diffDays % 365 === 0) return { value: diffDays / 365, unit: 'Years' };
  if (diffDays % 30  === 0) return { value: diffDays / 30,  unit: 'Months' };
  if (diffDays % 7   === 0) return { value: diffDays / 7,   unit: 'Weeks' };
  return { value: diffDays, unit: 'Days' };
}
