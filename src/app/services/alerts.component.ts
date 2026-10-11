// app/features/alerts/alerts.component.ts
import {
    Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef
  } from '@angular/core';
  import { CommonModule } from '@angular/common';
  import { HttpClient } from '@angular/common/http';
  import { Router } from '@angular/router';
  
  interface CoverageInfo {
    premium?: string;
    dwelling?: string;
    insured?: string;
    policy_number?: string;
  }
  
  interface Alert {
    id: string;
    filename: string;
    doc_type: string;
    expiry_date: string;
    days_until_expiry: number;
    severity: 'expired' | 'critical' | 'urgent' | 'warning';
    status_text: string;
    coverage_info: CoverageInfo;
    summary: string;
    updated_at: string;
  }
  
  interface AlertsResponse {
    alerts: Alert[];
    counts: { expired: number; critical: number; urgent: number; warning: number };
    total: number;
    as_of: string;
  }
  
  @Component({
    selector: 'app-alerts',
    standalone: true,
    imports: [CommonModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
      <div class="alerts-page">
  
      <p class="page-subtitle">
  🟣 Warning: 90 days &nbsp;|&nbsp; 
  🟡 Urgent: 60 days &nbsp;|&nbsp; 
  🟠 Critical: 30 days &nbsp;|&nbsp; 
  🔴 Expired
</p>

        <!-- Header -->
        <div class="alerts-header">
          <div class="header-left">
            <h1 class="page-title">
              <span class="title-icon">🔔</span>
              Expiry Alerts
            </h1>
            <p class="page-subtitle">Documents expiring within 90 days</p>
          </div>
          <div class="header-right">
            <button class="refresh-btn" (click)="load()" [disabled]="loading">
              <span [class.spinning]="loading">↻</span>
              Refresh
            </button>
            <span class="as-of" *ngIf="asOf">As of {{ asOf }}</span>
          </div>
        </div>
  
        <!-- Loading -->
        <div class="loading-state" *ngIf="loading">
          <div class="spinner"></div>
          <p>Checking for expiring documents…</p>
        </div>
  
        <!-- Error -->
        <div class="error-state" *ngIf="error && !loading">
          <p>⚠️ {{ error }}</p>
          <button (click)="load()">Try again</button>
        </div>
  
        <!-- Summary cards -->
        <div class="summary-row" *ngIf="!loading && !error">
          <div class="summary-card expired" [class.active]="counts.expired > 0">
            <div class="count">{{ counts.expired }}</div>
            <div class="label">Expired</div>
          </div>
          <div class="summary-card critical" [class.active]="counts.critical > 0">
            <div class="count">{{ counts.critical }}</div>
            <div class="label">Critical ≤30d</div>
          </div>
          <div class="summary-card urgent" [class.active]="counts.urgent > 0">
            <div class="count">{{ counts.urgent }}</div>
            <div class="label">Urgent ≤60d</div>
          </div>
          <div class="summary-card warning">
            <div class="count">{{ counts.warning }}</div>
            <div class="label">Warning ≤90d</div>
          </div>
        </div>
  
        <!-- Empty state -->
        <div class="empty-state" *ngIf="!loading && !error && alerts.length === 0">
          <div class="empty-icon">✅</div>
          <h3>No expiring documents</h3>
          <p>All documents are either active beyond 90 days or have no expiry date.</p>
        </div>
  
        <!-- Alert cards -->
        <div class="alerts-list" *ngIf="!loading && alerts.length > 0">
  
          <!-- Filter tabs -->
          <div class="filter-tabs">
            <button
              *ngFor="let tab of tabs"
              class="tab-btn"
              [class.active]="activeTab === tab.key"
              (click)="activeTab = tab.key; cdr.markForCheck()"
            >
              {{ tab.label }}
              <span class="tab-count" *ngIf="tabCount(tab.key) > 0">{{ tabCount(tab.key) }}</span>
            </button>
          </div>
  
          <!-- Cards -->
          <div class="alert-card" *ngFor="let alert of filteredAlerts"
               [class]="'alert-card--' + alert.severity">
  
            <div class="card-left">
              <div class="severity-badge" [class]="'badge--' + alert.severity">
                <span class="badge-icon">{{ severityIcon(alert.severity) }}</span>
                <span class="badge-text">{{ severityLabel(alert.severity) }}</span>
              </div>
              <div class="days-counter" [class]="'days--' + alert.severity">
                <span class="days-number">{{ daysDisplay(alert.days_until_expiry) }}</span>
                <span class="days-label">{{ alert.days_until_expiry < 0 ? 'days ago' : 'days left' }}</span>
              </div>
            </div>
  
            <div class="card-body">
              <div class="doc-name">{{ alert.filename }}</div>
              <div class="doc-type-badge">{{ formatDocType(alert.doc_type) }}</div>
  
              <div class="expiry-line">
                <span class="expiry-icon">📅</span>
                <span class="expiry-text">{{ alert.status_text }} — {{ alert.expiry_date }}</span>
              </div>
  
              <!-- Coverage info pills -->
              <div class="coverage-pills" *ngIf="hasCoverage(alert.coverage_info)">
                <span class="pill" *ngIf="alert.coverage_info.policy_number">
                  Policy: {{ alert.coverage_info.policy_number }}
                </span>
                <span class="pill" *ngIf="alert.coverage_info.premium">
                  Premium: {{ alert.coverage_info.premium }}
                </span>
                <span class="pill" *ngIf="alert.coverage_info.dwelling">
                  Dwelling: {{ alert.coverage_info.dwelling }}
                </span>
                <span class="pill insured" *ngIf="alert.coverage_info.insured">
                  {{ alert.coverage_info.insured }}
                </span>
              </div>
  
              <div class="doc-summary" *ngIf="alert.summary">{{ alert.summary }}</div>
            </div>
  
            <div class="card-actions">
              <button class="action-btn primary" (click)="openDoc(alert.id)">
                Open →
              </button>
              <div class="action-hint" [class]="'hint--' + alert.severity">
                {{ actionHint(alert.severity) }}
              </div>
            </div>
  
          </div>
        </div>
  
      </div>
    `,
    styles: [`
      .alerts-page {
        padding: 24px;
        max-width: 1100px;
        margin: 0 auto;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
  
      /* Header */
      .alerts-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 24px;
      }
      .page-title {
        font-size: 24px;
        font-weight: 700;
        margin: 0 0 4px;
        color: #1a1a2e;
      }
      .title-icon { margin-right: 8px; }
      .page-subtitle { color: #6b7280; margin: 0; font-size: 14px; }
      .header-right { display: flex; align-items: center; gap: 12px; }
      .refresh-btn {
        padding: 8px 16px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        background: white;
        cursor: pointer;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s;
      }
      .refresh-btn:hover { background: #f9fafb; }
      .refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .spinning { display: inline-block; animation: spin 1s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
      .as-of { font-size: 12px; color: #9ca3af; }
  
      /* Loading */
      .loading-state {
        text-align: center;
        padding: 60px;
        color: #6b7280;
      }
      .spinner {
        width: 32px; height: 32px;
        border: 3px solid #e5e7eb;
        border-top-color: #6366f1;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin: 0 auto 16px;
      }
  
      /* Error */
      .error-state {
        text-align: center;
        padding: 40px;
        color: #ef4444;
      }
  
      /* Summary cards */
      .summary-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
        margin-bottom: 28px;
      }
      .summary-card {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 20px;
        text-align: center;
        transition: all 0.2s;
      }
      .summary-card .count {
        font-size: 36px;
        font-weight: 700;
        line-height: 1;
        margin-bottom: 4px;
        color: #9ca3af;
      }
      .summary-card .label { font-size: 13px; color: #6b7280; font-weight: 500; }
      .summary-card.expired.active  { border-color: #ef4444; background: #fef2f2; }
      .summary-card.expired.active .count { color: #ef4444; }
      .summary-card.critical.active { border-color: #f97316; background: #fff7ed; }
      .summary-card.critical.active .count { color: #f97316; }
      .summary-card.urgent.active   { border-color: #f59e0b; background: #fffbeb; }
      .summary-card.urgent.active .count { color: #f59e0b; }
      .summary-card.warning .count  { color: #6366f1; }
  
      /* Filter tabs */
      .filter-tabs {
        display: flex;
        gap: 8px;
        margin-bottom: 20px;
      }
      .tab-btn {
        padding: 8px 16px;
        border: 1px solid #e5e7eb;
        border-radius: 20px;
        background: white;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        color: #6b7280;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s;
      }
      .tab-btn:hover { border-color: #6366f1; color: #6366f1; }
      .tab-btn.active { background: #6366f1; border-color: #6366f1; color: white; }
      .tab-count {
        background: rgba(255,255,255,0.3);
        border-radius: 10px;
        padding: 1px 7px;
        font-size: 11px;
        font-weight: 700;
      }
      .tab-btn:not(.active) .tab-count {
        background: #f3f4f6;
        color: #374151;
      }
  
      /* Alert cards */
      .alerts-list { display: flex; flex-direction: column; gap: 12px; }
  
      .alert-card {
        display: flex;
        gap: 20px;
        background: white;
        border: 1px solid #e5e7eb;
        border-left: 4px solid #e5e7eb;
        border-radius: 12px;
        padding: 20px;
        align-items: flex-start;
        transition: box-shadow 0.2s;
      }
      .alert-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
      .alert-card--expired  { border-left-color: #ef4444; background: #fef9f9; }
      .alert-card--critical { border-left-color: #f97316; background: #fffcf9; }
      .alert-card--urgent   { border-left-color: #f59e0b; background: #fffef9; }
      .alert-card--warning  { border-left-color: #6366f1; }
  
      /* Left column */
      .card-left {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        min-width: 80px;
      }
      .severity-badge {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 600;
        white-space: nowrap;
      }
      .badge--expired  { background: #fee2e2; color: #dc2626; }
      .badge--critical { background: #ffedd5; color: #ea580c; }
      .badge--urgent   { background: #fef3c7; color: #d97706; }
      .badge--warning  { background: #ede9fe; color: #7c3aed; }
  
      .days-counter {
        text-align: center;
      }
      .days-number {
        display: block;
        font-size: 28px;
        font-weight: 800;
        line-height: 1;
      }
      .days-label { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
      .days--expired  .days-number { color: #ef4444; }
      .days--critical .days-number { color: #f97316; }
      .days--urgent   .days-number { color: #f59e0b; }
      .days--warning  .days-number { color: #6366f1; }
  
      /* Body */
      .card-body { flex: 1; min-width: 0; }
      .doc-name {
        font-weight: 600;
        font-size: 15px;
        color: #111827;
        margin-bottom: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .doc-type-badge {
        display: inline-block;
        background: #f3f4f6;
        color: #6b7280;
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 4px;
        margin-bottom: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .expiry-line {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 10px;
        font-size: 13px;
        color: #374151;
      }
      .coverage-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 8px;
      }
      .pill {
        background: #eff6ff;
        color: #1d4ed8;
        font-size: 11px;
        padding: 3px 8px;
        border-radius: 4px;
        font-weight: 500;
      }
      .pill.insured {
        background: #f0fdf4;
        color: #15803d;
      }
      .doc-summary {
        font-size: 12px;
        color: #6b7280;
        line-height: 1.5;
      }
  
      /* Actions */
      .card-actions {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
        min-width: 100px;
      }
      .action-btn {
        padding: 8px 16px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        transition: all 0.2s;
      }
      .action-btn.primary {
        background: #6366f1;
        color: white;
      }
      .action-btn.primary:hover { background: #4f46e5; }
      .action-hint {
        font-size: 11px;
        text-align: right;
        line-height: 1.4;
        max-width: 110px;
      }
      .hint--expired  { color: #dc2626; }
      .hint--critical { color: #ea580c; }
      .hint--urgent   { color: #d97706; }
      .hint--warning  { color: #7c3aed; }
  
      /* Empty */
      .empty-state {
        text-align: center;
        padding: 80px 40px;
        color: #6b7280;
      }
      .empty-icon { font-size: 48px; margin-bottom: 16px; }
      .empty-state h3 { font-size: 20px; color: #111827; margin: 0 0 8px; }
  
      @media (max-width: 768px) {
        .summary-row { grid-template-columns: repeat(2, 1fr); }
        .alert-card { flex-direction: column; }
        .card-left { flex-direction: row; }
        .card-actions { align-items: flex-start; }
      }
    `]
  })
  export class AlertsComponent implements OnInit {
  
    loading = false;
    error = '';
    alerts: Alert[] = [];
    counts = { expired: 0, critical: 0, urgent: 0, warning: 0 };
    asOf = '';
    activeTab = 'all';
  
    tabs = [
      { key: 'all',      label: 'All' },
      { key: 'expired',  label: '🔴 Expired' },
      { key: 'critical', label: '🟠 Critical' },
      { key: 'urgent',   label: '🟡 Urgent' },
      { key: 'warning',  label: '🟣 Warning' },
    ];
  
    constructor(
      private http: HttpClient,
      private router: Router,
      public cdr: ChangeDetectorRef,
    ) {}
  
    ngOnInit() { this.load(); }
  
    load() {
      this.loading = true;
      this.error = '';
      this.cdr.markForCheck();
  
      this.http.get<AlertsResponse>('http://localhost:7979/api/alerts/all').subscribe({
        next: (res) => {
          this.alerts = res.alerts;
          this.counts = res.counts;
          this.asOf = res.as_of;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = err.message || 'Failed to load alerts';
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
    }
  
    get filteredAlerts(): Alert[] {
      if (this.activeTab === 'all') return this.alerts;
      return this.alerts.filter(a => a.severity === this.activeTab);
    }
  
    tabCount(key: string): number {
      if (key === 'all') return this.alerts.length;
      return this.counts[key as keyof typeof this.counts] || 0;
    }
  
    hasCoverage(info: CoverageInfo): boolean {
      return !!(info?.policy_number || info?.premium || info?.dwelling || info?.insured);
    }
  
    daysDisplay(days: number): string {
      return Math.abs(days).toString();
    }
  
    severityIcon(s: string): string {
      return { expired: '🔴', critical: '🟠', urgent: '🟡', warning: '🟣' }[s] || '⚪';
    }
  
    severityLabel(s: string): string {
      return { expired: 'EXPIRED', critical: 'CRITICAL', urgent: 'URGENT', warning: 'WARNING' }[s] || s;
    }
  
    formatDocType(t: string): string {
      return (t || '').replace(/_/g, ' ').toUpperCase();
    }
  
    actionHint(s: string): string {
      return {
        expired:  'Client may be uninsured — act now',
        critical: 'Bind renewal within 30 days',
        urgent:   'Start renewal process',
        warning:  'Schedule renewal review',
      }[s] || '';
    }
  
    openDoc(id: string) {
      this.router.navigate(['/documents', id]);
    }
  }