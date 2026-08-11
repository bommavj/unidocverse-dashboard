import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, TitleCasePipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
const API = 'http://localhost:8000';

const SECTOR_TASKS: Record<string, string[]> = {
  insurance:    ['Policy Renewal Watch', 'Coverage Gap Analysis', 'COI Status Check', 'Loss Run Review', 'Custom…'],
  hr:           ['Contract Expiry Check', 'Onboarding Doc Check', 'Candidate Pipeline Review', 'Custom…'],
  finance:      ['Invoice Anomaly Detection', '3-Way Match Audit', 'Bank Reconciliation', 'Custom…'],
  legal:        ['Contract Obligation Review', 'NDA Expiry Watch', 'Regulatory Filing Check', 'Custom…'],
  medical:      ['Patient Record Audit', 'Prior Auth Watch', 'EOB Reconciliation', 'Custom…'],
  'real-estate':['Lease Renewal Watch', 'Title Deed Verification', 'Appraisal Comparison', 'Custom…'],
  'supply-chain':['PO Mismatch Detection', 'Bill of Lading Audit', 'Vendor Sanction Check', 'Custom…'],
  clm:          ['Claim Status Review', 'Denial Pattern Analysis', 'Settlement Recommendation', 'Custom…'],
};

@Component({
  selector: 'app-agent-builder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agent-builder.component.html',
  styleUrls: ['./agent-builder.component.scss'],
})
export class AgentBuilderComponent implements OnInit, OnDestroy {
  runs: any[] = [];
  loading = false;
  activeSector = 'all';
  selectedIds = new Set<string>();
  selectedRun: any = null;
  selectedRunDetail: any = null;
  editPayload = false;
  showRunModal = false;
  private pollTimer: any;

  sectors = [
    { id: 'insurance',     icon: '🛡️', label: 'Insurance' },
    { id: 'hr',            icon: '👥', label: 'HR' },
    { id: 'finance',       icon: '💰', label: 'Finance' },
    { id: 'legal',         icon: '⚖️', label: 'Legal' },
    { id: 'medical',       icon: '🏥', label: 'Medical' },
    { id: 'real-estate',   icon: '🏠', label: 'Real Estate' },
    { id: 'supply-chain',  icon: '📦', label: 'Supply Chain' },
    { id: 'clm',           icon: '📋', label: 'Claims' },
  ];

  newRun = { sector: 'insurance', task_name: '', instruction: '', approval_level: 'external' };

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.newRun.task_name = SECTOR_TASKS['insurance'][0];
    this.loadRuns();
    this.pollTimer = setInterval(() => this.loadRuns(), 10000);
  }

  ngOnDestroy() { clearInterval(this.pollTimer); }

  get taskOptions(): string[] { return SECTOR_TASKS[this.newRun.sector] || []; }
  get filteredRuns(): any[] {
    if (this.activeSector === 'all') return this.runs;
    return this.runs.filter(r => r.sector === this.activeSector);
  }
  get pendingCount(): number { return this.runs.filter(r => r.status === 'waiting_approval').length; }
  get allSelected(): boolean { return this.filteredRuns.length > 0 && this.filteredRuns.every(r => this.selectedIds.has(r.id)); }
  get someSelected(): boolean { return this.selectedIds.size > 0; }

  loadRuns() {
    this.http.get<any[]>(`${API}/api/agents/runs`).subscribe({
      next: runs => { this.runs = runs; this.cdr.markForCheck(); },
      error: () => {}
    });
  }

  setSector(s: string) {
    this.activeSector = s;
    this.selectedIds.clear();
    this.closeDrawer();
  }

  countBySector(s: string): number { return this.runs.filter(r => r.sector === s).length; }
  countByStatus(s: string): number { return this.runs.filter(r => r.status === s).length; }

  toggleSelect(id: string) {
    if (this.selectedIds.has(id)) this.selectedIds.delete(id);
    else this.selectedIds.add(id);
  }

  toggleAll() {
    if (this.allSelected) this.selectedIds.clear();
    else this.filteredRuns.forEach(r => this.selectedIds.add(r.id));
  }

  clearSelection() { this.selectedIds.clear(); }

  bulkApprove() {
    const waiting = this.filteredRuns.filter(r => this.selectedIds.has(r.id) && r.status === 'waiting_approval');
    waiting.forEach(r => this.quickApprove(r));
    this.clearSelection();
  }

  bulkReject() {
    const waiting = this.filteredRuns.filter(r => this.selectedIds.has(r.id) && r.status === 'waiting_approval');
    waiting.forEach(r => this.quickReject(r));
    this.clearSelection();
  }

  openDrawer(run: any) {
    this.selectedRun = run;
    this.editPayload = false;
    this.http.get<any>(`${API}/api/agents/runs/${run.id}`).subscribe({
      next: detail => { this.selectedRunDetail = detail; this.cdr.markForCheck(); }
    });
  }

  closeDrawer() { this.selectedRun = null; this.selectedRunDetail = null; }

  quickApprove(run: any) {
    this.http.post(`${API}/api/agents/runs/${run.id}/resume`, { decision: 'approve' }).subscribe({
      next: () => { run.status = 'thinking'; setTimeout(() => this.loadRuns(), 1000); }
    });
  }

  quickReject(run: any) {
    this.http.post(`${API}/api/agents/runs/${run.id}/resume`, { decision: 'reject', comment: 'Rejected by user' }).subscribe({
      next: () => { run.status = 'thinking'; setTimeout(() => this.loadRuns(), 1000); }
    });
  }

  approveRun(run: any) { this.quickApprove(run); this.closeDrawer(); }
  rejectRun(run: any)  { this.quickReject(run);  this.closeDrawer(); }

  cancelRun(run: any) {
    this.http.post(`${API}/api/agents/runs/${run.id}/cancel`, {}).subscribe({
      next: () => { run.status = 'failed'; this.cdr.markForCheck(); }
    });
  }

  selectSector(id: string) {
    this.newRun.sector = id;
    this.newRun.task_name = SECTOR_TASKS[id]?.[0] || '';
  }

  startRun() {
    this.http.post<any>(`${API}/api/agents/runs`, {
      sector: this.newRun.sector,
      task_name: this.newRun.task_name,
      instruction: this.newRun.instruction,
      approval_level: this.newRun.approval_level,
      trigger_type: 'manual',
    }).subscribe({ next: () => { this.showRunModal = false; setTimeout(() => this.loadRuns(), 500); } });
  }

  closeModal(e: Event) { if ((e.target as HTMLElement).classList.contains('modal-bg')) this.showRunModal = false; }

  // ── Display helpers ────────────────────────────────────────────────────────

  sectorIcon(s: string): string {
    const map: Record<string, string> = {
      insurance: '🛡️', hr: '👥', finance: '💰', legal: '⚖️',
      medical: '🏥', 'real-estate': '🏠', 'supply-chain': '📦', clm: '📋'
    };
    return map[s] || '🤖';
  }

  statusClass(s: string): string {
    return { thinking: 'sp-thinking', acting: 'sp-acting', waiting_approval: 'sp-waiting',
             completed: 'sp-done', failed: 'sp-failed', idle: 'sp-idle', rejected: 'sp-failed' }[s] || 'sp-idle';
  }

  statusIcon(s: string): string {
    return { thinking: '🧠', acting: '🔧', waiting_approval: '⏸', completed: '✅', failed: '❌', idle: '⚪', rejected: '❌' }[s] || '⚪';
  }

  statusLabel(s: string): string {
    return { thinking: 'Reasoning…', acting: 'Calling tool…', idle: 'Queued', completed: 'Done', failed: 'Failed', rejected: 'Rejected' }[s] || s;
  }

  priorityClass(run: any): string {
    if (run.status === 'waiting_approval') return 'pd-urgent';
    if (run.status === 'thinking' || run.status === 'acting') return 'pd-high';
    return 'pd-low';
  }

  iterPips(run: any): string[] {
    const max = run.max_iterations || 10;
    const cur = run.iteration || 0;
    const active = ['thinking', 'acting'].includes(run.status);
    return Array.from({ length: Math.min(max, 10) }, (_, i) => {
      if (i < cur - 1) return 'filled';
      if (i === cur - 1 && active) return 'active';
      if (i < cur) return 'filled';
      return 'empty';
    });
  }

  proposedAction(run: any): string {
    const h: any[] = run.history || [];
    const last = [...h].reverse().find(e => e.role === 'assistant');
    if (!last) return 'Awaiting approval…';
    try {
      const p = JSON.parse(last.content);
      return p.thought?.slice(0, 60) || 'Awaiting approval…';
    } catch { return 'Awaiting approval…'; }
  }

  approvalDescription(run: any): string {
    return this.proposedAction(run);
  }

  approvalPayload(run: any): string {
    const h: any[] = run.history || [];
    const last = [...h].reverse().find(e => e.role === 'assistant');
    if (!last) return '';
    try {
      const p = JSON.parse(last.content);
      return JSON.stringify(p.args || {}, null, 2);
    } catch { return last.content?.slice(0, 300) || ''; }
  }

  reasoningTrail(run: any): any[] {
    const h: any[] = run.history || [];
    return h.filter(e => e.role === 'assistant' || (e.role === 'user' && e.content?.startsWith('Tool result'))).map(e => {
      if (e.role === 'assistant') {
        let thought = e.content;
        try { thought = JSON.parse(e.content).thought || e.content; } catch {}
        return { icon: '🧠', label: 'THINK', text: thought?.slice(0, 120), dotClass: 'tl-think' };
      }
      return { icon: '👁', label: 'OBSERVE', text: e.content?.replace('Tool result for ', '')?.slice(0, 120), dotClass: 'tl-observe' };
    });
  }
}
