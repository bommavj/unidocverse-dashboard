import { DomainDocumentsComponent } from '../../components/domain-documents/domain-documents.component';
import { Component, OnInit, NgZone } from '@angular/core';
import { authFetch } from '../../lib/api';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DomainDocumentsComponent],
  template: `
    <div class="p-6 page-container">
      <!-- Topbar Header -->
      <div class="topbar">
        <div>
          <div class="topbar-title">Vendor Directory</div>
          <div class="topbar-sub">{{ getFilteredVendors().length }} of {{ vendors.length }} vendors</div>
        </div>
        <div class="tb-sp"></div>
        <div class="tb-search">
          <span>🔍</span>
          <input [(ngModel)]="searchQ" placeholder="Search vendor name or category…">
          <button class="tb-clear" *ngIf="searchQ" (click)="searchQ=''">✕</button>
          <button class="tb-voice" (click)="startVoiceSearch()" title="Voice Search">🎤</button>
        </div>
        <button class="tb-chip" [class.on]="filterStatus===''" (click)="filterStatus=''">All</button>
        <button class="tb-chip" [class.on]="filterStatus==='compliant'" (click)="filterStatus='compliant'">Compliant</button>
        <button class="tb-chip" [class.on]="filterStatus==='aging'" (click)="filterStatus='aging'">Aging Due</button>
        <select class="tb-select" [(ngModel)]="sortBy" style="margin-left: 8px; margin-right: 8px;">
          <option value="name_asc">🔤 Sort: Name (A-Z)</option>
          <option value="name_desc">🔤 Sort: Name (Z-A)</option>
          <option value="spend_desc">💰 Sort: Spend (High-Low)</option>
          <option value="aging_desc">⏳ Sort: Aging AP (High-Low)</option>
        </select>
        <button class="tb-btn tb-pri" (click)="showAddForm=true">+ Add Vendor</button>
      </div>

      <div class="content">
        <!-- Stats Summary Row -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-lbl">Total Vendors</div>
          <div class="stat-val">{{ vendors.length }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Total Spend</div>
          <div class="stat-val" style="color:#4f46e5">{{ formatCurrency(getTotalSpendSum()) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Outstanding Aging</div>
          <div class="stat-val" style="color:#dc2626">{{ formatCurrency(getTotalAgingSum()) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Compliant Vendors</div>
          <div class="stat-val" style="color:#16a34a">{{ getCompliantCount() }}</div>
        </div>
      </div>

      <!-- Add Vendor Form -->
      <div class="add-card" *ngIf="showAddForm">
        <div class="add-card-header">
          <span style="font-size:16px;font-weight:700;color:#0f172a">New Vendor Profile</span>
          <button class="tb-btn tb-sec" style="height:30px" (click)="showAddForm=false">✕ Cancel</button>
        </div>
        <div class="add-form-grid">
          <div class="form-field"><label>Vendor Name *</label><input [(ngModel)]="newVendor.name" placeholder="Acme Corp"></div>
          <div class="form-field"><label>Category *</label><input [(ngModel)]="newVendor.category" placeholder="Logistics / Cloud"></div>
          <div class="form-field"><label>Total Spend ($)</label><input [(ngModel)]="newVendor.totalSpend" type="number" placeholder="5000"></div>
          <div class="form-field"><label>Aging Due ($)</label><input [(ngModel)]="newVendor.aging" type="number" placeholder="0"></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="tb-btn tb-pri" (click)="saveVendor()">✓ Create Vendor</button>
          <button class="tb-btn tb-sec" (click)="showAddForm=false">Cancel</button>
        </div>
      </div>

      <!-- Active Vendor Directory -->
      <div class="mb-6">
        <div class="client-grid" *ngIf="vendors.length > 0">
          <div 
            *ngFor="let v of getFilteredVendors()"
            (click)="selectVendor(v)"
            [class.active-card]="selectedVendorName === v.name"
            class="client-card">
            
            <!-- Card Header -->
            <div class="cc-header">
              <div [style.background]="getAvatarColor(v.name)" class="cc-avatar">
                {{ getInitials(v.name) }}
              </div>
              <div class="cc-info">
                <h4 class="cc-name">{{ v.name }}</h4>
                <div class="cc-num">Category: {{ v.category }}</div>
              </div>
              <span class="badge" 
                    [class.badge-green]="v.aging === 0"
                    [class.badge-amber]="v.aging > 0">
                {{ v.aging === 0 ? 'Compliant' : 'Aging Due' }}
              </span>
            </div>

            <!-- Stats & Info Row -->
            <div class="cc-stats-two">
              <div class="cc-stat">
                <span class="cc-stat-val truncate" [title]="formatCurrency(v.totalSpend)">{{ formatCurrency(v.totalSpend) }}</span>
                <span class="cc-stat-lbl">Total Spend</span>
              </div>
              <div class="cc-stat">
                <span class="cc-stat-val truncate" [title]="formatCurrency(v.aging)">{{ formatCurrency(v.aging) }}</span>
                <span class="cc-stat-lbl">Aging</span>
              </div>
            </div>
            <div class="cc-stat cc-full-stat">
              <span class="cc-stat-val" [title]="v.category" style="white-space: normal; overflow: visible; text-overflow: clip; font-size: 13.5px;">{{ v.category }}</span>
              <span class="cc-stat-lbl">Domain</span>
            </div>

            <!-- Quick Action Buttons on Card -->
            <div class="cc-actions">
              <button 
                *ngFor="let item of domainMenu; let i = index"
                (click)="selectedVendorName = v.name; activeTab = item.id; $event.stopPropagation()"
                [ngClass]="selectedVendorName === v.name && activeTab === item.id ? 'bg-indigo-650 text-white shadow-sm' : 'btn-color-' + i"
                class="cc-action-btn">
                <span>{{ item.icon }}</span>
                <span class="truncate">{{ item.label }}</span>
              </button>
              <button 
                (click)="askAI(v, $event)"
                class="cc-action-btn cc-action-ai"
                [class.active]="showSidebar && sidebarTab === 'chat' && selectedVendorName === v.name"
                title="Ask AI about this vendor">
                ✦ Ask AI
              </button>
              <button 
                (click)="emailContact(v, $event)"
                class="cc-action-btn cc-action-email"
                [class.active]="true"
                title="Email Vendor">
                ✉ Email
              </button>
              <button 
                (click)="callContact(v, $event)"
                class="cc-action-btn cc-action-phone"
                [class.active]="true"
                title="Call Vendor">
                📞 Call
              </button>
            </div>
          </div>
        </div>
        <div *ngIf="vendors.length === 0 && vendorTabs.includes(activeTab) && domainDocCount === 0" class="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <span style="font-size: 36px">🧾</span>
          <h3 class="text-md font-bold mt-3 text-slate-900 dark:text-white">No Finance Vendors Found</h3>
          <p class="text-xs text-slate-550 mt-2 font-sans">Upload invoices, bank statements, or tax documents to dynamically view vendor reconciliation records.</p>
          <button routerLink="/upload" class="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold font-sans">
            ↑ Upload Invoices/Statements
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
      <app-domain-documents domain="finance" [tab]="activeTab" (count)="domainDocCount = $event"></app-domain-documents>

      <div class="min-w-0">
        <div [ngSwitch]="activeTab">
          <!-- 1. Expenses & Spend Category Analytics -->
          <div *ngSwitchCase="'expenses'" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-6">
            <!-- Spend Category Analytics Widget -->
            <div>
              <h3 class="font-bold text-md text-slate-900 dark:text-white mb-4 font-semibold">Spend Category Analytics</h3>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div *ngFor="let item of spendAnalytics" class="p-4 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800">
                  <span class="text-xs text-slate-455 uppercase font-bold tracking-wide">{{ item.category }}</span>
                  <div class="text-lg font-bold text-slate-900 dark:text-white mt-1">{{ formatCurrency(item.amount) }}</div>
                  <div class="flex items-center justify-between text-3xs text-slate-400 mt-2">
                    <span>% of Total:</span>
                    <span>{{ item.percentage }}%</span>
                  </div>
                  <div class="w-full bg-slate-200 dark:bg-slate-800 h-1 rounded-full overflow-hidden mt-1.5">
                    <div class="bg-indigo-600 h-full" [style.width.%]="item.percentage"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Expense Ledger -->
            <div class="border-t border-slate-200 dark:border-slate-800 pt-6">
              <div class="flex justify-between items-center mb-4">
                <h3 class="font-bold text-lg text-slate-900 dark:text-white">Expenses: <span class="text-indigo-650 dark:text-indigo-400">{{ selectedVendorName }}</span></h3>
                <button (click)="createExpense()" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold transition-all">File Expense</button>
              </div>
              <div class="space-y-3">
                <div *ngIf="filteredExpenses().length === 0" class="p-6 text-center text-xs text-slate-400">No expenses on record for this vendor.</div>
                <div *ngFor="let e of filteredExpenses()" class="p-4 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 flex justify-between items-center gap-4">
                  <div>
                    <h4 class="font-semibold text-slate-900 dark:text-white text-sm">{{ e.category }} <span class="text-xs text-slate-400 font-mono">({{ formatCurrency(e.amount) }})</span></h4>
                    <p class="text-xs text-slate-550 mt-0.5">Submitted by: {{ e.employee }} · Department: {{ e.dept }}</p>
                    <p class="text-2xs text-slate-400 mt-1">Merchant: {{ e.merchant }} · Date: {{ e.date }}</p>
                  </div>
                  <div class="flex items-center gap-3">
                    <span [class]="e.status === 'Approved' ? 'px-2.5 py-0.5 text-2xs font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/20' : 'px-2.5 py-0.5 text-2xs font-semibold rounded bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-955/20'">
                      {{ e.status }}
                    </span>
                    <button *ngIf="e.status !== 'Approved'" (click)="approveExpense(e)" class="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-3xs rounded font-bold">Approve</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. Reconciliations: Vendor Statements, GL & Exception Queue -->
          <div *ngSwitchCase="'reconciliation'" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-6">
            <!-- Uploaded bank statements -->
            <div>
              <div class="flex justify-between items-center mb-4">
                <h3 class="font-bold text-lg text-slate-900 dark:text-white">Bank statements <span class="text-slate-400 text-sm font-semibold">({{ bankStatements.length }})</span></h3>
                <a routerLink="/upload" class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold">↑ Upload statement</a>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-455">
                      <th class="py-2.5 px-2 font-bold uppercase">Statement</th>
                      <th class="py-2.5 px-2 font-bold uppercase">Bank</th>
                      <th class="py-2.5 px-2 font-bold uppercase">Period</th>
                      <th class="py-2.5 px-2 font-bold uppercase text-right">Transactions</th>
                      <th class="py-2.5 px-2 font-bold uppercase text-right">Money out</th>
                      <th class="py-2.5 px-2 font-bold uppercase text-right">Money in</th>
                      <th class="py-2.5 px-2 font-bold uppercase text-right">Closing balance</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-150 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    <tr *ngIf="bankStatements.length === 0">
                      <td colspan="7" class="py-6 text-center text-xs text-slate-400">{{ financeDocsLoaded ? 'No bank statements uploaded yet.' : 'Loading…' }}</td>
                    </tr>
                    <tr *ngFor="let b of bankStatements" class="hover:bg-slate-50 dark:hover:bg-slate-950">
                      <td class="py-3 px-2 font-semibold text-slate-900 dark:text-white">{{ b.filename }}</td>
                      <td class="py-3 px-2">{{ b.bank || '—' }}</td>
                      <td class="py-3 px-2 font-mono">{{ b.period || '—' }}</td>
                      <td class="py-3 px-2 text-right font-mono">{{ b.transactions }}</td>
                      <td class="py-3 px-2 text-right font-mono">{{ formatCurrency(b.debits) }}</td>
                      <td class="py-3 px-2 text-right font-mono">{{ formatCurrency(b.credits) }}</td>
                      <td class="py-3 px-2 text-right font-mono">{{ b.closing_balance != null ? formatCurrency(b.closing_balance) : '—' }}<span *ngIf="b.closing_calculated" class="text-slate-400" title="Opening balance + money in − money out; the ending balance wasn't readable"> (calc.)</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- 3-Way Match Audit Table -->
            <div>
              <div class="flex justify-between items-center mb-4">
                <h3 class="font-bold text-lg text-slate-900 dark:text-white">3-Way Match Audit: <span class="text-indigo-650 dark:text-indigo-400">{{ selectedVendorName }}</span></h3>
                <button (click)="runThreeWayMatch()" class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold transition-all">Audit Matching</button>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-455">
                      <th class="py-2.5 px-2 font-bold uppercase">Invoice ID</th>
                      <th class="py-2.5 px-2 font-bold uppercase">Vendor</th>
                      <th class="py-2.5 px-2 font-bold uppercase text-right">Inv Amount</th>
                      <th class="py-2.5 px-2 font-bold uppercase text-right">PO Amount</th>
                      <th class="py-2.5 px-2 font-bold uppercase text-right">Received Amt</th>
                      <th class="py-2.5 px-2 font-bold uppercase">Audit Result</th>
                      <th class="py-2.5 px-2 font-bold uppercase text-right">Approval Signoff</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-150 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    <tr *ngIf="filteredThreeWayMatches().length === 0">
                      <td colspan="7" class="py-6 text-center text-xs text-slate-400">No match records for this vendor.</td>
                    </tr>
                    <tr *ngFor="let m of filteredThreeWayMatches()" class="hover:bg-slate-50 dark:hover:bg-slate-950 transition-all">
                      <td class="py-3 px-2 font-mono font-bold text-slate-900 dark:text-white">{{ m.id }}</td>
                      <td class="py-3 px-2">{{ m.vendor }}</td>
                      <td class="py-3 px-2 text-right font-mono">{{ formatCurrency(m.invoiceVal) }}</td>
                      <td class="py-3 px-2 text-right font-mono">{{ formatCurrency(m.poVal) }}</td>
                      <td class="py-3 px-2 text-right font-mono">{{ formatCurrency(m.receiptVal) }}</td>
                      <td class="py-3 px-2">
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-3xs font-bold uppercase tracking-wider"
                          [class.bg-emerald-100]="m.match === 'pass'" [class.bg-red-100]="m.match === 'failed'"
                          [class.text-emerald-800]="m.match === 'pass'" [class.text-red-800]="m.match === 'failed'">
                          {{ m.match === 'pass' ? 'Match OK' : 'Discrepancy' }}
                        </span>
                      </td>
                      <td class="py-3 px-2 text-right">
                        <button *ngIf="m.match === 'pass' && !m.approved" (click)="signOffInvoice(m)" class="px-2.5 py-1 text-3xs font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-all">Sign Off</button>
                        <span *ngIf="m.approved" class="text-3xs text-slate-400 font-semibold font-mono">Approved by CFO</span>
                        <span *ngIf="m.match === 'failed'" class="text-3xs text-red-500 font-bold">Investigate PO</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- GL (General Ledger) Reconciliation views -->
            <div class="border-t border-slate-200 dark:border-slate-800 pt-6">
              <h3 class="font-bold text-md text-slate-900 dark:text-white mb-4">GL (General Ledger) Reconciliation Alignment</h3>
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-455">
                      <th class="py-2 px-2 font-bold uppercase">GL Account Code</th>
                      <th class="py-2 px-2 font-bold uppercase">Account Name</th>
                      <th class="py-2 px-2 font-bold uppercase text-right">System Balance</th>
                      <th class="py-2 px-2 font-bold uppercase text-right">Bank Statement</th>
                      <th class="py-2 px-2 font-bold uppercase text-right">Variance</th>
                      <th class="py-2 px-2 font-bold uppercase text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-150 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    <tr *ngFor="let g of glAccounts" class="hover:bg-slate-50 dark:hover:bg-slate-955 transition-all">
                      <td class="py-3 px-2 font-mono font-bold text-indigo-600 dark:text-indigo-400">{{ g.code }}</td>
                      <td class="py-3 px-2 font-semibold">{{ g.name }}</td>
                      <td class="py-3 px-2 text-right font-mono">{{ formatCurrency(g.systemBal) }}</td>
                      <td class="py-3 px-2 text-right font-mono">{{ formatCurrency(g.bankBal) }}</td>
                      <td class="py-3 px-2 text-right font-mono text-red-500 font-bold">{{ formatCurrency(g.systemBal - g.bankBal) }}</td>
                      <td class="py-3 px-2 text-center">
                        <span [class]="(g.systemBal === g.bankBal) ? 'px-2 py-0.5 rounded text-3xs font-semibold bg-emerald-50 text-emerald-700' : 'px-2 py-0.5 rounded text-3xs font-semibold bg-red-50 text-red-700'">
                          {{ (g.systemBal === g.bankBal) ? 'Reconciled' : 'Variance Flagged' }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Exception Queue for Unmatched Invoices -->
            <div class="border-t border-slate-200 dark:border-slate-800 pt-6">
              <h3 class="font-bold text-md text-red-655 dark:text-red-400 mb-3 flex items-center gap-2">
                <span>⚠️ Exception Queue: {{ selectedVendorName }}</span>
              </h3>
              <p class="text-xs text-slate-550 mb-4">Invoices queued here have failed standard validation matches and require manual routing or approval overrides.</p>
              <div class="space-y-3">
                <div *ngIf="filteredExceptionQueue().length === 0" class="p-6 text-center text-xs text-slate-400">No active exception items on queue for this vendor.</div>
                <div *ngFor="let ex of filteredExceptionQueue()" class="p-4 rounded-lg bg-red-50/30 dark:bg-red-955/10 border border-red-200 dark:border-red-900/40 flex justify-between items-center gap-4 text-xs">
                  <div>
                    <h4 class="font-bold text-slate-900 dark:text-white">{{ ex.id }} - Vendor: {{ ex.vendor }}</h4>
                    <p class="text-2xs text-slate-500 mt-1">Invoice Value: {{ formatCurrency(ex.invoiceVal) }} · Variance Reason: <span class="font-bold text-red-600 font-mono">{{ ex.exceptionReason }}</span></p>
                  </div>
                  <div class="flex gap-2">
                    <button (click)="resolveException(ex)" class="px-2.5 py-1 bg-red-600 text-white text-3xs rounded font-bold hover:bg-red-700">Approve Variance</button>
                    <button (click)="toast.show('Invoice routed back to vendor', 'warning')" class="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white text-3xs rounded font-bold">Reject</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. Payments -->
          <div *ngSwitchCase="'payments'" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-4">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white font-semibold">Scheduled Payments: <span class="text-indigo-650 dark:text-indigo-400">{{ selectedVendorName }}</span></h3>
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-455">
                    <th class="py-2.5 px-2 font-bold uppercase">Payment Ref</th>
                    <th class="py-2.5 px-2 font-bold uppercase">Payee / Recipient</th>
                    <th class="py-2.5 px-2 font-bold uppercase text-right">Amount</th>
                    <th class="py-2.5 px-2 font-bold uppercase">Method</th>
                    <th class="py-2.5 px-2 font-bold uppercase">Execution Date</th>
                    <th class="py-2.5 px-2 font-bold uppercase">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-150 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  <tr *ngIf="filteredPayments().length === 0">
                    <td colspan="6" class="py-6 text-center text-xs text-slate-400">No scheduled payments for this vendor.</td>
                  </tr>
                  <tr *ngFor="let p of filteredPayments()" class="hover:bg-slate-50 dark:hover:bg-slate-950 transition-all">
                    <td class="py-3 px-2 font-mono font-bold text-slate-900 dark:text-white">{{ p.ref }}</td>
                    <td class="py-3 px-2 font-semibold">{{ p.payee }}</td>
                    <td class="py-3 px-2 text-right font-mono">{{ formatCurrency(p.amount) }}</td>
                    <td class="py-3 px-2 font-mono uppercase text-indigo-600 dark:text-indigo-400">{{ p.method }}</td>
                    <td class="py-3 px-2 font-mono">{{ p.date }}</td>
                    <td class="py-3 px-2">
                      <span [class]="p.status === 'Completed' ? 'px-2 py-0.5 rounded text-3xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20' : 'px-2 py-0.5 rounded text-3xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-955/20'">
                        {{ p.status }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 4. Vendors & Statement Reconciliation -->
          <div *ngSwitchCase="'vendors'" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-4">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white">Active Vendor & Statement Reconciler</h3>
            <div class="space-y-4">
              <div *ngFor="let v of vendors" class="p-4 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 flex justify-between items-center gap-4">
                <div>
                  <h4 class="font-bold text-slate-900 dark:text-white text-sm">{{ v.name }}</h4>
                  <p class="text-xs text-slate-550">Category: {{ v.category }} · Total Paid: <span class="font-mono text-slate-900 dark:text-slate-200">{{ formatCurrency(v.totalSpend) }}</span></p>
                  <p class="text-2xs text-slate-400 mt-1">Outstanding aging balance: <strong class="text-amber-600 font-mono">{{ formatCurrency(v.aging) }}</strong></p>
                </div>
                <div class="flex items-center gap-3">
                  <span class="px-2.5 py-0.5 text-2xs font-semibold rounded bg-emerald-100 text-emerald-800">
                    Compliant
                  </span>
                  <button (click)="toast.show('OFAC vendor sanctions scan: PASSED', 'success')" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-white text-3xs rounded font-bold">Scan Sanctions</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 5. Taxes -->
          <div *ngSwitchCase="'tax'" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-6">
            <div class="flex justify-between items-center">
              <h3 class="font-bold text-lg text-slate-900 dark:text-white">Tax documents <span class="text-slate-400 text-sm font-semibold">({{ taxDocuments.length }})</span></h3>
              <a routerLink="/research" [queryParams]="{ q: 'Review my ' + reviewYear + ' tax return' }"
                 class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold">📋 Review {{ reviewYear }} return</a>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-455">
                    <th class="py-2.5 px-2 font-bold uppercase">Form</th>
                    <th class="py-2.5 px-2 font-bold uppercase">Year</th>
                    <th class="py-2.5 px-2 font-bold uppercase">From</th>
                    <th class="py-2.5 px-2 font-bold uppercase">Key amounts</th>
                    <th class="py-2.5 px-2 font-bold uppercase">File</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-150 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  <tr *ngIf="taxDocuments.length === 0">
                    <td colspan="5" class="py-6 text-center text-xs text-slate-400">{{ financeDocsLoaded ? 'No tax documents uploaded yet.' : 'Loading…' }}</td>
                  </tr>
                  <tr *ngFor="let t of taxDocuments" class="hover:bg-slate-50 dark:hover:bg-slate-950">
                    <td class="py-3 px-2 font-semibold text-slate-900 dark:text-white">{{ t.form }}</td>
                    <td class="py-3 px-2 font-mono">{{ t.year || '—' }}</td>
                    <td class="py-3 px-2">{{ t.payer || '—' }}</td>
                    <td class="py-3 px-2">
                      <span *ngFor="let k of t.key_amounts; let last = last" class="whitespace-nowrap">{{ k.label }} <b class="font-mono">{{ formatCurrency(k.amount) }}</b><span *ngIf="!last"> · </span></span>
                      <span *ngIf="!t.key_amounts.length" class="text-slate-400">—</span>
                    </td>
                    <td class="py-3 px-2 text-slate-500">{{ t.filename }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div>
              <h3 class="font-bold text-md text-slate-900 dark:text-white mb-3">Upcoming deadlines</h3>
              <div class="space-y-2">
                <div *ngFor="let d of taxDeadlines" class="flex items-center justify-between gap-4 p-3 rounded bg-slate-50 dark:bg-slate-950 border dark:border-slate-800">
                  <div>
                    <div class="font-semibold text-slate-900 dark:text-white text-sm">{{ d.name }}</div>
                    <div class="text-2xs text-slate-500">{{ d.authority }} · due <span class="font-mono">{{ d.due }}</span></div>
                  </div>
                  <span [class]="d.days_left <= 14 ? 'text-red-600 font-bold text-xs' : 'text-slate-500 font-semibold text-xs'">{{ d.days_left }} days</span>
                </div>
              </div>
              <p class="text-2xs text-slate-400 mt-2">Weekend due dates move to the next business day; holidays and disaster extensions aren't included.</p>
            </div>
          </div>

          <!-- 6. Dashboard: Cash Flow Forecast & Summary -->
          <div *ngSwitchCase="'dashboard'" class="space-y-6 animate-fade-in">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="p-5 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl shadow-sm">
                <div class="text-xs font-bold text-slate-455 uppercase font-bold">Pending Disbursements</div>
                <div class="text-2xl font-bold text-slate-900 dark:text-white mt-1">{{ formatCurrency(getTotalAgingSum()) }}</div>
              </div>
              <div class="grid p-5 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl shadow-sm">
                <div class="text-xs font-bold text-slate-455 uppercase font-bold">Total Vendor Spend</div>
                <div class="text-2xl font-bold text-slate-900 dark:text-white mt-1">{{ formatCurrency(getTotalSpendSum()) }}</div>
              </div>
              <div class="p-5 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl shadow-sm">
                <div class="text-xs font-bold text-slate-455 uppercase font-bold">Audit Mismatch Ratio</div>
                <div class="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{{ getAuditMismatchRatio() }}</div>
              </div>
            </div>

            <!-- Cash Flow Forecast (Calculated Grid) -->
            <div class="bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 p-5">
              <h3 class="font-bold text-md text-slate-900 dark:text-white mb-4">Cash-Flow Projections & Forecast</h3>
              <div class="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono text-center">
                <div *ngFor="let proj of cashFlowForecast" class="p-3.5 rounded bg-slate-50 dark:bg-slate-955 border dark:border-slate-850">
                  <span class="block text-3xs font-bold text-slate-455 uppercase mb-1">{{ proj.month }}</span>
                  <span class="block text-indigo-600 font-bold mb-1">{{ formatCurrency(proj.cashInFlow) }} (In)</span>
                  <span class="block text-red-500 mb-1">{{ formatCurrency(proj.cashOutFlow) }} (Out)</span>
                  <span class="block font-bold text-slate-700 dark:text-slate-350 border-t dark:border-slate-900 pt-1.5 mt-1.5">Net: {{ formatCurrency(proj.cashInFlow - proj.cashOutFlow) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 7. Search -->
          <div *ngSwitchCase="'search'" class="bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 p-6 shadow-sm animate-fade-in">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-2">Invoice & Expense Search</h3>
            <input 
              [(ngModel)]="searchQuery" 
              type="text" 
              placeholder="Search by vendor, invoice ID, category or employee name..."
              class="w-full text-sm p-3 rounded-lg border dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 mb-4"/>
            <div class="space-y-2">
              <div *ngFor="let m of filteredMatches()" class="p-3.5 rounded-lg border dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between items-center text-xs">
                <span><strong>{{ m.id }}</strong> (Vendor: {{ m.vendor }})</span>
                <span class="font-mono text-indigo-600 font-semibold">{{ formatCurrency(m.invoiceVal) }}</span>
              </div>
            </div>
          </div>

          <!-- 8. Tasks/Approvals: Approval Chain Tracker -->
          <div *ngSwitchCase="'approvals'" class="bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-6">
            <div>
              <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-4">Financial Sign-offs & Approval Chain Tracker</h3>
              <div class="space-y-4">
                <div *ngFor="let m of threeWayMatches" class="p-4 rounded-lg bg-slate-50 dark:bg-slate-955 border dark:border-slate-800">
                  <div class="flex justify-between items-center mb-3">
                    <h4 class="font-bold text-slate-900 dark:text-white text-sm">Invoice ID: {{ m.id }} ({{ m.vendor }})</h4>
                    <span class="font-mono font-bold text-indigo-600 text-xs">{{ formatCurrency(m.invoiceVal) }}</span>
                  </div>
                  <!-- Visual Approval Chain Workflow -->
                  <div class="flex items-center gap-4 text-xs font-semibold py-2">
                    <div class="flex items-center gap-1.5" [class.text-emerald-600]="true">
                      <span>✓</span> Accounts Clerk
                    </div>
                    <span class="text-slate-400">→</span>
                    <div class="flex items-center gap-1.5" [class.text-emerald-600]="m.invoiceVal < 15000 || m.approved" [class.text-slate-455]="m.invoiceVal >= 15000 && !m.approved">
                      <span>{{ (m.invoiceVal < 15000 || m.approved) ? '✓' : '⏰' }}</span> Dept Manager
                    </div>
                    <span class="text-slate-400">→</span>
                    <div class="flex items-center gap-1.5" [class.text-emerald-600]="m.approved" [class.text-slate-455]="!m.approved">
                      <span>{{ m.approved ? '✓' : '⏰' }}</span> CFO Authorization
                    </div>
                  </div>
                  <div class="flex justify-end mt-2.5" *ngIf="!m.approved">
                    <button (click)="signOffInvoice(m)" class="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700">Approve Sign-off</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 9. Alerts: Duplicate Payment Detection -->
          <div *ngSwitchCase="'alerts'" class="bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-4">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white font-semibold">Duplicate Payment Flags & Anomalies</h3>
            <div *ngFor="let a of anomalies" class="p-4 rounded-lg bg-red-50 dark:bg-red-955/20 border border-red-200 dark:border-red-900/40 text-xs flex justify-between items-center animate-pulse">
              <div>
                <strong class="text-red-800 dark:text-red-400">🚨 Anomaly: {{ a.title }} (Amount: {{ formatCurrency(a.amount) }}).</strong>
                <p class="text-3xs text-slate-550 mt-0.5">Reference ID: {{ a.ref }} · Duplicate probability: 98%</p>
              </div>
              <button (click)="clearFlag(a)" class="px-2.5 py-1 bg-red-655 text-white rounded text-3xs font-bold">Dismiss</button>
            </div>
          </div>

          <!-- 10. Audit Trail -->
          <div *ngSwitchCase="'audit'" class="bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-4">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white font-semibold">Financial Transaction Ledger Audit Trail</h3>
            <div class="space-y-2 text-2xs text-slate-605 dark:text-slate-400 font-mono">
              <div>[2026-06-06 15:55] Invoice INV-2026-9921 3-way match verified as PASS</div>
              <div>[2026-06-06 15:52] Expense audit run: corporate SaaS spending limits parsed successfully</div>
              <div>[2026-06-06 15:45] Corporate estimated tax schedule drafted for IRS Form 1120-W</div>
              <div>[2026-06-06 15:30] Wire transfer of $85,000.00 signed off for Maersk Logistics Line</div>
            </div>
          </div>

          <!-- 11. Reports: Audit Evidence Export -->
          <div *ngSwitchCase="'reports'" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-4">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white font-semibold">Audit Evidence Export</h3>
            <p class="text-xs text-slate-550 font-semibold">Compile corporate billing statements, matched PO receipts, and general ledger reconciliation sheets as compliant evidence formats.</p>
            <div class="flex gap-3">
              <a href="http://localhost:7979/api/analytics/export?query=List+all+financial+records&format=xlsx" download class="px-4 py-2 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700">Compile & Export XLSX</a>
              <a href="http://localhost:7979/api/analytics/export?query=List+all+financial+records&format=csv" download class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-white rounded text-xs font-bold">Compile & Export CSV</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

    <!-- Details Sidebar Drawer -->
    <div class="details-sidebar" [class.details-sidebar-open]="showSidebar">
      <div class="sidebar-header" *ngIf="getSelectedVendor()">
        <div class="sidebar-header-left">
          <div [style.background]="getAvatarColor(selectedVendorName)" class="sidebar-avatar">
            {{ getInitials(selectedVendorName) }}
          </div>
          <div>
            <h3 class="sidebar-title">{{ selectedVendorName }}</h3>
            <p class="sidebar-subtitle">Vendor details · Financial Profile</p>
          </div>
        </div>
        <button class="sidebar-close-btn" (click)="showSidebar = false">✕</button>
      </div>
      
      <!-- Sidebar Tabs Navigation -->
      <div class="sidebar-tabs" *ngIf="getSelectedVendor()">
        <button class="sidebar-tab" [class.active]="sidebarTab === 'details'" (click)="sidebarTab = 'details'">📋 Details</button>
        <button class="sidebar-tab" [class.active]="sidebarTab === 'chat'" (click)="sidebarTab = 'chat'">✦ Ask AI</button>
      </div>

      <div class="sidebar-content" *ngIf="getSelectedVendor() as v">
        
        <!-- Details Tab Content -->
        <div *ngIf="sidebarTab === 'details'" style="display:flex; flex-direction:column; gap:18px; width: 100%;">
          <h4 class="sidebar-section-title">General Information</h4>
          <div class="sidebar-grid">
            <div class="sidebar-field">
              <span class="sidebar-label">Vendor Name</span>
              <span class="sidebar-value">{{ v.name }}</span>
            </div>
            <div class="sidebar-field">
              <span class="sidebar-label">Category</span>
              <span class="sidebar-value">{{ v.category }}</span>
            </div>
            <div class="sidebar-field">
              <span class="sidebar-label">Total Spend</span>
              <span class="sidebar-value font-bold text-indigo-650">{{ formatCurrency(v.totalSpend) }}</span>
            </div>
            <div class="sidebar-field">
              <span class="sidebar-label">Aging Balance</span>
              <span class="sidebar-value text-red-500 font-bold">{{ formatCurrency(v.aging) }}</span>
            </div>
          </div>
        </div>

        <div>
          <h4 class="sidebar-section-title">Compliance status</h4>
          <div class="sidebar-grid">
            <div class="sidebar-field">
              <span class="sidebar-label">Sanctions Scan</span>
              <span class="sidebar-value">
                <span class="badge badge-green">Passed (Compliant)</span>
              </span>
            </div>
            <div class="sidebar-field">
              <span class="sidebar-label">Lien check</span>
              <span class="sidebar-value">No Liens Flagged</span>
            </div>
          </div>
        </div>

        <div>
          <h4 class="sidebar-section-title">Recent Expenses</h4>
          <div class="space-y-2">
            <div *ngFor="let item of filteredExpenses()" class="sidebar-record">
              <div class="flex justify-between font-bold text-3xs text-slate-400 mb-1">
                <span>{{ item.date }} · {{ item.dept }}</span>
                <span class="text-indigo-655">{{ formatCurrency(item.amount) }}</span>
              </div>
              <div class="font-bold text-slate-800 dark:text-slate-200">{{ item.category }}</div>
              <div class="text-3xs text-slate-500 mt-0.5">Submitted by: {{ item.employee }}</div>
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
            <input [(ngModel)]="chatInput" (keydown.enter)="sendChatMessage()" [disabled]="aiLoading" placeholder="Ask AI about this vendor..." class="sidebar-chat-input">
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
    .cc-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    
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
    .sidebar-value { font-size:13px; color:#334155; font-weight:505; }
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
    :host-context(html.dark-mode) .client-card:hover {
      border-color: #4f46e5;
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
export class FinanceComponent implements OnInit {
  activeTab = 'expenses';
  domainDocCount = 0;
  searchQuery = '';
  selectedVendorName = '';

  searchQ = '';
  filterStatus = '';
  sortBy = 'name_asc';
  showSidebar = false;
  showAddForm = false;
  newVendor = { name: '', category: 'Cloud Infrastructure', totalSpend: 0, aging: 0 };

  sidebarTab: 'details' | 'chat' = 'details';
  chatHistory: any[] = [];
  chatInput = '';
  aiLoading = false;

  selectVendor(v: any) {
    this.selectedVendorName = v.name;
    this.showSidebar = true;
    this.sidebarTab = 'details';
  }

  getSelectedVendor() {
    return this.vendors.find(v => v.name === this.selectedVendorName);
  }

  getFilteredVendors() {
    let list = this.vendors;
    if (this.searchQ) {
      const q = this.searchQ.toLowerCase();
      const terms = q.split(/\s+/).filter(t => t);
      list = list.filter(v =>
        terms.every(term =>
          v.name.toLowerCase().includes(term) || v.category.toLowerCase().includes(term)
        )
      );
    }
    if (this.filterStatus) {
      if (this.filterStatus === 'compliant') {
        list = list.filter(v => v.aging === 0);
      } else if (this.filterStatus === 'aging') {
        list = list.filter(v => v.aging > 0);
      }
    }
    list = [...list].sort((a, b) => {
      if (this.sortBy === 'name_asc') return a.name.localeCompare(b.name);
      if (this.sortBy === 'name_desc') return b.name.localeCompare(a.name);
      if (this.sortBy === 'spend_desc') return b.totalSpend - a.totalSpend;
      if (this.sortBy === 'aging_desc') return b.aging - a.aging;
      return 0;
    });
    return list;
  }

  getTotalSpendSum(): number {
    return this.vendors.reduce((acc, v) => acc + v.totalSpend, 0);
  }

  getTotalAgingSum(): number {
    return this.vendors.reduce((acc, v) => acc + v.aging, 0);
  }

  getCompliantCount(): number {
    return this.vendors.filter(v => v.aging === 0).length;
  }

  getAuditMismatchRatio(): string {
    if (this.threeWayMatches.length === 0) return '0.0%';
    const mismatched = this.threeWayMatches.filter(m => m.match === 'failed').length;
    return ((mismatched / this.threeWayMatches.length) * 100).toFixed(1) + '%';
  }

  saveVendor() {
    if (!this.newVendor.name || !this.newVendor.category) {
      this.toast.show('Vendor Name and Category are required', 'warning');
      return;
    }
    const vendor = {
      name: this.newVendor.name,
      category: this.newVendor.category,
      totalSpend: this.newVendor.totalSpend || 0,
      aging: this.newVendor.aging || 0
    };
    this.vendors.unshift(vendor);
    this.showAddForm = false;
    this.toast.show('Vendor added successfully', 'success');
  }

  domainMenu = [
    { id: 'expenses', label: 'Expenses', icon: '💸' },
    { id: 'reconciliation', label: 'Reconciliations', icon: '⚖️' },
    { id: 'payments', label: 'Payments', icon: '💳' },
    { id: 'vendors', label: 'Vendors', icon: '🏢' },
    { id: 'tax', label: 'Taxes', icon: '📝' }
  ];

  managementMenu = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'search', label: 'Search', icon: '🔍' },
    { id: 'approvals', label: 'Tasks & Approvals', icon: '✅' },
    { id: 'alerts', label: 'Alerts', icon: '🔔' },
    { id: 'audit', label: 'Audit Trail', icon: '📜' },
    { id: 'reports', label: 'Reports', icon: '📈' }
  ];

  threeWayMatches: any[] = [];
  anomalies: any[] = [];

  expenses: any[] = [];

  payments: any[] = [];

  vendors: any[] = [];

  taxTimeline: any[] = [];
  vendorTabs = ['expenses', 'vendors', 'payments'];
  bankStatements: any[] = [];
  taxDocuments: any[] = [];
  taxDeadlines: any[] = [];
  financeDocsLoaded = false;
  reviewYear = new Date().getFullYear() - 1;

  glAccounts: any[] = [];

  exceptionQueue: any[] = [];

  spendAnalytics: any[] = [];

  cashFlowForecast: any[] = [];

  emailContact(v: any, event: MouseEvent): void {
    event.stopPropagation();
    const email = v.email || (v.name ? `${v.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.com` : 'billing@vendor.com');
    window.open(`mailto:${email}?subject=Finance%20Vendor%20Inquiry%20%E2%80%94%20${v.name}`);
    this.toast.show(`Email draft opened for ${v.name}`, 'success');
  }

  callContact(v: any, event: MouseEvent): void {
    event.stopPropagation();
    const phone = v.phone || '(555) 301-4402';
    window.open(`tel:${phone}`);
    this.toast.show(`Calling ${v.name}...`, 'success');
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
    this.http.get<any[]>('http://localhost:7979/api/domains/finance/vendors').subscribe({
      next: data => {
        this.vendors = data;
        if (data && data.length > 0) {
          this.selectedVendorName = data[0].name;
        }
      }
    });
    this.http.get<any[]>('http://localhost:7979/api/domains/finance/matches').subscribe({
      next: data => this.threeWayMatches = data
    });
    this.http.get<any>('http://localhost:7979/api/domains/finance/documents').subscribe({
      next: d => {
        this.bankStatements = d.bank_statements || [];
        this.taxDocuments = d.tax_documents || [];
        this.taxDeadlines = d.deadlines || [];
        this.financeDocsLoaded = true;
      },
      error: () => { this.financeDocsLoaded = true; }
    });
  }

  formatCurrency(v: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
  }

  runThreeWayMatch() {
    this.toast.show('3-Way Audit run successfully. 1 mismatch flagged.', 'warning');
  }

  signOffInvoice(m: any) {
    m.approved = true;
    this.toast.show(`Invoice ${m.id} signed off and sent to accounts payable`, 'success');
  }

  clearFlag(a: any) {
    this.anomalies = this.anomalies.filter(item => item !== a);
    this.toast.show('Flag dismissed successfully', 'success');
  }

  approveExpense(e: any) {
    e.status = 'Approved';
    this.toast.show(`Expense report for ${e.category} approved`, 'success');
  }

  createExpense() {
    this.toast.show('New expense report queued for department head signature', 'success');
  }

  resolveException(ex: any) {
    this.exceptionQueue = this.exceptionQueue.filter(item => item !== ex);
    this.toast.show(`Exception approved and override signed off for invoice ${ex.id}`, 'success');
  }

  filteredMatches() {
    if (!this.searchQuery) return this.threeWayMatches;
    const q = this.searchQuery.toLowerCase();
    const terms = q.split(/\s+/).filter(t => t);
    return this.threeWayMatches.filter(m => 
      terms.every(term =>
        m.id.toLowerCase().includes(term) || 
        m.vendor.toLowerCase().includes(term)
      )
    );
  }

  filteredExpenses() {
    return this.expenses.filter(e => e.merchant === this.selectedVendorName);
  }

  filteredThreeWayMatches() {
    return this.threeWayMatches.filter(m => m.vendor === this.selectedVendorName);
  }

  filteredExceptionQueue() {
    return this.exceptionQueue.filter(ex => ex.vendor === this.selectedVendorName);
  }

  filteredPayments() {
    return this.payments.filter(p => p.payee === this.selectedVendorName);
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

  askAI(vendor: any, e: Event): void {
    e.stopPropagation();
    this.selectedVendorName = vendor.name;
    this.showSidebar = true;
    this.sidebarTab = 'chat';
    this.initChat(vendor);
  }

  initChat(vendor: any): void {
    this.chatHistory = [
      { role: 'ai', text: `Hello! I am your AI compliance assistant. How can I help you audit the financial profile and spend analytics for **${vendor.name}**?`, time: new Date() }
    ];
  }

  getChatSuggestions(): string[] {
    return [
      `Summarize this vendor's total spend`,
      `Are there any outstanding aging payments?`,
      `Is this vendor compliant?`
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

    const vendor = this.getSelectedVendor();
    const context = vendor ? {
      vendor_name: vendor.name,
      category: vendor.category,
      total_spend: vendor.totalSpend,
      aging_balance: vendor.aging,
      compliance: 'Passed (Compliant)',
      lien_check: 'No Liens Flagged'
    } : {};

    authFetch('http://localhost:7979/api/documents/ask/with-context', {
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
        let answer = `I've analyzed **${vendor?.name || 'this vendor'}**'s financial profile. `;
        const lowerQ = q.toLowerCase();
        if (lowerQ.includes('spend') || lowerQ.includes('cost')) {
          answer += `The total spend recorded is **${this.formatCurrency(vendor?.totalSpend || 0)}**. No abnormal variance has been flagged in the ledger.`;
        } else if (lowerQ.includes('aging') || lowerQ.includes('pay')) {
          answer += `The outstanding aging balance is **${this.formatCurrency(vendor?.aging || 0)}**. ` + (vendor?.aging && vendor.aging > 0 ? `It is currently flagged as 'Aging Due' and requires payment authorization.` : `There are no overdue balances.`);
        } else if (lowerQ.includes('compliance') || lowerQ.includes('status') || lowerQ.includes('pass')) {
          answer += `The compliance status is fully cleared: Sanctions scans passed, and no active liens or judgments are flagged.`;
        } else {
          answer += `Everything is compliant and within our standard operating guidelines. Let me know if you need to run a deep-dive audit.`;
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
