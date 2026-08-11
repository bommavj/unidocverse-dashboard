import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { UdvSelectComponent, SelectOption } from '../../components/udv-select/udv-select.component';

const API = 'http://localhost:8000/api';

const STAGE_ORDER = [
  'reported',
  'under_review',
  'investigation',
  'negotiation',
  'settled',
  'closed',
  'denied'
];

const STAGE_COLORS: Record<string, string> = {
  reported: '#94a3b8',
  under_review: '#3b82f6',
  investigation: '#f59e0b',
  negotiation: '#8b5cf6',
  settled: '#10b981',
  closed: '#64748b',
  denied: '#ef4444'
};

const STAGE_LABELS: Record<string, string> = {
  reported: 'Reported',
  under_review: 'Under Review',
  investigation: 'Investigation',
  negotiation: 'Negotiation',
  settled: 'Settled',
  closed: 'Closed',
  denied: 'Denied'
};

const CLAIM_TYPES = [
  { value: 'auto', label: 'Auto' },
  { value: 'property', label: 'Property' },
  { value: 'liability', label: 'Liability' },
  { value: 'health', label: 'Health' },
  { value: 'workers_comp', label: "Worker's Comp" },
  { value: 'general', label: 'General' }
];

const DOC_ROLES = [
  { value: 'policy', label: 'Policy' },
  { value: 'claim_form', label: 'Claim Form' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'medical', label: 'Medical' },
  { value: 'correspondence', label: 'Correspondence' },
  { value: 'settlement', label: 'Settlement' }
];

@Component({
  selector: 'app-claims',
  standalone: true,
  imports: [CommonModule, FormsModule, UdvSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      display: block;
      font-family: 'Inter', sans-serif;
      background: var(--surf);
      min-height: 100vh;
      color: var(--t1);
    }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 24px 32px 0;
    }

    .page-title {
      font-size: 22px;
      font-weight: 700;
      color: var(--t1);
      margin: 0;
    }

    .page-subtitle {
      font-size: 13px;
      color: var(--t3);
      margin: 2px 0 0;
    }

    .btn-primary {
      background: #3b82f6;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 9px 18px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s;
    }
    .btn-primary:hover { background: #2563eb; }

    /* Stats Row */
    .stats-row {
      display: flex;
      gap: 16px;
      padding: 20px 32px;
    }

    .stat-card {
      flex: 1;
      background: var(--surf2);
      border: 1px solid var(--bdr);
      border-radius: 12px;
      padding: 16px 20px;
    }

    .stat-label {
      font-size: 11px;
      color: var(--t3);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
    }

    .stat-value {
      font-size: 26px;
      font-weight: 700;
      color: var(--t1);
      margin: 4px 0 0;
    }

    .stat-sub {
      font-size: 11px;
      color: var(--t2);
      margin-top: 2px;
    }

    /* Stage filter tabs */
    .stage-tabs {
      display: flex;
      gap: 4px;
      padding: 0 32px 16px;
      overflow-x: auto;
    }

    .stage-tab {
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid var(--bdr);
      background: transparent;
      color: var(--t2);
      white-space: nowrap;
      transition: all 0.15s;
    }
    .stage-tab:hover { border-color: var(--t2); color: #cbd5e1; }
    .stage-tab.active { background: #3b82f6; border-color: #3b82f6; color: #fff; }

    /* Main content */
    .main-content {
      display: flex;
      gap: 0;
      padding: 0 32px 32px;
      height: calc(100vh - 260px);
      min-height: 400px;
    }

    /* Claims list */
    .claims-list {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-right: 12px;
    }

    .claims-list::-webkit-scrollbar { width: 4px; }
    .claims-list::-webkit-scrollbar-track { background: transparent; }
    .claims-list::-webkit-scrollbar-thumb { background: var(--surf3); border-radius: 2px; }

    .claim-card {
      background: var(--surf2);
      border: 1px solid var(--bdr);
      border-radius: 12px;
      padding: 16px 18px;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }
    .claim-card:hover { border-color: var(--t2); background: #243047; }
    .claim-card.selected { border-color: #3b82f6; background: #1a2d4a; }

    .claim-card-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .claim-number {
      font-size: 13px;
      font-weight: 700;
      color: #93c5fd;
    }

    .claim-title-text {
      font-size: 14px;
      font-weight: 600;
      color: var(--t1);
      margin: 2px 0 0;
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .claim-card-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 10px;
      font-size: 12px;
      color: var(--t3);
    }

    .claim-meta-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .claim-meta-item .label { color: var(--t2); }
    .claim-meta-item .value { color: var(--t2); font-weight: 500; }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--t2);
    }

    .empty-icon {
      font-size: 40px;
      margin-bottom: 12px;
    }

    /* Detail panel */
    .detail-panel {
      width: 400px;
      min-width: 400px;
      background: var(--surf2);
      border: 1px solid var(--bdr);
      border-radius: 12px;
      margin-left: 16px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .detail-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--bdr);
    }

    .detail-claim-number {
      font-size: 12px;
      color: var(--t3);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .detail-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--t1);
      margin: 4px 0 10px;
    }

    .detail-stage-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .stage-select {
      background: var(--surf);
      border: 1px solid var(--bdr);
      color: #cbd5e1;
      border-radius: 6px;
      padding: 5px 10px;
      font-size: 12px;
      cursor: pointer;
    }

    .stage-select:focus { outline: none; border-color: #3b82f6; }

    .detail-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
    }

    .detail-body::-webkit-scrollbar { width: 4px; }
    .detail-body::-webkit-scrollbar-track { background: transparent; }
    .detail-body::-webkit-scrollbar-thumb { background: var(--surf3); border-radius: 2px; }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 20px;
    }

    .info-item .info-label {
      font-size: 10px;
      color: var(--t2);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
    }

    .info-item .info-value {
      font-size: 13px;
      color: var(--t1);
      font-weight: 500;
      margin-top: 2px;
    }

    .detail-tabs {
      display: flex;
      border-bottom: 1px solid var(--bdr);
      margin-bottom: 16px;
    }

    .detail-tab {
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      color: var(--t3);
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.15s;
    }
    .detail-tab:hover { color: var(--t2); }
    .detail-tab.active { color: #3b82f6; border-bottom-color: #3b82f6; }

    /* Timeline */
    .timeline {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .timeline-item {
      display: flex;
      gap: 12px;
      padding-bottom: 16px;
      position: relative;
    }

    .timeline-item:not(:last-child)::before {
      content: '';
      position: absolute;
      left: 15px;
      top: 30px;
      bottom: 0;
      width: 2px;
      background: var(--surf3);
    }

    .timeline-dot {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: var(--surf2);
      border: 2px solid #3b82f6;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 13px;
      z-index: 1;
    }

    .timeline-content .tl-date {
      font-size: 11px;
      color: var(--t2);
    }

    .timeline-content .tl-desc {
      font-size: 13px;
      color: #cbd5e1;
      margin-top: 2px;
    }

    /* Documents tab */
    .docs-section-title {
      font-size: 11px;
      color: var(--t3);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 700;
      margin: 0 0 8px;
    }

    .doc-role-group {
      margin-bottom: 16px;
    }

    .doc-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      background: var(--surf);
      border-radius: 8px;
      margin-bottom: 4px;
    }

    .doc-icon {
      font-size: 16px;
    }

    .doc-item-name {
      font-size: 12px;
      color: #cbd5e1;
      flex: 1;
    }

    .btn-sm {
      background: #1e3a5f;
      color: #93c5fd;
      border: 1px solid #1d4ed8;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-sm:hover { background: #1d4ed8; color: #fff; }

    /* Modals */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal {
      background: var(--surf2);
      border: 1px solid var(--bdr);
      border-radius: 16px;
      padding: 28px 32px;
      width: 520px;
      max-width: 95vw;
      max-height: 90vh;
      overflow-y: auto;
    }

    .modal-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--t1);
      margin: 0 0 20px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .form-group {
      margin-bottom: 14px;
    }

    .form-label {
      display: block;
      font-size: 11px;
      color: var(--t3);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
      margin-bottom: 5px;
    }

    .form-control {
      width: 100%;
      background: var(--surf);
      border: 1px solid var(--bdr);
      border-radius: 8px;
      color: var(--t1);
      padding: 8px 12px;
      font-size: 13px;
      box-sizing: border-box;
      transition: border-color 0.15s;
    }
    .form-control:focus { outline: none; border-color: #3b82f6; }
    .form-control::placeholder { color: #334155; }

    textarea.form-control { resize: vertical; min-height: 70px; }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 20px;
    }

    .btn-ghost {
      background: transparent;
      color: var(--t3);
      border: 1px solid var(--bdr);
      border-radius: 8px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-ghost:hover { border-color: var(--t2); color: var(--t2); }

    /* Doc picker */
    .doc-picker-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 300px;
      overflow-y: auto;
      margin: 12px 0;
    }

    .doc-picker-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: var(--surf);
      border: 1px solid var(--bdr);
      border-radius: 8px;
      cursor: pointer;
      transition: border-color 0.15s;
    }
    .doc-picker-item:hover { border-color: var(--t2); }
    .doc-picker-item.selected { border-color: #3b82f6; background: #1a2d4a; }

    .doc-picker-name {
      font-size: 13px;
      color: #cbd5e1;
      flex: 1;
    }

    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid var(--bdr);
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .loading-row {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--t2);
      font-size: 13px;
      padding: 20px 0;
      justify-content: center;
    }

    .no-panel-hint {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #334155;
      font-size: 13px;
      text-align: center;
      gap: 8px;
    }

    .value-highlight {
      color: #34d399;
      font-weight: 700;
    }

    .add-doc-btn-row {
      margin-top: 12px;
    }

    .btn-danger {
      background: transparent;
      color: #ef4444;
      border: 1px solid #ef4444;
      border-radius: 8px;
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-danger:hover { background: #ef444422; }
  `],
  template: `
    <!-- ===== Page Header ===== -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Insurance Claims</h1>
        <p class="page-subtitle">Manage and track all insurance claims</p>
      </div>
      <button class="btn-primary" (click)="openNewClaim()">
        ＋ New Claim
      </button>
    </div>

    <!-- ===== Stats Row ===== -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">Total Claims</div>
        <div class="stat-value">{{ claims.length }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Open</div>
        <div class="stat-value">{{ openCount }}</div>
        <div class="stat-sub">active claims</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Settled</div>
        <div class="stat-value">{{ settledCount }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Est. Total Value</div>
        <div class="stat-value value-highlight">{{ totalEstimated | currency:'USD':'symbol':'1.0-0' }}</div>
      </div>
    </div>

    <!-- ===== Stage Filter Tabs ===== -->
    <div class="stage-tabs">
      <button class="stage-tab" [class.active]="activeStageFilter === 'all'" (click)="setFilter('all')">
        All ({{ claims.length }})
      </button>
      <button
        *ngFor="let s of stageList"
        class="stage-tab"
        [class.active]="activeStageFilter === s"
        (click)="setFilter(s)"
      >
        {{ stageLabel(s) }} ({{ countByStage(s) }})
      </button>
    </div>

    <!-- ===== Main Content ===== -->
    <div class="main-content">

      <!-- Claims list -->
      <div class="claims-list">
        <div *ngIf="loading" class="loading-row">
          <span class="spinner"></span> Loading claims…
        </div>

        <div *ngIf="!loading && filteredClaims.length === 0" class="empty-state">
          <div class="empty-icon">📋</div>
          <div>No claims found</div>
        </div>

        <div
          *ngFor="let c of filteredClaims"
          class="claim-card"
          [class.selected]="selectedClaim?.id === c.id"
          (click)="selectClaim(c)"
        >
          <div class="claim-card-top">
            <div>
              <div class="claim-number">{{ c.claim_number || 'CLM-' + c.id }}</div>
              <div class="claim-title-text">{{ c.title }}</div>
            </div>
            <span
              class="badge"
              [style.background]="stageColor(c.stage) + '22'"
              [style.color]="stageColor(c.stage)"
            >{{ stageLabel(c.stage) }}</span>
          </div>
          <div class="claim-card-meta">
            <div class="claim-meta-item">
              <span class="label">Claimant:</span>
              <span class="value">{{ c.claimant_name || '—' }}</span>
            </div>
            <div class="claim-meta-item">
              <span
                class="badge"
                [style.background]="'#1e293b'"
                [style.color]="'#94a3b8'"
                [style.border]="'1px solid #334155'"
              >{{ c.claim_type | titlecase }}</span>
            </div>
            <div class="claim-meta-item" *ngIf="c.estimated_value">
              <span class="label">Est:</span>
              <span class="value value-highlight">{{ c.estimated_value | currency:'USD':'symbol':'1.0-0' }}</span>
            </div>
            <div class="claim-meta-item" *ngIf="c.adjuster">
              <span class="label">Adjuster:</span>
              <span class="value">{{ c.adjuster }}</span>
            </div>
            <div class="claim-meta-item">
              <span class="label">Docs:</span>
              <span class="value">{{ c.doc_count ?? 0 }}</span>
            </div>
            <div class="claim-meta-item">
              <span class="label">Age:</span>
              <span class="value">{{ daysSince(c.created_at) }}d</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Detail Panel -->
      <div class="detail-panel" *ngIf="selectedClaim">
        <div class="detail-header">
          <div class="detail-claim-number">{{ selectedClaim.claim_number || 'CLM-' + selectedClaim.id }}</div>
          <div class="detail-title">{{ selectedClaim.title }}</div>
          <div class="detail-stage-row">
            <span
              class="badge"
              [style.background]="stageColor(selectedClaim.stage) + '22'"
              [style.color]="stageColor(selectedClaim.stage)"
            >{{ stageLabel(selectedClaim.stage) }}</span>
            <udv-select [(ngModel)]="moveStageValue" [options]="moveStageOptions" placeholder="Move stage…" (valueChange)="moveStage()"></udv-select>
          </div>
          <div class="detail-actions" style="display:flex;gap:8px;margin-top:10px;">
            <button class="btn-sm" (click)="openEditClaim()">✏ Edit</button>
            <button class="btn-sm btn-danger" (click)="confirmDeleteClaim()">🗑 Delete</button>
          </div>
        </div>

        <div class="detail-body">
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Claimant</div>
              <div class="info-value">{{ selectedClaim.claimant_name || '—' }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Adjuster</div>
              <div class="info-value">{{ selectedClaim.adjuster || '—' }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Claim Type</div>
              <div class="info-value">{{ selectedClaim.claim_type | titlecase }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Est. Value</div>
              <div class="info-value value-highlight">
                {{ selectedClaim.estimated_value ? (selectedClaim.estimated_value | currency:'USD':'symbol':'1.0-0') : '—' }}
              </div>
            </div>
            <div class="info-item">
              <div class="info-label">Settled Value</div>
              <div class="info-value">
                {{ selectedClaim.settled_value ? (selectedClaim.settled_value | currency:'USD':'symbol':'1.0-0') : '—' }}
              </div>
            </div>
            <div class="info-item">
              <div class="info-label">Opened</div>
              <div class="info-value">{{ selectedClaim.created_at | date:'mediumDate' }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Last Updated</div>
              <div class="info-value">{{ selectedClaim.updated_at | date:'mediumDate' }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Documents</div>
              <div class="info-value">{{ selectedClaim.doc_count ?? (detailDocs.length) }}</div>
            </div>
          </div>

          <!-- Tabs -->
          <div class="detail-tabs">
            <div class="detail-tab" [class.active]="detailTab === 'timeline'" (click)="detailTab = 'timeline'">Timeline</div>
            <div class="detail-tab" [class.active]="detailTab === 'documents'" (click)="detailTab = 'documents'">Documents</div>
          </div>

          <!-- Timeline Tab -->
          <div *ngIf="detailTab === 'timeline'">
            <div *ngIf="detailLoading" class="loading-row">
              <span class="spinner"></span> Loading…
            </div>
            <div class="timeline" *ngIf="!detailLoading">
              <div *ngIf="detailTimeline.length === 0" style="color:#475569;font-size:13px;text-align:center;padding:20px 0;">
                No timeline events yet.
              </div>
              <div *ngFor="let e of detailTimeline" class="timeline-item">
                <div class="timeline-dot">{{ timelineIcon(e) }}</div>
                <div class="timeline-content">
                  <div class="tl-date">{{ e.created_at | date:'medium' }}</div>
                  <div class="tl-desc">{{ e.description || e.event || e.action }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Documents Tab -->
          <div *ngIf="detailTab === 'documents'">
            <div *ngIf="detailLoading" class="loading-row">
              <span class="spinner"></span> Loading…
            </div>
            <div *ngIf="!detailLoading">
              <div *ngFor="let role of docRoles">
                <div *ngIf="docsByRole(role.value).length > 0" class="doc-role-group">
                  <div class="docs-section-title">{{ role.label }}</div>
                  <div *ngFor="let d of docsByRole(role.value)" class="doc-item">
                    <span class="doc-icon">📄</span>
                    <span class="doc-item-name">{{ d.title || d.filename || ('Doc #' + d.doc_id) }}</span>
                  </div>
                </div>
              </div>
              <div *ngIf="detailDocs.length === 0" style="color:#475569;font-size:13px;text-align:center;padding:20px 0;">
                No documents attached yet.
              </div>
              <div class="add-doc-btn-row">
                <button class="btn-sm" (click)="openDocPicker()">+ Add Document</button>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- No claim selected hint -->
      <div class="detail-panel" *ngIf="!selectedClaim">
        <div class="no-panel-hint">
          <div style="font-size:32px;">📋</div>
          <div>Select a claim to view details</div>
        </div>
      </div>

    </div>

    <!-- ===== New Claim Modal ===== -->
    <div class="modal-overlay" *ngIf="showNewClaimModal" (click)="closeNewClaim()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-title">New Insurance Claim</div>

        <div class="form-group">
          <label class="form-label">Title *</label>
          <input class="form-control" [(ngModel)]="newClaim.title" placeholder="Brief claim description" />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Claim Type *</label>
            <udv-select [(ngModel)]="newClaim.claim_type" [options]="claimTypeOptions" placeholder="Select type…"></udv-select>
          </div>
          <div class="form-group">
            <label class="form-label">Claim Number</label>
            <input class="form-control" [(ngModel)]="newClaim.claim_number" placeholder="e.g. CLM-2024-001" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Claimant Name</label>
            <input class="form-control" [(ngModel)]="newClaim.claimant_name" placeholder="Full name" />
          </div>
          <div class="form-group">
            <label class="form-label">Incident Date</label>
            <input class="form-control" type="date" [(ngModel)]="newClaim.incident_date" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Estimated Value ($)</label>
            <input class="form-control" type="number" [(ngModel)]="newClaim.estimated_value" placeholder="0.00" />
          </div>
          <div class="form-group">
            <label class="form-label">Adjuster</label>
            <input class="form-control" [(ngModel)]="newClaim.adjuster" placeholder="Adjuster name" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-control" [(ngModel)]="newClaim.description" placeholder="Describe the incident or claim details…"></textarea>
        </div>

        <div class="modal-footer">
          <button class="btn-ghost" (click)="closeNewClaim()">Cancel</button>
          <button class="btn-primary" (click)="submitNewClaim()" [disabled]="saving">
            <span *ngIf="saving" class="spinner"></span>
            {{ saving ? 'Creating…' : 'Create Claim' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ===== Add Document Modal ===== -->
    <div class="modal-overlay" *ngIf="showDocPickerModal" (click)="closeDocPicker()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-title">Add Document</div>

        <div class="form-group">
          <label class="form-label">Document Role</label>
          <udv-select [(ngModel)]="pickerRole" [options]="docRoleOptions" placeholder="Select role…"></udv-select>
        </div>

        <div class="form-label" style="margin-bottom:6px;">Select Document</div>
        <div *ngIf="availableDocsLoading" class="loading-row">
          <span class="spinner"></span> Loading documents…
        </div>
        <div class="doc-picker-list" *ngIf="!availableDocsLoading">
          <div
            *ngFor="let d of availableDocs"
            class="doc-picker-item"
            [class.selected]="pickerDocId === d.id"
            (click)="pickerDocId = d.id"
          >
            <span>📄</span>
            <span class="doc-picker-name">{{ d.title || d.filename || ('Doc #' + d.id) }}</span>
          </div>
          <div *ngIf="availableDocs.length === 0" style="color:#475569;font-size:13px;padding:16px 0;text-align:center;">
            No documents available.
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-ghost" (click)="closeDocPicker()">Cancel</button>
          <button
            class="btn-primary"
            (click)="attachDocument()"
            [disabled]="!pickerDocId || !pickerRole || saving"
          >
            <span *ngIf="saving" class="spinner"></span>
            {{ saving ? 'Attaching…' : 'Attach' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ===== Edit Claim Modal ===== -->
    <div class="modal-overlay" *ngIf="showEditClaim" (click)="showEditClaim=false">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-title">Edit Claim</div>

        <div class="form-group">
          <label class="form-label">Title</label>
          <input class="form-control" [(ngModel)]="editClaimData.title" placeholder="Claim title" />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Claim Number</label>
            <input class="form-control" [(ngModel)]="editClaimData.claim_number" placeholder="CLM-2024-001" />
          </div>
          <div class="form-group">
            <label class="form-label">Claim Type</label>
            <udv-select [(ngModel)]="editClaimData.claim_type" [options]="claimTypeOptions" placeholder="Select type…"></udv-select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Claimant Name</label>
            <input class="form-control" [(ngModel)]="editClaimData.claimant_name" placeholder="Full name" />
          </div>
          <div class="form-group">
            <label class="form-label">Adjuster</label>
            <input class="form-control" [(ngModel)]="editClaimData.adjuster" placeholder="Adjuster name" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Estimated Value ($)</label>
            <input class="form-control" type="number" [(ngModel)]="editClaimData.estimated_value" placeholder="0.00" />
          </div>
          <div class="form-group">
            <label class="form-label">Settled Value ($)</label>
            <input class="form-control" type="number" [(ngModel)]="editClaimData.settled_value" placeholder="0.00" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Status</label>
          <udv-select [(ngModel)]="editClaimData.status" [options]="claimStatusOptions" placeholder="Select status…"></udv-select>
        </div>

        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-control" [(ngModel)]="editClaimData.description" placeholder="Claim details…"></textarea>
        </div>

        <div class="modal-footer">
          <button class="btn-ghost" (click)="showEditClaim=false">Cancel</button>
          <button class="btn-primary" (click)="saveEditClaim()" [disabled]="saving">
            <span *ngIf="saving" class="spinner"></span>
            {{ saving ? 'Saving…' : 'Save Changes' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ===== Delete Claim Confirm Modal ===== -->
    <div class="modal-overlay" *ngIf="showDeleteClaim" (click)="showDeleteClaim=false">
      <div class="modal" style="max-width:400px;" (click)="$event.stopPropagation()">
        <div class="modal-title" style="color:#ef4444;">Delete Claim</div>
        <p style="color:var(--t2);font-size:14px;margin:12px 0 20px;">
          Are you sure you want to delete <strong style="color:var(--t1);">{{ selectedClaim?.title }}</strong>?
          This cannot be undone.
        </p>
        <div class="modal-footer">
          <button class="btn-ghost" (click)="showDeleteClaim=false">Cancel</button>
          <button class="btn-danger" (click)="deleteClaim()">🗑 Delete</button>
        </div>
      </div>
    </div>
  `
})
export class ClaimsComponent implements OnInit {

  // ── Data ──────────────────────────────────────────────────────────────────
  claims: any[] = [];
  loading = false;

  // ── Filter ─────────────────────────────────────────────────────────────────
  activeStageFilter = 'all';

  // ── Selected claim detail ──────────────────────────────────────────────────
  selectedClaim: any = null;
  detailTimeline: any[] = [];
  detailDocs: any[] = [];
  detailTab = 'timeline';
  detailLoading = false;
  moveStageValue = '';

  // ── New claim modal ────────────────────────────────────────────────────────
  showNewClaimModal = false;
  saving = false;
  newClaim: any = { title: '', claim_type: '', claim_number: '', claimant_name: '', incident_date: '', estimated_value: null, adjuster: '', description: '' };

  // ── Edit / Delete claim modals ─────────────────────────────────────────────
  showEditClaim = false;
  showDeleteClaim = false;
  editClaimData = { title: '', claim_number: '', claimant_name: '', claim_type: '', adjuster: '', estimated_value: null as number|null, settled_value: null as number|null, description: '', status: 'open' };

  // ── Doc picker modal ───────────────────────────────────────────────────────
  showDocPickerModal = false;
  availableDocs: any[] = [];
  availableDocsLoading = false;
  pickerDocId: any = null;
  pickerRole = '';

  // ── Constants exposed to template ─────────────────────────────────────────
  stageList = STAGE_ORDER;
  claimTypes = CLAIM_TYPES;
  docRoles = DOC_ROLES;

  readonly moveStageOptions: SelectOption[] = STAGE_ORDER.map(s => ({ value: s, label: '→ ' + STAGE_LABELS[s] }));
  readonly claimTypeOptions: SelectOption[] = CLAIM_TYPES.map(t => ({ value: t.value, label: t.label }));
  readonly docRoleOptions: SelectOption[] = DOC_ROLES.map(r => ({ value: r.value, label: r.label }));
  readonly claimStatusOptions: SelectOption[] = [
    { value: 'open', label: 'Open' },
    { value: 'closed', label: 'Closed' },
    { value: 'disputed', label: 'Disputed' },
  ];

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadClaims();
  }

  // ── Computed stats ─────────────────────────────────────────────────────────
  get openCount(): number {
    return this.claims.filter(c => !['settled', 'closed', 'denied'].includes(c.stage)).length;
  }

  get settledCount(): number {
    return this.claims.filter(c => c.stage === 'settled').length;
  }

  get totalEstimated(): number {
    return this.claims.reduce((sum, c) => sum + (c.estimated_value || 0), 0);
  }

  get filteredClaims(): any[] {
    if (this.activeStageFilter === 'all') return this.claims;
    return this.claims.filter(c => c.stage === this.activeStageFilter);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  stageColor(stage: string): string {
    return STAGE_COLORS[stage] || '#94a3b8';
  }

  stageLabel(stage: string): string {
    return STAGE_LABELS[stage] || stage;
  }

  countByStage(stage: string): number {
    return this.claims.filter(c => c.stage === stage).length;
  }

  daysSince(dateStr: string): number {
    if (!dateStr) return 0;
    const ms = Date.now() - new Date(dateStr).getTime();
    return Math.floor(ms / 86400000);
  }

  docsByRole(role: string): any[] {
    return this.detailDocs.filter(d => d.role === role);
  }

  timelineIcon(event: any): string {
    const t = (event.event_type || event.type || '').toLowerCase();
    if (t.includes('creat')) return '🆕';
    if (t.includes('stage') || t.includes('status')) return '🔄';
    if (t.includes('doc')) return '📄';
    if (t.includes('note') || t.includes('comment')) return '💬';
    if (t.includes('settle')) return '✅';
    return '•';
  }

  setFilter(stage: string): void {
    this.activeStageFilter = stage;
    this.cdr.markForCheck();
  }

  // ── API calls ──────────────────────────────────────────────────────────────
  loadClaims(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.http.get<any[]>(`${API}/claims`).subscribe({
      next: (data) => {
        this.claims = data || [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  selectClaim(claim: any): void {
    this.selectedClaim = claim;
    this.detailTab = 'timeline';
    this.moveStageValue = '';
    this.loadClaimDetail(claim.id);
    this.cdr.markForCheck();
  }

  loadClaimDetail(id: number): void {
    this.detailLoading = true;
    this.detailTimeline = [];
    this.detailDocs = [];
    this.cdr.markForCheck();

    this.http.get<any>(`${API}/claims/${id}`).subscribe({
      next: (data) => {
        this.selectedClaim = data;
        this.detailTimeline = data.timeline || [];
        this.detailDocs = data.documents || [];
        this.detailLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.detailLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  moveStage(): void {
    if (!this.moveStageValue || !this.selectedClaim) return;
    const stage = this.moveStageValue;
    this.moveStageValue = '';
    this.http.patch(`${API}/claims/${this.selectedClaim.id}/stage`, null, { params: { stage } }).subscribe({
      next: () => {
        this.loadClaimDetail(this.selectedClaim.id);
        this.loadClaims();
      }
    });
  }

  // ── Edit / Delete Claim ────────────────────────────────────────────────────
  openEditClaim(): void {
    if (!this.selectedClaim) return;
    this.editClaimData = {
      title: this.selectedClaim.title,
      claim_number: this.selectedClaim.claim_number || '',
      claimant_name: this.selectedClaim.claimant_name || '',
      claim_type: this.selectedClaim.claim_type || '',
      adjuster: this.selectedClaim.adjuster || '',
      estimated_value: this.selectedClaim.estimated_value || null,
      settled_value: this.selectedClaim.settled_value || null,
      description: this.selectedClaim.description || '',
      status: this.selectedClaim.status || 'open'
    };
    this.showEditClaim = true;
    this.cdr.markForCheck();
  }

  saveEditClaim(): void {
    if (!this.selectedClaim) return;
    this.saving = true;
    this.cdr.markForCheck();
    this.http.patch(`${API}/claims/${this.selectedClaim.id}`, this.editClaimData).subscribe({
      next: () => {
        this.saving = false;
        this.showEditClaim = false;
        this.loadClaimDetail(this.selectedClaim.id);
        this.loadClaims();
        this.cdr.markForCheck();
      },
      error: () => { this.saving = false; this.cdr.markForCheck(); }
    });
  }

  confirmDeleteClaim(): void {
    this.showDeleteClaim = true;
    this.cdr.markForCheck();
  }

  deleteClaim(): void {
    if (!this.selectedClaim) return;
    this.http.delete(`${API}/claims/${this.selectedClaim.id}`).subscribe({
      next: () => {
        this.showDeleteClaim = false;
        this.selectedClaim = null;
        this.loadClaims();
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  // ── New Claim ──────────────────────────────────────────────────────────────
  openNewClaim(): void {
    this.newClaim = { title: '', claim_type: '', claim_number: '', claimant_name: '', incident_date: '', estimated_value: null, adjuster: '', description: '' };
    this.showNewClaimModal = true;
    this.cdr.markForCheck();
  }

  closeNewClaim(): void {
    this.showNewClaimModal = false;
    this.cdr.markForCheck();
  }

  submitNewClaim(): void {
    if (!this.newClaim.title || !this.newClaim.claim_type) return;
    this.saving = true;
    this.cdr.markForCheck();

    const body: any = { title: this.newClaim.title, claim_type: this.newClaim.claim_type };
    if (this.newClaim.claim_number) body.claim_number = this.newClaim.claim_number;
    if (this.newClaim.claimant_name) body.claimant_name = this.newClaim.claimant_name;
    if (this.newClaim.incident_date) body.incident_date = this.newClaim.incident_date;
    if (this.newClaim.estimated_value) body.estimated_value = Number(this.newClaim.estimated_value);
    if (this.newClaim.adjuster) body.adjuster = this.newClaim.adjuster;
    if (this.newClaim.description) body.description = this.newClaim.description;

    this.http.post<any>(`${API}/claims`, body).subscribe({
      next: () => {
        this.saving = false;
        this.showNewClaimModal = false;
        this.loadClaims();
        this.cdr.markForCheck();
      },
      error: () => {
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }

  // ── Doc Picker ─────────────────────────────────────────────────────────────
  openDocPicker(): void {
    this.pickerDocId = null;
    this.pickerRole = '';
    this.showDocPickerModal = true;
    this.availableDocsLoading = true;
    this.cdr.markForCheck();

    this.http.get<any>(`${API}/documents?limit=100`).subscribe({
      next: (res) => {
        this.availableDocs = Array.isArray(res) ? res : (res.items || res.documents || []);
        this.availableDocsLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.availableDocs = [];
        this.availableDocsLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  closeDocPicker(): void {
    this.showDocPickerModal = false;
    this.cdr.markForCheck();
  }

  attachDocument(): void {
    if (!this.pickerDocId || !this.pickerRole || !this.selectedClaim) return;
    this.saving = true;
    this.cdr.markForCheck();

    this.http.post(`${API}/claims/${this.selectedClaim.id}/documents`, { doc_id: this.pickerDocId, role: this.pickerRole }).subscribe({
      next: () => {
        this.saving = false;
        this.showDocPickerModal = false;
        this.loadClaimDetail(this.selectedClaim.id);
        this.cdr.markForCheck();
      },
      error: () => {
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }
}
