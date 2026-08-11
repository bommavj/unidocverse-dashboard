import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RiskBadgeComponent } from '../../components/risk-badge/risk-badge.component';

interface RiskFactor {
  label: string;
  severity: 'high' | 'medium' | 'low' | 'info';
}

interface HealthField {
  key: string;
  label: string;
  weight: number;
  present: boolean;
}

interface RiskDoc {
  doc_id: string;
  filename: string;
  doc_type?: string;
  risk_score: number;
  health_score: number;
  risk_factors: RiskFactor[];
  missing_fields: string[];
  health_fields: HealthField[];
}

const BASE = 'http://localhost:8000';

@Component({
  selector: 'app-risk',
  standalone: true,
  imports: [CommonModule, RiskBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      display: block;
      font-family: 'Inter', system-ui, sans-serif;
      background: #f9fafb;
      min-height: 100vh;
      padding: 24px;
      box-sizing: border-box;
    }

    /* ── Header ── */
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
    }

    .page-title {
      font-size: 22px;
      font-weight: 700;
      color: #111827;
      margin: 0;
    }

    .page-subtitle {
      font-size: 13px;
      color: #6b7280;
      margin: 2px 0 0;
    }

    .btn-compute {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: #4f46e5;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;

      &:hover { background: #4338ca; }
      &:disabled { background: #a5b4fc; cursor: not-allowed; }
    }

    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Layout ── */
    .main-layout {
      display: grid;
      grid-template-columns: 1fr 380px;
      gap: 20px;
      align-items: start;

      @media (max-width: 900px) {
        grid-template-columns: 1fr;
      }
    }

    /* ── Table ── */
    .risk-table-card {
      background: #fff;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      overflow: hidden;
    }

    .risk-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .risk-table thead tr {
      background: #f3f4f6;
    }

    .risk-table th {
      padding: 10px 14px;
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      border-bottom: 1px solid #e5e7eb;
    }

    .risk-table tbody tr {
      cursor: pointer;
      border-bottom: 1px solid #f3f4f6;
      transition: background 0.1s;

      &:last-child { border-bottom: none; }
      &:hover { background: #f9fafb; }
      &.selected { background: #eff6ff; }
    }

    .risk-table td {
      padding: 10px 14px;
      vertical-align: middle;
    }

    .doc-name {
      font-weight: 600;
      color: #111827;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .doc-type {
      font-size: 11px;
      color: #6b7280;
      margin-top: 2px;
    }

    .health-bar-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .health-bar {
      width: 60px;
      height: 6px;
      background: #e5e7eb;
      border-radius: 3px;
      overflow: hidden;
    }

    .health-bar-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .health-pct {
      font-size: 11px;
      color: #6b7280;
      width: 28px;
    }

    .top-factor {
      font-size: 12px;
      color: #374151;
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .no-data {
      text-align: center;
      padding: 48px 0;
      color: #9ca3af;
      font-size: 14px;
    }

    /* ── Risk score chip (table) ── */
    .risk-chip {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 700;

      &.green   { background: #d1fae5; color: #065f46; }
      &.amber   { background: #fef3c7; color: #92400e; }
      &.red     { background: #fee2e2; color: #991b1b; }
      &.darkred { background: #fecaca; color: #7f1d1d; }
    }

    /* ── Detail Panel ── */
    .detail-panel {
      background: #fff;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      padding: 20px;
      position: sticky;
      top: 24px;
    }

    .detail-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 0;
      color: #9ca3af;
      font-size: 14px;
      gap: 8px;

      .icon { font-size: 32px; }
    }

    .detail-filename {
      font-size: 15px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 4px;
      word-break: break-word;
    }

    .detail-doctype {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 20px;
    }

    /* Score row */
    .scores-row {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
    }

    .score-card {
      flex: 1;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 14px;
      text-align: center;
    }

    .score-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      margin-bottom: 8px;
    }

    .score-big {
      font-size: 36px;
      font-weight: 800;
      line-height: 1;
    }

    .score-sub {
      font-size: 11px;
      color: #9ca3af;
      margin-top: 4px;
    }

    /* Donut */
    .donut-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }

    .donut-svg {
      transform: rotate(-90deg);
    }

    .donut-pct {
      font-size: 14px;
      font-weight: 700;
      color: #111827;
    }

    /* Section heading */
    .section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #374151;
      margin: 0 0 10px;
    }

    /* Risk factors */
    .factors-list {
      list-style: none;
      margin: 0 0 20px;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .factor-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #374151;
      padding: 6px 10px;
      border-radius: 6px;
      background: #f9fafb;
    }

    .factor-icon { font-size: 14px; flex-shrink: 0; }

    /* Missing fields */
    .missing-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .missing-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #6b7280;

      .check { color: #d1d5db; font-size: 14px; }
    }

    .no-missing {
      font-size: 13px;
      color: #10b981;
      font-weight: 500;
    }

    /* Loading / error banners */
    .banner {
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 13px;
      margin-bottom: 16px;

      &.info    { background: #eff6ff; color: #1d4ed8; }
      &.success { background: #d1fae5; color: #065f46; }
      &.error   { background: #fee2e2; color: #991b1b; }
    }
  `],
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Risk Dashboard</h1>
        <p class="page-subtitle">Document risk &amp; health scores sorted by highest risk</p>
      </div>
      <button class="btn-compute" (click)="computeAll()" [disabled]="computing">
        <span class="spinner" *ngIf="computing"></span>
        <span>{{ computing ? 'Computing…' : 'Compute All' }}</span>
      </button>
    </div>

    <div class="banner success" *ngIf="batchMessage">{{ batchMessage }}</div>
    <div class="banner error"   *ngIf="loadError">{{ loadError }}</div>

    <div class="main-layout">
      <!-- Left: table -->
      <div class="risk-table-card">
        <table class="risk-table">
          <thead>
            <tr>
              <th>Document</th>
              <th>Risk Score</th>
              <th>Health</th>
              <th>Top Risk Factor</th>
            </tr>
          </thead>
          <tbody>
            <tr
              *ngFor="let doc of docs"
              [class.selected]="selectedDoc?.doc_id === doc.doc_id"
              (click)="selectDoc(doc)"
            >
              <td>
                <div class="doc-name" [title]="doc.filename">{{ doc.filename }}</div>
                <div class="doc-type" *ngIf="doc.doc_type">{{ doc.doc_type }}</div>
              </td>
              <td>
                <span class="risk-chip" [ngClass]="riskClass(doc.risk_score)">
                  {{ doc.risk_score }}
                </span>
              </td>
              <td>
                <div class="health-bar-wrap">
                  <div class="health-bar">
                    <div
                      class="health-bar-fill"
                      [style.width.%]="doc.health_score"
                      [style.background]="healthColor(doc.health_score)"
                    ></div>
                  </div>
                  <span class="health-pct">{{ doc.health_score }}%</span>
                </div>
              </td>
              <td>
                <span class="top-factor" *ngIf="doc.risk_factors?.length; else noFactor"
                  [title]="doc.risk_factors[0].label">
                  {{ severityIcon(doc.risk_factors[0].severity) }} {{ doc.risk_factors[0].label }}
                </span>
                <ng-template #noFactor><span style="color:#9ca3af">—</span></ng-template>
              </td>
            </tr>
            <tr *ngIf="!docs.length && !loading">
              <td colspan="4" class="no-data">No scored documents yet. Click "Compute All" to begin.</td>
            </tr>
            <tr *ngIf="loading">
              <td colspan="4" class="no-data">Loading…</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Right: detail panel -->
      <div class="detail-panel">
        <ng-container *ngIf="selectedDoc; else emptyDetail">
          <div class="detail-filename">{{ selectedDoc.filename }}</div>
          <div class="detail-doctype" *ngIf="selectedDoc.doc_type">{{ selectedDoc.doc_type }}</div>

          <!-- Score cards -->
          <div class="scores-row">
            <!-- Risk score big display -->
            <div class="score-card">
              <div class="score-label">Risk Score</div>
              <div class="score-big" [style.color]="riskColor(selectedDoc.risk_score)">
                {{ selectedDoc.risk_score }}
              </div>
              <div class="score-sub">out of 100</div>
            </div>

            <!-- Health donut -->
            <div class="score-card">
              <div class="score-label">Health</div>
              <div class="donut-wrap">
                <svg class="donut-svg" width="56" height="56" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="22" fill="none" stroke="#e5e7eb" stroke-width="5"/>
                  <circle
                    cx="28" cy="28" r="22"
                    fill="none"
                    [attr.stroke]="healthColor(selectedDoc.health_score)"
                    stroke-width="5"
                    stroke-linecap="round"
                    [attr.stroke-dasharray]="donutCircumference"
                    [attr.stroke-dashoffset]="donutOffset(selectedDoc.health_score)"
                    style="transition: stroke-dashoffset 0.4s ease"
                  />
                </svg>
                <span class="donut-pct">{{ selectedDoc.health_score }}%</span>
              </div>
            </div>
          </div>

          <!-- Risk factors -->
          <div class="section-title">Risk Factors</div>
          <ul class="factors-list" *ngIf="selectedDoc.risk_factors?.length; else noFactors">
            <li class="factor-item" *ngFor="let f of selectedDoc.risk_factors">
              <span class="factor-icon">{{ severityIcon(f.severity) }}</span>
              <span>{{ f.label }}</span>
            </li>
          </ul>
          <ng-template #noFactors>
            <p style="font-size:13px;color:#9ca3af;margin-bottom:20px">No risk factors detected.</p>
          </ng-template>

          <!-- Missing fields -->
          <div class="section-title">Missing Fields</div>
          <ul class="missing-list" *ngIf="selectedDoc.missing_fields?.length; else allPresent">
            <li class="missing-item" *ngFor="let f of selectedDoc.missing_fields">
              <span class="check">☐</span>
              <span>{{ f }}</span>
            </li>
          </ul>
          <ng-template #allPresent>
            <p class="no-missing">✓ All required fields are present</p>
          </ng-template>
        </ng-container>

        <ng-template #emptyDetail>
          <div class="detail-empty">
            <span class="icon">📋</span>
            <span>Select a document to view details</span>
          </div>
        </ng-template>
      </div>
    </div>
  `
})
export class RiskComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  docs: RiskDoc[] = [];
  selectedDoc: RiskDoc | null = null;
  loading = false;
  computing = false;
  loadError = '';
  batchMessage = '';

  readonly donutCircumference = 2 * Math.PI * 22; // r=22

  ngOnInit(): void {
    this.loadDocs();
  }

  loadDocs(): void {
    this.loading = true;
    this.loadError = '';
    this.http.get<RiskDoc[]>(`${BASE}/api/risk`).subscribe({
      next: docs => {
        this.docs = docs;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.loadError = `Failed to load risk data: ${err.message ?? err.status}`;
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  selectDoc(doc: RiskDoc): void {
    this.selectedDoc = this.selectedDoc?.doc_id === doc.doc_id ? null : doc;
    this.cdr.markForCheck();
  }

  computeAll(): void {
    this.computing = true;
    this.batchMessage = '';
    this.loadError = '';
    this.http.post<{ scored: number }>(`${BASE}/api/risk/batch`, {}).subscribe({
      next: res => {
        this.batchMessage = `Scored ${res?.scored ?? 'all'} documents successfully.`;
        this.computing = false;
        this.loadDocs();
      },
      error: err => {
        this.loadError = `Batch scoring failed: ${err.message ?? err.status}`;
        this.computing = false;
        this.cdr.markForCheck();
      }
    });
  }

  riskClass(score: number): string {
    if (score < 30) return 'green';
    if (score < 60) return 'amber';
    if (score < 80) return 'red';
    return 'darkred';
  }

  riskColor(score: number): string {
    if (score < 30) return '#10b981';
    if (score < 60) return '#f59e0b';
    if (score < 80) return '#ef4444';
    return '#dc2626';
  }

  healthColor(score: number): string {
    if (score >= 75) return '#10b981';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  }

  donutOffset(score: number): number {
    const pct = Math.min(100, Math.max(0, score)) / 100;
    return this.donutCircumference * (1 - pct);
  }

  severityIcon(severity: string): string {
    switch (severity) {
      case 'high':   return '🔴';
      case 'medium': return '🟡';
      case 'low':    return '🟢';
      default:       return 'ℹ️';
    }
  }
}
