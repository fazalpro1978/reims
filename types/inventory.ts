// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — DOMAIN TYPES & DATA INTERFACES
// Privé Group RE-IMS · Qatar Property Portfolio
// ─────────────────────────────────────────────────────────────────────────────

export enum Status {
  Available = 'Available',
  Leased = 'Leased',
  Reserved = 'Reserved',
  Under_Maintenance = 'Under_Maintenance',
}

export enum Furnishing {
  Fully_Furnished = 'Fully Furnished',
  Semi_Furnished = 'Semi-Furnished',
  Unfurnished = 'Unfurnished',
}

export enum ListingType {
  Rent = 'Rent',
  Sale = 'Sale',
}

export enum UnitType {
  Apartment = 'Apartment',
  Villa = 'Villa',
  Townhouse = 'Townhouse',
  Penthouse = 'Penthouse',
  Studio = 'Studio',
  Duplex = 'Duplex',
  Office = 'Office',
}

export type KitchenType = 'Open' | 'Closed' | 'Yes' | 'Pantry';

export type MociContractStatus = 'REGISTERED' | 'PENDING' | 'RENEWAL_DUE' | 'EXPIRED' | 'DRAFT';

export interface UnitListing {
  // ── Identity ──────────────────────────────────────────────────────────────
  id: string;            // unit_code (display identifier)
  uuid: string;          // DB primary key UUID — use for all Supabase queries ('' for mock rows)
  realtorName: string;   // Official company name from MOCI/Aqarat directory
  realtorMOCI: string;   // MOCI license / registration code

  // ── Property ──────────────────────────────────────────────────────────────
  property: string;
  unitNo: string;
  zoneCode: number;    // Official Qatar municipality zone number
  zone: string;        // Official district / area name from Qatar zone registry
  type: UnitType;
  config: string;      // Bedroom/maid config, e.g. "3 BHK", "4 BHK + Maid"

  // ── Unit Features ─────────────────────────────────────────────────────────
  bathrooms: number;   // Full baths + 0.5 for half bath/toilet
  parking: boolean;
  kitchen: KitchenType;
  amenities: string[];

  // ── Classification ────────────────────────────────────────────────────────
  furnishing: Furnishing;
  listingType: ListingType;
  status: Status;

  // ── Financials ────────────────────────────────────────────────────────────
  rent: number;               // QAR / month
  serviceCharges: number;     // QAR / month
  depositAmount: number;      // QAR one-time
  agencyFee: number;          // QAR

  // ── Legal ─────────────────────────────────────────────────────────────────
  mociContractStatus: MociContractStatus;
  mociContractNumber: string;
  legalDuration: string;      // e.g. "1 Year (Renewable)" — parsed by UI into value + unit
  contractStartDate: string;  // ISO 8601 date string
  contractEndDate: string;    // ISO 8601 date string

  // ── Operational ───────────────────────────────────────────────────────────
  maintenanceNotes: string;
  accessLockbox: string;
  assetHistoryLinks: string[];

  // ── External Links ────────────────────────────────────────────────────────
  locationMapUrl: string;
  mediaUrl: string;

  // ── Metadata ──────────────────────────────────────────────────────────────
  listedDate: string;    // ISO 8601 date string
  lastUpdated: string;   // ISO 8601 date string
}

// ── Derived helper types for filter state ─────────────────────────────────────

export type StatusFilter = Status | 'All';
export type FurnishingFilter = Furnishing | 'All';

export interface InventoryFilters {
  search: string;
  status: StatusFilter;
  furnishing: FurnishingFilter;
  zone: string;
}

export interface ContextMenuPosition {
  unit: UnitListing;
  x: number;
  y: number;
}
