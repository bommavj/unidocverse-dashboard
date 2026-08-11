import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-policies',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './policies.component.html',
  styleUrls: ['./policies.component.scss']
})
export class PoliciesComponent implements OnInit, OnDestroy {

  policies: any[] = [];
  filtered: any[] = [];
  loading  = false;
  searchQ  = '';
  filterLob    = '';
  filterStatus = '';
  sortBy       = 'expiry';

  // Detail panel
  selectedPolicy: any = null;
  editing  = false;
  saving   = false;
  deleting = false;
  confirmingDelete = false;
  editData: any = {};
  showDeleted = false;

  // Add policy
  showAddForm = false;
  addSaving   = false;
  newPolicy = {
    policy_number:    '',
    client_id:        '',
    line_of_business: 'homeowners',
    carrier_name:     '',
    premium_amount:   null as number | null,
    premium_freq:     'annual',
    effective_date:   '',
    expiry_date:      '',
    status:           'active',
  };
  clients: any[] = [];

  private sub?: Subscription;
  private readonly api = 'http://localhost:8000';

  readonly LINES = [
    { id: 'homeowners',          label: '🏠 Homeowners' },
    { id: 'auto',                label: '🚗 Auto' },
    { id: 'commercial_property', label: '🏢 Commercial Property' },
    { id: 'general_liability',   label: '⚖️ General Liability' },
    { id: 'bop',                 label: '🏢 BOP' },
    { id: 'workers_comp',        label: '👷 Workers Comp' },
    { id: 'umbrella',            label: '☂️ Umbrella' },
    { id: 'life',                label: '💼 Life' },
    { id: 'health',              label: '🏥 Health' },
    { id: 'landlord',            label: '🔑 Landlord' },
    { id: 'other',               label: '📋 Other' },
  ];

  readonly STATUSES = ['quoted','bound','active','renewal_due','renewed','cancelled','lapsed','non_renewed'];

  constructor(
    public  toast:  ToastService,
    private http:   HttpClient,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadClients();
    this.sub = interval(60_000).subscribe(() => this.silentRefresh());
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  toggleShowDeleted(): void {
    this.showDeleted = !this.showDeleted;
    this.load();
  }

  // ── Data ──────────────────────────────────────────────────────────────────

  load(): void {
    this.loading = true;
    const params: any = {};
    if (this.showDeleted) 
      params['show_deleted'] = true;
    this.http.get<any>(`${this.api}/api/ams/policies`, { params }).subscribe({
      next: res => {
        this.policies = res.policies || [];
        this.applyFilter();
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  // ADD restore method:
  restorePolicy(policy: any, e: Event): void {
    e.stopPropagation();
    this.http.patch(`${this.api}/api/ams/policies/${policy.id}/restore`, {}).subscribe({
      next: () => {
        this.toast.show(`Policy ${policy.policy_number} restored`, 'success');
        this.load();
      },
      error: () => this.toast.show('Restore failed', 'error')
    });
  }

  silentRefresh(): void {
    this.http.get<any>(`${this.api}/api/ams/policies`).subscribe({
      next: res => { this.policies = res.policies || []; this.applyFilter(); },
      error: () => {}
    });
  }

  loadClients(): void {
    this.http.get<any>(`${this.api}/api/ams/clients?limit=200`).subscribe({
      next: r => this.clients = r.clients || [],
    });
  }

  applyFilter(): void {
    let list = [...this.policies];
    if (!this.showDeleted) list = list.filter(p => p.status !== 'deleted' && p.status !== 'cancelled');
    if (this.searchQ.trim()) {
      const q = this.searchQ.toLowerCase();
      const terms = q.split(/\s+/).filter(t => t);
      list = list.filter(p =>
        terms.every(term =>
          p.policy_number?.toLowerCase().includes(term) ||
          p.client_name?.toLowerCase().includes(term) ||
          p.carrier_name?.toLowerCase().includes(term)
        )
      );
    }
    if (this.filterLob)    list = list.filter(p => p.line_of_business === this.filterLob);
    if (this.filterStatus) list = list.filter(p => p.status === this.filterStatus);
    list.sort((a, b) => {
      if (this.sortBy === 'expiry')  return (a.days_to_expiry ?? 999) - (b.days_to_expiry ?? 999);
      if (this.sortBy === 'premium') return (b.premium_amount || 0) - (a.premium_amount || 0);
      if (this.sortBy === 'client')  return (a.client_name || '').localeCompare(b.client_name || '');
      return 0;
    });
    this.filtered = list;
  }

  // ── Select / Detail ───────────────────────────────────────────────────────

  selectPolicy(p: any, e: Event): void {
    e.stopPropagation();
    this.selectedPolicy = p;
    this.editing = false;
    this.editData = { ...p };
  }

  closePanel(): void {
    this.selectedPolicy = null;
    this.editing = false;
  }

  // ── Edit ──────────────────────────────────────────────────────────────────

  startEdit(): void {
    this.editData = { ...this.selectedPolicy };
    this.editing = true;
  }

  cancelEdit(): void { this.editing = false; }

  saveEdit(): void {
    this.saving = true;
    this.http.put<any>(`${this.api}/api/ams/policies/${this.selectedPolicy.id}`, this.editData).subscribe({
      next: r => {
        // Update in-place
        const idx = this.policies.findIndex(p => p.id === this.selectedPolicy.id);
        if (idx > -1) this.policies[idx] = { ...this.policies[idx], ...this.editData };
        this.selectedPolicy = { ...this.selectedPolicy, ...this.editData };
        this.applyFilter();
        this.editing = false;
        this.saving = false;
        this.toast.show('Policy updated', 'success');
      },
      error: () => { this.toast.show('Save failed', 'error'); this.saving = false; }
    });
  }

  // ── Delete ────────────────────────────────────────────────────────────────


  deletePolicy(): void {
    this.confirmingDelete = true;
  }

  cancelDelete(): void {
    this.confirmingDelete = false;
  }

  confirmDelete(): void {
    this.deleting = true;
    this.http.delete(`${this.api}/api/ams/policies/${this.selectedPolicy.id}`).subscribe({
      next: () => {
        this.policies = this.policies.filter(p => p.id !== this.selectedPolicy.id);
        this.applyFilter();
        this.closePanel();
        this.toast.show("Policy deleted", "success");
        this.deleting = false;
        this.confirmingDelete = false;
      },
      error: () => {
        this.toast.show("Delete failed", "error");
        this.deleting = false;
        this.confirmingDelete = false;
      }
    });
  }

  // ── Add Policy ────────────────────────────────────────────────────────────

  saveNewPolicy(): void {
    if (!this.newPolicy.policy_number || !this.newPolicy.client_id) {
      this.toast.show('Policy number and client are required', 'error'); return;
    }
    this.addSaving = true;
    this.http.post<any>(`${this.api}/api/ams/policies`, this.newPolicy).subscribe({
      next: r => {
        this.toast.show('Policy created', 'success');
        this.addSaving = false;
        this.showAddForm = false;
        this.load();
      },
      error: () => { this.toast.show('Create failed', 'error'); this.addSaving = false; }
    });
  }

  // ── Renewal Status ────────────────────────────────────────────────────────

  updateRenewalStatus(policy: any, status: string, e: Event): void {
    e.stopPropagation();
    this.http.patch(`${this.api}/api/ams/policies/${policy.id}/renewal-status`,
      { renewal_status: status }
    ).subscribe({
      next: (res: any) => {
        policy.renewal_status = res.renewal_status;
        this.toast.show('Renewal status updated', 'success');
      },
      error: () => { this.toast.show('Failed to update status', 'error'); }
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  openClient(policy: any, e: Event): void {
    e.stopPropagation();
    this.router.navigate(['/clients', policy.client_id]);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  expiryClass(days: number | null): string {
    if (days == null) return '';
    if (days <= 7)  return 'expiry-danger';
    if (days <= 30) return 'expiry-warn';
    return '';
  }

  lobLabel(lob: string): string {
    return this.LINES.find(l => l.id === lob)?.label || lob;
  }

  fmtPremium(amount: number, freq: string): string {
    if (!amount) return '—';
    const f = freq === 'monthly' ? '/mo' : freq === 'semi_annual' ? '/6mo' : '/yr';
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}${f}`;
  }

  clientName(clientId: string): string {
    const c = this.clients.find(x => x.id === clientId);
    if (!c) return '';
    return c.business_name || `${c.first_name} ${c.last_name}`.trim();
  }

  get totalPremium():  number { return this.filtered.reduce((s, p) => s + (p.premium_amount || 0), 0); }
  get activeCount():   number { return this.filtered.filter(p => p.status === 'active').length; }
  get expiringCount(): number { return this.filtered.filter(p => p.days_to_expiry != null && p.days_to_expiry <= 30).length; }
  get urgentCount():   number { return this.filtered.filter(p => p.days_to_expiry != null && p.days_to_expiry <= 7).length; }

  // ADD these to PoliciesComponent class in policies.component.ts

// ── Ask AI ────────────────────────────────────────────────────────────────
aiOpen      = false;
aiInput     = '';
aiLoading   = false;
aiMsgs: { role: 'user' | 'ai'; text: string; time: Date }[] = [];

get aiContext(): string {
  if (this.selectedPolicy) {
    return `${this.lobLabel(this.selectedPolicy.line_of_business)} · ${this.selectedPolicy.policy_number} · ${this.selectedPolicy.client_name}`;
  }
  return `${this.policies.length} policies · $${this.totalPremium.toLocaleString()} total premium`;
}

toggleAI(): void {
  this.aiOpen = !this.aiOpen;
  if (this.aiOpen && this.aiMsgs.length === 0) {
    this.aiMsgs.push({
      role: 'ai',
      text: this.selectedPolicy
        ? `👋 Ask me anything about policy ${this.selectedPolicy.policy_number} for ${this.selectedPolicy.client_name}.`
        : `👋 Hi! I can help you analyze your policy portfolio. Ask me anything.`,
      time: new Date(),
    });
  }
}

// REPLACE the entire sendAI() method in policies.component.ts with this:

// REPLACE sendAI() and add private helpers in policies.component.ts

// REPLACE sendAI() in policies.component.ts
// Frontend just sends data — backend builds context based on shape

sendAI(): void {
  const q = this.aiInput.trim();
  if (!q || this.aiLoading) return;

  this.aiInput = '';
  this.aiMsgs.push({ role: 'user', text: q, time: new Date() });
  this.aiLoading = true;
  this.aiMsgs.push({ role: 'ai', text: '', time: new Date() });
  const aiIdx = this.aiMsgs.length - 1;

  const p = this.selectedPolicy;

  if (p && p.document_id) {
    // Per-document RAG — backend handles everything
    this._streamSSE(
      `${this.api}/api/documents/${p.document_id}/ask`,
      { question: q },
      aiIdx
    );
  } else if (p) {
    // Policy data — backend detects shape and builds prompt profile
    this._streamSSE(
      `${this.api}/api/documents/ask/with-context`,
      {
        question: q,
        context_data: {
          policy_number:    p.policy_number,
          client_name:      p.client_name,
          client_number:    p.client_number,
          carrier_name:     p.carrier_name,
          line_of_business: p.line_of_business,
          premium_amount:   p.premium_amount,
          premium_freq:     p.premium_freq,
          effective_date:   p.effective_date,
          expiry_date:      p.expiry_date,
          days_to_expiry:   p.days_to_expiry,
          status:           p.status,
          renewal_status:   p.renewal_status,
          assigned_agent:   p.assigned_agent,
          risk_score:       p.risk_score,
          coverage_summary: p.coverage_summary,
          notes:            p.notes,
        }
      },
      aiIdx
    );
  } else {
    // Portfolio view — backend detects shape and builds prompt profile
    const byLob = this.policies.reduce((acc: any, pol: any) => {
      const lbl = this.lobLabel(pol.line_of_business);
      acc[lbl] = (acc[lbl] || 0) + 1;
      return acc;
    }, {});

    this._streamSSE(
      `${this.api}/api/documents/ask/with-context`,
      {
        question: q,
        context_data: {
          total_policies:  this.policies.length,
          active:          this.activeCount,
          total_premium:   this.totalPremium,
          expiring_30:     this.expiringCount,
          expiring_7:      this.urgentCount,
          by_lob:          byLob,
          expiring_policies: this.policies
            .filter(pol => pol.days_to_expiry != null && pol.days_to_expiry <= 30)
            .map(pol => ({
              policy_number: pol.policy_number,
              client_name:   pol.client_name,
              days_to_expiry: pol.days_to_expiry,
            })),
          not_started_renewals: this.policies
            .filter(pol => pol.renewal_status === 'not_started'
                        && pol.days_to_expiry != null
                        && pol.days_to_expiry <= 90)
            .map(pol => ({
              policy_number: pol.policy_number,
              client_name:   pol.client_name,
              days_to_expiry: pol.days_to_expiry,
            })),
        }
      },
      aiIdx
    );
  }
}

private _streamSSE(url: string, body: any, aiIdx: number): void {
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  .then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!res.body) throw new Error('No response body');
    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    const pump = (): Promise<void> =>
      reader.read().then(({ done, value }) => {
        if (done) { this.aiLoading = false; return; }
        decoder.decode(value, { stream: true }).split('\n').forEach(line => {
          if (!line.trim().startsWith('data:')) return;
          try {
            const obj = JSON.parse(line.trim().slice(5).trim());
            if (obj.token) {
              this.aiMsgs[aiIdx] = {
                ...this.aiMsgs[aiIdx],
                text: this.aiMsgs[aiIdx].text + obj.token,
              };
            }
            if (obj.done)  this.aiLoading = false;
            if (obj.error) {
              this.aiMsgs[aiIdx] = { ...this.aiMsgs[aiIdx], text: `⚠ ${obj.error}` };
              this.aiLoading = false;
            }
          } catch { /* incomplete chunk */ }
        });
        return pump();
      });
    return pump();
  })
  .catch(err => {
    this.aiMsgs[aiIdx] = {
      role: 'ai',
      text: `⚠ Could not reach Q&A service: ${err.message}`,
      time: new Date(),
    };
    this.aiLoading = false;
  });
}


private _buildPolicyContext(): string {
  const p = this.selectedPolicy;
  const coverage = p.coverage_summary && Object.keys(p.coverage_summary).length
    ? Object.entries(p.coverage_summary)
        .map(([k, v]) => `  ${k}: $${Number(v).toLocaleString()}`)
        .join('\n')
    : '  No coverage details on file';

  return `[POLICY DATA — answer ONLY from this, no general insurance knowledge]
Policy:    ${p.policy_number}
Client:    ${p.client_name} (${p.client_number})
Line:      ${this.lobLabel(p.line_of_business)}
Carrier:   ${p.carrier_name}
Premium:   ${this.fmtPremium(p.premium_amount, p.premium_freq)}
Effective: ${p.effective_date}
Expiry:    ${p.expiry_date} (${p.days_to_expiry} days)
Status:    ${p.status}
Renewal:   ${p.renewal_status}
Agent:     ${p.assigned_agent || 'None'}
Coverage:
${coverage}
Notes: ${p.notes || 'None'}
[END DATA]`;
}

private _buildPortfolioContext(): string {
  const byLob = this.policies.reduce((acc: any, p: any) => {
    acc[this.lobLabel(p.line_of_business)] = (acc[this.lobLabel(p.line_of_business)] || 0) + 1;
    return acc;
  }, {});

  const expiring = this.policies
    .filter(p => p.days_to_expiry != null && p.days_to_expiry <= 30)
    .map(p => `  ${p.policy_number} — ${p.client_name} (${p.days_to_expiry}d)`)
    .join('\n') || '  None';

  const notStarted = this.policies
    .filter(p => p.renewal_status === 'not_started'
              && p.days_to_expiry != null
              && p.days_to_expiry <= 90)
    .map(p => `  ${p.policy_number} — ${p.client_name} (${p.days_to_expiry}d)`)
    .join('\n') || '  None';

  return `[PORTFOLIO DATA — answer ONLY from this]
Total Policies:  ${this.policies.length}
Active:          ${this.activeCount}
Total Premium:   $${this.totalPremium.toLocaleString()}
Expiring ≤30d:   ${this.expiringCount}
Urgent ≤7d:      ${this.urgentCount}

By Line:
${Object.entries(byLob).map(([k, v]) => `  ${k}: ${v}`).join('\n')}

Expiring Soon:
${expiring}

Renewals Not Started (≤90d):
${notStarted}
[END DATA]`;
}

onAIKey(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendAI(); }
}

clearAI(): void {
  this.aiMsgs = [{ role: 'ai', text: '👋 Chat cleared. Ask me anything.', time: new Date() }];
}
}