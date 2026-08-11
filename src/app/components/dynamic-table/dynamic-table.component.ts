import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';

interface TableColumn {
  field: string;
  label: string;
  type: 'string' | 'number' | 'currency' | 'percent' | 'date' | 'boolean';
  align?: 'left' | 'center' | 'right';
  width?: string;
  sortable?: boolean;
}

@Component({
  selector: 'app-dynamic-table',
  templateUrl: './dynamic-table.component.html',
  styleUrls: ['./dynamic-table.component.scss']
})
export class DynamicTableComponent implements OnInit {
  @Input() data: any[] = [];
  @Input() columns: TableColumn[] = [];
  @Input() config: any = {};
  
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  dataSource!: MatTableDataSource<any>;
  displayedColumns: string[] = [];
  isLoading = true;
  hasError = false;
  errorMessage = '';

  // Pagination settings
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50, 100];

  ngOnInit() {
    this.initializeTable();
  }

  ngAfterViewInit() {
    if (this.dataSource) {
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    }
  }

  private initializeTable(): void {
    try {
      // Validate inputs
      if (!this.data || this.data.length === 0) {
        this.hasError = true;
        this.errorMessage = 'No data available';
        this.isLoading = false;
        return;
      }

      if (!this.columns || this.columns.length === 0) {
        // Auto-generate columns from first data row
        this.columns = this.generateColumnsFromData(this.data[0]);
      }

      // Set displayed columns
      this.displayedColumns = this.columns.map(col => col.field);

      // Initialize data source
      this.dataSource = new MatTableDataSource(this.data);
      
      // Custom filter predicate
      this.dataSource.filterPredicate = (data: any, filter: string) => {
        const searchStr = filter.toLowerCase();
        return this.columns.some(col => {
          const value = this.getFieldValue(data, col.field);
          return String(value).toLowerCase().includes(searchStr);
        });
      };

      // Custom sort
      this.dataSource.sortingDataAccessor = (item: any, property: string) => {
        return this.getFieldValue(item, property);
      };

      this.isLoading = false;
      this.hasError = false;
    } catch (error) {
      console.error('Table initialization error:', error);
      this.hasError = true;
      this.errorMessage = 'Failed to initialize table';
      this.isLoading = false;
    }
  }

  private generateColumnsFromData(row: any): TableColumn[] {
    return Object.keys(row).map(key => ({
      field: key,
      label: this.humanizeKey(key),
      type: this.inferType(row[key]),
      align: 'left',
      sortable: true
    }));
  }

  private humanizeKey(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  private inferType(value: any): TableColumn['type'] {
    if (typeof value === 'number') {
      return 'number';
    }
    if (typeof value === 'boolean') {
      return 'boolean';
    }
    if (value instanceof Date || /^\d{4}-\d{2}-\d{2}/.test(String(value))) {
      return 'date';
    }
    return 'string';
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  getFieldValue(row: any, field: string): any {
    if (!row) return '';
    
    // Handle nested fields (e.g., 'address.city')
    const fields = field.split('.');
    let value = row;
    
    for (const f of fields) {
      value = value?.[f];
      if (value === undefined) break;
    }
    
    return value;
  }

  formatCellValue(row: any, column: TableColumn): string {
    const value = this.getFieldValue(row, column.field);
    
    if (value === null || value === undefined) {
      return '—';
    }

    switch (column.type) {
      case 'currency':
        return this.formatCurrency(value);
      case 'number':
        return this.formatNumber(value);
      case 'percent':
        return this.formatPercent(value);
      case 'date':
        return this.formatDate(value);
      case 'boolean':
        return value ? 'Yes' : 'No';
      default:
        return String(value);
    }
  }

  private formatCurrency(value: number): string {
    if (typeof value !== 'number') return String(value);
    return `$${value.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  }

  private formatNumber(value: number): string {
    if (typeof value !== 'number') return String(value);
    return value.toLocaleString('en-US');
  }

  private formatPercent(value: number): string {
    if (typeof value !== 'number') return String(value);
    return `${value.toFixed(2)}%`;
  }

  private formatDate(value: any): string {
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) return String(value);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return String(value);
    }
  }

  exportToCSV(): void {
    if (!this.data || this.data.length === 0) return;

    // Generate CSV
    const headers = this.columns.map(col => col.label);
    const rows = this.data.map(row => 
      this.columns.map(col => {
        const value = this.getFieldValue(row, col.field);
        return this.escapeCsvValue(value);
      })
    );

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.config.title || 'table'}_${Date.now()}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  private escapeCsvValue(value: any): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  getCellAlignment(column: TableColumn): string {
    if (column.align) return column.align;
    
    // Auto-align based on type
    if (column.type === 'number' || column.type === 'currency' || column.type === 'percent') {
      return 'right';
    }
    
    return 'left';
  }

  getTotalRow(): any {
    if (!this.config.show_totals) return null;

    const totals: any = {};
    
    this.columns.forEach(col => {
      if (col.type === 'number' || col.type === 'currency') {
        totals[col.field] = this.data.reduce((sum, row) => {
          const value = this.getFieldValue(row, col.field);
          return sum + (typeof value === 'number' ? value : 0);
        }, 0);
      }
    });

    return totals;
  }
}