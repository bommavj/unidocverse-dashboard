import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { authFetch } from '../../../lib/api';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './clients.component.html',
  styleUrls: ['./clients.component.scss']
})
export class ClientsComponent implements OnInit, OnDestroy {

  clients:  any[] = [];
  filtered: any[] = [];
  loading   = false;
  searchQ   = '';
  filterType   = '';
  filterStatus = '';
  sortBy       = 'name_asc';

  showAddForm = false;
  saving      = false;
  newClient = {
    client_type:   'personal',
    first_name:    '',
    last_name:     '',
    business_name: '',
    business_type: '',
    email:         '',
    phone:         '',
    city:          '',
    state:         '',
    assigned_agent:'',
    status:        'active',
    avatar_color:  '#6366f1',
  };

  unlinkedDocs:   any[] = [];
  showImportPanel = false;
  bannerDismissed = false;

  globalAiOpen    = false;
  globalAiInput   = '';
  globalAiLoading = false;
  globalMsgs: { role: 'user' | 'ai'; text: string; time: Date }[] = [];
  activeAiClient: any = null;

  private sub?: Subscription;
  private readonly api = 'http://localhost:8000';

  readonly AVATAR_COLORS = [
    '#6366f1','#0891b2','#16a34a','#d97706',
    '#dc2626','#7c3aed','#db2777','#0284c7'
  ];

  constructor(
    public  toast:  ToastService,
    private http:   HttpClient,
    private router: Router,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadUnlinkedDocs();
    this.sub = interval(60_000).subscribe(() => this.silentRefresh());
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  // ── Data ──────────────────────────────────────────────────────────────────

  load(): void {
    this.loading = true;
    this.http.get<any>(`${this.api}/api/ams/clients`).subscribe({
      next: res => {
        this.clients = res.clients || [];
        this.applyFilter();
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  silentRefresh(): void {
    this.http.get<any>(`${this.api}/api/ams/clients`).subscribe({
      next: res => { this.clients = res.clients || []; this.applyFilter(); },
      error: () => {}
    });
  }

  applyFilter(): void {
    let list = [...this.clients];
    if (this.searchQ.trim()) {
      const q = this.searchQ.toLowerCase();
      const terms = q.split(/\s+/).filter(t => t);
      list = list.filter(c =>
        terms.every(term =>
          c.display_name?.toLowerCase().includes(term) ||
          c.email?.toLowerCase().includes(term) ||
          c.phone?.includes(term) ||
          c.client_number?.toLowerCase().includes(term) ||
          c.business_name?.toLowerCase().includes(term)
        )
      );
    }
    if (this.filterType)   list = list.filter(c => c.client_type === this.filterType);
    if (this.filterStatus) list = list.filter(c => c.status === this.filterStatus);
    
    list.sort((a, b) => {
      if (this.sortBy === 'name_asc') {
        return (a.display_name || '').localeCompare(b.display_name || '');
      }
      if (this.sortBy === 'name_desc') {
        return (b.display_name || '').localeCompare(a.display_name || '');
      }
      if (this.sortBy === 'premium_desc') {
        return (b.total_premium || 0) - (a.total_premium || 0);
      }
      if (this.sortBy === 'policies_desc') {
        return (b.policy_count || 0) - (a.policy_count || 0);
      }
      return 0;
    });

    this.filtered = list;
  }

  // ── Create ────────────────────────────────────────────────────────────────

  openAddForm(): void {
    this.showAddForm = true;
    this.newClient = {
      client_type: 'personal', first_name: '', last_name: '',
      business_name: '', business_type: '', email: '', phone: '',
      city: '', state: '', assigned_agent: '', status: 'active',
      avatar_color: this.AVATAR_COLORS[Math.floor(Math.random() * this.AVATAR_COLORS.length)]
    };
  }

  saveClient(): void {
    const c = this.newClient;
    if (c.client_type === 'personal' && !c.first_name) {
      this.toast.error('First name is required'); return;
    }
    if (c.client_type === 'commercial' && !c.business_name) {
      this.toast.error('Business name is required'); return;
    }
    this.saving = true;
    this.http.post<any>(`${this.api}/api/ams/clients`, c).subscribe({
      next: client => {
        this.clients.unshift(client);
        this.applyFilter();
        this.showAddForm = false;
        this.saving = false;
        this.toast.success(`Client ${client.client_number} created`);
      },
      error: () => { this.saving = false; this.toast.error('Failed to create client'); }
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  openClient(client: any): void {
    this.router.navigate(['/clients', client.id]);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  deleteClient(client: any, e: Event): void {
    e.stopPropagation();
    client._confirming = true;
  }

  cancelDelete(client: any, e: Event): void {
    e.stopPropagation();
    client._confirming = false;
  }

  confirmDelete(client: any, e: Event): void {
    e.stopPropagation();
    client._deleting = true;
    this.http.delete(`${this.api}/api/ams/clients/${client.id}`).subscribe({
      next: () => {
        this.toast.show('Client deleted', 'success');
        this.clients = this.clients.filter(c => c.id !== client.id);
        this.applyFilter();
      },
      error: () => {
        this.toast.show('Delete failed', 'error');
        client._deleting = false;
        client._confirming = false;
      },
    });
  }

  // ── Gap Analysis ──────────────────────────────────────────────────────────

  runGapAnalysis(client: any, e: Event): void {
    e.stopPropagation();
    client._analyzing = true;
    client._gapResult = null;
    this.http.post<any>(`${this.api}/api/ams/gap/analyze/${client.id}`, {}).subscribe({
      next: r => {
        client._analyzing = false;
        client._gapResult = r;
        this.toast.show(`Gap analysis: Grade ${r.grade}`, 'success');
      },
      error: () => {
        client._analyzing = false;
        this.toast.show('Gap analysis failed', 'error');
      }
    });
  }

  viewGapDetail(client: any, e: Event): void {
    e.stopPropagation();
    this.router.navigate(['/gap-analysis'], { queryParams: { client: client.id } });
  }

  // ── Loss Run ──────────────────────────────────────────────────────────────

  goToLossRun(client: any, e: Event): void {
    e.stopPropagation();
    this.router.navigate(['/loss-runs'], { queryParams: { client: client.id } });
  }

  // ── COI ───────────────────────────────────────────────────────────────────

  goToCOI(client: any, e: Event): void {
    e.stopPropagation();
    this.router.navigate(['/coi'], { queryParams: { client: client.id, tab: 'generate' } });
  }

  // ── Suggest docs ──────────────────────────────────────────────────────────

  suggestDocs(client: any, e: Event): void {
    e.stopPropagation();
    this.http.post<any>(`${this.api}/api/ams/clients/${client.id}/suggest-docs`, {}).subscribe({
      next: res => this.toast.success(`${res.suggested_count} doc(s) suggested`),
      error: () => this.toast.error('Failed to run suggestion'),
    });
  }

  // ── Agency import ─────────────────────────────────────────────────────────

  loadUnlinkedDocs(): void {
    this.http.get<any>(`${this.api}/api/documents?doc_type=declarations_page&status=completed`).subscribe({
      next: res => {
        const docs     = res.documents || [];
        const unlinked = docs.filter((d: any) => d.client_link_status !== 'confirmed');
        unlinked.forEach((doc: any) => {
          if (this.unlinkedDocs.find(u => u.id === doc.id)) return;
          this.http.get<any>(`${this.api}/api/agency/preview-from-document/${doc.id}`).subscribe({
            next: preview => {
              if (preview.eligible)
                this.unlinkedDocs.push({ id: doc.id, filename: doc.filename, preview, creating: false, created: false, error: null });
            },
            error: () => {}
          });
        });
      },
      error: () => {}
    });
  }

  createFromDoc(item: any): void {
    item.creating = true;
    item.error    = null;
    this.http.post<any>(`${this.api}/api/agency/create-from-document/${item.id}`, {}).subscribe({
      next: res => {
        item.creating = false;
        item.created  = true;
        this.toast.success(`✓ ${res.client.display_name} — ${res.policy.policy_number} created`);
        this.load();
        const allDone = this.unlinkedDocs.every(u => u.created);
        if (allDone) setTimeout(() => { this.showImportPanel = false; this.unlinkedDocs = []; }, 2000);
      },
      error: err => { item.creating = false; item.error = err.error?.detail || 'Failed'; }
    });
  }

  dismissDoc(item: any): void {
    this.unlinkedDocs = this.unlinkedDocs.filter(u => u.id !== item.id);
    if (this.unlinkedDocs.length === 0) this.showImportPanel = false;
  }

  // ── Global Ask AI Panel ───────────────────────────────────────────────────

  askAI(client: any, e: Event): void {
    e.stopPropagation();
    if (this.globalAiOpen && this.activeAiClient?.id === client.id) {
      this.closeGlobalAI();
      return;
    }
    this.activeAiClient = client;
    this.globalAiOpen   = true;
    this.globalMsgs     = [];
    this.initGlobalChat();

    // Load full policy details so AI has real data — not just summary stats
    if (!client.policies) {
      this.http.get<any>(`${this.api}/api/ams/policies?client_id=${client.id}`).subscribe({
        next: res => { client.policies = res.policies || []; },
        error: () => {}
      });
    }
  }

  openGlobalAI(client?: any): void {
    this.activeAiClient = client || null;
    this.globalAiOpen   = true;
    if (this.globalMsgs.length === 0) this.initGlobalChat();
  }

  closeGlobalAI(): void {
    this.globalAiOpen   = false;
    this.activeAiClient = null;
  }

  initGlobalChat(): void {
    const name = this.activeAiClient?.display_name;
    this.globalMsgs = [{
      role: 'ai',
      text: name
        ? `👋 Hi! Ask me anything about ${name} — policies, renewals, coverage gaps, or risk.`
        : `👋 Hi! Ask me anything about your client portfolio — renewals, premiums, risk, or gaps.`,
      time: new Date(),
    }];
  }

  clearGlobalChat(): void {
    this.globalMsgs = [];
    this.initGlobalChat();
  }

  sendGlobalAI(): void {
    const q = this.globalAiInput.trim();
    if (!q || this.globalAiLoading) return;

    this.globalAiInput = '';
    this.globalMsgs.push({ role: 'user', text: q, time: new Date() });
    this.globalAiLoading = true;
    this.globalMsgs.push({ role: 'ai', text: '', time: new Date() });
    const idx = this.globalMsgs.length - 1;

    const context = this.activeAiClient
      ? this._buildClientContext(this.activeAiClient)
      : this._buildPortfolioContext();

    authFetch(`${this.api}/api/documents/ask/with-context`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ question: q, context_data: context }),
    })
    .then(r => {
      if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
      const reader  = r.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';
      const pump = (): Promise<void> =>
        reader.read().then(({ done, value }) => {
          if (done) { this.globalAiLoading = false; return; }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const obj = JSON.parse(line.slice(6));
              if (obj.token) this.globalMsgs[idx] = { ...this.globalMsgs[idx], text: this.globalMsgs[idx].text + obj.token };
              if (obj.done)  this.globalAiLoading = false;
              if (obj.error) { this.globalMsgs[idx] = { role: 'ai', text: `⚠ ${obj.error}`, time: new Date() }; this.globalAiLoading = false; }
            } catch {}
          }
          return pump();
        });
      return pump();
    })
    .catch(err => {
      this.globalMsgs[idx] = { role: 'ai', text: `⚠ ${err.message}`, time: new Date() };
      this.globalAiLoading = false;
    });
  }

  // ── Context builders — real data, no hallucination ────────────────────────

  private _buildClientContext(client: any): any {
    return {
      client_name:          client.display_name,
      client_number:        client.client_number,
      client_type:          client.client_type,
      status:               client.status,
      email:                client.email     || null,
      phone:                client.phone     || null,
      city:                 client.city      || null,
      state:                client.state     || null,
      total_premium:        client.total_premium  || 0,
      nearest_renewal_days: client.nearest_renewal_days,
      // Real policy details — prevent LLM hallucination
      policies: (client.policies || []).map((p: any) => ({
        policy_number:    p.policy_number,
        line_of_business: p.line_of_business,
        carrier_name:     p.carrier_name,
        premium_amount:   p.premium_amount,
        expiry_date:      p.expiry_date,
        days_to_expiry:   p.days_to_expiry,
        status:           p.status,
        renewal_status:   p.renewal_status,
        coverage_summary: p.coverage_summary || {},
      })),
    };
  }

  private _buildPortfolioContext(): any {
    return {
      total_clients:  this.clients.length,
      active:         this.activeCount,
      total_premium:  this.totalPremium,
      expiring_30:    this.renewalCount,
      by_status: this.clients.reduce((acc: any, c: any) => {
        acc[c.status] = (acc[c.status] || 0) + 1; return acc;
      }, {}),
      // Top expiring clients — real names and dates
      expiring_soon: this.clients
        .filter(c => c.nearest_renewal_days != null && c.nearest_renewal_days <= 30)
        .map(c => ({
          name:    c.display_name,
          number:  c.client_number,
          days:    c.nearest_renewal_days,
          premium: c.total_premium,
        })),
    };
  }

  onGlobalAIKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendGlobalAI(); }
  }

  exportChat(): void {
    const lines = this.globalMsgs
      .filter(m => m.text)
      .map(m => `[${m.role.toUpperCase()}] ${m.time.toLocaleTimeString()}\n${m.text}`)
      .join('\n\n---\n\n');
    const blob = new Blob([lines], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `ai-chat-${this.activeAiClient?.display_name || 'portfolio'}-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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
        this.applyFilter();
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

  // ── Helpers ───────────────────────────────────────────────────────────────

  initials(client: any): string {
    const name: string = client.display_name || '';
    return name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  }

  renewalColor(days: number | null): string {
    if (days === null) return '';
    if (days <= 7)  return '#dc2626';
    if (days <= 30) return '#d97706';
    return '#16a34a';
  }

  get totalPremium(): number { return this.clients.reduce((s, c) => s + (c.total_premium || 0), 0); }
  get activeCount():  number { return this.clients.filter(c => c.status === 'active').length; }
  get renewalCount(): number { return this.clients.filter(c => c.nearest_renewal_days != null && c.nearest_renewal_days <= 30).length; }
}