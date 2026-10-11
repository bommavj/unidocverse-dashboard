import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../../services/toast.service';
import { RouterModule, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-gap-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gap-analysis.component.html',
  styleUrls: ['./gap-analysis.component.scss']
})
export class GapAnalysisComponent implements OnInit {
  private api = 'http://localhost:7979';
  clients: any[] = [];
  selectedClientId = '';
  analysis: any = null;
  recommendations: any[] = [];
  loading = false;
  analyzing = false;

  constructor(
    private http: HttpClient, 
    public toast: ToastService,   
    private route: ActivatedRoute) {}

  // 1c. Replace ngOnInit():
  ngOnInit() {
    this.loadClients();
    // Auto-select client from query param (from card button)
    this.route.queryParams.subscribe(params => {
      if (params['client']) {
        this.selectedClientId = params['client'];
        this.loadClients(); // ensure clients loaded first
        // Load existing analysis then auto-run if none
        this.selectClient(params['client']).then(() => {
          if (!this.analysis && params['autorun'] === '1') {
            this.analyze();
          }
        });
      }
    });
  }


  loadClients() {
    this.http.get<any>(`${this.api}/api/ams/clients?limit=100`).subscribe({
      next: r => this.clients = r.clients || [],
    });
  }

  selectClient(id: string): Promise<void> {
    this.selectedClientId = id;
    this.analysis = null;
    this.recommendations = [];
    if (!id) return Promise.resolve();
    this.loading = true;
    return new Promise(resolve => {
      this.http.get<any>(`${this.api}/api/ams/gap/client/${id}`).subscribe({
        next: r => {
          this.analysis = r.analysis;
          this.recommendations = r.recommendations || [];
          this.loading = false;
          resolve();
        },
        error: () => { this.loading = false; resolve(); },
      });
    });
  }

  analyze() {
    if (!this.selectedClientId) { this.toast.show('Select a client', 'error'); return; }
    this.analyzing = true;
    this.http.post<any>(`${this.api}/api/ams/gap/analyze/${this.selectedClientId}`, {}).subscribe({
      next: r => {
        this.analysis = r;
        this.recommendations = r.gaps || [];
        this.analyzing = false;
        this.toast.show(`Analysis complete: Grade ${r.grade} (${r.score}/100)`, 'success');
      },
      error: () => { this.toast.show('Analysis failed', 'error'); this.analyzing = false; }
    });
  }

  updateStatus(recId: string, status: string) {
    this.http.put(`${this.api}/api/ams/gap/recommendations/${recId}/status?status=${status}&actioned_by=agent`, {}).subscribe({
      next: () => {
        this.toast.show('Recommendation updated', 'success');
        const rec = this.recommendations.find(r => r.id === recId);
        if (rec) rec.status = status;
      }
    });
  }

  getPriorityClass(p: string): string {
    return { critical: 'badge-red', high: 'badge-orange', medium: 'badge-yellow', low: 'badge-green' }[p] || 'badge-gray';
  }

  getGradeClass(g: string): string {
    return { A: 'grade-a', B: 'grade-b', C: 'grade-c', D: 'grade-d', F: 'grade-f' }[g] || '';
  }

  formatCurrency(v: any): string {
    if (!v) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(+v);
  }
}