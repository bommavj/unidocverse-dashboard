import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

const API = 'http://localhost:7979/api/feedback/stats';

/**
 * Statistics: this organisation's usage, counts only. Nothing leaves the computer unless the user
 * chooses a share option — "Share with UniDocVerse" opens the feedback form with usage ticked, and
 * Copy / PDF / JSON are for sharing inside their own organisation.
 */
@Component({
  selector: 'app-statistics',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
  <div class="st">
    <header class="st-h no-print">
      <div>
        <h1>Statistics</h1>
        <p>How your organisation uses UniDocVerse. Counts only — no document names, contents or answers. Nothing is shared unless you choose to.</p>
      </div>
      <div class="tabs" role="tablist" aria-label="Period">
        <button *ngFor="let d of periods" role="tab" [attr.aria-selected]="days === d" [class.on]="days === d" (click)="load(d)">
          {{ d === 365 ? '12 months' : d + ' days' }}</button>
      </div>
    </header>

    <article class="sheet" *ngIf="m">
      <div class="sheet-h">
        <div class="eyebrow">UniDocVerse statistics · {{ periodStart | date:'mediumDate' }} – {{ periodEnd | date:'mediumDate' }}</div>
        <div class="muted small">Version {{ version }}</div>
      </div>

      <div class="kpis">
        <div class="kpi"><b>{{ m.documents_processed | number }}</b><span>documents processed</span></div>
        <div class="kpi"><b>{{ m.pages_read | number }}</b><span>pages read</span></div>
        <div class="kpi"><b>{{ m.questions_asked | number }}</b><span>questions answered</span></div>
        <div class="kpi"><b>{{ m.active_users | number }}</b><span>active users</span></div>
      </div>

      <div class="cols">
        <section class="panel">
          <h2>Answer quality</h2>
          <div class="meter">
            <div class="meter-top"><span>Answers with a cited source</span><b>{{ m.answers_citation_rate ?? '—' }}<small *ngIf="m.answers_citation_rate !== null">%</small></b></div>
            <div class="bar"><span [style.width.%]="m.answers_citation_rate || 0"></span></div>
          </div>
          <ul class="facts">
            <li><span>Questions where the documents didn't have the answer (said so, not guessed)</span><b>{{ m.answers_not_found | number }}</b></li>
            <li><span>Median time to read a document</span><b>{{ m.median_processing_seconds !== null ? ((m.median_processing_seconds / 60) | number:'1.0-1') + ' min' : '—' }}</b></li>
            <li><span>Failed uploads</span><b>{{ m.documents_failed | number }}</b></li>
            <li><span>Web searches</span><b>{{ m.web_searches | number }}</b></li>
          </ul>
        </section>

        <section class="panel">
          <h2>Documents by type</h2>
          <p class="muted small" *ngIf="!m.documents_by_type?.length">No documents processed in this period.</p>
          <div class="types">
            <div class="type" *ngFor="let t of m.documents_by_type">
              <span class="tname">{{ label(t.type) }}</span>
              <div class="tbar"><span [style.width.%]="100 * t.count / maxType"></span></div>
              <b>{{ t.count }}</b>
            </div>
          </div>
        </section>
      </div>
    </article>

    <section class="share no-print" *ngIf="m">
      <div>
        <h2>Share these statistics</h2>
        <p>With UniDocVerse, to help improve it — or with your own team.</p>
      </div>
      <div class="actions">
        <a class="btn" routerLink="/feedback" [queryParams]="{ usage: 1 }"><i class="ti ti-send"></i>Share with UniDocVerse</a>
        <button class="btn ghost" (click)="copy()"><i class="ti ti-copy"></i>Copy summary</button>
        <button class="btn ghost" (click)="print()"><i class="ti ti-printer"></i>PDF / print</button>
        <button class="btn ghost" (click)="download()"><i class="ti ti-download"></i>Download data</button>
        <span class="msg" *ngIf="msg">{{ msg }}</span>
      </div>
      <p class="muted small">"Share with UniDocVerse" opens the feedback form with these counts included — you see exactly what is sent before pressing Send.</p>
    </section>
  </div>`,
  styles: [`
    .st { padding: 24px; max-width: 1080px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; color: #1d2939; }
    .st-h { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
    .st-h h1 { margin: 0; font-size: 22px; } .st-h p { margin: 6px 0 0; color: #475467; max-width: 64ch; line-height: 1.5; }
    .tabs { display: inline-flex; border: 1px solid #d0d5dd; border-radius: 8px; overflow: hidden; background: #fff; }
    .tabs button { border: 0; background: #fff; padding: 7px 14px; font: inherit; font-size: 13px; color: #344054; cursor: pointer; }
    .tabs button + button { border-left: 1px solid #d0d5dd; }
    .tabs button.on { background: #eff4ff; color: #1849a9; font-weight: 600; }
    .sheet { background: #fff; border: 1px solid #eaecf0; border-radius: 12px; padding: 22px 24px; display: flex; flex-direction: column; gap: 18px; }
    .sheet-h { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .eyebrow { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: #1570ef; font-weight: 700; }
    .muted { color: #667085; } .small { font-size: 12.5px; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
    .kpi { border: 1px solid #eaecf0; border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
    .kpi b { font-size: 28px; font-variant-numeric: tabular-nums; } .kpi span { font-size: 12.5px; color: #475467; }
    .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
    .panel { border: 1px solid #eaecf0; border-radius: 10px; padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }
    .panel h2 { margin: 0; font-size: 15px; }
    .meter-top { display: flex; justify-content: space-between; align-items: baseline; font-size: 13px; color: #344054; }
    .meter-top b { font-size: 22px; font-variant-numeric: tabular-nums; } .meter-top small { font-size: 13px; }
    .bar, .tbar { height: 8px; background: #eaecf0; border-radius: 999px; overflow: hidden; }
    .bar span { display: block; height: 100%; background: #12b76a; } .tbar span { display: block; height: 100%; background: #2e90fa; }
    .facts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .facts li { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; color: #344054; border-top: 1px solid #f2f4f7; padding-top: 8px; }
    .facts b { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .types { display: flex; flex-direction: column; gap: 8px; }
    .type { display: grid; grid-template-columns: minmax(110px, 38%) 1fr 36px; gap: 10px; align-items: center; font-size: 13px; }
    .tname { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #344054; }
    .type b { text-align: right; font-variant-numeric: tabular-nums; }
    .share { background: #f5f8ff; border: 1px solid #d1e0ff; border-radius: 12px; padding: 18px 22px; display: flex; flex-direction: column; gap: 10px; }
    .share h2 { margin: 0; font-size: 16px; } .share p { margin: 0; color: #475467; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .btn { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #1570ef; background: #1570ef; color: #fff; border-radius: 8px; padding: 8px 14px; font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; text-decoration: none; }
    .btn.ghost { background: #fff; color: #1570ef; }
    .btn:focus-visible, .tabs button:focus-visible { outline: 2px solid #84adff; outline-offset: 2px; }
    .msg { font-size: 13px; color: #067647; }
    @media print { .no-print { display: none !important; } .st { padding: 0; } .sheet { border: 0; } }
  `],
})
export class StatisticsComponent implements OnInit {
  periods = [7, 30, 90, 365];
  days = 30;
  m: any = null;
  periodStart = '';
  periodEnd = '';
  version = '';
  maxType = 1;
  msg = '';

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef, private router: Router) {}

  ngOnInit(): void { this.load(30, true); }

  load(days: number, retry = false): void {
    this.days = days; this.msg = '';
    this.http.get<any>(`${API}?days=${days}`).subscribe({
      next: r => {
        this.m = r.metrics; this.periodStart = r.period_start; this.periodEnd = r.period_end; this.version = r.app_version;
        this.maxType = Math.max(1, ...(this.m.documents_by_type || []).map((t: any) => t.count));
        this.cdr.markForCheck();
      },
      error: () => { if (retry) setTimeout(() => this.load(days), 1500); },   // sign-in refresh on first load
    });
  }

  label(t: string): string {
    return (t || 'other').replace(/_/g, ' ').replace(/\b(w2|w9|k1|uscis|1099|1040)\b/gi, s => s.toUpperCase());
  }

  private summary(): string {
    const m = this.m;
    const types = (m.documents_by_type || []).slice(0, 6).map((t: any) => `${this.label(t.type)} ${t.count}`).join(', ');
    return `UniDocVerse statistics (${this.days === 365 ? 'last 12 months' : 'last ' + this.days + ' days'}, version ${this.version})\n` +
      `• ${m.documents_processed} documents processed, ${m.pages_read} pages read\n` +
      `• ${m.questions_asked} questions answered; ${m.answers_citation_rate ?? '—'}% with a cited source\n` +
      `• ${m.answers_not_found} questions where the documents didn't have the answer\n` +
      `• ${m.active_users} active users\n` +
      (types ? `• Documents by type: ${types}\n` : '');
  }

  copy(): void {
    navigator.clipboard?.writeText(this.summary()).then(() => { this.msg = 'Summary copied.'; this.cdr.markForCheck(); });
  }

  print(): void { window.print(); }

  download(): void {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ app: 'UniDocVerse', version: this.version, days: this.days,
      period_start: this.periodStart, period_end: this.periodEnd, metrics: this.m }, null, 2)], { type: 'application/json' }));
    a.download = `unidocverse-statistics-${this.days}d.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
