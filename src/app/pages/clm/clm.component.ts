import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { authFetch } from '../../lib/api';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocSheetComponent } from '../../components/doc-sheet/doc-sheet.component';
import { ConfirmService } from '../../services/confirm.service';
import { UdvSelectComponent, SelectOption } from '../../components/udv-select/udv-select.component';

const STAGES = [
  { key: 'draft',            label: 'Draft',            color: '#94a3b8', bg: '#f1f5f9' },
  { key: 'review',           label: 'Under Review',     color: '#3b82f6', bg: '#eff6ff' },
  { key: 'pending_approval', label: 'Pending Approval', color: '#f59e0b', bg: '#fffbeb' },
  { key: 'active',           label: 'Active',           color: '#10b981', bg: '#ecfdf5' },
  { key: 'expiring',         label: 'Expiring Soon',    color: '#ef4444', bg: '#fef2f2' },
  { key: 'renewed',          label: 'Renewed',          color: '#8b5cf6', bg: '#f5f3ff' },
  { key: 'terminated',       label: 'Terminated',       color: '#6b7280', bg: '#f9fafb' },
];

interface CLMEntry {
  id: string;
  doc_id: string;
  stage: string;
  filename?: string;
  doc_type?: string;
  summary?: string;
  contract_value?: number;
  counterparty?: string;
  governing_law?: string;
  notes?: string;
  updated_at?: string;
  history?: any[];
}

@Component({
  selector: 'app-clm',
  standalone: true,
  imports: [CommonModule, FormsModule, DocSheetComponent, UdvSelectComponent],
  templateUrl: './clm.component.html',
  styleUrls: ['./clm.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClmComponent implements OnInit {
  readonly STAGES = STAGES;
  entries: CLMEntry[] = [];
  loading = true;
  dragging: CLMEntry | null = null;
  dragOverStage = '';

  // detail panel
  selected: CLMEntry | null = null;
  selectedDoc: any = null;
  editMode = false;
  editDraft: Partial<CLMEntry> = {};
  historyOpen = false;

  // add-to-CLM modal
  addOpen = false;
  allDocs: any[] = [];
  addDraft = { doc_id: '', stage: 'draft', counterparty: '', contract_value: '', governing_law: '', notes: '' };

  private readonly api = 'http://localhost:7979';

  get docOptions(): SelectOption[] {
    return this.allDocs.map(d => ({ value: d.id, label: d.filename }));
  }
  get stageOptions(): SelectOption[] {
    return STAGES.map(s => ({ value: s.key, label: s.label }));
  }

  constructor(private cdr: ChangeDetectorRef, private confirm: ConfirmService) {}

  ngOnInit() { this.load(); }

  stageEntries(key: string): CLMEntry[] { return this.entries.filter(e => e.stage === key); }

  async load() {
    try {
      const [entriesRes, docsRes] = await Promise.all([
        authFetch(`${this.api}/api/clm`).then(r => r.json()),
        authFetch(`${this.api}/api/documents?limit=100`).then(r => r.json()),
      ]);
      this.entries = entriesRes || [];
      const docs = Array.isArray(docsRes) ? docsRes : (docsRes.documents || docsRes.items || []);
      this.allDocs = docs;
    } catch(e) { console.error(e); }
    this.loading = false;
    this.cdr.markForCheck();
  }

  // ── Drag and drop ────────────────────────────────────────────────────────
  onDragStart(e: DragEvent, entry: CLMEntry) {
    this.dragging = entry;
    e.dataTransfer?.setData('text/plain', entry.id);
  }
  onDragOver(e: DragEvent, stageKey: string) { e.preventDefault(); this.dragOverStage = stageKey; this.cdr.markForCheck(); }
  onDragLeave() { this.dragOverStage = ''; this.cdr.markForCheck(); }
  async onDrop(e: DragEvent, stageKey: string) {
    e.preventDefault();
    this.dragOverStage = '';
    if (!this.dragging || this.dragging.stage === stageKey) { this.dragging = null; this.cdr.markForCheck(); return; }
    const entry = this.dragging;
    entry.stage = stageKey;
    this.dragging = null;
    this.cdr.markForCheck();
    await authFetch(`${this.api}/api/clm/${entry.id}/move`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: stageKey, moved_by: 'user' })
    });
    this.logAudit(entry.doc_id, 'clm_move', `Moved to ${stageKey}`);
  }

  // ── Add to CLM ──────────────────────────────────────────────────────────
  openAdd() { this.addOpen = true; this.addDraft = { doc_id: '', stage: 'draft', counterparty: '', contract_value: '', governing_law: '', notes: '' }; this.cdr.markForCheck(); }
  async submitAdd() {
    if (!this.addDraft.doc_id) return;
    const res = await authFetch(`${this.api}/api/clm`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...this.addDraft, contract_value: this.addDraft.contract_value ? +this.addDraft.contract_value : null })
    }).then(r => r.json());
    if (res.entry) {
      // attach doc info
      const doc = this.allDocs.find(d => d.id === this.addDraft.doc_id);
      res.entry.filename = doc?.filename;
      res.entry.doc_type = doc?.doc_type;
      this.entries.unshift(res.entry);
    }
    this.addOpen = false;
    this.cdr.markForCheck();
  }

  // ── Detail ──────────────────────────────────────────────────────────────
  async openEntry(entry: CLMEntry) {
    const full = await authFetch(`${this.api}/api/clm/${entry.id}`).then(r => r.json());
    this.selected = full;
    this.editDraft = { ...full };
    this.historyOpen = false;
    this.cdr.markForCheck();
    this.logAudit(entry.doc_id, 'view', `Viewed CLM entry`);
  }

  async openDoc(docId: string) {
    this.selectedDoc = await authFetch(`${this.api}/api/documents/${docId}`).then(r => r.json());
    this.cdr.markForCheck();
  }

  async saveEdit() {
    if (!this.selected) return;
    await authFetch(`${this.api}/api/clm/${this.selected.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.editDraft)
    });
    Object.assign(this.selected, this.editDraft);
    const idx = this.entries.findIndex(e => e.id === this.selected!.id);
    if (idx >= 0) Object.assign(this.entries[idx], this.editDraft);
    this.editMode = false;
    this.cdr.markForCheck();
  }

  async deleteEntry(id: string) {
    if (!await this.confirm.ask({ title: 'Remove from Pipeline', message: 'This item will be removed from the CLM pipeline.', danger: true })) return;
    await authFetch(`${this.api}/api/clm/${id}`, { method: 'DELETE' });
    this.entries = this.entries.filter(e => e.id !== id);
    this.selected = null;
    this.cdr.markForCheck();
  }

  stageInfo(key: string) { return STAGES.find(s => s.key === key) || STAGES[0]; }
  fmt(v?: number) { return v ? '$' + v.toLocaleString() : '—'; }
  fmtDate(d?: string) { return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; }

  private logAudit(docId: string, action: string, detail: string) {
    authFetch(`${this.api}/api/audit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_id: docId, action, detail, actor: 'user' })
    }).catch(() => {});
  }
}
