'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Privé Group Vanguard REOS — Unit PDF Report
// Route: /report/[unitUuid]  →  opens in new tab, renders A4 report
//
// All styles live in buildCSS() — zero Tailwind, zero external CSS files.
// Dynamic @page margin boxes carry the generation timestamp via template literal.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import type { NCard, NGuide } from '../../../components/NeighborhoodGuide';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReportData {
  propertyName:        string;
  unitCode:            string;
  zoneName:            string;
  zoneCode:            string;
  type:                string;
  config:              string;
  furnishing:          string;
  bathrooms:           string;
  parking:             string;
  kitchen:             string;
  status:              string;
  bookingValidity:     string;
  amenities:           string[];
  monthlyRent:         number;
  contractCharges:     number;  // agency_fee column — "Contract Charges" in modal
  additionalCharges:   number;  // service_charges column — "Additional Charges" in modal
  securityDeposit:     number;  // deposit_amount or 1× rent
  electricityWater:    string;
  agencyFeeApplicable:   boolean; // from unit_commissions
  agencyFeeAmount:       number;
  agencyFeePaidBy:       string;
  kahramaaApplicable:    boolean;
  kahramaaAmount:        number;
  qatarCoolApplicable:   boolean;
  qatarCoolAmount:       number;
  marafeqApplicable:     boolean;
  marafeqAmount:         number;
  locationMapUrl:      string;
  mediaUrl:            string;
  images:              string[];
  operatorRemarks:     string;
  salutation:          string;
}

// ── Supabase ──────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (!n || isNaN(n)) return '—';
  return n.toLocaleString('en-US');
}

function parseArray(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return (raw as unknown[]).filter(Boolean).map(String);
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.filter(Boolean).map(String) : [];
    } catch {
      return raw.split(/[,·•|]/).map(s => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function formatDateTime(d: Date): string {
  const day   = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-GB', { month: 'long' });
  const yr    = d.getFullYear();
  const hh    = String(d.getHours()).padStart(2, '0');
  const mm    = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${yr} at ${hh}:${mm}`;
}

function statusCls(s: string): string {
  const l = (s || '').toLowerCase();
  if (l.includes('reserved'))                          return 'rpt-badge-status rpt-s-reserved';
  if (l.includes('available'))                         return 'rpt-badge-status rpt-s-available';
  if (l.includes('occupied') || l.includes('rented') || l.includes('leased')) return 'rpt-badge-status rpt-s-occupied';
  return 'rpt-badge-status rpt-s-default';
}

// ── CSS ───────────────────────────────────────────────────────────────────────
// Single source of truth — injected as a <style> tag.
// generatedAt is embedded directly into the @page margin box content string.

function buildCSS(generatedAt: string): string {
  return `
/* ── Reset ──────────────────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
  font-size: 10pt;
  color: #1a1a1a;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* ── Screen: A4 preview card ─────────────────────────────────────────────────── */
@media screen {
  body { background: #bfc4cc !important; padding: 24px 0 48px; }

  .rpt-toolbar {
    width: 210mm; margin: 0 auto 10px; padding: 0 2px;
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
  }
  .rpt-toolbar-label {
    font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.6);
    text-transform: uppercase; letter-spacing: 0.08em; white-space: nowrap;
  }
  .rpt-toolbar-greeting {
    display: flex; align-items: center; gap: 6px; flex: 1;
  }
  .rpt-toolbar-greeting label {
    font-size: 9px; font-weight: 700; color: rgba(255,255,255,0.5);
    text-transform: uppercase; letter-spacing: 0.08em; white-space: nowrap;
  }
  .rpt-toolbar-greeting input {
    flex: 1; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18);
    border-radius: 4px; color: #fff; font-size: 11px; padding: 5px 10px;
    outline: none;
  }
  .rpt-toolbar-greeting input::placeholder { color: rgba(255,255,255,0.35); }
  .rpt-toolbar-greeting input:focus { border-color: #c9a84c; background: rgba(255,255,255,0.12); }
  .rpt-toolbar-btns { display: flex; gap: 8px; }

  .rpt-btn-print {
    background: #c9a84c; color: #0f0f0f; border: none;
    padding: 7px 20px; font-size: 11px; font-weight: 700;
    border-radius: 5px; cursor: pointer; letter-spacing: 0.05em;
  }
  .rpt-btn-print:hover { background: #dfc070; }
  .rpt-btn-close {
    background: rgba(255,255,255,0.12); color: #fff;
    border: 1px solid rgba(255,255,255,0.22);
    padding: 7px 14px; font-size: 11px; font-weight: 600;
    border-radius: 5px; cursor: pointer;
  }
  .rpt-btn-close:hover { background: rgba(255,255,255,0.22); }

  .rpt-page {
    width: 210mm; min-height: 297mm; margin: 0 auto;
    background: #ffffff;
    box-shadow: 0 8px 40px rgba(0,0,0,0.30);
    padding: 18mm 16mm 22mm;
  }
}

/* ── Print ───────────────────────────────────────────────────────────────────── */
@media print {
  .rpt-toolbar { display: none !important; }
  body { background: #ffffff !important; }
  .rpt-page { padding: 0; box-shadow: none; }
}

/* ── A4 paged-media with @bottom margin boxes ────────────────────────────────── */
@page {
  size: A4 portrait;
  margin: 16mm 14mm 26mm 14mm;

  @bottom-left {
    content: "Generated: ${generatedAt}";
    font-family: Arial, sans-serif;
    font-size: 7.5pt;
    color: #64748b;
  }
  @bottom-center {
    content: "Page " counter(page) " / " counter(pages);
    font-family: Arial, sans-serif;
    font-size: 7.5pt;
    color: #64748b;
  }
  @bottom-right {
    content: "Privé Group Real Estate  ·  privegroupre.com  ·  Confidential";
    font-family: Arial, sans-serif;
    font-size: 7.5pt;
    font-weight: bold;
    color: #1a1a1a;
  }
}

/* ── 1. Brand header ─────────────────────────────────────────────────────────── */
.rpt-brand-tbl  { width: 100%; border-collapse: collapse; margin-bottom: 8pt; }
.rpt-brand-name { font-size: 16pt; font-weight: 700; color: #0f172a; margin-bottom: 4pt; line-height: 1.15; }
.rpt-brand-addr { font-size: 9pt; color: #64748b; line-height: 1.55; margin-bottom: 2pt; }
.rpt-brand-lic  { font-size: 9pt; color: #64748b; font-style: italic; line-height: 1.4; }
.rpt-logo-img   { height: 68px; width: auto; display: block; margin-left: auto; }

/* ── Dividers ────────────────────────────────────────────────────────────────── */
.rpt-hr-gold  { border: none; border-top: 2px solid #c9a84c; margin: 7pt 0 9pt; }
.rpt-hr-light { border: none; border-top: 1px solid #e2e8f0; margin: 9pt 0 8pt; }

/* ── 2. Asset identification banner ──────────────────────────────────────────── */
.rpt-asset-title {
  font-size: 13pt; font-weight: 700; color: #c9a84c;
  letter-spacing: 0.015em; line-height: 1.35;
}
.rpt-salutation {
  font-size: 10.5pt; font-weight: 500; color: #334155;
  margin-top: 5pt; margin-bottom: 2pt; line-height: 1.5;
  font-style: italic;
}

/* ── Section label ───────────────────────────────────────────────────────────── */
.rpt-sec-lbl {
  font-size: 7pt; font-weight: 700; color: #64748b;
  text-transform: uppercase; letter-spacing: 0.18em;
  margin-top: 10pt; margin-bottom: 5pt;
}

/* ── 3. Property & unit details grid ─────────────────────────────────────────── */
.rpt-det-tbl { width: 100%; border-collapse: collapse; }
.rpt-det-tbl th {
  font-size: 7pt; font-weight: 700; color: #64748b;
  text-transform: uppercase; letter-spacing: 0.12em;
  text-align: left; vertical-align: top;
  padding: 5pt 8pt 4pt 0;
  border-bottom: 1px solid #e2e8f0;
  width: 17%; white-space: nowrap;
}
.rpt-det-tbl td {
  font-size: 9.5pt; font-weight: 500; color: #1a1a1a;
  vertical-align: top;
  padding: 5pt 8pt 4pt 0;
  border-bottom: 1px solid #e2e8f0;
  width: 33%;
}

/* ── Status badge ────────────────────────────────────────────────────────────── */
.rpt-badge-status {
  display: inline-block; padding: 1.5pt 7pt;
  border-radius: 10pt; font-size: 8.5pt; font-weight: 600;
}
.rpt-s-reserved  { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
.rpt-s-available { background: #dcfce7; color: #14532d; border: 1px solid #86efac; }
.rpt-s-occupied  { background: #dbeafe; color: #1e3a8a; border: 1px solid #93c5fd; }
.rpt-s-default   { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }

/* ── 4. Amenity badges ───────────────────────────────────────────────────────── */
.rpt-amenities-wrap { display: flex; flex-wrap: wrap; gap: 4pt 5pt; margin-bottom: 2pt; }
.rpt-amenity-badge {
  font-size: 8.5pt; color: #1e293b; font-weight: 500;
  background: #f1f5f9; border: 1px solid #cbd5e1;
  border-radius: 3pt; padding: 2pt 8pt; white-space: nowrap;
}

/* ── 5. Financial summary panel ──────────────────────────────────────────────── */
.rpt-fin-panel {
  background: #f1f5f9; border: 1px solid #cbd5e1;
  border-radius: 4pt; padding: 9pt 12pt; margin-top: 4pt;
}
.rpt-fin-row {
  display: flex; justify-content: space-between; align-items: baseline;
  padding: 3.5pt 0; border-bottom: 1px solid #dde3ea;
}
.rpt-fin-row:last-child { border-bottom: none; padding-bottom: 0; }
.rpt-fin-lbl    { font-size: 9.5pt; color: #475569; }
.rpt-fin-val    { font-size: 9.5pt; font-weight: 500; color: #1a1a1a; }
.rpt-fin-total  {
  border-top: 1.5px solid #94a3b8 !important;
  border-bottom: none !important;
  padding-top: 6pt !important;
  margin-top: 2pt;
}
.rpt-fin-lbl-tot { font-size: 11pt; font-weight: 800; color: #0f172a; }
.rpt-fin-val-tot { font-size: 12pt; font-weight: 800; color: #0f172a; }

/* ── 6. Location & media anchors ─────────────────────────────────────────────── */
.rpt-links       { margin-top: 4pt; margin-bottom: 5pt; }
.rpt-links p     { font-size: 9.5pt; color: #334155; margin-bottom: 3pt; line-height: 1.5; }
.rpt-links a     { color: #0078D4; text-decoration: underline; font-weight: 500; }
.rpt-link-key    {
  font-size: 7.5pt; font-weight: 700; color: #475569;
  text-transform: uppercase; letter-spacing: 0.1em;
}

/* ── 6b. Image grid (2 rows × 3 cols, 4:3 cells) ────────────────────────────── */
.rpt-img-tbl     { width: 100%; border-collapse: collapse; margin-top: 6pt; margin-bottom: 2pt; }
.rpt-img-tbl td  { width: 33.33%; padding: 2.5pt; vertical-align: top; }
.rpt-img-cell    {
  position: relative; width: 100%;
  padding-bottom: 75%;    /* 4:3 aspect ratio */
  overflow: hidden; border-radius: 2pt;
  border: 1px solid #e2e8f0; background: #f8fafc;
}
.rpt-img-cell img {
  position: absolute; inset: 0;
  width: 100%; height: 100%; object-fit: cover;
}
.rpt-img-ph {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #f0f4f8 0%, #dce3ea 100%);
}
.rpt-img-ph-txt {
  font-size: 7.5pt; font-weight: 600; color: #94a3b8;
  text-transform: uppercase; letter-spacing: 0.08em;
}

/* ── 7. Neighborhood Guide ───────────────────────────────────────────────────── */
.rpt-nbhd-wrap   { display: flex; gap: 8pt; margin-top: 4pt; }
.rpt-nbhd-col    { flex: 1; min-width: 0; }
.rpt-nbhd-pillar {
  font-size: 7pt; font-weight: 700; color: #475569;
  text-transform: uppercase; letter-spacing: 0.13em;
  border-bottom: 1px solid #e2e8f0; padding-bottom: 3pt; margin-bottom: 5pt;
}
.rpt-nbhd-pillar-life  { color: #92400e; border-color: #c9a84c44; }
.rpt-nbhd-pillar-parks { color: #14532d; border-color: #86efac44; }
.rpt-nbhd-pillar-comm  { color: #1e3a8a; border-color: #93c5fd44; }
.rpt-nbhd-card {
  padding: 4pt 0; border-bottom: 1px solid #f1f5f9;
}
.rpt-nbhd-card:last-child { border-bottom: none; }
.rpt-nbhd-name  { font-size: 9pt; font-weight: 600; color: #0f172a; line-height: 1.3; }
.rpt-nbhd-sub   {
  display: inline-block; font-size: 7pt; font-weight: 600; color: #64748b;
  background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 2pt;
  padding: 1pt 4pt; margin-top: 1pt;
}
.rpt-nbhd-meta  { font-size: 8.5pt; color: #64748b; margin-top: 1.5pt; line-height: 1.4; }
.rpt-nbhd-notes { font-size: 8pt; color: #94a3b8; margin-top: 1pt; font-style: italic; }
.rpt-nbhd-empty { font-size: 8.5pt; color: #cbd5e1; font-style: italic; }

/* ── 8. Contact & operations ─────────────────────────────────────────────────── */
.rpt-admin-hub {
  font-size: 9.5pt; color: #334155; line-height: 1.75;
  margin-bottom: 8pt;
}
.rpt-admin-hub strong { color: #0f172a; }
.rpt-admin-hub a { color: #0078D4; text-decoration: none; }

/* ── Operator remarks callout card ──────────────────────────────────────────── */
.rpt-remarks {
  border-left: 3px solid #c9a84c;
  padding: 7pt 10pt 8pt;
  background: #fffbf0;
  border-radius: 0 3pt 3pt 0;
}
.rpt-remarks-lbl {
  font-size: 6.5pt; font-weight: 700; color: #92400e;
  text-transform: uppercase; letter-spacing: 0.16em;
  margin-bottom: 4pt;
}
.rpt-remarks-txt { font-size: 9.5pt; color: #1a1a1a; line-height: 1.65; }
`;
}

// ── Report document ───────────────────────────────────────────────────────────

function ReportDocument({ data, neighborhood }: { data: ReportData; neighborhood: NGuide | null }) {
  const secDep = data.securityDeposit || data.monthlyRent;
  const utilityTotal = (data.kahramaaApplicable  ? (data.kahramaaAmount  || 0) : 0)
                     + (data.qatarCoolApplicable  ? (data.qatarCoolAmount || 0) : 0)
                     + (data.marafeqApplicable     ? (data.marafeqAmount   || 0) : 0);
  const total = (data.monthlyRent || 0) + secDep + (data.contractCharges || 0) + (data.additionalCharges || 0) + utilityTotal;

  // Always render exactly 6 image cells
  const slots: (string | null)[] = data.images.slice(0, 6) as (string | null)[];
  while (slots.length < 6) slots.push(null);
  const rows = [slots.slice(0, 3), slots.slice(3, 6)];

  return (
    <div className="rpt-page">

      {/* ── 1. Brand Header Block ──────────────────────────────────────── */}
      <table className="rpt-brand-tbl">
        <tbody>
          <tr>
            <td style={{ verticalAlign: 'top', width: '62%' }}>
              <p className="rpt-brand-name">Privé Group Real Estate Qatar</p>
              <p className="rpt-brand-addr">
                Old Salata area, Office 902, Building No 08, GITCO Tower,<br />
                Emrair St, Doha&#8209;Qatar
              </p>
              <p className="rpt-brand-lic">Brokerage Licence No 773 | CR No 187753</p>
            </td>
            <td style={{ verticalAlign: 'top', textAlign: 'right', width: '38%' }}>
              <img
                src="/brand/logo-print.png"
                alt="Privé Group Real Estate"
                className="rpt-logo-img"
              />
            </td>
          </tr>
        </tbody>
      </table>
      <hr className="rpt-hr-gold" />

      {/* ── 2. Asset Identification Banner ────────────────────────────── */}
      <h1 className="rpt-asset-title">
        {data.propertyName}&nbsp;&bull;&nbsp;CODE:&nbsp;{data.unitCode}&nbsp;|&nbsp;Zone:&nbsp;{data.zoneCode}.&nbsp;{data.zoneName}
      </h1>
      {data.salutation && (
        <p className="rpt-salutation">{data.salutation}</p>
      )}
      <hr className="rpt-hr-light" />

      {/* ── 3. Property & Unit Details ────────────────────────────────── */}
      <p className="rpt-sec-lbl" style={{ marginTop: 0 }}>Property &amp; Unit Details</p>
      <table className="rpt-det-tbl">
        <tbody>
          <tr>
            <th>Type</th>
            <td colSpan={3}>{data.type}</td>
          </tr>
          <tr>
            <th>Configuration</th>
            <td>{data.config}</td>
            <th>Furnishing</th>
            <td>{data.furnishing}</td>
          </tr>
          <tr>
            <th>Status</th>
            <td>
              <span className={statusCls(data.status)}>{data.status}</span>
            </td>
            <th>Bathrooms</th>
            <td>{data.bathrooms || '—'}</td>
          </tr>
          <tr>
            <th>Kitchen</th>
            <td>{data.kitchen}</td>
            <th>Parking</th>
            <td>{data.parking}</td>
          </tr>
          {data.bookingValidity && (
            <tr>
              <th>Booking Validity</th>
              <td colSpan={3}>{data.bookingValidity}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ── 4. Amenities ──────────────────────────────────────────────── */}
      {data.amenities.length > 0 && (
        <>
          <p className="rpt-sec-lbl">Amenities</p>
          <div className="rpt-amenities-wrap">
            {data.amenities.map((a, i) => (
              <span key={i} className="rpt-amenity-badge">{a}</span>
            ))}
          </div>
        </>
      )}

      {/* ── 5. Financial Summary Panel ────────────────────────────────── */}
      <p className="rpt-sec-lbl">Move-In Payment Summary</p>
      <div className="rpt-fin-panel">
        {data.monthlyRent > 0 && (
          <div className="rpt-fin-row">
            <span className="rpt-fin-lbl">Monthly Rent</span>
            <span className="rpt-fin-val">QAR {fmt(data.monthlyRent)}</span>
          </div>
        )}
        {secDep > 0 && (
          <div className="rpt-fin-row">
            <span className="rpt-fin-lbl">Security Deposit <span style={{ fontSize: '8pt', color: '#16a34a' }}>(Refundable)*</span></span>
            <span className="rpt-fin-val">QAR {fmt(secDep)}</span>
          </div>
        )}
        {data.contractCharges > 0 && (
          <div className="rpt-fin-row">
            <span className="rpt-fin-lbl">Contract Charges</span>
            <span className="rpt-fin-val">QAR {fmt(data.contractCharges)}</span>
          </div>
        )}
        {data.additionalCharges > 0 && (
          <div className="rpt-fin-row">
            <span className="rpt-fin-lbl">Additional Charges</span>
            <span className="rpt-fin-val">QAR {fmt(data.additionalCharges)}</span>
          </div>
        )}
        {data.electricityWater && (
          <div className="rpt-fin-row">
            <span className="rpt-fin-lbl">Electricity &amp; Water</span>
            <span className="rpt-fin-val">{data.electricityWater}</span>
          </div>
        )}
        {data.agencyFeeApplicable && data.agencyFeeAmount > 0 && (
          <div className="rpt-fin-row">
            <span className="rpt-fin-lbl">
              Agency Commission
              {data.agencyFeePaidBy && (
                <span style={{ fontSize: '8pt', color: '#64748b' }}> — Paid by: {data.agencyFeePaidBy}</span>
              )}
            </span>
            <span className="rpt-fin-val">QAR {fmt(data.agencyFeeAmount)}</span>
          </div>
        )}
        <div className="rpt-fin-row">
          <span className="rpt-fin-lbl" style={{ fontWeight: 700, color: '#334155' }}>Kahramaa Deposit <span style={{ fontSize: '8pt', color: '#16a34a' }}>(Refundable)*</span></span>
          <span className="rpt-fin-val">{data.kahramaaApplicable ? `QAR ${fmt(data.kahramaaAmount)}` : 'Included'}</span>
        </div>
        <div className="rpt-fin-row">
          <span className="rpt-fin-lbl" style={{ fontWeight: 700, color: '#334155' }}>Qatar Cool Deposit <span style={{ fontSize: '8pt', color: '#16a34a' }}>(Refundable)*</span></span>
          <span className="rpt-fin-val">{data.qatarCoolApplicable ? `QAR ${fmt(data.qatarCoolAmount)}` : 'Not Applicable'}</span>
        </div>
        <div className="rpt-fin-row">
          <span className="rpt-fin-lbl" style={{ fontWeight: 700, color: '#334155' }}>Marafeq Deposit <span style={{ fontSize: '8pt', color: '#16a34a' }}>(Refundable)*</span></span>
          <span className="rpt-fin-val">{data.marafeqApplicable ? `QAR ${fmt(data.marafeqAmount)}` : 'Not Applicable'}</span>
        </div>
        <div className="rpt-fin-row rpt-fin-total">
          <span className="rpt-fin-lbl-tot">Total Move-In Payment</span>
          <span className="rpt-fin-val-tot">QAR {fmt(total)}</span>
        </div>
      </div>
      <p style={{ fontSize: '7.5pt', color: '#94a3b8', marginTop: '4px', marginBottom: '0' }}>* T&amp;C apply.</p>

      {/* ── 6. Location & Media Anchors ───────────────────────────────── */}
      <p className="rpt-sec-lbl">Location &amp; Media</p>
      <div className="rpt-links">
        {data.locationMapUrl ? (
          <p>
            <span className="rpt-link-key">Location: </span>
            <a href={data.locationMapUrl} target="_blank" rel="noreferrer">
              Click Here to View Map Location
            </a>
          </p>
        ) : (
          <p><span className="rpt-link-key">Location: </span>Not provided</p>
        )}
        {data.mediaUrl ? (
          <p>
            <span className="rpt-link-key">Media Archive: </span>
            <a href={data.mediaUrl} target="_blank" rel="noreferrer">
              Click Here to View Cloud Storage Drive
            </a>
          </p>
        ) : (
          <p><span className="rpt-link-key">Media Archive: </span>Not provided</p>
        )}
      </div>

      {/* 2 rows × 3 columns — each cell locked to 33.33% width, 4:3 aspect ratio */}
      <table className="rpt-img-tbl">
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((src, ci) => (
                <td key={ci} style={{ width: '33.33%' }}>
                  <div className="rpt-img-cell">
                    {src ? (
                      <img
                        src={src}
                        alt={`Property photo ${ri * 3 + ci + 1}`}
                        loading="eager"
                      />
                    ) : (
                      <div className="rpt-img-ph">
                        <span className="rpt-img-ph-txt">Photo {ri * 3 + ci + 1}</span>
                      </div>
                    )}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── 7. Neighborhood Guide ────────────────────────────────────── */}
      {neighborhood && (neighborhood.lifestyle.length > 0 || neighborhood.parks.length > 0 || neighborhood.commute.length > 0) && (() => {
        const renderPillarCards = (cards: NCard[]) => cards.length === 0
          ? <p className="rpt-nbhd-empty">Not available</p>
          : cards.map(c => (
            <div key={c.id} className="rpt-nbhd-card">
              <p className="rpt-nbhd-name">{c.name}</p>
              <span className="rpt-nbhd-sub">{c.subcategory}</span>
              <p className="rpt-nbhd-meta">
                {c.distance && `📍 ${c.distance}`}
                {c.distance && c.rating != null ? '  ·  ' : ''}
                {c.rating != null && `★ ${c.rating.toFixed(1)}`}
              </p>
              {c.notes && <p className="rpt-nbhd-notes">{c.notes}</p>}
            </div>
          ));
        return (
          <>
            <p className="rpt-sec-lbl">Neighborhood Guide</p>
            <div className="rpt-nbhd-wrap">
              <div className="rpt-nbhd-col">
                <p className="rpt-nbhd-pillar rpt-nbhd-pillar-life">Lifestyle &amp; Family</p>
                {renderPillarCards(neighborhood.lifestyle)}
              </div>
              <div className="rpt-nbhd-col">
                <p className="rpt-nbhd-pillar rpt-nbhd-pillar-parks">Parks &amp; Outdoors</p>
                {renderPillarCards(neighborhood.parks)}
              </div>
              <div className="rpt-nbhd-col">
                <p className="rpt-nbhd-pillar rpt-nbhd-pillar-comm">Logistics &amp; Commute</p>
                {renderPillarCards(neighborhood.commute)}
              </div>
            </div>
          </>
        );
      })()}

      {/* ── 8. Contact & Operations Routing ──────────────────────────── */}
      <p className="rpt-sec-lbl">Contact &amp; Operations</p>
      <p className="rpt-admin-hub">
        Call or WhatsApp Administration Hub on&nbsp;
        <strong>
          <a href="tel:+97477075959">+974 7707 5959</a>
        </strong>
        &nbsp;or email&nbsp;
        <strong>
          <a href="mailto:admin@privegroupre.com">admin@privegroupre.com</a>
        </strong>
      </p>

      <div className="rpt-remarks">
        <p className="rpt-remarks-lbl">Operator Remarks / Status Updates</p>
        <p className="rpt-remarks-txt">
          {data.operatorRemarks || 'No Comments'}
        </p>
      </div>

    </div>
  );
}

// ── Page shell (data-fetching + toolbar) ──────────────────────────────────────

export default function ReportPage() {
  const params    = useParams();
  const unitUuid  = params?.unitUuid as string;

  const [data,         setData        ] = useState<ReportData | null>(null);
  const [neighborhood, setNeighborhood] = useState<NGuide | null>(null);
  const [loading,      setLoading     ] = useState(true);
  const [error,        setError       ] = useState<string | null>(null);
  const [salutation,   setSalutation  ] = useState('');
  const [generatedAt]                   = useState(() => formatDateTime(new Date()));

  useEffect(() => {
    if (!unitUuid) return;
    (async () => {
      const [unitRes, commRes] = await Promise.all([
        supabase.from('units').select('*').eq('id', unitUuid).single(),
        supabase.from('unit_commissions')
          .select('agency_fee_applicable, agency_fee_amount, paid_by')
          .eq('unit_id', unitUuid)
          .single(),
      ]);

      const { data: row, error: err } = unitRes;
      const { data: commRow } = commRes; // may be null if no commission record

      if (err || !row) {
        setError(err?.message ?? 'Unit not found');
      } else {
        const rent = Number(row.rent) || 0;
        setData({
          propertyName:        row.property          ?? '—',
          unitCode:            row.unit_no           ?? row.unit_code ?? '—',
          zoneName:            row.zone              ?? '—',
          zoneCode:            String(row.zone_code  ?? '—'),
          type:                row.type              ?? '—',
          config:              row.config            ?? '—',
          furnishing:          row.furnishing        ?? '—',
          bathrooms:           String(row.bathrooms  ?? '—'),
          parking:             row.parking           ?? '—',
          kitchen:             row.kitchen           ?? '—',
          status:              row.status            ?? '—',
          bookingValidity:     row.booking_validity  ?? '',
          amenities:           parseArray(row.amenities),
          monthlyRent:         rent,
          contractCharges:     Number(row.agency_fee)      || 0,
          additionalCharges:   Number(row.service_charges) || 0,
          securityDeposit:     Number(row.deposit_amount)  || rent,
          electricityWater:    row.electricity_water ?? '',
          agencyFeeApplicable:   commRow?.agency_fee_applicable ?? false,
          agencyFeeAmount:       Number(commRow?.agency_fee_amount) || 0,
          agencyFeePaidBy:       commRow?.paid_by ?? '',
          kahramaaApplicable:    row.kahramaa_applicable    ?? true,
          kahramaaAmount:        Number(row.kahramaa_amount)   || 2000,
          qatarCoolApplicable:   row.qatar_cool_applicable  ?? true,
          qatarCoolAmount:       Number(row.qatar_cool_amount)  || 3000,
          marafeqApplicable:     row.marafeq_applicable     ?? true,
          marafeqAmount:         Number(row.marafeq_amount)    || 3000,
          locationMapUrl:        row.location_map_url  ?? '',
          mediaUrl:            row.media_url         ?? '',
          images:              parseArray(row.images),
          operatorRemarks:     row.operator_remarks  ?? '',
          salutation:          '',
        });

        // Fetch neighborhood guide — unit-specific first, zone fallback second
        const zoneCode = row.zone_code ?? 0;
        const nbRes = await fetch(`/api/neighborhood?unitUuid=${encodeURIComponent(unitUuid)}&zoneCode=${zoneCode}`);
        if (nbRes.ok) {
          const { data: nb } = await nbRes.json();
          if (nb) {
            setNeighborhood({ lifestyle: nb.lifestyle_data ?? [], parks: nb.parks_data ?? [], commute: nb.commute_data ?? [] });
          }
        }
      }
      setLoading(false);
    })();
  }, [unitUuid]);

  /* ── Loading / error states ──────────────────────────────────────────────── */

  const centreStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', fontFamily: 'Arial, sans-serif', fontSize: '12pt',
    background: '#bfc4cc',
  };

  if (loading) return <div style={{ ...centreStyle, color: '#64748b' }}>Loading report…</div>;
  if (error || !data) return <div style={{ ...centreStyle, color: '#ef4444' }}>{error ?? 'Failed to load unit data.'}</div>;

  /* ── Report ──────────────────────────────────────────────────────────────── */

  return (
    <>
      {/* Inject full stylesheet (includes @page margin boxes with timestamp) */}
      <style dangerouslySetInnerHTML={{ __html: buildCSS(generatedAt) }} />

      {/* Toolbar — hidden on print via CSS */}
      <div className="rpt-toolbar">
        <span className="rpt-toolbar-label">Unit Report Preview — A4</span>
        <div className="rpt-toolbar-greeting">
          <label htmlFor="rpt-salutation-input">Salutation / Recipient Greeting</label>
          <input
            id="rpt-salutation-input"
            type="text"
            placeholder='e.g. Dear Mr. / Miss / Mrs. / Ms. Al Mansoori'
            value={salutation}
            onChange={e => setSalutation(e.target.value)}
          />
        </div>
        <div className="rpt-toolbar-btns">
          <button className="rpt-btn-close" onClick={() => window.close()}>✕ Close</button>
          <button className="rpt-btn-print" onClick={() => window.print()}>⬇ Download PDF</button>
        </div>
      </div>

      <ReportDocument data={{ ...data, salutation }} neighborhood={neighborhood} />
    </>
  );
}
