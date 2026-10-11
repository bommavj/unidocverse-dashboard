import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-commission',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './commission.component.html',
  styleUrls: ['./commission.component.scss']
})
export class CommissionComponent implements OnInit {
  private api = 'http://localhost:7979';

  statements: any[] = [];
  selectedStatement: any = null;
  lines: any[] = [];
  summary: any = null;
  reconcileResult: any = null;
  discrepancies: any[] = [];

  loading = false;
  reconciling = false;
  uploading = false;
  activeTab: 'statements' | 'discrepancies' = 'statements';

  // Upload form
  carrierName = '';
  selectedFile: File | null = null;

  constructor(private http: HttpClient, public toast: ToastService) {}

  ngOnInit() {
    this.loadStatements();
    this.loadDiscrepancies();
  }

  loadStatements() {
    this.loading = true;
    this.http.get<any>(`${this.api}/api/ams/commission/statements`).subscribe({
      next: r => { this.statements = r.statements || []; this.loading = false; },
      error: () => this.loading = false,
    });
  }

  loadDiscrepancies() {
    this.http.get<any>(`${this.api}/api/ams/commission/discrepancies`).subscribe({
      next: r => this.discrepancies = r.discrepancies || [],
    });
  }

  onFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] || null;
  }

  upload() {
    if (!this.selectedFile || !this.carrierName) {
      this.toast.show('Please enter carrier name and select a file', 'error');
      return;
    }
    this.uploading = true;
    const fd = new FormData();
    fd.append('file', this.selectedFile);
    this.http.post<any>(
      `${this.api}/api/ams/commission/upload?carrier_name=${encodeURIComponent(this.carrierName)}`,
      fd
    ).subscribe({
      next: r => {
        this.toast.show(`Extracted ${r.lines_extracted} lines from ${this.carrierName}`, 'success');
        this.uploading = false;
        this.carrierName = '';
        this.selectedFile = null;
        this.loadStatements();
      },
      error: () => { this.toast.show('Upload failed', 'error'); this.uploading = false; }
    });
  }

  selectStatement(stmt: any) {
    this.selectedStatement = stmt;
    this.loading = true;
    this.http.get<any>(`${this.api}/api/ams/commission/statements/${stmt.id}`).subscribe({
      next: r => {
        this.lines = r.lines || [];
        this.summary = r.summary;
        this.loading = false;
      },
      error: () => this.loading = false,
    });
  }

  reconcile(stmtId: string) {
    this.reconciling = true;
    this.http.post<any>(`${this.api}/api/ams/commission/reconcile/${stmtId}`, {}).subscribe({
      next: r => {
        this.reconcileResult = r;
        this.reconciling = false;
        this.toast.show(`Reconciled: ${r.matched} matched, ${r.discrepancy} discrepancies`, 'success');
        this.loadStatements();
        this.selectStatement(this.selectedStatement);
        this.loadDiscrepancies();
      },
      error: () => { this.toast.show('Reconciliation failed', 'error'); this.reconciling = false; }
    });
  }

  getStatusClass(status: string): string {
    return { matched: 'badge-green', unmatched: 'badge-gray', discrepancy: 'badge-red' }[status] || 'badge-gray';
  }

  formatCurrency(v: any): string {
    if (!v) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(+v);
  }
}