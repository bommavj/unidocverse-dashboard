import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { authFetch } from '../../lib/api';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DocSheetComponent } from '../../components/doc-sheet/doc-sheet.component';

interface DeadlineItem {
  id: string;
  filename: string;
  doc_type: string;
  field: string;
  label: string;
  date: Date;
  daysLeft: number;
  urgency: 'expired' | 'critical' | 'urgent' | 'soon' | 'ok';
  raw_date: string;
}

@Component({
  selector: 'app-deadlines',
  standalone: true,
  imports: [CommonModule, RouterModule, DocSheetComponent],
  templateUrl: './deadlines.component.html',
  styleUrls: ['./deadlines.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeadlinesComponent implements OnInit {
  readonly Math = Math;
  all: DeadlineItem[] = [];
  loading = true;
  selectedDoc: any = null;
  activeFilter: 'all' | 'expired' | 'critical' | 'urgent' | 'soon' = 'all';

  readonly DATE_FIELDS = [
    { key: 'expiry_date',       label: 'Expiry' },
    { key: 'expiration_date',   label: 'Expiration' },
    { key: 'due_date',          label: 'Due Date' },
    { key: 'renewal_date',      label: 'Renewal' },
    { key: 'maturity_date',     label: 'Maturity' },
    { key: 'policy_end_date',   label: 'Policy End' },
    { key: 'deadline',          label: 'Deadline' },
    { key: 'payment_due',       label: 'Payment Due' },
  ];

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.load(); }

  get filtered(): DeadlineItem[] {
    if (this.activeFilter === 'all') return this.all;
    return this.all.filter(d => d.urgency === this.activeFilter);
  }

  countOf(f: string): number { return this.all.filter(d => d.urgency === f).length; }

  setFilter(f: typeof this.activeFilter): void {
    this.activeFilter = f;
    this.cdr.markForCheck();
  }

  urgencyLabel(u: string): string {
    return { expired: 'Expired', critical: 'Critical', urgent: 'Urgent', soon: 'Soon', ok: 'OK' }[u] || u;
  }

  openDoc(item: DeadlineItem): void {
    authFetch(`http://localhost:7979/api/documents/${item.id}`)
      .then(r => r.json()).then(d => { this.selectedDoc = d; this.cdr.markForCheck(); });
  }

  private async load(): Promise<void> {
    try {
      const res = await authFetch('http://localhost:7979/api/alerts/proactive');
      const data = await res.json();
      const alerts: any[] = data.alerts || [];

      const items: DeadlineItem[] = [];
      const today = new Date();

      for (const alert of alerts) {
        const raw = alert.expiry_date || alert.due_date || alert.date;
        if (!raw) continue;
        const date = new Date(raw);
        if (isNaN(date.getTime())) continue;
        const daysLeft = Math.round((date.getTime() - today.getTime()) / 86400000);
        const urgency = daysLeft < 0 ? 'expired'
                      : daysLeft <= 7  ? 'critical'
                      : daysLeft <= 30 ? 'urgent'
                      : daysLeft <= 90 ? 'soon'
                      : 'ok';
        items.push({
          id:        alert.doc_id || alert.id,
          filename:  alert.filename || alert.title || 'Unknown',
          doc_type:  alert.doc_type || '',
          field:     alert.field || 'expiry_date',
          label:     alert.label || 'Deadline',
          date,
          daysLeft,
          urgency,
          raw_date:  raw,
        });
      }

      // Also pull from documents directly for any missed date fields
      const docsRes = await authFetch('http://localhost:7979/api/documents?limit=100');
      const docsData = await docsRes.json();
      const docs: any[] = Array.isArray(docsData) ? docsData : (docsData.documents || docsData.items || []);

      for (const doc of docs) {
        const meta = doc.doc_metadata || doc.metadata || {};
        const ad   = meta.analyzed_data || {};
        const fields = ad.fields || {};

        for (const { key, label } of this.DATE_FIELDS) {
          const raw = fields[key] || ad[key];
          if (!raw) continue;
          const date = new Date(raw);
          if (isNaN(date.getTime())) continue;
          if (items.some(i => i.id === doc.id && i.field === key)) continue;
          const daysLeft = Math.round((date.getTime() - today.getTime()) / 86400000);
          if (daysLeft > 180) continue; // only show upcoming within 6 months + expired
          const urgency = daysLeft < 0 ? 'expired'
                        : daysLeft <= 7  ? 'critical'
                        : daysLeft <= 30 ? 'urgent'
                        : daysLeft <= 90 ? 'soon'
                        : 'ok';
          items.push({ id: doc.id, filename: doc.filename, doc_type: doc.doc_type || '', field: key, label, date, daysLeft, urgency, raw_date: raw });
        }
      }

      this.all = items.sort((a, b) => a.daysLeft - b.daysLeft);
    } catch (e) {
      console.error('Deadlines load failed', e);
    }
    this.loading = false;
    this.cdr.markForCheck();
  }
}
