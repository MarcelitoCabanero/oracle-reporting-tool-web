import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface SystemSalesDsrSummary {
  daysCount: number;
  netSales: number;
  grossSales: number;
  taxCollected: number;
  totalRevenue?: number;
  grossReceipt: number;
  totalCash: number;
  totalCards: number;
  numGuest: number;

  vatableSales: number;
  vatExemptSales: number;
  vatZeroRatedSales: number;
  lessVat: number;

  seniorCitizen: number;
  pwd: number;
  employee: number;
  nationalAthlete: number;
  soloParent: number;
  otherDiscount: number;
  totalDiscount: number;

  gcSales: number;
  gcExcess: number;
  voidAmount: number;
  voidCount: number;
}

export interface SystemSalesTenderItem {
  tenderName: string;
  amount: number;
  sharePct?: number;
}

export interface SystemSalesData {
  locationName: string;
  dateFrom: string;
  dateTo: string;
  summary: SystemSalesDsrSummary;
  tenders: SystemSalesTenderItem[];
  tenderTotalAmount: number;
}

function formatMoney(value: number): string {
  return Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatInt(value: number): string {
  return Number(value || 0).toLocaleString('en-PH', {
    maximumFractionDigits: 0,
  });
}

/**
 * Export System Sales Summary to Excel (.xlsx)
 */
export function exportSystemSalesToExcel(data: SystemSalesData): void {
  const { locationName, dateFrom, dateTo, summary, tenders, tenderTotalAmount } = data;

  const wb = XLSX.utils.book_new();

  const rows: Array<Array<string | number>> = [];

  // Title Block
  rows.push(['J.CO DONUTS & COFFEE']);
  rows.push(['SYSTEM SALES SUMMARY REPORT']);
  rows.push([]);
  rows.push(['Store / Location:', locationName]);
  rows.push(['Business Date Range:', `${dateFrom} to ${dateTo}`]);
  rows.push(['Active Business Days:', summary.daysCount]);
  rows.push(['Generated At:', new Date().toLocaleString('en-PH')]);
  rows.push([]);

  // 1. Sales Overview
  const revenueValue = summary.totalRevenue ?? (summary.netSales + summary.taxCollected);

  rows.push(['--- SALES OVERVIEW ---', '']);
  rows.push(['Net Sales (₱)', summary.netSales]);
  rows.push(['Gross Sales (₱)', summary.grossSales]);
  rows.push(['Tax Collected (VAT 12%) (₱)', summary.taxCollected]);
  rows.push(['Total Revenue (Netsales + VAT) (₱)', revenueValue]);
  rows.push(['Total Cash (₱)', summary.totalCash]);
  rows.push(['Total Cards (₱)', summary.totalCards]);
  rows.push(['Guest Count', summary.numGuest]);
  rows.push([]);

  // 2. VAT Breakdown
  rows.push(['--- VAT BREAKDOWN ---', '']);
  rows.push(['Vatable Sales', summary.vatableSales]);
  rows.push(['VAT Exempt Sales', summary.vatExemptSales]);
  rows.push(['Zero Rated Sales', summary.vatZeroRatedSales]);
  rows.push(['Tax Collected', summary.taxCollected]);
  rows.push(['Less VAT', summary.lessVat]);
  rows.push([]);

  // 3. Discounts
  rows.push(['--- DISCOUNTS ---', '']);
  rows.push(['Senior Citizen', summary.seniorCitizen]);
  rows.push(['PWD', summary.pwd]);
  rows.push(['Employee', summary.employee]);
  rows.push(['National Athlete', summary.nationalAthlete]);
  rows.push(['Solo Parent', summary.soloParent]);
  rows.push(['Other Discount', summary.otherDiscount]);
  rows.push(['Total Discounts', summary.totalDiscount]);
  rows.push([]);

  // 4. Other Sales & Adjustments
  rows.push(['--- OTHER SALES & ADJUSTMENTS ---', '']);
  rows.push(['GC Sales', summary.gcSales]);
  rows.push(['GC Excess', summary.gcExcess]);
  rows.push(['Void Amount', summary.voidAmount]);
  rows.push(['Void Count', summary.voidCount]);
  rows.push([]);

  // 5. Tender Breakdown Table
  rows.push(['--- TENDER BREAKDOWN ---', '', '']);
  rows.push(['Tender Name', 'Amount (₱)', '% Share']);
  for (const t of tenders) {
    const share = t.sharePct != null ? Number(t.sharePct.toFixed(2)) : 0;
    rows.push([t.tenderName, t.amount, `${share}%`]);
  }
  rows.push(['TOTAL TENDERS', tenderTotalAmount, '100.00%']);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  ws['!cols'] = [{ wch: 32 }, { wch: 22 }, { wch: 14 }];

  XLSX.utils.book_append_sheet(wb, ws, 'Sales Summary');

  const fileName = `System_Sales_${locationName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${dateFrom}_to_${dateTo}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Export System Sales Summary to PDF (.pdf)
 */
export function exportSystemSalesToPdf(data: SystemSalesData): void {
  const { locationName, dateFrom, dateTo, summary, tenders, tenderTotalAmount } = data;
  const revenueValue = summary.totalRevenue ?? (summary.netSales + summary.taxCollected);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55); // #1F2937
  doc.text('J.CO DONUTS & COFFEE', 40, 45);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(55, 65, 81);
  doc.text('System Sales Summary Report', 40, 63);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128); // #6B7280
  doc.text(`Store: ${locationName}    |    Period: ${dateFrom} to ${dateTo}    |    Active Days: ${summary.daysCount}`, 40, 80);
  doc.text(`Generated: ${new Date().toLocaleString('en-PH')}`, 40, 93);

  // Horizontal divider
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(1);
  doc.line(40, 102, pageWidth - 40, 102);

  let currentY = 115;

  // Key Figures Summary Table (2 columns side by side)
  autoTable(doc, {
    startY: currentY,
    margin: { left: 40, right: 40 },
    theme: 'grid',
    head: [['KEY METRIC', 'AMOUNT (PHP)', 'KEY METRIC', 'AMOUNT (PHP)']],
    body: [
      ['Net Sales', `PHP ${formatMoney(summary.netSales)}`, 'Tax Collected (12%)', `PHP ${formatMoney(summary.taxCollected)}`],
      ['Gross Sales', `PHP ${formatMoney(summary.grossSales)}`, 'Total Revenue', `PHP ${formatMoney(revenueValue)}`],
      ['Total Cash', `PHP ${formatMoney(summary.totalCash)}`, 'Total Cards', `PHP ${formatMoney(summary.totalCards)}`],
      ['Total Discounts', `PHP ${formatMoney(summary.totalDiscount)}`, 'Guest Count', formatInt(summary.numGuest)],
    ],
    headStyles: {
      fillColor: [31, 41, 55],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 4,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 130 },
      1: { halign: 'right', fontStyle: 'bold', textColor: [17, 24, 39] },
      2: { fontStyle: 'bold', cellWidth: 130 },
      3: { halign: 'right', fontStyle: 'bold', textColor: [17, 24, 39] },
    },
  });

  currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;

  // 3 Breakdown Tables Side-by-Side (or stacked in 2 clean blocks)
  // Table A: VAT Breakdown & Other Adjustments
  autoTable(doc, {
    startY: currentY,
    margin: { left: 40, right: 40 },
    theme: 'striped',
    head: [['VAT BREAKDOWN', 'AMOUNT (PHP)', 'OTHER SALES & ADJUSTMENTS', 'AMOUNT / COUNT']],
    body: [
      ['Vatable Sales', `PHP ${formatMoney(summary.vatableSales)}`, 'GC Sales', `PHP ${formatMoney(summary.gcSales)}`],
      ['VAT Exempt Sales', `PHP ${formatMoney(summary.vatExemptSales)}`, 'GC Excess', `PHP ${formatMoney(summary.gcExcess)}`],
      ['Zero Rated Sales', `PHP ${formatMoney(summary.vatZeroRatedSales)}`, 'Void Amount', `PHP ${formatMoney(summary.voidAmount)}`],
      ['Tax Collected', `PHP ${formatMoney(summary.taxCollected)}`, 'Void Count', formatInt(summary.voidCount)],
      ['Less VAT', `PHP ${formatMoney(summary.lessVat)}`, '', ''],
    ],
    headStyles: {
      fillColor: [55, 65, 81],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    styles: {
      fontSize: 8,
      cellPadding: 3.5,
    },
    columnStyles: {
      0: { fontStyle: 'normal' },
      1: { halign: 'right', fontStyle: 'bold' },
      2: { fontStyle: 'normal' },
      3: { halign: 'right', fontStyle: 'bold' },
    },
  });

  currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

  // Table B: Discounts
  autoTable(doc, {
    startY: currentY,
    margin: { left: 40, right: 40 },
    theme: 'striped',
    head: [['DISCOUNT CLASSIFICATION', 'AMOUNT (PHP)', 'DISCOUNT CLASSIFICATION', 'AMOUNT (PHP)']],
    body: [
      ['Senior Citizen', `PHP ${formatMoney(summary.seniorCitizen)}`, 'National Athlete', `PHP ${formatMoney(summary.nationalAthlete)}`],
      ['PWD', `PHP ${formatMoney(summary.pwd)}`, 'Solo Parent', `PHP ${formatMoney(summary.soloParent)}`],
      ['Employee', `PHP ${formatMoney(summary.employee)}`, 'Other Discount', `PHP ${formatMoney(summary.otherDiscount)}`],
      ['TOTAL DISCOUNTS', `PHP ${formatMoney(summary.totalDiscount)}`, '', ''],
    ],
    headStyles: {
      fillColor: [75, 85, 99],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    styles: {
      fontSize: 8,
      cellPadding: 3.5,
    },
    columnStyles: {
      0: { fontStyle: 'normal' },
      1: { halign: 'right', fontStyle: 'bold' },
      2: { fontStyle: 'normal' },
      3: { halign: 'right', fontStyle: 'bold' },
    },
  });

  currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;

  // Table C: Tender Breakdown Table
  const tenderBody = tenders.map((t) => [
    t.tenderName,
    `PHP ${formatMoney(t.amount)}`,
    `${(t.sharePct ?? 0).toFixed(2)}%`,
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: 40, right: 40 },
    theme: 'grid',
    head: [['TENDER NAME', 'AMOUNT (PHP)', '% SHARE']],
    body: tenderBody,
    foot: [['TOTAL TENDERS', `PHP ${formatMoney(tenderTotalAmount)}`, '100.00%']],
    headStyles: {
      fillColor: [31, 41, 55],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    footStyles: {
      fillColor: [243, 244, 246],
      textColor: [17, 24, 39],
      fontStyle: 'bold',
      fontSize: 9,
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 4,
    },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right', fontStyle: 'bold' },
      2: { halign: 'right' },
    },
  });

  const fileName = `System_Sales_${locationName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${dateFrom}_to_${dateTo}.pdf`;
  doc.save(fileName);
}
