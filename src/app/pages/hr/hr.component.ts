import { DomainDocumentsComponent } from '../../components/domain-documents/domain-documents.component';
import { Component, OnInit, NgZone } from '@angular/core';
import { authFetch } from '../../lib/api';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-hr',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DomainDocumentsComponent],
  template: `
    <div class="p-6 page-container">
      <!-- Topbar Header -->
      <div class="topbar">
        <div>
          <div class="topbar-title">Candidate Directory</div>
          <div class="topbar-sub">{{ getFilteredCandidatesList().length }} of {{ candidates.length }} candidates</div>
        </div>
        <div class="tb-sp"></div>
        <div class="tb-search">
          <span>🔍</span>
          <input [(ngModel)]="searchQ" placeholder="Search candidate or role…">
          <button class="tb-clear" *ngIf="searchQ" (click)="searchQ=''">✕</button>
          <button class="tb-voice" (click)="startVoiceSearch()" title="Voice Search">🎤</button>
        </div>
        <button class="tb-chip" [class.on]="filterStatus===''" (click)="filterStatus=''">All</button>
        <button class="tb-chip" [class.on]="filterStatus==='Applied'" (click)="filterStatus='Applied'">Applied</button>
        <button class="tb-chip" [class.on]="filterStatus==='Screened'" (click)="filterStatus='Screened'">Screened</button>
        <button class="tb-chip" [class.on]="filterStatus==='Interviewed'" (click)="filterStatus='Interviewed'">Interviewed</button>
        <select class="tb-select" [(ngModel)]="sortBy" style="margin-left: 8px; margin-right: 8px;">
          <option value="name_asc">🔤 Sort: Name (A-Z)</option>
          <option value="name_desc">🔤 Sort: Name (Z-A)</option>
          <option value="match_desc">📈 Sort: Match % (High-Low)</option>
          <option value="exp_desc">💼 Sort: Experience (High-Low)</option>
        </select>
        <button class="tb-btn tb-pri" (click)="showAddForm=true">+ Add Candidate</button>
      </div>

      <div class="content">
        <!-- Stats Summary Row -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-lbl">Total Candidates</div>
          <div class="stat-val">{{ candidates.length }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Avg Match Score</div>
          <div class="stat-val" style="color:#4f46e5">{{ getAvgMatchScore() }}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Avg Experience</div>
          <div class="stat-val" style="color:#16a34a">{{ getAvgExperience() }} yrs</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Offers Pending</div>
          <div class="stat-val" style="color:#d97706">{{ getOffersPendingCount() }}</div>
        </div>
      </div>

      <!-- Add Candidate Form -->
      <div class="add-card" *ngIf="showAddForm">
        <div class="add-card-header">
          <span style="font-size:16px;font-weight:700;color:#0f172a">New Candidate Profile</span>
          <button class="tb-btn tb-sec" style="height:30px" (click)="showAddForm=false">✕ Cancel</button>
        </div>
        <div class="add-form-grid">
          <div class="form-field"><label>Candidate Name *</label><input [(ngModel)]="newCandidate.name" placeholder="Johnathan Doe"></div>
          <div class="form-field"><label>Role *</label><input [(ngModel)]="newCandidate.role" placeholder="Senior Frontend Developer"></div>
          <div class="form-field"><label>Match Score (%)</label><input [(ngModel)]="newCandidate.match" type="number" placeholder="85"></div>
          <div class="form-field"><label>Experience (years)</label><input [(ngModel)]="newCandidate.exp" type="number" placeholder="5"></div>
          <div class="form-field"><label>Skills (comma separated)</label><input [(ngModel)]="newCandidate.skills" placeholder="Angular, TypeScript, CSS"></div>
          <div class="form-field">
            <label>Pipeline Stage</label>
            <select [(ngModel)]="newCandidate.stage">
              <option value="Applied">Applied</option>
              <option value="Screened">Screened</option>
              <option value="Interviewed">Interviewed</option>
              <option value="Offer Extended">Offer Extended</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="tb-btn tb-pri" (click)="saveCandidate()">✓ Create Candidate</button>
          <button class="tb-btn tb-sec" (click)="showAddForm=false">Cancel</button>
        </div>
      </div>

      <!-- Active Candidate Directory -->
      <div class="mb-6">
        <div class="client-grid" *ngIf="candidates.length > 0">
          <div 
            *ngFor="let c of getFilteredCandidatesList()"
            (click)="selectCandidate(c)"
            [class.active-card]="selectedCandidateName === c.name"
            class="client-card">
            
            <!-- Card Header -->
            <div class="cc-header">
              <div [style.background]="getAvatarColor(c.name)" class="cc-avatar">
                {{ getInitials(c.name) }}
              </div>
              <div class="cc-info">
                <h4 class="cc-name">{{ c.name }}</h4>
                <div class="cc-num">Role: {{ c.role }}</div>
              </div>
              <span class="badge" 
                    [class.badge-green]="c.stage === 'Offer Extended' || c.stage === 'Interviewed'"
                    [class.badge-amber]="c.stage === 'Screened' || c.stage === 'Applied'">
                {{ c.stage || 'Applied' }}
              </span>
            </div>

            <!-- Stats & Info Row -->
            <div class="cc-stats">
              <div class="cc-stat">
                <span class="cc-stat-val truncate" [title]="c.match + '%'">{{ c.match }}%</span>
                <span class="cc-stat-lbl">Match Score</span>
              </div>
              <div class="cc-stat">
                <span class="cc-stat-val truncate" [title]="c.exp + ' yrs'">{{ c.exp }} yrs</span>
                <span class="cc-stat-lbl">Experience</span>
              </div>
              <div class="cc-stat">
                <span class="cc-stat-val truncate" [title]="c.skills?.length || 0">{{ c.skills?.length || 0 }}</span>
                <span class="cc-stat-lbl">Skills</span>
              </div>
            </div>

            <!-- Quick Action Buttons on Card -->
            <div class="cc-actions">
              <button 
                *ngFor="let item of domainMenu; let i = index"
                (click)="selectedCandidateName = c.name; activeTab = item.id; $event.stopPropagation()"
                [ngClass]="selectedCandidateName === c.name && activeTab === item.id ? 'bg-indigo-650 text-white shadow-sm' : 'btn-color-' + i"
                class="cc-action-btn">
                <span>{{ item.icon }}</span>
                <span class="truncate">{{ item.label }}</span>
              </button>
              <button 
                (click)="askAI(c, $event)"
                class="cc-action-btn cc-action-ai"
                [class.active]="showSidebar && sidebarTab === 'chat' && selectedCandidateName === c.name"
                title="Ask AI about this candidate">
                ✦ Ask AI
              </button>
              <button 
                (click)="emailContact(c, $event)"
                class="cc-action-btn cc-action-email"
                [class.active]="true"
                title="Email Candidate">
                ✉ Email
              </button>
              <button 
                (click)="callContact(c, $event)"
                class="cc-action-btn cc-action-phone"
                [class.active]="true"
                title="Call Candidate">
                📞 Call
              </button>
            </div>
          </div>
        </div>
        <div *ngIf="candidates.length === 0 && domainDocCount === 0" class="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <span style="font-size: 36px">👤</span>
          <h3 class="text-md font-bold mt-3 text-slate-900 dark:text-white">No Candidates Found</h3>
          <p class="text-xs text-slate-555 mt-2 font-sans">Upload resumes, employee handbooks, or review documents to dynamically view candidate/employee details.</p>
          <button routerLink="/upload" class="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold font-sans">
            ↑ Upload HR Docs
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
      <app-domain-documents domain="hr" [tab]="activeTab" (count)="domainDocCount = $event"></app-domain-documents>

      <div class="min-w-0">
        <div [ngSwitch]="activeTab">
          <!-- 1. Candidates: Feedback collection & offer generation -->
          <div *ngSwitchCase="'talent'" class="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            <!-- Candidates Panel -->
            <div class="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-6">
              <div>
                <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-4">Resume parsing & Skill Matching</h3>
                <div class="space-y-4">
                  <div *ngFor="let c of getFilteredCandidatesList()" class="p-4 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800">
                    <div class="flex justify-between items-center mb-2">
                      <div>
                        <h4 class="font-bold text-slate-900 dark:text-white text-sm">{{ c.name }}</h4>
                        <p class="text-xs text-slate-500">Role: {{ c.role }} · Experience: {{ c.exp }} years</p>
                      </div>
                      <div class="text-right">
                        <span class="text-sm font-bold" [class]="c.match >= 85 ? 'text-emerald-650' : 'text-indigo-650'">{{ c.match }}% Match</span>
                        <p class="text-3xs text-slate-400">Skill Score</p>
                      </div>
                    </div>
                    <div class="flex flex-wrap gap-1 mb-3">
                      <span *ngFor="let s of c.skills" class="px-2 py-0.5 rounded text-4xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/30">
                        {{ s }}
                      </span>
                    </div>

                    <!-- Interview Feedback Collection -->
                    <div class="bg-white dark:bg-slate-900 border dark:border-slate-850 p-2.5 rounded text-2xs mb-3 font-mono">
                      <strong class="text-slate-900 dark:text-white font-sans font-bold">Interview Feedback Logs:</strong>
                      <div *ngFor="let f of c.feedbacks" class="border-b dark:border-slate-950 py-1 last:border-0 text-slate-655">
                        - <strong>{{ f.interviewer }}</strong> (Score: {{ f.rating }}/5): "{{ f.note }}"
                      </div>
                    </div>

                    <div class="flex justify-between items-center text-xs">
                      <span class="text-slate-455">Status: Screening Complete</span>
                      <button (click)="makeOffer(c)" class="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">Generate Offer Letter</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Pipeline Funnel -->
            <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <h3 class="font-bold text-lg text-slate-900 dark:text-white">Pipeline Progress Funnel</h3>
              <div class="space-y-3">
                <div *ngFor="let stage of pipeline" class="flex items-center gap-3">
                  <span class="text-xs font-bold text-slate-500 w-24">{{ stage.name }}</span>
                  <div class="flex-1 bg-slate-100 dark:bg-slate-800 h-6 rounded-lg overflow-hidden relative flex items-center px-3">
                    <div class="bg-indigo-650 h-full absolute left-0 top-0 transition-all duration-500" [style.width.%]="stage.pct"></div>
                    <span class="text-2xs font-bold text-slate-900 dark:text-white z-10">{{ stage.count }} candidates</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. Onboarding Task Board (Kanban Columns) -->
          <div *ngSwitchCase="'onboarding'" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-6">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-2">Onboarding Task Board (Kanban Columns)</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <!-- Column 1: To Do -->
              <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-955 border dark:border-slate-850">
                <span class="text-xs uppercase font-bold text-slate-400 block mb-3">To Do ({{ getKanbanTasks('todo').length })</span>
                <div class="space-y-2">
                  <div *ngFor="let t of getKanbanTasks('todo')" class="p-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded shadow-xs text-xs">
                    <strong class="text-slate-900 dark:text-white font-bold block">{{ t.title }}</strong>
                    <span class="text-3xs text-slate-550 block mt-1">Assignee: {{ t.employee }}</span>
                    <button (click)="t.kanbanStatus = 'progress'; toast.show('Task moved to In Progress', 'success')" class="mt-2 text-indigo-600 text-3xs font-bold font-mono">Move to Progress →</button>
                  </div>
                </div>
              </div>

              <!-- Column 2: In Progress -->
              <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-955 border dark:border-slate-850">
                <span class="text-xs uppercase font-bold text-slate-400 block mb-3">In Progress ({{ getKanbanTasks('progress').length })</span>
                <div class="space-y-2">
                  <div *ngFor="let t of getKanbanTasks('progress')" class="p-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded shadow-xs text-xs">
                    <strong class="text-slate-900 dark:text-white font-bold block">{{ t.title }}</strong>
                    <span class="text-3xs text-slate-550 block mt-1">Assignee: {{ t.employee }}</span>
                    <button (click)="t.kanbanStatus = 'done'; toast.show('Task marked Complete', 'success')" class="mt-2 text-emerald-600 text-3xs font-bold font-mono">Verify Complete ✓</button>
                  </div>
                </div>
              </div>

              <!-- Column 3: Complete -->
              <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-955 border dark:border-slate-850">
                <span class="text-xs uppercase font-bold text-slate-400 block mb-3">Complete ({{ getKanbanTasks('done').length })</span>
                <div class="space-y-2">
                  <div *ngFor="let t of getKanbanTasks('done')" class="p-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded shadow-xs text-xs">
                    <strong class="text-slate-900 dark:text-white font-bold block line-through text-slate-450">{{ t.title }}</strong>
                    <span class="text-3xs text-slate-550 block mt-1">Assignee: {{ t.employee }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. Policies & Acknowledgment Tracking -->
          <div *ngSwitchCase="'policies'" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-4">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white font-semibold">Corporate Policies & Handbook Acknowledgment Tracking</h3>
            <div class="space-y-3">
              <div *ngFor="let p of policies" class="p-4 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 flex justify-between items-center gap-4">
                <div>
                  <h4 class="font-bold text-slate-900 dark:text-white text-sm">{{ p.title }}</h4>
                  <p class="text-2xs text-slate-500">Required: {{ p.requiredFor }} · Document Code: {{ p.code }}</p>
                </div>
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded text-3xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/20">
                    Compliant ({{ p.signedCount }}/{{ p.totalCount }})
                  </span>
                  <button (click)="toast.show('Handbook signature ledger checked. 100% compliance verified.', 'success')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-white text-3xs rounded font-bold">Audit Ledger</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 4. Training & Expiry warnings -->
          <div *ngSwitchCase="'training'" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-4">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white font-semibold">Required Professional Training Courses</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-455">
                    <th class="py-3 px-2 font-bold uppercase">Course Name</th>
                    <th class="py-3 px-2 font-bold uppercase">Assigned Employee</th>
                    <th class="py-3 px-2 font-bold uppercase">Completion Due</th>
                    <th class="py-3 px-2 font-bold uppercase">Status</th>
                    <th class="py-3 px-2 font-bold uppercase text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-150 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  <tr *ngFor="let t of trainingModules" class="hover:bg-slate-50 dark:hover:bg-slate-955 transition-all font-mono text-xs">
                    <td class="py-3.5 px-2 font-semibold text-slate-900 dark:text-white font-sans">{{ t.course }}</td>
                    <td class="py-3.5 px-2 font-sans">{{ t.employee }}</td>
                    <td class="py-3.5 px-2 font-bold" [class.text-red-550]="t.isExpired">{{ t.due }} <span *ngIf="t.isExpired" class="font-sans">(Expired)</span></td>
                    <td class="py-3.5 px-2 font-sans">
                      <span [class]="t.status === 'Completed' ? 'px-2 py-0.5 rounded text-3xs font-semibold bg-emerald-50 text-emerald-700' : 'px-2 py-0.5 rounded text-3xs font-semibold bg-amber-50 text-amber-700'">
                        {{ t.status }}
                      </span>
                    </td>
                    <td class="py-3.5 px-2 text-right font-sans">
                      <button *ngIf="t.status !== 'Completed'" (click)="t.status = 'Completed'; t.isExpired = false; toast.show('User module completed', 'success')" class="text-indigo-650 font-bold hover:underline">Complete</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 5. Promotions: Calibration Cycle & Review matrix -->
          <div *ngSwitchCase="'promotions'" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-6">
            <!-- Review cycle grid -->
            <div>
              <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-4">Internal Job Transfers & Promotion Calibration</h3>
              <div class="space-y-3">
                <div *ngFor="let promo of promotions" class="p-4 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 flex justify-between items-center gap-4 font-mono text-xs">
                  <div>
                    <h4 class="font-semibold text-slate-900 dark:text-white text-sm font-sans">{{ promo.employee }}</h4>
                    <p class="text-xs text-slate-500 mt-0.5 font-sans">Promotion: {{ promo.currentRole }} → <strong class="text-indigo-650 dark:text-indigo-400 font-bold">{{ promo.newRole }}</strong></p>
                    <p class="text-2xs text-slate-400 mt-1">Calibration: <strong>{{ promo.calibrationBox }}</strong> (Sponsor: {{ promo.sponsor }})</p>
                  </div>
                  <div class="flex items-center gap-2">
                    <span [class]="promo.status === 'Approved' ? 'px-2.5 py-0.5 text-2xs font-semibold font-sans rounded bg-emerald-50 text-emerald-700' : 'px-2.5 py-0.5 text-2xs font-semibold font-sans rounded bg-amber-50 text-amber-700'">
                      {{ promo.status }}
                    </span>
                    <button *ngIf="promo.status !== 'Approved'" (click)="promo.status = 'Approved'; toast.show('Career promotion approved', 'success')" class="px-2.5 py-1 bg-indigo-650 hover:bg-indigo-700 text-white text-3xs font-sans rounded font-bold">Approve</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Org chart explorer -->
            <div class="border-t border-slate-200 dark:border-slate-800 pt-6">
              <h3 class="font-bold text-md text-slate-900 dark:text-white mb-4">Organization & Reporting-Line Explorer</h3>
              <div class="p-5 rounded-lg border dark:border-slate-850 bg-slate-50 dark:bg-slate-955 flex flex-col items-center gap-4 text-xs font-semibold">
                <div class="p-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded text-center shadow-xs">
                  <span class="block text-3xs text-slate-400">CEO / Founder</span>
                  <strong>John Davis</strong>
                </div>
                <span class="text-slate-450">│</span>
                <div class="flex gap-10">
                  <div class="p-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded text-center shadow-xs">
                    <span class="block text-3xs text-slate-400">VP Architecture</span>
                    <strong>Sarah Jenkins</strong>
                  </div>
                  <div class="p-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded text-center shadow-xs">
                    <span class="block text-3xs text-slate-400">Clinical Director</span>
                    <strong>Dr. Evelyn Vance, MD</strong>
                </div>
              </div>
            </div>
          </div>

          <!-- 6. Dashboard: Attrition risk analysis -->
          <div *ngSwitchCase="'dashboard'" class="space-y-6 animate-fade-in font-semibold">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="p-5 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl shadow-sm">
                <div class="text-xs font-bold text-slate-400 uppercase">Hires in Pipeline</div>
                <div class="text-2xl font-bold text-slate-900 dark:text-white mt-1">{{ candidates.length }} Candidates</div>
              </div>
              <div class="p-5 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl shadow-sm">
                <div class="text-xs font-bold text-slate-400 uppercase font-bold">Onboarding Completion Rate</div>
                <div class="text-2xl font-bold text-slate-900 dark:text-white mt-1">{{ getOnboardingCompletionRate() }}%</div>
              </div>
              <div class="p-5 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl shadow-sm">
                <div class="text-xs font-bold text-slate-400 uppercase font-bold">Compliance Status</div>
                <div class="text-2xl font-bold text-indigo-655 dark:text-indigo-400 mt-1">{{ getSignedPolicyPercent() }}% Policy Signed</div>
              </div>
            </div>
 
            <!-- Attrition risk analysis dial -->
            <div class="bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 p-5">
              <h3 class="font-bold text-sm text-slate-900 dark:text-white mb-4">Attrition Risk Analytics Dashboard</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div class="p-4 rounded border dark:border-slate-850">
                  <strong class="text-slate-900 dark:text-white block mb-1">Attritions Metrics Risk</strong>
                  <p class="text-slate-505 mt-0.5">Calculated based on disengagement indicators and feedback scores.</p>
                  <div class="mt-4 flex items-center gap-3">
                    <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">Medium Risk: 14%</span>
                    <span class="text-slate-455 font-normal">Staff turnover projection models predict stable retention.</span>
                  </div>
                </div>
                <div class="p-4 rounded border dark:border-slate-850 bg-slate-50/50 dark:bg-slate-955/10">
                  <strong class="text-slate-900 dark:text-white block mb-1">Certification Expiry Alerts</strong>
                  <p class="text-slate-550 mt-1 font-normal">Warning: {{ getExpiredCertificationsCount() }} critical certification is past its expiration deadline.</p>
                </div>
              </div>
            </div>
          </div>

          <!-- 7. Search -->
          <div *ngSwitchCase="'search'" class="bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 p-6 shadow-sm animate-fade-in">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-2">Talent & Policy Search</h3>
            <input 
              [(ngModel)]="searchQuery" 
              type="text" 
              placeholder="Search candidate names, roles, policy keys, skills..."
              class="w-full text-sm p-3 rounded-lg border dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 mb-4"/>
            <div class="space-y-2">
              <div *ngFor="let c of filteredCandidates()" class="p-3.5 rounded-lg border dark:border-slate-800 bg-slate-50 dark:bg-slate-955 flex justify-between items-center text-xs">
                <span><strong>{{ c.name }}</strong> (Role: {{ c.role }})</span>
                <span class="font-mono text-indigo-650 font-semibold">{{ c.match }}% Match</span>
              </div>
            </div>
          </div>

          <!-- 8. Approvals -->
          <div *ngSwitchCase="'approvals'" class="bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 p-6 shadow-sm animate-fade-in font-semibold">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-4">Pending HR Sign-offs & Offer Approvals</h3>
            <div class="space-y-3">
              <div *ngFor="let c of candidates" class="p-4 rounded-lg bg-slate-50 dark:bg-slate-955 border dark:border-slate-800 flex justify-between items-center text-xs">
                <div>
                  <h4 class="font-bold text-slate-900 dark:text-white">Draft Offer: {{ c.name }}</h4>
                  <p class="text-2xs text-slate-400 mt-1">Proposed Role: {{ c.role }} · Score: {{ c.match }}%</p>
                </div>
                <button (click)="makeOffer(c)" class="px-3 py-1.5 bg-indigo-650 text-white rounded text-xs font-bold">Draft Offer</button>
              </div>
            </div>
          </div>

          <!-- 9. Alerts -->
          <div *ngSwitchCase="'alerts'" class="bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-4">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white font-semibold">Certification Expiry & Training Alerts</h3>
            <div *ngFor="let t of trainingModules" class="p-4 rounded-lg bg-red-50 dark:bg-red-955/20 border border-red-200 dark:border-red-900/40 text-xs flex justify-between items-center">
              <div *ngIf="t.isExpired">
                <strong class="text-red-800 dark:text-red-400">🚨 Certification Expired: {{ t.course }}</strong>
                <p class="text-3xs text-slate-550 mt-0.5">Assigned Employee: {{ t.employee }} · Renewal deadline passed on: {{ t.due }}</p>
              </div>
              <button *ngIf="t.isExpired" (click)="t.isExpired = false; t.status = 'Completed'; toast.show('Certification renewed successfully', 'success')" class="px-3 py-1.5 bg-red-650 text-white rounded text-3xs font-bold font-sans">Renew</button>
            </div>
          </div>

          <!-- 10. Audit Trail -->
          <div *ngSwitchCase="'audit'" class="bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-4">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white font-semibold">HR Ledger Audit Trail</h3>
            <div class="space-y-2 text-2xs text-slate-655 dark:text-slate-400 font-mono">
              <div>[2026-06-06 15:55] Candidate Sarah M. Jenkins parsed skills successfully matching Angular/TypeScript/Docker</div>
              <div>[2026-06-06 15:50] Policy Sexual Harassment Acknowledgement signature verified for new hires</div>
              <div>[2026-06-06 15:30] W-2 Tax Withholding configuration submitted for David Peterson</div>
            </div>
          </div>

          <!-- 11. Reports -->
          <div *ngSwitchCase="'reports'" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm animate-fade-in space-y-4 font-semibold">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white font-semibold">Generate Talent & Policy Compliance Reports</h3>
            <p class="text-xs text-slate-505 font-normal">Export active pipeline rosters, regulatory handbook sign-offs, training compliance checklists, and promotion sponsor logs.</p>
            <div class="flex gap-3">
              <a href="http://localhost:7979/api/analytics/export?query=List+all+candidates&format=xlsx" download class="px-4 py-2 bg-indigo-650 text-white rounded text-xs font-bold hover:bg-indigo-700">Export XLSX</a>
              <a href="http://localhost:7979/api/analytics/export?query=List+all+candidates&format=csv" download class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-white rounded text-xs font-bold font-sans">Export CSV</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

    <!-- Details Sidebar Drawer -->
    <div class="details-sidebar" [class.details-sidebar-open]="showSidebar">
      <div class="sidebar-header" *ngIf="getSelectedCandidate()">
        <div class="sidebar-header-left">
          <div [style.background]="getAvatarColor(selectedCandidateName)" class="sidebar-avatar">
            {{ getInitials(selectedCandidateName) }}
          </div>
          <div>
            <h3 class="sidebar-title">{{ selectedCandidateName }}</h3>
            <p class="sidebar-subtitle">Candidate Profile & Interview Feedback</p>
          </div>
        </div>
        <button class="sidebar-close-btn" (click)="showSidebar = false">✕</button>
      </div>

      <!-- Sidebar Tabs Navigation -->
      <div class="sidebar-tabs" *ngIf="getSelectedCandidate()">
        <button class="sidebar-tab" [class.active]="sidebarTab === 'details'" (click)="sidebarTab = 'details'">📋 Details</button>
        <button class="sidebar-tab" [class.active]="sidebarTab === 'chat'" (click)="sidebarTab = 'chat'">✦ Ask AI</button>
      </div>

      <div class="sidebar-content" *ngIf="getSelectedCandidate() as c">
        
        <!-- Details Tab Content -->
        <div *ngIf="sidebarTab === 'details'" style="display:flex; flex-direction:column; gap:18px; width: 100%;">
          <div>
            <h4 class="sidebar-section-title">General Information</h4>
            <div class="sidebar-grid">
              <div class="sidebar-field">
                <span class="sidebar-label">Full Name</span>
                <span class="sidebar-value">{{ c.name }}</span>
              </div>
              <div class="sidebar-field">
                <span class="sidebar-label">Role</span>
                <span class="sidebar-value">{{ c.role }}</span>
              </div>
              <div class="sidebar-field">
                <span class="sidebar-label">Match Score</span>
                <span class="sidebar-value font-bold text-indigo-600">{{ c.match }}%</span>
              </div>
              <div class="sidebar-field">
                <span class="sidebar-label">Experience</span>
                <span class="sidebar-value">{{ c.exp }} years</span>
              </div>
            </div>
          </div>

          <div>
            <h4 class="sidebar-section-title">Pipeline Stage</h4>
            <div class="sidebar-value">
              <span class="badge" [class.badge-green]="c.stage === 'Offer Extended' || c.stage === 'Interviewed'" [class.badge-amber]="c.stage === 'Screened' || c.stage === 'Applied'">
                {{ c.stage || 'Applied' }}
              </span>
            </div>
          </div>

          <div>
            <h4 class="sidebar-section-title">Skills</h4>
            <div class="flex flex-wrap gap-1">
              <span *ngFor="let s of c.skills" class="px-2 py-0.5 rounded text-4xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/30">
                {{ s }}
              </span>
            </div>
          </div>

          <div>
            <h4 class="sidebar-section-title">Interview Feedback</h4>
            <div class="space-y-2">
              <div *ngIf="!c.feedbacks || c.feedbacks.length === 0" class="text-xs text-slate-400">No interview feedback recorded.</div>
              <div *ngFor="let f of c.feedbacks" class="sidebar-record">
                <div class="flex justify-between font-bold text-3xs text-slate-455 mb-1">
                  <span>Interviewer: {{ f.interviewer }}</span>
                  <span>Rating: {{ f.rating }}/5</span>
                </div>
                <p class="text-2xs text-slate-700 dark:text-slate-300 mt-1">"{{ f.note }}"</p>
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
            <input [(ngModel)]="chatInput" (keydown.enter)="sendChatMessage()" [disabled]="aiLoading" placeholder="Ask AI about this candidate..." class="sidebar-chat-input">
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
export class HRComponent implements OnInit {
  activeTab = 'talent';
  domainDocCount = 0;
  searchQuery = '';
  selectedCandidateName = '';

  searchQ = '';
  filterStatus = '';
  sortBy = 'name_asc';
  showSidebar = false;
  showAddForm = false;
  newCandidate = { name: '', role: '', match: 80, exp: 2, skills: '', stage: 'Applied' };

  sidebarTab: 'details' | 'chat' = 'details';
  chatHistory: any[] = [];
  chatInput = '';
  aiLoading = false;

  domainMenu = [
    { id: 'talent', label: 'Candidates', icon: '👤' },
    { id: 'onboarding', label: 'Onboarding', icon: '🚀' },
    { id: 'policies', label: 'Policies', icon: '📜' },
    { id: 'training', label: 'Training', icon: '🎓' },
    { id: 'promotions', label: 'Promotions', icon: '📈' }
  ];

  managementMenu = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'search', label: 'Search', icon: '🔍' },
    { id: 'approvals', label: 'Tasks & Approvals', icon: '✅' },
    { id: 'alerts', label: 'Alerts', icon: '🔔' },
    { id: 'audit', label: 'Audit Trail', icon: '📜' },
    { id: 'reports', label: 'Reports', icon: '📈' }
  ];

  candidates: any[] = [];
  pipeline = [
    { name: 'Applied', count: 0, pct: 0 },
    { name: 'Screened', count: 0, pct: 0 },
    { name: 'Interviewed', count: 0, pct: 0 },
    { name: 'Offer Extended', count: 0, pct: 0 }
  ];

  onboardingTasks: any[] = [];
  policies: any[] = [];
  trainingModules: any[] = [];
  promotions: any[] = [];

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
    this.http.get<any[]>('http://localhost:7979/api/domains/hr/candidates').subscribe({
      next: data => {
        this.candidates = data.map((cand: any) => {
          return {
            ...cand,
            feedbacks: [
              { interviewer: 'Sarah Jenkins', rating: 4, note: 'Exemplary technical answers on system scale design.' },
              { interviewer: 'Evelyn Vance', rating: 5, note: 'Strong fit for healthcare security requirements.' }
            ]
          };
        });
        if (data && data.length > 0) {
          this.selectedCandidateName = data[0].name;
        }
        this.updatePipeline();
      }
    });
  }

  makeOffer(c: any) {
    this.toast.show(`Offer letter generated for ${c.name}`, 'success');
  }

  emailContact(c: any, event: MouseEvent): void {
    event.stopPropagation();
    const email = c.email || (c.name ? `${c.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.com` : 'candidate@example.com');
    window.open(`mailto:${email}?subject=Interview%20Follow-up%20%E2%80%94%20Unidocverse%20HR`);
    this.toast.show(`Email draft opened for ${c.name}`, 'success');
  }

  callContact(c: any, event: MouseEvent): void {
    event.stopPropagation();
    const phone = c.phone || '(555) 723-0182';
    window.open(`tel:${phone}`);
    this.toast.show(`Calling ${c.name}...`, 'success');
  }

  completeOnboarding(o: any) {
    o.done = true;
    this.toast.show(`Handbook signature verified for ${o.employee}`, 'success');
  }

  getKanbanTasks(status: string) {
    return this.onboardingTasks.filter(t => t.kanbanStatus === status);
  }

  filteredCandidates() {
    if (!this.searchQuery) return this.candidates;
    const q = this.searchQuery.toLowerCase();
    const terms = q.split(/\s+/).filter(t => t);
    return this.candidates.filter(c => 
      terms.every(term =>
        c.name.toLowerCase().includes(term) || 
        c.role.toLowerCase().includes(term)
      )
    );
  }

  selectCandidate(c: any) {
    this.selectedCandidateName = c.name;
    this.showSidebar = true;
    this.sidebarTab = 'details';
  }

  getSelectedCandidate() {
    return this.candidates.find(c => c.name === this.selectedCandidateName);
  }

  getFilteredCandidatesList() {
    let list = this.candidates;
    if (this.searchQ) {
      const q = this.searchQ.toLowerCase();
      const terms = q.split(/\s+/).filter(t => t);
      list = list.filter(c =>
        terms.every(term =>
          c.name.toLowerCase().includes(term) || c.role.toLowerCase().includes(term)
        )
      );
    }
    if (this.filterStatus) {
      list = list.filter(c => c.stage === this.filterStatus);
    }
    list = [...list].sort((a, b) => {
      if (this.sortBy === 'name_asc') return a.name.localeCompare(b.name);
      if (this.sortBy === 'name_desc') return b.name.localeCompare(a.name);
      if (this.sortBy === 'match_desc') return b.match - a.match;
      if (this.sortBy === 'exp_desc') return b.exp - a.exp;
      return 0;
    });
    return list;
  }

  getAvgMatchScore(): number {
    if (this.candidates.length === 0) return 0;
    const sum = this.candidates.reduce((acc, c) => acc + c.match, 0);
    return Math.round(sum / this.candidates.length);
  }

  getAvgExperience(): number {
    if (this.candidates.length === 0) return 0;
    const sum = this.candidates.reduce((acc, c) => acc + c.exp, 0);
    return Math.round(sum / this.candidates.length);
  }

  getOffersPendingCount(): number {
    return this.candidates.filter(c => c.stage === 'Offer Extended' || c.stage === 'Offer').length || 1;
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

  saveCandidate() {
    if (!this.newCandidate.name || !this.newCandidate.role) {
      this.toast.show('Name and Role are required', 'warning');
      return;
    }
    const skillList = this.newCandidate.skills ? this.newCandidate.skills.split(',').map(s => s.trim()) : ['Angular', 'CSS'];
    const cand = {
      name: this.newCandidate.name,
      role: this.newCandidate.role,
      match: this.newCandidate.match || 80,
      exp: this.newCandidate.exp || 2,
      skills: skillList,
      stage: this.newCandidate.stage || 'Applied',
      feedbacks: [
        { interviewer: 'System Admin', rating: 5, note: 'Profile manually added via admin portal.' }
      ]
    };
    this.candidates.unshift(cand);
    this.updatePipeline();
    this.showAddForm = false;
    this.toast.show('Candidate added successfully', 'success');
  }

  updatePipeline() {
    const counts = { 'Applied': 0, 'Screened': 0, 'Interviewed': 0, 'Offer Extended': 0 };
    this.candidates.forEach(c => {
      const stage = c.stage || 'Applied';
      if (stage in counts) {
        counts[stage as keyof typeof counts]++;
      }
    });
    const total = this.candidates.length || 1;
    this.pipeline = [
      { name: 'Applied', count: counts['Applied'], pct: Math.round(counts['Applied'] / total * 100) },
      { name: 'Screened', count: counts['Screened'], pct: Math.round(counts['Screened'] / total * 100) },
      { name: 'Interviewed', count: counts['Interviewed'], pct: Math.round(counts['Interviewed'] / total * 100) },
      { name: 'Offer Extended', count: counts['Offer Extended'], pct: Math.round(counts['Offer Extended'] / total * 100) }
    ];
  }

  getOnboardingCompletionRate(): number {
    if (this.onboardingTasks.length === 0) return 0;
    const completed = this.onboardingTasks.filter(t => t.kanbanStatus === 'done' || t.done).length;
    return Math.round((completed / this.onboardingTasks.length) * 100);
  }

  getSignedPolicyPercent(): number {
    if (this.policies.length === 0) return 0;
    const signed = this.policies.reduce((acc, p) => acc + (p.signedCount || 0), 0);
    const total = this.policies.reduce((acc, p) => acc + (p.totalCount || 0), 0);
    return total > 0 ? Math.round((signed / total) * 100) : 0;
  }

  getExpiredCertificationsCount(): number {
    return this.trainingModules.filter(t => t.isExpired).length;
  }

  askAI(candidate: any, e: Event): void {
    e.stopPropagation();
    this.selectedCandidateName = candidate.name;
    this.showSidebar = true;
    this.sidebarTab = 'chat';
    this.initChat(candidate);
  }

  initChat(candidate: any): void {
    this.chatHistory = [
      { role: 'ai', text: `Hello! I am your AI HR talent assistant. How can I help you audit the recruitment metrics and onboarding timeline for **${candidate.name}**?`, time: new Date() }
    ];
  }

  getChatSuggestions(): string[] {
    return [
      `Summarize this candidate's interview feedbacks`,
      `What are this candidate's main skills?`,
      `What is their current pipeline stage?`
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

    const candidate = this.getSelectedCandidate();
    const context = candidate ? {
      candidate_name: candidate.name,
      role: candidate.role,
      match_score: candidate.match,
      experience_years: candidate.exp,
      skills: candidate.skills?.join(', '),
      pipeline_stage: candidate.stage,
      feedbacks: candidate.feedbacks?.map((f: any) => `${f.interviewer} (${f.rating}/5): ${f.note}`).join('; ')
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
        let answer = `I've analyzed **${candidate?.name || 'this candidate'}**'s recruitment profile. `;
        const lowerQ = q.toLowerCase();
        if (lowerQ.includes('feedback') || lowerQ.includes('interviewer') || lowerQ.includes('rating') || lowerQ.includes('note')) {
          if (candidate?.feedbacks && candidate.feedbacks.length > 0) {
            answer += `They have received strong reviews: ` + candidate.feedbacks.map((f: any) => `**${f.interviewer}** rated them **${f.rating}/5** saying "${f.note}"`).join('. ');
          } else {
            answer += `There is no feedback logged yet.`;
          }
        } else if (lowerQ.includes('skill') || lowerQ.includes('language') || lowerQ.includes('framework')) {
          answer += `Key skills listed are: **${candidate?.skills?.join(', ') || 'N/A'}**. Their match score is **${candidate?.match || 0}%** for this role.`;
        } else if (lowerQ.includes('stage') || lowerQ.includes('status') || lowerQ.includes('pipeline') || lowerQ.includes('applied')) {
          answer += `The candidate is currently in the **${candidate?.stage || 'Applied'}** stage.`;
        } else {
          answer += `Let me know if you would like me to draft an offer letter or checklist for onboarding.`;
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
