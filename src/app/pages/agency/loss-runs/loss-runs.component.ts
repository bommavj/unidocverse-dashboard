import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../../services/toast.service';
import { RouterModule, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-loss-runs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './loss-runs.component.html',
  styleUrls: ['./loss-runs.component.scss']
})
export class LossRunsComponent implements OnInit {
  private api = 'http://localhost:8000';
  clients: any[] = [];
  highRisk: any[] = [];
  selectedClient: any = null;
  clientLossRuns: any[] = [];
  selectedRun: any = null;
  claims: any[] = [];
  loading = false;
  uploading = false;
  activeTab: 'upload' | 'high-risk' = 'high-risk';
  selectedFile: File | null = null;
  selectedClientId = '';

  constructor(private http: HttpClient, public toast: ToastService,
    private route: ActivatedRoute,   // ADD THIS
  ) {}

  ngOnInit() {
    this.loadHighRisk();
    this.loadClients();
    // Auto-select client from query param (from card button)
    this.route.queryParams.subscribe(params => {
      if (params['client']) {
        this.activeTab = 'upload';  // switch to upload tab
        // Wait for clients to load then select
        const wait = setInterval(() => {
          if (this.clients.length > 0) {
            clearInterval(wait);
            this.selectClient(params['client']);
          }
        }, 100);
      }
    });
  }

  loadClients() {
    this.http.get<any>(`${this.api}/api/ams/clients?limit=100`).subscribe({
      next: r => this.clients = r.clients || [],
    });
  }

  loadHighRisk() {
    this.loading = true;
    this.http.get<any>(`${this.api}/api/ams/lossrun/high-risk?threshold=medium`).subscribe({
      next: r => { this.highRisk = r.high_risk_clients || []; this.loading = false; },
      error: () => this.loading = false,
    });
  }

  selectClient(clientId: string) {
    this.selectedClientId = clientId;
    this.selectedClient = this.clients.find(c => c.id === clientId);
    this.http.get<any>(`${this.api}/api/ams/lossrun/client/${clientId}`).subscribe({
      next: r => this.clientLossRuns = r.loss_runs || [],
    });
  }

  loadClaims(runId: string) {
    this.selectedRun = this.clientLossRuns.find(r => r.id === runId);
    this.http.get<any>(`${this.api}/api/ams/lossrun/${runId}/claims`).subscribe({
      next: r => this.claims = r.claims || [],
    });
  }

  onFileSelect(e: Event) {
    this.selectedFile = (e.target as HTMLInputElement).files?.[0] || null;
  }

  upload() {
    if (!this.selectedFile || !this.selectedClientId) {
      this.toast.show('Select a client and file', 'error'); return;
    }
    this.uploading = true;
    const fd = new FormData();
    fd.append('file', this.selectedFile);
    this.http.post<any>(
      `${this.api}/api/ams/lossrun/upload/${this.selectedClientId}`, fd
    ).subscribe({
      next: r => {
        this.toast.show(`Loss run processed: ${r.risk_level} risk, loss ratio ${r.loss_ratio}%`, 'success');
        this.uploading = false;
        this.selectedFile = null;
        this.loadHighRisk();
        this.selectClient(this.selectedClientId);
      },
      error: () => { this.toast.show('Upload failed', 'error'); this.uploading = false; }
    });
  }

  getRiskClass(level: string): string {
    return { critical: 'badge-red', high: 'badge-orange', medium: 'badge-yellow', low: 'badge-green' }[level] || 'badge-gray';
  }

  formatCurrency(v: any): string {
    if (!v) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(+v);
  }
}