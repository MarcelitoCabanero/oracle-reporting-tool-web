import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface MenuItemSalesTypeRow {
  locationName: string;
  itemNumber: string;
  itemName: string;
  qty: number;
  grossAmount: number;
  itemDiscount: number;
  netSales: number;
  salesType: string;
}

export interface MenuItemMetrics {
  qty: number;
  grossAmount: number;
  itemDiscount: number;
  netSales: number;
}

export interface PivotedMenuItemRow {
  itemNumber: string;
  itemName: string;
  bySalesType: Record<string, MenuItemMetrics>;
  rowTotal: MenuItemMetrics;
}

export interface MenuItemSummaryRow {
  locationName: string;
  itemNumber: string;
  itemName: string;
  majorGroup: string;
  familyGroup: string;
  qty: number;
  grossAmount: number;
  itemDiscount: number;
  netSales: number;
}

export interface MenuItemDailyTrendRow {
  businessDate: string;
  qty: number;
  grossAmount: number;
  itemDiscount: number;
  netSales: number;
}

export interface MenuItemFilterMeta {
  locationName: string;
  dateFrom: string;
  dateTo: string;
}

function fmtMoney(val: number): string {
  return Number(val || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtQty(val: number): string {
  return Number(val || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function round2(val: number): number {
  return Math.round((Number(val || 0) + Number.EPSILON) * 100) / 100;
}

/**
 * Exports the 2-tier Pivot Matrix for Menu Item by Sales Type to Excel (.xlsx)
 */
export function exportMenuItemPivotToExcel(
  pivotedRows: PivotedMenuItemRow[],
  visibleSalesTypes: string[],
  columnTotals: Record<string, MenuItemMetrics>,
  grandTotal: MenuItemMetrics,
  filters: MenuItemFilterMeta,
  selectedSalesTypeFilter: string
) {
  const wb = XLSX.utils.book_new();

  // Build 2-row merged header Pivot Matrix sheet
  const totalCols = 2 + (visibleSalesTypes.length + 1) * 4;

  const row1: (string | number)[] = ['MENU ITEM BY SALES TYPE — PIVOT MATRIX'];
  const row2: (string | number)[] = [
    `Store: ${filters.locationName}   |   Period: ${filters.dateFrom} to ${filters.dateTo}   |   Sales Type Filter: ${
      selectedSalesTypeFilter || 'All Sales Types'
    }`,
  ];
  const row3: (string | number)[] = [];

  // Header Tier 1 (Row index 3 -> Excel Row 4)
  const headerTier1: (string | number)[] = ['Item Number', 'Item Name'];
  // Header Tier 2 (Row index 4 -> Excel Row 5)
  const headerTier2: (string | number)[] = ['', ''];

  for (const st of visibleSalesTypes) {
    headerTier1.push(st, '', '', '');
    headerTier2.push('Qty', 'Amt Total', 'Discount', 'Net Sales');
  }

  headerTier1.push('TOTAL', '', '', '');
  headerTier2.push('Qty', 'Amt Total', 'Discount', 'Net Sales');

  const sheetData: (string | number)[][] = [row1, row2, row3, headerTier1, headerTier2];

  // Body rows
  for (const item of pivotedRows) {
    const line: (string | number)[] = [item.itemNumber, item.itemName];
    for (const st of visibleSalesTypes) {
      const m = item.bySalesType[st];
      line.push(
        round2(m?.qty ?? 0),
        round2(m?.grossAmount ?? 0),
        round2(m?.itemDiscount ?? 0),
        round2(m?.netSales ?? 0)
      );
    }
    line.push(
      round2(item.rowTotal.qty),
      round2(item.rowTotal.grossAmount),
      round2(item.rowTotal.itemDiscount),
      round2(item.rowTotal.netSales)
    );
    sheetData.push(line);
  }

  // Grand Total footer row
  if (pivotedRows.length > 0) {
    const totalLine: (string | number)[] = ['TOTAL', `${pivotedRows.length} Item(s)`];
    for (const st of visibleSalesTypes) {
      const m = columnTotals[st];
      totalLine.push(
        round2(m?.qty ?? 0),
        round2(m?.grossAmount ?? 0),
        round2(m?.itemDiscount ?? 0),
        round2(m?.netSales ?? 0)
      );
    }
    totalLine.push(
      round2(grandTotal.qty),
      round2(grandTotal.grossAmount),
      round2(grandTotal.itemDiscount),
      round2(grandTotal.netSales)
    );
    sheetData.push(totalLine);
  }

  const wsPivot = XLSX.utils.aoa_to_sheet(sheetData);

  // Configure merges for title, subtitle, and 2-tier headers
  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(totalCols - 1, 5) } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(totalCols - 1, 5) } },
    // Item Number & Item Name vertical merge across row 3 & 4
    { s: { r: 3, c: 0 }, e: { r: 4, c: 0 } },
    { s: { r: 3, c: 1 }, e: { r: 4, c: 1 } },
  ];

  let colCursor = 2;
  for (let i = 0; i <= visibleSalesTypes.length; i++) {
    merges.push({
      s: { r: 3, c: colCursor },
      e: { r: 3, c: colCursor + 3 },
    });
    colCursor += 4;
  }

  wsPivot['!merges'] = merges;

  // Set column widths
  const cols: XLSX.ColInfo[] = [{ wch: 15 }, { wch: 36 }];
  for (let i = 0; i <= visibleSalesTypes.length; i++) {
    cols.push({ wch: 11 }, { wch: 15 }, { wch: 13 }, { wch: 15 });
  }
  wsPivot['!cols'] = cols;

  XLSX.utils.book_append_sheet(wb, wsPivot, 'Pivot by Sales Type');

  const safeLoc = filters.locationName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `MenuItem_BySalesType_${safeLoc}_${filters.dateFrom}_to_${filters.dateTo}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Exports the 2-tier Pivot Matrix for Menu Item by Sales Type to PDF (.pdf)
 */
export function exportMenuItemPivotToPdf(
  pivotedRows: PivotedMenuItemRow[],
  visibleSalesTypes: string[],
  columnTotals: Record<string, MenuItemMetrics>,
  grandTotal: MenuItemMetrics,
  filters: MenuItemFilterMeta,
  selectedSalesTypeFilter: string
) {
  // Use A3 landscape when there are 3+ sales types so all columns fit cleanly
  const useA3 = visibleSalesTypes.length >= 3;
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: useA3 ? 'a3' : 'a4',
  });

  doc.setFontSize(15);
  doc.setTextColor(31, 41, 55);
  doc.text('Menu Item by Sales Type — Pivot Matrix Report', 36, 36);

  doc.setFontSize(9.5);
  doc.setTextColor(100, 110, 130);
  doc.text(
    `Store: ${filters.locationName}   |   Period: ${filters.dateFrom} to ${filters.dateTo}   |   Sales Type: ${
      selectedSalesTypeFilter || 'All Sales Types'
    }   |   Items: ${pivotedRows.length}`,
    36,
    52
  );
  doc.text(`Generated: ${new Date().toLocaleString()}   |   Contemporain Foods Inc.`, 36, 65);

  // Build 2-tier header for autoTable
  const headRow1: any[] = [
    { content: 'Item #', rowSpan: 2, styles: { valign: 'middle' } },
    { content: 'Item Name', rowSpan: 2, styles: { valign: 'middle' } },
  ];
  const headRow2: any[] = [];

  for (const st of visibleSalesTypes) {
    headRow1.push({
      content: st,
      colSpan: 4,
      styles: { halign: 'center', fillColor: [31, 41, 55] },
    });
    headRow2.push(
      { content: 'Qty', styles: { halign: 'right' } },
      { content: 'Amt Total', styles: { halign: 'right' } },
      { content: 'Disc', styles: { halign: 'right' } },
      { content: 'Net Sales', styles: { halign: 'right' } }
    );
  }

  headRow1.push({
    content: 'TOTAL',
    colSpan: 4,
    styles: { halign: 'center', fillColor: [17, 24, 39] },
  });
  headRow2.push(
    { content: 'Qty', styles: { halign: 'right' } },
    { content: 'Amt Total', styles: { halign: 'right' } },
    { content: 'Disc', styles: { halign: 'right' } },
    { content: 'Net Sales', styles: { halign: 'right' } }
  );

  const body: (string | number)[][] = pivotedRows.map((item) => {
    const row: (string | number)[] = [item.itemNumber, item.itemName];
    for (const st of visibleSalesTypes) {
      const m = item.bySalesType[st];
      row.push(
        fmtQty(m?.qty ?? 0),
        fmtMoney(m?.grossAmount ?? 0),
        fmtMoney(m?.itemDiscount ?? 0),
        fmtMoney(m?.netSales ?? 0)
      );
    }
    row.push(
      fmtQty(item.rowTotal.qty),
      fmtMoney(item.rowTotal.grossAmount),
      fmtMoney(item.rowTotal.itemDiscount),
      fmtMoney(item.rowTotal.netSales)
    );
    return row;
  });

  if (pivotedRows.length > 0) {
    const totalRow: (string | number)[] = ['TOTAL', `${pivotedRows.length} Item(s)`];
    for (const st of visibleSalesTypes) {
      const m = columnTotals[st];
      totalRow.push(
        fmtQty(m?.qty ?? 0),
        fmtMoney(m?.grossAmount ?? 0),
        fmtMoney(m?.itemDiscount ?? 0),
        fmtMoney(m?.netSales ?? 0)
      );
    }
    totalRow.push(
      fmtQty(grandTotal.qty),
      fmtMoney(grandTotal.grossAmount),
      fmtMoney(grandTotal.itemDiscount),
      fmtMoney(grandTotal.netSales)
    );
    body.push(totalRow);
  }

  const columnStyles: Record<number, any> = {
    0: { cellWidth: 48, fontStyle: 'bold' },
    1: { cellWidth: 120 },
  };
  const totalNumericCols = (visibleSalesTypes.length + 1) * 4;
  for (let c = 2; c < 2 + totalNumericCols; c++) {
    columnStyles[c] = { halign: 'right' };
  }

  autoTable(doc, {
    startY: 78,
    head: [headRow1, headRow2],
    body,
    theme: 'grid',
    headStyles: {
      fillColor: [31, 41, 55],
      textColor: 255,
      fontSize: visibleSalesTypes.length >= 4 ? 6.5 : 7.5,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: visibleSalesTypes.length >= 4 ? 6.5 : 7.5,
      textColor: [31, 41, 55],
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles,
    margin: { left: 30, right: 30 },
    didParseCell(data) {
      if (data.section === 'body' && data.row.index === body.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [243, 244, 246];
      }
    },
  });

  const safeLoc = filters.locationName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `MenuItem_BySalesType_${safeLoc}_${filters.dateFrom}_to_${filters.dateTo}.pdf`;
  doc.save(filename);
}

/**
 * Exports Menu Item Summary (Items + Category Breakdown + Daily Trend) to Excel (.xlsx)
 */
export function exportMenuItemSummaryToExcel(
  rows: MenuItemSummaryRow[],
  dailyTrend: MenuItemDailyTrendRow[],
  totals: MenuItemMetrics,
  filters: MenuItemFilterMeta,
  majorGroupFilter: string
) {
  const wb = XLSX.utils.book_new();
  const totalNet = totals.netSales || 0;

  // Sheet 1: Menu Item Summary
  const summarySheetRows: Record<string, string | number>[] = rows.map((r) => {
    const sharePct = totalNet > 0 ? (r.netSales / totalNet) * 100 : 0;
    return {
      'Item Number': r.itemNumber,
      'Item Name': r.itemName,
      'Major Group': r.majorGroup,
      'Family Group': r.familyGroup,
      Qty: round2(r.qty),
      'Amt Total (Gross)': round2(r.grossAmount),
      'Item Discount': round2(r.itemDiscount),
      'Net Sales': round2(r.netSales),
      '% Share': `${sharePct.toFixed(2)}%`,
    };
  });

  if (rows.length > 0) {
    summarySheetRows.push({
      'Item Number': 'TOTAL',
      'Item Name': `${rows.length} Item(s)`,
      'Major Group': majorGroupFilter || 'All Major Groups',
      'Family Group': '',
      Qty: round2(totals.qty),
      'Amt Total (Gross)': round2(totals.grossAmount),
      'Item Discount': round2(totals.itemDiscount),
      'Net Sales': round2(totals.netSales),
      '% Share': '100.00%',
    });
  }

  const wsSummary = XLSX.utils.json_to_sheet(summarySheetRows);
  wsSummary['!cols'] = [
    { wch: 15 },
    { wch: 36 },
    { wch: 22 },
    { wch: 22 },
    { wch: 12 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Menu Item Summary');

  // Sheet 2: Category Breakdown by Major Group
  const groupMap = new Map<
    string,
    { count: number; qty: number; grossAmount: number; itemDiscount: number; netSales: number }
  >();
  for (const r of rows) {
    const key = r.majorGroup || 'Uncategorized';
    const curr = groupMap.get(key) ?? {
      count: 0,
      qty: 0,
      grossAmount: 0,
      itemDiscount: 0,
      netSales: 0,
    };
    curr.count += 1;
    curr.qty += r.qty;
    curr.grossAmount += r.grossAmount;
    curr.itemDiscount += r.itemDiscount;
    curr.netSales += r.netSales;
    groupMap.set(key, curr);
  }

  const categoryRows: Record<string, string | number>[] = Array.from(groupMap.entries())
    .sort((a, b) => b[1].netSales - a[1].netSales)
    .map(([majorGroup, g]) => ({
      'Major Group': majorGroup,
      'Item Count': g.count,
      'Total Qty': round2(g.qty),
      'Amt Total (Gross)': round2(g.grossAmount),
      'Item Discount': round2(g.itemDiscount),
      'Net Sales': round2(g.netSales),
      '% Share': `${(totalNet > 0 ? (g.netSales / totalNet) * 100 : 0).toFixed(2)}%`,
    }));

  if (categoryRows.length > 0) {
    categoryRows.push({
      'Major Group': 'TOTAL',
      'Item Count': rows.length,
      'Total Qty': round2(totals.qty),
      'Amt Total (Gross)': round2(totals.grossAmount),
      'Item Discount': round2(totals.itemDiscount),
      'Net Sales': round2(totals.netSales),
      '% Share': '100.00%',
    });
  }

  const wsCategory = XLSX.utils.json_to_sheet(categoryRows);
  wsCategory['!cols'] = [
    { wch: 24 },
    { wch: 12 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsCategory, 'Major Group Breakdown');

  // Sheet 3: Daily Sales Trend
  if (dailyTrend.length > 0) {
    const trendSheetRows: Record<string, string | number>[] = dailyTrend.map((d) => ({
      'Business Date': d.businessDate,
      Qty: round2(d.qty),
      'Amt Total (Gross)': round2(d.grossAmount),
      'Item Discount': round2(d.itemDiscount),
      'Net Sales': round2(d.netSales),
    }));

    const wsTrend = XLSX.utils.json_to_sheet(trendSheetRows);
    wsTrend['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsTrend, 'Daily Sales Trend');
  }

  const safeLoc = filters.locationName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `MenuItem_Summary_${safeLoc}_${filters.dateFrom}_to_${filters.dateTo}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Exports Menu Item Summary to PDF (.pdf)
 */
export function exportMenuItemSummaryToPdf(
  rows: MenuItemSummaryRow[],
  totals: MenuItemMetrics,
  filters: MenuItemFilterMeta,
  majorGroupFilter: string
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const totalNet = totals.netSales || 0;

  doc.setFontSize(16);
  doc.setTextColor(31, 41, 55);
  doc.text('Menu Item Summary & Analytics Report', 40, 40);

  doc.setFontSize(10);
  doc.setTextColor(100, 110, 130);
  doc.text(
    `Store: ${filters.locationName}   |   Period: ${filters.dateFrom} to ${filters.dateTo}   |   Major Group: ${
      majorGroupFilter || 'All Major Groups'
    }   |   Items: ${rows.length}`,
    40,
    58
  );
  doc.text(
    `Total Qty: ${fmtQty(totals.qty)}   |   Amt Total: PHP ${fmtMoney(
      totals.grossAmount
    )}   |   Discount: PHP ${fmtMoney(totals.itemDiscount)}   |   Net Sales: PHP ${fmtMoney(
      totals.netSales
    )}`,
    40,
    72
  );

  const tableBody = rows.map((r) => {
    const sharePct = totalNet > 0 ? (r.netSales / totalNet) * 100 : 0;
    return [
      r.itemNumber,
      r.itemName,
      r.majorGroup,
      r.familyGroup,
      fmtQty(r.qty),
      fmtMoney(r.grossAmount),
      fmtMoney(r.itemDiscount),
      fmtMoney(r.netSales),
      `${sharePct.toFixed(2)}%`,
    ];
  });

  if (rows.length > 0) {
    tableBody.push([
      'TOTAL',
      `${rows.length} Item(s)`,
      majorGroupFilter || 'All Major Groups',
      '',
      fmtQty(totals.qty),
      fmtMoney(totals.grossAmount),
      fmtMoney(totals.itemDiscount),
      fmtMoney(totals.netSales),
      '100.00%',
    ]);
  }

  autoTable(doc, {
    startY: 88,
    head: [
      [
        'Item Number',
        'Item Name',
        'Major Group',
        'Family Group',
        'Qty',
        'Amt Total (Gross)',
        'Item Discount',
        'Net Sales',
        '% Share',
      ],
    ],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [31, 41, 55], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [31, 41, 55] },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 65, fontStyle: 'bold' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right', fontStyle: 'bold' },
      8: { halign: 'right' },
    },
    margin: { left: 40, right: 40 },
    didParseCell(data) {
      if (data.section === 'body' && data.row.index === tableBody.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [243, 244, 246];
      }
    },
  });

  const safeLoc = filters.locationName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `MenuItem_Summary_${safeLoc}_${filters.dateFrom}_to_${filters.dateTo}.pdf`;
  doc.save(filename);
}
