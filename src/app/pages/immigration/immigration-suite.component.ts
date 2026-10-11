import { Component, Input, OnChanges, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

type Section = 'cases' | 'crm' | 'forms' | 'esign' | 'reports' | 'ai' | 'translate';

/** Immigration practice tools: cases, CRM, intake forms, e-signature, reports, AI drafting, translations. */
@Component({
  selector: 'app-immigration-suite',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './immigration-suite.component.html',
  styleUrls: ['./immigration-suite.component.scss'],
})
export class ImmigrationSuiteComponent implements OnInit, OnChanges {
  @Input() section: Section = 'cases';
  readonly api = 'http://localhost:8000/api/immigration-suite';

  meta: any = { statuses: [], lead_stages: [], languages: {}, case_types: {} };
  error = '';
  busy = false;

  // cases
  cases: any[] = [];
  suggestions: any[] = [];
  caseQuery = '';
  caseStatus = '';
  selected: any = null;
  newCase: any = null;
  note = '';
  intakeLang = 'en';
  lastLink: { kind: string; url: string; warning?: string } | null = null;
  sigForm = { title: '', signer_name: '', signer_email: '', document_id: '' };
  docs: any[] = [];

  // official forms
  caseForms: string[] = [];
  ff: any = null;              // { form, report, edits: {key: value} }

  // packet
  pk: any = null;              // { items: [{type,id,title,on,note}], preparer, letter }
  pkBusy = false;

  // crm
  leads: any[] = [];
  newLead: any = null;

  // forms / esign / reports
  intakes: any[] = [];
  intakeView: any = null;
  fq = { case_id: '', beneficiary: '', case_type: 'h1b_extension', language: 'en' };
  sq = { case_id: '', beneficiary: '', case_type: 'h1b_extension', document_id: '', title: '', signer_name: '', signer_email: '' };
  readonly sigTitles = ['Engagement letter', 'Form G-28 (Notice of Entry of Appearance)', 'Fee agreement',
    'Client authorization / consent', 'Declaration / affidavit (review copy)', 'Document receipt acknowledgement'];
  signatures: any[] = [];
  report: any = null;

  // ai / translate
  aiCase = '';
  aiKind = 'client_update';
  aiInstr = '';
  aiOut: any = null;
  trText = '';
  trLang = 'es';
  trOut: any = null;

  readonly draftKinds = [
    { id: 'client_update', label: 'Client update email' },
    { id: 'case_summary', label: 'Internal case summary' },
    { id: 'support_letter', label: 'Employer support letter outline' },
    { id: 'rfe_outline', label: 'RFE response outline' },
  ];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.http.get<any>(`${this.api}/meta`).subscribe({ next: m => (this.meta = m), error: e => this.fail(e) });
  }

  ngOnChanges() {
    this.error = '';
    this.lastLink = null;
    if (this.section === 'cases' || this.section === 'ai') this.loadCases();
    if (this.section === 'cases') this.loadSuggestions();
    if (this.section === 'crm') this.loadLeads();
    if (this.section === 'forms') { this.loadIntakes(); this.loadCases(); }
    if (this.section === 'esign') { this.loadSignatures(); this.loadCases(); this.loadDocs(); }
    if (this.section === 'reports') this.http.get<any>(`${this.api}/report`).subscribe({ next: d => (this.report = d), error: e => this.fail(e) });
  }

  // ── helpers ──────────────────────────────────────────────────────────────
  fail(e: any) {
    this.busy = false;
    this.error = e?.error?.detail || (e?.status === 401 ? 'Please sign in again.' : `Something went wrong (${e?.status || 'network'}).`);
  }
  label(s: string) { return (s || '').replace(/_/g, ' '); }
  types() { return Object.entries(this.meta.case_types).map(([id, v]: any) => ({ id, ...v })); }
  langs() { return Object.entries(this.meta.languages).map(([id, name]) => ({ id, name })); }
  daysText(d: number) { return d < 0 ? `${-d} days ago` : d === 0 ? 'today' : `in ${d} days`; }
  copy(url: string) { navigator.clipboard?.writeText(url); }
  openLink(url: string) { window.open(url, '_blank', 'noopener'); }
  download(url: string, name: string) {
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); URL.revokeObjectURL(a.href); },
      error: e => this.fail(e),
    });
  }

  // ── cases ────────────────────────────────────────────────────────────────
  loadCases() {
    const params: any = {};
    if (this.caseQuery) params.q = this.caseQuery;
    if (this.caseStatus) params.status = this.caseStatus;
    this.http.get<any[]>(`${this.api}/cases`, { params }).subscribe({ next: d => (this.cases = d), error: e => this.fail(e) });
  }
  loadSuggestions() { this.http.get<any[]>(`${this.api}/cases/suggestions`).subscribe({ next: d => (this.suggestions = d) }); }
  startCase(prefill: any = {}) { this.newCase = { case_type: 'h1b_extension', beneficiary: '', petitioner: '', expiry_date: '', ...prefill }; }
  createCase() {
    this.busy = true;
    const body = { ...this.newCase };
    Object.keys(body).forEach(k => body[k] === '' && delete body[k]);
    this.http.post<any>(`${this.api}/cases`, body).subscribe({
      next: c => { this.busy = false; this.newCase = null; this.loadCases(); this.loadSuggestions(); this.open(c); },
      error: e => this.fail(e),
    });
  }
  open(c: any) {
    this.lastLink = null;
    const changed = this.selected?.id !== c.id;
    this.http.get<any>(`${this.api}/cases/${c.id}`).subscribe({
      next: d => { this.selected = d; if (changed) { this.pk = null; this.loadForms(); } }, error: e => this.fail(e) });
    this.loadDocs();
  }
  loadDocs() {
    if (this.docs.length) return;
    this.http.get<any>('http://localhost:8000/api/documents').subscribe({
      next: r => (this.docs = (Array.isArray(r) ? r : r.documents || []).filter((d: any) => d.status === 'completed')),
    });
  }
  /** Signing request on an existing case, or open a case for a new person first. */
  sendSignature() {
    this.busy = true; this.lastLink = null;
    const body: any = { title: this.sq.title.trim(), signer_name: (this.sq.signer_name || this.sq.beneficiary).trim(),
                        signer_email: this.sq.signer_email || null };
    if (this.sq.document_id) body.document_id = this.sq.document_id;
    const send = (caseId: string) => this.http.post<any>(`${this.api}/cases/${caseId}/signatures`, body).subscribe({
      next: r => { this.busy = false; this.lastLink = { kind: 'Signing link', url: r.link, warning: r.warning }; this.loadSignatures(); this.loadCases();
                   this.sq = { ...this.sq, title: '', document_id: '' }; },
      error: e => this.fail(e),
    });
    if (this.sq.case_id) { send(this.sq.case_id); return; }
    this.http.post<any>(`${this.api}/cases`, { beneficiary: this.sq.beneficiary.trim(), case_type: this.sq.case_type }).subscribe({
      next: c => { this.sq.case_id = c.id; send(c.id); }, error: e => this.fail(e),
    });
  }
  loadForms() {
    this.caseForms = []; this.ff = null;
    this.http.get<any>(`${this.api}/cases/${this.selected.id}/forms`).subscribe({ next: r => (this.caseForms = r.forms || []) });
  }
  openForm(form: string) {
    this.http.get<any>(`${this.api}/cases/${this.selected.id}/forms/${form}`).subscribe({
      next: r => (this.ff = { form, report: r, edits: {} }), error: e => this.fail(e),
    });
  }
  ffGroups() {
    const g: any = {};
    for (const f of this.ff.report.fields) (g[f.group] = g[f.group] || []).push(f);
    return Object.entries(g).map(([name, fields]) => ({ name, fields }));
  }
  ffEdit(f: any, v: string) { this.ff.edits[f.key] = v; }
  saveForm(then?: () => void) {
    this.http.patch<any>(`${this.api}/cases/${this.selected.id}/forms/${this.ff.form}`, { values: this.ff.edits }).subscribe({
      next: r => { this.ff.report = r; this.ff.edits = {}; then && then(); }, error: e => this.fail(e),
    });
  }
  downloadForm() {
    const go = () => this.download(`${this.api}/cases/${this.selected.id}/forms/${this.ff.form}/pdf`,
      `${this.ff.form}_${this.selected.beneficiary.replace(/\W+/g, '_')}.pdf`);
    Object.keys(this.ff.edits).length ? this.saveForm(go) : go();
  }

  refresh() { if (this.selected) this.open(this.selected); this.loadCases(); }
  save(field: string, value: any) {
    this.http.patch<any>(`${this.api}/cases/${this.selected.id}`, { [field]: value || null }).subscribe({
      next: d => { this.selected = d; this.loadCases(); }, error: e => this.fail(e),
    });
  }
  addNote() {
    if (!this.note.trim()) return;
    this.http.post(`${this.api}/cases/${this.selected.id}/notes`, { text: this.note }).subscribe({
      next: () => { this.note = ''; this.refresh(); }, error: e => this.fail(e),
    });
  }
  toggle(item: any) {
    this.http.patch(`${this.api}/cases/${this.selected.id}/checklist/${item.id}`, { done: !item.done }).subscribe({
      next: () => this.refresh(), error: e => this.fail(e),
    });
  }
  matchDocs() {
    this.http.post<any>(`${this.api}/cases/${this.selected.id}/match-documents`, {}).subscribe({
      next: r => { this.refresh(); this.error = r.matched ? '' : 'No uploaded documents matched the remaining checklist items.'; },
      error: e => this.fail(e),
    });
  }
  sendIntake() {
    this.http.post<any>(`${this.api}/cases/${this.selected.id}/intake`, { language: this.intakeLang }).subscribe({
      next: r => { this.lastLink = { kind: 'Intake questionnaire', url: r.link, warning: r.warning }; this.refresh(); }, error: e => this.fail(e),
    });
  }
  requestSignature() {
    const b: any = { ...this.sigForm };
    if (!b.document_id) delete b.document_id;
    this.http.post<any>(`${this.api}/cases/${this.selected.id}/signatures`, b).subscribe({
      next: r => { this.lastLink = { kind: 'Signing link', url: r.link, warning: r.warning }; this.sigForm = { title: '', signer_name: '', signer_email: '', document_id: '' }; this.refresh(); },
      error: e => this.fail(e),
    });
  }
  deleteCase() {
    if (!confirm(`Delete the case for ${this.selected.beneficiary}? This removes its timeline, checklist, intakes and signature requests.`)) return;
    this.http.delete(`${this.api}/cases/${this.selected.id}`).subscribe({
      next: () => { this.selected = null; this.loadCases(); }, error: e => this.fail(e),
    });
  }

  // ── packet ───────────────────────────────────────────────────────────────
  openPacket() {
    this.http.get<any>(`${this.api}/cases/${this.selected.id}/packet/sources`).subscribe({
      next: src => {
        const items = [
          ...src.builtins.map((b: any) => ({ ...b, on: b.type !== 'letter' })),
          ...src.intakes.map((i: any) => ({ ...i, on: true })),
          ...src.documents.filter((d: any) => d.related).map((d: any) => ({ ...d, on: !!d.evidence_for, note: d.evidence_for })),
        ];
        this.pk = { items, others: src.documents.filter((d: any) => !d.related), preparer: '', letter: '', addId: '' };
      },
      error: e => this.fail(e),
    });
  }
  pkMove(i: number, dir: number) {
    const a = this.pk.items, j = i + dir;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
  }
  pkAdd() {
    const d = this.pk.others.find((x: any) => x.id === this.pk.addId);
    if (!d) return;
    this.pk.items.push({ ...d, on: true });
    this.pk.others = this.pk.others.filter((x: any) => x.id !== d.id);
    this.pk.addId = '';
  }
  pkCount() { return this.pk.items.filter((i: any) => i.on).length; }
  pkLetterOn() { return this.pk.items.some((i: any) => i.type === 'letter' && i.on); }
  draftCoverLetter() {
    this.pkBusy = true;
    const enclosures = this.pk.items.filter((i: any) => i.on && !['cover', 'toc', 'letter'].includes(i.type))
      .map((i: any, n: number) => `${n + 1}. ${i.note || i.title}`).join('\n');
    this.http.post<any>(`${this.api}/cases/${this.selected.id}/draft`,
      { kind: 'cover_letter', instructions: `Enclosures, in this order:\n${enclosures}` }).subscribe({
      next: r => { this.pkBusy = false; this.pk.letter = r.draft; }, error: e => { this.pkBusy = false; this.fail(e); },
    });
  }
  buildPacket() {
    this.pkBusy = true;
    const items = this.pk.items.filter((i: any) => i.on).map((i: any) => ({ type: i.type, id: i.id }));
    this.http.post(`${this.api}/cases/${this.selected.id}/packet`,
      { items, preparer: this.pk.preparer || null, letter_text: this.pk.letter }, { responseType: 'blob' }).subscribe({
      next: b => {
        this.pkBusy = false;
        const a = document.createElement('a'); a.href = URL.createObjectURL(b);
        a.download = `Packet_${this.selected.beneficiary.replace(/\W+/g, '_')}_${this.selected.form || 'case'}.pdf`;
        a.click(); URL.revokeObjectURL(a.href); this.refresh();
      },
      error: async e => {
        this.pkBusy = false;
        try { e = { ...e, error: JSON.parse(await e.error.text()) }; } catch {}
        this.fail(e);
      },
    });
  }

  // ── crm ──────────────────────────────────────────────────────────────────
  loadLeads() { this.http.get<any[]>(`${this.api}/leads`).subscribe({ next: d => (this.leads = d), error: e => this.fail(e) }); }
  leadsIn(stage: string) { return this.leads.filter(l => l.stage === stage); }
  startLead() { this.newLead = { name: '', email: '', phone: '', interest: '', source: '', language: 'en', next_follow_up: '', notes: '' }; }
  createLead() {
    const b = { ...this.newLead };
    Object.keys(b).forEach(k => b[k] === '' && delete b[k]);
    this.http.post(`${this.api}/leads`, b).subscribe({ next: () => { this.newLead = null; this.loadLeads(); }, error: e => this.fail(e) });
  }
  moveLead(l: any, stage: string) {
    this.http.patch(`${this.api}/leads/${l.id}`, { stage }).subscribe({ next: () => this.loadLeads(), error: e => this.fail(e) });
  }
  convert(l: any) {
    const ct = l.interest || prompt('Case type to open (e.g. h1b_extension, i485):') || '';
    if (!ct) return;
    this.http.post<any>(`${this.api}/leads/${l.id}/convert`, { case_type: ct }).subscribe({
      next: () => this.loadLeads(), error: e => this.fail(e),
    });
  }
  removeLead(l: any) {
    if (!confirm(`Delete ${l.name}?`)) return;
    this.http.delete(`${this.api}/leads/${l.id}`).subscribe({ next: () => this.loadLeads(), error: e => this.fail(e) });
  }

  // ── forms / esign ────────────────────────────────────────────────────────
  loadIntakes() { this.http.get<any[]>(`${this.api}/intakes`).subscribe({ next: d => (this.intakes = d), error: e => this.fail(e) }); }
  questionCount(t: any) { return t.sections.reduce((n: number, s: any) => n + s.questions.length, 0); }
  scrollTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
  /** Send to an existing case, or open a case for a new person first. */
  sendQuestionnaire() {
    this.busy = true; this.lastLink = null;
    const send = (caseId: string) => this.http.post<any>(`${this.api}/cases/${caseId}/intake`, { language: this.fq.language }).subscribe({
      next: r => { this.busy = false; this.lastLink = { kind: 'Questionnaire link', url: r.link, warning: r.warning }; this.loadIntakes(); this.loadCases(); },
      error: e => this.fail(e),
    });
    if (this.fq.case_id) { send(this.fq.case_id); return; }
    this.http.post<any>(`${this.api}/cases`, { beneficiary: this.fq.beneficiary.trim(), case_type: this.fq.case_type }).subscribe({
      next: c => { this.fq.case_id = c.id; send(c.id); }, error: e => this.fail(e),
    });
  }
  viewIntake(i: any) { this.http.get<any>(`${this.api}/intakes/${i.id}`).subscribe({ next: d => (this.intakeView = d), error: e => this.fail(e) }); }
  loadSignatures() { this.http.get<any[]>(`${this.api}/signatures`).subscribe({ next: d => (this.signatures = d), error: e => this.fail(e) }); }
  voidSig(s: any) {
    if (!confirm(`Cancel the signature request “${s.title}”?`)) return;
    this.http.post(`${this.api}/signatures/${s.id}/void`, {}).subscribe({ next: () => this.loadSignatures(), error: e => this.fail(e) });
  }

  // ── ai / translate ───────────────────────────────────────────────────────
  runDraft() {
    if (!this.aiCase) { this.error = 'Choose a case first.'; return; }
    this.busy = true; this.aiOut = null;
    this.http.post<any>(`${this.api}/cases/${this.aiCase}/draft`, { kind: this.aiKind, instructions: this.aiInstr }).subscribe({
      next: r => { this.busy = false; this.aiOut = r; }, error: e => this.fail(e),
    });
  }
  runTranslate() {
    this.busy = true; this.trOut = null;
    this.http.post<any>(`${this.api}/translate`, { text: this.trText, language: this.trLang }).subscribe({
      next: r => { this.busy = false; this.trOut = r; }, error: e => this.fail(e),
    });
  }
  maxCount(rows: any[]) { return Math.max(1, ...rows.map(r => r.count)); }
}
