import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FolderService } from '../../services/folder.service';

interface GmailConnection {
  connection_id:    string;
  label:            string;
  email:            string;
  status:           'active' | 'paused' | 'error' | 'idle';
  emails_processed: number;
  last_poll_at:     string | null;
  last_error:       string | null;
  filter_folder:    string;
  filter_sender:    string;
  filter_subject:   string;
  target_folder:    string;
  batch_limit:      number;
  added_at:         string;
}

interface ConnectionState {
  config:    GmailConnection;
  sse:       EventSource | null;
  lastEvent: string;
}

@Component({
  selector: 'app-gmail-integration',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDividerModule, MatTooltipModule, MatSnackBarModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="gmail-page">

      <div class="page-header">
        <div class="header-left">
          <div class="gmail-icon"><mat-icon>email</mat-icon></div>
          <div>
            <h1>Gmail Integration</h1>
            <p class="subtitle">Auto-ingest emails and attachments — every email becomes a searchable document</p>
          </div>
        </div>
        <button mat-raised-button color="primary" (click)="showAddForm = !showAddForm">
          <mat-icon>{{ showAddForm ? 'close' : 'add' }}</mat-icon>
          {{ showAddForm ? 'Cancel' : 'Connect Gmail' }}
        </button>
      </div>

      <!-- How it works -->
      <div class="how-it-works" *ngIf="connections.length === 0 && !showAddForm">
        <div class="how-row">
          <div class="how-step">
            <div class="step-num">1</div>
            <div><strong>Enable IMAP in Gmail</strong><p>Gmail Settings → Forwarding and POP/IMAP → Enable IMAP</p></div>
          </div>
          <div class="how-step">
            <div class="step-num">2</div>
            <div><strong>Create App Password</strong><p><a href="https://myaccount.google.com/apppasswords" target="_blank">myaccount.google.com/apppasswords</a> → Generate</p></div>
          </div>
          <div class="how-step">
            <div class="step-num">3</div>
            <div><strong>Paste credentials here</strong><p>Enter your Gmail address and the 16-character app password</p></div>
          </div>
          <div class="how-step">
            <div class="step-num">4</div>
            <div><strong>Auto-ingest begins</strong><p>Emails polled every 5 min — processed in batches of 5 to protect performance</p></div>
          </div>
        </div>
        <div class="how-cta">
          <button mat-raised-button color="primary" (click)="showAddForm = true">
            <mat-icon>add</mat-icon> Connect Gmail Account
          </button>
          <a href="https://myaccount.google.com/apppasswords" target="_blank" mat-stroked-button>
            <mat-icon>open_in_new</mat-icon> Get App Password
          </a>
        </div>
      </div>

      <!-- Add form -->
      <mat-card class="add-card" *ngIf="showAddForm">
        <mat-card-header>
          <div mat-card-avatar class="form-avatar"><mat-icon>email</mat-icon></div>
          <mat-card-title>Connect Gmail Account</mat-card-title>
          <mat-card-subtitle>Uses IMAP + App Password — no Google Cloud setup required</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="app-password-tip">
            <mat-icon>info_outline</mat-icon>
            <span>
              Requires Gmail IMAP enabled and a Google
              <a href="https://myaccount.google.com/apppasswords" target="_blank">App Password</a>
              (not your regular password). 2-Step Verification must be on.
            </span>
          </div>

          <div class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label>Label</mat-label>
              <input matInput [(ngModel)]="newConn.label" placeholder="e.g. Work Inbox, Invoices">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Gmail Address</mat-label>
              <input matInput [(ngModel)]="newConn.email_address" placeholder="you@gmail.com" type="email">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>App Password</mat-label>
              <input matInput [(ngModel)]="newConn.app_password"
                     [type]="showPassword ? 'text' : 'password'"
                     placeholder="xxxx xxxx xxxx xxxx">
              <button mat-icon-button matSuffix (click)="showPassword = !showPassword" type="button">
                <mat-icon>{{ showPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              <mat-hint>16-character app password from Google Account settings</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Gmail Folder / Label</mat-label>
              <input matInput [(ngModel)]="newConn.filter_folder"
                     placeholder="INBOX, Invoices, Statements, [Gmail]/Starred">
              <mat-hint>Enter any Gmail label or folder name — avoid INBOX if it has too many emails</mat-hint>
            </mat-form-field>

            <!-- Batch limit — locked to 5 -->
            <mat-form-field appearance="outline">
              <mat-label>Batch Limit</mat-label>
              <input matInput [value]="5" readonly>
              <mat-icon matSuffix matTooltip="Fixed at 5 per batch to protect system performance">lock</mat-icon>
              <mat-hint>5 emails processed per poll cycle to protect performance</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Filter by Sender (optional)</mat-label>
              <input matInput [(ngModel)]="newConn.filter_sender" placeholder="invoices@company.com">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Filter by Subject (optional)</mat-label>
              <input matInput [(ngModel)]="newConn.filter_subject" placeholder="Invoice, Statement, Receipt">
            </mat-form-field>
          </div>
        </mat-card-content>
        <mat-card-actions>
          <button mat-raised-button color="primary"
                  (click)="addConnection()"
                  [disabled]="adding || !newConn.email_address || !newConn.app_password || !newConn.label">
            <mat-spinner diameter="18" *ngIf="adding" style="display:inline-block;margin-right:8px"></mat-spinner>
            <mat-icon *ngIf="!adding">connect_without_contact</mat-icon>
            {{ adding ? 'Testing & connecting...' : 'Connect & Start Polling' }}
          </button>
          <button mat-button (click)="showAddForm = false; resetForm()">Cancel</button>
        </mat-card-actions>
      </mat-card>

      <!-- Connection cards -->
      <div class="connections-list">
        <mat-card class="conn-card" *ngFor="let state of connections; trackBy: trackById">
          <div class="conn-header">
            <div class="conn-icon" [class]="'status-' + state.config.status">
              <mat-icon>mark_email_read</mat-icon>
            </div>
            <div class="conn-info">
              <div class="conn-label">{{ state.config.label }}</div>
              <div class="conn-email">{{ state.config.email }}</div>
              <div class="conn-meta">
                <span *ngIf="state.config.last_poll_at">Last poll: {{ state.config.last_poll_at | date:'short' }}</span>
                <span *ngIf="!state.config.last_poll_at && state.config.status === 'active'">Polling every 5 minutes · 5 per batch</span>
                <span class="filter-tag" *ngIf="state.config.target_folder">📁 {{ state.config.target_folder }}</span>
                <span class="filter-tag" *ngIf="state.config.filter_sender">from: {{ state.config.filter_sender }}</span>
                <span class="filter-tag" *ngIf="state.config.filter_subject">subject: {{ state.config.filter_subject }}</span>
              </div>
              <div class="last-event" *ngIf="state.lastEvent">{{ state.lastEvent }}</div>
            </div>
            <div class="conn-stat">
              <span class="stat-value">{{ state.config.emails_processed }}</span>
              <span class="stat-label">emails</span>
            </div>
            <div class="conn-actions">
              <span class="status-badge" [class]="'badge-' + state.config.status">{{ state.config.status }}</span>
              <button mat-icon-button
                      [matTooltip]="state.config.status === 'active' ? 'Pause' : 'Resume'"
                      (click)="togglePause(state)"
                      *ngIf="state.config.status === 'active' || state.config.status === 'paused'">
                <mat-icon>{{ state.config.status === 'active' ? 'pause' : 'play_arrow' }}</mat-icon>
              </button>
              <button mat-icon-button matTooltip="Remove" color="warn" (click)="removeConnection(state)">
                <mat-icon>delete_outline</mat-icon>
              </button>
            </div>
          </div>
          <div class="conn-error" *ngIf="state.config.last_error">
            <mat-icon>error_outline</mat-icon>
            {{ state.config.last_error }}
          </div>
        </mat-card>
      </div>

      <div class="footer-note" *ngIf="connections.length > 0">
        <mat-icon>info_outline</mat-icon>
        <span>Documents show email metadata (subject, sender, date). Batch limit: 5 emails per poll to protect system performance.</span>
      </div>

    </div>
  `,
  styles: [`
    .gmail-page { padding: 2rem; max-width: 960px; margin: 0 auto; }
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; }
    .header-left { display: flex; align-items: center; gap: 1rem; }
    .gmail-icon { width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #ea4335 0%, #fbbc05 100%); display: flex; align-items: center; justify-content: center; color: #fff; }
    .gmail-icon mat-icon { font-size: 28px; width: 28px; height: 28px; }
    .page-header h1 { margin: 0 0 .25rem; font-size: 24px; font-weight: 600; }
    .subtitle { margin: 0; color: #757575; font-size: 14px; }
    .how-it-works { background: #f8f9fa; border-radius: 12px; padding: 2rem; margin-bottom: 1.5rem; }
    .how-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 1.5rem; }
    .how-step { display: flex; gap: 1rem; align-items: flex-start; }
    .step-num { width: 28px; height: 28px; border-radius: 50%; background: #1a73e8; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0; }
    .how-step strong { display: block; font-size: 14px; color: #212121; margin-bottom: .25rem; }
    .how-step p { margin: 0; font-size: 13px; color: #757575; }
    .how-step a { color: #1a73e8; }
    .how-cta { display: flex; gap: 1rem; align-items: center; padding-top: 1.25rem; border-top: 1px solid #e0e0e0; }
    .add-card { margin-bottom: 1.5rem; }
    .form-avatar { background: linear-gradient(135deg, #ea4335, #fbbc05); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; }
    .app-password-tip { display: flex; align-items: flex-start; gap: .5rem; background: #e8f0fe; border-radius: 8px; padding: .75rem 1rem; font-size: 13px; color: #1a73e8; margin: 1rem 0; }
    .app-password-tip a { color: #1a73e8; font-weight: 600; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: .5rem; }
    .form-grid mat-form-field { width: 100%; }
    .connections-list { display: flex; flex-direction: column; gap: 1rem; }
    .conn-card { overflow: hidden; }
    .conn-header { display: flex; align-items: center; gap: 1rem; padding: 1.25rem; }
    .conn-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .conn-icon.status-active  { background: #e8f5e9; color: #4caf50; }
    .conn-icon.status-paused  { background: #fff8e1; color: #ff9800; }
    .conn-icon.status-error   { background: #ffebee; color: #f44336; }
    .conn-icon.status-idle    { background: #f5f5f5; color: #9e9e9e; }
    .conn-info { flex: 1; min-width: 0; }
    .conn-label { font-weight: 600; font-size: 16px; color: #212121; }
    .conn-email { font-size: 13px; color: #1a73e8; margin: 2px 0; }
    .conn-meta { display: flex; flex-wrap: wrap; gap: .5rem; font-size: 12px; color: #757575; margin-top: 3px; }
    .filter-tag { background: #e8f5e9; color: #2e7d32; padding: 1px 6px; border-radius: 10px; font-size: 11px; }
    .last-event { font-size: 12px; color: #4caf50; margin-top: 3px; }
    .conn-stat { text-align: center; }
    .stat-value { display: block; font-size: 22px; font-weight: 700; color: #212121; }
    .stat-label { font-size: 11px; color: #9e9e9e; text-transform: uppercase; }
    .conn-actions { display: flex; align-items: center; gap: .5rem; flex-shrink: 0; }
    .status-badge { padding: .2rem .6rem; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .badge-active { background: #e8f5e9; color: #2e7d32; }
    .badge-paused { background: #fff8e1; color: #e65100; }
    .badge-error  { background: #ffebee; color: #c62828; }
    .badge-idle   { background: #f5f5f5; color: #757575; }
    .conn-error { display: flex; align-items: center; gap: .5rem; padding: .75rem 1.25rem; background: #ffebee; color: #c62828; font-size: 13px; }
    .footer-note { display: flex; align-items: center; gap: .5rem; margin-top: 1.5rem; padding: .75rem 1rem; background: #f5f5f5; border-radius: 8px; font-size: 13px; color: #757575; }
  `]
})
export class GmailIntegrationComponent implements OnInit, OnDestroy {

  connections: ConnectionState[] = [];
  showAddForm  = false;
  showPassword = false;
  adding       = false;

  readonly BATCH_LIMIT = 5; // locked — protects system performance

  newConn = {
    label:          '',
    email_address:  '',
    app_password:   '',
    filter_folder:  'INBOX',
    filter_sender:  '',
    filter_subject: '',
    target_folder:  '',
    batch_limit:    5,
  };

  get availableFolders(): string[] {
    return this.folderSvc.getFolders();
  }

  private apiBase      = 'http://localhost:8000';
  private pollInterval: any;

  constructor(
    private http:      HttpClient,
    private cd:        ChangeDetectorRef,
    private snack:     MatSnackBar,
    public  folderSvc: FolderService,
  ) {}

  ngOnInit() {
    this.loadConnections();
    this.pollInterval = setInterval(() => this.refreshStatuses(), 15000);
  }

  ngOnDestroy() {
    clearInterval(this.pollInterval);
    this.connections.forEach(s => s.sse?.close());
  }

  loadConnections() {
    this.http.get<any[]>(`${this.apiBase}/api/gmail/connections`).subscribe({
      next: conns => {
        this.connections = conns.map(c => ({ config: c, sse: null, lastEvent: '' }));
        this.connections.forEach(s => this.subscribeSSE(s));
        this.cd.detectChanges();
      },
      error: () => {},
    });
  }

  refreshStatuses() {
    this.connections.forEach(state => {
      this.http.get<any>(`${this.apiBase}/api/gmail/connections/${state.config.connection_id}/status`)
        .subscribe({ next: s => { Object.assign(state.config, s); this.cd.detectChanges(); }, error: () => {} });
    });
  }

  addConnection() {
    if (!this.newConn.email_address || !this.newConn.app_password || !this.newConn.label) return;
    this.adding = true;
    const payload = { ...this.newConn, batch_limit: this.BATCH_LIMIT };
    this.http.post<any>(`${this.apiBase}/api/gmail/connections`, payload).subscribe({
      next: config => {
        const state: ConnectionState = { config, sse: null, lastEvent: '' };
        this.connections.push(state);
        this.subscribeSSE(state);
        this.adding      = false;
        this.showAddForm = false;
        this.resetForm();
        this.snack.open(`✓ Connected: ${config.label} — polling started`, 'OK', { duration: 4000 });
        this.cd.detectChanges();
      },
      error: err => {
        this.adding = false;
        this.snack.open(
          `Connection failed: ${err.error?.detail || 'Check credentials and IMAP settings'}`,
          'OK', { duration: 6000, panelClass: 'error-snack' }
        );
      },
    });
  }

  togglePause(state: ConnectionState) {
    const action = state.config.status === 'active' ? 'pause' : 'resume';
    this.http.post(`${this.apiBase}/api/gmail/connections/${state.config.connection_id}/${action}`, {})
      .subscribe({
        next: () => {
          state.config.status = action === 'pause' ? 'paused' : 'active';
          this.snack.open(action === 'pause' ? '⏸ Paused' : '▶ Resumed', 'OK', { duration: 2000 });
          this.cd.detectChanges();
        },
      });
  }

  removeConnection(state: ConnectionState) {
    if (!confirm(`Remove Gmail connection "${state.config.label}"?`)) return;
    state.sse?.close();
    this.http.delete(`${this.apiBase}/api/gmail/connections/${state.config.connection_id}`).subscribe({
      next: () => {
        this.connections = this.connections.filter(s => s !== state);
        this.snack.open('Connection removed', 'OK', { duration: 2000 });
        this.cd.detectChanges();
      },
    });
  }

  subscribeSSE(state: ConnectionState) {
    state.sse?.close();
    const es = new EventSource(
      `${this.apiBase}/api/gmail/connections/${state.config.connection_id}/progress`
    );
    es.onmessage = (ev) => {
      try {
        const event = JSON.parse(ev.data);
        if (event.type === 'ping') return;
        if (event.type === 'status_change') { state.config.status = event.status; if (event.error) state.config.last_error = event.error; }
        if (event.type === 'poll_found')    { state.lastEvent = `📬 Found ${event.count} new email(s)`; }
        if (event.type === 'email_processed') {
          state.config.emails_processed++;
          state.lastEvent = `✓ "${event.subject}"`;
          this.snack.open(`📧 "${event.subject}" — ${event.attachments} attachment(s)`, 'OK', { duration: 3000 });
        }
        if (event.type === 'poll_complete') { state.config.last_poll_at = event.ts; state.lastEvent = `✓ Poll done — ${event.processed} email(s)`; }
        this.cd.detectChanges();
      } catch {}
    };
    es.onerror = () => { state.config.status = 'error'; this.cd.detectChanges(); };
    state.sse  = es;
  }

  resetForm() {
    this.newConn = { label: '', email_address: '', app_password: '', filter_folder: 'INBOX', filter_sender: '', filter_subject: '', target_folder: '', batch_limit: 5 };
    this.showPassword = false;
  }

  trackById(_: number, s: ConnectionState) { return s.config.connection_id; }
}