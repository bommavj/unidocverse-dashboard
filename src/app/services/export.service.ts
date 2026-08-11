import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Injectable({
  providedIn: 'root'
})
export class ExportService {

  constructor() { }

  // =========================================
  // 1. EXCEL - Single Sheet
  // =========================================
  
  exportToExcel(data: any[], fileName: string = 'export', sheetName: string = 'Data'): void {
    if (!data || data.length === 0) {
      this.showWarning('No data to export');
      return;
    }

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    
    // Auto-size columns
    const maxWidth = 50;
    const wscols = Object.keys(data[0] || {}).map(key => ({
      wch: Math.min(Math.max(key.length, 10), maxWidth)
    }));
    worksheet['!cols'] = wscols;

    const workbook: XLSX.WorkBook = {
      Sheets: { [sheetName]: worksheet },
      SheetNames: [sheetName]
    };
    
    const excelBuffer: any = XLSX.write(workbook, { 
      bookType: 'xlsx', 
      type: 'array' 
    });
    
    const blob: Blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    saveAs(blob, `${fileName}_${this.getTimestamp()}.xlsx`);
  }

  // =========================================
  // 2. EXCEL - Multiple Sheets (Full Report)
  // =========================================
  
  exportMultipleSheetsToExcel(
    sheets: { name: string, data: any[] }[], 
    fileName: string = 'report'
  ): void {
    if (!sheets || sheets.length === 0) {
      this.showWarning('No sheets to export');
      return;
    }

    const workbook: XLSX.WorkBook = {
      Sheets: {},
      SheetNames: []
    };

    sheets.forEach(sheet => {
      if (sheet.data && sheet.data.length > 0) {
        const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(sheet.data);
        
        // Auto-size columns
        const maxWidth = 50;
        const wscols = Object.keys(sheet.data[0] || {}).map(key => ({
          wch: Math.min(Math.max(key.length, 10), maxWidth)
        }));
        worksheet['!cols'] = wscols;
        
        // Excel sheet name max 31 chars
        const sheetName = sheet.name.substring(0, 31);
        workbook.Sheets[sheetName] = worksheet;
        workbook.SheetNames.push(sheetName);
      }
    });

    if (workbook.SheetNames.length === 0) {
      this.showWarning('No data available in any sheet');
      return;
    }

    const excelBuffer: any = XLSX.write(workbook, { 
      bookType: 'xlsx', 
      type: 'array' 
    });
    
    const blob: Blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    saveAs(blob, `${fileName}_${this.getTimestamp()}.xlsx`);
  }

  // =========================================
  // 3. CSV - Simple Export
  // =========================================
  
  exportToCSV(data: any[], fileName: string = 'export'): void {
    if (!data || data.length === 0) {
      this.showWarning('No data to export');
      return;
    }

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    const csv: string = XLSX.utils.sheet_to_csv(worksheet);
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${fileName}_${this.getTimestamp()}.csv`);
  }

  // =========================================
  // 4. PDF - Single Table
  // =========================================
  
  exportToPDF(
    data: any[], 
    fileName: string = 'export',
    title?: string,
    orientation: 'portrait' | 'landscape' = 'portrait'
  ): void {
    if (!data || data.length === 0) {
      this.showWarning('No data to export');
      return;
    }

    const doc = new jsPDF(orientation);
    
    // Add title and metadata
    if (title) {
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(title, 14, 20);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
      doc.setTextColor(0);
    }

    // Extract columns
    const columns = Object.keys(data[0] || {});
    const headers = columns.map(col => this.humanize(col));

    // Prepare table data
    const tableData = data.map(row => 
      columns.map(col => this.formatPDFValue(row[col]))
    );

    // Add table
    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: title ? 35 : 15,
      theme: 'striped',
      styles: { 
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak',
        halign: 'left'
      },
      headStyles: { 
        fillColor: [59, 130, 246],
        fontStyle: 'bold',
        halign: 'center'
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250]
      },
      margin: { top: 10, right: 10, bottom: 10, left: 10 }
    });

    // Add page numbers
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }

    doc.save(`${fileName}_${this.getTimestamp()}.pdf`);
  }

  // =========================================
  // 5. PDF - Full Report with Multiple Sections
  // =========================================
  
  exportFullReportToPDF(
    sections: {
      title: string,
      data: any[],
      description?: string,
      chartImage?: string  // ← NEW: optional base64 chart image
    }[],
    fileName: string = 'report',
    reportTitle: string = 'Analytics Report',
    metadata?: {
      documentId?: string,
      documentType?: string,
      generatedBy?: string
    }
  ): void {
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    let currentY = 20;

    // ===== COVER PAGE =====
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(reportTitle, 105, currentY, { align: 'center' });
    currentY += 15;

    // Metadata
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    
    if (metadata?.documentId) {
      doc.text(`Document ID: ${metadata.documentId}`, 105, currentY, { align: 'center' });
      currentY += 6;
    }
    
    if (metadata?.documentType) {
      doc.text(`Document Type: ${metadata.documentType}`, 105, currentY, { align: 'center' });
      currentY += 6;
    }
    
    doc.text(`Generated: ${new Date().toLocaleString()}`, 105, currentY, { align: 'center' });
    currentY += 6;
    
    if (metadata?.generatedBy) {
      doc.text(`Generated By: ${metadata.generatedBy}`, 105, currentY, { align: 'center' });
    }

    doc.setTextColor(0);

    // Add separator line
    currentY += 10;
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.5);
    doc.line(20, currentY, 190, currentY);

    // ===== TABLE OF CONTENTS =====
    currentY += 15;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Table of Contents', 14, currentY);
    currentY += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    sections.forEach((section, index) => {
      if (section.data && section.data.length > 0) {
        doc.text(`${index + 1}. ${section.title}`, 20, currentY);
        doc.text(`${section.data.length} records`, 150, currentY);
        currentY += 6;
      }
    });

    // ===== SECTIONS =====
    sections.forEach((section, index) => {
      if (section.data && section.data.length > 0) {
        doc.addPage();
        currentY = 20;

        // Section title
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(59, 130, 246);
        doc.text(`${index + 1}. ${section.title}`, 14, currentY);
        doc.setTextColor(0);
        currentY += 8;

        // Section description
        if (section.description) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(100);
          doc.text(section.description, 14, currentY);
          doc.setTextColor(0);
          currentY += 6;
        }

        // ✅ NEW: Add chart image if present
        if (section.chartImage) {
          try {
            const imgWidth = 170;  // mm (fits A4 with margins)
            const imgHeight = 100; // mm

            // Check if image will fit on current page
            if (currentY + imgHeight + 20 > pageHeight) {
              doc.addPage();
              currentY = 20;
            }

            doc.addImage(section.chartImage, 'PNG', 14, currentY, imgWidth, imgHeight);
            currentY += imgHeight + 10;
          } catch (err) {
            console.warn('Failed to add chart image:', err);
            // Continue with table-only rendering
          }
        }

        // Add data table
        const columns = Object.keys(section.data[0] || {});
        const headers = columns.map(col => this.humanize(col));
        const tableData = section.data.map(row => 
          columns.map(col => this.formatPDFValue(row[col]))
        );

        // Check if table will fit on current page (estimate)
        if (currentY + 40 > pageHeight) {
          doc.addPage();
          currentY = 20;
        }

        // Add table
        autoTable(doc, {
          head: [headers],
          body: tableData,
          startY: currentY,
          theme: 'striped',
          styles: { 
            fontSize: 7,
            cellPadding: 2
          },
          headStyles: { 
            fillColor: [59, 130, 246],
            fontStyle: 'bold'
          },
          alternateRowStyles: {
            fillColor: [245, 247, 250]
          },
          margin: { top: 10 }
        });

        // Update currentY for next section (in case same page)
        currentY = (doc as any).lastAutoTable.finalY + 15;
      }
    });

    // Add page numbers to all pages
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }

    doc.save(`${fileName}_${this.getTimestamp()}.pdf`);
  }

  // =========================================
  // 6. JSON - Raw Data Export
  // =========================================
  
  exportToJSON(data: any, fileName: string = 'export', pretty: boolean = true): void {
    if (!data) {
      this.showWarning('No data to export');
      return;
    }

    const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    const blob = new Blob([json], { type: 'application/json' });
    saveAs(blob, `${fileName}_${this.getTimestamp()}.json`);
  }

  // =========================================
  // 7. XML - Structured Data Export
  // =========================================
  
  exportToXML(data: any[], fileName: string = 'export', rootName: string = 'data'): void {
    if (!data || data.length === 0) {
      this.showWarning('No data to export');
      return;
    }

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<${rootName}>\n`;
    
    data.forEach(item => {
      xml += '  <record>\n';
      Object.entries(item).forEach(([key, value]) => {
        const sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, '_');
        const sanitizedValue = this.escapeXML(String(value || ''));
        xml += `    <${sanitizedKey}>${sanitizedValue}</${sanitizedKey}>\n`;
      });
      xml += '  </record>\n';
    });
    
    xml += `</${rootName}>`;

    const blob = new Blob([xml], { type: 'application/xml' });
    saveAs(blob, `${fileName}_${this.getTimestamp()}.xml`);
  }

  // =========================================
  // 8. HTML - Formatted Table Export
  // =========================================
  
  exportToHTML(
    data: any[], 
    fileName: string = 'export',
    title: string = 'Data Export'
  ): void {
    if (!data || data.length === 0) {
      this.showWarning('No data to export');
      return;
    }

    const columns = Object.keys(data[0] || {});
    
    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      background: #f5f5f5;
    }
    .header {
      background: #3b82f6;
      color: white;
      padding: 20px;
      margin-bottom: 20px;
      border-radius: 8px;
    }
    h1 {
      margin: 0;
      font-size: 24px;
    }
    .meta {
      font-size: 12px;
      opacity: 0.9;
      margin-top: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      border-radius: 8px;
      overflow: hidden;
    }
    th {
      background: #3b82f6;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      font-size: 14px;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 13px;
    }
    tr:hover {
      background: #f9fafb;
    }
    tr:last-child td {
      border-bottom: none;
    }
    .footer {
      margin-top: 20px;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <div class="meta">Generated: ${new Date().toLocaleString()} | Records: ${data.length}</div>
  </div>
  <table>
    <thead>
      <tr>
        ${columns.map(col => `<th>${this.humanize(col)}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${data.map(row => `
        <tr>
          ${columns.map(col => `<td>${this.escapeHTML(String(row[col] || ''))}</td>`).join('')}
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="footer">
    Exported from Universal Document Analyzer
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    saveAs(blob, `${fileName}_${this.getTimestamp()}.html`);
  }

  // =========================================
  // 9. PRINT - Browser Print
  // =========================================
  
  print(): void {
    window.print();
  }

  // =========================================
  // HELPER METHODS
  // =========================================
  
  private getTimestamp(): string {
    return new Date().getTime().toString();
  }

  private humanize(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  private formatPDFValue(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'number') {
      return value.toLocaleString('en-US', { 
        minimumFractionDigits: 0,
        maximumFractionDigits: 2 
      });
    }
    return String(value);
  }

  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private escapeHTML(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private showWarning(message: string): void {
    console.warn(message);
    alert(message);
  }
}