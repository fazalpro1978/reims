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

export function generatePublicShareText(unit: UnitListing): string {
  return [
    `Connecting you with property, the Privé way`,
    ``,
    `PROPERTY DETAILS`,
    `  Property         ${unit.property}`,
    `  Unit No          ${unit.unitNo}`,
    `  District / Area  ${unit.zone}`,
    `  Zone Code        Zone ${unit.zoneCode}`,
    ``,
    `CLASSIFICATION`,
    `  Type             ${unit.type}`,
    `  Configuration    ${unit.config}`,
    `  Furnishing       ${unit.furnishing}`,
    `  Kitchen          ${unit.kitchen}`,
    `  Parking          ${unit.parking ? 'Yes' : 'No'}`,
    `  Status           ${unit.status.replace(/_/g, ' ')}`,
    ...(unit.amenities?.length ? [
      ``,
      `AMENITIES`,
      `  ${unit.amenities.join('  ·  ')}`,
    ] : []),
    ``,
    `FINANCIALS`,
    `  Monthly Rent     QAR ${unit.rent.toLocaleString()}`,
    `  Service Charges  QAR ${unit.serviceCharges.toLocaleString()}`,
    `  Deposit          QAR ${unit.depositAmount.toLocaleString()}`,
    ``,
    `SERVICE & UTILITY DEPOSITS`,
    `  Kahramaa Deposit    ${unit.kahramaaApplicable  ? `QAR ${unit.kahramaaAmount.toLocaleString()}`  : 'Included'}`,
    `  Qatar Cool Deposit  ${unit.qatarCoolApplicable ? `QAR ${unit.qatarCoolAmount.toLocaleString()}` : 'Not Applicable'}`,
    `  Marafeq Deposit     ${unit.marafeqApplicable   ? `QAR ${unit.marafeqAmount.toLocaleString()}`   : 'Not Applicable'}`,
    ``,
    ...(unit.locationMapUrl || unit.mediaUrl ? [
      `LINKS`,
      ...(unit.locationMapUrl ? [`  Map    ${unit.locationMapUrl}`] : []),
      ...(unit.mediaUrl       ? [`  Media  ${unit.mediaUrl}`]       : []),
      ``,
    ] : []),
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Privé Group Real Estate`,
    `Tel / WhatsApp: +974 7707 5959  |  admin@privegroupre.com`,
    `Brokerage Licence 773  |  CR 187753`,
  ].join('\n');
}

type FocalData = { name: string; phone: string; email: string; operatorRemarks: string };

export function generateInternalCopyText(unit: UnitListing, focal?: FocalData): string {
  return [
    `⚠ FOR INTERNAL USE ONLY — PRIVÉ GROUP REAL ESTATE ⚠`,
    ``,
    `REALTOR & CONTRACT`,
    `  Unit Code          ${unit.id}`,
    `  Realtor            ${unit.realtorName}`,
    `  MOCI License       ${unit.realtorMOCI}`,
    `  MOCI Contract No   ${unit.mociContractNumber || 'N/A'}`,
    `  Contract Status    ${unit.mociContractStatus}`,
    `  Legal Duration     ${unit.legalDuration || 'N/A'}`,
    `  Contract Start     ${unit.contractStartDate || 'N/A'}`,
    `  Contract End       ${unit.contractEndDate || 'N/A'}`,
    ``,
    `IDENTIFICATION`,
    `  Property           ${unit.property}`,
    `  Unit No            ${unit.unitNo}`,
    `  District / Area    ${unit.zone}`,
    `  Zone Code          Zone ${unit.zoneCode}`,
    ``,
    `CLASSIFICATION`,
    `  Type               ${unit.type}`,
    `  Configuration      ${unit.config}`,
    `  Furnishing         ${unit.furnishing}`,
    `  Kitchen            ${unit.kitchen}`,
    `  Parking            ${unit.parking ? 'Yes' : 'No'}`,
    `  Status             ${unit.status.replace(/_/g, ' ')}`,
    ...(unit.amenities?.length ? [
      ``,
      `AMENITIES`,
      `  ${unit.amenities.join('  ·  ')}`,
    ] : []),
    ``,
    `FINANCIALS`,
    `  Monthly Rent       QAR ${unit.rent.toLocaleString()}`,
    `  Service Charges    QAR ${unit.serviceCharges.toLocaleString()}`,
    `  Deposit            QAR ${unit.depositAmount.toLocaleString()}`,
    `  Agency Fee         QAR ${unit.agencyFee.toLocaleString()}`,
    ``,
    `SERVICE & UTILITY DEPOSITS`,
    `  Kahramaa Deposit    ${unit.kahramaaApplicable  ? `QAR ${unit.kahramaaAmount.toLocaleString()}`  : 'Included'}`,
    `  Qatar Cool Deposit  ${unit.qatarCoolApplicable ? `QAR ${unit.qatarCoolAmount.toLocaleString()}` : 'Not Applicable'}`,
    `  Marafeq Deposit     ${unit.marafeqApplicable   ? `QAR ${unit.marafeqAmount.toLocaleString()}`   : 'Not Applicable'}`,
    ``,
    `PROPERTY FOCAL POINT`,
    `  Contact Name       ${focal?.name  || 'N/A'}`,
    `  Contact Phone      ${focal?.phone || 'N/A'}`,
    `  Contact Email      ${focal?.email || 'N/A'}`,
    ``,
    `ACCESS & SECURITY`,
    `  Access / Lockbox   ${unit.accessLockbox || 'N/A'}`,
    ``,
    `OPERATOR REMARKS`,
    `  ${focal?.operatorRemarks || unit.maintenanceNotes || 'None recorded'}`,
    ``,
    ...(unit.locationMapUrl || unit.mediaUrl ? [
      `LINKS`,
      ...(unit.locationMapUrl ? [`  Map    ${unit.locationMapUrl}`] : []),
      ...(unit.mediaUrl       ? [`  Media  ${unit.mediaUrl}`]       : []),
      ``,
    ] : []),
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Privé Group Real Estate — CONFIDENTIAL`,
    `Tel / WhatsApp: +974 7707 5959  |  admin@privegroupre.com`,
    `Brokerage Licence 773  |  CR 187753`,
  ].join('\n');
}

export function generateAgentShareText(unit: UnitListing): string {
  return [
    `⚠ FOR AGENT USE ONLY — PRIVÉ GROUP REAL ESTATE ⚠`,
    `Unit Code         ${unit.id}`,
    `Contract Status   ${unit.mociContractStatus ?? 'null'}`,
    ``,
    `IDENTIFICATION`,
    `  Property          ${unit.property}`,
    `  Unit No           ${unit.unitNo}`,
    `  District / Area   ${unit.zone}`,
    `  Zone Code         Zone ${unit.zoneCode}`,
    ``,
    `CLASSIFICATION`,
    `  Type              ${unit.type}`,
    `  Configuration     ${unit.config}`,
    `  Furnishing        ${unit.furnishing}`,
    `  Kitchen           ${unit.kitchen}`,
    `  Parking           ${unit.parking ? 'Yes' : 'No'}`,
    `  Status            ${unit.status.replace(/_/g, ' ')}`,
    ``,
    `FINANCIALS`,
    `  Monthly Rent      QAR ${unit.rent.toLocaleString()}`,
    `  Service Charges   QAR ${unit.serviceCharges.toLocaleString()}`,
    `  Deposit           QAR ${unit.depositAmount.toLocaleString()}`,
    `  Agency Fee        QAR ${unit.agencyFee.toLocaleString()}`,
    ``,
    `SERVICE & UTILITY DEPOSITS`,
    `  Kahramaa Deposit   QAR ${unit.kahramaaAmount.toLocaleString()}`,
    `  Qatar Cool Deposit QAR ${unit.qatarCoolAmount.toLocaleString()}`,
    `  Marafeq Deposit    QAR ${unit.marafeqAmount.toLocaleString()}`,
    ...(unit.mediaUrl ? [
      ``,
      `LINKS`,
      `  Media             ${unit.mediaUrl}`,
    ] : []),
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Privé Group Real Estate — CONFIDENTIAL`,
    `Tel / WhatsApp: +974 7707 5959 | admin@privegroupre.com`,
    `Brokerage Licence 773 | CR 187753`,
  ].join('\n');
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
