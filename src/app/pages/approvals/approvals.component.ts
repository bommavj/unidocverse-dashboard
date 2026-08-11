import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocSheetComponent } from '../../components/doc-sheet/doc-sheet.component';
import { ConfirmService } from '../../services/confirm.service';
import { UdvSelectComponent, SelectOption } from '../../components/udv-select/udv-select.component';

interface ApprovalRequest {
  id: string;
  doc_id: string;
  title: string;
  description?: string;
  approvers: string[];
  decisions: { approver: string; decision: string; comment?: string; at: string }[];
  comments: { author: string; text: string; at: string }[];
  status: 'pending' | 'approved' | 'rejected';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  due_date?: string;
  filename?: string;
  doc_type?: string;
  created_at: string;
}

const PRIORITY_COLOR: Record<string, string> = { low: '#94a3b8', normal: '#3b82f6', high: '#f59e0b', urgent: '#ef4444' };
const STATUS_COLOR:   Record<string, string> = { pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444' };

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule, DocSheetComponent, UdvSelectComponent],
  templateUrl: './approvals.component.html',
  styleUrls: ['./approvals.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApprovalsComponent implements OnInit {
  requests: ApprovalRequest[] = [];
  loading = true;
  filterStatus: 'all' | 'pending' | 'approved' | 'rejected' = 'all';
  selected: ApprovalRequest | null = null;
  selectedDoc: any = null;

  // create modal
  createOpen = false;
  allDocs: any[] = [];
  draft = { doc_id: '', title: '', description: '', approvers: '', due_date: '', priority: 'normal' };

  get docOptions(): SelectOption[] {
    return this.allDocs.map(d => ({ value: d.id, label: d.filename }));
  }
  get approverOptions(): SelectOption[] {
    return (this.selected?.approvers ?? []).map((a: string) => ({ value: a, label: a }));
  }
  readonly priorityOptions: SelectOption[] = [
    { value: 'low',    label: 'Low' },
    { value: 'normal', label: 'Normal' },
    { value: 'high',   label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ];

  // decision
  decisionDraft = { decision: 'approve', comment: '', approver: 'Admin User' };
  commentDraft = { author: 'Admin User', text: '' };

  readonly PRIORITY_COLOR = PRIORITY_COLOR;
  readonly STATUS_COLOR = STATUS_COLOR;
  private readonly api = 'http://localhost:8000';

  constructor(private cdr: ChangeDetectorRef, private confirm: ConfirmService) {}

  ngOnInit() { this.load(); }

  get filtered() {
    if (this.filterStatus === 'all') return this.requests;
    return this.requests.filter(r => r.status === this.filterStatus);
  }

  countOf(s: string) { return this.requests.filter(r => r.status === s).length; }

  async load() {
    try {
      const [reqRes, docsRes] = await Promise.all([
        fetch(`${this.api}/api/approvals`).then(r => r.json()),
        fetch(`${this.api}/api/documents?limit=100`).then(r => r.json()),
      ]);
      this.requests = reqRes || [];
      const docs = Array.isArray(docsRes) ? docsRes : (docsRes.documents || []);
      this.allDocs = docs;
    } catch(e) { console.error(e); }
    this.loading = false;
    this.cdr.markForCheck();
  }

  openCreate() {
    this.draft = { doc_id: '', title: '', description: '', approvers: '', due_date: '', priority: 'normal' };
    this.createOpen = true;
    this.cdr.markForCheck();
  }

  async submitCreate() {
    if (!this.draft.doc_id || !this.draft.title) return;
    const approvers = this.draft.approvers.split(',').map(s => s.trim()).filter(Boolean);
    if (!approvers.length) approvers.push('Admin User');
    const res = await fetch(`${this.api}/api/approvals`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...this.draft, approvers })
    }).then(r => r.json());
    if (res.request) {
      const doc = this.allDocs.find(d => d.id === this.draft.doc_id);
      res.request.filename = doc?.filename;
      res.request.doc_type = doc?.doc_type;
      this.requests.unshift(res.request);
    }
    this.createOpen = false;
    this.logAudit(this.draft.doc_id, 'share', `Approval requested: ${this.draft.title}`);
    this.cdr.markForCheck();
  }

  async openRequest(r: ApprovalRequest) {
    const full = await fetch(`${this.api}/api/approvals/${r.id}`).then(x => x.json());
    this.selected = full;
    this.decisionDraft = { decision: 'approve', comment: '', approver: 'Admin User' };
    this.commentDraft = { author: 'Admin User', text: '' };
    this.cdr.markForCheck();
  }

  async submitDecision() {
    if (!this.selected) return;
    const res = await fetch(`${this.api}/api/approvals/${this.selected.id}/decide`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.decisionDraft)
    }).then(r => r.json());
    if (res.decisions) {
      this.selected.decisions = res.decisions;
      this.selected.status = res.status;
      const idx = this.requests.findIndex(x => x.id === this.selected!.id);
      if (idx >= 0) { this.requests[idx].status = res.status; this.requests[idx].decisions = res.decisions; }
    }
    this.logAudit(this.selected.doc_id, this.decisionDraft.decision === 'approve' ? 'approve' : 'reject',
      `${this.decisionDraft.decision} by ${this.decisionDraft.approver}`);
    this.cdr.markForCheck();
  }

  async submitComment() {
    if (!this.selected || !this.commentDraft.text.trim()) return;
    await fetch(`${this.api}/api/approvals/${this.selected.id}/comment`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.commentDraft)
    });
    this.selected.comments = [...(this.selected.comments || []),
      { ...this.commentDraft, at: new Date().toISOString() }];
    this.commentDraft.text = '';
    this.cdr.markForCheck();
  }

  async deleteRequest(id: string) {
    if (!await this.confirm.ask({ title: 'Delete Request', message: 'This approval request will be permanently deleted.', danger: true })) return;
    await fetch(`${this.api}/api/approvals/${id}`, { method: 'DELETE' });
    this.requests = this.requests.filter(r => r.id !== id);
    this.selected = null;
    this.cdr.markForCheck();
  }

  async openDoc(docId: string) {
    this.selectedDoc = await fetch(`${this.api}/api/documents/${docId}`).then(r => r.json());
    this.cdr.markForCheck();
  }

  getDecision(decisions: any[], approver: string) { return decisions?.find(d => d.approver === approver) || null; }
  decisionIcon(d: string) { return d === 'approve' ? '✓' : d === 'reject' ? '✗' : '↺'; }
  decisionColor(d: string) { return d === 'approve' ? '#10b981' : d === 'reject' ? '#ef4444' : '#f59e0b'; }

  approvedCount(r: ApprovalRequest) { return (r.decisions || []).filter(d => d.decision === 'approve').length; }

  fmtDate(d?: string) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return d; }
  }

  private logAudit(docId: string, action: string, detail: string) {
    fetch(`${this.api}/api/audit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_id: docId, action, detail, actor: 'user' })
    }).catch(() => {});
  }
}
