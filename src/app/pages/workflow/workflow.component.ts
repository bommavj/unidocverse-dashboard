import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { UdvSelectComponent, SelectOption } from '../../components/udv-select/udv-select.component';

const API = 'http://localhost:7979/api';

// ── types ────────────────────────────────────────────────────────────────────

export interface WfStep {
  index: number;
  title: string;
  status: 'pending' | 'running' | 'done' | 'hitl' | 'approved' | 'rejected' | 'error';
  result?: any;
  log?: string;
}

export interface CompareRow {
  field: string;
  field_key: string;
  value_a: string;
  value_b: string;
  status: 'match' | 'mismatch' | 'only_a' | 'only_b';
}

export interface DomainStage {
  id: string;
  label: string;
  color: string;
  count: number;
}

export interface DomainItem {
  id: string;
  domain: string;
  stage: string;
  title: string;
  fields: Record<string, string>;
  notes?: string;
  updated_at: string;
}

export interface DomainConfig {
  label: string;
  icon: string;
  stages: DomainStage[];
  fields: string[];
  hitl_stages: string[];
}

type DocWorkflowTab = 'compare' | 'threeway' | 'reconcile';
type DomainWorkflowTab = 'procurement' | 'clm' | 'claims' | 'renewals' | 'payroll' | 'medical' | 'legal' | 'real_estate';
type ActiveTab = DocWorkflowTab | DomainWorkflowTab;

const DOMAIN_TABS: DomainWorkflowTab[] = ['procurement','clm','claims','renewals','payroll','medical','legal','real_estate'];

// ── component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-workflow',
  standalone: true,
  imports: [CommonModule, FormsModule, UdvSelectComponent],
  templateUrl: './workflow.component.html',
  styleUrls: ['./workflow.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowComponent implements OnInit {

  // Tab state
  activeWorkflow: ActiveTab = 'compare';
  readonly docTabs: DocWorkflowTab[] = ['compare', 'threeway', 'reconcile'];
  readonly domainTabs = DOMAIN_TABS;

  get isDomainTab(): boolean { return DOMAIN_TABS.includes(this.activeWorkflow as DomainWorkflowTab); }

  // All uploaded docs for selection
  allDocs: any[] = [];
  loadingDocs = false;

  get docOptions(): SelectOption[] {
    return this.allDocs.map(d => ({ value: d.id, label: d.filename }));
  }

  rowOverrideOptions(row: CompareRow): SelectOption[] {
    return [
      { value: row.value_a, label: 'Keep A: ' + row.value_a },
      { value: row.value_b, label: 'Keep B: ' + row.value_b },
    ];
  }

  // ── Compare & Merge ──────────────────────────────────────────────────────
  cmpDocA = '';
  cmpDocB = '';
  cmpLabelA = '';
  cmpLabelB = '';
  cmpFilter: 'all' | 'mismatch' | 'only_a' | 'only_b' = 'all';

  cmpSteps: WfStep[] = [
    { index: 1, title: 'Load & Extract Documents', status: 'pending' },
    { index: 2, title: 'Field-by-Field Comparison', status: 'pending' },
    { index: 3, title: 'Human Review',              status: 'pending' },
    { index: 4, title: 'Merge & Export',            status: 'pending' },
  ];
  cmpRunId    = '';
  cmpResult:  any = null;
  mergeResult: any = null;
  cmpRunning  = false;
  hitlOpen    = false;
  hitlStep:   WfStep | null = null;
  hitlFeedback = '';
  mergeStrategy: 'prefer_a' | 'prefer_b' = 'prefer_a';
  manualOverrides: Record<string, string> = {};

  // ── Three-Way Match ───────────────────────────────────────────────────────
  twInvoiceId  = '';
  twPoId       = '';
  twReceiptId  = '';
  twSteps: WfStep[] = [
    { index: 1, title: 'Load Documents',          status: 'pending' },
    { index: 2, title: 'Extract Line Items',      status: 'pending' },
    { index: 3, title: 'Match Fields',            status: 'pending' },
    { index: 4, title: 'Human Review',            status: 'pending' },
    { index: 5, title: 'Generate Match Report',   status: 'pending' },
  ];
  twResult:   any = null;
  twRunning   = false;
  twHitlOpen  = false;

  // ── Bank Reconciliation ───────────────────────────────────────────────────
  recStatementId = '';
  recLedgerId    = '';
  recSteps: WfStep[] = [
    { index: 1, title: 'Load Statement & Ledger',   status: 'pending' },
    { index: 2, title: 'Balance Comparison',        status: 'pending' },
    { index: 3, title: 'Transaction Matching',      status: 'pending' },
    { index: 4, title: 'Human Review',              status: 'pending' },
    { index: 5, title: 'Reconciliation Sign-off',   status: 'pending' },
  ];
  recResult:  any = null;
  recRunning  = false;
  recHitlOpen = false;

  // ── Domain Workflow (Kanban) ───────────────────────────────────────────────
  domainConfigs: Record<string, DomainConfig> = {};
  domainItems: Record<string, DomainItem[]> = {};
  domainStages: Record<string, DomainStage[]> = {};
  domainLoading: Record<string, boolean> = {};

  // New item form
  newItemTitle  = '';
  newItemStage  = '';
  newItemNotes  = '';
  newItemFields: Record<string, string> = {};
  showNewItemForm = false;
  newItemSubmitting = false;

  // Stage move
  movingItemId = '';
  movingDomain = '';

  // History panel
  historyItem: DomainItem | null = null;
  historyLog: any[] = [];
  historyLoading = false;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadDocs();
    this.loadDomainConfigs();
  }

  loadDocs(): void {
    this.loadingDocs = true;
    this.http.get<any>(`${API}/documents?limit=100`).subscribe({
      next: r => {
        this.allDocs = r.documents || r.data || r || [];
        this.loadingDocs = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loadingDocs = false; this.cdr.markForCheck(); }
    });
  }

  loadDomainConfigs(): void {
    this.http.get<any>(`${API}/domain-workflow/config`).subscribe({
      next: r => {
        this.domainConfigs = r.domains || {};
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  switchTab(tab: ActiveTab): void {
    this.activeWorkflow = tab;
    if (DOMAIN_TABS.includes(tab as DomainWorkflowTab)) {
      this.loadDomainItems(tab as DomainWorkflowTab);
    }
    this.cdr.markForCheck();
  }

  loadDomainItems(domain: DomainWorkflowTab): void {
    this.domainLoading[domain] = true;
    this.cdr.markForCheck();
    this.http.get<any>(`${API}/domain-workflow/${domain}/items`).subscribe({
      next: r => {
        this.domainItems[domain] = r.items || [];
        this.domainStages[domain] = r.stages || [];
        if (!this.domainConfigs[domain] && r.config) {
          this.domainConfigs[domain] = r.config;
        }
        this.domainLoading[domain] = false;
        this.cdr.markForCheck();
      },
      error: () => { this.domainLoading[domain] = false; this.cdr.markForCheck(); }
    });
  }

  currentDomainConfig(): DomainConfig | null {
    return this.domainConfigs[this.activeWorkflow] || null;
  }

  currentDomainStages(): DomainStage[] {
    return this.domainStages[this.activeWorkflow] || [];
  }

  itemsForStage(stage: string): DomainItem[] {
    const items = this.domainItems[this.activeWorkflow] || [];
    return items.filter(i => i.stage === stage);
  }

  openNewItemForm(): void {
    this.newItemTitle = '';
    this.newItemStage = '';
    this.newItemNotes = '';
    this.newItemFields = {};
    const cfg = this.currentDomainConfig();
    if (cfg?.fields) cfg.fields.forEach(f => this.newItemFields[f] = '');
    this.showNewItemForm = true;
    this.cdr.markForCheck();
  }

  submitNewItem(): void {
    if (!this.newItemTitle.trim()) return;
    const domain = this.activeWorkflow as DomainWorkflowTab;
    this.newItemSubmitting = true;
    this.cdr.markForCheck();

    const body = {
      title: this.newItemTitle.trim(),
      stage: this.newItemStage || undefined,
      notes: this.newItemNotes || undefined,
      fields: Object.fromEntries(Object.entries(this.newItemFields).filter(([,v]) => v)),
    };

    this.http.post<any>(`${API}/domain-workflow/${domain}/items`, body).subscribe({
      next: () => {
        this.showNewItemForm = false;
        this.newItemSubmitting = false;
        this.loadDomainItems(domain);
      },
      error: () => { this.newItemSubmitting = false; this.cdr.markForCheck(); }
    });
  }

  moveItemStage(item: DomainItem, newStage: string): void {
    const domain = item.domain as DomainWorkflowTab;
    this.http.patch<any>(`${API}/domain-workflow/${domain}/items/${item.id}/stage`, {
      stage: newStage,
      note: `Moved to ${newStage}`,
    }).subscribe({
      next: () => this.loadDomainItems(this.activeWorkflow as DomainWorkflowTab),
      error: () => {}
    });
  }

  stageOptions(domain: string): SelectOption[] {
    const stages = this.domainStages[domain] || this.domainConfigs[domain]?.stages || [];
    return stages.map((s: any) => ({ value: s.id, label: s.label }));
  }

  openHistory(item: DomainItem): void {
    this.historyItem = item;
    this.historyLog = [];
    this.historyLoading = true;
    this.cdr.markForCheck();

    this.http.get<any>(`${API}/domain-workflow/${item.domain}/items/${item.id}/history`).subscribe({
      next: r => {
        this.historyLog = r.history || [];
        this.historyLoading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.historyLoading = false; this.cdr.markForCheck(); }
    });
  }

  closeHistory(): void {
    this.historyItem = null;
    this.historyLog = [];
    this.cdr.markForCheck();
  }

  isHitlStage(stage: string): boolean {
    const cfg = this.currentDomainConfig();
    return cfg?.hitl_stages?.includes(stage) ?? false;
  }

  domainTabLabel(tab: DomainWorkflowTab): string {
    const labels: Record<DomainWorkflowTab, string> = {
      procurement: 'Procurement',
      clm:         'Contracts',
      claims:      'Claims',
      renewals:    'Renewals',
      payroll:     'Payroll',
      medical:     'Medical',
      legal:       'Legal',
      real_estate: 'Real Estate',
    };
    return labels[tab];
  }

  docName(id: string): string {
    const d = this.allDocs.find(x => x.id === id);
    return d ? d.filename : id;
  }

  // ── Compare & Merge workflow ─────────────────────────────────────────────

  get cmpRows(): CompareRow[] {
    if (!this.cmpResult?.rows) return [];
    if (this.cmpFilter === 'all') return this.cmpResult.rows;
    return this.cmpResult.rows.filter((r: CompareRow) => r.status === this.cmpFilter);
  }

  resetCmp(): void {
    this.cmpSteps = this.cmpSteps.map(s => ({ ...s, status: 'pending', result: undefined, log: undefined }));
    this.cmpResult = null; this.mergeResult = null;
    this.cmpRunId = ''; this.hitlOpen = false; this.hitlStep = null;
    this.manualOverrides = {};
    this.cdr.markForCheck();
  }

  async runCompare(): Promise<void> {
    if (!this.cmpDocA || !this.cmpDocB) return;
    this.resetCmp();
    this.cmpRunning = true;
    this.cdr.markForCheck();

    this._setStep(this.cmpSteps, 0, 'running', 'Fetching document metadata…');
    await this._delay(600);
    this._setStep(this.cmpSteps, 0, 'done', `Loaded: ${this.docName(this.cmpDocA)} + ${this.docName(this.cmpDocB)}`);

    this._setStep(this.cmpSteps, 1, 'running', 'Extracting and comparing fields…');
    try {
      const res: any = await this.http.post(`${API}/workflow/compare`, {
        doc_a_id: this.cmpDocA,
        doc_b_id: this.cmpDocB,
        label_a: this.cmpLabelA || undefined,
        label_b: this.cmpLabelB || undefined,
      }).toPromise();

      this.cmpResult = res;
      this.cmpRunId  = res.run_id;
      const s = res.stats;
      this._setStep(this.cmpSteps, 1, 'done',
        `${s.total} fields · ${s.match} match · ${s.mismatch} mismatch · match rate ${s.match_pct}%`);
    } catch (e: any) {
      this._setStep(this.cmpSteps, 1, 'error', e.message);
      this.cmpRunning = false; this.cdr.markForCheck(); return;
    }

    this._setStep(this.cmpSteps, 2, 'hitl', 'Waiting for human review…');
    this.hitlStep = this.cmpSteps[2];
    this.hitlOpen = true;
    this.cmpRunning = false;
    this.cdr.markForCheck();
  }

  async hitlApprove(): Promise<void> {
    this.hitlOpen = false;
    if (this.hitlStep) this._setStep(this.cmpSteps, 2, 'approved', 'Approved by user · proceeding to merge');
    this.hitlStep = null;
    this.cmpRunning = true;
    this.cdr.markForCheck();

    await this.http.post(`${API}/workflow/hitl/decision`, {
      run_id: this.cmpRunId, step_index: 3,
      decision: 'approve', feedback: this.hitlFeedback || null,
    }).toPromise().catch(() => {});

    this._setStep(this.cmpSteps, 3, 'running', 'Merging fields…');
    try {
      const overrideMap: Record<string, string> = {};
      for (const [key, val] of Object.entries(this.manualOverrides)) {
        if (val) overrideMap[key] = val;
      }
      const res: any = await this.http.post(`${API}/workflow/merge`, {
        doc_a_id: this.cmpDocA,
        doc_b_id: this.cmpDocB,
        strategy: this.mergeStrategy,
        overrides: Object.keys(overrideMap).length ? overrideMap : undefined,
      }).toPromise();
      this.mergeResult = res;
      this._setStep(this.cmpSteps, 3, 'done', `${res.total_fields} fields merged · ready for download`);
    } catch (e: any) {
      this._setStep(this.cmpSteps, 3, 'error', e.message);
    }
    this.cmpRunning = false;
    this.cdr.markForCheck();
  }

  hitlReject(): void {
    this.hitlOpen = false;
    if (this.hitlStep) this._setStep(this.cmpSteps, 2, 'rejected', `Rejected: ${this.hitlFeedback || 'no reason given'}`);
    this.hitlStep = null;
    this._setStep(this.cmpSteps, 3, 'pending', '');
    this.cmpRunning = false;
    this.http.post(`${API}/workflow/hitl/decision`, {
      run_id: this.cmpRunId, step_index: 3,
      decision: 'reject', feedback: this.hitlFeedback || null,
    }).subscribe();
    this.cdr.markForCheck();
  }

  downloadMerged(): void {
    if (!this.mergeResult) return;
    const rows: string[][] = this.mergeResult.csv_rows || [];
    const csv = rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'merged_document.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  setOverride(fieldKey: string, value: string): void {
    this.manualOverrides[fieldKey] = value;
  }

  // ── Three-Way Match workflow ──────────────────────────────────────────────

  resetTw(): void {
    this.twSteps = this.twSteps.map(s => ({ ...s, status: 'pending', result: undefined, log: undefined }));
    this.twResult = null; this.twHitlOpen = false;
    this.cdr.markForCheck();
  }

  async runThreeWay(): Promise<void> {
    if (!this.twInvoiceId) return;
    this.resetTw();
    this.twRunning = true;
    this.cdr.markForCheck();

    this._setStep(this.twSteps, 0, 'running', 'Loading documents…');
    await this._delay(500);
    this._setStep(this.twSteps, 0, 'done', `Invoice loaded${this.twPoId ? ' · PO loaded' : ''}${this.twReceiptId ? ' · Receipt loaded' : ''}`);

    this._setStep(this.twSteps, 1, 'running', 'Extracting line items and fields…');
    await this._delay(400);
    this._setStep(this.twSteps, 1, 'done', 'Fields extracted');

    this._setStep(this.twSteps, 2, 'running', 'Running three-way match…');
    try {
      const res: any = await this.http.post(`${API}/workflow/three-way-match`, {
        invoice_id:  this.twInvoiceId,
        po_id:       this.twPoId || undefined,
        receipt_id:  this.twReceiptId || undefined,
      }).toPromise();
      this.twResult = res;
      this._setStep(this.twSteps, 2, 'done',
        `${res.summary.matched} matched · ${res.summary.discrepancies} discrepancies`);
    } catch (e: any) {
      this._setStep(this.twSteps, 2, 'error', e.message);
      this.twRunning = false; this.cdr.markForCheck(); return;
    }

    if (this.twResult.hitl_required) {
      this._setStep(this.twSteps, 3, 'hitl', 'Discrepancies found — human review required');
      this.twHitlOpen = true;
      this.twRunning = false;
      this.cdr.markForCheck();
    } else {
      this._setStep(this.twSteps, 3, 'approved', 'No discrepancies — auto-approved');
      await this._finishThreeWay();
    }
  }

  async twApprove(): Promise<void> {
    this.twHitlOpen = false;
    this._setStep(this.twSteps, 3, 'approved', 'Approved by user');
    this.cdr.markForCheck();
    await this._finishThreeWay();
  }

  twReject(): void {
    this.twHitlOpen = false;
    this._setStep(this.twSteps, 3, 'rejected', 'Rejected — workflow stopped');
    this._setStep(this.twSteps, 4, 'pending', '');
    this.twRunning = false;
    this.cdr.markForCheck();
  }

  private async _finishThreeWay(): Promise<void> {
    this.twRunning = true;
    this._setStep(this.twSteps, 4, 'running', 'Generating match report…');
    await this._delay(600);
    const s = this.twResult?.summary;
    this._setStep(this.twSteps, 4, 'done', `Report complete · Status: ${s?.status || 'DONE'}`);
    this.twRunning = false;
    this.cdr.markForCheck();
  }

  downloadTwReport(): void {
    if (!this.twResult) return;
    const lines = [
      `THREE-WAY MATCH REPORT — ${new Date().toLocaleDateString()}`,
      `Status: ${this.twResult.summary?.status}`,
      '',
      'MATCHED FIELDS:',
      ...(this.twResult.matches || []).map((m: any) => `  ✓ ${m.field}`),
      '',
      'DISCREPANCIES:',
      ...(this.twResult.discrepancies || []).map((d: any) =>
        `  ✗ ${d.field}: ${Object.entries(d.values).map(([k,v]) => `${k}=${v}`).join(' | ')}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'three_way_match_report.txt'; a.click();
  }

  // ── Bank Reconciliation workflow ──────────────────────────────────────────

  resetRec(): void {
    this.recSteps = this.recSteps.map(s => ({ ...s, status: 'pending', result: undefined, log: undefined }));
    this.recResult = null; this.recHitlOpen = false;
    this.cdr.markForCheck();
  }

  async runReconcile(): Promise<void> {
    if (!this.recStatementId || !this.recLedgerId) return;
    this.resetRec();
    this.recRunning = true;
    this.cdr.markForCheck();

    this._setStep(this.recSteps, 0, 'running', 'Loading statement and ledger…');
    await this._delay(500);
    this._setStep(this.recSteps, 0, 'done', `${this.docName(this.recStatementId)} + ${this.docName(this.recLedgerId)}`);

    this._setStep(this.recSteps, 1, 'running', 'Comparing balances…');
    try {
      const res: any = await this.http.post(`${API}/workflow/reconcile`, {
        statement_id: this.recStatementId,
        ledger_id:    this.recLedgerId,
      }).toPromise();
      this.recResult = res;
      this._setStep(this.recSteps, 1, 'done', `Balance diff: ${res.summary.balance_diff}`);
    } catch (e: any) {
      this._setStep(this.recSteps, 1, 'error', e.message);
      this.recRunning = false; this.cdr.markForCheck(); return;
    }

    this._setStep(this.recSteps, 2, 'running', 'Matching transactions…');
    await this._delay(400);
    this._setStep(this.recSteps, 2, 'done',
      `${this.recResult.summary.unmatched_statement} unmatched in statement · ${this.recResult.summary.unmatched_ledger} in ledger`);

    if (this.recResult.hitl_required) {
      this._setStep(this.recSteps, 3, 'hitl', 'Discrepancies require review');
      this.recHitlOpen = true;
      this.recRunning = false;
      this.cdr.markForCheck();
    } else {
      this._setStep(this.recSteps, 3, 'approved', 'Auto-approved — balanced');
      await this._finishRec();
    }
  }

  async recApprove(): Promise<void> {
    this.recHitlOpen = false;
    this._setStep(this.recSteps, 3, 'approved', 'Signed off by user');
    this.cdr.markForCheck();
    await this._finishRec();
  }

  recReject(): void {
    this.recHitlOpen = false;
    this._setStep(this.recSteps, 3, 'rejected', 'Rejected — discrepancies unresolved');
    this._setStep(this.recSteps, 4, 'pending', '');
    this.recRunning = false;
    this.cdr.markForCheck();
  }

  private async _finishRec(): Promise<void> {
    this.recRunning = true;
    this._setStep(this.recSteps, 4, 'running', 'Generating reconciliation sign-off…');
    await this._delay(700);
    this._setStep(this.recSteps, 4, 'done', 'Reconciliation complete · PDF ready');
    this.recRunning = false;
    this.cdr.markForCheck();
  }

  downloadRecReport(): void {
    if (!this.recResult) return;
    const r = this.recResult;
    const lines = [
      `BANK RECONCILIATION REPORT — ${new Date().toLocaleDateString()}`,
      `Statement: ${r.statement}`,
      `Ledger: ${r.ledger}`,
      `Balance (Statement): ${r.balance_statement ?? 'N/A'}`,
      `Balance (Ledger): ${r.balance_ledger ?? 'N/A'}`,
      `Difference: ${r.summary.balance_diff}`,
      `Status: ${r.summary.status}`,
      '',
      'UNMATCHED IN STATEMENT:',
      ...(r.unmatched_statement || []).map((t: any) => `  ${t.date}  ${t.description}  ${t.amount}`),
      '',
      'UNMATCHED IN LEDGER:',
      ...(r.unmatched_ledger || []).map((t: any) => `  ${t.date}  ${t.description}  ${t.amount}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'reconciliation_report.txt'; a.click();
  }

  // ── utilities ─────────────────────────────────────────────────────────────

  private _setStep(steps: WfStep[], idx: number, status: WfStep['status'], log: string): void {
    if (steps[idx]) { steps[idx] = { ...steps[idx], status, log }; }
  }

  private _delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  stepIcon(status: WfStep['status']): string {
    return ({ pending:'○', running:'…', done:'✓', hitl:'👤', approved:'✓', rejected:'✗', error:'✗' })[status] || '○';
  }

  fieldKeys(fields: Record<string, string>): string[] {
    return Object.keys(fields || {});
  }
}
