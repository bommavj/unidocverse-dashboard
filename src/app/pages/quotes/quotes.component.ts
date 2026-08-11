import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ReplacePipe } from '../../pipes/replace.pipe';
import { UdvSelectComponent, SelectOption } from '../../components/udv-select/udv-select.component';

const API = 'http://localhost:8000/api';

const US_STATES = [
  {v:'AL',l:'Alabama'},{v:'AK',l:'Alaska'},{v:'AZ',l:'Arizona'},{v:'AR',l:'Arkansas'},
  {v:'CA',l:'California'},{v:'CO',l:'Colorado'},{v:'CT',l:'Connecticut'},{v:'DE',l:'Delaware'},
  {v:'FL',l:'Florida'},{v:'GA',l:'Georgia'},{v:'HI',l:'Hawaii'},{v:'ID',l:'Idaho'},
  {v:'IL',l:'Illinois'},{v:'IN',l:'Indiana'},{v:'IA',l:'Iowa'},{v:'KS',l:'Kansas'},
  {v:'KY',l:'Kentucky'},{v:'LA',l:'Louisiana'},{v:'ME',l:'Maine'},{v:'MD',l:'Maryland'},
  {v:'MA',l:'Massachusetts'},{v:'MI',l:'Michigan'},{v:'MN',l:'Minnesota'},{v:'MS',l:'Mississippi'},
  {v:'MO',l:'Missouri'},{v:'MT',l:'Montana'},{v:'NE',l:'Nebraska'},{v:'NV',l:'Nevada'},
  {v:'NH',l:'New Hampshire'},{v:'NJ',l:'New Jersey'},{v:'NM',l:'New Mexico'},{v:'NY',l:'New York'},
  {v:'NC',l:'North Carolina'},{v:'ND',l:'North Dakota'},{v:'OH',l:'Ohio'},{v:'OK',l:'Oklahoma'},
  {v:'OR',l:'Oregon'},{v:'PA',l:'Pennsylvania'},{v:'RI',l:'Rhode Island'},{v:'SC',l:'South Carolina'},
  {v:'SD',l:'South Dakota'},{v:'TN',l:'Tennessee'},{v:'TX',l:'Texas'},{v:'UT',l:'Utah'},
  {v:'VT',l:'Vermont'},{v:'VA',l:'Virginia'},{v:'WA',l:'Washington'},{v:'WV',l:'West Virginia'},
  {v:'WI',l:'Wisconsin'},{v:'WY',l:'Wyoming'},{v:'DC',l:'District of Columbia'}
];

const LOB_LIST: {value: string; label: string}[] = [
  {value:'auto',                label:'Auto'},
  {value:'homeowners',          label:'Homeowners'},
  {value:'renters',             label:'Renters'},
  {value:'motorcycle',          label:'Motorcycle'},
  {value:'boat',                label:'Boat / Watercraft'},
  {value:'commercial_auto',     label:'Commercial Auto'},
  {value:'commercial_property', label:'Commercial Property'},
  {value:'general_liability',   label:'General Liability'},
  {value:'bop',                 label:'Business Owners Policy (BOP)'},
  {value:'workers_comp',        label:"Workers' Compensation"},
  {value:'life',                label:'Life'},
  {value:'health',              label:'Health'},
  {value:'umbrella',            label:'Umbrella / Excess'},
  {value:'other',               label:'Other'},
];

const LOB_COLORS: Record<string,string> = {
  auto:'#3b82f6', homeowners:'#10b981', renters:'#06b6d4',
  motorcycle:'#f97316', boat:'#0ea5e9', commercial_auto:'#6366f1',
  commercial_property:'#8b5cf6', general_liability:'#a855f7',
  bop:'#ec4899', workers_comp:'#14b8a6', life:'#f59e0b',
  health:'#22c55e', umbrella:'#64748b', other:'#94a3b8'
};

const STAGE_COLORS: Record<string,string> = {
  draft:'#94a3b8', sent:'#3b82f6', comparing:'#f59e0b',
  bound:'#10b981', lost:'#ef4444', expired:'#64748b'
};

const LOSS_REASONS = [
  {v:'price_too_high',l:'Price Too High'},
  {v:'went_with_competitor',l:'Went with Competitor'},
  {v:'client_unresponsive',l:'Client Unresponsive'},
  {v:'coverage_not_available',l:'Coverage Not Available'},
  {v:'underwriting_declined',l:'Underwriting Declined'},
  {v:'client_already_covered',l:'Client Already Covered'},
  {v:'other',l:'Other'}
];

interface QuoteSummary {
  id: string; quote_number: string; client_name: string; lob: string;
  state: string; stage: string; effective_date: string; expiry_date: string;
  carrier_count: number; best_premium: number | null;
}

interface Carrier {
  id: string; carrier_name: string; annual_premium: number | null;
  monthly_premium: number | null; coverage_details: string; deductibles: string;
  notes: string; status: string;
}

interface ActivityEntry {
  action: string; detail: string; created_at: string;
}

interface QuoteDetail extends QuoteSummary {
  client_id: string; country: string; risk_data: any; requested_limits: any;
  jurisdiction_minimums: any; jurisdiction_required: string[];
  carriers: Carrier[]; activity: ActivityEntry[]; notes: string;
  assigned_agent: string;
}

interface Stats {
  by_stage: {stage: string; cnt: number}[];
  by_lob: {lob: string; cnt: number}[];
  win_rate: {won: number; lost: number; total: number};
}

@Component({
  selector: 'app-quotes',
  standalone: true,
  imports: [CommonModule, FormsModule, ReplacePipe, UdvSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div style="display:flex;flex-direction:column;height:100vh;background:var(--surf);color:var(--t1);font-family:'Inter',sans-serif;overflow:hidden;">

  <!-- Toast -->
  <div *ngIf="toast" [style]="'position:fixed;top:20px;right:20px;z-index:9999;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:500;box-shadow:0 4px 20px rgba(0,0,0,0.4);background:' + (toastType==='success'?'#10b981':'#ef4444') + ';color:#fff;'">
    {{toast}}
  </div>

  <!-- Header -->
  <div style="padding:16px 24px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
    <div>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:var(--t1);">Quote Pipeline</h1>
      <p style="margin:4px 0 0;font-size:13px;color:var(--t3);">Manage insurance quotes from draft to bind</p>
    </div>
    <button (click)="openNewQuoteModal()" style="background:#3b82f6;color:#fff;border:none;border-radius:8px;padding:10px 18px;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;">
      <span style="font-size:18px;line-height:1;">+</span> New Quote
    </button>
  </div>

  <!-- Stats Bar -->
  <div style="padding:12px 24px;border-bottom:1px solid var(--bdr);display:flex;gap:16px;flex-shrink:0;background:var(--surf);">
    <div *ngFor="let s of statCards" style="background:var(--surf2);border-radius:10px;padding:12px 20px;flex:1;min-width:0;">
      <div style="font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">{{s.label}}</div>
      <div style="font-size:24px;font-weight:700;" [style.color]="s.color">{{s.value}}</div>
    </div>
  </div>

  <!-- Stage Tabs -->
  <div style="padding:0 24px;border-bottom:1px solid var(--bdr);display:flex;gap:4px;flex-shrink:0;background:var(--surf);">
    <button *ngFor="let tab of stageTabs" (click)="setStageFilter(tab.value)"
      [style]="'border:none;padding:10px 16px;font-size:13px;font-weight:500;cursor:pointer;border-bottom:2px solid;transition:all .15s;background:transparent;' + (activeStage===tab.value?'color:#3b82f6;border-bottom-color:#3b82f6':'color:var(--t3);border-bottom-color:transparent')">
      {{tab.label}} <span *ngIf="tab.count!=null" style="margin-left:4px;font-size:11px;background:var(--surf2);padding:1px 6px;border-radius:10px;">{{tab.count}}</span>
    </button>
  </div>

  <!-- Body -->
  <div style="display:flex;flex:1;overflow:hidden;">

    <!-- Quote List -->
    <div style="width:360px;flex-shrink:0;overflow-y:auto;border-right:1px solid var(--bdr);padding:12px;">
      <div *ngIf="loadingList" style="padding:40px;text-align:center;color:var(--t3);">Loading quotes...</div>
      <div *ngIf="!loadingList && quotes.length===0" style="padding:40px;text-align:center;color:var(--t3);">No quotes found.</div>
      <div *ngFor="let q of quotes" (click)="selectQuote(q)"
        [style]="'border-radius:10px;padding:14px;margin-bottom:8px;cursor:pointer;border:1px solid;transition:all .15s;' + (selectedQuote?.id===q.id?'background:#1e3a5f;border-color:#3b82f6':'background:var(--surf2);border-color:var(--bdr)')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
          <span style="font-size:12px;font-weight:600;color:var(--t2);font-family:monospace;">{{q.quote_number}}</span>
          <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;">
            <span [style]="'font-size:10px;padding:2px 7px;border-radius:10px;font-weight:600;color:#fff;background:' + getLobColor(q.lob)">{{q.lob}}</span>
            <span style="font-size:10px;padding:2px 7px;border-radius:10px;font-weight:600;color:#fff;background:var(--surf3);">{{q.state}}</span>
            <span [style]="'font-size:10px;padding:2px 7px;border-radius:10px;font-weight:600;color:#fff;background:' + getStageColor(q.stage)">{{q.stage}}</span>
          </div>
        </div>
        <div style="font-size:15px;font-weight:600;color:var(--t1);margin-bottom:6px;">{{q.client_name || 'Walk-in'}}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:12px;color:var(--t3);">{{q.carrier_count || 0}} carrier{{q.carrier_count!==1?'s':''}}</span>
          <span *ngIf="q.best_premium" style="font-size:13px;font-weight:600;color:#10b981;">{{'$' + formatNum(q.best_premium) + '/yr'}}</span>
          <span *ngIf="!q.best_premium" style="font-size:12px;color:var(--t2);font-style:italic;">No quotes yet</span>
        </div>
        <div *ngIf="q.expiry_date" style="margin-top:6px;">
          <span [style]="'font-size:11px;' + (daysUntil(q.expiry_date)<5?'color:#ef4444;font-weight:600':'color:var(--t3)')">
            Expires: {{formatDate(q.expiry_date)}} <span *ngIf="daysUntil(q.expiry_date)<5">({{daysUntil(q.expiry_date)}}d)</span>
          </span>
        </div>
      </div>
    </div>

    <!-- Detail Panel -->
    <div *ngIf="!selectedQuote" style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--t2);">
      <div style="text-align:center;">
        <div style="font-size:48px;margin-bottom:12px;">📋</div>
        <div style="font-size:16px;">Select a quote to view details</div>
      </div>
    </div>

    <div *ngIf="selectedQuote" style="flex:1;overflow-y:auto;padding:20px 24px;">

      <!-- Detail Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <h2 style="margin:0;font-size:18px;font-weight:700;color:var(--t1);font-family:monospace;">{{selectedQuote.quote_number}}</h2>
          <span [style]="'font-size:12px;padding:3px 10px;border-radius:10px;font-weight:600;color:#fff;background:' + getLobColor(selectedQuote.lob)">{{selectedQuote.lob}}</span>
          <span [style]="'font-size:12px;padding:3px 10px;border-radius:10px;font-weight:600;color:#fff;background:' + getStageColor(selectedQuote.stage)">{{selectedQuote.stage}}</span>
          <span style="font-size:12px;color:var(--t3);">{{selectedQuote.client_name || 'Walk-in'}} · {{selectedQuote.state}}</span>
        </div>
        <div style="display:flex;gap:8px;">
          <button *ngIf="selectedQuote.stage==='draft'" (click)="sendToCarriers()"
            style="background:#3b82f6;color:#fff;border:none;border-radius:7px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;">
            Send to Carriers
          </button>
          <button (click)="openEditModal()"
            style="background:transparent;color:var(--t2);border:1px solid var(--bdr);border-radius:7px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          <button *ngIf="selectedQuote.stage!=='bound' && selectedQuote.stage!=='lost'" (click)="openLossModal()"
            style="background:#7f1d1d;color:#fca5a5;border:1px solid #ef4444;border-radius:7px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;">
            Mark Lost
          </button>
          <button (click)="confirmDeleteQuote()"
            style="background:transparent;color:#ef4444;border:1px solid #ef4444;border-radius:7px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            Delete
          </button>
        </div>
      </div>

      <!-- Jurisdiction Banner -->
      <div *ngIf="selectedQuote.jurisdiction_minimums && hasJurisdictionData()" style="background:#422006;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
        <div style="font-size:13px;font-weight:600;color:#fcd34d;margin-bottom:4px;">
          {{selectedQuote.state}} Jurisdiction Requirements
        </div>
        <div style="font-size:12px;color:#fde68a;">
          <span *ngIf="selectedQuote.jurisdiction_minimums.bi_per_person_k">
            BI: {{selectedQuote.jurisdiction_minimums.bi_per_person_k}}/{{selectedQuote.jurisdiction_minimums.bi_per_accident_k}}k &nbsp;
          </span>
          <span *ngIf="selectedQuote.jurisdiction_minimums.property_damage_k">
            PD: {{selectedQuote.jurisdiction_minimums.property_damage_k}}k &nbsp;
          </span>
          <span *ngIf="selectedQuote.jurisdiction_minimums.pip_k">
            PIP: {{selectedQuote.jurisdiction_minimums.pip_k}}k
          </span>
        </div>
        <div *ngIf="selectedQuote.jurisdiction_required?.length" style="font-size:11px;color:#fbbf24;margin-top:4px;">
          Required: {{selectedQuote.jurisdiction_required.join(', ').toUpperCase()}}
        </div>
      </div>

      <!-- Info Row -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
        <div style="background:var(--surf2);border-radius:8px;padding:12px;">
          <div style="font-size:11px;color:var(--t3);margin-bottom:2px;">Effective Date</div>
          <div style="font-size:13px;font-weight:600;">{{selectedQuote.effective_date ? formatDate(selectedQuote.effective_date) : '—'}}</div>
        </div>
        <div style="background:var(--surf2);border-radius:8px;padding:12px;">
          <div style="font-size:11px;color:var(--t3);margin-bottom:2px;">Assigned Agent</div>
          <div style="font-size:13px;font-weight:600;">{{selectedQuote.assigned_agent || '—'}}</div>
        </div>
        <div style="background:var(--surf2);border-radius:8px;padding:12px;">
          <div style="font-size:11px;color:var(--t3);margin-bottom:2px;">Best Premium</div>
          <div style="font-size:13px;font-weight:600;color:#10b981;">
            <span *ngIf="selectedQuote.best_premium">{{'$' + formatNum(selectedQuote.best_premium) + '/yr'}}</span>
            <span *ngIf="!selectedQuote.best_premium">—</span>
          </div>
        </div>
      </div>

      <!-- Notes -->
      <div *ngIf="selectedQuote.notes" style="background:var(--surf2);border-radius:8px;padding:12px;margin-bottom:20px;">
        <div style="font-size:11px;color:var(--t3);margin-bottom:4px;">Notes</div>
        <div style="font-size:13px;color:#cbd5e1;">{{selectedQuote.notes}}</div>
      </div>

      <!-- Carrier Comparison -->
      <div style="margin-bottom:20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <h3 style="margin:0;font-size:15px;font-weight:700;color:var(--t1);">Carrier Comparison</h3>
          <button (click)="showAddCarrier=!showAddCarrier"
            style="background:var(--surf2);color:var(--t2);border:1px solid var(--bdr);border-radius:7px;padding:7px 12px;font-size:12px;cursor:pointer;">
            + Add Carrier
          </button>
        </div>

        <!-- Add Carrier Form -->
        <div *ngIf="showAddCarrier" style="background:var(--surf2);border:1px solid var(--bdr);border-radius:10px;padding:16px;margin-bottom:12px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
            <div>
              <label style="font-size:11px;color:var(--t3);display:block;margin-bottom:4px;">Carrier Name *</label>
              <input [(ngModel)]="newCarrier.carrier_name" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:8px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="e.g. State Farm">
            </div>
            <div>
              <label style="font-size:11px;color:var(--t3);display:block;margin-bottom:4px;">Annual Premium</label>
              <input [(ngModel)]="newCarrier.annual_premium" type="number" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:8px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="1200">
            </div>
            <div>
              <label style="font-size:11px;color:var(--t3);display:block;margin-bottom:4px;">Monthly Premium</label>
              <input [(ngModel)]="newCarrier.monthly_premium" type="number" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:8px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="100">
            </div>
            <div>
              <label style="font-size:11px;color:var(--t3);display:block;margin-bottom:4px;">Coverage Details</label>
              <input [(ngModel)]="newCarrier.coverage_details" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:8px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="100/300/100 BI/PD">
            </div>
          </div>
          <div style="margin-bottom:12px;">
            <label style="font-size:11px;color:var(--t3);display:block;margin-bottom:4px;">Notes</label>
            <input [(ngModel)]="newCarrier.notes" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:8px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="Additional notes">
          </div>
          <div style="display:flex;gap:8px;">
            <button (click)="addCarrier()" style="background:#3b82f6;color:#fff;border:none;border-radius:6px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;">Save Carrier</button>
            <button (click)="showAddCarrier=false" style="background:transparent;color:var(--t3);border:1px solid var(--bdr);border-radius:6px;padding:8px 16px;font-size:13px;cursor:pointer;">Cancel</button>
          </div>
        </div>

        <!-- Carrier Table -->
        <div *ngIf="selectedQuote.carriers?.length" style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="border-bottom:1px solid var(--bdr);">
                <th style="text-align:left;padding:8px 12px;color:var(--t3);font-weight:500;font-size:11px;text-transform:uppercase;">Carrier</th>
                <th style="text-align:right;padding:8px 12px;color:var(--t3);font-weight:500;font-size:11px;text-transform:uppercase;">Annual</th>
                <th style="text-align:right;padding:8px 12px;color:var(--t3);font-weight:500;font-size:11px;text-transform:uppercase;">Monthly</th>
                <th style="text-align:center;padding:8px 12px;color:var(--t3);font-weight:500;font-size:11px;text-transform:uppercase;">Status</th>
                <th style="text-align:left;padding:8px 12px;color:var(--t3);font-weight:500;font-size:11px;text-transform:uppercase;">Coverage</th>
                <th style="text-align:center;padding:8px 12px;color:var(--t3);font-weight:500;font-size:11px;text-transform:uppercase;">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of selectedQuote.carriers" style="border-bottom:1px solid var(--bdr);">
                <td style="padding:10px 12px;font-weight:600;color:var(--t1);">{{c.carrier_name}}</td>
                <td style="padding:10px 12px;text-align:right;color:#10b981;font-weight:600;">
                  <span *ngIf="c.annual_premium">{{'$' + formatNum(c.annual_premium) + '/yr'}}</span>
                  <span *ngIf="!c.annual_premium" style="color:var(--t2);">—</span>
                </td>
                <td style="padding:10px 12px;text-align:right;color:var(--t2);">
                  <span *ngIf="c.monthly_premium">{{'$' + formatNum(c.monthly_premium) + '/mo'}}</span>
                  <span *ngIf="!c.monthly_premium" style="color:var(--t2);">—</span>
                </td>
                <td style="padding:10px 12px;text-align:center;">
                  <span [style]="'font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600;' + getCarrierStatusStyle(c.status)">{{c.status || 'pending'}}</span>
                </td>
                <td style="padding:10px 12px;color:var(--t2);max-width:200px;">
                  <span *ngIf="c.coverage_details">{{c.coverage_details}}</span>
                  <span *ngIf="!c.coverage_details" style="color:var(--t2);">—</span>
                </td>
                <td style="padding:10px 12px;text-align:center;">
                  <button *ngIf="selectedQuote.stage==='comparing'" (click)="confirmBind(c)"
                    style="background:#065f46;color:#34d399;border:1px solid #10b981;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:600;cursor:pointer;">
                    Select Winner
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div *ngIf="!selectedQuote.carriers?.length" style="padding:20px;text-align:center;color:var(--t2);font-size:13px;background:var(--surf2);border-radius:8px;">
          No carriers added yet. Click "+ Add Carrier" to get started.
        </div>
      </div>

      <!-- Activity Log -->
      <div>
        <button (click)="showActivity=!showActivity" style="display:flex;align-items:center;gap:8px;background:transparent;border:none;color:var(--t2);font-size:14px;font-weight:600;cursor:pointer;margin-bottom:10px;padding:0;">
          <span>{{showActivity?'▼':'▶'}}</span> Activity Log ({{selectedQuote.activity.length || 0}})
        </button>
        <div *ngIf="showActivity && selectedQuote.activity.length" style="border-left:2px solid var(--bdr);padding-left:16px;">
          <div *ngFor="let a of selectedQuote.activity" style="margin-bottom:14px;position:relative;">
            <div style="position:absolute;left:-21px;top:4px;width:8px;height:8px;border-radius:50%;background:var(--surf3);border:2px solid #64748b;"></div>
            <div style="font-size:12px;font-weight:600;color:var(--t2);text-transform:capitalize;">{{a.action | replace:'_':' '}}</div>
            <div style="font-size:13px;color:#cbd5e1;margin:2px 0;">{{a.detail}}</div>
            <div style="font-size:11px;color:var(--t2);">{{formatDateTime(a.created_at)}}</div>
          </div>
        </div>
        <div *ngIf="showActivity && !selectedQuote.activity.length" style="padding:12px;color:var(--t2);font-size:13px;">No activity yet.</div>
      </div>
    </div>
  </div>
</div>

<!-- Bind Confirmation Modal -->
<div *ngIf="bindTarget" style="position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:1000;display:flex;align-items:center;justify-content:center;">
  <div style="background:var(--surf2);border-radius:14px;padding:28px;max-width:420px;width:90%;border:1px solid var(--bdr);">
    <h3 style="margin:0 0 12px;font-size:17px;color:var(--t1);">Confirm Bind</h3>
    <p style="color:var(--t2);font-size:14px;margin:0 0 16px;">
      Bind with <strong style="color:var(--t1);">{{bindTarget.carrier_name}}</strong>
      <span *ngIf="bindTarget.annual_premium"> at <strong style="color:#10b981;">{{'$' + formatNum(bindTarget.annual_premium) + '/yr'}}</strong></span>?
    </p>
    <div style="margin-bottom:16px;">
      <label style="font-size:12px;color:var(--t3);display:block;margin-bottom:4px;">Policy Number (optional)</label>
      <input [(ngModel)]="bindPolicyNumber" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:8px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="POL-XXXXXXXX">
    </div>
    <div style="margin-bottom:20px;">
      <label style="font-size:12px;color:var(--t3);display:block;margin-bottom:4px;">Notes</label>
      <textarea [(ngModel)]="bindNotes" rows="2" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:8px;color:var(--t1);font-size:13px;resize:vertical;box-sizing:border-box;"></textarea>
    </div>
    <div style="display:flex;gap:10px;">
      <button (click)="doBind()" style="flex:1;background:#10b981;color:#fff;border:none;border-radius:8px;padding:10px;font-size:14px;font-weight:600;cursor:pointer;">Confirm Bind</button>
      <button (click)="bindTarget=null" style="flex:1;background:transparent;color:var(--t3);border:1px solid var(--bdr);border-radius:8px;padding:10px;font-size:14px;cursor:pointer;">Cancel</button>
    </div>
  </div>
</div>

<!-- Loss Modal -->
<div *ngIf="showLossModal" style="position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:1000;display:flex;align-items:center;justify-content:center;">
  <div style="background:var(--surf2);border-radius:14px;padding:28px;max-width:420px;width:90%;border:1px solid var(--bdr);">
    <h3 style="margin:0 0 16px;font-size:17px;color:var(--t1);">Mark as Lost</h3>
    <div style="margin-bottom:14px;">
      <label style="font-size:12px;color:var(--t3);display:block;margin-bottom:4px;">Reason *</label>
      <udv-select [(ngModel)]="lossReason" [options]="lossReasonOptions" placeholder="Select reason…"></udv-select>
    </div>
    <div style="margin-bottom:20px;">
      <label style="font-size:12px;color:var(--t3);display:block;margin-bottom:4px;">Notes</label>
      <textarea [(ngModel)]="lossNotes" rows="3" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:8px;color:var(--t1);font-size:13px;resize:vertical;box-sizing:border-box;" placeholder="Additional context..."></textarea>
    </div>
    <div style="display:flex;gap:10px;">
      <button (click)="doMarkLost()" [disabled]="!lossReason" style="flex:1;background:#ef4444;color:#fff;border:none;border-radius:8px;padding:10px;font-size:14px;font-weight:600;cursor:pointer;opacity:1;" [style.opacity]="lossReason?'1':'.5'">Mark Lost</button>
      <button (click)="showLossModal=false" style="flex:1;background:transparent;color:var(--t3);border:1px solid var(--bdr);border-radius:8px;padding:10px;font-size:14px;cursor:pointer;">Cancel</button>
    </div>
  </div>
</div>

<!-- New Quote Modal -->
<div *ngIf="showNewQuoteModal" style="position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:1000;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:40px 16px;">
  <div style="background:var(--surf2);border-radius:14px;padding:28px;max-width:680px;width:100%;border:1px solid var(--bdr);margin:auto;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
      <h3 style="margin:0;font-size:18px;font-weight:700;color:var(--t1);">New Quote</h3>
      <button (click)="showNewQuoteModal=false" style="background:transparent;border:none;color:var(--t3);font-size:20px;cursor:pointer;">✕</button>
    </div>

    <!-- ── SECTION: Client ── -->
    <div style="font-size:11px;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px;">Insured / Client</div>
    <div style="margin-bottom:14px;">
      <div style="display:flex;gap:8px;margin-bottom:8px;">
        <button (click)="clientMode='picker'" [style]="'flex:1;padding:7px;border-radius:6px;font-size:12px;cursor:pointer;border:1px solid;' + (clientMode==='picker'?'background:#3b82f6;color:#fff;border-color:#3b82f6':'background:transparent;color:var(--t3);border-color:var(--bdr)')">Existing Client</button>
        <button (click)="clientMode='walkin'" [style]="'flex:1;padding:7px;border-radius:6px;font-size:12px;cursor:pointer;border:1px solid;' + (clientMode==='walkin'?'background:#3b82f6;color:#fff;border-color:#3b82f6':'background:transparent;color:var(--t3);border-color:var(--bdr)')">Walk-in / New</button>
      </div>
      <udv-select *ngIf="clientMode==='picker'" [(ngModel)]="newQuote.client_id" [options]="clientOptions" placeholder="Select client…" style="margin-bottom:10px;display:block;"></udv-select>
      <input *ngIf="clientMode==='walkin'" [(ngModel)]="newQuote.client_name" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:8px;color:var(--t1);font-size:13px;box-sizing:border-box;margin-bottom:10px;" placeholder="Full name">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:10px;">
        <div style="grid-column:span 2;"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Phone</label><input [(ngModel)]="newQuote.phone" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="(555) 000-0000"></div>
        <div style="grid-column:span 2;"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Email</label><input [(ngModel)]="newQuote.email" type="email" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="client@email.com"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Date of Birth</label><input [(ngModel)]="newQuote.dob" type="date" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Gender</label>
          <udv-select [(ngModel)]="newQuote.gender" [options]="genderOptions" placeholder="—"></udv-select>
        </div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Marital Status</label>
          <udv-select [(ngModel)]="newQuote.marital_status" [options]="maritalOptions" placeholder="—"></udv-select>
        </div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">SSN Last 4</label><input [(ngModel)]="newQuote.ssn_last4" maxlength="4" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="••••"></div>
      </div>
    </div>

    <!-- ── SECTION: Insured Address ── -->
    <div style="font-size:11px;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px;">Insured Address</div>
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px;margin-bottom:16px;">
      <div style="grid-column:1/-1;"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Street Address</label><input [(ngModel)]="newQuote.address" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="123 Main St"></div>
      <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">City</label><input [(ngModel)]="newQuote.city" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="Phoenix"></div>
      <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">State *</label>
        <udv-select [(ngModel)]="newQuote.state" [options]="stateOptions" placeholder="—"></udv-select>
      </div>
      <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">ZIP</label><input [(ngModel)]="newQuote.zip" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="85001"></div>
    </div>

    <!-- ── SECTION: Policy Info ── -->
    <div style="font-size:11px;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px;">Policy Info</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:16px;">
      <div style="grid-column:span 2;"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Line of Business *</label>
        <udv-select [(ngModel)]="newQuote.lob" [options]="lobOptions" placeholder="Select LOB…" (valueChange)="onLobChange()"></udv-select>
      </div>
      <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Effective Date</label><input [(ngModel)]="newQuote.effective_date" type="date" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
      <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Expiry Date</label><input [(ngModel)]="newQuote.expiry_date" type="date" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
      <div style="grid-column:span 2;"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Assigned Agent</label><input [(ngModel)]="newQuote.assigned_agent" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="Agent name"></div>
      <div style="grid-column:span 2;"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Country</label>
        <udv-select [(ngModel)]="newQuote.country" [options]="countryOptions" placeholder="Select country…"></udv-select>
      </div>
    </div>

    <!-- ── SECTION: Coverage Requested ── -->
    <div style="font-size:11px;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px;">Coverage Requested</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;">
      <div *ngIf="newQuote.lob==='auto' || newQuote.lob===''"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">BI Limits</label><input [(ngModel)]="newQuote.requested_bi" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="100/300"></div>
      <div *ngIf="newQuote.lob==='auto' || newQuote.lob===''"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">PD Limit</label><input [(ngModel)]="newQuote.requested_pd" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="100k"></div>
      <div *ngIf="newQuote.lob==='auto' || newQuote.lob===''"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">UM/UIM</label><input [(ngModel)]="newQuote.requested_um" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="100/300"></div>
      <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Deductible</label><input [(ngModel)]="newQuote.requested_deductible" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="$500"></div>
      <div *ngIf="newQuote.lob!=='auto'"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Coverage Amount</label><input [(ngModel)]="newQuote.requested_coverage_amount" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="$250,000"></div>
      <div *ngIf="newQuote.lob==='auto' || newQuote.lob===''"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Med Pay / PIP</label><input [(ngModel)]="newQuote.requested_med" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="$5,000"></div>
    </div>

    <!-- ── SECTION: Risk Details ── -->
    <div *ngIf="newQuote.lob" style="background:var(--surf);border-radius:8px;padding:14px;margin-bottom:14px;border:1px solid var(--bdr);">
      <div style="font-size:11px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;">Risk Details — {{newQuote.lob | titlecase}}</div>

      <!-- Auto -->
      <div *ngIf="newQuote.lob==='auto'" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Year</label><input [(ngModel)]="riskAuto.year" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="2020"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Make</label><input [(ngModel)]="riskAuto.make" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="Toyota"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Model</label><input [(ngModel)]="riskAuto.model" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="Camry"></div>
        <div style="grid-column:span 2;"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">VIN</label><input [(ngModel)]="riskAuto.vin" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="1HGBH41JXMN109186"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Use</label>
          <udv-select [(ngModel)]="riskAuto.use" [options]="vehicleUseOptions" placeholder="Select…"></udv-select>
        </div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Primary Driver</label><input [(ngModel)]="riskAuto.primary_driver" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Driver DOB</label><input [(ngModel)]="riskAuto.dob" type="date" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">License #</label><input [(ngModel)]="riskAuto.license_number" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Garaging ZIP</label><input [(ngModel)]="riskAuto.garaging_zip" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="85001"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Annual Miles</label><input [(ngModel)]="riskAuto.annual_miles" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="12,000"></div>
      </div>

      <!-- Homeowners / Renters -->
      <div *ngIf="newQuote.lob==='homeowners' || newQuote.lob==='renters'" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
        <div style="grid-column:1/-1;"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Property Address</label><input [(ngModel)]="riskHome.address" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="Same as insured address"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">City</label><input [(ngModel)]="riskHome.city" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">ZIP</label><input [(ngModel)]="riskHome.zip" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Year Built</label><input [(ngModel)]="riskHome.year_built" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="1990"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Sq Footage</label><input [(ngModel)]="riskHome.sq_footage" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="1,800"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Stories</label><input [(ngModel)]="riskHome.stories" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="2"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Construction</label><input [(ngModel)]="riskHome.construction_type" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="Frame, Masonry..."></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Roof Type</label><input [(ngModel)]="riskHome.roof_type" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="Asphalt, Metal..."></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Roof Year</label><input [(ngModel)]="riskHome.roof_year" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="2015"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Dwelling Value</label><input [(ngModel)]="riskHome.dwelling_value" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="$300,000"></div>
        <div style="display:flex;align-items:center;gap:8px;padding-top:18px;">
          <input type="checkbox" [(ngModel)]="riskHome.alarm" id="alarm" style="accent-color:#3b82f6;">
          <label for="alarm" style="font-size:12px;color:var(--t2);cursor:pointer;">Security Alarm</label>
        </div>
        <div style="display:flex;align-items:center;gap:8px;padding-top:18px;">
          <input type="checkbox" [(ngModel)]="riskHome.pool" id="pool" style="accent-color:#3b82f6;">
          <label for="pool" style="font-size:12px;color:var(--t2);cursor:pointer;">Swimming Pool</label>
        </div>
      </div>

      <!-- Commercial / Other LOBs -->
      <div *ngIf="newQuote.lob!=='auto' && newQuote.lob!=='homeowners' && newQuote.lob!=='renters'" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div style="grid-column:1/-1;"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Business Name</label><input [(ngModel)]="riskOther.business_name" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="Business / entity name"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Annual Revenue</label><input [(ngModel)]="riskOther.revenue" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="$500,000"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Employees</label><input [(ngModel)]="riskOther.employees" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="10"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Sq Footage</label><input [(ngModel)]="riskOther.sq_footage" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="3,000"></div>
        <div style="grid-column:1/-1;"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Risk Description</label><textarea [(ngModel)]="riskOther.description" rows="2" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;resize:vertical;box-sizing:border-box;" placeholder="Describe the risk, operations, or special exposures..."></textarea></div>
      </div>
    </div>

    <!-- ── SECTION: Prior Insurance ── -->
    <div style="font-size:11px;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px;">Prior Insurance</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:16px;">
      <div style="grid-column:span 2;"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Prior Carrier</label><input [(ngModel)]="newQuote.prior_carrier" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="State Farm, Geico..."></div>
      <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Prior Expiry</label><input [(ngModel)]="newQuote.prior_expiry" type="date" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
      <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Prior Premium</label><input [(ngModel)]="newQuote.prior_premium" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="$1,200/yr"></div>
      <div style="grid-column:1/-1;"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Claims in Last 3 Years</label><input [(ngModel)]="newQuote.prior_claims" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="0 claims / describe any losses"></div>
    </div>

    <!-- ── Notes ── -->
    <div style="margin-bottom:20px;">
      <label style="font-size:12px;color:var(--t3);display:block;margin-bottom:4px;">Agent Notes</label>
      <textarea [(ngModel)]="newQuote.notes" rows="2" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:8px;color:var(--t1);font-size:13px;resize:vertical;box-sizing:border-box;" placeholder="Additional notes, special instructions..."></textarea>
    </div>

    <div style="display:flex;gap:10px;">
      <button (click)="submitNewQuote()" [disabled]="!newQuote.lob || !newQuote.state" [style.opacity]="(!newQuote.lob || !newQuote.state)?'.5':'1'" style="flex:1;background:#3b82f6;color:#fff;border:none;border-radius:8px;padding:11px;font-size:14px;font-weight:600;cursor:pointer;">Create Quote</button>
      <button (click)="showNewQuoteModal=false" style="flex:1;background:transparent;color:var(--t3);border:1px solid var(--bdr);border-radius:8px;padding:11px;font-size:14px;cursor:pointer;">Cancel</button>
    </div>
  </div>
</div>

<!-- Delete Confirm Modal -->
<div *ngIf="showDeleteModal" style="position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:1000;display:flex;align-items:center;justify-content:center;">
  <div style="background:var(--surf2);border-radius:12px;padding:28px;width:400px;border:1px solid #7f1d1d;">
    <div style="font-size:18px;font-weight:700;color:#f87171;margin-bottom:10px;">Delete Quote?</div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:20px;">
      This will permanently delete quote <strong style="color:var(--t1);">{{selectedQuote?.quote_number}}</strong>
      and all associated carriers and activity. This cannot be undone.
    </div>
    <div style="display:flex;gap:10px;">
      <button (click)="deleteQuote()" style="flex:1;background:#ef4444;color:#fff;border:none;border-radius:8px;padding:10px;font-size:14px;font-weight:600;cursor:pointer;">Delete Forever</button>
      <button (click)="showDeleteModal=false" style="flex:1;background:transparent;color:var(--t3);border:1px solid var(--bdr);border-radius:8px;padding:10px;font-size:14px;cursor:pointer;">Cancel</button>
    </div>
  </div>
</div>

<!-- Edit Quote Modal -->
<div *ngIf="showEditModal" style="position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:1000;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:40px 16px;">
  <div style="background:var(--surf2);border-radius:14px;padding:28px;max-width:680px;width:100%;border:1px solid var(--bdr);margin:auto;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
      <h3 style="margin:0;font-size:18px;font-weight:700;color:var(--t1);">Edit Quote — {{selectedQuote?.quote_number}}</h3>
      <button (click)="showEditModal=false" style="background:transparent;border:none;color:var(--t3);font-size:20px;cursor:pointer;">✕</button>
    </div>

    <!-- ── Contact ── -->
    <div style="font-size:11px;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px;">Contact Info</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:16px;">
      <div style="grid-column:span 2;"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Phone</label><input [(ngModel)]="editQuote.phone" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="(555) 000-0000"></div>
      <div style="grid-column:span 2;"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Email</label><input [(ngModel)]="editQuote.email" type="email" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="client@email.com"></div>
      <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Date of Birth</label><input [(ngModel)]="editQuote.dob" type="date" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
      <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Gender</label>
        <udv-select [(ngModel)]="editQuote.gender" [options]="genderOptions" placeholder="—"></udv-select>
      </div>
      <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Marital Status</label>
        <udv-select [(ngModel)]="editQuote.marital_status" [options]="maritalOptions" placeholder="—"></udv-select>
      </div>
      <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">SSN Last 4</label><input [(ngModel)]="editQuote.ssn_last4" maxlength="4" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="••••"></div>
    </div>

    <!-- ── Address ── -->
    <div style="font-size:11px;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px;">Insured Address</div>
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px;margin-bottom:16px;">
      <div style="grid-column:1/-1;"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Street Address</label><input [(ngModel)]="editQuote.address" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="123 Main St"></div>
      <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">City</label><input [(ngModel)]="editQuote.city" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
      <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">State</label>
        <udv-select [(ngModel)]="editQuote.state" [options]="stateOptions" placeholder="—"></udv-select>
      </div>
      <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">ZIP</label><input [(ngModel)]="editQuote.zip" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
    </div>

    <!-- ── Policy ── -->
    <div style="font-size:11px;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px;">Policy Info</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:16px;">
      <div style="grid-column:span 2;"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Line of Business</label>
        <udv-select [(ngModel)]="editQuote.lob" [options]="lobOptions" placeholder="Select LOB…"></udv-select>
      </div>
      <div style="grid-column:span 2;"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Assigned Agent</label><input [(ngModel)]="editQuote.assigned_agent" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="Agent name"></div>
      <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Effective Date</label><input [(ngModel)]="editQuote.effective_date" type="date" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
      <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Expiry Date</label><input [(ngModel)]="editQuote.expiry_date" type="date" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
      <div style="grid-column:span 2;"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Country</label>
        <udv-select [(ngModel)]="editQuote.country" [options]="countryOptions" placeholder="Select country…"></udv-select>
      </div>
    </div>

    <!-- ── Coverage Requested ── -->
    <div style="font-size:11px;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px;">Coverage Requested</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;">
      <div *ngIf="editQuote.lob==='auto' || editQuote.lob===''"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">BI Limits</label><input [(ngModel)]="editQuote.requested_bi" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="100/300"></div>
      <div *ngIf="editQuote.lob==='auto' || editQuote.lob===''"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">PD Limit</label><input [(ngModel)]="editQuote.requested_pd" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="100k"></div>
      <div *ngIf="editQuote.lob==='auto' || editQuote.lob===''"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">UM/UIM</label><input [(ngModel)]="editQuote.requested_um" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="100/300"></div>
      <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Deductible</label><input [(ngModel)]="editQuote.requested_deductible" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="$500"></div>
      <div *ngIf="editQuote.lob!=='auto'"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Coverage Amount</label><input [(ngModel)]="editQuote.requested_coverage_amount" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="$250,000"></div>
      <div *ngIf="editQuote.lob==='auto' || editQuote.lob===''"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Med Pay / PIP</label><input [(ngModel)]="editQuote.requested_med" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="$5,000"></div>
    </div>

    <!-- ── Risk Details ── -->
    <div *ngIf="editQuote.lob" style="background:var(--surf);border-radius:8px;padding:14px;margin-bottom:16px;border:1px solid var(--bdr);">
      <div style="font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;">Risk Details — {{editQuote.lob | titlecase}}</div>
      <!-- Auto -->
      <div *ngIf="editQuote.lob==='auto'" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Year</label><input [(ngModel)]="editRiskAuto.year" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="2020"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Make</label><input [(ngModel)]="editRiskAuto.make" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="Toyota"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Model</label><input [(ngModel)]="editRiskAuto.model" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="Camry"></div>
        <div style="grid-column:span 2;"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">VIN</label><input [(ngModel)]="editRiskAuto.vin" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Use</label>
          <udv-select [(ngModel)]="editRiskAuto.use" [options]="vehicleUseOptions" placeholder="Select…"></udv-select>
        </div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Primary Driver</label><input [(ngModel)]="editRiskAuto.primary_driver" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Driver DOB</label><input [(ngModel)]="editRiskAuto.dob" type="date" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">License #</label><input [(ngModel)]="editRiskAuto.license_number" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Garaging ZIP</label><input [(ngModel)]="editRiskAuto.garaging_zip" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Annual Miles</label><input [(ngModel)]="editRiskAuto.annual_miles" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
      </div>
      <!-- Home/Renters -->
      <div *ngIf="editQuote.lob==='homeowners' || editQuote.lob==='renters'" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
        <div style="grid-column:1/-1;"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Property Address</label><input [(ngModel)]="editRiskHome.address" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">City</label><input [(ngModel)]="editRiskHome.city" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">ZIP</label><input [(ngModel)]="editRiskHome.zip" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Year Built</label><input [(ngModel)]="editRiskHome.year_built" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Sq Footage</label><input [(ngModel)]="editRiskHome.sq_footage" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Construction</label><input [(ngModel)]="editRiskHome.construction_type" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Roof Type</label><input [(ngModel)]="editRiskHome.roof_type" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Roof Year</label><input [(ngModel)]="editRiskHome.roof_year" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Dwelling Value</label><input [(ngModel)]="editRiskHome.dwelling_value" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
        <div style="display:flex;align-items:center;gap:8px;padding-top:18px;"><input type="checkbox" [(ngModel)]="editRiskHome.alarm" id="ealarm" style="accent-color:#3b82f6;"><label for="ealarm" style="font-size:12px;color:var(--t2);cursor:pointer;">Security Alarm</label></div>
        <div style="display:flex;align-items:center;gap:8px;padding-top:18px;"><input type="checkbox" [(ngModel)]="editRiskHome.pool" id="epool" style="accent-color:#3b82f6;"><label for="epool" style="font-size:12px;color:var(--t2);cursor:pointer;">Pool</label></div>
      </div>
      <!-- Other -->
      <div *ngIf="editQuote.lob!=='auto' && editQuote.lob!=='homeowners' && editQuote.lob!=='renters'" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div style="grid-column:1/-1;"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Business Name</label><input [(ngModel)]="editRiskOther.business_name" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Annual Revenue</label><input [(ngModel)]="editRiskOther.revenue" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
        <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Employees</label><input [(ngModel)]="editRiskOther.employees" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
        <div style="grid-column:1/-1;"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Description</label><textarea [(ngModel)]="editRiskOther.description" rows="2" style="width:100%;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;resize:vertical;box-sizing:border-box;"></textarea></div>
      </div>
    </div>

    <!-- ── Prior Insurance ── -->
    <div style="font-size:11px;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px;">Prior Insurance</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:16px;">
      <div style="grid-column:span 2;"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Prior Carrier</label><input [(ngModel)]="editQuote.prior_carrier" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="State Farm, Geico..."></div>
      <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Prior Expiry</label><input [(ngModel)]="editQuote.prior_expiry" type="date" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;"></div>
      <div><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Prior Premium</label><input [(ngModel)]="editQuote.prior_premium" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="$1,200/yr"></div>
      <div style="grid-column:1/-1;"><label style="font-size:11px;color:var(--t3);display:block;margin-bottom:3px;">Claims in Last 3 Years</label><input [(ngModel)]="editQuote.prior_claims" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:7px;color:var(--t1);font-size:13px;box-sizing:border-box;" placeholder="0 claims / describe losses"></div>
    </div>

    <!-- ── Notes ── -->
    <div style="margin-bottom:20px;">
      <label style="font-size:11px;color:var(--t3);display:block;margin-bottom:4px;">Agent Notes</label>
      <textarea [(ngModel)]="editQuote.notes" rows="2" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:8px;color:var(--t1);font-size:13px;resize:vertical;box-sizing:border-box;" placeholder="Additional notes..."></textarea>
    </div>

    <div style="display:flex;gap:10px;">
      <button (click)="saveEdit()" style="flex:1;background:#3b82f6;color:#fff;border:none;border-radius:8px;padding:11px;font-size:14px;font-weight:600;cursor:pointer;">Save Changes</button>
      <button (click)="showEditModal=false" style="flex:1;background:transparent;color:var(--t3);border:1px solid var(--bdr);border-radius:8px;padding:11px;font-size:14px;cursor:pointer;">Cancel</button>
    </div>
  </div>
</div>
  `,
})
export class QuotesComponent implements OnInit {
  quotes: QuoteSummary[] = [];
  selectedQuote: QuoteDetail | null = null;
  stats: Stats | null = null;
  clients: any[] = [];

  activeStage = 'all';
  loadingList = false;

  showNewQuoteModal = false;
  showAddCarrier = false;
  showActivity = true;
  showLossModal = false;
  showDeleteModal = false;
  showEditModal = false;

  editQuote = {
    lob: '', state: '', country: 'US', effective_date: '', expiry_date: '',
    assigned_agent: '', notes: '',
    // contact
    phone: '', email: '',
    // address
    address: '', city: '', zip: '',
    // insured info
    dob: '', gender: '', marital_status: '', ssn_last4: '',
    // coverage
    requested_bi: '', requested_pd: '', requested_um: '', requested_med: '',
    requested_deductible: '', requested_coverage_amount: '',
    // prior insurance
    prior_carrier: '', prior_expiry: '', prior_premium: '', prior_claims: '',
  };

  editRiskAuto = { year: '', make: '', model: '', vin: '', primary_driver: '', dob: '', license_number: '', garaging_zip: '', annual_miles: '', use: 'personal' };
  editRiskHome = { address: '', city: '', zip: '', year_built: '', sq_footage: '', construction_type: '', roof_type: '', roof_year: '', stories: '', dwelling_value: '', alarm: false, pool: false };
  editRiskOther = { description: '', business_name: '', revenue: '', employees: '', sq_footage: '' };

  toast = '';
  toastType: 'success' | 'error' = 'success';

  bindTarget: Carrier | null = null;
  bindPolicyNumber = '';
  bindNotes = '';

  lossReason = '';
  lossNotes = '';
  lossReasons = LOSS_REASONS;

  usStates = US_STATES;
  lobList = LOB_LIST;

  readonly lossReasonOptions: SelectOption[] = LOSS_REASONS.map(r => ({ value: r.v, label: r.l }));
  readonly lobOptions: SelectOption[] = LOB_LIST.map(l => ({ value: l.value, label: l.label }));
  readonly stateOptions: SelectOption[] = [
    { value: '', label: '—' },
    ...US_STATES.map(s => ({ value: s.v, label: s.v + ' — ' + s.l }))
  ];
  readonly genderOptions: SelectOption[] = [
    { value: '', label: '—' },
    { value: 'M', label: 'Male' },
    { value: 'F', label: 'Female' },
    { value: 'X', label: 'Non-binary' },
  ];
  readonly maritalOptions: SelectOption[] = [
    { value: '', label: '—' },
    { value: 'single', label: 'Single' },
    { value: 'married', label: 'Married' },
    { value: 'divorced', label: 'Divorced' },
    { value: 'widowed', label: 'Widowed' },
  ];
  readonly countryOptions: SelectOption[] = [
    { value: 'US', label: 'United States' },
    { value: 'CA', label: 'Canada' },
    { value: 'GB', label: 'United Kingdom' },
    { value: 'AU', label: 'Australia' },
    { value: 'IN', label: 'India' },
    { value: 'OTHER', label: 'Other' },
  ];
  readonly vehicleUseOptions: SelectOption[] = [
    { value: 'personal', label: 'Personal' },
    { value: 'commute', label: 'Commute' },
    { value: 'business', label: 'Business' },
    { value: 'rideshare', label: 'Rideshare' },
  ];

  get clientOptions(): SelectOption[] {
    return [
      { value: '', label: 'Select client…' },
      ...this.clients.map(c => ({ value: c.id, label: c.name || c.client_name || c.full_name }))
    ];
  }

  clientMode: 'picker' | 'walkin' = 'picker';

  newQuote = {
    client_id: '', client_name: '', lob: '', state: '',
    effective_date: '', expiry_date: '', assigned_agent: '', notes: '', country: 'US',
    // Contact
    phone: '', email: '',
    // Insured address
    address: '', city: '', zip: '',
    // Insured info
    dob: '', ssn_last4: '', gender: '', marital_status: '',
    // Coverage requested
    requested_bi: '', requested_pd: '', requested_um: '', requested_med: '',
    requested_deductible: '', requested_coverage_amount: '',
    // Prior insurance
    prior_carrier: '', prior_expiry: '', prior_premium: '', prior_claims: '',
  };

  riskAuto = { year: '', make: '', model: '', vin: '', primary_driver: '', dob: '', license_number: '', garaging_zip: '', annual_miles: '', use: 'personal' };
  riskHome = { address: '', city: '', zip: '', year_built: '', sq_footage: '', construction_type: '', roof_type: '', roof_year: '', stories: '', dwelling_value: '', alarm: false, pool: false };
  riskOther = { description: '', business_name: '', revenue: '', employees: '', sq_footage: '' };

  newCarrier = {
    carrier_name: '', annual_premium: null as number | null,
    monthly_premium: null as number | null, coverage_details: '', notes: ''
  };

  statCards: {label: string; value: string; color: string}[] = [];
  stageTabs: {label: string; value: string; count: number | null}[] = [];

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadStats();
    this.loadQuotes();
    this.loadClients();
  }

  loadStats() {
    this.http.get<Stats>(`${API}/quotes/stats`).subscribe({
      next: (s) => {
        this.stats = s;
        this.buildStatCards();
        this.buildStageTabs();
        this.cdr.markForCheck();
      },
      error: () => {
        this.buildStageTabs();
        this.cdr.markForCheck();
      }
    });
  }

  buildStatCards() {
    const s = this.stats;
    if (!s) { this.statCards = []; return; }
    const total = s.by_stage.reduce((a, b) => a + b.cnt, 0);
    const active = s.by_stage.filter(x => ['draft','sent','comparing'].includes(x.stage)).reduce((a,b)=>a+b.cnt,0);
    const bound = s.by_stage.find(x=>x.stage==='bound')?.cnt || 0;
    const wr = s.win_rate?.total ? Math.round((s.win_rate.won / s.win_rate.total) * 100) : 0;
    this.statCards = [
      {label:'Total Quotes', value: String(total), color:'#f1f5f9'},
      {label:'Active', value: String(active), color:'#3b82f6'},
      {label:'Bound This Month', value: String(bound), color:'#10b981'},
      {label:'Win Rate', value: wr + '%', color: wr>=50?'#10b981':'#f59e0b'},
    ];
  }

  buildStageTabs() {
    const stages = ['draft','sent','comparing','bound','lost'];
    const counts: Record<string,number> = {};
    (this.stats?.by_stage || []).forEach(x => counts[x.stage] = x.cnt);
    this.stageTabs = [
      {label:'All', value:'all', count: null},
      ...stages.map(s => ({label: s.charAt(0).toUpperCase() + s.slice(1), value: s, count: counts[s] ?? 0}))
    ];
  }

  loadQuotes() {
    this.loadingList = true;
    const params: any = {};
    if (this.activeStage !== 'all') params['stage'] = this.activeStage;
    this.http.get<any>(`${API}/quotes`, {params}).subscribe({
      next: (res) => {
        this.quotes = Array.isArray(res) ? res : (res.items || res.quotes || res.data || []);
        this.loadingList = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loadingList = false; this.cdr.markForCheck(); }
    });
  }

  loadClients() {
    this.http.get<any>(`${API}/ams/clients?limit=200`).subscribe({
      next: (res) => {
        this.clients = Array.isArray(res) ? res : (res.items || res.clients || res.data || []);
        this.cdr.markForCheck();
      }
    });
  }

  setStageFilter(stage: string) {
    this.activeStage = stage;
    this.selectedQuote = null;
    this.loadQuotes();
  }

  selectQuote(q: QuoteSummary) {
    this.http.get<QuoteDetail>(`${API}/quotes/${q.id}`).subscribe({
      next: (detail) => {
        this.selectedQuote = detail;
        this.showAddCarrier = false;
        this.showActivity = true;
        if (detail.state) this.loadJurisdiction(detail.state);
        this.cdr.markForCheck();
      }
    });
  }

  loadJurisdiction(state: string) {
    this.http.get<any>(`${API}/jurisdictions/lookup?country=US&state=${state}`).subscribe({
      next: (jd) => {
        if (this.selectedQuote && jd) {
          const product = jd.products?.find((p: any) => p.lob === this.selectedQuote!.lob) || jd.products?.[0];
          if (product?.min_limits) {
            this.selectedQuote.jurisdiction_minimums = product.min_limits;
          }
          if (jd.required_coverages) {
            this.selectedQuote.jurisdiction_required = jd.required_coverages;
          }
          this.cdr.markForCheck();
        }
      }
    });
  }

  hasJurisdictionData(): boolean {
    const m = this.selectedQuote?.jurisdiction_minimums;
    return !!(m && (m.bi_per_person_k || m.property_damage_k || m.pip_k));
  }

  openNewQuoteModal() {
    this.newQuote = {
      client_id:'', client_name:'', lob:'', state:'', effective_date:'', expiry_date:'',
      assigned_agent:'', notes:'', country:'US',
      phone:'', email:'', address:'', city:'', zip:'',
      dob:'', ssn_last4:'', gender:'', marital_status:'',
      requested_bi:'', requested_pd:'', requested_um:'', requested_med:'',
      requested_deductible:'', requested_coverage_amount:'',
      prior_carrier:'', prior_expiry:'', prior_premium:'', prior_claims:'',
    };
    this.riskAuto = { year:'', make:'', model:'', vin:'', primary_driver:'', dob:'', license_number:'', garaging_zip:'', annual_miles:'', use:'personal' };
    this.riskHome = { address:'', city:'', zip:'', year_built:'', sq_footage:'', construction_type:'', roof_type:'', roof_year:'', stories:'', dwelling_value:'', alarm:false, pool:false };
    this.riskOther = { description:'', business_name:'', revenue:'', employees:'', sq_footage:'' };
    this.clientMode = 'picker';
    this.showNewQuoteModal = true;
  }

  onLobChange() { /* triggers template re-render */ }

  submitNewQuote() {
    const { phone, email, address, city, zip, dob, ssn_last4, gender, marital_status,
            requested_bi, requested_pd, requested_um, requested_med,
            requested_deductible, requested_coverage_amount,
            prior_carrier, prior_expiry, prior_premium, prior_claims,
            expiry_date, ...quoteCore } = this.newQuote;

    const body: any = { ...quoteCore, country: 'US' };
    if (expiry_date) body.expiry_date = expiry_date;
    if (this.clientMode === 'walkin') { delete body.client_id; }
    else { delete body.client_name; }

    const insured = { phone, email, address, city, zip, dob, ssn_last4, gender, marital_status };
    const prior = { prior_carrier, prior_expiry, prior_premium, prior_claims };
    const coverage_requested = { bi: requested_bi, pd: requested_pd, um: requested_um,
                                  med: requested_med, deductible: requested_deductible,
                                  coverage_amount: requested_coverage_amount };

    if (this.newQuote.lob === 'auto')
      body.risk_data = { ...this.riskAuto, insured, prior_insurance: prior, coverage_requested };
    else if (this.newQuote.lob === 'homeowners' || this.newQuote.lob === 'renters')
      body.risk_data = { ...this.riskHome, insured, prior_insurance: prior, coverage_requested };
    else
      body.risk_data = { ...this.riskOther, insured, prior_insurance: prior, coverage_requested };

    body.requested_limits = coverage_requested;

    this.http.post<QuoteSummary>(`${API}/quotes`, body).subscribe({
      next: (q) => {
        this.showNewQuoteModal = false;
        this.showToast('Quote created successfully', 'success');
        this.loadQuotes();
        this.loadStats();
        if (q?.id) setTimeout(() => this.selectQuote(q), 300);
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.showToast('Failed to create quote: ' + (e?.error?.detail || e?.message || 'Unknown error'), 'error');
        this.cdr.markForCheck();
      }
    });
  }

  addCarrier() {
    if (!this.selectedQuote || !this.newCarrier.carrier_name) return;
    this.http.post<Carrier>(`${API}/quotes/${this.selectedQuote.id}/carriers`, this.newCarrier).subscribe({
      next: () => {
        this.showAddCarrier = false;
        this.newCarrier = { carrier_name:'', annual_premium: null, monthly_premium: null, coverage_details:'', notes:'' };
        this.showToast('Carrier added', 'success');
        this.refreshDetail();
      },
      error: (e) => this.showToast('Failed: ' + (e?.error?.detail || 'error'), 'error')
    });
  }

  sendToCarriers() {
    if (!this.selectedQuote) return;
    this.http.patch<any>(`${API}/quotes/${this.selectedQuote.id}`, {stage: 'sent'}).subscribe({
      next: () => {
        this.showToast('Quote sent to carriers', 'success');
        this.refreshDetail();
        this.loadQuotes();
      },
      error: () => this.showToast('Failed to update stage', 'error')
    });
  }

  confirmBind(carrier: Carrier) {
    this.bindTarget = carrier;
    this.bindPolicyNumber = '';
    this.bindNotes = '';
  }

  doBind() {
    if (!this.selectedQuote || !this.bindTarget) return;
    const body: any = { carrier_quote_id: this.bindTarget.id };
    if (this.bindPolicyNumber) body.policy_number = this.bindPolicyNumber;
    if (this.bindNotes) body.notes = this.bindNotes;
    this.http.post<any>(`${API}/quotes/${this.selectedQuote.id}/bind`, body).subscribe({
      next: (res) => {
        this.bindTarget = null;
        const policyMsg = res?.policy_number ? ' Policy: ' + res.policy_number : '';
        this.showToast('Quote bound successfully!' + policyMsg, 'success');
        this.refreshDetail();
        this.loadQuotes();
        this.loadStats();
        this.cdr.markForCheck();
      },
      error: (e) => { this.showToast('Bind failed: ' + (e?.error?.detail || 'error'), 'error'); this.cdr.markForCheck(); }
    });
  }

  openLossModal() {
    this.lossReason = '';
    this.lossNotes = '';
    this.showLossModal = true;
  }

  confirmDeleteQuote() {
    if (!this.selectedQuote) return;
    this.showDeleteModal = true;
  }

  deleteQuote() {
    if (!this.selectedQuote) return;
    this.http.delete<any>(`${API}/quotes/${this.selectedQuote.id}`).subscribe({
      next: () => {
        this.showDeleteModal = false;
        this.selectedQuote = null;
        this.showToast('Quote deleted', 'success');
        this.loadQuotes();
        this.loadStats();
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.showToast('Failed to delete: ' + (e?.error?.detail || 'error'), 'error');
        this.cdr.markForCheck();
      }
    });
  }

  openEditModal() {
    if (!this.selectedQuote) return;
    const q = this.selectedQuote as any;
    const rd = q.risk_data || {};
    const ins = rd.insured || {};
    const prior = rd.prior_insurance || {};
    const cov = rd.coverage_requested || q.requested_limits || {};

    this.editQuote = {
      lob: q.lob || '',
      state: q.state || '',
      country: q.country || 'US',
      effective_date: q.effective_date || '',
      expiry_date: q.expiry_date || '',
      assigned_agent: q.assigned_agent || '',
      notes: q.notes || '',
      phone: ins.phone || '',
      email: ins.email || '',
      address: ins.address || '',
      city: ins.city || '',
      zip: ins.zip || '',
      dob: ins.dob || '',
      gender: ins.gender || '',
      marital_status: ins.marital_status || '',
      ssn_last4: ins.ssn_last4 || '',
      requested_bi: cov.bi || '',
      requested_pd: cov.pd || '',
      requested_um: cov.um || '',
      requested_med: cov.med || '',
      requested_deductible: cov.deductible || '',
      requested_coverage_amount: cov.coverage_amount || '',
      prior_carrier: prior.prior_carrier || '',
      prior_expiry: prior.prior_expiry || '',
      prior_premium: prior.prior_premium || '',
      prior_claims: prior.prior_claims || '',
    };

    const lob = q.lob || '';
    if (lob === 'auto') {
      this.editRiskAuto = {
        year: rd.year || '', make: rd.make || '', model: rd.model || '',
        vin: rd.vin || '', primary_driver: rd.primary_driver || '',
        dob: rd.dob || '', license_number: rd.license_number || '',
        garaging_zip: rd.garaging_zip || '', annual_miles: rd.annual_miles || '',
        use: rd.use || 'personal',
      };
    } else if (lob === 'homeowners' || lob === 'renters') {
      this.editRiskHome = {
        address: rd.address || '', city: rd.city || '', zip: rd.zip || '',
        year_built: rd.year_built || '', sq_footage: rd.sq_footage || '',
        construction_type: rd.construction_type || '', roof_type: rd.roof_type || '',
        roof_year: rd.roof_year || '', stories: rd.stories || '',
        dwelling_value: rd.dwelling_value || '',
        alarm: rd.alarm || false, pool: rd.pool || false,
      };
    } else {
      this.editRiskOther = {
        description: rd.description || '', business_name: rd.business_name || '',
        revenue: rd.revenue || '', employees: rd.employees || '', sq_footage: rd.sq_footage || '',
      };
    }
    this.showEditModal = true;
  }

  saveEdit() {
    if (!this.selectedQuote) return;
    const lob = this.editQuote.lob;
    const insured = {
      phone: this.editQuote.phone, email: this.editQuote.email,
      address: this.editQuote.address, city: this.editQuote.city, zip: this.editQuote.zip,
      dob: this.editQuote.dob, gender: this.editQuote.gender,
      marital_status: this.editQuote.marital_status, ssn_last4: this.editQuote.ssn_last4,
    };
    const prior_insurance = {
      prior_carrier: this.editQuote.prior_carrier, prior_expiry: this.editQuote.prior_expiry,
      prior_premium: this.editQuote.prior_premium, prior_claims: this.editQuote.prior_claims,
    };
    const coverage_requested = {
      bi: this.editQuote.requested_bi, pd: this.editQuote.requested_pd,
      um: this.editQuote.requested_um, med: this.editQuote.requested_med,
      deductible: this.editQuote.requested_deductible,
      coverage_amount: this.editQuote.requested_coverage_amount,
    };

    let risk_data: any;
    if (lob === 'auto') risk_data = { ...this.editRiskAuto, insured, prior_insurance, coverage_requested };
    else if (lob === 'homeowners' || lob === 'renters') risk_data = { ...this.editRiskHome, insured, prior_insurance, coverage_requested };
    else risk_data = { ...this.editRiskOther, insured, prior_insurance, coverage_requested };

    const body: any = {
      lob, state: this.editQuote.state, country: this.editQuote.country,
      effective_date: this.editQuote.effective_date || null,
      expiry_date: this.editQuote.expiry_date || null,
      assigned_agent: this.editQuote.assigned_agent,
      notes: this.editQuote.notes,
      risk_data,
      requested_limits: coverage_requested,
    };
    this.http.patch<any>(`${API}/quotes/${this.selectedQuote.id}`, body).subscribe({
      next: () => {
        this.showEditModal = false;
        this.showToast('Quote updated', 'success');
        this.refreshDetail();
        this.loadQuotes();
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.showToast('Failed to update: ' + (e?.error?.detail || 'error'), 'error');
        this.cdr.markForCheck();
      }
    });
  }

  doMarkLost() {
    if (!this.selectedQuote || !this.lossReason) return;
    this.http.post<any>(`${API}/quotes/${this.selectedQuote.id}/lose`, { reason: this.lossReason, notes: this.lossNotes }).subscribe({
      next: () => {
        this.showLossModal = false;
        this.showToast('Quote marked as lost', 'success');
        this.refreshDetail();
        this.loadQuotes();
        this.loadStats();
        this.cdr.markForCheck();
      },
      error: (e) => { this.showToast('Failed: ' + (e?.error?.detail || 'error'), 'error'); this.cdr.markForCheck(); }
    });
  }

  refreshDetail() {
    if (this.selectedQuote) this.selectQuote(this.selectedQuote);
  }

  showToast(msg: string, type: 'success' | 'error') {
    this.toast = msg;
    this.toastType = type;
    this.cdr.markForCheck();
    setTimeout(() => { this.toast = ''; this.cdr.markForCheck(); }, 4000);
  }

  getLobColor(lob: string): string { return LOB_COLORS[lob] || '#64748b'; }
  getStageColor(stage: string): string { return STAGE_COLORS[stage] || '#64748b'; }

  getCarrierStatusStyle(status: string): string {
    const map: Record<string,string> = {
      received: 'background:#1e3a5f;color:#60a5fa;',
      selected: 'background:#064e3b;color:#34d399;',
      declined: 'background:#450a0a;color:#fca5a5;',
      pending: 'background:var(--surf2);color:var(--t2);',
    };
    return map[status] || map['pending'];
  }

  formatNum(n: number): string {
    return n.toLocaleString('en-US');
  }

  formatDate(d: string): string {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}); } catch { return d; }
  }

  formatDateTime(d: string): string {
    if (!d) return '';
    try { return new Date(d).toLocaleString('en-US', {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}); } catch { return d; }
  }

  daysUntil(d: string): number {
    if (!d) return 999;
    const diff = new Date(d).getTime() - Date.now();
    return Math.ceil(diff / 86400000);
  }
}
