import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ReplacePipe } from '../../pipes/replace.pipe';
import { UdvSelectComponent, SelectOption } from '../../components/udv-select/udv-select.component';

interface JurisdictionProduct {
  lob: string;
  available: boolean;
  required: boolean;
  min_limits: any;
  required_coverages: string[];
  required_endorsements: string[];
  agency_notes?: string;
}

interface JurisdictionForm {
  form_code: string;
  form_name: string;
  trigger_condition: string;
  filing_entity?: string;
  deadline_days?: number;
  instructions?: string;
}

interface Jurisdiction {
  id: string;
  state_code: string;
  state_name: string;
  country_code: string;
  config: any;
  products: JurisdictionProduct[];
  forms: JurisdictionForm[];
  product_count?: number;
}

@Component({
  selector: 'app-jurisdiction',
  standalone: true,
  imports: [CommonModule, FormsModule, ReplacePipe, UdvSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="jur-page">

  <!-- Header -->
  <div class="jur-header">
    <div>
      <h1 class="jur-title">Jurisdiction Rules</h1>
      <p class="jur-sub">Config-driven insurance requirements per state. Adding a state = one row, no code.</p>
    </div>
    <div class="jur-actions">
      <udv-select [(ngModel)]="selectedCountry" [options]="countryOptions" placeholder="Select country…" (valueChange)="load()" style="width:220px;"></udv-select>
      <button class="btn-seed" (click)="seed()" [disabled]="seeding">
        {{ seeding ? 'Seeding…' : (selectedCountry === 'US' ? '⚡ Seed All 50 States' : '⚡ Seed International') }}
      </button>
    </div>
  </div>

  <!-- Stats bar -->
  <div class="jur-stats" *ngIf="jurisdictions.length">
    <div class="stat-chip">
      <span class="stat-n">{{ jurisdictions.length }}</span>
      <span class="stat-l">Jurisdictions</span>
    </div>
    <div class="stat-chip">
      <span class="stat-n">{{ noFaultCount }}</span>
      <span class="stat-l">No-Fault States</span>
    </div>
    <div class="stat-chip">
      <span class="stat-n">{{ sr22Count }}</span>
      <span class="stat-l">SR-22 States</span>
    </div>
    <div class="stat-chip">
      <span class="stat-n">{{ fr44Count }}</span>
      <span class="stat-l">FR-44 States</span>
    </div>
    <div class="stat-chip">
      <span class="stat-n">{{ pipCount }}</span>
      <span class="stat-l">PIP Required</span>
    </div>
  </div>

  <!-- Policy validator -->
  <div class="validator-panel">
    <div class="val-header" (click)="showValidator=!showValidator">
      <span>🔍 Policy Compliance Checker</span>
      <span class="val-toggle">{{ showValidator ? '▲' : '▼' }}</span>
    </div>
    <div class="val-body" *ngIf="showValidator">
      <div class="val-grid">
        <div class="val-field">
          <label>State</label>
          <udv-select [(ngModel)]="validator.state" [options]="validatorStateOptions" placeholder="— select —"></udv-select>
        </div>
        <div class="val-field">
          <label>Line of Business</label>
          <udv-select [(ngModel)]="validator.lob" [options]="validatorLobOptions" placeholder="Select LOB…"></udv-select>
        </div>
        <div class="val-field">
          <label>BI per Person ($k)</label>
          <input type="number" [(ngModel)]="validator.bi_pp" class="val-input" placeholder="e.g. 15">
        </div>
        <div class="val-field">
          <label>BI per Accident ($k)</label>
          <input type="number" [(ngModel)]="validator.bi_pa" class="val-input" placeholder="e.g. 30">
        </div>
        <div class="val-field">
          <label>Property Damage ($k)</label>
          <input type="number" [(ngModel)]="validator.pd" class="val-input" placeholder="e.g. 5">
        </div>
        <div class="val-field">
          <label>PIP ($k)</label>
          <input type="number" [(ngModel)]="validator.pip" class="val-input" placeholder="leave blank if N/A">
        </div>
        <div class="val-field">
          <label>UM per Person ($k)</label>
          <input type="number" [(ngModel)]="validator.um_pp" class="val-input" placeholder="optional">
        </div>
        <div class="val-field val-run">
          <button class="btn-validate" (click)="validate()" [disabled]="validating || !validator.state">
            {{ validating ? 'Checking…' : 'Check Compliance' }}
          </button>
        </div>
      </div>

      <div class="val-result" *ngIf="validationResult">
        <div class="val-ok" *ngIf="validationResult.valid">
          ✅ Policy meets all {{ validator.state }} minimums
        </div>
        <div class="val-fail" *ngIf="!validationResult.valid">
          <div class="val-fail-title">⚠️ {{ validationResult.violations.length }} violation(s) found</div>
          <div class="violation" *ngFor="let v of validationResult.violations">
            <span class="viol-field">{{ v.label }}</span>
            <span class="viol-msg">{{ v.message }}</span>
          </div>
        </div>
        <div class="val-mins" *ngIf="validationResult.minimum_limits">
          <span class="val-mins-label">{{ validator.state }} minimums:</span>
          <span *ngFor="let lim of validationResult.minimum_limits | keyvalue">
            <ng-container *ngIf="lim.value">{{ $any(lim.key) | replace:'_k':'($k)' | replace:'_':' ' }}: {{ '$' + $any(lim.value) + 'k' }} &nbsp;</ng-container>
          </span>
        </div>
      </div>
    </div>
  </div>

  <!-- Main content -->
  <div class="jur-content">

    <!-- State list -->
    <div class="jur-list">
      <div class="jur-search">
        <input [(ngModel)]="searchQ" placeholder="Search states…" class="jur-search-input">
      </div>
      <div class="jur-list-items">
        <div *ngFor="let j of filtered"
             class="jur-item"
             [class.active]="selected?.id === j.id"
             (click)="select(j)">
          <div class="jur-item-main">
            <span class="jur-state-code">{{ j.state_code || j.country_code }}</span>
            <span class="jur-state-name">{{ j.state_name }}</span>
          </div>
          <div class="jur-item-badges">
            <span class="badge-nf" *ngIf="j.config?.no_fault" title="No-fault state">NF</span>
            <span class="badge-pip" *ngIf="j.config?.pip_required" title="PIP required">PIP</span>
            <span class="badge-sr22" *ngIf="j.config?.sr22_available" title="SR-22">SR22</span>
            <span class="badge-fr44" *ngIf="j.config?.fr44_available" title="FR-44">FR44</span>
          </div>
        </div>
        <div class="jur-empty" *ngIf="!loading && !filtered.length">
          No jurisdictions seeded yet. Click "⚡ Seed All 50 States" above.
        </div>
        <div class="jur-loading" *ngIf="loading">Loading…</div>
      </div>
    </div>

    <!-- Detail panel -->
    <div class="jur-detail" *ngIf="selected">
      <div class="det-header">
        <div>
          <h2 class="det-title">{{ selected.state_name }}</h2>
          <div class="det-badges">
            <span class="badge-nf lg" *ngIf="selected.config?.no_fault">No-Fault State</span>
            <span class="badge-pip lg" *ngIf="selected.config?.pip_required">PIP Required</span>
            <span class="badge-sr22 lg" *ngIf="selected.config?.sr22_available">SR-22</span>
            <span class="badge-fr44 lg" *ngIf="selected.config?.fr44_available">FR-44</span>
          </div>
        </div>
        <div class="det-tabs">
          <button [class.on]="detTab==='overview'"  (click)="detTab='overview'">Overview</button>
          <button [class.on]="detTab==='products'"  (click)="detTab='products'">Products</button>
          <button [class.on]="detTab==='forms'"     (click)="detTab='forms'">Forms & Filings</button>
        </div>
      </div>

      <!-- Overview tab -->
      <div class="det-body" *ngIf="detTab==='overview'">
        <div class="info-grid">

          <!-- International: regulator + currency -->
          <ng-container *ngIf="selected.config?.regulator">
            <div class="info-card">
              <div class="info-label">Market Info</div>
              <div class="info-rows">
                <div class="info-row"><span>Regulator</span><strong>{{ selected.config.regulator }}</strong></div>
                <div class="info-row"><span>Currency</span><strong>{{ selected.config.currency }}</strong></div>
                <div class="info-row"><span>Region</span><strong>{{ selected.config.region }}</strong></div>
                <div class="info-row"><span>TP Required</span><strong>{{ selected.config.tp_required ? 'Yes' : 'No' }}</strong></div>
                <div class="info-row"><span>No-Fault Elements</span><strong>{{ selected.config.no_fault ? 'Yes' : 'No' }}</strong></div>
                <div class="info-row"><span>Cancellation Notice</span><strong>{{ selected.config.cancellation_days }} days</strong></div>
              </div>
            </div>
          </ng-container>

          <!-- US: cancellation notice -->
          <div class="info-card" *ngIf="selected.config?.cancellation_notice">
            <div class="info-label">Cancellation Notice</div>
            <div class="info-rows">
              <div class="info-row">
                <span>Non-payment</span>
                <strong>{{ selected.config?.cancellation_notice?.nonpayment_days }} days</strong>
              </div>
              <div class="info-row">
                <span>Underwriting</span>
                <strong>{{ selected.config?.cancellation_notice?.underwriting_days }} days</strong>
              </div>
            </div>
          </div>

          <!-- US: auto limits -->
          <div class="info-card" *ngIf="autoProduct">
            <div class="info-label">Auto Minimum Limits</div>
            <div class="info-rows">
              <div class="info-row">
                <span>BI per Person</span>
                <strong>{{ autoProduct.min_limits?.bi_per_person_k ? '$' + autoProduct.min_limits.bi_per_person_k + 'k' : '—' }}</strong>
              </div>
              <div class="info-row">
                <span>BI per Accident</span>
                <strong>{{ autoProduct.min_limits?.bi_per_accident_k ? '$' + autoProduct.min_limits.bi_per_accident_k + 'k' : '—' }}</strong>
              </div>
              <div class="info-row">
                <span>Property Damage</span>
                <strong>{{ autoProduct.min_limits?.property_damage_k ? '$' + autoProduct.min_limits.property_damage_k + 'k' : '—' }}</strong>
              </div>
              <div class="info-row" *ngIf="autoProduct.min_limits?.pip_k">
                <span>PIP (No-Fault)</span>
                <strong>{{ '$' + autoProduct.min_limits.pip_k + 'k' }}</strong>
              </div>
              <div class="info-row" *ngIf="autoProduct.min_limits?.um_per_person_k">
                <span>UM per Person</span>
                <strong>{{ '$' + autoProduct.min_limits.um_per_person_k + 'k' }}</strong>
              </div>
              <div class="info-row" *ngIf="autoProduct.min_limits?.um_per_accident_k">
                <span>UM per Accident</span>
                <strong>{{ '$' + autoProduct.min_limits.um_per_accident_k + 'k' }}</strong>
              </div>
            </div>
          </div>

          <!-- Motor notes (international) -->
          <div class="info-card info-card--wide" *ngIf="selected.config?.motor_notes">
            <div class="info-label">Motor / Auto Rules</div>
            <p class="info-note">{{ selected.config.motor_notes }}</p>
          </div>

          <!-- Key rules (international) -->
          <div class="info-card info-card--wide" *ngIf="selected.config?.key_rules">
            <div class="info-label">Key Regulatory Rules</div>
            <p class="info-note">{{ selected.config.key_rules }}</p>
          </div>

          <!-- US state notes -->
          <div class="info-card info-card--wide" *ngIf="selected.config?.notes">
            <div class="info-label">State Notes</div>
            <p class="info-note">{{ selected.config.notes }}</p>
          </div>
        </div>
      </div>

      <!-- Products tab -->
      <div class="det-body" *ngIf="detTab==='products'">
        <div class="prod-list">
          <div class="prod-item" *ngFor="let p of selected.products">
            <div class="prod-top">
              <span class="prod-lob">{{ p.lob | replace:'_':' ' | uppercase }}</span>
              <span class="prod-avail" [class.yes]="p.available" [class.no]="!p.available">
                {{ p.available ? '✓ Available' : '✗ Not Available' }}
              </span>
              <span class="prod-req" *ngIf="p.required">Required by law</span>
            </div>
            <div class="prod-covs" *ngIf="p.required_coverages?.length">
              Required: {{ p.required_coverages.join(', ') }}
            </div>
            <div class="prod-notes" *ngIf="p.agency_notes">📝 {{ p.agency_notes }}</div>
          </div>
          <div class="prod-empty" *ngIf="!selected.products?.length">
            No products configured for this state. Use the API or import to add.
          </div>
        </div>
      </div>

      <!-- Forms & Filings tab -->
      <div class="det-body" *ngIf="detTab==='forms'">
        <div class="form-list">
          <div class="form-item" *ngFor="let f of selected.forms">
            <div class="form-top">
              <span class="form-code">{{ f.form_code }}</span>
              <span class="form-name">{{ f.form_name }}</span>
              <span class="form-trigger">{{ f.trigger_condition | replace:'_':' ' }}</span>
            </div>
            <div class="form-meta">
              <span *ngIf="f.filing_entity">Filed with: <strong>{{ f.filing_entity }}</strong></span>
              <span *ngIf="f.deadline_days">Deadline: <strong>{{ f.deadline_days }} days</strong></span>
            </div>
            <div class="form-inst" *ngIf="f.instructions">{{ f.instructions }}</div>
          </div>
          <div class="form-empty" *ngIf="!selected.forms?.length">
            No forms/filings configured for this state.
          </div>
        </div>
      </div>

    </div>

    <!-- Empty state -->
    <div class="jur-detail jur-empty-detail" *ngIf="!selected">
      <div class="empty-icon">🗺️</div>
      <div class="empty-msg">Select a state to view its requirements</div>
    </div>

  </div>
</div>
  `,
  styles: [`
:host { display:block; height:100%; overflow:hidden; }

.jur-page { display:flex; flex-direction:column; height:100%; background:#f8fafc; overflow:hidden; }

.jur-header { display:flex; align-items:flex-start; justify-content:space-between; padding:20px 24px 0; gap:16px; }
.jur-title  { font-size:20px; font-weight:700; color:#1e293b; margin:0; }
.jur-sub    { font-size:12px; color:#64748b; margin:4px 0 0; }
.jur-actions { display:flex; gap:10px; align-items:center; flex-shrink:0; }
.jur-select  { padding:6px 10px; border:1px solid #e2e8f0; border-radius:8px; font-size:13px; background:#fff; cursor:pointer; }
.btn-seed    { padding:7px 14px; background:#6366f1; color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; white-space:nowrap; }
.btn-seed:disabled { opacity:.6; cursor:not-allowed; }

.jur-stats   { display:flex; gap:12px; padding:12px 24px; }
.stat-chip   { background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:10px 16px; display:flex; flex-direction:column; align-items:center; min-width:80px; }
.stat-n      { font-size:22px; font-weight:700; color:#6366f1; }
.stat-l      { font-size:11px; color:#64748b; margin-top:2px; white-space:nowrap; }

/* Validator */
.validator-panel { margin:0 24px 12px; background:#fff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; }
.val-header  { display:flex; justify-content:space-between; padding:12px 16px; cursor:pointer; font-size:13px; font-weight:600; color:#374151; background:#f8fafc; }
.val-header:hover { background:#f1f5f9; }
.val-toggle  { color:#94a3b8; }
.val-body    { padding:16px; border-top:1px solid #e2e8f0; }
.val-grid    { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:10px; align-items:end; }
.val-field   { display:flex; flex-direction:column; gap:4px; }
.val-field label { font-size:11px; color:#64748b; font-weight:500; }
.val-input   { padding:7px 10px; border:1px solid #e2e8f0; border-radius:8px; font-size:13px; width:100%; box-sizing:border-box; }
.val-run     { justify-content:flex-end; }
.btn-validate { padding:8px 18px; background:#10b981; color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; width:100%; }
.btn-validate:disabled { opacity:.6; cursor:not-allowed; }

.val-result  { margin-top:12px; }
.val-ok      { padding:10px 14px; background:#d1fae5; border-radius:8px; color:#065f46; font-weight:600; font-size:13px; }
.val-fail    { padding:10px 14px; background:#fee2e2; border-radius:8px; }
.val-fail-title { font-weight:700; color:#991b1b; font-size:13px; margin-bottom:8px; }
.violation   { display:flex; gap:10px; align-items:baseline; margin-bottom:4px; }
.viol-field  { font-size:12px; font-weight:600; color:#7f1d1d; white-space:nowrap; }
.viol-msg    { font-size:12px; color:#991b1b; }
.val-mins    { margin-top:8px; font-size:11px; color:#64748b; }
.val-mins-label { font-weight:600; margin-right:6px; }

/* Main layout */
.jur-content { display:flex; flex:1; overflow:hidden; margin:0 24px 24px; gap:16px; }

/* State list */
.jur-list  { width:260px; flex-shrink:0; background:#fff; border:1px solid #e2e8f0; border-radius:12px; display:flex; flex-direction:column; overflow:hidden; }
.jur-search { padding:10px; border-bottom:1px solid #f1f5f9; }
.jur-search-input { width:100%; padding:7px 10px; border:1px solid #e2e8f0; border-radius:8px; font-size:13px; box-sizing:border-box; }
.jur-list-items { flex:1; overflow-y:auto; }
.jur-item    { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; cursor:pointer; border-bottom:1px solid #f8fafc; transition:background .1s; }
.jur-item:hover { background:#f8fafc; }
.jur-item.active { background:#ede9fe; }
.jur-item-main { display:flex; gap:8px; align-items:center; min-width:0; }
.jur-state-code { font-size:12px; font-weight:700; color:#6366f1; width:28px; flex-shrink:0; }
.jur-state-name { font-size:13px; color:#374151; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.jur-item-badges { display:flex; gap:3px; flex-shrink:0; }
.jur-empty  { padding:40px 16px; text-align:center; color:#94a3b8; font-size:13px; }
.jur-loading { padding:20px; text-align:center; color:#94a3b8; font-size:13px; }

/* Badges */
.badge-nf,  .badge-pip, .badge-sr22, .badge-fr44 {
  font-size:9px; font-weight:700; padding:1px 4px; border-radius:3px; white-space:nowrap;
}
.badge-nf   { background:#dbeafe; color:#1d4ed8; }
.badge-pip  { background:#fef3c7; color:#92400e; }
.badge-sr22 { background:#d1fae5; color:#065f46; }
.badge-fr44 { background:#ede9fe; color:#5b21b6; }
.badge-nf.lg, .badge-pip.lg, .badge-sr22.lg, .badge-fr44.lg { font-size:11px; padding:3px 8px; border-radius:5px; }

/* Detail panel */
.jur-detail { flex:1; background:#fff; border:1px solid #e2e8f0; border-radius:12px; display:flex; flex-direction:column; overflow:hidden; min-width:0; }
.det-header { padding:16px 20px 0; border-bottom:1px solid #e2e8f0; }
.det-title  { font-size:18px; font-weight:700; color:#1e293b; margin:0 0 6px; }
.det-badges { display:flex; gap:6px; margin-bottom:12px; }
.det-tabs   { display:flex; gap:0; border-top:1px solid #f1f5f9; }
.det-tabs button { padding:9px 16px; border:none; background:none; font-size:13px; font-weight:500; color:#64748b; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px; }
.det-tabs button.on { color:#6366f1; border-bottom-color:#6366f1; font-weight:600; }
.det-tabs button:hover:not(.on) { color:#374151; }

.det-body { flex:1; overflow-y:auto; padding:16px 20px; }

/* Info grid */
.info-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.info-card { background:#f8fafc; border-radius:10px; padding:14px; }
.info-card--wide { grid-column:1/-1; }
.info-label { font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.5px; margin-bottom:10px; }
.info-rows  { display:flex; flex-direction:column; gap:6px; }
.info-row   { display:flex; justify-content:space-between; font-size:13px; color:#374151; }
.info-row strong { color:#1e293b; }
.info-note  { font-size:13px; color:#374151; line-height:1.6; margin:0; }
.info-empty { font-size:13px; color:#94a3b8; }

/* Products */
.prod-list  { display:flex; flex-direction:column; gap:10px; }
.prod-item  { background:#f8fafc; border-radius:10px; padding:12px; }
.prod-top   { display:flex; align-items:center; gap:10px; margin-bottom:4px; }
.prod-lob   { font-size:13px; font-weight:700; color:#1e293b; flex:1; }
.prod-avail { font-size:12px; font-weight:600; }
.prod-avail.yes { color:#10b981; }
.prod-avail.no  { color:#ef4444; }
.prod-req   { font-size:11px; background:#fef3c7; color:#92400e; padding:2px 7px; border-radius:4px; }
.prod-covs  { font-size:12px; color:#64748b; }
.prod-notes { font-size:12px; color:#6366f1; margin-top:4px; }
.prod-empty { color:#94a3b8; font-size:13px; padding:20px 0; text-align:center; }

/* Forms */
.form-list  { display:flex; flex-direction:column; gap:12px; }
.form-item  { background:#f8fafc; border-radius:10px; padding:12px; }
.form-top   { display:flex; align-items:center; gap:10px; margin-bottom:6px; }
.form-code  { font-size:13px; font-weight:700; color:#6366f1; min-width:50px; }
.form-name  { font-size:13px; font-weight:600; color:#1e293b; flex:1; }
.form-trigger { font-size:11px; background:#e0e7ff; color:#3730a3; padding:2px 7px; border-radius:4px; white-space:nowrap; }
.form-meta  { display:flex; gap:16px; font-size:12px; color:#64748b; margin-bottom:4px; }
.form-meta strong { color:#374151; }
.form-inst  { font-size:12px; color:#374151; line-height:1.5; padding:8px; background:#fff; border-radius:6px; border:1px solid #e2e8f0; }
.form-empty { color:#94a3b8; font-size:13px; padding:20px 0; text-align:center; }

/* Empty detail */
.jur-empty-detail { align-items:center; justify-content:center; }
.empty-icon { font-size:48px; margin-bottom:12px; }
.empty-msg  { font-size:14px; color:#94a3b8; }
  `],
})
export class JurisdictionComponent implements OnInit {
  readonly countryOptions: SelectOption[] = [
    { value: 'US', label: 'United States' },
    { value: 'CA', label: 'Canada' },
    { value: 'MX', label: 'Mexico' },
    { value: 'BR', label: 'Brazil' },
    { value: 'CO', label: 'Colombia' },
    { value: 'GB', label: 'United Kingdom' },
    { value: 'DE', label: 'Germany' },
    { value: 'FR', label: 'France' },
    { value: 'ES', label: 'Spain' },
    { value: 'IT', label: 'Italy' },
    { value: 'NL', label: 'Netherlands' },
    { value: 'CH', label: 'Switzerland' },
    { value: 'AU', label: 'Australia' },
    { value: 'IN', label: 'India' },
    { value: 'SG', label: 'Singapore' },
    { value: 'JP', label: 'Japan' },
    { value: 'HK', label: 'Hong Kong' },
    { value: 'AE', label: 'UAE' },
    { value: 'SA', label: 'Saudi Arabia' },
    { value: 'ZA', label: 'South Africa' },
    { value: 'NG', label: 'Nigeria' },
    { value: 'KE', label: 'Kenya' },
  ];
  readonly validatorLobOptions: SelectOption[] = [
    { value: 'auto', label: 'Auto' },
    { value: 'homeowners', label: 'Homeowners' },
    { value: 'workers_comp', label: 'Workers Comp' },
  ];

  get validatorStateOptions(): SelectOption[] {
    return [
      { value: '', label: '— select —' },
      ...this.jurisdictions.map(j => ({ value: j.state_code, label: `${j.state_code} — ${j.state_name}` }))
    ];
  }
  private readonly api = 'http://localhost:8000';

  jurisdictions: Jurisdiction[] = [];
  filtered:       Jurisdiction[] = [];
  selected:       Jurisdiction | null = null;
  loading = false;
  seeding = false;
  searchQ = '';
  selectedCountry = 'US';
  detTab = 'overview';
  showValidator = false;
  validating = false;
  validationResult: any = null;

  validator = { state: '', lob: 'auto', bi_pp: null as any, bi_pa: null as any, pd: null as any, pip: null as any, um_pp: null as any };

  get noFaultCount() { return this.jurisdictions.filter(j => j.config?.no_fault).length; }
  get sr22Count()    { return this.jurisdictions.filter(j => j.config?.sr22_available).length; }
  get fr44Count()    { return this.jurisdictions.filter(j => j.config?.fr44_available).length; }
  get pipCount()     { return this.jurisdictions.filter(j => j.config?.pip_required).length; }
  get autoProduct()  { return this.selected?.products?.find(p => p.lob === 'auto') ?? null; }

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.http.get<Jurisdiction[]>(`${this.api}/api/jurisdictions?country=${this.selectedCountry}`)
      .subscribe({ next: rows => { this.jurisdictions = rows; this.applyFilter(); this.loading = false; this.cdr.markForCheck(); },
                   error: ()  => { this.loading = false; this.cdr.markForCheck(); } });
  }

  applyFilter() {
    const q = this.searchQ.toLowerCase();
    this.filtered = q
      ? this.jurisdictions.filter(j => j.state_name?.toLowerCase().includes(q) || j.state_code?.toLowerCase().includes(q))
      : [...this.jurisdictions];
  }

  select(j: Jurisdiction) {
    this.http.get<Jurisdiction>(`${this.api}/api/jurisdictions/${j.id}`)
      .subscribe({ next: full => { this.selected = full; this.detTab = 'overview'; this.cdr.markForCheck(); } });
  }

  seed() {
    this.seeding = true;
    const endpoint = this.selectedCountry === 'US'
      ? `${this.api}/api/jurisdictions/seed`
      : `${this.api}/api/jurisdictions/seed-international`;
    this.http.post<any>(endpoint, {})
      .subscribe({ next: () => { this.seeding = false; this.load(); },
                   error: ()  => { this.seeding = false; this.cdr.markForCheck(); } });
  }

  validate() {
    if (!this.validator.state) return;
    this.validating = true;
    this.validationResult = null;
    const limits: any = {};
    if (this.validator.bi_pp)  limits['bi_per_person_k']   = +this.validator.bi_pp;
    if (this.validator.bi_pa)  limits['bi_per_accident_k'] = +this.validator.bi_pa;
    if (this.validator.pd)     limits['property_damage_k'] = +this.validator.pd;
    if (this.validator.pip)    limits['pip_k']             = +this.validator.pip;
    if (this.validator.um_pp)  limits['um_per_person_k']   = +this.validator.um_pp;
    this.http.post<any>(`${this.api}/api/jurisdictions/validate-policy`, {
      country: this.selectedCountry, state: this.validator.state,
      lob: this.validator.lob, limits
    }).subscribe({ next: r => { this.validationResult = r; this.validating = false; this.cdr.markForCheck(); },
                   error: ()=> { this.validating = false; this.cdr.markForCheck(); } });
  }
}
