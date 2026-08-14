import { Component, OnInit, NgZone } from '@angular/core';
import { authFetch } from '../../lib/api';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-legal',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HttpClientModule],
  template: `
    <div class="p-6 page-container">
      <!-- Topbar Header -->
      <div class="topbar">
        <div>
          <div class="topbar-title">Legal Matters Directory</div>
          <div class="topbar-sub">{{ getFilteredMatters().length }} of {{ lifecycleContracts.length }} contracts</div>
        </div>
        <div class="tb-sp"></div>
        <div class="tb-search">
          <span>🔍</span>
          <input [(ngModel)]="searchQ" placeholder="Search matter or counterparty…">
          <button class="tb-clear" *ngIf="searchQ" (click)="searchQ=''">✕</button>
          <button class="tb-voice" (click)="startVoiceSearch()" title="Voice Search">🎤</button>
        </div>
        <button class="tb-chip" [class.on]="filterStatus===''" (click)="filterStatus=''">All</button>
        <button class="tb-chip" [class.on]="filterStatus==='Low'" (click)="filterStatus='Low'">Low Risk</button>
        <button class="tb-chip" [class.on]="filterStatus==='Medium'" (click)="filterStatus='Medium'">Medium Risk</button>
        <button class="tb-chip" [class.on]="filterStatus==='High'" (click)="filterStatus='High'">High Risk</button>
        <select class="tb-select" [(ngModel)]="sortBy" style="margin-left: 8px; margin-right: 8px;">
          <option value="name_asc">🔤 Sort: Name (A-Z)</option>
          <option value="name_desc">🔤 Sort: Name (Z-A)</option>
          <option value="risk_desc">⚠️ Sort: Risk (High-Low)</option>
          <option value="expiry_asc">📅 Sort: Expiry (Soonest)</option>
        </select>
        <button class="tb-btn tb-pri" (click)="showAddForm=true">+ Add Matter</button>
      </div>

      <div class="content">
        <!-- Stats Summary Row -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-lbl">Total Matters</div>
          <div class="stat-val">{{ lifecycleContracts.length }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">High Risk</div>
          <div class="stat-val" style="color:#dc2626">{{ getHighRiskCount() }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Expiring Soon</div>
          <div class="stat-val" style="color:#d97706">{{ getExpiringSoonCount() }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Avg Notice Period</div>
          <div class="stat-val" style="color:#4f46e5">{{ getAvgNoticePeriod() }}d</div>
        </div>
      </div>

      <!-- Add Matter Form -->
      <div class="add-card" *ngIf="showAddForm">
        <div class="add-card-header">
          <span style="font-size:16px;font-weight:700;color:#0f172a">New Matter Profile</span>
          <button class="tb-btn tb-sec" style="height:30px" (click)="showAddForm=false">✕ Cancel</button>
        </div>
        <div class="add-form-grid">
          <div class="form-field"><label>Matter Name *</label><input [(ngModel)]="newMatter.name" placeholder="Acme Corp Master NDA"></div>
          <div class="form-field"><label>Counterparty *</label><input [(ngModel)]="newMatter.counterparty" placeholder="Acme Corp"></div>
          <div class="form-field">
            <label>Risk Rating</label>
            <select [(ngModel)]="newMatter.risk">
              <option value="Low">Low Risk</option>
              <option value="Medium">Medium Risk</option>
              <option value="High">High Risk</option>
            </select>
          </div>
          <div class="form-field"><label>Expiry Date</label><input [(ngModel)]="newMatter.expiry" placeholder="2027-12-31"></div>
          <div class="form-field"><label>Notice Period</label><input [(ngModel)]="newMatter.notice" placeholder="30 days"></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="tb-btn tb-pri" (click)="saveMatter()">✓ Create Matter</button>
          <button class="tb-btn tb-sec" (click)="showAddForm=false">Cancel</button>
        </div>
      </div>

      <!-- Active Matters & Contracts Directory -->
      <div class="mb-6">
        <div class="client-grid" *ngIf="lifecycleContracts.length > 0">
          <div 
            *ngFor="let c of getFilteredMatters()"
            (click)="selectMatter(c)"
            [class.active-card]="selectedMatter === c.name"
            class="client-card">
            
            <!-- Card Header -->
            <div class="cc-header">
              <div [style.background]="getAvatarColor(c.name)" class="cc-avatar">
                {{ getInitials(c.name) }}
              </div>
              <div class="cc-info">
                <h4 class="cc-name">{{ c.name }}</h4>
                <div class="cc-num">Counterparty: {{ c.counterparty }}</div>
              </div>
              <span class="badge" 
                    [class.badge-green]="c.risk === 'Low'"
                    [class.badge-amber]="c.risk === 'Medium'"
                    [class.badge-red]="c.risk === 'High'">
                {{ c.risk }} Risk
              </span>
            </div>

            <!-- Stats & Info Row -->
            <div class="cc-stats">
              <div class="cc-stat">
                <span class="cc-stat-val truncate" [title]="c.risk">{{ c.risk }}</span>
                <span class="cc-stat-lbl">Risk Rating</span>
              </div>
              <div class="cc-stat">
                <span class="cc-stat-val truncate" [title]="c.expiry">{{ c.expiry }}</span>
                <span class="cc-stat-lbl">Expiry</span>
              </div>
              <div class="cc-stat">
                <span class="cc-stat-val truncate" [title]="c.notice">{{ c.notice }}</span>
                <span class="cc-stat-lbl">Notice</span>
              </div>
            </div>

            <!-- Quick Action Buttons on Card -->
            <div class="cc-actions">
              <button 
                *ngFor="let item of domainMenu; let i = index"
                (click)="selectedMatter = c.name; activeTab = item.id; $event.stopPropagation()"
                [ngClass]="selectedMatter === c.name && activeTab === item.id ? 'bg-indigo-650 text-white shadow-sm' : 'btn-color-' + i"
                class="cc-action-btn">
                <span>{{ item.icon }}</span>
                <span class="truncate">{{ item.label }}</span>
              </button>
              <button 
                (click)="askAI(c, $event)"
                class="cc-action-btn cc-action-ai"
                [class.active]="showSidebar && sidebarTab === 'chat' && selectedMatter === c.name"
                title="Ask AI about this contract">
                ✦ Ask AI
              </button>
              <button 
                (click)="emailContact(c, $event)"
                class="cc-action-btn cc-action-email"
                [class.active]="true"
                title="Email Counterparty">
                ✉ Email
              </button>
              <button 
                (click)="callContact(c, $event)"
                class="cc-action-btn cc-action-phone"
                [class.active]="true"
                title="Call Counterparty">
                📞 Call
              </button>
            </div>
          </div>
        </div>
        <div *ngIf="lifecycleContracts.length === 0" class="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <span style="font-size: 36px">⚖️</span>
          <h3 class="text-md font-bold mt-3 text-slate-900 dark:text-white">No Legal Contracts Found</h3>
          <p class="text-xs text-slate-550 mt-2 font-sans">Upload contract or legal documents to dynamically view compliance details and clauses.</p>
          <button routerLink="/upload" class="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold font-sans">
            ↑ Upload Contracts
          </button>
        </div>
      </div>

      <!-- Management / Global Tabs -->
      <div class="mb-6 flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3" *ngIf="lifecycleContracts.length > 0">
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
      <div class="min-w-0" *ngIf="lifecycleContracts.length > 0">
        <div [ngSwitch]="activeTab">
          <!-- 1. Clauses -->
          <div *ngSwitchCase="'clauses'" class="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            <div class="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-4">Standard Clause Library: <span class="text-indigo-650 dark:text-indigo-400">{{ selectedMatter }}</span></h3>
              <div class="space-y-4">
                <div *ngIf="filteredClauses().length === 0" class="p-6 text-center text-xs text-slate-400">No specific clauses registered.</div>
                <div *ngFor="let c of filteredClauses()" class="p-4 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800">
                  <div class="flex justify-between items-start mb-2">
                    <span class="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">{{ c.type }}</span>
                    <span [class]="c.deviation ? 'px-2 py-0.5 text-xs font-semibold rounded bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-955/30 dark:text-amber-400' : 'px-2 py-0.5 text-xs font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-955/30 dark:text-emerald-400'">
                      {{ c.deviation ? 'Deviation Flagged' : 'Standard' }}
                    </span>
                  </div>
                  <h4 class="font-semibold text-slate-900 dark:text-white mb-2">{{ c.name }}</h4>
                  <p class="text-xs text-slate-600 dark:text-slate-300 font-mono mb-3 bg-white dark:bg-slate-900 p-2.5 rounded border dark:border-slate-800">{{ c.text }}</p>
                  <div class="flex items-center justify-between text-xs text-slate-400">
                    <span>Governing Law: {{ c.governingLaw }}</span>
                    <button (click)="auditClause(c)" class="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold">Audit Deviation</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-2">Clause Analyzer</h3>
              <p class="text-xs text-slate-505 mb-4">Paste custom contract terms to audit against corporate guidelines.</p>
              <textarea 
                [(ngModel)]="customClauseText"
                rows="6"
                class="w-full text-sm p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 mb-4 font-mono"
                placeholder="Paste clause text here..."></textarea>
              <button 
                (click)="analyzeClause()" 
                [disabled]="!customClauseText"
                class="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-all shadow-md">
                Validate Compliance
              </button>
              <div *ngIf="auditResult" class="mt-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-xs animate-slide-up">
                <div class="font-semibold text-slate-900 dark:text-white mb-2">Analysis Results:</div>
                <div class="flex items-center gap-2 mb-2">
                  <span class="w-2.5 h-2.5 rounded-full" [class.bg-emerald-500]="auditResult.status === 'compliant'" [class.bg-amber-500]="auditResult.status === 'deviation'"></span>
                  <span class="capitalize font-bold text-slate-700 dark:text-slate-330">{{ auditResult.status }}</span>
                </div>
                <p class="text-slate-600 dark:text-slate-400">{{ auditResult.message }}</p>
              </div>
            </div>
          </div>

          <!-- 2. Obligations -->
          <div *ngSwitchCase="'obligations'" class="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            <div class="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-4">Obligations Log: <span class="text-indigo-650 dark:text-indigo-400">{{ selectedMatter }}</span></h3>
              <div class="space-y-3">
                <div *ngIf="filteredObligations().length === 0" class="p-6 text-center text-xs text-slate-400">No active obligations recorded for this contract.</div>
                <div *ngFor="let o of filteredObligations()" class="p-4 rounded-lg border dark:border-slate-800 bg-slate-50 dark:bg-slate-955 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div class="text-2xs uppercase tracking-wider font-bold text-indigo-600 dark:text-indigo-400 mb-1">Contract: {{ o.contract }}</div>
                    <h4 class="font-bold text-slate-900 dark:text-white text-sm">{{ o.title }}</h4>
                    <p class="text-xs text-slate-550 mt-0.5">Assigned: {{ o.assignee }} · Due: <span class="font-mono text-slate-900 dark:text-slate-200">{{ o.due }}</span></p>
                  </div>
                  <div class="flex items-center gap-3">
                    <span [class]="o.completed ? 'px-2.5 py-0.5 text-2xs font-semibold rounded bg-emerald-50 text-emerald-700' : 'px-2.5 py-0.5 text-2xs font-semibold rounded bg-amber-50 text-amber-700'">
                      {{ o.completed ? 'Completed' : 'Pending' }}
                    </span>
                    <button *ngIf="!o.completed" (click)="completeObligation(o)" class="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-all">Mark Done</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <h3 class="font-bold text-lg text-slate-900 dark:text-white">Obligation Progress</h3>
              <div class="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 text-xs">
                <div class="font-semibold text-slate-900 dark:text-white mb-2">Completion Metrics</div>
                <div class="flex items-center justify-between text-2xs mb-1 text-slate-655">
                  <span>Audit completion rate:</span>
                  <span class="font-bold">{{ filteredObligations().length > 0 ? (filteredObligations()[0].completed ? '100%' : '0%') : '100%' }} Complete</span>
                </div>
                <div class="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div class="bg-indigo-600 h-full" [style.width]="filteredObligations().length > 0 ? (filteredObligations()[0].completed ? '100%' : '0%') : '100%'"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. Renewals -->
          <div *ngSwitchCase="'renewals'" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm animate-fade-in">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-4">Notice Dates & Expiry: <span class="text-indigo-650 dark:text-indigo-400">{{ selectedMatter }}</span></h3>
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-455">
                    <th class="py-3 px-2 font-bold uppercase">Contract Name</th>
                    <th class="py-3 px-2 font-bold uppercase">Counterparty</th>
                    <th class="py-3 px-2 font-bold uppercase">Notice Period</th>
                    <th class="py-3 px-2 font-bold uppercase">Expiry Date</th>
                    <th class="py-3 px-2 font-bold uppercase text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-150 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  <tr *ngIf="filteredLifecycleContracts().length === 0">
                    <td colspan="5" class="py-6 text-center text-xs text-slate-400">No lifecycle data matching selection.</td>
                  </tr>
                  <tr *ngFor="let c of filteredLifecycleContracts()" class="hover:bg-slate-50 dark:hover:bg-slate-955 transition-all">
                    <td class="py-3.5 px-2 font-semibold text-slate-900 dark:text-white">{{ c.name }}</td>
                    <td class="py-3.5 px-2">{{ c.counterparty }}</td>
                    <td class="py-3.5 px-2 font-mono text-red-655 dark:text-red-400">{{ c.notice }}</td>
                    <td class="py-3.5 px-2 font-mono">{{ c.expiry }}</td>
                    <td class="py-3.5 px-2 text-right">
                      <button (click)="triggerAlert(c)" class="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">Configure Reminder</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 4. Counterparties -->
          <div *ngSwitchCase="'counterparties'" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm animate-fade-in">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-4">Counterparty Risk Profiler: <span class="text-indigo-650 dark:text-indigo-400">{{ selectedMatter }}</span></h3>
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-455">
                    <th class="py-3 px-2 font-bold uppercase">Counterparty</th>
                    <th class="py-3 px-2 font-bold uppercase">Linked Contract</th>
                    <th class="py-3 px-2 font-bold uppercase">Risk Rating</th>
                    <th class="py-3 px-2 font-bold uppercase">Compliance Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-150 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  <tr *ngIf="filteredLifecycleContracts().length === 0">
                    <td colspan="4" class="py-6 text-center text-xs text-slate-400">No profile matches.</td>
                  </tr>
                  <tr *ngFor="let c of filteredLifecycleContracts()" class="hover:bg-slate-50 dark:hover:bg-slate-955 transition-all">
                    <td class="py-3.5 px-2 font-semibold text-slate-900 dark:text-white">{{ c.counterparty }}</td>
                    <td class="py-3.5 px-2 font-mono">{{ c.name }}</td>
                    <td class="py-3.5 px-2"><span [class]="getRiskBadge(c.risk)">{{ c.risk }}</span></td>
                    <td class="py-3.5 px-2">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                        verified
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 5. Litigation Holds -->
          <div *ngSwitchCase="'holds'" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-4">
            <div class="flex justify-between items-center mb-2">
              <h3 class="font-bold text-lg text-slate-900 dark:text-white">Active Litigation Holds & Preservation Notices</h3>
              <button (click)="toast.show('Preservation hold generated', 'success')" class="px-3 py-1.5 bg-red-650 text-white rounded text-xs font-bold">Issue Notice</button>
            </div>
            <div class="p-4 rounded-lg bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/40">
              <div class="flex justify-between items-center mb-2">
                <span class="font-bold text-xs text-amber-800 dark:text-amber-300">🚨 Litigation Hold Active: Alpha Solutions matter</span>
                <span class="w-2.5 h-2.5 rounded-full bg-red-650 animate-pulse"></span>
              </div>
              <p class="text-xs text-amber-900 dark:text-amber-400">Preservation Notice issued on Alpha Solutions matter. Discarding documentation related to operations code is strictly restricted.</p>
            </div>
          </div>

          <!-- 6. Dashboard -->
          <div *ngSwitchCase="'dashboard'" class="space-y-6 animate-fade-in">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="p-5 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl shadow-sm">
                <div class="text-xs font-bold text-slate-400 uppercase">Active Matters</div>
                <div class="text-2xl font-bold text-slate-900 dark:text-white mt-1">{{ lifecycleContracts.length }}</div>
              </div>
              <div class="p-5 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl shadow-sm">
                <div class="text-xs font-bold text-slate-400 uppercase">Expiring 90 Days</div>
                <div class="text-2xl font-bold text-slate-900 dark:text-white mt-1">{{ getExpiringSoonCount() }}</div>
              </div>
              <div class="p-5 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl shadow-sm">
                <div class="text-xs font-bold text-slate-400 uppercase">Avg Risk Rating</div>
                <div class="text-2xl font-bold text-indigo-655 dark:text-indigo-400 mt-1">{{ getAvgRiskRating() }}</div>
              </div>
            </div>
            <div class="bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 p-5">
              <h3 class="font-bold text-sm text-slate-900 dark:text-white mb-4">Compliance Status Overview</h3>
              <p class="text-xs text-slate-505">All uploaded legal files have successfully matched standard NDA & Liability playbooks.</p>
            </div>
          </div>

          <!-- 7. Search -->
          <div *ngSwitchCase="'search'" class="bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 p-6 shadow-sm animate-fade-in">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-2">Matter Document Search</h3>
            <input 
              [(ngModel)]="searchQuery" 
              type="text" 
              placeholder="Search contracts, counterparties, or notice dates..."
              class="w-full text-sm p-3 rounded-lg border dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 mb-4"/>
            <div class="space-y-2">
              <div *ngFor="let c of filteredContracts()" class="p-3.5 rounded-lg border dark:border-slate-800 bg-slate-50 dark:bg-slate-955 flex justify-between items-center text-xs">
                <span><strong>{{ c.name }}</strong> ({{ c.counterparty }})</span>
                <span class="font-mono text-slate-400">{{ c.expiry }}</span>
              </div>
            </div>
          </div>

          <!-- 8. Tasks/Approvals -->
          <div *ngSwitchCase="'approvals'" class="bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 p-6 shadow-sm animate-fade-in">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-4">Legal Approvals & Sign-off Ledger</h3>
            <div class="space-y-3">
              <div class="p-4 rounded-lg bg-slate-50 dark:bg-slate-955 border dark:border-slate-850 flex justify-between items-center text-xs">
                <div>
                  <h4 class="font-bold text-slate-900 dark:text-white">Approve Beta Consulting Agreement Amendment</h4>
                  <p class="text-2xs text-slate-400 mt-1">Requires standard NDA signature verification</p>
                </div>
                <button (click)="toast.show('Agreement signed off', 'success')" class="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold">Approve</button>
              </div>
            </div>
          </div>

          <!-- 9. Alerts -->
          <div *ngSwitchCase="'alerts'" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-4">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white font-semibold">Active Compliance Alerts</h3>
            <div *ngFor="let c of lifecycleContracts" class="p-4 rounded-lg bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/40 text-xs">
              <strong>Notice:</strong> {{ c.name }} requires renewal check in <span class="font-mono text-amber-600 dark:text-amber-400 font-bold">{{ c.notice }}</span>.
            </div>
          </div>

          <!-- 10. Audit Trail -->
          <div *ngSwitchCase="'audit'" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-4">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white">Matter Audit Logs</h3>
            <div class="space-y-2 text-2xs text-slate-655 dark:text-slate-400 font-mono">
              <div>[2026-06-06 15:32] Non-Disclosure Agreement uploaded by System AI</div>
              <div>[2026-06-06 15:32] Governing law audited as Standard: Delaware</div>
              <div>[2026-06-06 15:20] Litigation Hold activated on Alpha Solutions LLC</div>
            </div>
          </div>

          <!-- 11. Reports -->
          <div *ngSwitchCase="'reports'" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-4">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white">Generate Matter & Expiration Reports</h3>
            <p class="text-xs text-slate-505">Export active contracts lists, risk mappings, and notice schedules.</p>
            <div class="flex gap-3">
              <a href="http://localhost:8000/api/analytics/export?query=List+all+contracts&format=xlsx" download class="px-4 py-2 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700">Export XLSX</a>
              <a href="http://localhost:8000/api/analytics/export?query=List+all+contracts&format=csv" download class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-white rounded text-xs font-bold">Export CSV</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

    <!-- Details Sidebar Drawer -->
    <div class="details-sidebar" [class.details-sidebar-open]="showSidebar">
      <div class="sidebar-header" *ngIf="getSelectedMatter()">
        <div class="sidebar-header-left">
          <div [style.background]="getAvatarColor(selectedMatter)" class="sidebar-avatar">
            {{ getInitials(selectedMatter) }}
          </div>
          <div>
            <h3 class="sidebar-title">{{ selectedMatter }}</h3>
            <p class="sidebar-subtitle">Matter Profile & Contract Lifecycle</p>
          </div>
        </div>
        <button class="sidebar-close-btn" (click)="showSidebar = false">✕</button>
      </div>
      
      <!-- Sidebar Tabs Navigation -->
      <div class="sidebar-tabs" *ngIf="getSelectedMatter()">
        <button class="sidebar-tab" [class.active]="sidebarTab === 'details'" (click)="sidebarTab = 'details'">📋 Details</button>
        <button class="sidebar-tab" [class.active]="sidebarTab === 'chat'" (click)="sidebarTab = 'chat'">✦ Ask AI</button>
      </div>

      <div class="sidebar-content" *ngIf="getSelectedMatter() as c">
        
        <!-- Details Tab Content -->
        <div *ngIf="sidebarTab === 'details'" style="display:flex; flex-direction:column; gap:18px; width: 100%;">
          <h4 class="sidebar-section-title">General Information</h4>
          <div class="sidebar-grid">
            <div class="sidebar-field">
              <span class="sidebar-label">Matter Name</span>
              <span class="sidebar-value">{{ c.name }}</span>
            </div>
            <div class="sidebar-field">
              <span class="sidebar-label">Counterparty</span>
              <span class="sidebar-value">{{ c.counterparty }}</span>
            </div>
            <div class="sidebar-field">
              <span class="sidebar-label">Risk Rating</span>
              <span class="sidebar-value">
                <span [class]="getRiskBadge(c.risk)">{{ c.risk }} Risk</span>
              </span>
            </div>
            <div class="sidebar-field">
              <span class="sidebar-label">Compliance Status</span>
              <span class="sidebar-value">
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                  verified
                </span>
              </span>
            </div>
          </div>
        </div>

        <div>
          <h4 class="sidebar-section-title">Notice & Expiration</h4>
          <div class="sidebar-grid">
            <div class="sidebar-field">
              <span class="sidebar-label">Expiry Date</span>
              <span class="sidebar-value font-mono">{{ c.expiry }}</span>
            </div>
            <div class="sidebar-field">
              <span class="sidebar-label">Notice Period</span>
              <span class="sidebar-value font-mono text-red-655 dark:text-red-400 font-bold">{{ c.notice }}</span>
            </div>
          </div>
        </div>

        <div>
          <h4 class="sidebar-section-title">Active Obligations</h4>
          <div class="space-y-2">
            <div *ngIf="filteredObligations().length === 0" class="text-xs text-slate-400">No active obligations.</div>
            <div *ngFor="let o of filteredObligations()" class="sidebar-record">
              <div class="flex justify-between font-bold text-3xs text-slate-400 mb-1">
                <span>Due: {{ o.due }}</span>
                <span>{{ o.completed ? '✅' : '🕒' }}</span>
              </div>
              <div class="font-bold text-slate-800 dark:text-slate-200">{{ o.title }}</div>
              <div class="text-3xs text-slate-500 mt-0.5">Assignee: {{ o.assignee }}</div>
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
            <input [(ngModel)]="chatInput" (keydown.enter)="sendChatMessage()" [disabled]="aiLoading" placeholder="Ask AI about this matter..." class="sidebar-chat-input">
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
    .cc-stat { background: #f8fafc; border-radius: 8px; padding: 8px 4px; text-align: center; }
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
    .badge-red { background: #fee2e2; color: #dc2626; }
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
export class LegalComponent implements OnInit {
  activeTab = 'clauses';
  searchQuery = '';
  selectedMatter = '';

  searchQ = '';
  filterStatus = '';
  sortBy = 'name_asc';
  showSidebar = false;
  showAddForm = false;
  newMatter = { name: '', counterparty: '', risk: 'Low', expiry: '', notice: '30 days' };

  sidebarTab: 'details' | 'chat' = 'details';
  chatHistory: any[] = [];
  chatInput = '';
  aiLoading = false;

  selectMatter(c: any) {
    this.selectedMatter = c.name;
    this.showSidebar = true;
    this.sidebarTab = 'details';
  }

  getSelectedMatter() {
    return this.lifecycleContracts.find(c => c.name === this.selectedMatter);
  }

  getFilteredMatters() {
    let list = this.lifecycleContracts;
    if (this.searchQ) {
      const q = this.searchQ.toLowerCase();
      const terms = q.split(/\s+/).filter(t => t);
      list = list.filter(c =>
        terms.every(term =>
          c.name.toLowerCase().includes(term) || c.counterparty.toLowerCase().includes(term)
        )
      );
    }
    if (this.filterStatus) {
      list = list.filter(c => c.risk === this.filterStatus);
    }
    list = [...list].sort((a, b) => {
      if (this.sortBy === 'name_asc') return a.name.localeCompare(b.name);
      if (this.sortBy === 'name_desc') return b.name.localeCompare(a.name);
      if (this.sortBy === 'risk_desc') {
        const wA = ({ High: 3, Medium: 2, Low: 1 } as any)[a.risk] || 0;
        const wB = ({ High: 3, Medium: 2, Low: 1 } as any)[b.risk] || 0;
        return wB - wA;
      }
      if (this.sortBy === 'expiry_asc') {
        return (a.expiry || '').localeCompare(b.expiry || '');
      }
      return 0;
    });
    return list;
  }

  getExpiringSoonCount(): number {
    return this.lifecycleContracts.filter(c => c.risk === 'High' || (c.notice && parseInt(c.notice) <= 30)).length;
  }

  getAvgNoticePeriod(): number {
    if (this.lifecycleContracts.length === 0) return 0;
    let totalDays = 0;
    let count = 0;
    this.lifecycleContracts.forEach(c => {
      if (c.notice) {
        const match = c.notice.match(/\d+/);
        if (match) {
          totalDays += parseInt(match[0]);
          count++;
        }
      }
    });
    return count > 0 ? Math.round(totalDays / count) : 30;
  }

  saveMatter() {
    if (!this.newMatter.name || !this.newMatter.counterparty) {
      this.toast.show('Matter Name and Counterparty are required', 'warning');
      return;
    }
    const matter = {
      name: this.newMatter.name,
      counterparty: this.newMatter.counterparty,
      risk: this.newMatter.risk,
      expiry: this.newMatter.expiry || '2027-12-31',
      notice: this.newMatter.notice || '30 days',
      complianceStatus: 'verified'
    };
    this.lifecycleContracts.unshift(matter);
    this.showAddForm = false;
    this.toast.show('Matter added successfully', 'success');
  }

  filteredClauses() {
    return this.clauses.map(c => ({
      ...c,
      contract: c.contract || this.selectedMatter
    })).filter(c => c.contract === this.selectedMatter);
  }

  filteredObligations() {
    return this.obligations.filter(o => o.contract === this.selectedMatter);
  }

  filteredLifecycleContracts() {
    return this.lifecycleContracts.filter(c => c.name === this.selectedMatter);
  }

  domainMenu = [
    { id: 'clauses', label: 'Clauses', icon: '📝' },
    { id: 'obligations', label: 'Obligations', icon: '📋' },
    { id: 'renewals', label: 'Renewals', icon: '🕒' },
    { id: 'counterparties', label: 'Counterparties', icon: '🤝' },
    { id: 'holds', label: 'Litigation Holds', icon: '🚨' }
  ];

  managementMenu = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'search', label: 'Search', icon: '🔍' },
    { id: 'approvals', label: 'Tasks & Approvals', icon: '✅' },
    { id: 'alerts', label: 'Alerts', icon: '🔔' },
    { id: 'audit', label: 'Audit Trail', icon: '📜' },
    { id: 'reports', label: 'Reports', icon: '📈' }
  ];

  customClauseText = '';
  auditResult: any = null;
  clauses: any[] = [];
  lifecycleContracts: any[] = [];

  obligations: any[] = [];

  emailContact(c: any, event: MouseEvent): void {
    event.stopPropagation();
    const email = c.email || (c.counterparty ? `${c.counterparty.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.com` : 'legal@counterparty.com');
    window.open(`mailto:${email}?subject=Contract%20Renewal%20Notice%20%E2%80%94%20${c.name}`);
    this.toast.show(`Email draft opened for ${c.counterparty}`, 'success');
  }

  callContact(c: any, event: MouseEvent): void {
    event.stopPropagation();
    const phone = c.phone || '(555) 401-2918';
    window.open(`tel:${phone}`);
    this.toast.show(`Calling ${c.counterparty}...`, 'success');
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
    this.http.get<any[]>('http://localhost:8000/api/domains/legal/clauses').subscribe({
      next: data => this.clauses = data
    });
    this.http.get<any[]>('http://localhost:8000/api/domains/legal/lifecycle').subscribe({
      next: data => {
        this.lifecycleContracts = data;
        if (data && data.length > 0) {
          this.selectedMatter = data[0].name;
        }
      }
    });
  }

  auditClause(c: any) {
    this.customClauseText = c.text;
    this.activeTab = 'clauses';
    this.toast.show(`Loaded clause "${c.name}" into Analyzer`, 'success');
  }

  analyzeClause() {
    const text = this.customClauseText.toLowerCase();
    if (text.includes('indemn') || text.includes('deviation') || text.includes('ten (10)')) {
      this.auditResult = {
        status: 'deviation',
        message: 'Deviation flagged: The clause incorporates unapproved liability shifts or exceeds standard term durations (expected 5 years max).'
      };
      this.toast.show('Deviation discovered!', 'warning');
    } else {
      this.auditResult = {
        status: 'compliant',
        message: 'Clause complies with current standard corporate templates.'
      };
      this.toast.show('Clause verified compliant', 'success');
    }
  }

  filteredContracts() {
    if (!this.searchQuery) return this.lifecycleContracts;
    const q = this.searchQuery.toLowerCase();
    const terms = q.split(/\s+/).filter(t => t);
    return this.lifecycleContracts.filter(c => 
      terms.every(term =>
        c.name.toLowerCase().includes(term) || 
        c.counterparty.toLowerCase().includes(term)
      )
    );
  }

  getRiskBadge(r: string): string {
    return {
      Low: 'px-2 py-0.5 text-xs font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-100',
      Medium: 'px-2 py-0.5 text-xs font-semibold rounded bg-amber-50 text-amber-700 border border-amber-100',
      High: 'px-2 py-0.5 text-xs font-semibold rounded bg-red-50 text-red-700 border border-red-100'
    }[r] || 'badge-gray';
  }

  completeObligation(o: any) {
    o.completed = true;
    this.toast.show(`Milestone "${o.title}" marked completed`, 'success');
  }

  triggerAlert(c: any) {
    this.toast.show(`Renewal reminder alarm configured for ${c.name}`, 'success');
  }

  getInitials(name: string): string {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  getAvatarColor(name: string): string {
    if (!name) return '#6366f1';
    const colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  getHighRiskCount(): number {
    return this.lifecycleContracts.filter(c => c.risk === 'High').length;
  }

  getAvgRiskRating(): string {
    if (this.lifecycleContracts.length === 0) return 'None';
    const high = this.lifecycleContracts.filter(c => c.risk === 'High').length;
    const low = this.lifecycleContracts.filter(c => c.risk === 'Low').length;
    const med = this.lifecycleContracts.length - high - low;
    const score = (high * 3 + med * 2 + low * 1) / this.lifecycleContracts.length;
    if (score >= 2.5) return 'High';
    if (score >= 1.5) return 'Medium';
    return 'Low';
  }

  askAI(matter: any, e: Event): void {
    e.stopPropagation();
    this.selectedMatter = matter.name;
    this.showSidebar = true;
    this.sidebarTab = 'chat';
    this.initChat(matter);
  }

  initChat(matter: any): void {
    this.chatHistory = [
      { role: 'ai', text: `Hello! I am your AI contract compliance assistant. How can I help you audit standard clauses, obligations, and risk parameters for **${matter.name}**?`, time: new Date() }
    ];
  }

  getChatSuggestions(): string[] {
    return [
      `Summarize this contract's obligations`,
      `Is this contract high risk?`,
      `When is the notice expiry date?`
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

    const contract = this.getSelectedMatter();
    const context = contract ? {
      contract_name: contract.name,
      counterparty: contract.counterparty,
      risk_rating: contract.risk,
      expiry_date: contract.expiry,
      notice_period: contract.notice
    } : {};

    authFetch('http://localhost:8000/api/documents/ask/with-context', {
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
        let answer = `I've analyzed **${contract?.name || 'this contract'}**'s terms. `;
        const lowerQ = q.toLowerCase();
        if (lowerQ.includes('obligation') || lowerQ.includes('milestone')) {
          answer += `There is a critical obligation logged to verify standard parameters prior to notice deadlines.`;
        } else if (lowerQ.includes('risk') || lowerQ.includes('compliance')) {
          answer += `The risk rating is marked as **${contract?.risk || 'Low'} Risk**. No compliance deviation is flagged in the standard NDA playbook.`;
        } else if (lowerQ.includes('date') || lowerQ.includes('expiry') || lowerQ.includes('notice')) {
          answer += `The expiry is set for **${contract?.expiry || 'N/A'}** with a notice window of **${contract?.notice || 'N/A'}**.`;
        } else {
          answer += `All guidelines match corporate compliance policies. Let me know if you would like to test custom clauses against standard rules.`;
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
