import { DomainDocumentsComponent } from '../../components/domain-documents/domain-documents.component';
import { Component, OnInit, NgZone } from '@angular/core';
import { authFetch } from '../../lib/api';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-real-estate',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DomainDocumentsComponent],
  template: `
    <div class="p-6 page-container">
      <!-- Topbar Header -->
      <div class="topbar">
        <div>
          <div class="topbar-title">Property Directory</div>
          <div class="topbar-sub">{{ getFilteredProperties().length }} of {{ properties.length }} properties</div>
        </div>
        <div class="tb-sp"></div>
        <div class="tb-search">
          <span>🔍</span>
          <input [(ngModel)]="searchQ" placeholder="Search address or buyer…">
          <button class="tb-clear" *ngIf="searchQ" (click)="searchQ=''">✕</button>
          <button class="tb-voice" (click)="startVoiceSearch()" title="Voice Search">🎤</button>
        </div>
        <button class="tb-chip" [class.on]="filterStatus===''" (click)="filterStatus=''">All</button>
        <button class="tb-chip" [class.on]="filterStatus==='Funded'" (click)="filterStatus='Funded'">Escrow Funded</button>
        <button class="tb-chip" [class.on]="filterStatus==='Pending'" (click)="filterStatus='Pending'">Escrow Pending</button>
        <select class="tb-select" [(ngModel)]="sortBy" style="margin-left: 8px; margin-right: 8px;">
          <option value="address_asc">🔤 Sort: Address (A-Z)</option>
          <option value="address_desc">🔤 Sort: Address (Z-A)</option>
          <option value="price_desc">💰 Sort: Price (High-Low)</option>
          <option value="price_asc">💰 Sort: Price (Low-High)</option>
          <option value="progress_desc">📈 Sort: Progress (High-Low)</option>
        </select>
        <button class="tb-btn tb-pri" (click)="showAddForm=true">+ Add Property</button>
      </div>

      <div class="content">
        <!-- Stats Summary Row -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-lbl">Properties</div>
          <div class="stat-val">{{ properties.length }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Portfolio Value</div>
          <div class="stat-val" style="color:#4f46e5">{{ formatCurrency(getTotalPortfolioValue()) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Active Escrows</div>
          <div class="stat-val" style="color:#16a34a">{{ getActiveEscrowsCount() }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Title Exceptions</div>
          <div class="stat-val" style="color:#dc2626">{{ getTitleExceptionsCount() }}</div>
        </div>
      </div>

      <!-- Add Property Form -->
      <div class="add-card" *ngIf="showAddForm">
        <div class="add-card-header">
          <span style="font-size:16px;font-weight:700;color:#0f172a">New Property Profile</span>
          <button class="tb-btn tb-sec" style="height:30px" (click)="showAddForm=false">✕ Cancel</button>
        </div>
        <div class="add-form-grid">
          <div class="form-field"><label>Property Address *</label><input [(ngModel)]="newProperty.address" placeholder="123 Main St, Seattle"></div>
          <div class="form-field"><label>Buyer Name *</label><input [(ngModel)]="newProperty.buyer" placeholder="Johnathan Doe"></div>
          <div class="form-field"><label>Purchase Price ($)</label><input [(ngModel)]="newProperty.price" type="number" placeholder="500000"></div>
          <div class="form-field"><label>Closing Progress (%)</label><input [(ngModel)]="newProperty.progress" type="number" placeholder="10"></div>
          <div class="form-field">
            <label>Escrow Status</label>
            <select [(ngModel)]="newProperty.escrow">
              <option [ngValue]="true">Funded</option>
              <option [ngValue]="false">Pending</option>
            </select>
          </div>
          <div class="form-field">
            <label>Appraisal Status</label>
            <select [(ngModel)]="newProperty.appraisal">
              <option [ngValue]="true">Verified</option>
              <option [ngValue]="false">Pending</option>
            </select>
          </div>
          <div class="form-field">
            <label>Title Status</label>
            <select [(ngModel)]="newProperty.title">
              <option [ngValue]="true">Clear</option>
              <option [ngValue]="false">Exception Flagged</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="tb-btn tb-pri" (click)="saveProperty()">✓ Create Property</button>
          <button class="tb-btn tb-sec" (click)="showAddForm=false">Cancel</button>
        </div>
      </div>

      <!-- Active Property Directory -->
      <div class="mb-6">
        <div class="client-grid" *ngIf="properties.length > 0">
          <div 
            *ngFor="let p of getFilteredProperties()"
            (click)="selectProperty(p)"
            [class.active-card]="selectedPropertyAddress === p.address"
            class="client-card">
            
            <!-- Card Header -->
            <div class="cc-header">
              <div [style.background]="getAvatarColor(p.address)" class="cc-avatar">
                {{ getInitials(p.address) }}
              </div>
              <div class="cc-info">
                <h4 class="cc-name">{{ p.address }}</h4>
                <div class="cc-num">Buyer: {{ p.buyer }}</div>
              </div>
              <span class="badge" 
                    [class.badge-green]="p.escrow"
                    [class.badge-amber]="!p.escrow">
                {{ p.escrow ? 'Escrow Funded' : 'Escrow Pending' }}
              </span>
            </div>

            <!-- Stats & Info Row -->
            <div class="cc-stats">
              <div class="cc-stat">
                <span class="cc-stat-val truncate" [title]="formatCurrency(p.price)">{{ formatCurrency(p.price) }}</span>
                <span class="cc-stat-lbl">Price</span>
              </div>
              <div class="cc-stat">
                <span class="cc-stat-val truncate" [title]="p.progress + '%'">{{ p.progress }}%</span>
                <span class="cc-stat-lbl">Closing Prog</span>
              </div>
              <div class="cc-stat">
                <span class="cc-stat-val truncate" [title]="p.title ? 'Clear' : 'Lien Flag'">{{ p.title ? 'Clear' : 'Lien Flag' }}</span>
                <span class="cc-stat-lbl">Title</span>
              </div>
            </div>

            <!-- Quick Action Buttons on Card -->
            <div class="cc-actions">
              <button 
                *ngFor="let item of domainMenu; let i = index"
                (click)="selectedPropertyAddress = p.address; activeTab = item.id; $event.stopPropagation()"
                [ngClass]="selectedPropertyAddress === p.address && activeTab === item.id ? 'bg-indigo-650 text-white shadow-sm' : 'btn-color-' + i"
                class="cc-action-btn">
                <span>{{ item.icon }}</span>
                <span class="truncate">{{ item.label }}</span>
              </button>
              <button 
                (click)="askAI(p, $event)"
                class="cc-action-btn cc-action-ai"
                [class.active]="showSidebar && sidebarTab === 'chat' && selectedPropertyAddress === p.address"
                title="Ask AI about this property">
                ✦ Ask AI
              </button>
              <button 
                (click)="emailContact(p, $event)"
                class="cc-action-btn cc-action-email"
                [class.active]="true"
                title="Email Buyer">
                ✉ Email
              </button>
              <button 
                (click)="callContact(p, $event)"
                class="cc-action-btn cc-action-phone"
                [class.active]="true"
                title="Call Buyer">
                📞 Call
              </button>
            </div>
          </div>
        </div>
        <div *ngIf="properties.length === 0 && domainDocCount === 0" class="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <span style="font-size: 36px">🏠</span>
          <h3 class="text-md font-bold mt-3 text-slate-900 dark:text-white">No Properties Found</h3>
          <p class="text-xs text-slate-550 mt-2 font-sans">Upload title deeds, lease agreements, or appraisal documents to dynamically view property details.</p>
          <button routerLink="/upload" class="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold font-sans">
            ↑ Upload Property Docs
          </button>
        </div>
      </div>

      <!-- Management / Global Tabs -->
      <div class="mb-6 flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
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
      <app-domain-documents domain="real-estate" [tab]="activeTab" (count)="domainDocCount = $event"></app-domain-documents>

      <div class="min-w-0">
        <div [ngSwitch]="activeTab">
          <!-- 1. Leases: Escalations, Rent Roll & Tenant Portal Log -->
          <div *ngSwitchCase="'leases'" class="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            <!-- Rent Roll & Vacancy Analytics -->
            <div class="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-6">
              <div>
                <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-3">Rent Roll & Vacancy Analytics</h3>
                <div class="overflow-x-auto">
                  <table class="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                        <th class="py-2.5 px-2 font-bold uppercase">Suite / Room</th>
                        <th class="py-2.5 px-2 font-bold uppercase">Tenant</th>
                        <th class="py-2.5 px-2 font-bold uppercase text-right">Rent</th>
                        <th class="py-2.5 px-2 font-bold uppercase">Escalation</th>
                        <th class="py-2.5 px-2 font-bold uppercase">Next Renewal</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-150 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                      <tr *ngFor="let rr of rentRoll" class="hover:bg-slate-50 dark:hover:bg-slate-955 transition-all">
                        <td class="py-3 px-2 font-semibold text-slate-900 dark:text-white">{{ rr.suite }}</td>
                        <td class="py-3 px-2">{{ rr.tenant }}</td>
                        <td class="py-3 px-2 text-right font-mono">{{ formatCurrency(rr.rent) }}</td>
                        <td class="py-3 px-2 font-mono text-emerald-600 font-bold">+{{ rr.escalation }}%</td>
                        <td class="py-3 px-2 font-mono font-bold" [class.text-red-550]="rr.daysLeft < 30">{{ rr.renewalDate }} ({{ rr.daysLeft }}d)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Tenant communication Log -->
              <div class="border-t border-slate-200 dark:border-slate-800 pt-6">
                <h3 class="font-bold text-md text-slate-900 dark:text-white mb-3">Tenant Communication Log</h3>
                <div class="space-y-3 max-h-60 overflow-y-auto bg-slate-50 dark:bg-slate-955 p-4 rounded-lg border dark:border-slate-850">
                  <div *ngFor="let msg of tenantLogs" class="text-xs">
                    <div class="flex justify-between items-center text-3xs text-slate-400 mb-1">
                      <span><strong>{{ msg.sender }}</strong> to {{ msg.receiver }}</span>
                      <span class="font-mono">{{ msg.timestamp }}</span>
                    </div>
                    <p class="text-slate-700 dark:text-slate-350 bg-white dark:bg-slate-900 p-2.5 rounded border dark:border-slate-800 font-mono">{{ msg.text }}</p>
                  </div>
                </div>
                <!-- Quick message sender -->
                <div class="flex gap-2 mt-3">
                  <input 
                    [(ngModel)]="newTenantMsg"
                    type="text"
                    placeholder="Send message to tenant portal..."
                    class="flex-1 text-xs p-2.5 rounded border dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none"/>
                  <button (click)="sendTenantMessage()" class="px-4 py-2 bg-indigo-650 text-white text-xs font-bold rounded">Send</button>
                </div>
              </div>
            </div>

            <!-- Rent Calculator -->
            <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-2">Rent Escalation Calculator</h3>
              <div class="space-y-4 text-xs">
                <div>
                  <label class="block text-slate-550 mb-1">Base Monthly Rent</label>
                  <input [(ngModel)]="baseRent" type="number" class="w-full text-sm p-3 rounded-lg border dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"/>
                </div>
                <div>
                  <label class="block text-slate-550 mb-1">Annual Escalation Rate (%)</label>
                  <input [(ngModel)]="inflationRate" type="number" class="w-full text-sm p-3 rounded-lg border dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"/>
                </div>
                <button (click)="calculateEscalation()" class="w-full py-2.5 bg-indigo-650 text-white font-medium text-sm rounded-lg hover:bg-indigo-700 transition-all shadow-md">Compute Projections</button>
              </div>
            </div>
          </div>

          <!-- 2. Closings & Checklist with Missing Item Alerts -->
          <div *ngSwitchCase="'closing'" class="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            <div class="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-4">Property Closings & Closing Checklist</h3>
              <div class="space-y-4">
                <div *ngFor="let p of properties" class="p-4 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800">
                  <div class="flex justify-between items-center mb-3">
                    <div>
                      <h4 class="font-bold text-slate-900 dark:text-white text-sm">{{ p.address }}</h4>
                      <p class="text-2xs text-slate-500">Buyer: {{ p.buyer }} · Price: {{ formatCurrency(p.price) }}</p>
                    </div>
                    <div class="text-right">
                      <span class="text-sm font-bold text-indigo-650 dark:text-indigo-400">{{ p.progress }}%</span>
                      <p class="text-3xs text-slate-400">Closing Progress</p>
                    </div>
                  </div>
                  <div class="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mb-3">
                    <div class="bg-indigo-650 h-full" [style.width.%]="p.progress"></div>
                  </div>
                  <div class="flex flex-wrap gap-2 text-3xs font-semibold">
                    <span class="px-2 py-0.5 rounded border" [class.bg-emerald-50]="p.appraisal" [class.text-emerald-700]="p.appraisal" [class.border-emerald-200]="p.appraisal"
                      [class.bg-red-50]="!p.appraisal" [class.text-red-700]="!p.appraisal" [class.border-red-200]="!p.appraisal">
                      {{ p.appraisal ? 'Appraisal Verified' : 'Appraisal Missing' }}
                    </span>
                    <span class="px-2 py-0.5 rounded border" [class.bg-emerald-50]="p.title" [class.text-emerald-700]="p.title" [class.border-emerald-200]="p.title"
                      [class.bg-red-50]="!p.title" [class.text-red-700]="!p.title" [class.border-red-200]="!p.title">
                      {{ p.title ? 'Title Clear' : 'Lien Exception Flagged' }}
                    </span>
                    <span class="px-2 py-0.5 rounded border" [class.bg-emerald-50]="p.escrow" [class.text-emerald-700]="p.escrow" [class.border-emerald-200]="p.escrow"
                      [class.bg-red-50]="!p.escrow" [class.text-red-700]="!p.escrow" [class.border-red-200]="!p.escrow">
                      {{ p.escrow ? 'Escrow Funded' : 'Escrow Pending' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Closing Checklist with missing item alert -->
            <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <h3 class="font-bold text-lg text-slate-900 dark:text-white">Closing Checklist Exceptions</h3>
              <div class="space-y-3">
                <div *ngFor="let m of milestones" class="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-955 text-xs flex justify-between items-center">
                  <div>
                    <h4 class="font-bold text-slate-900 dark:text-white">{{ m.name }}</h4>
                    <p class="text-2xs text-slate-400">Due: {{ m.due }}</p>
                  </div>
                  <button 
                    *ngIf="!m.done" 
                    (click)="completeMilestone(m)"
                    class="px-2.5 py-1 text-3xs font-semibold bg-indigo-650 text-white rounded hover:bg-indigo-700 transition-all">
                    Sign Off
                  </button>
                  <span *ngIf="m.done" class="text-3xs text-emerald-600 font-bold uppercase">Completed</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. Inspections & Issue Tracker -->
          <div *ngSwitchCase="'inspections'" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-6">
            <div>
              <h3 class="font-bold text-lg text-slate-900 dark:text-white font-semibold">Property Inspections Checklist</h3>
              <div class="space-y-3">
                <div *ngFor="let insp of inspections" class="p-4 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 flex justify-between items-center gap-4">
                  <div>
                    <h4 class="font-semibold text-slate-900 dark:text-white text-sm">{{ insp.property }}</h4>
                    <p class="text-xs text-slate-550 mt-0.5">Inspection Type: {{ insp.type }} · Inspector: {{ insp.inspector }}</p>
                    <p class="text-2xs text-slate-400 mt-1">Date Scheduled: {{ insp.date }}</p>
                  </div>
                  <div class="flex items-center gap-3">
                    <span [class]="insp.status === 'Passed' ? 'px-2.5 py-0.5 text-2xs font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/20' : 'px-2.5 py-0.5 text-2xs font-semibold rounded bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-955/20'">
                      {{ insp.status }}
                    </span>
                    <button *ngIf="insp.status !== 'Passed'" (click)="passInspection(insp)" class="px-2.5 py-1 bg-indigo-655 text-white text-3xs rounded font-bold">Pass Audit</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Maintenance & issue tracker -->
            <div class="border-t border-slate-200 dark:border-slate-800 pt-6">
              <h3 class="font-bold text-md text-slate-900 dark:text-white mb-4 font-semibold">Maintenance & Inspection Issue Tracker</h3>
              <div class="space-y-3 text-xs">
                <div *ngFor="let ticket of maintenanceTickets" class="p-4 rounded-lg bg-slate-50 dark:bg-slate-955 border dark:border-slate-850 flex justify-between items-center gap-4">
                  <div>
                    <span class="text-3xs uppercase font-bold px-2 py-0.5 rounded mr-2" [class.bg-red-100]="ticket.priority === 'High'" [class.bg-amber-100]="ticket.priority === 'Medium'" [class.text-red-800]="ticket.priority === 'High'" [class.text-amber-800]="ticket.priority === 'Medium'">
                      {{ ticket.priority }} Priority
                    </span>
                    <strong class="text-slate-900 dark:text-white text-sm block mt-1">{{ ticket.issue }}</strong>
                    <p class="text-slate-500 mt-0.5">Asset: {{ ticket.property }} · Submitter: {{ ticket.tenant }}</p>
                  </div>
                  <button *ngIf="ticket.status !== 'Resolved'" (click)="ticket.status = 'Resolved'; toast.show('Maintenance ticket closed', 'success')" class="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold">Resolve Issue</button>
                  <span *ngIf="ticket.status === 'Resolved'" class="text-3xs text-emerald-600 font-bold uppercase">Resolved</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 4. Escrow & Accounting Summary -->
          <div *ngSwitchCase="'escrow'" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-6">
            <!-- Property level Accounting summary -->
            <div>
              <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-4 font-semibold">Property-Level Accounting Summary</h3>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                <div *ngFor="let ac of accountingSummaries" class="p-4 rounded bg-slate-50 dark:bg-slate-955 border dark:border-slate-850">
                  <strong class="text-slate-900 dark:text-white font-bold block mb-1 text-sm font-sans">{{ ac.property }}</strong>
                  <span class="block text-slate-400">Gross Income: {{ formatCurrency(ac.grossIncome) }}</span>
                  <span class="block text-slate-400">Net Operating: <strong class="text-emerald-600">{{ formatCurrency(ac.netIncome) }}</strong></span>
                  <span class="block text-slate-400">Cap Rate: <strong class="text-indigo-650">{{ ac.capRate }}%</strong></span>
                </div>
              </div>
            </div>

            <!-- Escrow holdings -->
            <div class="border-t border-slate-200 dark:border-slate-800 pt-6">
              <h3 class="font-bold text-md text-slate-900 dark:text-white mb-3 font-semibold">Escrow Deposit Ledger</h3>
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-455">
                      <th class="py-3 px-2 font-bold uppercase">Property Address</th>
                      <th class="py-3 px-2 font-bold uppercase text-right">Escrow Required</th>
                      <th class="py-3 px-2 font-bold uppercase text-right">Funded Amount</th>
                      <th class="py-3 px-2 font-bold uppercase text-center">Status</th>
                      <th class="py-3 px-2 font-bold uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-150 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    <tr *ngFor="let p of properties" class="hover:bg-slate-50 dark:hover:bg-slate-950 transition-all">
                      <td class="py-3.5 px-2 font-semibold text-slate-900 dark:text-white">{{ p.address }}</td>
                      <td class="py-3.5 px-2 text-right font-mono">{{ formatCurrency(p.price * 0.1) }}</td>
                      <td class="py-3.5 px-2 text-right font-mono">{{ formatCurrency(p.escrow ? (p.price * 0.1) : 0) }}</td>
                      <td class="py-3.5 px-2 text-center">
                        <span [class]="p.escrow ? 'px-2 py-0.5 rounded text-3xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100' : 'px-2 py-0.5 rounded text-3xs font-semibold bg-amber-50 text-amber-700 border border-amber-100'">
                          {{ p.escrow ? 'Escrow Fully Funded' : 'Awaiting Wire' }}
                        </span>
                      </td>
                      <td class="py-3.5 px-2 text-right">
                        <button *ngIf="!p.escrow" (click)="fundEscrow(p)" class="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">Confirm Wire</button>
                        <span *ngIf="p.escrow" class="text-slate-400 text-2xs font-mono font-bold">Release Ready</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- 5. Ownership: Deeds & Depreciation -->
          <div *ngSwitchCase="'ownership'" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-6">
            <div>
              <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-3">Property Ownership Registry & Deed Checks</h3>
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-455">
                      <th class="py-3 px-2 font-bold uppercase">Asset Address</th>
                      <th class="py-3 px-2 font-bold uppercase">Deed Owner</th>
                      <th class="py-3 px-2 font-bold uppercase">Lien Status</th>
                      <th class="py-3 px-2 font-bold uppercase">Ownership Match</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-150 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    <tr *ngFor="let p of properties" class="hover:bg-slate-50 dark:hover:bg-slate-955 transition-all">
                      <td class="py-3.5 px-2 font-semibold text-slate-900 dark:text-white">{{ p.address }}</td>
                      <td class="py-3.5 px-2 font-semibold">{{ p.buyer }}</td>
                      <td class="py-3.5 px-2">
                        <span [class]="p.title ? 'text-emerald-600 font-bold' : 'text-red-550 font-bold'">
                          {{ p.title ? 'Title Clear' : 'HOA Assessment Lien' }}
                        </span>
                      </td>
                      <td class="py-3.5 px-2 font-mono">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                          100% Match
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Depreciation & tax reporting -->
            <div class="border-t border-slate-200 dark:border-slate-800 pt-6">
              <h3 class="font-bold text-md text-slate-900 dark:text-white mb-4 font-semibold">Straight-Line Depreciation & Tax Schedules</h3>
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-455">
                      <th class="py-3 px-2 font-bold uppercase">Asset Location</th>
                      <th class="py-3 px-2 font-bold uppercase text-right">Depreciable Basis</th>
                      <th class="py-3 px-2 font-bold uppercase text-right">Annual Deduction</th>
                      <th class="py-3 px-2 font-bold uppercase text-right">Accumulated Depr.</th>
                      <th class="py-3 px-2 font-bold uppercase text-right">Remaining Value</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-150 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    <tr *ngFor="let dep of depreciationSchedules" class="hover:bg-slate-50 dark:hover:bg-slate-950 transition-all font-mono">
                      <td class="py-3.5 px-2 font-semibold text-slate-900 dark:text-white font-sans text-xs">{{ dep.property }}</td>
                      <td class="py-3.5 px-2 text-right">{{ formatCurrency(dep.basis) }}</td>
                      <td class="py-3.5 px-2 text-right text-emerald-600 font-bold">{{ formatCurrency(dep.annual) }}</td>
                      <td class="py-3.5 px-2 text-right">{{ formatCurrency(dep.accumulated) }}</td>
                      <td class="py-3.5 px-2 text-right font-bold">{{ formatCurrency(dep.basis - dep.accumulated) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- 6. Dashboard: Critical Date Calendar -->
          <div *ngSwitchCase="'dashboard'" class="space-y-6 animate-fade-in">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="p-5 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl shadow-sm">
                <div class="text-xs font-bold text-slate-400 uppercase">Properties Under Escrow</div>
                <div class="text-2xl font-bold text-slate-900 dark:text-white mt-1">{{ getActiveEscrowsCount() }}</div>
              </div>
              <div class="p-5 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl shadow-sm">
                <div class="text-xs font-bold text-slate-400 uppercase">Total Portfolio Value</div>
                <div class="text-2xl font-bold text-slate-900 dark:text-white mt-1">{{ formatCurrency(getTotalPortfolioValue()) }}</div>
              </div>
              <div class="p-5 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl shadow-sm">
                <div class="text-xs font-bold text-slate-400 uppercase">Lien Exceptions</div>
                <div class="text-2xl font-bold text-red-550 dark:text-red-400 mt-1">{{ getTitleExceptionsCount() }} Active</div>
              </div>
            </div>

            <!-- Critical date calendar list -->
            <div class="bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 p-5">
              <h3 class="font-bold text-md text-slate-900 dark:text-white mb-4">Critical Date Calendar</h3>
              <div class="space-y-3 font-mono text-xs">
                <div *ngFor="let event of criticalDates" class="p-3.5 rounded border dark:border-slate-850 flex justify-between items-center" [class.border-red-200]="event.daysLeft < 15" [class.bg-red-50]="event.daysLeft < 15">
                  <div>
                    <span class="text-3xs text-slate-400 block">{{ event.date }} ({{ event.daysLeft }} days left)</span>
                    <strong class="text-slate-900 dark:text-white font-sans font-bold text-xs">{{ event.title }}</strong>
                  </div>
                  <span class="px-2 py-0.5 rounded text-3xs font-sans font-bold" [class.bg-red-100]="event.type === 'Expiry'" [class.bg-amber-100]="event.type === 'Closing'" [class.text-red-800]="event.type === 'Expiry'" [class.text-amber-800]="event.type === 'Closing'">
                    {{ event.type }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 7. Search -->
          <div *ngSwitchCase="'search'" class="bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 p-6 shadow-sm animate-fade-in">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-2">Properties & Escrow Search</h3>
            <input 
              [(ngModel)]="searchQuery" 
              type="text" 
              placeholder="Search properties, buyers, addresses..."
              class="w-full text-sm p-3 rounded-lg border dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 mb-4"/>
            <div class="space-y-2">
              <div *ngFor="let p of filteredProperties()" class="p-3.5 rounded-lg border dark:border-slate-800 bg-slate-50 dark:bg-slate-955 flex justify-between items-center text-xs">
                <span><strong>{{ p.address }}</strong> (Buyer: {{ p.buyer }})</span>
                <span class="font-mono text-indigo-650 font-semibold">{{ formatCurrency(p.price) }}</span>
              </div>
            </div>
          </div>

          <!-- 8. Tasks/Approvals -->
          <div *ngSwitchCase="'approvals'" class="bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 p-6 shadow-sm animate-fade-in">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-4 font-semibold">Real Estate Milestone Sign-offs</h3>
            <div class="space-y-3">
              <div *ngFor="let m of milestones" class="p-4 rounded-lg bg-slate-50 dark:bg-slate-955 border dark:border-slate-800 flex justify-between items-center text-xs">
                <div *ngIf="!m.done">
                  <h4 class="font-bold text-slate-900 dark:text-white">Approve Milestone: {{ m.name }}</h4>
                  <p class="text-2xs text-slate-400 mt-1">Due Date: {{ m.due }}</p>
                </div>
                <button *ngIf="!m.done" (click)="completeMilestone(m)" class="px-3 py-1.5 bg-indigo-650 text-white rounded text-xs font-bold">Approve</button>
              </div>
            </div>
          </div>

          <!-- 9. Alerts -->
          <div *ngSwitchCase="'alerts'" class="bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-4">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white">Lien & Title Exception Checklist</h3>
            <div class="p-3.5 rounded-lg border border-red-200 dark:border-red-955 bg-red-50/50 dark:bg-red-955/10 text-xs">
              <span class="font-bold text-red-800 dark:text-red-400">🚨 HOA Assessment Lien Identified</span>
              <p class="text-3xs text-slate-500 dark:text-slate-400 mt-1">Seattle HQ apartment 3B has an active HOA unpaid assessment balance of $1,200. Clear before closing date.</p>
            </div>
          </div>

          <!-- 10. Audit Trail -->
          <div *ngSwitchCase="'audit'" class="bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-4">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white">Property Closings & Deeds Audit Logs</h3>
            <div class="space-y-2 text-2xs text-slate-655 dark:text-slate-400 font-mono">
              <div>[2026-06-06 15:55] Real Estate property escrow wire verification initiated</div>
              <div>[2026-06-06 15:52] Closing checklist verified: Seattle HQ Apartment 3B appraisal received</div>
              <div>[2026-06-06 15:30] Escrow Deposit of $68,500.00 confirmed funded</div>
            </div>
          </div>

          <!-- 11. Reports -->
          <div *ngSwitchCase="'reports'" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-4">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white font-semibold">Generate Property Closing & Valuation Reports</h3>
            <p class="text-xs text-slate-505">Export comparable properties (comps), outstanding lien logs, closing milestones, and deed rosters.</p>
            <div class="flex gap-3">
              <a href="http://localhost:8000/api/analytics/export?query=List+all+properties&format=xlsx" download class="px-4 py-2 bg-indigo-650 text-white rounded text-xs font-bold hover:bg-indigo-700">Export XLSX</a>
              <a href="http://localhost:8000/api/analytics/export?query=List+all+properties&format=csv" download class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-white rounded text-xs font-bold">Export CSV</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

    <!-- Details Sidebar Drawer -->
    <div class="details-sidebar" [class.details-sidebar-open]="showSidebar">
      <div class="sidebar-header" *ngIf="getSelectedProperty()">
        <div class="sidebar-header-left">
          <div [style.background]="getAvatarColor(selectedPropertyAddress)" class="sidebar-avatar">
            {{ getInitials(selectedPropertyAddress) }}
          </div>
          <div>
            <h3 class="sidebar-title truncate" style="max-width: 280px;">{{ selectedPropertyAddress }}</h3>
            <p class="sidebar-subtitle">Property Details & Escrow Status</p>
          </div>
        </div>
        <button class="sidebar-close-btn" (click)="showSidebar = false">✕</button>
      </div>

      <!-- Sidebar Tabs Navigation -->
      <div class="sidebar-tabs" *ngIf="getSelectedProperty()">
        <button class="sidebar-tab" [class.active]="sidebarTab === 'details'" (click)="sidebarTab = 'details'">📋 Details</button>
        <button class="sidebar-tab" [class.active]="sidebarTab === 'chat'" (click)="sidebarTab = 'chat'">✦ Ask AI</button>
      </div>

      <div class="sidebar-content" *ngIf="getSelectedProperty() as p">
        
        <!-- Details Tab Content -->
        <div *ngIf="sidebarTab === 'details'" style="display:flex; flex-direction:column; gap:18px; width: 100%;">
          <div>
            <h4 class="sidebar-section-title">General Information</h4>
            <div class="sidebar-grid">
              <div class="sidebar-field full">
                <span class="sidebar-label">Address</span>
                <span class="sidebar-value">{{ p.address }}</span>
              </div>
              <div class="sidebar-field">
                <span class="sidebar-label">Buyer</span>
                <span class="sidebar-value">{{ p.buyer }}</span>
              </div>
              <div class="sidebar-field">
                <span class="sidebar-label">Purchase Price</span>
                <span class="sidebar-value font-bold text-indigo-650">{{ formatCurrency(p.price) }}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 class="sidebar-section-title">Closing Status</h4>
            <div class="sidebar-grid">
              <div class="sidebar-field">
                <span class="sidebar-label">Closing Progress</span>
                <span class="sidebar-value font-bold text-indigo-600">{{ p.progress }}%</span>
              </div>
              <div class="sidebar-field">
                <span class="sidebar-label">Escrow Funded</span>
                <span class="sidebar-value">
                  <span class="badge" [class.badge-green]="p.escrow" [class.badge-amber]="!p.escrow">
                    {{ p.escrow ? 'Funded' : 'Pending' }}
                  </span>
                </span>
              </div>
              <div class="sidebar-field">
                <span class="sidebar-label">Appraisal Verified</span>
                <span class="sidebar-value">{{ p.appraisal ? '✓ Verified' : '⚠️ Missing' }}</span>
              </div>
              <div class="sidebar-field">
                <span class="sidebar-label">Title Status</span>
                <span class="sidebar-value">{{ p.title ? '✓ Clear' : '⚠️ Exception Flagged' }}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 class="sidebar-section-title">Maintenance Tickets</h4>
            <div class="space-y-2">
              <div *ngIf="maintenanceTickets.length === 0" class="text-xs text-slate-400">No active maintenance tickets.</div>
              <div *ngFor="let ticket of maintenanceTickets" class="sidebar-record">
                <div class="flex justify-between font-bold text-3xs text-slate-455 mb-1">
                  <span>Priority: {{ ticket.priority }}</span>
                  <span>{{ ticket.status }}</span>
                </div>
                <div class="font-bold text-slate-800 dark:text-slate-200">{{ ticket.issue }}</div>
                <div class="text-3xs text-slate-500 mt-0.5">Tenant: {{ ticket.tenant }}</div>
              </div>
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
            <input [(ngModel)]="chatInput" (keydown.enter)="sendChatMessage()" [disabled]="aiLoading" placeholder="Ask AI about this property..." class="sidebar-chat-input">
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

    .tb-voice { background: none; border: none; cursor: pointer; font-size: 14px; margin-left: 4px; padding: 2px; }
    .sidebar-tabs { display: flex; border-bottom: 1px solid #e2e8f0; background: #f8fafc; padding: 0 8px; }
    .sidebar-tab { flex: 1; padding: 10px 0; text-align: center; border: none; background: none; font-size: 12px; font-weight: 600; color: #64748b; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; }
    .sidebar-tab:hover { color: #4f46e5; background: rgba(79, 70, 229, 0.04); }
    .sidebar-tab.active { color: #4f46e5; border-bottom-color: #4f46e5; }
    
    .sidebar-chat-container { display: flex; flex-direction: column; height: 100%; min-height: 380px; justify-content: space-between; }
    .sidebar-chat-messages { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px; max-height: 340px; }
    .sidebar-chat-msg { display: flex; gap: 8px; align-items: flex-start; }
    .sidebar-chat-msg.user { flex-direction: row-reverse; }
    .msg-avatar { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; background: #e2e8f0; }
    .sidebar-chat-msg.ai .msg-avatar { background: #eef2ff; color: #4f46e5; font-weight: bold; }
    .msg-bubble { max-width: 80%; padding: 8px 12px; border-radius: 12px; font-size: 12.5px; line-height: 1.4; }
    .sidebar-chat-msg.user .msg-bubble { background: #4f46e5; color: white; border-top-right-radius: 2px; }
    .sidebar-chat-msg.ai .msg-bubble { background: #f1f5f9; color: #1e293b; border-top-left-radius: 2px; }
    
    .sidebar-chat-suggestions { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 12px; border-top: 1px solid #f1f5f9; }
    .sidebar-chat-chip { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 4px 10px; font-size: 11px; color: #64748b; cursor: pointer; text-align: left; transition: all 0.15s; }
    .sidebar-chat-chip:hover { background: #eef2ff; border-color: #c7d2fe; color: #4f46e5; }
    
    .sidebar-chat-input-area { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #e2e8f0; background: white; align-items: center; }
    .sidebar-chat-input { flex: 1; height: 36px; border: 1.5px solid #e2e8f4; border-radius: 8px; padding: 0 12px; font-size: 12.5px; outline: none; }
    .sidebar-chat-input:focus { border-color: #4f46e5; }
    .sidebar-chat-send { width: 36px; height: 36px; border-radius: 8px; background: #4f46e5; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; }
    .sidebar-chat-send:disabled { background: #cbd5e1; cursor: not-allowed; }
    
    .caip-typing { display: inline-flex; align-items: center; gap: 3px; height: 12px; }
    .caip-typing span { width: 4px; height: 4px; background: #94a3b8; border-radius: 50%; animation: caip-bounce 1.4s infinite ease-in-out both; }
    .caip-typing span:nth-child(1) { animation-delay: -0.32s; }
    .caip-typing span:nth-child(2) { animation-delay: -0.16s; }
    @keyframes caip-bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1.0); } }

    .cc-action-ai {
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      color: white !important;
    }
    .cc-action-email { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
    .cc-action-email:hover { background: #d1fae5; }
    .cc-action-phone { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
    .cc-action-phone:hover { background: #dbeafe; }
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
    :host-context(html.dark-mode) .cc-action-email { background: rgba(16,185,129,.1); color: #34d399; border-color: rgba(52,211,153,.2); }
    :host-context(html.dark-mode) .cc-action-email:hover { background: rgba(16,185,129,.2); }
    :host-context(html.dark-mode) .cc-action-phone { background: rgba(59,130,246,.1); color: #60a5fa; border-color: rgba(96,165,250,.2); }
    :host-context(html.dark-mode) .cc-action-phone:hover { background: rgba(59,130,246,.2); }

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
    :host-context(html.dark-mode) .sidebar-chat-input-area { border-top-color: #334155; background: #0f172a; }
    :host-context(html.dark-mode) .sidebar-chat-input { border-color: #334155; background: #0f172a; color: white; }
    :host-context(html.dark-mode) .sidebar-chat-input:focus { border-color: #6366f1; }
    :host-context(html.dark-mode) .sidebar-title { color: #f1f5f9; }
    :host-context(html.dark-mode) .sidebar-close-btn:hover { color:#f1f5f9; background:rgba(255,255,255,.05); }
    :host-context(html.dark-mode) .sidebar-section-title { border-bottom-color: #334155; }
    :host-context(html.dark-mode) .sidebar-value { color: #cbd5e1; }
    :host-context(html.dark-mode) .sidebar-record { background: #1e293b; border-color: #334155; color: #cbd5e1; }
  `]
})
export class RealEstateComponent implements OnInit {
  activeTab = 'leases';
  domainDocCount = 0;
  searchQuery = '';
  newTenantMsg = '';

  searchQ = '';
  filterStatus = '';
  sortBy = 'address_asc';
  showSidebar = false;
  showAddForm = false;
  newProperty = { address: '', buyer: '', price: 500000, progress: 10, escrow: false, appraisal: true, title: true };

  sidebarTab: 'details' | 'chat' = 'details';
  chatHistory: any[] = [];
  chatInput = '';
  aiLoading = false;

  domainMenu = [
    { id: 'leases', label: 'Leases', icon: '📝' },
    { id: 'closing', label: 'Closings', icon: '🏠' },
    { id: 'inspections', label: 'Inspections', icon: '🔍' },
    { id: 'escrow', label: 'Escrow', icon: '💰' },
    { id: 'ownership', label: 'Ownership', icon: '🔑' }
  ];

  managementMenu = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'search', label: 'Search', icon: '🔍' },
    { id: 'approvals', label: 'Tasks & Approvals', icon: '✅' },
    { id: 'alerts', label: 'Alerts', icon: '🔔' },
    { id: 'audit', label: 'Audit Trail', icon: '📜' },
    { id: 'reports', label: 'Reports', icon: '📈' }
  ];

  properties: any[] = [];
  milestones: any[] = [];
  inspections: any[] = [];
  rentRoll: any[] = [];
  tenantLogs: any[] = [];
  maintenanceTickets: any[] = [];
  accountingSummaries: any[] = [];
  depreciationSchedules: any[] = [];
  criticalDates: any[] = [];

  baseRent = 1850;
  inflationRate = 3;
  escalationProjection: any[] = [];

  selectedPropertyAddress = '';

  constructor(private route: ActivatedRoute, public toast: ToastService, private http: HttpClient, private ngZone: NgZone) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeTab = params['tab'];
      }
    });
    this.calculateEscalation();
    this.loadBackendData();
  }

  loadBackendData() {
    this.http.get<any[]>('http://localhost:8000/api/domains/real-estate/properties').subscribe({
      next: data => {
        this.properties = data;
        if (data && data.length > 0) {
          this.selectedPropertyAddress = data[0].address;
        }
      }
    });
  }

  formatCurrency(v: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
  }

  emailContact(p: any, event: MouseEvent): void {
    event.stopPropagation();
    const email = p.email || (p.buyer ? `${p.buyer.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.com` : 'buyer@example.com');
    window.open(`mailto:${email}?subject=Real%20Estate%20Property%20Transaction%20%E2%80%94%20${p.address}`);
    this.toast.show(`Email draft opened for ${p.buyer || 'Buyer'}`, 'success');
  }

  callContact(p: any, event: MouseEvent): void {
    event.stopPropagation();
    const phone = p.phone || '(555) 381-0944';
    window.open(`tel:${phone}`);
    this.toast.show(`Calling ${p.buyer || 'Buyer'}...`, 'success');
  }

  completeMilestone(m: any) {
    m.done = true;
    this.toast.show(`Milestone "${m.name}" marked complete`, 'success');
  }

  calculateEscalation() {
    this.escalationProjection = [];
    let currentRent = this.baseRent;
    for (let year = 1; year <= 5; year++) {
      if (year > 1) {
        currentRent = currentRent * (1 + this.inflationRate / 100);
      }
      this.escalationProjection.push({
        year,
        monthly: Math.round(currentRent),
        annual: Math.round(currentRent * 12),
        increase: year === 1 ? 0 : this.inflationRate
      });
    }
  }

  fundEscrow(p: any) {
    p.escrow = true;
    p.progress = Math.min(p.progress + 15, 100);
    this.toast.show(`Escrow deposit wire transfer verified for ${p.buyer}`, 'success');
  }

  passInspection(insp: any) {
    insp.status = 'Passed';
    this.toast.show(`Inspection for ${insp.property} marked Passed`, 'success');
  }

  sendTenantMessage() {
    if (!this.newTenantMsg) return;
    this.tenantLogs.push({
      sender: 'Landlord Admin',
      receiver: 'Michael S. Reynolds',
      timestamp: '2026-06-06 16:04',
      text: this.newTenantMsg
    });
    this.newTenantMsg = '';
    this.toast.show('Message posted to tenant portal successfully', 'success');
  }

  filteredProperties() {
    if (!this.searchQuery) return this.properties;
    const q = this.searchQuery.toLowerCase();
    const terms = q.split(/\s+/).filter(t => t);
    return this.properties.filter(p => 
      terms.every(term =>
        p.address.toLowerCase().includes(term) || 
        p.buyer.toLowerCase().includes(term)
      )
    );
  }

  selectProperty(p: any) {
    this.selectedPropertyAddress = p.address;
    this.showSidebar = true;
    this.sidebarTab = 'details';
  }

  getSelectedProperty() {
    return this.properties.find(p => p.address === this.selectedPropertyAddress);
  }

  getFilteredProperties() {
    let list = this.properties;
    if (this.searchQ) {
      const q = this.searchQ.toLowerCase();
      const terms = q.split(/\s+/).filter(t => t);
      list = list.filter(p =>
        terms.every(term =>
          p.address.toLowerCase().includes(term) || p.buyer.toLowerCase().includes(term)
        )
      );
    }
    if (this.filterStatus) {
      if (this.filterStatus === 'Funded') {
        list = list.filter(p => p.escrow);
      } else if (this.filterStatus === 'Pending') {
        list = list.filter(p => !p.escrow);
      }
    }
    list = [...list].sort((a, b) => {
      if (this.sortBy === 'address_asc') return a.address.localeCompare(b.address);
      if (this.sortBy === 'address_desc') return b.address.localeCompare(a.address);
      if (this.sortBy === 'price_desc') return b.price - a.price;
      if (this.sortBy === 'price_asc') return a.price - b.price;
      if (this.sortBy === 'progress_desc') return b.progress - a.progress;
      return 0;
    });
    return list;
  }

  getTotalPortfolioValue(): number {
    return this.properties.reduce((acc, p) => acc + p.price, 0);
  }

  getInitials(name: string): string {
    if (!name) return '';
    // Use first two letters of address
    return name.replace(/[^a-zA-Z0-9 ]/g, '').split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
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

  saveProperty() {
    if (!this.newProperty.address || !this.newProperty.buyer) {
      this.toast.show('Address and Buyer name are required', 'warning');
      return;
    }
    const prop = {
      address: this.newProperty.address,
      buyer: this.newProperty.buyer,
      price: this.newProperty.price || 500000,
      progress: this.newProperty.progress || 10,
      escrow: this.newProperty.escrow,
      appraisal: this.newProperty.appraisal,
      title: this.newProperty.title
    };
    this.properties.unshift(prop);
    this.showAddForm = false;
    this.toast.show('Property added successfully', 'success');
  }

  getActiveEscrowsCount(): number {
    return this.properties.filter(p => p.escrow).length;
  }

  getTitleExceptionsCount(): number {
    return this.properties.filter(p => !p.title).length;
  }

  askAI(property: any, e: Event): void {
    e.stopPropagation();
    this.selectedPropertyAddress = property.address;
    this.showSidebar = true;
    this.sidebarTab = 'chat';
    this.initChat(property);
  }

  initChat(property: any): void {
    this.chatHistory = [
      { role: 'ai', text: `Hello! I am your AI property compliance assistant. How can I help you audit the escrow and closing pipeline for **${property.address}**?`, time: new Date() }
    ];
  }

  getChatSuggestions(): string[] {
    return [
      `Summarize this property's closing checklist`,
      `Are there any title exceptions or lien flags?`,
      `Is the escrow deposit wire funded?`
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

    const property = this.getSelectedProperty();
    const context = property ? {
      property_address: property.address,
      buyer: property.buyer,
      price: property.price,
      closing_progress: property.progress,
      escrow_funded: property.escrow ? 'Yes' : 'No',
      appraisal_verified: property.appraisal ? 'Yes' : 'No',
      title_status: property.title ? 'Clear' : 'HOA Assessment Lien'
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
        let answer = `I've analyzed **${property?.address || 'this property'}**'s escrow and closing record. `;
        const lowerQ = q.toLowerCase();
        if (lowerQ.includes('closing') || lowerQ.includes('milestone') || lowerQ.includes('progress')) {
          answer += `The closing progress is at **${property?.progress || 0}%**. ` + (property?.progress === 100 ? `All milestones are complete.` : `The remaining steps are being reconciled.`);
        } else if (lowerQ.includes('title') || lowerQ.includes('exception') || lowerQ.includes('lien') || lowerQ.includes('flag')) {
          answer += `The title status is: ` + (property?.title ? `**Clear**. No outstanding exceptions are recorded.` : `**HOA Assessment Lien Flagged**. This exception must be resolved before title release.`);
        } else if (lowerQ.includes('escrow') || lowerQ.includes('wire') || lowerQ.includes('fund')) {
          answer += `The escrow deposit status is ` + (property?.escrow ? `**Fully Funded**. The wire transfer has been confirmed and settled.` : `**Pending**. We are awaiting the buyer's wire transfer settlement.`);
        } else {
          answer += `Let me know if you want me to audit inspections, HOA dues, or straight-line depreciation for tax reporting.`;
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
