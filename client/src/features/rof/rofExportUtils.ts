import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface RofSummaryRow {
  businessDate: string;
  locationName: string;
  netSalesVat: number;
  vat: number;
  netSales: number;
  gcSales: number;
  cash: number;
  nonCash: number;
  variance: number;
  cashRemarks: string;
  nonCashRemarks: string;
}

export interface RofSummaryTotals {
  netSalesVat: number;
  vat: number;
  netSales: number;
  gcSales: number;
  cash: number;
  nonCash: number;
  variance: number;
}

export interface RofCashRow {
  cashierName: string;
  tenderName: string;
  posAmount: number;
  actualAmount: number;
  mod: string;
  remarks: string;
}

export interface RofNonCashRow {
  tenderName: string;
  posAmount: number;
  actualAmount: number;
  remarks: string;
}

function fmtMoney(val: number): string {
  return Number(val || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function exportRofSummaryToExcel(
  rows: RofSummaryRow[],
  totals: RofSummaryTotals,
  filters: { locationName: string; dateFrom: string; dateTo: string }
) {
  const wb = XLSX.utils.book_new();

  const sheetRows: Record<string, string | number>[] = rows.map((row) => ({
    'Business Date': row.businessDate,
    'Store Location': row.locationName || filters.locationName,
    'Net Sales w/ VAT': Number(row.netSalesVat || 0),
    VAT: Number(row.vat || 0),
    'Net Sales': Number(row.netSales || 0),
    'GC / Srvc Charge': Number(row.gcSales || 0),
    'Cash Remitted': Number(row.cash || 0),
    'Non-Cash Remitted': Number(row.nonCash || 0),
    Variance: Number(row.variance || 0),
    'Cash Remarks': row.cashRemarks || '-',
    'Non-Cash Remarks': row.nonCashRemarks || '-',
  }));

  if (rows.length > 0) {
    sheetRows.push({
      'Business Date': 'TOTAL',
      'Store Location': filters.locationName,
      'Net Sales w/ VAT': Number(totals.netSalesVat || 0),
      VAT: Number(totals.vat || 0),
      'Net Sales': Number(totals.netSales || 0),
      'GC / Srvc Charge': Number(totals.gcSales || 0),
      'Cash Remitted': Number(totals.cash || 0),
      'Non-Cash Remitted': Number(totals.nonCash || 0),
      Variance: Number(totals.variance || 0),
      'Cash Remarks': '',
      'Non-Cash Remarks': '',
    });
  }

  const ws = XLSX.utils.json_to_sheet(sheetRows);
  XLSX.utils.book_append_sheet(wb, ws, 'ROF Summary');

  const filename = `ROF_Summary_${filters.locationName}_${filters.dateFrom}_to_${filters.dateTo}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export function exportRofSummaryToPdf(
  rows: RofSummaryRow[],
  totals: RofSummaryTotals,
  filters: { locationName: string; dateFrom: string; dateTo: string }
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  doc.setFontSize(16);
  doc.setTextColor(31, 41, 55);
  doc.text('Remittance of Funds (ROF) — Summary Report', 40, 40);

  doc.setFontSize(10);
  doc.setTextColor(100, 110, 130);
  doc.text(
    `Store: ${filters.locationName}   |   Period: ${filters.dateFrom} to ${filters.dateTo}   |   Days: ${rows.length}`,
    40,
    58
  );
  doc.text(`Generated: ${new Date().toLocaleString()}   |   Contemporain Foods Inc.`, 40, 72);

  const tableBody = rows.map((r) => [
    r.businessDate,
    fmtMoney(r.netSalesVat),
    fmtMoney(r.vat),
    fmtMoney(r.netSales),
    fmtMoney(r.gcSales),
    fmtMoney(r.cash),
    fmtMoney(r.nonCash),
    fmtMoney(r.variance),
    r.cashRemarks || '-',
    r.nonCashRemarks || '-',
  ]);

  if (rows.length > 0) {
    tableBody.push([
      'TOTAL',
      fmtMoney(totals.netSalesVat),
      fmtMoney(totals.vat),
      fmtMoney(totals.netSales),
      fmtMoney(totals.gcSales),
      fmtMoney(totals.cash),
      fmtMoney(totals.nonCash),
      fmtMoney(totals.variance),
      '',
      '',
    ]);
  }

  autoTable(doc, {
    startY: 88,
    head: [
      [
        'Business Date',
        'Net Sales w/ VAT',
        'VAT',
        'Net Sales',
        'GC / Srvc Chg',
        'Cash Remitted',
        'Non-Cash Remitted',
        'Variance',
        'Cash Remarks',
        'Non-Cash Remarks',
      ],
    ],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [31, 41, 55], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [31, 41, 55] },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: 40, right: 40 },
  });

  const filename = `ROF_Summary_${filters.locationName}_${filters.dateFrom}_to_${filters.dateTo}.pdf`;
  doc.save(filename);
}

export function exportRofDetailsToExcel(
  cashRows: RofCashRow[],
  nonCashRows: RofNonCashRow[],
  filters: { locationName: string; businessDate: string }
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Cash Remittance
  const cashPosTotal = cashRows.reduce((s, r) => s + Number(r.posAmount || 0), 0);
  const cashActualTotal = cashRows.reduce((s, r) => s + Number(r.actualAmount || 0), 0);

  const cashSheetData: Record<string, string | number>[] = cashRows.map((row) => ({
    'Cashier Name': row.cashierName,
    Tender: row.tenderName,
    'POS Amount': Number(row.posAmount || 0),
    'Actual Amount': Number(row.actualAmount || 0),
    Variance: Number(row.actualAmount || 0) - Number(row.posAmount || 0),
    MOD: row.mod || '-',
    Remarks: row.remarks || '-',
  }));

  if (cashRows.length > 0) {
    cashSheetData.push({
      'Cashier Name': 'TOTAL',
      Tender: '',
      'POS Amount': cashPosTotal,
      'Actual Amount': cashActualTotal,
      Variance: cashActualTotal - cashPosTotal,
      MOD: '',
      Remarks: '',
    });
  }

  const wsCash = XLSX.utils.json_to_sheet(cashSheetData);
  XLSX.utils.book_append_sheet(wb, wsCash, 'Cash Remittance');

  // Sheet 2: Non-Cash Remittance
  const nonCashPosTotal = nonCashRows.reduce((s, r) => s + Number(r.posAmount || 0), 0);
  const nonCashActualTotal = nonCashRows.reduce((s, r) => s + Number(r.actualAmount || 0), 0);

  const nonCashSheetData: Record<string, string | number>[] = nonCashRows.map((row) => ({
    'Tender Name': row.tenderName,
    'POS Amount': Number(row.posAmount || 0),
    'Actual Amount': Number(row.actualAmount || 0),
    Variance: Number(row.actualAmount || 0) - Number(row.posAmount || 0),
    Remarks: row.remarks || '-',
  }));

  if (nonCashRows.length > 0) {
    nonCashSheetData.push({
      'Tender Name': 'TOTAL',
      'POS Amount': nonCashPosTotal,
      'Actual Amount': nonCashActualTotal,
      Variance: nonCashActualTotal - nonCashPosTotal,
      Remarks: '',
    });
  }

  const wsNonCash = XLSX.utils.json_to_sheet(nonCashSheetData);
  XLSX.utils.book_append_sheet(wb, wsNonCash, 'Non-Cash Remittance');

  const filename = `ROF_Details_${filters.locationName}_${filters.businessDate}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export function exportRofDetailsToPdf(
  cashRows: RofCashRow[],
  nonCashRows: RofNonCashRow[],
  filters: { locationName: string; businessDate: string }
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  doc.setFontSize(16);
  doc.setTextColor(31, 41, 55);
  doc.text('Remittance of Funds (ROF) — Detailed Breakdown', 40, 40);

  doc.setFontSize(10);
  doc.setTextColor(100, 110, 130);
  doc.text(
    `Store: ${filters.locationName}   |   Business Date: ${filters.businessDate}`,
    40,
    58
  );
  doc.text(`Generated: ${new Date().toLocaleString()}   |   Contemporain Foods Inc.`, 40, 72);

  // 1. Cash Remittance Table
  doc.setFontSize(12);
  doc.setTextColor(31, 41, 55);
  doc.text('1. Cash Remittance Breakdown', 40, 95);

  const cashPosTotal = cashRows.reduce((s, r) => s + Number(r.posAmount || 0), 0);
  const cashActualTotal = cashRows.reduce((s, r) => s + Number(r.actualAmount || 0), 0);

  const cashTableBody = cashRows.map((r) => [
    r.cashierName,
    r.tenderName,
    fmtMoney(r.posAmount),
    fmtMoney(r.actualAmount),
    fmtMoney(r.actualAmount - r.posAmount),
    r.mod || '-',
    r.remarks || '-',
  ]);

  if (cashRows.length > 0) {
    cashTableBody.push([
      'TOTAL',
      '',
      fmtMoney(cashPosTotal),
      fmtMoney(cashActualTotal),
      fmtMoney(cashActualTotal - cashPosTotal),
      '',
      '',
    ]);
  }

  autoTable(doc, {
    startY: 104,
    head: [['Cashier Name', 'Tender', 'POS Amount', 'Actual Amount', 'Variance', 'MOD', 'Remarks']],
    body: cashTableBody,
    theme: 'grid',
    headStyles: { fillColor: [31, 41, 55], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8.5, textColor: [31, 41, 55] },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: 40, right: 40 },
  });

  // 2. Non-Cash Remittance Table
  const lastY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 220;
  const nextY = lastY + 28;

  doc.setFontSize(12);
  doc.setTextColor(31, 41, 55);
  doc.text('2. Non-Cash Remittance Breakdown', 40, nextY);

  const nonCashPosTotal = nonCashRows.reduce((s, r) => s + Number(r.posAmount || 0), 0);
  const nonCashActualTotal = nonCashRows.reduce((s, r) => s + Number(r.actualAmount || 0), 0);

  const nonCashTableBody = nonCashRows.map((r) => [
    r.tenderName,
    fmtMoney(r.posAmount),
    fmtMoney(r.actualAmount),
    fmtMoney(r.actualAmount - r.posAmount),
    r.remarks || '-',
  ]);

  if (nonCashRows.length > 0) {
    nonCashTableBody.push([
      'TOTAL',
      fmtMoney(nonCashPosTotal),
      fmtMoney(nonCashActualTotal),
      fmtMoney(nonCashActualTotal - nonCashPosTotal),
      '',
    ]);
  }

  autoTable(doc, {
    startY: nextY + 10,
    head: [['Tender Name', 'POS Amount', 'Actual Amount', 'Variance', 'Remarks']],
    body: nonCashTableBody,
    theme: 'grid',
    headStyles: { fillColor: [31, 41, 55], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8.5, textColor: [31, 41, 55] },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: 40, right: 40 },
  });

  const filename = `ROF_Details_${filters.locationName}_${filters.businessDate}.pdf`;
  doc.save(filename);
}
