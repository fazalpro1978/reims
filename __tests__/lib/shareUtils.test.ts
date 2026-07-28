import { formatQAR, generateShareText, generateEmailBody } from '../../lib/shareUtils';
import { Status, Furnishing, UnitType, ListingType, MociContractStatus } from '../../types/inventory';
import type { UnitListing } from '../../types/inventory';

// ── Minimal fixture covering every field referenced by the utils ──────────────
const unit: UnitListing = {
  id:            'PG-001',
  uuid:          'test-uuid',
  realtorName:   'Privé Group Real Estate',
  realtorMOCI:   'MOCI-773',
  property:      'Marina Tower',
  unitNo:        'A-101',
  zoneCode:      60,
  zone:          'The Pearl',
  type:          UnitType.Apartment,
  config:        '2 BHK',
  bathrooms:     2,
  parking:       true,
  kitchen:       'Open',
  furnishing:    Furnishing.Fully_Furnished,
  listingType:   ListingType.Rent,
  status:        Status.Available,
  rent:          8000,
  serviceCharges: 0,
  depositAmount:  0,
  agencyFee:      0,
  kahramaaApplicable:  false,
  kahramaaAmount:      0,
  qatarCoolApplicable: false,
  qatarCoolAmount:     0,
  marafeqApplicable:   false,
  marafeqAmount:       0,
  amenities:     [],
  floor:         4,
  size:          120,
  views:         [],
  mociContractStatus: 'REGISTERED' as MociContractStatus,
  mociContractNumber: '',
  legalDuration: '1 Year',
  contractStartDate: '',
  contractEndDate:   '',
  maintenanceNotes:  '',
  accessLockbox:     '',
  assetHistoryLinks: [],
  locationMapUrl:    '',
  mediaUrl:          '',
  listedDate:    '',
  lastUpdated:   '',
  notes:         '',
  mociStatus:    'REGISTERED',
};

// ─────────────────────────────────────────────────────────────────────────────
// formatQAR
// ─────────────────────────────────────────────────────────────────────────────

describe('formatQAR', () => {
  it('formats zero', () => {
    expect(formatQAR(0)).toBe('QAR 0');
  });

  it('formats thousands with comma separator', () => {
    expect(formatQAR(8000)).toBe('QAR 8,000');
  });

  it('formats large rent value', () => {
    expect(formatQAR(100000)).toBe('QAR 100,000');
  });

  it('formats decimal value', () => {
    expect(formatQAR(1500.5)).toMatch(/^QAR/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateShareText
// ─────────────────────────────────────────────────────────────────────────────

describe('generateShareText', () => {
  const text = generateShareText(unit);

  it('includes property name', () => {
    expect(text).toContain('Marina Tower');
  });

  it('includes unit number', () => {
    expect(text).toContain('A-101');
  });

  it('includes zone and zone code', () => {
    expect(text).toContain('The Pearl');
    expect(text).toContain('Zone 60');
  });

  it('includes rent amount', () => {
    expect(text).toContain('8,000');
  });

  it('includes MOCI code', () => {
    expect(text).toContain('MOCI-773');
  });

  it('includes status without underscore', () => {
    expect(text).not.toContain('Under_Maintenance');
    const maintenance = generateShareText({ ...unit, status: Status.Under_Maintenance });
    expect(maintenance).toContain('Under Maintenance');
  });

  it('is a single line (no newlines)', () => {
    expect(text).not.toContain('\n');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateEmailBody
// ─────────────────────────────────────────────────────────────────────────────

describe('generateEmailBody', () => {
  const body = generateEmailBody(unit);

  it('includes header line', () => {
    expect(body).toContain('Property Listing Enquiry — Privé Group Real Estate');
  });

  it('includes property details', () => {
    expect(body).toContain('Marina Tower');
    expect(body).toContain('A-101');
    expect(body).toContain('2 BHK');
  });

  it('includes rent formatted with slash month', () => {
    expect(body).toContain('8,000 / month');
  });

  it('includes company contact details', () => {
    expect(body).toContain('+974 7707 5959');
    expect(body).toContain('admin@privegroupre.com');
  });

  it('includes licence and CR numbers', () => {
    expect(body).toContain('773');
    expect(body).toContain('187753');
  });

  it('is a multi-line string', () => {
    const lines = body.split('\n');
    expect(lines.length).toBeGreaterThan(5);
  });
});
