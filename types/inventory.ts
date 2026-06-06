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

export enum SubType {
  Studio = 'Studio',
  BHK_1 = '1 BHK',
  BHK_2 = '2 BHK',
  BHK_3 = '3 BHK',
  BHK_4 = '4 BHK',
  BHK_5 = '5 BHK',
  Villa_3BR = '3BR Villa',
  Villa_4BR = '4BR Villa',
  Villa_5BR = '5BR Villa',
  Penthouse = 'Penthouse',
  Duplex_3BR = '3BR Duplex',
  Duplex_4BR = '4BR Duplex',
  Commercial_Small = 'Office (Small)',
  Commercial_Large = 'Office (Large)',
}

export type MociContractStatus = 'REGISTERED' | 'PENDING' | 'RENEWAL_DUE' | 'EXPIRED' | 'DRAFT';

export interface UnitListing {
  // ── Identity ──────────────────────────────────────────────────────────────
  id: string;
  realtorName: string;   // Official company name from MOCI/Aqarat directory
  realtorMOCI: string;   // MOCI license / registration code

  // ── Property ──────────────────────────────────────────────────────────────
  property: string;
  unitNo: string;
  zone: string;
  type: UnitType;
  subType: SubType;

  // ── Classification ────────────────────────────────────────────────────────
  furnishing: Furnishing;
  listingType: ListingType;
  status: Status;

  // ── Financials ────────────────────────────────────────────────────────────
  rent: number;               // QAR / month
  serviceCharges: number;     // QAR / month
  depositAmount: number;      // QAR one-time
  agencyFee: number;          // QAR
  agencyFeePercentage: number; // % of annual rent

  // ── Legal ─────────────────────────────────────────────────────────────────
  mociContractStatus: MociContractStatus;
  mociContractNumber: string;
  legalDuration: string;

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
