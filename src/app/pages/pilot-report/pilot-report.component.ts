import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

const API = 'http://localhost:7979/api/pilot';

interface Feedback {
  minutes_per_doc_before: number | null;
  minutes_per_doc_after: number | null;
  accuracy_rating: number | null;
  overall_rating: number | null;
  use_cases: string;
  what_worked: string;
  what_to_improve: string;
  testimonial: string;
  testimonial_name: string;
  testimonial_title: string;
}

/**
 * Early-adopter pilot report (30/60/90 days). Usage is measured here; the organisation adds its
 * feedback, saves the report, and prints or downloads it to share. Nothing is sent automatically.
 */
@Component({
  selector: 'app-pilot-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="pr">
    <header class="pr-h no-print">
      <div>
        <h1>Pilot report</h1>
        <p>For organisations in the UniDocVerse early-adopter program. Usage below is measured on this installation; add your feedback, save, then print or download the report to share it. Nothing is sent automatically.</p>
      </div>
    </header>

    <section class="pr-card no-print">
      <div class="pr-row">
        <label>Checkpoint
          <select [(ngModel)]="checkpoint" (ngModelChange)="load()">
            <option [ngValue]="30">30 days</option><option [ngValue]="60">60 days</option><option [ngValue]="90">90 days</option>
          </select>
        </label>
        <label>Pilot started
          <input type="date" [(ngModel)]="start" (change)="load()" />
        </label>
        <label class="grow">Organisation <input [(ngModel)]="organization" placeholder="e.g. Riverside County Tax Office" /></label>
        <label class="grow">Contact <input [(ngModel)]="contact" placeholder="Name, role, email" /></label>
      </div>
    </section>

    <article class="sheet" *ngIf="m">
      <div class="sheet-h">
        <div>
          <div class="eyebrow">UniDocVerse pilot report · {{ checkpoint }}-day checkpoint</div>
          <h2>{{ organization || 'Organisation' }}</h2>
          <div class="muted">{{ periodStart | date:'mediumDate' }} – {{ periodEnd | date:'mediumDate' }}<span *ngIf="contact"> · {{ contact }}</span></div>
        </div>
        <div class="muted small" *ngIf="savedAt">Saved {{ savedAt | date:'medium' }}</div>
      </div>

      <h3>Measured usage</h3>
      <div class="stats">
        <div><b>{{ m.documents_processed }}</b><span>documents processed</span></div>
        <div><b>{{ m.pages_read }}</b><span>pages read</span></div>
        <div><b>{{ m.questions_asked }}</b><span>questions answered</span></div>
        <div><b>{{ m.answers_citation_rate ?? '—' }}<small *ngIf="m.answers_citation_rate !== null">%</small></b><span>answers with a cited source</span></div>
        <div><b>{{ m.median_processing_seconds !== null ? (m.median_processing_seconds / 60 | number:'1.0-1') : '—' }}<small *ngIf="m.median_processing_seconds !== null"> min</small></b><span>median time to process a document</span></div>
        <div><b>{{ m.active_users }}</b><span>active users</span></div>
        <div *ngIf="hoursSaved !== null" class="hl"><b>{{ hoursSaved | number:'1.0-1' }}<small> h</small></b><span>estimated time saved</span></div>
      </div>
      <table class="types" *ngIf="m.documents_by_type?.length">
        <thead><tr><th>Document type</th><th>Processed</th></tr></thead>
        <tbody><tr *ngFor="let t of m.documents_by_type"><td>{{ t.type }}</td><td>{{ t.count }}</td></tr></tbody>
      </table>
      <p class="muted small">Also: {{ m.documents_failed }} failed uploads · {{ m.answers_not_found }} questions where the documents didn't contain the answer (reported, not guessed) · {{ m.web_searches }} web searches.</p>

      <h3>Organisation feedback</h3>
      <div class="fb">
        <label>Minutes per document before UniDocVerse <input type="number" min="0" [(ngModel)]="fb.minutes_per_doc_before" /></label>
        <label>Minutes per document with UniDocVerse <input type="number" min="0" [(ngModel)]="fb.minutes_per_doc_after" /></label>
        <label>Accuracy of answers (1–5)
          <select [(ngModel)]="fb.accuracy_rating"><option [ngValue]="null">—</option><option *ngFor="let n of [1,2,3,4,5]" [ngValue]="n">{{ n }}</option></select></label>
        <label>Overall (1–5)
          <select [(ngModel)]="fb.overall_rating"><option [ngValue]="null">—</option><option *ngFor="let n of [1,2,3,4,5]" [ngValue]="n">{{ n }}</option></select></label>
        <label class="wide">What you use it for <textarea rows="2" [(ngModel)]="fb.use_cases"></textarea></label>
        <label class="wide">What worked well <textarea rows="2" [(ngModel)]="fb.what_worked"></textarea></label>
        <label class="wide">What should improve <textarea rows="2" [(ngModel)]="fb.what_to_improve"></textarea></label>
        <label class="wide">Testimonial (optional) <textarea rows="3" [(ngModel)]="fb.testimonial"></textarea></label>
        <label>Name <input [(ngModel)]="fb.testimonial_name" /></label>
        <label>Title <input [(ngModel)]="fb.testimonial_title" /></label>
      </div>
      <label class="perm"><input type="checkbox" [(ngModel)]="publish" /> We allow UniDocVerse to publish this report as a case study, including our name and testimonial.</label>
      <p class="muted small">Time saved = documents processed × (minutes before − minutes with UniDocVerse). Usage figures come from this installation's own records.</p>
    </article>

    <div class="actions no-print" *ngIf="m">
      <button class="btn" (click)="save()" [disabled]="busy || !organization.trim()">Save report</button>
      <button class="btn ghost" (click)="print()">Print / PDF</button>
      <button class="btn ghost" (click)="download()">Download JSON</button>
      <span class="msg" *ngIf="msg">{{ msg }}</span>
    </div>

    <section class="pr-card no-print" *ngIf="reports.length">
      <h3>Saved reports</h3>
      <table class="types">
        <thead><tr><th>Organisation</th><th>Checkpoint</th><th>Period</th><th>Publish</th><th>Saved</th></tr></thead>
        <tbody><tr *ngFor="let r of reports">
          <td>{{ r.organization }}</td><td>{{ r.checkpoint }} days</td>
          <td>{{ r.period_start | date:'mediumDate' }} – {{ r.period_end | date:'mediumDate' }}</td>
          <td>{{ r.publish_permission ? 'Yes' : 'No' }}</td><td>{{ r.created_at | date:'medium' }} · {{ r.created_by }}</td>
        </tr></tbody>
      </table>
    </section>
  </div>`,
  styles: [`
    .pr { padding: 24px; max-width: 1000px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; color: #1d2939; }
    .pr-h h1 { margin: 0; font-size: 22px; } .pr-h p { margin: 4px 0 0; color: #475467; max-width: 72ch; line-height: 1.5; }
    .pr-card { background: #fff; border: 1px solid #eaecf0; border-radius: 10px; padding: 14px 16px; }
    .pr-card h3 { margin: 0 0 10px; font-size: 15px; }
    .pr-row { display: flex; flex-wrap: wrap; gap: 12px 16px; align-items: flex-end; }
    label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #475467; }
    .grow { flex: 1 1 220px; }
    input, select, textarea { border: 1px solid #d0d5dd; border-radius: 8px; padding: 7px 10px; font: inherit; font-size: 13.5px; color: #1d2939; background: #fff; }
    .sheet { background: #fff; border: 1px solid #eaecf0; border-radius: 12px; padding: 24px 28px; }
    .sheet-h { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px solid #eaecf0; padding-bottom: 14px; }
    .sheet-h h2 { margin: 4px 0; font-size: 24px; text-wrap: balance; }
    .eyebrow { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: #1570ef; font-weight: 700; }
    .muted { color: #667085; } .small { font-size: 12px; }
    h3 { font-size: 15px; margin: 22px 0 10px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
    .stats div { border: 1px solid #eaecf0; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 4px; }
    .stats b { font-size: 24px; font-variant-numeric: tabular-nums; } .stats small { font-size: 13px; color: #475467; }
    .stats span { font-size: 12px; color: #475467; }
    .stats .hl { background: #ecfdf3; border-color: #abefc6; }
    .types { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
    .types th, .types td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #f2f4f7; }
    .types td:last-child, .types th:last-child { font-variant-numeric: tabular-nums; }
    .fb { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px 16px; }
    .fb .wide { grid-column: 1 / -1; }
    .perm { flex-direction: row; align-items: center; gap: 8px; margin-top: 14px; font-size: 13px; color: #1d2939; }
    .actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .btn { border: 1px solid #1570ef; background: #1570ef; color: #fff; border-radius: 8px; padding: 8px 14px; font-weight: 600; cursor: pointer; }
    .btn.ghost { background: #fff; color: #1570ef; } .btn:disabled { opacity: .5; cursor: default; }
    .btn:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid #84adff; outline-offset: 1px; }
    .msg { font-size: 13px; color: #067647; }
    @media print { .no-print { display: none !important; } .pr { padding: 0; } .sheet { border: 0; padding: 0; } }
  `],
})
export class PilotReportComponent implements OnInit {
  checkpoint = 30;
  start = '';
  organization = '';
  contact = '';
  publish = false;
  fb: Feedback = { minutes_per_doc_before: null, minutes_per_doc_after: null, accuracy_rating: null, overall_rating: null,
    use_cases: '', what_worked: '', what_to_improve: '', testimonial: '', testimonial_name: '', testimonial_title: '' };
  m: any = null;
  periodStart = '';
  periodEnd = '';
  savedAt: string | null = null;
  reports: any[] = [];
  busy = false;
  msg = '';

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.load();
    this.loadReports();
  }

  get hoursSaved(): number | null {
    const b = this.fb.minutes_per_doc_before, a = this.fb.minutes_per_doc_after;
    if (b === null || a === null || !this.m) return null;
    return Math.max(0, b - a) * this.m.documents_processed / 60;
  }

  load(): void {
    const q = new URLSearchParams({ checkpoint: String(this.checkpoint) });
    if (this.start) q.set('start', this.start);
    this.http.get<any>(`${API}/metrics?${q}`).subscribe({
      next: r => { this.m = r.metrics; this.periodStart = r.period_start; this.periodEnd = r.period_end; this.savedAt = null;
        if (!this.start) this.start = r.period_start; this.cdr.markForCheck(); },
      error: e => { this.msg = e?.status === 403 ? 'Only admins can create pilot reports.' : 'Could not load usage.'; this.cdr.markForCheck(); },
    });
  }

  loadReports(): void {
    this.http.get<any>(`${API}/reports`).subscribe({ next: r => { this.reports = r.reports || []; this.cdr.markForCheck(); }, error: () => {} });
  }

  save(): void {
    this.busy = true; this.msg = '';
    this.http.post<any>(`${API}/reports`, { checkpoint: this.checkpoint, start: this.start || null,
      organization: this.organization, contact: this.contact, feedback: this.fb, publish_permission: this.publish }).subscribe({
      next: r => { this.busy = false; this.m = r.metrics; this.savedAt = r.created_at; this.msg = 'Report saved.'; this.loadReports(); this.cdr.markForCheck(); },
      error: e => { this.busy = false; this.msg = e?.error?.detail || 'Could not save the report.'; this.cdr.markForCheck(); },
    });
  }

  print(): void { window.print(); }

  download(): void {
    const data = { app: 'UniDocVerse', checkpoint: this.checkpoint, period_start: this.periodStart, period_end: this.periodEnd,
      organization: this.organization, contact: this.contact, metrics: { ...this.m, estimated_hours_saved: this.hoursSaved },
      feedback: this.fb, publish_permission: this.publish, generated_at: new Date().toISOString() };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `unidocverse-pilot-${this.checkpoint}d-${(this.organization || 'report').replace(/\W+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
