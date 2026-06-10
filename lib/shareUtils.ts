import { UnitListing } from '../types/inventory';

export const formatQAR = (n: number): string => `QAR ${n.toLocaleString('en-US')}`;

export function generateShareText(unit: UnitListing): string {
  return (
    `Property: ${unit.property}, Unit: ${unit.unitNo}, District: ${unit.zone} (Zone ${unit.zoneCode}), ` +
    `Type: ${unit.type} · ${unit.config}, Furnishing: ${unit.furnishing}, ` +
    `Rent: QAR ${unit.rent.toLocaleString()}/month, Status: ${unit.status.replace('_', ' ')}, ` +
    `Realtor (MOCI): ${unit.realtorMOCI}`
  );
}

export function generateEmailBody(unit: UnitListing): string {
  return [
    `Property Listing Enquiry — Privé Group Real Estate`,
    ``,
    `Property:   ${unit.property}`,
    `Unit No:    ${unit.unitNo}`,
    `Type:       ${unit.type} — ${unit.config}`,
    `District:   ${unit.zone} (Zone ${unit.zoneCode})`,
    `Furnishing: ${unit.furnishing}`,
    `Status:     ${unit.status.replace('_', ' ')}`,
    `Rent:       QAR ${unit.rent.toLocaleString()} / month`,
    ``,
    `─────────────────────────────────────`,
    `Privé Group Real Estate`,
    `Tel / WhatsApp: +974 7707 5959`,
    `Email: admin@privegroupre.com`,
    `Brokerage Licence No 773 | CR No 187753`,
  ].join('\n');
}
