import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface ConsolidatedItem {
  LocationName: string;
  RMCode: string;
  RMName: string;
  Inv_UOM: string;
  QtyFromQtySold: number;
  ActualQty?: number | null;
  Variance?: number | null;
}

export interface BreakdownItem {
  LocationName: string;
  BOMLevel: number;
  BOMPath: string;
  CurrentParentCode: string;
  CurrentParentName: string;
  RMCode: string;
  RMName: string;
  QtySold: number;
  QtyNeeds: number;
  BOM_UOM: string;
  QtyDenominator: number;
  UnitConversion: number;
  Inv_UOM: string;
  QtyFromQtySold: number;
  IsSubAssembly: boolean;
}

export interface ReportFilters {
  locationName: string;
  startDate: string;
  endDate: string;
  fgItemCode?: string | null;
  fgName?: string | null;
}

export function exportToExcel(
  consolidated: ConsolidatedItem[],
  breakdown: BreakdownItem[],
  filters: ReportFilters
) {
  const wb = XLSX.utils.book_new();

  // 1. Consolidated Sheet
  const consolidatedRows = consolidated.map((item, idx) => ({
    '#': idx + 1,
    'Store Location': item.LocationName,
    'Raw Material Code': item.RMCode,
    'Raw Material Description': item.RMName,
    'Inventory UOM': item.Inv_UOM,
    'Theoretical Required Qty': Number(item.QtyFromQtySold),
    'Actual Consumption (Scoping)': item.ActualQty ?? 'Pending scoping',
    'Variance (Scoping)': item.Variance ?? 'Pending scoping',
  }));

  const wsConsolidated = XLSX.utils.json_to_sheet(consolidatedRows);
  XLSX.utils.book_append_sheet(wb, wsConsolidated, 'Consolidated Raw Materials');

  // 2. Breakdown Sheet
  if (breakdown.length > 0) {
    const breakdownRows = breakdown.map((item, idx) => ({
      '#': idx + 1,
      Level: item.BOMLevel,
      'BOM Path': item.BOMPath,
      'Parent Item Code': item.CurrentParentCode,
      'Parent Item Name': item.CurrentParentName,
      'Component Code': item.RMCode,
      'Component Description': item.RMName,
      'Qty Sold': Number(item.QtySold),
      'Qty Needs': Number(item.QtyNeeds),
      'BOM UOM': item.BOM_UOM,
      Denominator: Number(item.QtyDenominator),
      'Unit Conversion': Number(item.UnitConversion),
      'Inv UOM': item.Inv_UOM,
      'Calculated Qty': Number(item.QtyFromQtySold),
      'Is SubAssembly': item.IsSubAssembly ? 'Yes' : 'No',
    }));

    const wsBreakdown = XLSX.utils.json_to_sheet(breakdownRows);
    XLSX.utils.book_append_sheet(wb, wsBreakdown, 'Recipe Breakdown Trace');
  }

  const filename = `BOM_Requirements_${filters.locationName}_${filters.startDate}_to_${filters.endDate}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export function exportToPdf(
  consolidated: ConsolidatedItem[],
  breakdown: BreakdownItem[],
  filters: ReportFilters
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  // Header Title
  doc.setFontSize(16);
  doc.setTextColor(17, 28, 53); // Navy
  doc.text('Theoretical BOM Requirements Report', 40, 40);

  // Metadata Subtitle
  doc.setFontSize(10);
  doc.setTextColor(100, 110, 130);
  const fgLabel = filters.fgName ? `${filters.fgName} (${filters.fgItemCode})` : 'All Finished Goods';
  doc.text(
    `Store: ${filters.locationName}   |   Period: ${filters.startDate} to ${filters.endDate}   |   Finished Good: ${fgLabel}`,
    40,
    58
  );
  doc.text(`Generated: ${new Date().toLocaleString()}   |   Confidential - Internal LAN`, 40, 72);

  // Section 1: Consolidated Table
  doc.setFontSize(12);
  doc.setTextColor(17, 28, 53);
  doc.text('1. Consolidated Raw Material Requirements', 40, 95);

  const consolidatedTableData = consolidated.map((item, idx) => [
    idx + 1,
    item.RMCode,
    item.RMName,
    item.Inv_UOM,
    Number(item.QtyFromQtySold).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }),
    'Scoping',
    'Scoping',
  ]);

  autoTable(doc, {
    startY: 105,
    head: [['#', 'RM Code', 'Raw Material Description', 'UOM', 'Theoretical Qty', 'Actual Qty', 'Variance']],
    body: consolidatedTableData,
    theme: 'grid',
    headStyles: { fillColor: [37, 52, 84], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [30, 40, 60] },
    alternateRowStyles: { fillColor: [248, 250, 253] },
    margin: { left: 40, right: 40 },
  });

  // Section 2: Recipe Breakdown Table (on new page if present)
  if (breakdown.length > 0) {
    doc.addPage();
    doc.setFontSize(14);
    doc.setTextColor(17, 28, 53);
    doc.text('2. Multi-Level Recipe Breakdown Trace', 40, 40);

    doc.setFontSize(9);
    doc.setTextColor(100, 110, 130);
    doc.text(`Calculation cascade: ((QtyNeeds / QtyDenominator) * ParentQty) / UnitConversion`, 40, 56);

    const breakdownTableData = breakdown.map((item, idx) => [
      idx + 1,
      item.BOMLevel,
      item.CurrentParentName,
      item.RMName,
      item.Inv_UOM,
      Number(item.QtySold).toLocaleString(),
      Number(item.QtyNeeds).toFixed(4),
      Number(item.QtyDenominator || 1).toFixed(2),
      Number(item.UnitConversion || 1).toFixed(4),
      Number(item.QtyFromQtySold).toFixed(4),
      item.IsSubAssembly ? 'SubAssembly' : 'Raw Mat',
    ]);

    autoTable(doc, {
      startY: 70,
      head: [
        [
          '#',
          'Lvl',
          'Parent Product',
          'Component / Material',
          'UOM',
          'Qty Sold',
          'Needs',
          'Denom',
          'Conv',
          'Calc Qty',
          'Type',
        ],
      ],
      body: breakdownTableData,
      theme: 'grid',
      headStyles: { fillColor: [37, 52, 84], textColor: 255, fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7, textColor: [30, 40, 60] },
      alternateRowStyles: { fillColor: [248, 250, 253] },
      margin: { left: 40, right: 40 },
    });
  }

  const filename = `BOM_Requirements_${filters.locationName}_${filters.startDate}_to_${filters.endDate}.pdf`;
  doc.save(filename);
}
