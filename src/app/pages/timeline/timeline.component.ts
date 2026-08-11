import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss']
})
export class TimelineComponent implements OnInit {
  months: any[] = [];
  loading = true;

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.api.getDocuments({}).subscribe({
      next: (res: any) => {
        const docs = Array.isArray(res) ? res : res.documents || [];
        this.months = this.buildTimeline(docs);
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  private buildTimeline(docs: any[]): any[] {
    // Map doc to timeline entry
    const entries = docs.map((d: any) => {
      const date = new Date(d.created_at || d.updated_at || Date.now());
      const isUpcoming = d.status === 'upcoming' || d.status === 'pending';
      const status = d.status === 'completed' ? 'done' : isUpcoming ? 'up' : 'done';

      return {
        date,
        day:    date.getDate().toString(),
        month:  date.toLocaleString('en-US', { month: 'short' }),
        year:   date.getFullYear(),
        name:   d.filename,
        type:   this.fmtType(d.doc_type),
        amount: this.extractAmount(d),
        status,
        icon:   this.getIcon(d.doc_type),
        color:  this.getColor(d.doc_type),
        id:     d.id,
        sortKey: date.getTime()
      };
    });

    // Sort by date descending
    entries.sort((a, b) => b.sortKey - a.sortKey);

    // Group by month+year
    const groups = new Map<string, any>();
    for (const e of entries) {
      const key = `${e.year}-${String(e.date.getMonth()).padStart(2,'0')}`;
      const label = e.status === 'up'
        ? `${e.date.toLocaleString('en-US',{month:'long'})} ${e.year} — Upcoming`
        : `${e.date.toLocaleString('en-US',{month:'long'})} ${e.year}`;
      if (!groups.has(key)) groups.set(key, { label, entries: [] });
      groups.get(key).entries.push(e);
    }

    return Array.from(groups.values());
  }

  private fmtType(t: string): string {
    const m: any = {
      bank_statement: 'Bank Statement', tax_document: 'Tax Document',
      payoff_statement: 'Payoff Statement', invoice: 'Invoice',
      credit_card_statement: 'Credit Card', loan_estimate: 'Loan Estimate',
      sales_report: 'Sales Report', medical_record: 'Medical Record',
      document: 'Document'
    };
    return m[t] || (t || 'Document').replace(/_/g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase());
  }

  private getIcon(t: string): string {
    const m: any = {
      bank_statement:'🏦', tax_document:'🧾', payoff_statement:'💰',
      invoice:'📄', credit_card_statement:'💳', loan_estimate:'🏠',
      sales_report:'📊', medical_record:'🏥', document:'📁'
    };
    return m[t] || '📄';
  }

  private getColor(t: string): string {
    const m: any = {
      bank_statement:'#eff6ff', tax_document:'#f5f3ff', payoff_statement:'#fef2f2',
      invoice:'#fff7ed', credit_card_statement:'#f0fdf4', loan_estimate:'#ecfdf5',
      sales_report:'#f0f9ff', medical_record:'#fdf4ff', document:'#f8fafc'
    };
    return m[t] || '#f8fafc';
  }

  private extractAmount(d: any): string {
    // Try to get a dollar amount from summary or metadata
    const summary = d.summary || '';
    const match = summary.match(/\$[\d,]+(?:\.\d+)?/);
    if (match) return match[0];
    if (d.file_size) {
      const kb = Math.round(d.file_size / 1024);
      return kb > 1024 ? `${(kb/1024).toFixed(1)} MB` : `${kb} KB`;
    }
    return '';
  }

  openDoc(entry: any): void {
    this.router.navigate(['/documents'], { queryParams: { id: entry.id } });
  }
}
