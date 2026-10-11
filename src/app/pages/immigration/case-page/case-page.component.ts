// Immigration case page — everything about one case on one screen
import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../../services/toast.service';

const API = 'http://localhost:7979/api/immigration-suite';

type Tab = 'overview' | 'tasks' | 'forms' | 'documents' | 'signatures' | 'activity';
interface NextStep { text: string; who: string; tone: 'bad' | 'warn' | 'neutral'; when: string; tab: Tab; }

// Progress bar stages, and which stage each case status sits in
const STAGES = ['Intake', 'Preparing', 'Ready to file', 'Filed', 'RFE', 'Decision'];
const STAGE_OF: Record<string, number> = {
  intake: 0, preparing: 1, ready_to_file: 2, filed: 3, rfe: 4, rfe_responded: 4, approved: 5, denied: 5, withdrawn: 5,
};

@Component({
  selector: 'app-immigration-case-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './case-page.component.html',
  styleUrls: ['./case-page.component.scss'],
})
export class ImmigrationCasePageComponent implements OnInit {
  readonly stages = STAGES;
  id = '';
  c: any = null;
  error = '';
  tab: Tab = 'overview';
  statuses: string[] = [];

  forms: { form: string; filled?: number; total?: number; missing?: string[]; edition_ok?: boolean }[] = [];
  openForm = '';                       // form whose fields are expanded for review
  formFields: any[] = [];
  formEdits: Record<string, string> = {};
  steps: NextStep[] = [];

  // Inline edit of case details
  editing = false;
  draftDetails: any = {};

  // Tasks
  readonly roles = ['attorney', 'paralegal', 'client', 'petitioner', 'other'];
  roleFilter = '';
  showDone = false;
  newTask = { title: '', role: 'paralegal', assignee: '', due_date: '' };

  // Activity
  note = '';

  // Signatures
  sigForm = { title: '', signer_name: '', signer_email: '' };
  showSigForm = false;

  // Actions
  busy = '';
  link: { label: string; url: string; warning?: string } | null = null;
  letter: { kind: string; text: string } | null = null;

  constructor(private route: ActivatedRoute, private router: Router, private http: HttpClient,
              private cdr: ChangeDetectorRef, private toast: ToastService) {}

  ngOnInit(): void {
    this.http.get<any>(`${API}/meta`).subscribe({ next: m => { this.statuses = m.statuses || []; this.cdr.markForCheck(); } });
    // One-level URL (/immigration-case?id=…): the app is built with baseHref './' for the desktop
    // build, so deeper paths can't be reloaded directly.
    this.route.queryParamMap.subscribe(p => {
      const id = p.get('id') || '';
      if (id && id !== this.id) { this.id = id; this.load(); }
    });
    this.route.queryParamMap.subscribe(p => {
      const t = p.get('tab') as Tab;
      if (t && ['overview', 'tasks', 'forms', 'documents', 'signatures', 'activity'].includes(t)) { this.tab = t; this.cdr.markForCheck(); }
    });
  }

  // ── Data ──────────────────────────────────────────────────────────────────
  load(): void {
    this.http.get<any>(`${API}/cases/${this.id}`).subscribe({
      next: c => { this.c = c; this.error = ''; this.buildSteps(); this.cdr.markForCheck(); this.loadForms(); },
      error: e => { this.error = e?.status === 404 ? 'This case was not found.' : 'Could not load this case.'; this.cdr.markForCheck(); },
    });
  }

  loadForms(): void {
    this.http.get<{ forms: string[] }>(`${API}/cases/${this.id}/forms`).subscribe({
      next: r => {
        this.forms = (r.forms || []).map(form => ({ form }));
        this.forms.forEach(f => this.http.get<any>(`${API}/cases/${this.id}/forms/${f.form}`).subscribe({
          next: p => { Object.assign(f, { filled: p.filled, total: p.total, missing: p.missing_required || [], edition_ok: p.edition_ok });
                       this.buildSteps(); this.cdr.markForCheck(); },
        }));
        this.cdr.markForCheck();
      },
    });
  }

  /** Overview "Next steps": what is due, and from whom, built from the case's own data. */
  buildSteps(): void {
    if (!this.c) return;
    const out: NextStep[] = [];
    for (const d of this.c.deadlines || []) {
      if (d.days <= 45) out.push({ text: d.what, who: 'Deadline', tab: 'overview',
        tone: d.days < 0 ? 'bad' : d.days <= 14 ? 'warn' : 'neutral', when: d.days < 0 ? `${-d.days}d overdue` : `in ${d.days}d` });
    }
    for (const t of (this.c.tasks || []).filter((t: any) => !t.done && t.days !== null && t.days <= 7)) {
      out.push({ text: t.title, who: this.label(t.role) + (t.assignee ? ` · ${t.assignee}` : ''), tab: 'tasks',
        tone: t.days < 0 ? 'bad' : t.days <= 2 ? 'warn' : 'neutral', when: t.days < 0 ? `${-t.days}d overdue` : t.days === 0 ? 'Due today' : `Due in ${t.days}d` });
    }
    const pendingIntake = (this.c.intakes || []).find((i: any) => i.status !== 'submitted');
    if (pendingIntake) out.push({ text: 'Client to complete the intake questionnaire', who: 'Client', tone: 'warn', tab: 'overview',
      when: `${pendingIntake.answered || 0} answered` });
    if (!(this.c.intakes || []).length) out.push({ text: 'Send the intake questionnaire to the client', who: 'You', tone: 'neutral', tab: 'overview', when: 'Not sent' });
    for (const s of this.c.signatures || []) {
      if (!['signed', 'voided', 'declined'].includes(s.status)) out.push({ text: `Signature: ${s.title}`, who: s.signer_name || 'Signer',
        tone: 'warn', tab: 'signatures', when: s.status === 'viewed' ? 'Viewed, not signed' : 'Sent' });
    }
    for (const f of this.forms) {
      if (f.missing && f.missing.length) out.push({ text: `Form ${f.form}: ${f.missing.length} required field${f.missing.length === 1 ? '' : 's'} blank`,
        who: 'You', tone: 'warn', tab: 'forms', when: 'Review' });
    }
    const missing = (this.c.checklist || []).filter((i: any) => !i.done);
    missing.slice(0, 3).forEach((i: any) => out.push({ text: `Collect: ${i.item}`, who: 'Client', tone: 'neutral', tab: 'documents', when: 'Evidence' }));
    if (missing.length > 3) out.push({ text: `${missing.length - 3} more evidence items outstanding`, who: 'Client', tone: 'neutral', tab: 'documents', when: '' });
    const rank = { bad: 0, warn: 1, neutral: 2 };
    this.steps = out.sort((a, b) => rank[a.tone] - rank[b.tone]);
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  get stage(): number { return STAGE_OF[this.c?.status] ?? 0; }
  get decision(): string {
    const s = this.c?.status;
    return s === 'approved' ? 'Approved' : s === 'denied' ? 'Denied' : s === 'withdrawn' ? 'Withdrawn' : 'Decision';
  }
  get initials(): string {
    return (this.c?.beneficiary || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
  }
  get openTasks(): any[] { return (this.c?.tasks || []).filter((t: any) => !t.done); }
  get doneTasks(): any[] { return (this.c?.tasks || []).filter((t: any) => t.done); }
  get shownTasks(): any[] { return this.openTasks.filter((t: any) => !this.roleFilter || t.role === this.roleFilter); }
  roleCount(r: string): number { return this.openTasks.filter((t: any) => t.role === r).length; }
  get evidenceDone(): number { return (this.c?.checklist || []).filter((i: any) => i.done).length; }
  get formsReady(): number { return this.forms.filter(f => f.missing && !f.missing.length).length; }
  get openSignatures(): number { return (this.c?.signatures || []).filter((s: any) => !['signed', 'voided', 'declined'].includes(s.status)).length; }
  label(s: string): string { return (s || '').replace(/_/g, ' ').replace(/^./, m => m.toUpperCase()); }

  setTab(t: Tab): void {
    this.tab = t;
    this.router.navigate([], { queryParams: { tab: t === 'overview' ? null : t }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  // ── Case details ──────────────────────────────────────────────────────────
  setStatus(status: string): void { this.patch({ status }, `Status changed to ${this.label(status)}`); }

  startEdit(): void {
    const c = this.c;
    this.draftDetails = { petitioner: c.petitioner, visa_class: c.visa_class, receipt_number: c.receipt_number,
      filed_date: c.filed_date, priority_date: c.priority_date, expiry_date: c.expiry_date, rfe_due_date: c.rfe_due_date,
      decision_date: c.decision_date };
    this.editing = true;
  }

  saveDetails(): void {
    const body: any = {};
    for (const [k, v] of Object.entries(this.draftDetails)) if ((v ?? '') !== (this.c[k] ?? '')) body[k] = v || null;
    if (!Object.keys(body).length) { this.editing = false; return; }
    this.patch(body, 'Case details saved', () => this.editing = false);
  }

  private patch(body: any, msg: string, then?: () => void): void {
    this.http.patch<any>(`${API}/cases/${this.id}`, body).subscribe({
      next: () => { this.toast.success(msg); then?.(); this.load(); },
      error: e => this.toast.error(e?.error?.detail || 'Could not save the change'),
    });
  }

  // ── Header actions ────────────────────────────────────────────────────────
  sendIntake(): void {
    this.busy = 'intake';
    this.http.post<any>(`${API}/cases/${this.id}/intake`, { language: 'en' }).subscribe({
      next: r => { this.busy = ''; this.link = { label: 'Intake link for the client', url: r.url || r.link, warning: r.warning }; this.load(); },
      error: e => { this.busy = ''; this.toast.error(e?.error?.detail || 'Could not create the intake link'); this.cdr.markForCheck(); },
    });
  }

  draftLetter(kind = 'cover_letter'): void {
    this.busy = 'draft';
    this.http.post<any>(`${API}/cases/${this.id}/draft`, { kind }).subscribe({
      next: r => { this.busy = ''; this.letter = { kind, text: r.draft || '' }; this.cdr.markForCheck(); },
      error: e => { this.busy = ''; this.toast.error(e?.error?.detail || 'Could not draft the letter'); this.cdr.markForCheck(); },
    });
  }

  /** One-click packet: cover, contents, checklist, every auto-filled form, intake answers and matched evidence. */
  buildPacket(): void {
    this.busy = 'packet';
    this.http.get<any>(`${API}/cases/${this.id}/packet/sources`).subscribe({
      next: src => {
        const items = [
          ...(src.builtins || []).filter((b: any) => b.type !== 'letter' || this.letter?.kind === 'cover_letter'),
          ...(src.intakes || []),
          ...(src.documents || []).filter((d: any) => d.evidence_for),
        ].map((x: any) => ({ type: x.type, id: x.id }));
        const body = { items, letter_text: this.letter?.kind === 'cover_letter' ? this.letter.text : '' };
        this.http.post(`${API}/cases/${this.id}/packet`, body, { responseType: 'blob' }).subscribe({
          next: blob => { this.busy = ''; this.save(blob, `packet_${this.slug()}.pdf`); this.toast.success('Filing packet built'); this.load(); },
          error: () => { this.busy = ''; this.toast.error('Could not build the packet'); this.cdr.markForCheck(); },
        });
      },
      error: () => { this.busy = ''; this.toast.error('Could not load packet sources'); this.cdr.markForCheck(); },
    });
  }

  copy(text: string): void {
    navigator.clipboard.writeText(text).then(() => this.toast.success('Copied'));
  }

  // ── Forms ─────────────────────────────────────────────────────────────────
  downloadForm(form: string): void {
    this.http.get(`${API}/cases/${this.id}/forms/${form}/pdf`, { responseType: 'blob' }).subscribe({
      next: b => { this.save(b, `${form}_${this.slug()}.pdf`); this.load(); },
      error: () => this.toast.error(`Could not generate Form ${form}`),
    });
  }

  /** Expand a form to review and edit its fields inline. */
  toggleForm(form: string): void {
    if (this.openForm === form) { this.openForm = ''; return; }
    this.openForm = form; this.formFields = []; this.formEdits = {};
    this.http.get<any>(`${API}/cases/${this.id}/forms/${form}`).subscribe({
      next: p => { this.formFields = p.fields || []; this.cdr.markForCheck(); },
      error: () => this.toast.error(`Could not load Form ${form}`),
    });
  }

  fieldGroups(): { group: string; fields: any[] }[] {
    const map = new Map<string, any[]>();
    for (const f of this.formFields) { const g = f.group || 'Other'; if (!map.has(g)) map.set(g, []); map.get(g)!.push(f); }
    return [...map.entries()].map(([group, fields]) => ({ group, fields }));
  }

  saveForm(form: string): void {
    const values = Object.fromEntries(Object.entries(this.formEdits).filter(([k, v]) =>
      (v ?? '') !== (this.formFields.find(f => f.key === k)?.value ?? '')));
    if (!Object.keys(values).length) { this.toast.info('No changes to save'); return; }
    this.http.patch<any>(`${API}/cases/${this.id}/forms/${form}`, { values }).subscribe({
      next: () => { this.toast.success(`Form ${form} saved`); this.openForm = ''; this.loadForms(); },
      error: e => this.toast.error(e?.error?.detail || 'Could not save the form'),
    });
  }

  // ── Documents / evidence ──────────────────────────────────────────────────
  toggleItem(item: any): void {
    this.http.patch(`${API}/cases/${this.id}/checklist/${item.id}`, { done: !item.done }).subscribe({ next: () => this.load() });
  }

  matchDocs(): void {
    this.busy = 'match';
    this.http.post<any>(`${API}/cases/${this.id}/match-documents`, {}).subscribe({
      next: r => { this.busy = ''; this.toast.success(`${r.matched || 0} evidence item${r.matched === 1 ? '' : 's'} matched to documents`); this.load(); },
      error: () => { this.busy = ''; this.toast.error('Could not match documents'); this.cdr.markForCheck(); },
    });
  }

  // ── Signatures ────────────────────────────────────────────────────────────
  requestSignature(): void {
    const f = this.sigForm;
    if (!f.title.trim() || !f.signer_name.trim()) { this.toast.error('Enter what to sign and who signs'); return; }
    this.busy = 'sign';
    this.http.post<any>(`${API}/cases/${this.id}/signatures`, f).subscribe({
      next: r => { this.busy = ''; this.showSigForm = false; this.sigForm = { title: '', signer_name: '', signer_email: '' };
                   this.link = { label: `Signing link for ${f.signer_name}`, url: r.url || r.link, warning: r.warning }; this.load(); },
      error: e => { this.busy = ''; this.toast.error(e?.error?.detail || 'Could not create the signature request'); this.cdr.markForCheck(); },
    });
  }

  certificate(s: any): void {
    this.http.get(`${API}/signatures/${s.id}/certificate`, { responseType: 'blob' }).subscribe({
      next: b => this.save(b, `signed_${this.slug()}.pdf`), error: () => this.toast.error('Certificate not available'),
    });
  }

  voidSignature(s: any): void {
    if (!confirm(`Void the signature request "${s.title}"? The link stops working.`)) return;
    this.http.post(`${API}/signatures/${s.id}/void`, {}).subscribe({ next: () => { this.toast.success('Signature request voided'); this.load(); } });
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────
  applyTemplate(): void {
    this.busy = 'template';
    this.http.post<any>(`${API}/cases/${this.id}/tasks/template`, {}).subscribe({
      next: r => { this.busy = ''; this.toast.success(r.added ? `${r.added} tasks added` : 'All template tasks are already on this case'); this.load(); },
      error: () => { this.busy = ''; this.toast.error('Could not apply the task list'); this.cdr.markForCheck(); },
    });
  }

  addTask(): void {
    const t = this.newTask;
    if (!t.title.trim()) { this.toast.error('Give the task a title'); return; }
    this.http.post<any>(`${API}/cases/${this.id}/tasks`, { ...t, due_date: t.due_date || null }).subscribe({
      next: () => { this.newTask = { title: '', role: t.role, assignee: '', due_date: '' }; this.load(); },
      error: e => this.toast.error(e?.error?.detail || 'Could not add the task'),
    });
  }

  updateTask(task: any, change: any): void {
    this.http.patch<any>(`${API}/cases/${this.id}/tasks/${task.id}`, change).subscribe({
      next: () => this.load(),
      error: e => { this.toast.error(e?.error?.detail || 'Could not update the task'); this.load(); },
    });
  }

  deleteTask(task: any): void {
    if (!confirm(`Remove the task "${task.title}"?`)) return;
    this.http.delete(`${API}/cases/${this.id}/tasks/${task.id}`).subscribe({ next: () => this.load() });
  }

  dueTone(t: any): string {
    if (t.done || t.days === null || t.days === undefined) return 'p-neutral';
    return t.days < 0 ? 'p-bad' : t.days <= 2 ? 'p-warn' : 'p-neutral';
  }

  dueText(t: any): string {
    if (t.days === null || t.days === undefined) return 'No date';
    return t.days < 0 ? `${-t.days}d overdue` : t.days === 0 ? 'Today' : `In ${t.days}d`;
  }

  // ── Activity ──────────────────────────────────────────────────────────────
  addNote(): void {
    const text = this.note.trim();
    if (!text) return;
    this.http.post(`${API}/cases/${this.id}/notes`, { text }).subscribe({
      next: () => { this.note = ''; this.toast.success('Note added'); this.load(); },
      error: () => this.toast.error('Could not add the note'),
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private slug(): string { return (this.c?.beneficiary || 'case').replace(/[^a-z0-9]+/gi, '_').slice(0, 40); }

  private save(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}
