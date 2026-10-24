import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';

const API = 'http://localhost:7979/api/feedback';
const SEND_TO = 'https://unidocverse.com/api/feedback';
const INDUSTRIES = ['Tax agency / government', 'Accounting / CPA', 'Legal', 'Immigration', 'Insurance',
  'Finance / banking', 'Healthcare', 'Real estate', 'HR', 'Other'];

/**
 * "Share your experience". Nothing is sent automatically: the preview shows exactly what leaves this
 * computer, and it goes to unidocverse.com only when the user presses Send. Offline installs can save
 * the same content as a file or copy it into an email instead.
 */
@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="fb">
    <header>
      <h1>Share your experience</h1>
      <p>Tell us how UniDocVerse works for you. It takes a minute, and it's entirely optional.
         Nothing is sent until you press <b>Send</b>, and you can see exactly what will be sent below.</p>
    </header>

    <section class="card" *ngIf="!done">
      <div class="field">
        <span class="lbl">How useful is UniDocVerse?</span>
        <div class="stars" role="radiogroup" aria-label="Rating">
          <button *ngFor="let n of [1,2,3,4,5]" type="button" role="radio" [attr.aria-checked]="rating === n"
                  [attr.aria-label]="n + ' of 5'" [class.on]="n <= rating" (click)="rating = n">★</button>
        </div>
      </div>
      <label class="field">What do you use it for, and what should improve?
        <textarea rows="5" [(ngModel)]="comment" maxlength="2000"
                  placeholder="e.g. We review W-2s and 1099s for clients; citations save us re-checking. Would like faster first answers."></textarea>
      </label>
      <div class="row">
        <label class="field">Industry
          <select [(ngModel)]="industry"><option *ngFor="let i of industries" [ngValue]="i">{{ i }}</option></select>
        </label>
        <label class="field">Your role (optional) <input [(ngModel)]="role" maxlength="80" placeholder="e.g. Tax examiner, Paralegal" /></label>
      </div>
      <label class="check"><input type="checkbox" [(ngModel)]="includeUsage" />
        Include usage statistics — counts only (documents processed, pages read, questions answered, % of answers with a citation, active users, last 90 days). No names, files or text.</label>
      <label class="check"><input type="checkbox" [(ngModel)]="quoteOk" />
        UniDocVerse may show my comment on its website, anonymously (only the comment, rating and industry).</label>
      <label class="field">Email for a reply (optional, never shown) <input type="email" [(ngModel)]="email" maxlength="200" /></label>

      <details class="preview" open>
        <summary>What will be sent</summary>
        <pre>{{ payload() | json }}</pre>
        <p class="muted">Sent over HTTPS to <code>{{ sendTo }}</code> and stored by UniDocVerse. A record of the send is added to your audit trail.</p>
      </details>

      <div class="actions">
        <button class="btn" (click)="send()" [disabled]="busy || !rating">Send</button>
        <button class="btn ghost" (click)="saveFile()" [disabled]="!rating">Save as file</button>
        <button class="btn ghost" (click)="copy()" [disabled]="!rating">Copy text</button>
        <span class="msg" [class.err]="error">{{ msg }}</span>
      </div>
      <p class="muted">Offline or no internet? Save as file or copy it, and email it to <b>info&#64;unidocverse.com</b>.</p>
    </section>

    <section class="card thanks" *ngIf="done">
      <h2>Thank you</h2>
      <p>Your feedback was sent. If you allowed it, your comment may appear anonymously on unidocverse.com after review.</p>
    </section>
  </div>`,
  styles: [`
    .fb { padding: 24px; max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; color: #1d2939; }
    header h1 { margin: 0; font-size: 22px; } header p { margin: 6px 0 0; color: #475467; line-height: 1.55; }
    .card { background: #fff; border: 1px solid #eaecf0; border-radius: 12px; padding: 20px 22px; display: flex; flex-direction: column; gap: 14px; }
    .field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #344054; }
    .lbl { font-size: 13px; color: #344054; }
    .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
    input, select, textarea { border: 1px solid #d0d5dd; border-radius: 8px; padding: 8px 10px; font: inherit; font-size: 14px; color: #1d2939; background: #fff; }
    textarea { resize: vertical; }
    .stars { display: flex; gap: 4px; }
    .stars button { font-size: 28px; line-height: 1; border: 0; background: none; color: #d0d5dd; cursor: pointer; padding: 2px; }
    .stars button.on { color: #f59e0b; }
    .check { display: flex; gap: 10px; align-items: flex-start; font-size: 13.5px; color: #344054; line-height: 1.5; }
    .check input { margin-top: 3px; }
    .preview { border: 1px solid #eaecf0; border-radius: 10px; padding: 10px 14px; background: #f9fafb; }
    .preview summary { cursor: pointer; font-weight: 600; font-size: 13px; }
    .preview pre { font-size: 12px; white-space: pre-wrap; word-break: break-word; margin: 10px 0 6px; }
    .muted { color: #667085; font-size: 12.5px; margin: 0; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .btn { border: 1px solid #1570ef; background: #1570ef; color: #fff; border-radius: 8px; padding: 8px 16px; font-weight: 600; cursor: pointer; }
    .btn.ghost { background: #fff; color: #1570ef; } .btn:disabled { opacity: .5; cursor: default; }
    .btn:focus-visible, .stars button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid #84adff; outline-offset: 2px; }
    .msg { font-size: 13px; color: #067647; } .msg.err { color: #b42318; }
    .thanks h2 { margin: 0; font-size: 18px; } .thanks p { margin: 0; color: #475467; }
  `],
})
export class FeedbackComponent implements OnInit {
  industries = INDUSTRIES;
  sendTo = SEND_TO;
  rating = 0;
  comment = '';
  industry = 'Other';
  role = '';
  email = '';
  includeUsage = false;
  quoteOk = false;
  usage: any = null;
  appVersion = '';
  edition = '';
  busy = false;
  done = false;
  msg = '';
  error = false;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef, private route: ActivatedRoute) {}

  ngOnInit(): void {
    // Opened from Statistics → "Share with UniDocVerse": include the usage counts
    if (this.route.snapshot.queryParamMap.get('usage') === '1') this.includeUsage = true;
    this.loadUsage(true);
  }

  private loadUsage(retry: boolean): void {
    this.http.get<any>(`${API}/usage`).subscribe({
      next: r => { this.usage = r.usage; this.appVersion = r.app_version; this.edition = r.edition; this.cdr.markForCheck(); },
      error: () => { if (retry) setTimeout(() => this.loadUsage(false), 1500); },   // sign-in refresh on first load
    });
  }

  payload(): any {
    return {
      rating: this.rating || null,
      comment: this.comment.trim() || null,
      industry: this.industry,
      role: this.role.trim() || null,
      app_version: this.appVersion || null,
      edition: this.edition || null,
      usage: this.includeUsage ? this.usage : null,
      quote_permission: this.quoteOk ? 'anonymous' : 'none',
      contact_email: this.email.trim() || null,
    };
  }

  send(): void {
    this.busy = true; this.msg = ''; this.error = false;
    const body = this.payload();
    fetch(SEND_TO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(r => r.json().then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        this.busy = false;
        if (!ok || !j.success) { this.error = true; this.msg = j.error || 'Could not send. Save as file and email it instead.'; this.cdr.markForCheck(); return; }
        this.http.post(`${API}/sent`, { destination: 'unidocverse.com', rating: this.rating,
          included_usage: this.includeUsage, quote_permission: body.quote_permission }).subscribe({ error: () => {} });
        this.done = true; this.cdr.markForCheck();
      })
      .catch(() => { this.busy = false; this.error = true; this.msg = 'No connection to unidocverse.com. Save as file or copy it and email info@unidocverse.com.'; this.cdr.markForCheck(); });
  }

  saveFile(): void {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(this.payload(), null, 2)], { type: 'application/json' }));
    a.download = 'unidocverse-feedback.json';
    a.click();
    URL.revokeObjectURL(a.href);
    this.msg = 'Saved. Email it to info@unidocverse.com.'; this.error = false;
  }

  copy(): void {
    navigator.clipboard?.writeText(JSON.stringify(this.payload(), null, 2)).then(() => {
      this.msg = 'Copied. Paste it into an email to info@unidocverse.com.'; this.error = false; this.cdr.markForCheck();
    });
  }
}
