import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './client-detail.component.html',
  styleUrls: ['./client-detail.component.scss']
})
export class ClientDetailComponent implements OnInit {
  private readonly api = 'http://localhost:8000';

  clientId = '';
  client:      any    = null;
  policies:    any[]  = [];
  documents:   any[]  = [];
  lossRuns:    any[]  = [];
  gapAnalysis: any    = null;
  gapRecs:     any[]  = [];
  cois:        any[]  = [];
  notes:       any[]  = [];

  immigration: any[] = [];
  immigrationSummary: any = {};
  immigrationLoading = false;
  showAddImmigration = false;
  savingImmigration  = false;
  newImm: any = {
    doc_type: 'h1b', doc_label: '', document_number: '', visa_class: '',
    beneficiary_name: '', employer_sponsor: '', issuing_authority: '',
    issue_date: '', valid_from: '', valid_until: '', authorized_stay_until: '',
    priority_date: '', status: 'active', notes: '',
  };

  readonly IMM_TYPES = [
    { value: 'h1b',        label: 'H-1B Specialty Occupation' },
    { value: 'l1a',        label: 'L-1A Intracompany Manager' },
    { value: 'l1b',        label: 'L-1B Intracompany Specialist' },
    { value: 'o1',         label: 'O-1 Extraordinary Ability' },
    { value: 'tn',         label: 'TN NAFTA Professional' },
    { value: 'f1',         label: 'F-1 Student Visa' },
    { value: 'i20',        label: 'I-20 Student Authorization' },
    { value: 'j1',         label: 'J-1 Exchange Visitor' },
    { value: 'ds2019',     label: 'DS-2019 J-1 Authorization' },
    { value: 'ead',        label: 'EAD Work Authorization Card' },
    { value: 'i94',        label: 'I-94 Arrival/Departure Record' },
    { value: 'green_card', label: 'Green Card (LPR)' },
    { value: 'passport',   label: 'Passport' },
    { value: 'b1b2',       label: 'B-1/B-2 Visitor Visa' },
    { value: 'i797',       label: 'I-797 Notice of Action' },
    { value: 'i140',       label: 'I-140 Immigrant Petition' },
    { value: 'i485',       label: 'I-485 Adjustment of Status' },
    { value: 'h4',         label: 'H-4 Dependent' },
    { value: 'other',      label: 'Other' },
  ];

  loading   = false;
  analyzing = false;
  activeTab: 'overview' | 'policies' | 'documents' | 'loss-runs' | 'gap' | 'coi' | 'notes' | 'immigration' = 'overview';

  // Edit mode
  editing = false;
  saving  = false;
  editData: any = {};

  // Notes
  notesLoading  = false;
  addingNote    = false;
  newNote = { note_type: 'note', title: '', body: '' };
  readonly NOTE_TYPES = [
    { value: 'note',    label: '📋 Note' },
    { value: 'call',    label: '📞 Call' },
    { value: 'email',   label: '📧 Email' },
    { value: 'meeting', label: '🤝 Meeting' },
    { value: 'task',    label: '✅ Task' },
  ];

  readonly LINES: Record<string, string> = {
    homeowners: '🏠 Homeowners', auto: '🚗 Auto',
    commercial_property: '🏢 Commercial Property',
    general_liability: '⚖️ General Liability',
    bop: '🏢 BOP', workers_comp: '👷 Workers Comp',
    umbrella: '☂️ Umbrella', life: '💼 Life',
    health: '🏥 Health', landlord: '🔑 Landlord', other: '📋 Other',
  };

  constructor(
    private route:  ActivatedRoute,
    private router: Router,
    private http:   HttpClient,
    public  toast:  ToastService,
  ) {}

  ngOnInit() {
    this.clientId = this.route.snapshot.params['id'];
    this.loadAll();
  }

  loadAll() {
    this.loading = true;
    this.http.get<any>(`${this.api}/api/ams/clients/${this.clientId}`).subscribe({
      next: r => { this.client = r; this.editData = { ...r }; this.loading = false; },
      error: () => { this.loading = false; this.router.navigate(['/clients']); }
    });
    this.http.get<any>(`${this.api}/api/ams/policies?client_id=${this.clientId}`).subscribe({
      next: r => this.policies = r.policies || [],
    });
    this.http.get<any>(`${this.api}/api/documents?client_id=${this.clientId}&limit=20`).subscribe({
      next: r => this.documents = r.documents || [],
      error: () => {}
    });
    this.http.get<any>(`${this.api}/api/ams/lossrun/client/${this.clientId}`).subscribe({
      next: r => this.lossRuns = r.loss_runs || [],
      error: () => {}
    });
    this.http.get<any>(`${this.api}/api/ams/gap/client/${this.clientId}`).subscribe({
      next: r => { this.gapAnalysis = r.analysis; this.gapRecs = r.recommendations || []; },
      error: () => {}
    });
    this.http.get<any>(`${this.api}/api/ams/coi/client/${this.clientId}`).subscribe({
      next: r => this.cois = r.certificates || [],
      error: () => {}
    });
    this.loadNotes();
    this.loadImmigration();
  }

  // ── Immigration ───────────────────────────────────────────────────────────

  loadImmigration(): void {
    this.immigrationLoading = true;
    this.http.get<any>(`${this.api}/api/immigration/client/${this.clientId}`).subscribe({
      next: r => {
        this.immigration        = r.records || [];
        this.immigrationSummary = r.summary || {};
        this.immigrationLoading = false;
      },
      error: () => { this.immigrationLoading = false; }
    });
  }

  saveImmigration(): void {
    this.savingImmigration = true;
    const payload = { ...this.newImm };
    // strip empty strings to null so backend doesn't choke
    Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null; });
    this.http.post<any>(`${this.api}/api/immigration/client/${this.clientId}`, payload).subscribe({
      next: rec => {
        this.immigration.unshift(rec);
        this.immigrationSummary.total = (this.immigrationSummary.total || 0) + 1;
        this.showAddImmigration = false;
        this.savingImmigration  = false;
        this.newImm = { doc_type: 'h1b', doc_label: '', document_number: '',
          visa_class: '', beneficiary_name: '', employer_sponsor: '',
          issuing_authority: '', issue_date: '', valid_from: '', valid_until: '',
          authorized_stay_until: '', priority_date: '', status: 'active', notes: '' };
        this.toast.show('Immigration record added', 'success');
      },
      error: () => { this.savingImmigration = false; this.toast.show('Save failed', 'error'); }
    });
  }

  deleteImmigration(rec: any): void {
    if (!confirm(`Delete ${rec.doc_label}?`)) return;
    this.http.delete(`${this.api}/api/immigration/${rec.id}`).subscribe({
      next: () => {
        this.immigration = this.immigration.filter(r => r.id !== rec.id);
        this.toast.show('Record deleted', 'success');
      },
      error: () => this.toast.show('Delete failed', 'error')
    });
  }

  urgencyClass(u: string): string {
    return { expired: 'imm-expired', critical: 'imm-critical',
             high: 'imm-high', medium: 'imm-medium', low: 'imm-low' }[u] || '';
  }

  // ── Notes ─────────────────────────────────────────────────────────────────

  loadNotes(): void {
    this.notesLoading = true;
    this.http.get<any>(`${this.api}/api/ams/clients/${this.clientId}/notes`).subscribe({
      next: r => { this.notes = r.notes || []; this.notesLoading = false; },
      error: () => { this.notesLoading = false; }
    });
  }

  saveNote(): void {
    if (!this.newNote.body.trim()) {
      this.toast.show('Note body is required', 'error'); return;
    }
    this.addingNote = true;
    this.http.post<any>(`${this.api}/api/ams/clients/${this.clientId}/notes`, this.newNote).subscribe({
      next: note => {
        this.notes.unshift({ ...note, created_at: new Date().toISOString() });
        this.newNote = { note_type: 'note', title: '', body: '' };
        this.addingNote = false;
        this.toast.show('Note added', 'success');
      },
      error: () => { this.addingNote = false; this.toast.show('Failed to add note', 'error'); }
    });
  }

  deleteNote(note: any): void {
    if (note.source !== 'manual') return;
    this.http.delete(`${this.api}/api/ams/clients/${this.clientId}/notes/${note.id}`).subscribe({
      next: () => {
        this.notes = this.notes.filter(n => n.id !== note.id);
        this.toast.show('Note deleted', 'success');
      },
      error: () => this.toast.show('Delete failed', 'error')
    });
  }

  // ── Edit ──────────────────────────────────────────────────────────────────

  startEdit() { this.editData = { ...this.client }; this.editing = true; }
  cancelEdit() { this.editing = false; }

  saveEdit() {
    this.saving = true;
    this.http.put<any>(`${this.api}/api/ams/clients/${this.clientId}`, this.editData).subscribe({
      next: r => {
        this.client  = r;
        this.editing = false;
        this.saving  = false;
        this.toast.show('Client updated', 'success');
      },
      error: () => { this.toast.show('Save failed', 'error'); this.saving = false; }
    });
  }

  // ── Gap Analysis ──────────────────────────────────────────────────────────

  runGapAnalysis() {
    this.analyzing = true;
    this.http.post<any>(`${this.api}/api/ams/gap/analyze/${this.clientId}`, {}).subscribe({
      next: r => {
        this.gapAnalysis = r;
        this.gapRecs     = r.gaps || [];
        this.analyzing   = false;
        this.activeTab   = 'gap';
        this.toast.show(`Gap analysis: Grade ${r.grade}`, 'success');
      },
      error: () => { this.analyzing = false; }
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  get displayName(): string {
    if (!this.client) return '';
    return this.client.client_type === 'commercial'
      ? this.client.business_name || ''
      : `${this.client.first_name || ''} ${this.client.last_name || ''}`.trim();
  }

  get initials(): string {
    const n = this.displayName;
    const parts = n.split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : n.slice(0, 2).toUpperCase();
  }

  get totalPremium(): number {
    return this.policies.reduce((s, p) => s + (p.premium_amount || 0), 0);
  }

  get activePolicies(): number {
    return this.policies.filter(p => p.status === 'active').length;
  }

  get nearestRenewal(): number | null {
    const days = this.policies
      .map(p => p.days_to_expiry)
      .filter(d => d != null && d >= 0);
    return days.length ? Math.min(...days) : null;
  }

  lobLabel(lob: string): string { return this.LINES[lob] || lob; }

  fmtCurrency(v: any): string {
    if (!v) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(+v);
  }

  expiryClass(days: number | null): string {
    if (days == null) return '';
    if (days <= 7)  return 'expiry-danger';
    if (days <= 30) return 'expiry-warn';
    return '';
  }

  fmtDate(iso: string): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  }

  getPriorityClass(p: string): string {
    return { critical: 'badge-red', high: 'badge-orange', medium: 'badge-yellow', low: 'badge-green' }[p] || 'badge-gray';
  }

  getRiskClass(level: string): string {
    return { critical: 'badge-red', high: 'badge-orange', medium: 'badge-yellow', low: 'badge-green' }[level] || 'badge-gray';
  }

  getGradeClass(g: string): string {
    return { A: 'grade-a', B: 'grade-b', C: 'grade-c', D: 'grade-d', F: 'grade-f' }[g] || '';
  }

  goBack() { this.router.navigate(['/clients']); }
}

/* import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './client-detail.component.html',
  styleUrls: ['./client-detail.component.scss']
})
export class ClientDetailComponent implements OnInit {
  private readonly api = 'http://localhost:8000';

  clientId = '';
  client: any = null;
  policies: any[] = [];
  documents: any[] = [];
  lossRuns: any[] = [];
  gapAnalysis: any = null;
  gapRecs: any[] = [];
  cois: any[] = [];
  activities: any[] = [];

  loading = false;
  analyzing = false;
  activeTab: 'overview' | 'policies' | 'documents' | 'loss-runs' | 'gap' | 'coi' = 'overview';

  // Edit mode
  editing = false;
  saving  = false;
  editData: any = {};

  readonly LINES: Record<string, string> = {
    homeowners: '🏠 Homeowners', auto: '🚗 Auto',
    commercial_property: '🏢 Commercial Property',
    general_liability: '⚖️ General Liability',
    bop: '🏢 BOP', workers_comp: '👷 Workers Comp',
    umbrella: '☂️ Umbrella', life: '💼 Life',
    health: '🏥 Health', landlord: '🔑 Landlord', other: '📋 Other',
  };

  constructor(
    private route:  ActivatedRoute,
    private router: Router,
    private http:   HttpClient,
    public  toast:  ToastService,
  ) {}

  ngOnInit() {
    this.clientId = this.route.snapshot.params['id'];
    this.loadAll();
  }

  loadAll() {
    this.loading = true;
    // Client details
    this.http.get<any>(`${this.api}/api/ams/clients/${this.clientId}`).subscribe({
      next: r => { this.client = r; this.editData = { ...r }; this.loading = false; },
      error: () => { this.loading = false; this.router.navigate(['/clients']); }
    });
    // Policies
    this.http.get<any>(`${this.api}/api/ams/policies?client_id=${this.clientId}`).subscribe({
      next: r => this.policies = r.policies || [],
    });
    // Documents
    this.http.get<any>(`${this.api}/api/documents?client_id=${this.clientId}&limit=20`).subscribe({
      next: r => this.documents = r.documents || [],
      error: () => {}
    });
    // Loss runs
    this.http.get<any>(`${this.api}/api/ams/lossrun/client/${this.clientId}`).subscribe({
      next: r => this.lossRuns = r.loss_runs || [],
      error: () => {}
    });
    // Gap analysis
    this.http.get<any>(`${this.api}/api/ams/gap/client/${this.clientId}`).subscribe({
      next: r => { this.gapAnalysis = r.analysis; this.gapRecs = r.recommendations || []; },
      error: () => {}
    });
    // COIs
    this.http.get<any>(`${this.api}/api/ams/coi/client/${this.clientId}`).subscribe({
      next: r => this.cois = r.certificates || [],
      error: () => {}
    });
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  startEdit() { this.editData = { ...this.client }; this.editing = true; }
  cancelEdit() { this.editing = false; }

  saveEdit() {
    this.saving = true;
    this.http.put<any>(`${this.api}/api/ams/clients/${this.clientId}`, this.editData).subscribe({
      next: r => {
        this.client = r;
        this.editing = false;
        this.saving = false;
        this.toast.show('Client updated', 'success');
      },
      error: () => { this.toast.show('Save failed', 'error'); this.saving = false; }
    });
  }

  // ── Gap Analysis ──────────────────────────────────────────────────────────
  runGapAnalysis() {
    this.analyzing = true;
    this.http.post<any>(`${this.api}/api/ams/gap/analyze/${this.clientId}`, {}).subscribe({
      next: r => {
        this.gapAnalysis = r;
        this.gapRecs = r.gaps || [];
        this.analyzing = false;
        this.activeTab = 'gap';
        this.toast.show(`Gap analysis: Grade ${r.grade}`, 'success');
      },
      error: () => { this.analyzing = false; }
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  get displayName(): string {
    if (!this.client) return '';
    return this.client.client_type === 'commercial'
      ? this.client.business_name || ''
      : `${this.client.first_name || ''} ${this.client.last_name || ''}`.trim();
  }

  get initials(): string {
    const n = this.displayName;
    const parts = n.split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : n.slice(0, 2).toUpperCase();
  }

  get totalPremium(): number {
    return this.policies.reduce((s, p) => s + (p.premium_amount || 0), 0);
  }

  get activePolicies(): number {
    return this.policies.filter(p => p.status === 'active').length;
  }

  get nearestRenewal(): number | null {
    const days = this.policies
      .map(p => p.days_to_expiry)
      .filter(d => d != null && d >= 0);
    return days.length ? Math.min(...days) : null;
  }

  lobLabel(lob: string): string { return this.LINES[lob] || lob; }

  fmtCurrency(v: any): string {
    if (!v) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(+v);
  }

  expiryClass(days: number | null): string {
    if (days == null) return '';
    if (days <= 7)  return 'expiry-danger';
    if (days <= 30) return 'expiry-warn';
    return '';
  }

  getPriorityClass(p: string): string {
    return { critical: 'badge-red', high: 'badge-orange', medium: 'badge-yellow', low: 'badge-green' }[p] || 'badge-gray';
  }

  getRiskClass(level: string): string {
    return { critical: 'badge-red', high: 'badge-orange', medium: 'badge-yellow', low: 'badge-green' }[level] || 'badge-gray';
  }

  getGradeClass(g: string): string {
    return { A: 'grade-a', B: 'grade-b', C: 'grade-c', D: 'grade-d', F: 'grade-f' }[g] || '';
  }

  goBack() { this.router.navigate(['/clients']); }
} */