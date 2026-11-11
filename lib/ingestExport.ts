// Export serializers for the AXIOM Ingest Queue (PDF / XLS / XLSX).
// All three read the same column matrix so formats never drift apart. Heavy libs are loaded on demand.

export type ExportRecord = {
  id: string;
  run_id: string;
  payload: Record<string, unknown>;
  source_file: string | null;
  approved_at: string | null;
};

type Col = { label: string; width: number; get: (r: ExportRecord) => string | number };

const BOOL_FIELDS = new Set([
  'parking', 'agency_fee_applicable', 'month_free_applicable', 'pro_rata_applicable', 'kahramaa_applicable',
  'water_electricity_limit_applicable', 'qatar_cool_applicable', 'marafeq_applicable',
]);

function fmt(key: string, v: unknown): string | number {
  if (v === null || v === undefined || v === '') return '';
  if (BOOL_FIELDS.has(key)) {
    const s = String(v).toLowerCase();
    return v === true || ['yes', 'true', '1', 'y'].includes(s) ? 'Yes' : 'No';
  }
  if (Array.isArray(v)) return v.join('; ');
  if (typeof v === 'number') return v;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

const p = (key: string, label: string, width: number): Col => ({
  label, width, get: (r) => fmt(key, r.payload[key]),
});

// Column 0 is the stacked code cell (16-digit Master Code above 14-digit Smart Code).
export const COLUMNS: Col[] = [
  { label: 'Master Code / Smart Code', width: 20, get: (r) => `${fmt('master_code', r.payload.master_code)}\n${fmt('smart_code', r.payload.smart_code)}` },
  p('master_code', 'Master Code (16)', 20),
  p('smart_code', 'Smart Code (14)', 16),
  p('realtor_name', 'Realtor', 26),
  p('realtor_moci', 'Realtor MoCI', 14),
  p('property', 'Property', 26),
  p('unit_no', 'Unit No', 9),
  p('zone_code', 'Zone Code', 9),
  p('zone', 'Zone / District', 28),
  p('type', 'Type', 12),
  p('config', 'Config', 9),
  p('bathrooms', 'Bath', 6),
  p('parking', 'Parking', 8),
  p('kitchen', 'Kitchen', 9),
  p('furnishing', 'Furnishing', 15),
  p('status', 'Status', 12),
  p('listing_type', 'Listing Type', 11),
  p('rent', 'Rent (QAR/mo)', 13),
  p('service_charges', 'Service Charges', 12),
  p('deposit_amount', 'Deposit', 10),
  p('agency_fee', 'Agency Fee', 10),
  p('water_electricity', 'Water & Electricity', 14),
  p('kahramaa_applicable', 'Kahramaa', 9),
  p('kahramaa_amount', 'Kahramaa Amt', 11),
  p('water_electricity_limit_applicable', 'W&E Limit', 9),
  p('water_electricity_limit_amount', 'W&E Limit Amt', 11),
  p('qatar_cool_applicable', 'Qatar Cool', 9),
  p('qatar_cool_amount', 'Qatar Cool Amt', 11),
  p('marafeq_applicable', 'Marafeq', 9),
  p('marafeq_amount', 'Marafeq Amt', 11),
  p('month_free_applicable', 'Month Free', 9),
  p('month_free_days', 'Month Free (count)', 11),
  p('pro_rata_applicable', 'Pro-rata', 8),
  p('legal_duration', 'Lease Term', 11),
  p('floor', 'Floor', 7),
  p('size_sqm', 'Size (sqm)', 9),
  p('view', 'View', 14),
  p('amenities', 'Amenities', 24),
  p('contact_details', 'Contact', 22),
  p('operator_remarks', 'Operator Remarks', 48),
  p('maintenance_notes', 'Maintenance Notes', 22),
  p('agency_fee_applicable', 'Agency Fee Applicable', 11),
  p('agency_fee_amount', 'Agency Fee Amount', 12),
  p('agency_fee_paid_by', 'Agency Fee Paid By', 18),
  p('zone_source', 'Source Zone', 20),
  p('notes', 'Notes', 40),
  p('location_map_url', 'Map URL', 30),
  p('media_url', 'Media URL', 30),
  { label: 'Run ID', width: 12, get: (r) => r.run_id.slice(0, 8) },
  { label: 'Source File', width: 26, get: (r) => r.source_file ?? '' },
  { label: 'Approved At', width: 18, get: (r) => (r.approved_at ? r.approved_at.slice(0, 16).replace('T', ' ') : '') },
];

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})(\d{4})$/, '$1-$2');
const fileName = (ext: string) => `axiom-queue-${stamp()}.${ext}`;

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportQueueXlsx(records: ExportRecord[]) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('AXIOM Queue', { views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }] });
  ws.columns = COLUMNS.map((c) => ({ header: c.label, width: c.width }));

  const head = ws.getRow(1);
  head.font = { bold: true, name: 'Arial', size: 10, color: { argb: 'FFFFFFFF' } };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
  head.alignment = { vertical: 'middle', wrapText: true };

  for (const rec of records) {
    const row = ws.addRow(COLUMNS.map((c) => c.get(rec)));
    row.alignment = { vertical: 'middle', wrapText: false };
    const master = String(rec.payload.master_code ?? '');
    const smart = String(rec.payload.smart_code ?? '');
    const code = row.getCell(1);
    code.value = {
      richText: [
        { text: master, font: { name: 'Consolas', size: 9, bold: true, color: { argb: 'FF2563EB' } } },
        { text: `\n${smart}`, font: { name: 'Consolas', size: 9, bold: true, color: { argb: 'FF15803D' } } },
      ],
    };
    code.alignment = { vertical: 'middle', wrapText: true };
    code.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
    row.height = 30;
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };

  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName('xlsx'));
}

export async function exportQueueXls(records: ExportRecord[]) {
  const XLSX = await import('xlsx');
  const aoa = [COLUMNS.map((c) => c.label), ...records.map((r) => COLUMNS.map((c) => c.get(r)))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = COLUMNS.map((c) => ({ wch: c.width }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'AXIOM Queue');
  const out = XLSX.write(wb, { bookType: 'biff8', type: 'array' });
  download(new Blob([out], { type: 'application/vnd.ms-excel' }), fileName('xls'));
}

export async function exportQueuePdf(records: ExportRecord[]) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3' });
  const generated = new Date().toLocaleString('en-GB');

  doc.setFontSize(13);
  doc.text('AXIOM Ingest Queue — records awaiting import into REIMS', 28, 30);
  doc.setFontSize(8);
  doc.setTextColor(110);
  doc.text(`${records.length} records · generated ${generated}`, 28, 44);

  // Stacked codes are drawn manually (blue mono over green); other columns are plain text.
  autoTable(doc, {
    startY: 54,
    head: [COLUMNS.slice(0, 1).concat(COLUMNS.slice(3)).map((c) => c.label)],
    body: records.map((r) => [' ', ...COLUMNS.slice(3).map((c) => c.get(r))]),
    styles: { fontSize: 6.5, cellPadding: 3, overflow: 'linebreak', valign: 'middle' },
    headStyles: { fillColor: [31, 41, 55], textColor: 255, fontSize: 6.5 },
    columnStyles: { 0: { cellWidth: 92, minCellHeight: 22 } },
    horizontalPageBreak: true,
    horizontalPageBreakRepeat: 0,
    margin: { left: 28, right: 28, top: 28, bottom: 28 },
    didDrawCell: (d) => {
      if (d.section !== 'body' || d.column.index !== 0) return;
      const rec = records[d.row.index];
      const x = d.cell.x + 3;
      doc.setFont('courier', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(37, 99, 235);
      doc.text(String(rec.payload.master_code ?? ''), x, d.cell.y + 9);
      doc.setTextColor(21, 128, 61);
      doc.text(String(rec.payload.smart_code ?? ''), x, d.cell.y + 18);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);
    },
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(`Page ${i} / ${pages}`, doc.internal.pageSize.getWidth() - 70, doc.internal.pageSize.getHeight() - 14);
  }
  download(doc.output('blob'), fileName('pdf'));
}
