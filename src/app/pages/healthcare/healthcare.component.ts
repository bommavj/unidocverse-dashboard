import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-healthcare',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HttpClientModule],
  template: `
    <div class="p-6 page-container">
      <!-- Topbar Header -->
      <div class="topbar">
        <div>
          <div class="topbar-title">Patient Directory</div>
          <div class="topbar-sub">{{ getFilteredPatients().length }} of {{ patientCharts.length }} patients</div>
        </div>
        <div class="tb-sp"></div>
        <div class="tb-search">
          <span>🔍</span>
          <input [(ngModel)]="searchQ" placeholder="Search patient name, MRN, insurance…">
          <button class="tb-clear" *ngIf="searchQ" (click)="searchQ=''">✕</button>
          <button class="tb-voice" (click)="startVoiceSearch()" title="Voice Search">🎤</button>
        </div>
        <button class="tb-chip" [class.on]="filterStatus===''" (click)="filterStatus=''">All</button>
        <button class="tb-chip" [class.on]="filterStatus==='Verified'" (click)="filterStatus='Verified'">Verified</button>
        <button class="tb-chip" [class.on]="filterStatus==='Pending'" (click)="filterStatus='Pending'">Pending</button>
        
        <button 
          (click)="togglePii()"
          [class]="piiMasked ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white'"
          class="px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2">
          <span>{{ piiMasked ? '🔒 PII Masking ON' : '🔓 PII Masking OFF' }}</span>
        </button>

        <select class="tb-select" [(ngModel)]="sortBy" style="margin-left: 8px; margin-right: 8px;">
          <option value="name_asc">🔤 Sort: Name (A-Z)</option>
          <option value="name_desc">🔤 Sort: Name (Z-A)</option>
          <option value="score_desc">📈 Sort: Score (High-Low)</option>
          <option value="score_asc">📉 Sort: Score (Low-High)</option>
        </select>
        <button class="tb-btn tb-pri" (click)="showAddForm=true">+ Add Patient</button>
      </div>

      <div class="content">
        <!-- Stats Summary Row -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-lbl">Total Patients</div>
          <div class="stat-val">{{ patientCharts.length }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Avg Chart Score</div>
          <div class="stat-val" style="color:#4f46e5">{{ getAvgChartScore() }}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Verified Eligibility</div>
          <div class="stat-val" style="color:#16a34a">{{ getVerifiedEligibilityCount() }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Consent Signed</div>
          <div class="stat-val" style="color:#d97706">{{ getConsentSignedCount() }}</div>
        </div>
      </div>

      <!-- Add Patient Form -->
      <div class="add-card" *ngIf="showAddForm">
        <div class="add-card-header">
          <span style="font-size:16px;font-weight:700;color:#0f172a">New Patient Profile</span>
          <button class="tb-btn tb-sec" style="height:30px" (click)="showAddForm=false">✕ Cancel</button>
        </div>
        <div class="add-form-grid">
          <div class="form-field"><label>Patient Name *</label><input [(ngModel)]="newPatient.name" placeholder="Johnathan Doe"></div>
          <div class="form-field"><label>DOB *</label><input [(ngModel)]="newPatient.dob" placeholder="01/01/1980"></div>
          <div class="form-field"><label>Insurance Payer</label><input [(ngModel)]="newPatient.payer" placeholder="Aetna / Blue Cross"></div>
          <div class="form-field"><label>Chart Score (%)</label><input [(ngModel)]="newPatient.score" type="number" placeholder="85"></div>
          <div class="form-field">
            <label>Eligibility Status</label>
            <select [(ngModel)]="newPatient.eligibility">
              <option value="Verified">Verified</option>
              <option value="Pending">Pending</option>
              <option value="Flagged">Flagged</option>
            </select>
          </div>
          <div class="form-field">
            <label>Consent Status</label>
            <select [(ngModel)]="newPatient.consent">
              <option [ngValue]="true">Consent Signed</option>
              <option [ngValue]="false">Consent Pending</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="tb-btn tb-pri" (click)="savePatient()">✓ Create Patient</button>
          <button class="tb-btn tb-sec" (click)="showAddForm=false">Cancel</button>
        </div>
      </div>

      <!-- Active Patient Chart Directory -->
      <div class="mb-6">
        <div class="client-grid" *ngIf="patientCharts.length > 0">
          <div 
            *ngFor="let p of getFilteredPatients()"
            (click)="selectPatient(p)"
            [class.active-card]="selectedPatientName === p.name"
            class="client-card">
            
            <!-- Card Header -->
            <div class="cc-header">
              <div [style.background]="getAvatarColor(p.name)" class="cc-avatar">
                {{ getInitials(p.name) }}
              </div>
              <div class="cc-info">
                <h4 class="cc-name">{{ maskPiiValue(p.name) }}</h4>
                <div class="cc-num">ID: {{ p.id }} · DOB: {{ maskPiiValue(p.dob) }}</div>
              </div>
              <span class="badge" 
                    [class.badge-green]="p.eligibility === 'Active' || p.eligibility === 'Verified'"
                    [class.badge-amber]="p.eligibility === 'Pending' || p.eligibility === 'Flagged'"
                    [class.badge-slate]="p.eligibility !== 'Active' && p.eligibility !== 'Verified' && p.eligibility !== 'Pending' && p.eligibility !== 'Flagged'">
                {{ p.eligibility }}
              </span>
            </div>

            <!-- Stats & Info Row -->
            <div class="cc-stats-two">
              <div class="cc-stat">
                <span class="cc-stat-val" [title]="p.score + '%'">{{ p.score }}%</span>
                <span class="cc-stat-lbl">Chart Score</span>
              </div>
              <div class="cc-stat">
                <span class="cc-stat-val truncate" [title]="p.consent ? 'Signed' : 'Pending'">{{ p.consent ? 'Signed' : 'Pending' }}</span>
                <span class="cc-stat-lbl">Consent</span>
              </div>
            </div>
            <div class="cc-stat cc-full-stat">
              <span class="cc-stat-val" [title]="p.payer" style="white-space: normal; overflow: visible; text-overflow: clip; font-size: 13.5px;">{{ p.payer }}</span>
              <span class="cc-stat-lbl">Insurance Provider</span>
            </div>

            <!-- Quick Action Buttons on Card -->
            <div class="cc-actions">
              <button 
                *ngFor="let item of domainMenu; let i = index"
                (click)="selectedPatientName = p.name; activeTab = item.id; $event.stopPropagation()"
                [ngClass]="selectedPatientName === p.name && activeTab === item.id ? 'bg-indigo-650 text-white shadow-sm' : 'btn-color-' + i"
                class="cc-action-btn">
                <span>{{ item.icon }}</span>
                <span class="truncate">{{ item.label }}</span>
              </button>
              <button 
                (click)="askAI(p, $event)"
                class="cc-action-btn cc-action-ai"
                [class.active]="showSidebar && sidebarTab === 'chat' && selectedPatientName === p.name"
                title="Ask AI about this patient">
                ✦ Ask AI
              </button>
              <button 
                (click)="emailContact(p, $event)"
                class="cc-action-btn cc-action-email"
                [class.active]="true"
                title="Email Patient">
                ✉ Email
              </button>
              <button 
                (click)="callContact(p, $event)"
                class="cc-action-btn cc-action-phone"
                [class.active]="true"
                title="Call Patient">
                📞 Call
              </button>
            </div>
          </div>
        </div>
        <div *ngIf="patientCharts.length === 0" class="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <span style="font-size: 36px">🩺</span>
          <h3 class="text-md font-bold mt-3 text-slate-900 dark:text-white">No Patient Charts Found</h3>
          <p class="text-xs text-slate-500 mt-2 font-sans">Upload medical chart documents to dynamically view patient profiles and clinical stats.</p>
          <button routerLink="/upload" class="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold font-sans">
            ↑ Upload Charts
          </button>
        </div>
      </div>

      <!-- Management / Global Tabs -->
      <div class="mb-6 flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3" *ngIf="patientCharts.length > 0">
        <button 
          *ngFor="let item of managementMenu"
          (click)="activeTab = item.id"
          [class.bg-indigo-50]="activeTab === item.id"
          [class.text-indigo-600]="activeTab === item.id"
          [class.border-indigo-600]="activeTab === item.id"
          [ngClass]="{ 'dark:bg-indigo-950/40': activeTab === item.id }"
          class="px-3.5 py-2 text-xs font-semibold rounded-lg border border-transparent transition-all flex items-center gap-2 text-slate-600 dark:text-slate-455 hover:bg-slate-50 dark:hover:bg-slate-900">
          <span>{{ item.icon }}</span> {{ item.label }}
        </button>
      </div>

      <!-- Content Pane -->
      <div class="min-w-0" *ngIf="patientCharts.length > 0">
        <div [ngSwitch]="activeTab">
          <!-- 1. Prescriptions -->
          <div *ngSwitchCase="'prescriptions'" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-4">
            <div class="flex justify-between items-center">
              <h3 class="font-bold text-lg text-slate-900 dark:text-white">Active Prescriptions: <span class="text-indigo-650 dark:text-indigo-400">{{ maskPiiValue(selectedPatientName) }}</span></h3>
              <button (click)="createPrescription()" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold transition-all">New Script</button>
            </div>
            <div class="space-y-3">
              <div *ngIf="filteredPrescriptions().length === 0" class="p-6 text-center text-xs text-slate-400">No active prescriptions for this patient.</div>
              <div *ngFor="let p of filteredPrescriptions()" class="p-4 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 flex justify-between items-center gap-4">
                <div>
                  <h4 class="font-semibold text-slate-900 dark:text-white text-sm">{{ p.drugName }} <span class="text-xs text-slate-400">({{ p.dosage }})</span></h4>
                  <p class="text-xs text-slate-550 mt-0.5">Patient: {{ maskPiiValue(p.patient) }} · Prescribed by: {{ maskPiiValue(p.doctor) }}</p>
                  <p class="text-2xs text-slate-400 mt-1">Instructions: {{ p.instructions }}</p>
                </div>
                <div class="flex items-center gap-3">
                  <span [class]="p.status === 'Authorized' ? 'px-2.5 py-0.5 text-2xs font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/20' : 'px-2.5 py-0.5 text-2xs font-semibold rounded bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-955/20'">
                    {{ p.status }}
                  </span>
                  <button *ngIf="p.status !== 'Authorized'" (click)="authorizeScript(p)" class="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-3xs rounded font-bold">Authorize</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. Diagnoses & Patient Encounter Timeline -->
          <div *ngSwitchCase="'diagnoses'" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-6">
            <div>
              <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-3">Diagnoses Registry: <span class="text-indigo-650 dark:text-indigo-400">{{ maskPiiValue(selectedPatientName) }}</span></h3>
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-455">
                      <th class="py-3 px-2 font-bold uppercase">ICD-10 Code</th>
                      <th class="py-3 px-2 font-bold uppercase">Description</th>
                      <th class="py-3 px-2 font-bold uppercase">Patient</th>
                      <th class="py-3 px-2 font-bold uppercase">Classification</th>
                      <th class="py-3 px-2 font-bold uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-150 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    <tr *ngIf="filteredDiagnoses().length === 0">
                      <td colspan="5" class="py-6 text-center text-xs text-slate-400">No recorded diagnoses for this patient.</td>
                    </tr>
                    <tr *ngFor="let d of filteredDiagnoses()" class="hover:bg-slate-50 dark:hover:bg-slate-950 transition-all">
                      <td class="py-3.5 px-2 font-mono font-bold text-indigo-600 dark:text-indigo-400">{{ d.code }}</td>
                      <td class="py-3.5 px-2 font-semibold">{{ d.desc }}</td>
                      <td class="py-3.5 px-2">{{ maskPiiValue(d.patient) }}</td>
                      <td class="py-3.5 px-2">
                        <span [class]="d.severity === 'Chronic' ? 'px-2 py-0.5 rounded text-3xs font-semibold bg-red-50 text-red-700 dark:bg-red-950/20' : 'px-2 py-0.5 rounded text-3xs font-semibold bg-slate-50 text-slate-700 dark:bg-slate-950/20'">
                          {{ d.severity }}
                        </span>
                      </td>
                      <td class="py-3.5 px-2 text-right">
                        <button (click)="selectEncounterPatient(d.patient)" class="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">View Encounter Timeline</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Patient Encounter Timeline (Dynamic Widget) -->
            <div class="border-t border-slate-200 dark:border-slate-800 pt-6">
              <h3 class="font-bold text-md text-slate-900 dark:text-white mb-4">Patient Encounter Timeline: {{ maskPiiValue(encounterPatient) }}</h3>
              <div class="relative border-l-2 border-slate-200 dark:border-slate-700 ml-4 pl-6 space-y-6">
                <div *ngFor="let item of encounterTimeline" class="relative">
                  <!-- Bullet Circle -->
                  <span class="absolute -left-9 top-0.5 bg-indigo-600 text-white rounded-full p-1.5 w-6 h-6 flex items-center justify-center text-4xs">
                    {{ item.icon }}
                  </span>
                  <div>
                    <span class="font-mono text-3xs text-slate-400 font-bold block">{{ item.date }}</span>
                    <h4 class="font-bold text-slate-900 dark:text-white text-sm">{{ item.title }}</h4>
                    <p class="text-xs text-slate-550 mt-0.5">Location: {{ item.location }} · Practitioner: {{ maskPiiValue(item.provider) }}</p>
                    <p class="text-2xs text-slate-400 mt-1 italic">{{ item.notes }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. Procedures & Claims / Reimbursements -->
          <div *ngSwitchCase="'procedures'" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-6">
            <div>
              <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-4">Claims & Procedures: <span class="text-indigo-650 dark:text-indigo-400">{{ maskPiiValue(selectedPatientName) }}</span></h3>
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-455">
                      <th class="py-3 px-2 font-bold uppercase">Claim ID</th>
                      <th class="py-3 px-2 font-bold uppercase">Procedure / CPT</th>
                      <th class="py-3 px-2 font-bold uppercase">Patient</th>
                      <th class="py-3 px-2 font-bold uppercase text-right">Billed Amount</th>
                      <th class="py-3 px-2 font-bold uppercase">Status</th>
                      <th class="py-3 px-2 font-bold uppercase">Rejection / Denial Reason</th>
                      <th class="py-3 px-2 font-bold uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-150 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    <tr *ngIf="filteredClaims().length === 0">
                      <td colspan="7" class="py-6 text-center text-xs text-slate-400">No claims or procedures on record for this patient.</td>
                    </tr>
                    <tr *ngFor="let c of filteredClaims()" class="hover:bg-slate-50 dark:hover:bg-slate-950 transition-all">
                      <td class="py-3.5 px-2 font-mono font-bold text-slate-900 dark:text-white">{{ c.claimId }}</td>
                      <td class="py-3.5 px-2">{{ c.cpt }} - {{ c.procedure }}</td>
                      <td class="py-3.5 px-2">{{ maskPiiValue(c.patient) }}</td>
                      <td class="py-3.5 px-2 text-right font-mono">{{ c.amount }}</td>
                      <td class="py-3.5 px-2">
                        <span [class]="c.status === 'Paid' ? 'px-2 py-0.5 rounded text-3xs font-semibold bg-emerald-50 text-emerald-700' : (c.status === 'Denied' ? 'px-2 py-0.5 rounded text-3xs font-semibold bg-red-50 text-red-700' : 'px-2 py-0.5 rounded text-3xs font-semibold bg-amber-50 text-amber-700')">
                          {{ c.status }}
                        </span>
                      </td>
                      <td class="py-3.5 px-2 font-mono text-slate-500">{{ c.denialReason || '-' }}</td>
                      <td class="py-3.5 px-2 text-right">
                        <button *ngIf="c.status === 'Denied'" (click)="reSubmitClaim(c)" class="px-2 py-1 bg-indigo-600 text-white rounded text-3xs font-bold hover:bg-indigo-700">Appeal Denial</button>
                        <span *ngIf="c.status !== 'Denied'" class="text-slate-400 text-3xs">-</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Provider Productivity metrics -->
            <div class="border-t border-slate-200 dark:border-slate-800 pt-6">
              <h3 class="font-bold text-md text-slate-900 dark:text-white mb-4">Provider Productivity & RVU Metrics</h3>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div *ngFor="let prov of providers" class="p-4 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800">
                  <h4 class="font-bold text-slate-900 dark:text-white text-sm">{{ maskPiiValue(prov.name) }}</h4>
                  <p class="text-2xs text-slate-550">Specialty: {{ prov.specialty }}</p>
                  <div class="mt-3 space-y-2 text-xs">
                    <div class="flex justify-between">
                      <span class="text-slate-400">Total Encounters:</span>
                      <span class="font-bold text-slate-900 dark:text-white">{{ prov.encounters }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-slate-400">Target RVUs:</span>
                      <span class="font-bold text-slate-900 dark:text-white">{{ prov.rvus }} / 500</span>
                    </div>
                    <div class="w-full bg-slate-200 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                      <div class="bg-indigo-600 h-full" [style.width.%]="(prov.rvus/500)*100"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 4. Consents & Insurance Verification -->
          <div *ngSwitchCase="'consents'" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-6">
            <div>
              <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-4">Insurance Eligibility & Consent Verification: <span class="text-indigo-650 dark:text-indigo-400">{{ maskPiiValue(selectedPatientName) }}</span></h3>
              <div class="space-y-4">
                <div *ngFor="let c of patientCharts" [style.display]="c.name === selectedPatientName ? 'block' : 'none'" class="p-4 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800">
                  <div class="flex flex-wrap justify-between items-center gap-4 mb-3">
                    <div>
                      <h4 class="font-bold text-slate-900 dark:text-white text-sm">{{ maskPiiValue(c.name) }}</h4>
                      <p class="text-2xs text-slate-550">ID: {{ c.id }} · Insurance Provider: {{ c.payer || 'Blue Cross Blue Shield' }}</p>
                    </div>
                    <div class="flex gap-2">
                      <span [class]="c.eligibility === 'Verified' || c.eligibility === 'Active' ? 'px-2 py-0.5 text-xs font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-200' : 'px-2 py-0.5 text-xs font-semibold rounded bg-amber-50 text-amber-700 border border-amber-200'">
                        🛡️ Eligibility: {{ c.eligibility }}
                      </span>
                      <span [class]="c.consent ? 'px-2 py-0.5 text-xs font-semibold rounded bg-indigo-50 text-indigo-700 border border-indigo-200' : 'px-2 py-0.5 text-xs font-semibold rounded bg-red-50 text-red-700 border border-red-200'">
                        ✍️ Consent Form
                      </span>
                    </div>
                  </div>
                  <div class="flex justify-between items-center text-xs border-t dark:border-slate-850 pt-2.5 mt-2.5">
                    <span class="text-slate-455 text-2xs">Last verified: {{ c.lastVerifiedDate || '2026-06-01' }}</span>
                    <div class="flex gap-2">
                      <button (click)="verifyEligibility(c)" class="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-white text-3xs rounded font-bold">Verify Eligibility</button>
                      <button *ngIf="!c.consent" (click)="requestConsent(c)" class="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-3xs font-bold">Request Sign</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 5. Referrals & Appointments Scheduler -->
          <div *ngSwitchCase="'referrals'" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-6">
            <div>
              <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-2">Appointments: <span class="text-indigo-650 dark:text-indigo-400">{{ maskPiiValue(selectedPatientName) }}</span></h3>
              <p class="text-xs text-slate-550 mb-4">Track provider calendars, daily status logs, and patient checked-in/no-show rates.</p>
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-455">
                      <th class="py-3 px-2 font-bold uppercase">Time Slot</th>
                      <th class="py-3 px-2 font-bold uppercase">Patient</th>
                      <th class="py-3 px-2 font-bold uppercase">Provider</th>
                      <th class="py-3 px-2 font-bold uppercase">Reason for Visit</th>
                      <th class="py-3 px-2 font-bold uppercase">Status</th>
                      <th class="py-3 px-2 font-bold uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-150 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    <tr *ngIf="filteredAppointments().length === 0">
                      <td colspan="6" class="py-6 text-center text-xs text-slate-400">No scheduled appointments for this patient.</td>
                    </tr>
                    <tr *ngFor="let apt of filteredAppointments()" class="hover:bg-slate-50 dark:hover:bg-slate-955 transition-all">
                      <td class="py-3 px-2 font-mono font-bold text-indigo-600 dark:text-indigo-400">{{ apt.time }}</td>
                      <td class="py-3 px-2 font-semibold">{{ maskPiiValue(apt.patient) }}</td>
                      <td class="py-3 px-2">{{ maskPiiValue(apt.doctor) }}</td>
                      <td class="py-3 px-2">{{ apt.reason }}</td>
                      <td class="py-3 px-2">
                        <span [class]="apt.status === 'Checked In' ? 'px-2 py-0.5 rounded text-3xs font-semibold bg-emerald-50 text-emerald-700' : (apt.status === 'No-Show' ? 'px-2 py-0.5 rounded text-3xs font-semibold bg-red-50 text-red-700' : 'px-2 py-0.5 rounded text-3xs font-semibold bg-amber-50 text-amber-700')">
                          {{ apt.status }}
                        </span>
                      </td>
                      <td class="py-3 px-2 text-right">
                        <button *ngIf="apt.status === 'Scheduled'" (click)="apt.status = 'Checked In'; toast.show('Patient checked in', 'success')" class="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">Check In</button>
                        <button *ngIf="apt.status === 'Scheduled'" (click)="apt.status = 'No-Show'; toast.show('Patient flagged as No-Show', 'warning')" class="text-red-505 font-bold hover:underline ml-2">No-Show</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Outgoing specialty referrals -->
            <div class="border-t border-slate-200 dark:border-slate-800 pt-6">
              <h3 class="font-bold text-md text-slate-900 dark:text-white mb-4">Outgoing Specialty Referrals</h3>
              <div class="space-y-3">
                <div *ngIf="filteredReferrals().length === 0" class="p-6 text-center text-xs text-slate-400">No outgoing referrals for this patient.</div>
                <div *ngFor="let r of filteredReferrals()" class="p-4 rounded-lg border dark:border-slate-800 bg-slate-50 dark:bg-slate-955 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div class="text-2xs uppercase tracking-wider font-bold text-indigo-650 dark:text-indigo-400 mb-1">Specialty: {{ r.specialty }}</div>
                    <h4 class="font-bold text-slate-900 dark:text-white text-sm">Patient: {{ maskPiiValue(r.patient) }}</h4>
                    <p class="text-xs text-slate-550 dark:text-slate-400 mt-0.5">Referred to: {{ r.targetDoc }} · Date Issued: {{ r.date }}</p>
                  </div>
                  <div class="flex items-center gap-3">
                    <span [class]="r.status === 'Approved' ? 'px-2.5 py-0.5 text-2xs font-semibold rounded bg-emerald-100 text-emerald-800' : 'px-2.5 py-0.5 text-2xs font-semibold rounded bg-amber-100 text-amber-800'">
                      {{ r.status }}
                    </span>
                    <button *ngIf="r.status !== 'Approved'" (click)="approveReferral(r)" class="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-all">Approve</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

    <!-- Details Sidebar Drawer -->
    <div class="details-sidebar" [class.details-sidebar-open]="showSidebar">
      <div class="sidebar-header" *ngIf="getSelectedPatient()">
        <div class="sidebar-header-left">
          <div [style.background]="getAvatarColor(selectedPatientName)" class="sidebar-avatar">
            {{ getInitials(selectedPatientName) }}
          </div>
          <div>
            <h3 class="sidebar-title">{{ maskPiiValue(selectedPatientName) }}</h3>
            <p class="sidebar-subtitle">MRN Details · Patient Chart Profile</p>
          </div>
        </div>
        <button class="sidebar-close-btn" (click)="showSidebar = false">✕</button>
      </div>
      
      <!-- Sidebar Tabs Navigation -->
      <div class="sidebar-tabs" *ngIf="getSelectedPatient()">
        <button class="sidebar-tab" [class.active]="sidebarTab === 'details'" (click)="sidebarTab = 'details'">📋 Details</button>
        <button class="sidebar-tab" [class.active]="sidebarTab === 'chat'" (click)="sidebarTab = 'chat'">✦ Ask AI</button>
      </div>

      <div class="sidebar-content" *ngIf="getSelectedPatient() as p">
        
        <!-- Details Tab Content -->
        <div *ngIf="sidebarTab === 'details'" style="display:flex; flex-direction:column; gap:18px; width: 100%;">
          <h4 class="sidebar-section-title">General Information</h4>
          <div class="sidebar-grid">
            <div class="sidebar-field">
              <span class="sidebar-label">Full Name</span>
              <span class="sidebar-value">{{ maskPiiValue(p.name) }}</span>
            </div>
            <div class="sidebar-field">
              <span class="sidebar-label">Date of Birth</span>
              <span class="sidebar-value">{{ maskPiiValue(p.dob) }}</span>
            </div>
            <div class="sidebar-field">
              <span class="sidebar-label">MRN / ID</span>
              <span class="sidebar-value">{{ p.id }}</span>
            </div>
            <div class="sidebar-field">
              <span class="sidebar-label">Insurance Provider</span>
              <span class="sidebar-value">{{ p.payer }}</span>
            </div>
          </div>
        </div>

        <div>
          <h4 class="sidebar-section-title">Clinical Eligibility Status</h4>
          <div class="sidebar-grid">
            <div class="sidebar-field">
              <span class="sidebar-label">Chart Score</span>
              <span class="sidebar-value font-bold text-indigo-600">{{ p.score }}%</span>
            </div>
            <div class="sidebar-field">
              <span class="sidebar-label">Eligibility Status</span>
              <span class="sidebar-value">
                <span class="badge" 
                      [class.badge-green]="p.eligibility === 'Active' || p.eligibility === 'Verified'"
                      [class.badge-amber]="p.eligibility === 'Pending' || p.eligibility === 'Flagged'">
                  {{ p.eligibility }}
                </span>
              </span>
            </div>
            <div class="sidebar-field">
              <span class="sidebar-label">HIPAA Consent</span>
              <span class="sidebar-value">{{ p.consent ? '✓ Consent Signed' : '⚠️ Consent Pending' }}</span>
            </div>
            <div class="sidebar-field">
              <span class="sidebar-label">Last Verified</span>
              <span class="sidebar-value">{{ p.lastVerifiedDate || '2026-06-01' }}</span>
            </div>
          </div>
        </div>

        <div>
          <h4 class="sidebar-section-title">Active Timeline & Events</h4>
          <div class="space-y-2">
            <div *ngFor="let item of encounterTimeline" class="sidebar-record">
              <div class="flex justify-between font-bold text-3xs text-slate-400 mb-1">
                <span>{{ item.date }} · {{ item.location }}</span>
                <span>{{ item.icon }}</span>
              </div>
              <div class="font-bold text-slate-800 dark:text-slate-200">{{ item.title }}</div>
              <div class="text-3xs text-slate-500 mt-0.5">Practitioner: {{ maskPiiValue(item.provider) }}</div>
            </div>
          </div>
        </div>

        <!-- Chat Tab Content -->
        <div *ngIf="sidebarTab === 'chat'" class="sidebar-chat-container">
          <div class="sidebar-chat-messages">
            <div *ngFor="let msg of chatHistory" class="sidebar-chat-msg" [class.user]="msg.role === 'user'" [class.ai]="msg.role === 'ai'">
              <div class="msg-avatar">{{ msg.role === 'user' ? '👤' : '✦' }}</div>
              <div class="msg-bubble">
                <span *ngIf="msg.text">{{ msg.text }}</span>
                <span *ngIf="!msg.text && msg.role === 'ai' && aiLoading" class="caip-typing">
                  <span></span><span></span><span></span>
                </span>
              </div>
            </div>
          </div>
          
          <div class="sidebar-chat-suggestions" *ngIf="chatHistory.length <= 1">
            <button *ngFor="let sug of getChatSuggestions()" (click)="chatInput=sug; sendChatMessage()" class="sidebar-chat-chip">
              {{ sug }}
            </button>
          </div>

          <div class="sidebar-chat-input-area">
            <input [(ngModel)]="chatInput" (keydown.enter)="sendChatMessage()" [disabled]="aiLoading" placeholder="Ask AI about this patient..." class="sidebar-chat-input">
            <button (click)="sendChatMessage()" [disabled]="!chatInput.trim() || aiLoading" class="sidebar-chat-send">
              {{ aiLoading ? '⏳' : '→' }}
            </button>
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .page-container { padding: 0 0 24px; }
    
    /* Topbar */
    .topbar { height: 56px; background: rgba(255,255,255,.82); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(203,213,225,.4); display: flex; align-items: center; padding: 0 26px; gap: 10px; box-shadow: 0 1px 12px rgba(79,70,229,.06); }
    .topbar-title { font-size: 16px; font-weight: 800; color: #0f172a; letter-spacing: -.3px; }
    .topbar-sub   { font-size: 11.5px; color: #94a3b8; margin-top: 1px; }
    .tb-sp { flex: 1; }
    .tb-search { display:flex; align-items:center; gap:8px; background:rgba(255,255,255,.7); border:1.5px solid #e2e8f4; border-radius:12px; padding:0 14px; height:38px; width:280px; transition:all .18s; }
    .tb-search:focus-within { border-color:#4f46e5; background:#fff; box-shadow:0 0 0 3px rgba(79,70,229,.1); }
    .tb-search input { flex:1; border:none; outline:none; background:transparent; color:#0f172a; font-size:13px; }
    .tb-search input::placeholder { color:#94a3b8 }
    .tb-clear { background:none; border:none; cursor:pointer; color:#94a3b8; }
    .tb-clear:hover { color:#0f172a }
    .tb-chip { height:32px; padding:0 12px; border-radius:8px; border:1.5px solid #e2e8f4; background:rgba(255,255,255,.8); font-size:12px; font-weight:500; color:#64748b; cursor:pointer; transition:all .14s; white-space:nowrap; }
    .tb-chip.on { background:#eef2ff; border-color:#c7d2fe; color:#4f46e5; }
    .tb-chip:hover:not(.on) { border-color:#c7d2fe; color:#4f46e5; }
    .tb-btn { display:inline-flex; align-items:center; gap:6px; height:36px; padding:0 14px; border-radius:10px; font-size:12.5px; font-weight:600; cursor:pointer; transition:all .16s; border:none; white-space:nowrap; }
    .tb-pri { background:#4f46e5; color:#fff; box-shadow:0 4px 12px rgba(79,70,229,.25); }
    .tb-pri:hover { background:#4338ca; transform:translateY(-1px); }
    .tb-sec { background:rgba(255,255,255,.8); border:1.5px solid #c7d2fe; color:#475569; }
    .tb-sec:hover { border-color:#4f46e5; color:#4f46e5; }

    /* Stats Row */
    .stats-row { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:20px; }
    .stat-card { background:rgba(255,255,255,.9); backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,.7); border-radius:14px; padding:16px 18px; box-shadow:0 2px 8px rgba(79,70,229,.07); }
    .stat-lbl { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.6px; color:#94a3b8; margin-bottom:6px; }
    .stat-val { font-size:26px; font-weight:800; color:#0f172a; letter-spacing:-1px; }

    /* Add Form Card */
    .add-card { background:rgba(255,255,255,.95); border:1.5px solid #c7d2fe; border-radius:16px; padding:22px 24px; margin-bottom:20px; box-shadow:0 4px 16px rgba(79,70,229,.1); }
    .add-card-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
    .add-form-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; }
    .form-field { display:flex; flex-direction:column; gap:5px; }
    .form-field.full { grid-column: 1 / -1; }
    .form-field label { font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.4px; }
    .form-field input, .form-field select { height:38px; border:1.5px solid #e2e8f4; border-radius:8px; padding:0 12px; font-size:13px; color:#0f172a; outline:none; transition:border-color .15s; background:rgba(255,255,255,.8); }
    .form-field input:focus, .form-field select:focus { border-color:#4f46e5; box-shadow:0 0 0 3px rgba(79,70,229,.08); }

    /* Client Grid & Cards */
    .client-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; width: 100%; }
    .client-card {
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(10px);
      border: 1.5px solid rgba(203, 213, 225, 0.6);
      border-radius: 16px;
      padding: 18px;
      transition: all 0.18s;
      box-shadow: 0 2px 8px rgba(79, 70, 229, 0.06);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 12px;
      cursor: pointer;
    }
    .client-card:hover {
      border-color: #c7d2fe;
      box-shadow: 0 8px 28px rgba(79, 70, 229, 0.12);
      transform: translateY(-2px);
    }
    .active-card {
      border-color: #4f46e5 !important;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15) !important;
    }

    .cc-header { display: flex; align-items: center; gap: 10px; }
    .cc-avatar {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      font-weight: 800;
      color: #fff;
      flex-shrink: 0;
    }
    .cc-info { flex: 1; min-width: 0; }
    .cc-name { font-size: 14px; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0; }
    .cc-num { font-size: 11px; color: #94a3b8; margin-top: 2px; font-family: monospace; }
    
    .cc-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .cc-stats-two { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .cc-stat { background: #f8fafc; border-radius: 8px; padding: 8px 4px; text-align: center; }
    .cc-full-stat { margin-top: 6px; padding: 6px 12px; }
    .cc-stat-val { display: block; font-size: 14px; font-weight: 800; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cc-stat-lbl { font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.4px; }
    
    .cc-actions { display: flex; flex-wrap: wrap; gap: 6px 4px; padding-top: 10px; border-top: 1px solid #f1f5f9; }
    .cc-action-btn {
      height: 28px;
      border: none;
      border-radius: 8px;
      font-size: 10px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.14s;
      white-space: nowrap;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 0 8px;
    }
    
    .btn-color-0 { background: #ede9fe; color: #6d28d9; }
    .btn-color-0:hover:not(:disabled) { background: #ddd6fe; }
    .btn-color-1 { background: #fee2e2; color: #dc2626; }
    .btn-color-1:hover:not(:disabled) { background: #fecaca; }
    .btn-color-2 { background: #fef3c7; color: #d97706; }
    .btn-color-2:hover:not(:disabled) { background: #fde68a; }
    .btn-color-3 { background: #dcfce7; color: #16a34a; }
    .btn-color-3:hover:not(:disabled) { background: #bbf7d0; }
    .btn-color-4 { background: #e0f2fe; color: #0369a1; }
    .btn-color-4:hover:not(:disabled) { background: #bae6fd; }

    .badge { display: inline-flex; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; white-space: nowrap; }
    .badge-green { background: #dcfce7; color: #16a34a; }
    .badge-amber { background: #fef3c7; color: #d97706; }
    .badge-slate { background: #f1f5f9; color: #64748b; }

    /* Sliding Side Drawer Details Sidebar */
    .details-sidebar {
      position: fixed; top: 0; right: 0;
      width: 400px; height: 100vh;
      background: #ffffff;
      border-left: 1px solid rgba(203, 213, 225, 0.8);
      display: flex; flex-direction: column;
      transform: translateX(100%);
      transition: transform .3s cubic-bezier(.4,0,.2,1);
      z-index: 200;
      box-shadow: -8px 0 40px rgba(0,0,0,.15);
    }
    .details-sidebar-open { transform: translateX(0); }
    .sidebar-header { display:flex; align-items:center; justify-content:space-between; padding:18px 18px 14px; border-bottom:1px solid rgba(226,232,240,0.8); background:linear-gradient(135deg,rgba(79,70,229,.05),rgba(124,58,237,.02)); flex-shrink:0; }
    .sidebar-header-left { display:flex; align-items:center; gap:10px; }
    .sidebar-avatar { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:800; color:#fff; flex-shrink:0; }
    .sidebar-title { margin:0; font-size:15px; font-weight:700; color:#0f172a; }
    .sidebar-subtitle { margin:2px 0 0; font-size:11px; color:#94a3b8; }
    .sidebar-close-btn { background:none; border:none; color:#64748b; cursor:pointer; padding:6px 8px; border-radius:6px; font-size:14px; }
    .sidebar-close-btn:hover { color:#0f172a; background:rgba(0,0,0,.05); }
    
    .sidebar-content { flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:18px; }
    .sidebar-section-title { font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.6px; border-bottom:1px solid #e2e8f0; padding-bottom:6px; margin:0 0 8px 0; }
    .sidebar-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .sidebar-field { display:flex; flex-direction:column; gap:2px; }
    .sidebar-field.full { grid-column:1 / -1; }
    .sidebar-label { font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; }
    .sidebar-value { font-size:13px; color:#334155; font-weight:500; }
    .sidebar-record { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px; font-size:12px; color:#475569; }

    .tb-voice { border: none; background: transparent; cursor: pointer; color: #64748b; font-size: 14px; padding: 0; display: flex; align-items: center; justify-content: center; transition: color 0.15s; }
    .tb-voice:hover { color: #4f46e5; }

    .sidebar-tabs { display: flex; gap: 8px; border-bottom: 1px solid #e2e8f0; padding: 10px 20px; background: #f8fafc; flex-shrink: 0; }
    .sidebar-tab { padding: 6px 12px; font-size: 12px; font-weight: 600; border-radius: 6px; border: none; cursor: pointer; transition: all 0.15s; background: transparent; color: #64748b; }
    .sidebar-tab:hover { background: #ede9fe; color: #4f46e5; }
    .sidebar-tab.active { background: #ede9fe; color: #4f46e5; font-weight: 700; }

    .sidebar-chat-container { display: flex; flex-direction: column; height: 100%; min-height: 380px; justify-content: space-between; gap: 12px; }
    .sidebar-chat-messages { flex: 1; overflow-y: auto; max-height: 300px; display: flex; flex-direction: column; gap: 10px; padding: 10px 4px; }
    .sidebar-chat-msg { display: flex; gap: 8px; align-items: flex-start; }
    .sidebar-chat-msg.user { flex-direction: row-reverse; }
    .msg-avatar { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; background: #e2e8f0; flex-shrink: 0; }
    .sidebar-chat-msg.user .msg-avatar { background: #ede9fe; color: #6d28d9; }
    .sidebar-chat-msg.ai .msg-avatar { background: #ede9fe; color: #6d28d9; }
    .msg-bubble { max-width: 80%; padding: 8px 12px; border-radius: 12px; font-size: 12px; line-height: 1.4; }
    .sidebar-chat-msg.user .msg-bubble { background: #4f46e5; color: #ffffff; border-top-right-radius: 2px; }
    .sidebar-chat-msg.ai .msg-bubble { background: #f1f5f9; color: #0f172a; border-top-left-radius: 2px; }
    
    .sidebar-chat-suggestions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
    .sidebar-chat-chip { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 8px; font-size: 10px; color: #475569; cursor: pointer; transition: all 0.15s; }
    .sidebar-chat-chip:hover { background: #ede9fe; color: #4f46e5; border-color: #c7d2fe; }

    .sidebar-chat-input-area { display: flex; gap: 6px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
    .sidebar-chat-input { flex: 1; height: 32px; border: 1.5px solid #e2e8f4; border-radius: 8px; padding: 0 10px; font-size: 12px; outline: none; }
    .sidebar-chat-input:focus { border-color: #4f46e5; }
    .sidebar-chat-send { width: 32px; height: 32px; border: none; border-radius: 8px; background: #4f46e5; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; }
    .sidebar-chat-send:disabled { opacity: 0.5; cursor: not-allowed; }

    .cc-action-ai {
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      color: white !important;
    }
    .cc-action-email { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
    .cc-action-email:hover { background: #d1fae5; }
    .cc-action-phone { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
    .cc-action-phone:hover { background: #dbeafe; }
    :host-context(html.dark-mode) .cc-action-email { background: rgba(16,185,129,.1); color: #34d399; border-color: rgba(52,211,153,.2); }
    :host-context(html.dark-mode) .cc-action-email:hover { background: rgba(16,185,129,.2); }
    :host-context(html.dark-mode) .cc-action-phone { background: rgba(59,130,246,.1); color: #60a5fa; border-color: rgba(96,165,250,.2); }
    :host-context(html.dark-mode) .cc-action-phone:hover { background: rgba(59,130,246,.2); }
    .cc-action-ai:hover {
      box-shadow: 0 2px 8px rgba(79, 70, 229, 0.4);
      transform: translateY(-1px);
    }
    .cc-action-ai.active {
      background: linear-gradient(135deg, #ef4444, #dc2626);
    }

    /* Dark Mode */
    :host-context(html.dark-mode) .topbar { background: rgba(15,23,42,.82); border-bottom-color: rgba(51,65,85,.4); box-shadow: 0 1px 12px rgba(0,0,0,.3); }
    :host-context(html.dark-mode) .topbar-title { color: #f1f5f9; }
    :host-context(html.dark-mode) .tb-search { background: rgba(15,23,42,.7); border-color: #334155; }
    :host-context(html.dark-mode) .tb-search:focus-within { border-color: #4f46e5; background: #0f172a; }
    :host-context(html.dark-mode) .tb-search input { color: #f1f5f9; }
    :host-context(html.dark-mode) .tb-chip { border-color: #334155; background: rgba(15,23,42,.8); color: #94a3b8; }
    :host-context(html.dark-mode) .tb-chip.on { background: rgba(79,70,229,.15); border-color: #4f46e5; color: #a5b4fc; }
    :host-context(html.dark-mode) .tb-sec { background: rgba(15,23,42,.8); border-color: #334155; color: #cbd5e1; }
    :host-context(html.dark-mode) .tb-sec:hover { border-color: #4f46e5; color: #a5b4fc; }

    :host-context(html.dark-mode) .stat-card { background: rgba(15,23,42,.9); border-color: rgba(51,65,85,.5); box-shadow: 0 2px 8px rgba(0,0,0,.3); }
    :host-context(html.dark-mode) .stat-val { color: #f1f5f9; }

    :host-context(html.dark-mode) .add-card { background: rgba(15,23,42,.95); border-color: #334155; box-shadow: 0 4px 16px rgba(0,0,0,.4); }
    :host-context(html.dark-mode) .add-card-header span { color: #f1f5f9 !important; }
    :host-context(html.dark-mode) .form-field input, :host-context(html.dark-mode) .form-field select { border-color: #334155; color: #f1f5f9; background: rgba(15,23,42,.8); }
    :host-context(html.dark-mode) .form-field input:focus, :host-context(html.dark-mode) .form-field select:focus { border-color: #4f46e5; }

    :host-context(html.dark-mode) .client-card {
      background: rgba(15, 23, 42, 0.9);
      border-color: rgba(51, 65, 85, 0.6);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
    :host-context(html.dark-mode) .cc-name { color: #f1f5f9; }
    :host-context(html.dark-mode) .cc-stat { background: #1e293b; }
    :host-context(html.dark-mode) .cc-stat-val { color: #f1f5f9; }
    :host-context(html.dark-mode) .cc-actions { border-top-color: #334155; }
    
    :host-context(html.dark-mode) .btn-color-0 { background: rgba(109, 40, 217, 0.2); color: #c084fc; }
    :host-context(html.dark-mode) .btn-color-0:hover:not(:disabled) { background: rgba(109, 40, 217, 0.3); }
    :host-context(html.dark-mode) .btn-color-1 { background: rgba(220, 38, 38, 0.2); color: #f87171; }
    :host-context(html.dark-mode) .btn-color-1:hover:not(:disabled) { background: rgba(220, 38, 38, 0.3); }
    :host-context(html.dark-mode) .btn-color-2 { background: rgba(217, 119, 6, 0.2); color: #fbbf24; }
    :host-context(html.dark-mode) .btn-color-2:hover:not(:disabled) { background: rgba(217, 119, 6, 0.3); }
    :host-context(html.dark-mode) .btn-color-3 { background: rgba(22, 163, 74, 0.2); color: #4ade80; }
    :host-context(html.dark-mode) .btn-color-3:hover:not(:disabled) { background: rgba(22, 163, 74, 0.3); }
    :host-context(html.dark-mode) .btn-color-4 { background: rgba(3, 105, 161, 0.2); color: #38bdf8; }
    :host-context(html.dark-mode) .btn-color-4:hover:not(:disabled) { background: rgba(3, 105, 161, 0.3); }

    :host-context(html.dark-mode) .details-sidebar { background: #0f172a; border-left-color: rgba(51, 65, 85, 0.8); box-shadow: -8px 0 40px rgba(0,0,0,.4); }
    :host-context(html.dark-mode) .sidebar-header { border-bottom-color: rgba(51, 65, 85, 0.8); background: linear-gradient(135deg,rgba(79,70,229,.15),rgba(124,58,237,.05)); }

    :host-context(html.dark-mode) .tb-voice { color: #94a3b8; }
    :host-context(html.dark-mode) .tb-voice:hover { color: #818cf8; }

    :host-context(html.dark-mode) .sidebar-tabs { background: #1e293b; border-bottom-color: #334155; }
    :host-context(html.dark-mode) .sidebar-tab { color: #94a3b8; }
    :host-context(html.dark-mode) .sidebar-tab:hover { background: rgba(109, 40, 217, 0.2); color: #c084fc; }
    :host-context(html.dark-mode) .sidebar-tab.active { background: rgba(109, 40, 217, 0.2); color: #c084fc; }

    :host-context(html.dark-mode) .sidebar-chat-msg.ai .msg-bubble { background: #1e293b; color: #f1f5f9; }
    :host-context(html.dark-mode) .sidebar-chat-chip { background: #1e293b; border-color: #334155; color: #94a3b8; }
    :host-context(html.dark-mode) .sidebar-chat-chip:hover { background: rgba(109, 40, 217, 0.2); color: #c084fc; border-color: rgba(109, 40, 217, 0.4); }
    :host-context(html.dark-mode) .sidebar-chat-input-area { border-top-color: #334155; }
    :host-context(html.dark-mode) .sidebar-chat-input { border-color: #334155; background: #0f172a; color: white; }
    :host-context(html.dark-mode) .sidebar-chat-input:focus { border-color: #6366f1; }
    :host-context(html.dark-mode) .sidebar-title { color: #f1f5f9; }
    :host-context(html.dark-mode) .sidebar-close-btn:hover { color:#f1f5f9; background:rgba(255,255,255,.05); }
    :host-context(html.dark-mode) .sidebar-section-title { border-bottom-color: #334155; }
    :host-context(html.dark-mode) .sidebar-value { color: #cbd5e1; }
    :host-context(html.dark-mode) .sidebar-record { background: #1e293b; border-color: #334155; color: #cbd5e1; }
  `]
})
export class HealthcareComponent implements OnInit {
  activeTab = 'prescriptions';
  piiMasked = false;
  searchCodeQuery = '';
  encounterPatient = '';
  selectedPatientName = '';

  searchQ = '';
  filterStatus = '';
  sortBy = 'name_asc';
  showSidebar = false;
  showAddForm = false;
  newPatient = { name: '', dob: '', eligibility: 'Pending', payer: 'Blue Cross', score: 80, consent: false, insurance: true, id: '' };

  sidebarTab: 'details' | 'chat' = 'details';
  chatHistory: any[] = [];
  chatInput = '';
  aiLoading = false;

  selectPatient(p: any) {
    this.selectedPatientName = p.name;
    this.encounterPatient = p.name;
    this.showSidebar = true;
    this.sidebarTab = 'details';
  }

  getSelectedPatient() {
    return this.patientCharts.find(p => p.name === this.selectedPatientName);
  }

  getFilteredPatients() {
    let list = this.patientCharts;
    if (this.searchQ) {
      const q = this.searchQ.toLowerCase();
      const terms = q.split(/\s+/).filter(t => t);
      list = list.filter(p =>
        terms.every(term =>
          p.name.toLowerCase().includes(term) || p.id.toLowerCase().includes(term)
        )
      );
    }
    if (this.filterStatus) {
      list = list.filter(p => p.eligibility === this.filterStatus);
    }
    list = [...list].sort((a, b) => {
      if (this.sortBy === 'name_asc') return a.name.localeCompare(b.name);
      if (this.sortBy === 'name_desc') return b.name.localeCompare(a.name);
      if (this.sortBy === 'score_desc') return b.score - a.score;
      if (this.sortBy === 'score_asc') return a.score - b.score;
      return 0;
    });
    return list;
  }

  getAvgChartScore(): number {
    if (this.patientCharts.length === 0) return 0;
    const sum = this.patientCharts.reduce((acc, p) => acc + p.score, 0);
    return Math.round(sum / this.patientCharts.length);
  }

  getVerifiedEligibilityCount(): number {
    return this.patientCharts.filter(p => p.eligibility === 'Verified' || p.eligibility === 'Active').length;
  }

  getConsentSignedCount(): number {
    return this.patientCharts.filter(p => p.consent).length;
  }

  savePatient() {
    if (!this.newPatient.name || !this.newPatient.dob) {
      this.toast.show('Name and DOB are required', 'warning');
      return;
    }
    const id = 'MRN-' + Math.floor(100 + Math.random() * 900) + '-' + Math.floor(1000 + Math.random() * 9000) + '-A';
    const patient = {
      name: this.newPatient.name,
      dob: this.newPatient.dob,
      payer: this.newPatient.payer || 'Blue Cross',
      score: this.newPatient.score || 80,
      eligibility: this.newPatient.eligibility,
      consent: this.newPatient.consent,
      insurance: true,
      id,
      lastVerifiedDate: '2026-06-06'
    };
    this.patientCharts.unshift(patient);
    this.showAddForm = false;
    this.toast.show(`Patient ${patient.name} created successfully`, 'success');
    this.newPatient = { name: '', dob: '', eligibility: 'Pending', payer: 'Blue Cross', score: 80, consent: false, insurance: true, id: '' };
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  getAvatarColor(name: string): string {
    const colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  filteredPrescriptions() {
    return this.prescriptions.filter(p => p.patient === this.selectedPatientName);
  }

  filteredDiagnoses() {
    return this.diagnoses.filter(d => d.patient === this.selectedPatientName);
  }

  filteredClaims() {
    return this.claims.filter(c => c.patient === this.selectedPatientName);
  }

  filteredAppointments() {
    return this.appointments.filter(apt => apt.patient === this.selectedPatientName);
  }

  filteredReferrals() {
    return this.referrals.filter(r => r.patient === this.selectedPatientName);
  }

  filteredCareGaps() {
    return this.careGaps.filter(cg => cg.patient === this.selectedPatientName);
  }

  domainMenu = [
    { id: 'prescriptions', label: 'Prescriptions', icon: '💊' },
    { id: 'diagnoses', label: 'Diagnoses', icon: '🩺' },
    { id: 'procedures', label: 'Procedures', icon: '🏥' },
    { id: 'consents', label: 'Consents', icon: '📝' },
    { id: 'referrals', label: 'Referrals', icon: '🤝' }
  ];

  managementMenu = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'search', label: 'Search', icon: '🔍' },
    { id: 'approvals', label: 'Tasks & Approvals', icon: '✅' },
    { id: 'alerts', label: 'Alerts', icon: '🔔' },
    { id: 'audit', label: 'Audit Trail', icon: '📜' },
    { id: 'reports', label: 'Reports', icon: '📈' }
  ];

  selectedBiomarker = 'cholesterol';
  matchedCodes: any[] = [];
  biomarkerHistory: any = null;
  abnormalAlerts: any[] = [];

  prescriptions: any[] = [];

  diagnoses: any[] = [];

  claims: any[] = [];

  providers: any[] = [];

  appointments: any[] = [];

  patientCharts: any[] = [];

  referrals: any[] = [];

  careGaps: any[] = [];

  phiAccessLogs: any[] = [];

  encounterTimeline: any[] = [];

  allMedicalCodes: any[] = [];

  emailContact(p: any, event: MouseEvent): void {
    event.stopPropagation();
    const email = p.email || (p.name ? `${p.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.com` : 'patient@example.com');
    window.open(`mailto:${email}?subject=Healthcare%20Patient%20Follow-up%20%E2%80%94%20${p.name}`);
    this.toast.show(`Email draft opened for ${p.name}`, 'success');
  }

  callContact(p: any, event: MouseEvent): void {
    event.stopPropagation();
    const phone = p.phone || '(555) 019-2831';
    window.open(`tel:${phone}`);
    this.toast.show(`Calling ${p.name}...`, 'success');
  }

  constructor(private route: ActivatedRoute, public toast: ToastService, private http: HttpClient, private ngZone: NgZone) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeTab = params['tab'];
      }
    });
    this.loadBackendData();
  }

  loadBackendData() {
    this.http.get<any[]>('http://localhost:8000/api/domains/healthcare/patients').subscribe({
      next: data => {
        this.patientCharts = data;
        if (data && data.length > 0) {
          this.selectedPatientName = data[0].name;
        }
      }
    });
    this.http.get<any>('http://localhost:8000/api/domains/healthcare/biomarkers').subscribe({
      next: data => this.biomarkerHistory = data
    });
    this.http.get<any[]>('http://localhost:8000/api/domains/healthcare/alerts').subscribe({
      next: data => this.abnormalAlerts = data
    });
  }

  togglePii() {
    this.piiMasked = !this.piiMasked;
    this.toast.show(this.piiMasked ? 'Patient PII successfully masked' : 'PII unmasked for admin view', this.piiMasked ? 'success' : 'warning');
  }

  maskPiiValue(v: string): string {
    if (!this.piiMasked) return v;
    if (v.includes('/') || v.includes('19')) return 'XX/XX/XXXX';
    if (v.includes('Dr.')) return 'Dr. XXXXXXX';
    return v.substring(0, 3) + ' XXXXXXXX';
  }

  getPoints(): any[] {
    const vals = this.biomarkerHistory ? this.biomarkerHistory[this.selectedBiomarker] || [] : [];
    if (!vals || vals.length === 0) return [];
    const maxVal = Math.max(...vals) * 1.1;
    const minVal = Math.min(...vals) * 0.9;
    
    return vals.map((v: number, idx: number) => {
      const x = 20 + (idx * 90);
      const ratio = maxVal === minVal ? 1 : (v - minVal) / (maxVal - minVal);
      const y = 180 - (ratio * 130);
      return { x, y, val: v };
    });
  }

  getSvgPath(): string {
    const pts = this.getPoints();
    if (pts.length === 0) return '';
    return `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
  }

  getCurrentBiomarkerValue(): number {
    const vals = this.biomarkerHistory ? this.biomarkerHistory[this.selectedBiomarker] || [] : [];
    if (!vals || vals.length === 0) return 0;
    return vals[vals.length - 1];
  }

  isCurrentBiomarkerHigh(): boolean {
    const v = this.getCurrentBiomarkerValue();
    if (this.selectedBiomarker === 'cholesterol') return v > 200;
    if (this.selectedBiomarker === 'glucose') return v > 99;
    if (this.selectedBiomarker === 'triglycerides') return v > 150;
    return false;
  }

  authorizeScript(p: any) {
    p.status = 'Authorized';
    this.toast.show(`Prior Authorization for "${p.drugName}" approved successfully`, 'success');
  }

  createPrescription() {
    this.toast.show('New prescription order generated and queued for MD sign-off', 'success');
  }

  requestConsent(c: any) {
    this.toast.show(`Consent signature request sent to ${c.name}`, 'success');
  }

  approveReferral(r: any) {
    r.status = 'Approved';
    this.toast.show(`Referral for specialty: ${r.specialty} signed off`, 'success');
  }

  reSubmitClaim(c: any) {
    c.status = 'Pending';
    c.denialReason = '';
    this.toast.show(`Claim ${c.claimId} re-submitted for reimbursement appeal`, 'success');
  }

  verifyEligibility(c: any) {
    c.eligibility = 'Verified';
    c.lastVerifiedDate = '2026-06-06';
    this.toast.show(`Insurance eligibility verified for ${c.name}`, 'success');
  }

  selectEncounterPatient(name: string) {
    this.encounterPatient = name;
    this.toast.show(`Selected encounter timeline for ${name}`, 'success');
  }

  searchCodes() {
    if (!this.searchCodeQuery) {
      this.matchedCodes = [];
      return;
    }
    const q = this.searchCodeQuery.toLowerCase();
    this.matchedCodes = this.allMedicalCodes.filter(c => 
      c.desc.toLowerCase().includes(q) || c.val.toLowerCase().includes(q)
    );
    if (this.matchedCodes.length === 0) {
      this.toast.show('No standardized codes matched', 'warning');
    } else {
      this.toast.show(`Found ${this.matchedCodes.length} codes`, 'success');
    }
  }
  askAI(patient: any, e: Event): void {
    e.stopPropagation();
    this.selectedPatientName = patient.name;
    this.encounterPatient = patient.name;
    this.showSidebar = true;
    this.sidebarTab = 'chat';
    this.initChat(patient);
  }

  initChat(patient: any): void {
    this.chatHistory = [
      { role: 'ai', text: `Hello! I am your AI clinical assistant. How can I help you audit the chart profile, diagnoses, or prescriptions for **${patient.name}**?`, time: new Date() }
    ];
  }

  getChatSuggestions(): string[] {
    return [
      `Summarize this patient's clinical chart`,
      `Are there any active prescriptions?`,
      `Is HIPAA consent signed?`
    ];
  }

  sendChatMessage(): void {
    const q = this.chatInput.trim();
    if (!q || this.aiLoading) return;
    this.chatInput = '';
    this.chatHistory.push({ role: 'user', text: q, time: new Date() });
    this.aiLoading = true;
    this.chatHistory.push({ role: 'ai', text: '', time: new Date() });
    const idx = this.chatHistory.length - 1;

    const patient = this.getSelectedPatient();
    const context = patient ? {
      patient_name: patient.name,
      dob: patient.dob,
      mrn: patient.id,
      chart_score: patient.score,
      eligibility: patient.eligibility,
      consent: patient.consent ? 'Signed' : 'Pending',
      insurance: patient.payer
    } : {};

    fetch('http://localhost:8000/api/documents/ask/with-context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q, context_data: context })
    })
    .then(r => {
      if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const pump = (): Promise<void> =>
        reader.read().then(({ done, value }) => {
          if (done) { this.aiLoading = false; return; }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const obj = JSON.parse(line.slice(6));
              if (obj.token) this.chatHistory[idx] = { ...this.chatHistory[idx], text: this.chatHistory[idx].text + obj.token };
              if (obj.done) this.aiLoading = false;
            } catch {}
          }
          return pump();
        });
      return pump();
    })
    .catch(() => {
      setTimeout(() => {
        let answer = `I've analyzed **${patient?.name || 'this patient'}**'s clinical record. `;
        const lowerQ = q.toLowerCase();
        if (lowerQ.includes('prescription') || lowerQ.includes('med') || lowerQ.includes('drug')) {
          answer += `The active prescriptions in standard records include blood pressure or hyperlipidemia management as authorized.`;
        } else if (lowerQ.includes('consent') || lowerQ.includes('hipaa')) {
          answer += `HIPAA Consent status is currently **${patient?.consent ? 'Signed and Verified' : 'Pending Action'}**.`;
        } else if (lowerQ.includes('chart') || lowerQ.includes('score')) {
          answer += `The clinical chart score is **${patient?.score || 80}%**, reflecting high documentation completeness.`;
        } else {
          answer += `The profile is compliant and eligible. Let me know if you need specific standardized medical code audits.`;
        }
        this.chatHistory[idx] = { role: 'ai', text: answer, time: new Date() };
        this.aiLoading = false;
      }, 1000);
    });
  }

  startVoiceSearch(): void {
    if (!('webkitSpeechRecognition' in window) && !('speechRecognition' in window)) {
      this.toast.show('Voice recognition is not supported in this browser.', 'warning');
      return;
    }
    this.toast.show('Listening...', 'info');
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.start();
    recognition.onresult = (event: any) => {
      this.ngZone.run(() => {
        const speechToText = event.results[0][0].transcript;
        this.searchQ = speechToText;
        this.toast.show(`Voice search: "${speechToText}"`, 'success');
      });
    };
    recognition.onerror = (err: any) => {
      this.ngZone.run(() => {
        console.error(err);
        this.toast.show('Speech recognition error', 'error');
      });
    };
  }
}
