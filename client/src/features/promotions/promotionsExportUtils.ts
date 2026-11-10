import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface PromotionSummaryRow {
  locationName: string;
  itemNumber: string;
  itemName: string;
  familyGroup: string;
  qty: number;
  amt: number;
  netSales: number;
  checkCount: number;
}

export interface ConsolidatedPromoRow {
  itemNumber: string;
  itemName: string;
  familyGroup: string;
  storeCount: number;
  checkCount: number;
  qty: number;
  amt: number;
  netSales: number;
  topStoreName?: string;
  topStoreAmt?: number;
  topStoreQty?: number;
}

export interface StorePromoPerformanceRow {
  locationName: string;
  promoItemCount: number;
  checkCount: number;
  qty: number;
  amt: number;
  netSales: number;
  topPromoName: string;
  topPromoAmt: number;
}

export interface PromotionDailyTrendRow {
  businessDate: string;
  qty: number;
  amt: number;
  netSales: number;
  checkCount: number;
}

export interface PromotionPairedItem {
  itemNumber: string;
  itemName: string;
  majorGroup: string;
  familyGroup: string;
  checkFrequency: number;
  totalQty: number;
  totalAmt: number;
  isSelectedPromo: boolean;
  isZeroPriceBundleItem: boolean;
}

export interface PromotionCheckDetailsResponse {
  promo: {
    itemNumber: string;
    itemName: string;
    locationName: string;
    dateFrom: string;
    dateTo: string;
    totalChecksMatched: number;
    totalPromoQty: number;
    totalPromoAmt: number;
  };
  pairedItems: PromotionPairedItem[];
}

export interface PromotionCatalogItem {
  itemNumber: string;
  itemName: string;
  majorGroup: string;
  familyGroup: string;
}

export interface PromotionFilterMeta {
  locationName: string;
  dateFrom: string;
  dateTo: string;
  itemNumber?: string | null;
  promoName?: string | null;
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
 * Exports Promotion Monitoring & Analytics to a multi-sheet Excel workbook (.xlsx)
 */
export function exportPromotionsToExcel(params: {
  rows: PromotionSummaryRow[];
  consolidatedPromos: ConsolidatedPromoRow[];
  storePerformance: StorePromoPerformanceRow[];
  dailyTrend: PromotionDailyTrendRow[];
  filters: PromotionFilterMeta;
  activeDrilldown?: PromotionCheckDetailsResponse | null;
}) {
  const { rows, consolidatedPromos, storePerformance, dailyTrend, filters, activeDrilldown } = params;
  const wb = XLSX.utils.book_new();

  const totalAmt = rows.reduce((s, r) => s + r.amt, 0);
  const totalQty = rows.reduce((s, r) => s + r.qty, 0);

  // Sheet 1: Promotion By Store & Item (matches user SQL query)
  const storeItemRows: Record<string, string | number>[] = rows.map((r) => {
    const sharePct = totalAmt > 0 ? (r.amt / totalAmt) * 100 : 0;
    return {
      'Location Name': r.locationName,
      'Item Number': r.itemNumber,
      'Item Name': r.itemName,
      'Qty Sold': round2(r.qty),
      'Amount (AMT)': round2(r.amt),
      '% Share': `${sharePct.toFixed(2)}%`,
    };
  });

  if (rows.length > 0) {
    storeItemRows.push({
      'Location Name': 'TOTAL',
      'Item Number': `${rows.length} Record(s)`,
      'Item Name': '',
      'Qty Sold': round2(totalQty),
      'Amount (AMT)': round2(totalAmt),
      '% Share': '100.00%',
    });
  }

  const wsStoreItem = XLSX.utils.json_to_sheet(storeItemRows);
  wsStoreItem['!cols'] = [
    { wch: 20 },
    { wch: 15 },
    { wch: 38 },
    { wch: 14 },
    { wch: 18 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsStoreItem, 'Promo by Store & Item');

  // Sheet 2: Consolidated by Promotion
  const consolidatedSheetRows: Record<string, string | number>[] = consolidatedPromos.map((p) => {
    const sharePct = totalAmt > 0 ? (p.amt / totalAmt) * 100 : 0;
    return {
      'Item Number': p.itemNumber,
      'Promotion Name': p.itemName,
      'Participating Stores': p.storeCount,
      'Total Qty Sold': round2(p.qty),
      'Total Amount (AMT)': round2(p.amt),
      '% Share': `${sharePct.toFixed(2)}%`,
    };
  });

  if (consolidatedPromos.length > 0) {
    consolidatedSheetRows.push({
      'Item Number': 'TOTAL',
      'Promotion Name': `${consolidatedPromos.length} Unique Promo(s)`,
      'Participating Stores': '',
      'Total Qty Sold': round2(totalQty),
      'Total Amount (AMT)': round2(totalAmt),
      '% Share': '100.00%',
    });
  }

  const wsConsolidated = XLSX.utils.json_to_sheet(consolidatedSheetRows);
  wsConsolidated['!cols'] = [
    { wch: 15 },
    { wch: 38 },
    { wch: 20 },
    { wch: 16 },
    { wch: 18 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsConsolidated, 'Consolidated by Promo');

  // Sheet 3: Store Performance
  if (storePerformance.length > 0) {
    const storeRows: Record<string, string | number>[] = storePerformance.map((s) => {
      const sharePct = totalAmt > 0 ? (s.amt / totalAmt) * 100 : 0;
      return {
        'Location Name': s.locationName,
        'Active Promos': s.promoItemCount,
        'Total Qty Sold': round2(s.qty),
        'Total Amount (AMT)': round2(s.amt),
        '% Share': `${sharePct.toFixed(2)}%`,
        'Top Promo in Store': s.topPromoName,
      };
    });

    const wsStores = XLSX.utils.json_to_sheet(storeRows);
    wsStores['!cols'] = [
      { wch: 20 },
      { wch: 15 },
      { wch: 16 },
      { wch: 18 },
      { wch: 12 },
      { wch: 36 },
    ];
    XLSX.utils.book_append_sheet(wb, wsStores, 'Store Promo Ranking');
  }

  // Sheet 4: Daily Trend
  if (dailyTrend.length > 0) {
    const trendRows: Record<string, string | number>[] = dailyTrend.map((d) => ({
      'Business Date': d.businessDate,
      'Promo Qty Sold': round2(d.qty),
      'Promo Amount (AMT)': round2(d.amt),
    }));

    const wsTrend = XLSX.utils.json_to_sheet(trendRows);
    wsTrend['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsTrend, 'Daily Promo Trend');
  }

  // Sheet 5 (Optional): Active Promo Drill-down Items
  if (activeDrilldown && activeDrilldown.pairedItems.length > 0) {
    const drillRows: Record<string, string | number>[] = activeDrilldown.pairedItems.map(
      (item) => ({
        'Promo Investigated': `${activeDrilldown.promo.itemNumber} - ${activeDrilldown.promo.itemName}`,
        'Item Number': item.itemNumber,
        'Item Name': item.itemName,
        'Major Group': item.majorGroup,
        'Family Group': item.familyGroup,
        Role: item.isSelectedPromo
          ? 'Target Promotion'
          : item.isZeroPriceBundleItem
          ? 'Bundled / Zero-Price Item'
          : 'Co-Sold on Receipt',
        'Total Qty': round2(item.totalQty),
        'Total Line Amount': round2(item.totalAmt),
      })
    );

    const wsDrill = XLSX.utils.json_to_sheet(drillRows);
    wsDrill['!cols'] = [
      { wch: 32 },
      { wch: 15 },
      { wch: 36 },
      { wch: 18 },
      { wch: 18 },
      { wch: 24 },
      { wch: 18 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, wsDrill, 'Promo Check Items');
  }

  const safeLoc = (filters.locationName || 'ALL').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Promotion_Monitoring_${safeLoc}_${filters.dateFrom}_to_${filters.dateTo}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Exports Promotion Monitoring & Analytics to a formatted landscape PDF (.pdf)
 */
export function exportPromotionsToPdf(params: {
  rows: PromotionSummaryRow[];
  consolidatedPromos: ConsolidatedPromoRow[];
  filters: PromotionFilterMeta;
  groupMode: 'store-item' | 'consolidated';
}) {
  const { rows, consolidatedPromos, filters, groupMode } = params;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  const totalAmt = rows.reduce((s, r) => s + r.amt, 0);
  const totalQty = rows.reduce((s, r) => s + r.qty, 0);

  doc.setFontSize(16);
  doc.setTextColor(31, 41, 55);
  doc.text('Promotion Monitoring & Performance Report', 40, 38);

  doc.setFontSize(9.5);
  doc.setTextColor(100, 110, 130);
  doc.text(
    `Store Filter: ${
      filters.locationName === 'ALL' ? 'ALL STORES (Consolidated)' : filters.locationName
    }   |   Promo Filter: ${
      filters.promoName
        ? `${filters.itemNumber ? `${filters.itemNumber} - ` : ''}${filters.promoName}`
        : filters.itemNumber || 'All Promotions'
    }   |   Period: ${filters.dateFrom} to ${filters.dateTo}   |   View: ${
      groupMode === 'consolidated' ? 'Consolidated by Promotion' : 'By Store & Promotion'
    }`,
    40,
    55
  );
  doc.text(
    `Total Promo Qty: ${fmtQty(totalQty)}   |   Total Promo Amount: PHP ${fmtMoney(
      totalAmt
    )}   |   Unique Promos: ${consolidatedPromos.length}`,
    40,
    69
  );

  if (groupMode === 'consolidated') {
    const body = consolidatedPromos.map((p) => {
      const sharePct = totalAmt > 0 ? (p.amt / totalAmt) * 100 : 0;
      return [
        p.itemNumber,
        p.itemName,
        String(p.storeCount),
        fmtQty(p.qty),
        fmtMoney(p.amt),
        `${sharePct.toFixed(2)}%`,
      ];
    });

    if (consolidatedPromos.length > 0) {
      body.push([
        'TOTAL',
        `${consolidatedPromos.length} Unique Promotion(s)`,
        '-',
        fmtQty(totalQty),
        fmtMoney(totalAmt),
        '100.00%',
      ]);
    }

    autoTable(doc, {
      startY: 84,
      head: [
        [
          'Item Number',
          'Promotion Item Name',
          'Stores',
          'Qty Sold',
          'Total Amount (PHP)',
          '% Share',
        ],
      ],
      body,
      theme: 'grid',
      headStyles: { fillColor: [31, 41, 55], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: [31, 41, 55] },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: { cellWidth: 80, fontStyle: 'bold' },
        2: { halign: 'center', cellWidth: 65 },
        3: { halign: 'right', cellWidth: 90 },
        4: { halign: 'right', cellWidth: 120, fontStyle: 'bold' },
        5: { halign: 'right', cellWidth: 70 },
      },
      margin: { left: 40, right: 40 },
      didParseCell(data) {
        if (data.section === 'body' && data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [243, 244, 246];
        }
      },
    });
  } else {
    const body = rows.map((r) => {
      const sharePct = totalAmt > 0 ? (r.amt / totalAmt) * 100 : 0;
      return [
        r.locationName,
        r.itemNumber,
        r.itemName,
        fmtQty(r.qty),
        fmtMoney(r.amt),
        `${sharePct.toFixed(2)}%`,
      ];
    });

    if (rows.length > 0) {
      body.push([
        'TOTAL',
        `${rows.length} Row(s)`,
        '',
        fmtQty(totalQty),
        fmtMoney(totalAmt),
        '100.00%',
      ]);
    }

    autoTable(doc, {
      startY: 84,
      head: [
        [
          'Location Name',
          'Item Number',
          'Promotion Item Name',
          'Qty Sold',
          'Total Amount (PHP)',
          '% Share',
        ],
      ],
      body,
      theme: 'grid',
      headStyles: { fillColor: [31, 41, 55], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: [31, 41, 55] },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: { cellWidth: 120, fontStyle: 'bold' },
        1: { cellWidth: 80, fontStyle: 'bold' },
        3: { halign: 'right', cellWidth: 85 },
        4: { halign: 'right', cellWidth: 120, fontStyle: 'bold' },
        5: { halign: 'right', cellWidth: 70 },
      },
      margin: { left: 40, right: 40 },
      didParseCell(data) {
        if (data.section === 'body' && data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [243, 244, 246];
        }
      },
    });
  }

  const safeLoc = (filters.locationName || 'ALL').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Promotion_Monitoring_${safeLoc}_${filters.dateFrom}_to_${filters.dateTo}.pdf`;
  doc.save(filename);
}
