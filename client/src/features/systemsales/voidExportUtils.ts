import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface VoidTransactionRecord {
  transdatetime: string;
  grossSale: number;
  posname: string;
  checknum: string;
}

export interface VoidTransactionItem {
  fcrInvNum: string;
  checkNum: string;
  posName: string;
  businessDate: string;
  startTime: string;
  voidTime: string;
  intervalSeconds: number;
  intervalFormatted: string;
  voidAmount: number;
  transactionCount: number;
  records: VoidTransactionRecord[];
}

export interface VoidTransactionsSummary {
  totalVoidCount: number;
  totalVoidAmount: number;
  avgIntervalSeconds: number;
  avgIntervalFormatted: string;
}

export interface VoidTransactionsData {
  locationName: string;
  dateFrom: string;
  dateTo: string;
  summary: VoidTransactionsSummary;
  items: VoidTransactionItem[];
}

export interface CancelItemRow {
  locationName: string;
  businessDate: string;
  transDatetime: string;
  fcrInvNum: string;
  checkNum: string;
  itemNumber: string;
  itemName: string;
  lineCount: number;
  rawLineCount: number;
  lineTotal: number;
  rawLineTotal: number;
}

export interface CancelItemsSummary {
  totalCancelledQty: number;
  totalCancelledAmount: number;
  rowCount: number;
  uniqueChecks: number;
}

export interface CancelItemsData {
  locationName: string;
  dateFrom: string;
  dateTo: string;
  summary: CancelItemsSummary;
  items: CancelItemRow[];
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
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

function downloadCsvBlob(content: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export Void Transactions to Excel (.xlsx)
 */
export function exportVoidTransactionsToExcel(data: VoidTransactionsData): void {
  const { locationName, dateFrom, dateTo, summary, items } = data;
  const wb = XLSX.utils.book_new();

  // --- SHEET 1: Summary & Invoice List ---
  const summaryRows: Array<Array<string | number>> = [];
  summaryRows.push(['SYSTEM SALES - VOID TRANSACTIONS REPORT']);
  summaryRows.push(['Store / Location:', locationName]);
  summaryRows.push(['Business Date Range:', `${dateFrom} to ${dateTo}`]);
  summaryRows.push(['Generated At:', new Date().toLocaleString('en-PH')]);
  summaryRows.push([]);

  summaryRows.push(['METRIC', 'VALUE']);
  summaryRows.push(['Total Void Invoices', summary.totalVoidCount]);
  summaryRows.push(['Total Void Amount (PHP)', summary.totalVoidAmount]);
  summaryRows.push(['Average Void Process Interval', summary.avgIntervalFormatted]);
  summaryRows.push([]);

  summaryRows.push([
    'Business Date',
    'Invoice Number',
    'Check #',
    'POS Terminal',
    'Start Time',
    'Void Time',
    'Void Interval',
    'Interval (Seconds)',
    'Void Amount (PHP)',
    'Log Entries',
  ]);

  for (const item of items) {
    summaryRows.push([
      item.businessDate,
      item.fcrInvNum,
      item.checkNum,
      item.posName,
      item.startTime,
      item.voidTime,
      item.intervalFormatted,
      item.intervalSeconds,
      item.voidAmount,
      item.transactionCount,
    ]);
  }

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 14 },
    { wch: 22 },
    { wch: 14 },
    { wch: 16 },
    { wch: 20 },
    { wch: 20 },
    { wch: 15 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Void Invoices');

  // --- SHEET 2: Transaction Audit Logs ---
  const logRows: Array<Array<string | number>> = [];
  logRows.push([
    'Invoice Number',
    'Check #',
    'POS Terminal',
    'Transaction Datetime',
    'Gross Sale (PHP)',
  ]);

  for (const item of items) {
    for (const rec of item.records) {
      logRows.push([
        item.fcrInvNum,
        rec.checknum || item.checkNum,
        rec.posname || item.posName,
        rec.transdatetime,
        rec.grossSale,
      ]);
    }
  }

  const wsLogs = XLSX.utils.aoa_to_sheet(logRows);
  wsLogs['!cols'] = [
    { wch: 22 },
    { wch: 14 },
    { wch: 16 },
    { wch: 22 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsLogs, 'Audit Log Details');

  const fileName = `Void_Transactions_${sanitizeFileName(locationName)}_${dateFrom}_to_${dateTo}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Export Void Transactions to PDF (.pdf)
 */
export function exportVoidTransactionsToPdf(data: VoidTransactionsData): void {
  const { locationName, dateFrom, dateTo, summary, items } = data;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Title Block
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55); // #1F2937
  doc.text('J.CO DONUTS & COFFEE', 40, 40);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(55, 65, 81); // #374151
  doc.text('System Sales - Void Transactions Report', 40, 58);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128); // #6B7280
  doc.text(
    `Store: ${locationName}    |    Period: ${dateFrom} to ${dateTo}    |    Generated: ${new Date().toLocaleString('en-PH')}`,
    40,
    74
  );

  // Horizontal divider line
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(1);
  doc.line(40, 83, pageWidth - 40, 83);

  let currentY = 96;

  // KPI Summary Strip (Table)
  autoTable(doc, {
    startY: currentY,
    margin: { left: 40, right: 40 },
    theme: 'grid',
    head: [['TOTAL VOID COUNT', 'TOTAL VOID AMOUNT (PHP)', 'AVG VOID PROCESS INTERVAL']],
    body: [
      [
        `${formatInt(summary.totalVoidCount)} Invoices`,
        `PHP ${formatMoney(summary.totalVoidAmount)}`,
        summary.avgIntervalFormatted || '0s',
      ],
    ],
    headStyles: {
      fillColor: [31, 41, 55],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
    },
    styles: {
      fontSize: 10,
      fontStyle: 'bold',
      cellPadding: 6,
      halign: 'center',
      textColor: [17, 24, 39],
    },
  });

  currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;

  // Table Data Rows
  const tableBody = items.map((i) => [
    i.businessDate,
    i.fcrInvNum,
    i.checkNum,
    i.posName,
    i.startTime,
    i.voidTime,
    i.intervalFormatted,
    `PHP ${formatMoney(i.voidAmount)}`,
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: 40, right: 40 },
    theme: 'striped',
    head: [
      [
        'BUSINESS DATE',
        'INVOICE NUMBER',
        'CHECK #',
        'POS TERMINAL',
        'START TIME',
        'VOID TIME',
        'VOID INTERVAL',
        'VOID AMOUNT',
      ],
    ],
    body: tableBody,
    foot: [
      [
        'TOTAL',
        `${items.length} Invoices`,
        '',
        '',
        '',
        '',
        `Avg: ${summary.avgIntervalFormatted || '0s'}`,
        `PHP ${formatMoney(summary.totalVoidAmount)}`,
      ],
    ],
    headStyles: {
      fillColor: [55, 65, 81],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    footStyles: {
      fillColor: [243, 244, 246],
      textColor: [17, 24, 39],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    styles: {
      fontSize: 8,
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 110, fontStyle: 'bold' },
      2: { cellWidth: 60 },
      3: { cellWidth: 80 },
      4: { cellWidth: 110 },
      5: { cellWidth: 110 },
      6: { cellWidth: 85, halign: 'center' },
      7: { halign: 'right', fontStyle: 'bold', textColor: [185, 28, 28] },
    },
    didDrawPage: (dataHook) => {
      // Footer page numbering
      const pageStr = `Page ${dataHook.pageNumber}`;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(156, 163, 175);
      doc.text(
        pageStr,
        pageWidth - 40,
        doc.internal.pageSize.getHeight() - 20,
        { align: 'right' }
      );
    },
  });

  const fileName = `Void_Transactions_${sanitizeFileName(locationName)}_${dateFrom}_to_${dateTo}.pdf`;
  doc.save(fileName);
}

/**
 * Export Void Transactions to CSV (internal support)
 */
export function exportVoidTransactionsToCsv(data: VoidTransactionsData): void {
  const { locationName, dateFrom, dateTo, items } = data;
  const headers = [
    'Business Date',
    'Invoice Number',
    'Check #',
    'POS Terminal',
    'Start Time',
    'Void Time',
    'Void Interval',
    'Interval Seconds',
    'Void Amount',
  ];

  const rows = items.map((i) => [
    `"${i.businessDate}"`,
    `"${i.fcrInvNum}"`,
    `"${i.checkNum}"`,
    `"${i.posName}"`,
    `"${i.startTime}"`,
    `"${i.voidTime}"`,
    `"${i.intervalFormatted}"`,
    i.intervalSeconds,
    i.voidAmount.toFixed(2),
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const fileName = `Void_Transactions_${sanitizeFileName(locationName)}_${dateFrom}_to_${dateTo}.csv`;
  downloadCsvBlob(csvContent, fileName);
}

/**
 * Export Cancel Items to Excel (.xlsx)
 */
export function exportCancelItemsToExcel(data: CancelItemsData): void {
  const { locationName, dateFrom, dateTo, summary, items } = data;
  const wb = XLSX.utils.book_new();

  const rows: Array<Array<string | number>> = [];
  rows.push(['SYSTEM SALES - CANCEL ITEMS REPORT']);
  rows.push(['Store / Location:', locationName]);
  rows.push(['Business Date Range:', `${dateFrom} to ${dateTo}`]);
  rows.push(['Generated At:', new Date().toLocaleString('en-PH')]);
  rows.push([]);

  rows.push(['METRIC', 'VALUE']);
  rows.push(['Total Cancelled Quantity', summary.totalCancelledQty]);
  rows.push(['Total Cancelled Amount (PHP)', summary.totalCancelledAmount]);
  rows.push(['Affected Invoices / Checks', summary.uniqueChecks]);
  rows.push(['Total Cancelled Line Items', summary.rowCount]);
  rows.push([]);

  rows.push([
    'Business Date',
    'Transaction Time',
    'Invoice Number',
    'Check #',
    'Item Number',
    'Item Name',
    'Cancelled Qty',
    'Cancelled Amount (PHP)',
  ]);

  for (const item of items) {
    rows.push([
      item.businessDate,
      item.transDatetime,
      item.fcrInvNum,
      item.checkNum,
      item.itemNumber,
      item.itemName,
      item.lineCount,
      item.lineTotal,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 14 },
    { wch: 20 },
    { wch: 22 },
    { wch: 14 },
    { wch: 16 },
    { wch: 32 },
    { wch: 16 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Cancel Items');

  const fileName = `Cancel_Items_${sanitizeFileName(locationName)}_${dateFrom}_to_${dateTo}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Export Cancel Items to PDF (.pdf)
 */
export function exportCancelItemsToPdf(data: CancelItemsData): void {
  const { locationName, dateFrom, dateTo, summary, items } = data;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Title Block
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text('J.CO DONUTS & COFFEE', 40, 40);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(55, 65, 81);
  doc.text('System Sales - Cancelled Items Report', 40, 58);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text(
    `Store: ${locationName}    |    Period: ${dateFrom} to ${dateTo}    |    Generated: ${new Date().toLocaleString('en-PH')}`,
    40,
    74
  );

  // Horizontal divider
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(1);
  doc.line(40, 83, pageWidth - 40, 83);

  let currentY = 96;

  // KPI Summary Strip
  autoTable(doc, {
    startY: currentY,
    margin: { left: 40, right: 40 },
    theme: 'grid',
    head: [
      [
        'TOTAL CANCELLED QTY',
        'TOTAL CANCELLED AMOUNT (PHP)',
        'AFFECTED INVOICES',
        'TOTAL LINE ITEMS',
      ],
    ],
    body: [
      [
        `${formatInt(summary.totalCancelledQty)} Items`,
        `PHP ${formatMoney(summary.totalCancelledAmount)}`,
        `${formatInt(summary.uniqueChecks)} Invoices`,
        `${formatInt(summary.rowCount)} Rows`,
      ],
    ],
    headStyles: {
      fillColor: [31, 41, 55],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
    },
    styles: {
      fontSize: 10,
      fontStyle: 'bold',
      cellPadding: 6,
      halign: 'center',
      textColor: [17, 24, 39],
    },
  });

  currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;

  const tableBody = items.map((i) => [
    i.businessDate,
    i.transDatetime,
    i.fcrInvNum,
    i.checkNum,
    i.itemNumber,
    i.itemName,
    `-${i.lineCount}`,
    `-PHP ${formatMoney(i.lineTotal)}`,
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: 40, right: 40 },
    theme: 'striped',
    head: [
      [
        'BUSINESS DATE',
        'TIME',
        'INVOICE NUMBER',
        'CHECK #',
        'ITEM CODE',
        'ITEM DESCRIPTION',
        'QTY',
        'CANCEL AMOUNT',
      ],
    ],
    body: tableBody,
    foot: [
      [
        'TOTAL',
        '',
        '',
        '',
        '',
        `${items.length} line items`,
        `-${formatInt(summary.totalCancelledQty)}`,
        `-PHP ${formatMoney(summary.totalCancelledAmount)}`,
      ],
    ],
    headStyles: {
      fillColor: [55, 65, 81],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    footStyles: {
      fillColor: [243, 244, 246],
      textColor: [17, 24, 39],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    styles: {
      fontSize: 8,
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 105 },
      2: { cellWidth: 100, fontStyle: 'bold' },
      3: { cellWidth: 55 },
      4: { cellWidth: 70 },
      5: { cellWidth: 170 },
      6: { cellWidth: 50, halign: 'center', textColor: [185, 28, 28], fontStyle: 'bold' },
      7: { halign: 'right', fontStyle: 'bold', textColor: [185, 28, 28] },
    },
    didDrawPage: (dataHook) => {
      const pageStr = `Page ${dataHook.pageNumber}`;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(156, 163, 175);
      doc.text(
        pageStr,
        pageWidth - 40,
        doc.internal.pageSize.getHeight() - 20,
        { align: 'right' }
      );
    },
  });

  const fileName = `Cancel_Items_${sanitizeFileName(locationName)}_${dateFrom}_to_${dateTo}.pdf`;
  doc.save(fileName);
}

/**
 * Export Combined Void Summary Report to Excel (.xlsx)
 * Contains Void Invoices, Audit Log Details, and Cancelled Items in a single workbook
 */
export function exportCombinedVoidReportToExcel(params: {
  voidData: VoidTransactionsData | null;
  cancelData: CancelItemsData | null;
  locationName: string;
  dateFrom: string;
  dateTo: string;
}): void {
  const { voidData, cancelData, locationName, dateFrom, dateTo } = params;
  const wb = XLSX.utils.book_new();

  // Sheet 1: Void Invoices
  if (voidData && voidData.items.length > 0) {
    const summaryRows: Array<Array<string | number>> = [];
    summaryRows.push(['SYSTEM SALES - VOID TRANSACTIONS']);
    summaryRows.push(['Store / Location:', locationName]);
    summaryRows.push(['Business Date Range:', `${dateFrom} to ${dateTo}`]);
    summaryRows.push(['Generated At:', new Date().toLocaleString('en-PH')]);
    summaryRows.push([]);
    summaryRows.push(['METRIC', 'VALUE']);
    summaryRows.push(['Total Void Invoices', voidData.summary.totalVoidCount]);
    summaryRows.push(['Total Void Amount (PHP)', voidData.summary.totalVoidAmount]);
    summaryRows.push(['Average Void Process Interval', voidData.summary.avgIntervalFormatted]);
    summaryRows.push([]);
    summaryRows.push([
      'Business Date',
      'Invoice Number',
      'Check #',
      'POS Terminal',
      'Start Time',
      'Void Time',
      'Void Interval',
      'Interval (Seconds)',
      'Void Amount (PHP)',
      'Log Entries',
    ]);
    for (const item of voidData.items) {
      summaryRows.push([
        item.businessDate,
        item.fcrInvNum,
        item.checkNum,
        item.posName,
        item.startTime,
        item.voidTime,
        item.intervalFormatted,
        item.intervalSeconds,
        item.voidAmount,
        item.transactionCount,
      ]);
    }
    const wsVoid = XLSX.utils.aoa_to_sheet(summaryRows);
    wsVoid['!cols'] = [
      { wch: 14 },
      { wch: 22 },
      { wch: 14 },
      { wch: 16 },
      { wch: 20 },
      { wch: 20 },
      { wch: 15 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, wsVoid, 'Void Invoices');

    // Sheet 2: Audit Logs
    const logRows: Array<Array<string | number>> = [];
    logRows.push([
      'Invoice Number',
      'Check #',
      'POS Terminal',
      'Transaction Datetime',
      'Gross Sale (PHP)',
    ]);
    for (const item of voidData.items) {
      for (const rec of item.records) {
        logRows.push([
          item.fcrInvNum,
          rec.checknum || item.checkNum,
          rec.posname || item.posName,
          rec.transdatetime,
          rec.grossSale,
        ]);
      }
    }
    const wsLogs = XLSX.utils.aoa_to_sheet(logRows);
    wsLogs['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsLogs, 'Audit Log Details');
  }

  // Sheet 3: Cancel Items
  if (cancelData && cancelData.items.length > 0) {
    const cancelRows: Array<Array<string | number>> = [];
    cancelRows.push(['SYSTEM SALES - CANCELLED ITEMS']);
    cancelRows.push(['Store / Location:', locationName]);
    cancelRows.push(['Business Date Range:', `${dateFrom} to ${dateTo}`]);
    cancelRows.push(['Generated At:', new Date().toLocaleString('en-PH')]);
    cancelRows.push([]);
    cancelRows.push([
      'Business Date',
      'Transaction Time',
      'Invoice Number',
      'Check #',
      'Item Number',
      'Item Name',
      'Cancelled Qty',
      'Cancelled Amount (PHP)',
    ]);
    for (const item of cancelData.items) {
      cancelRows.push([
        item.businessDate,
        item.transDatetime,
        item.fcrInvNum,
        item.checkNum,
        item.itemNumber,
        item.itemName,
        item.lineCount,
        item.lineTotal,
      ]);
    }
    const wsCancel = XLSX.utils.aoa_to_sheet(cancelRows);
    wsCancel['!cols'] = [
      { wch: 14 },
      { wch: 20 },
      { wch: 22 },
      { wch: 14 },
      { wch: 16 },
      { wch: 32 },
      { wch: 16 },
      { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(wb, wsCancel, 'Cancelled Items');
  }

  const fileName = `Void_Summary_${sanitizeFileName(locationName)}_${dateFrom}_to_${dateTo}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Export Combined Void Summary Report to PDF (.pdf)
 */
export function exportCombinedVoidReportToPdf(params: {
  voidData: VoidTransactionsData | null;
  cancelData: CancelItemsData | null;
  locationName: string;
  dateFrom: string;
  dateTo: string;
}): void {
  const { voidData, cancelData, locationName, dateFrom, dateTo } = params;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text('J.CO DONUTS & COFFEE', 40, 40);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(55, 65, 81);
  doc.text('System Sales - Void Summary Report', 40, 58);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text(
    `Store: ${locationName}    |    Period: ${dateFrom} to ${dateTo}    |    Generated: ${new Date().toLocaleString('en-PH')}`,
    40,
    74
  );

  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(1);
  doc.line(40, 83, pageWidth - 40, 83);

  let currentY = 96;

  // 1. Void Transactions Section
  if (voidData && voidData.items.length > 0) {
    autoTable(doc, {
      startY: currentY,
      margin: { left: 40, right: 40 },
      theme: 'grid',
      head: [['TOTAL VOID COUNT', 'TOTAL VOID AMOUNT (PHP)', 'AVG VOID PROCESS INTERVAL']],
      body: [
        [
          `${formatInt(voidData.summary.totalVoidCount)} Invoices`,
          `PHP ${formatMoney(voidData.summary.totalVoidAmount)}`,
          voidData.summary.avgIntervalFormatted || '0s',
        ],
      ],
      headStyles: {
        fillColor: [31, 41, 55],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'center',
      },
      styles: {
        fontSize: 10,
        fontStyle: 'bold',
        cellPadding: 6,
        halign: 'center',
        textColor: [17, 24, 39],
      },
    });

    currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text(`1. Void Transactions (${voidData.items.length} Invoices)`, 40, currentY);
    currentY += 8;

    const voidBody = voidData.items.map((i) => [
      i.businessDate,
      i.fcrInvNum,
      i.checkNum,
      i.posName,
      i.startTime,
      i.voidTime,
      i.intervalFormatted,
      `PHP ${formatMoney(i.voidAmount)}`,
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: 40, right: 40 },
      theme: 'striped',
      head: [
        [
          'BUSINESS DATE',
          'INVOICE NUMBER',
          'CHECK #',
          'POS TERMINAL',
          'START TIME',
          'VOID TIME',
          'VOID INTERVAL',
          'VOID AMOUNT',
        ],
      ],
      body: voidBody,
      foot: [
        [
          'TOTAL',
          `${voidData.items.length} Invoices`,
          '',
          '',
          '',
          '',
          `Avg: ${voidData.summary.avgIntervalFormatted || '0s'}`,
          `PHP ${formatMoney(voidData.summary.totalVoidAmount)}`,
        ],
      ],
      headStyles: {
        fillColor: [55, 65, 81],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      footStyles: {
        fillColor: [243, 244, 246],
        textColor: [17, 24, 39],
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      styles: { fontSize: 8, cellPadding: 3.5 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 110, fontStyle: 'bold' },
        2: { cellWidth: 60 },
        3: { cellWidth: 80 },
        4: { cellWidth: 110 },
        5: { cellWidth: 110 },
        6: { cellWidth: 85, halign: 'center' },
        7: { halign: 'right', fontStyle: 'bold', textColor: [185, 28, 28] },
      },
    });

    currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22;
  }

  // 2. Cancelled Items Section
  if (cancelData && cancelData.items.length > 0) {
    if (currentY > doc.internal.pageSize.getHeight() - 140) {
      doc.addPage();
      currentY = 40;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text(`2. Cancelled Items (${cancelData.items.length} Line Items)`, 40, currentY);
    currentY += 8;

    const cancelBody = cancelData.items.map((i) => [
      i.businessDate,
      i.transDatetime,
      i.fcrInvNum,
      i.checkNum,
      i.itemNumber,
      i.itemName,
      `-${i.lineCount}`,
      `-PHP ${formatMoney(i.lineTotal)}`,
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: 40, right: 40 },
      theme: 'striped',
      head: [
        [
          'BUSINESS DATE',
          'TIME',
          'INVOICE NUMBER',
          'CHECK #',
          'ITEM CODE',
          'ITEM DESCRIPTION',
          'QTY',
          'CANCEL AMOUNT',
        ],
      ],
      body: cancelBody,
      foot: [
        [
          'TOTAL',
          '',
          '',
          '',
          '',
          `${cancelData.items.length} line items`,
          `-${formatInt(cancelData.summary.totalCancelledQty)}`,
          `-PHP ${formatMoney(cancelData.summary.totalCancelledAmount)}`,
        ],
      ],
      headStyles: {
        fillColor: [55, 65, 81],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      footStyles: {
        fillColor: [243, 244, 246],
        textColor: [17, 24, 39],
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      styles: { fontSize: 8, cellPadding: 3.5 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 105 },
        2: { cellWidth: 100, fontStyle: 'bold' },
        3: { cellWidth: 55 },
        4: { cellWidth: 70 },
        5: { cellWidth: 170 },
        6: { cellWidth: 50, halign: 'center', textColor: [185, 28, 28], fontStyle: 'bold' },
        7: { halign: 'right', fontStyle: 'bold', textColor: [185, 28, 28] },
      },
    });
  }

  // Page numbering
  const totalPages = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - 40,
      doc.internal.pageSize.getHeight() - 20,
      { align: 'right' }
    );
  }

  const fileName = `Void_Summary_${sanitizeFileName(locationName)}_${dateFrom}_to_${dateTo}.pdf`;
  doc.save(fileName);
}

/**
 * Export Cancel Items to CSV (internal support)
 */
export function exportCancelItemsToCsv(data: CancelItemsData): void {
  const { locationName, dateFrom, dateTo, items } = data;
  const headers = [
    'Business Date',
    'Transaction Time',
    'Invoice Number',
    'Check #',
    'Item Number',
    'Item Name',
    'Cancelled Qty',
    'Cancelled Amount',
  ];

  const rows = items.map((i) => [
    `"${i.businessDate}"`,
    `"${i.transDatetime}"`,
    `"${i.fcrInvNum}"`,
    `"${i.checkNum}"`,
    `"${i.itemNumber}"`,
    `"${i.itemName.replace(/"/g, '""')}"`,
    i.lineCount,
    i.lineTotal.toFixed(2),
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const fileName = `Cancel_Items_${sanitizeFileName(locationName)}_${dateFrom}_to_${dateTo}.csv`;
  downloadCsvBlob(csvContent, fileName);
}
