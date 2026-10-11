import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { DocSheetComponent } from '../../components/doc-sheet/doc-sheet.component';
import { DocumentCompareComponent } from '../../components/document-compare/document-compare.component';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { SimilarDocumentsDialogComponent } from './similar-documents-dialog.component';
import { ConfirmDeleteAllDialogComponent } from '../../components/dialogs/confirm-delete-all-dialog.component';
import { FolderService } from '../../services/folder.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DocSheetComponent, DocumentCompareComponent, MatDialogModule],
  templateUrl: './documents.component.html',
  styleUrls: ['./documents.component.scss']
})
export class DocumentsComponent implements OnInit, OnDestroy {
  docs: any[] = [];
  filtered: any[] = [];
  selectedDoc: any = null;
  selectedDocs = new Set<string>();
  compareOpen = false;

  // ── Archive expansion ──────────────────────────────────────────────────────
  expandedArchives = new Set<string>();
  archiveChildren: Record<string, { loading: boolean; children: any[]; done: number; total: number }> = {};
  private _archivePollers: Record<string, any> = {};
  compareDocA: any = null;
  compareDocB: any = null;
  similarLoading = false;
  view: 'list'|'grid' = 'list';
  sortBy = 'date';
  searchQ = '';
  loading = false;
  private sub?: Subscription;
  private fastPollSub?: Subscription;

  // Alert banner
  globalAlertCount = 0;
  globalAlertSummary = '';

  // Folder filter
  activeFolderFilter = 'all';
  showNewFolderInput = false;
  newFolderName = '';

  // Built-in folders with icons
  builtinFolders = [
    { id: 'declarations_page',     name: 'Insurance',       icon: '🛡️', bg: '#eff6ff', color: '#0891b2' },
    { id: 'bank_statement',        name: 'Bank Statements', icon: '🏦', bg: '#f0fdf4', color: '#059669' },
    { id: 'tax_form',              name: 'Tax Documents',   icon: '📋', bg: '#fefce8', color: '#d97706' },
    { id: 'invoice',               name: 'Invoices',        icon: '🧾', bg: '#fff7ed', color: '#ea580c' },
    { id: 'payoff_statement',      name: 'Payoff Stmts',    icon: '📄', bg: '#eef2ff', color: '#4f46e5' },
    { id: 'credit_card_statement', name: 'Credit Cards',    icon: '💳', bg: '#fdf4ff', color: '#9333ea' },
    { id: 'medical_record',        name: 'Medical Records', icon: '🏥', bg: '#fff1f2', color: '#e11d48' },
    { id: 'contract',              name: 'Contracts',       icon: '⚖️', bg: '#eff6ff', color: '#2563eb' },
    { id: 'nda',                   name: 'NDAs',            icon: '🔒', bg: '#f1f5f9', color: '#475569' },
    { id: 'lease_agreement',       name: 'Lease Agreements',icon: '🏠', bg: '#ecfdf5', color: '#059669' },
    { id: 'regulatory_filing',     name: 'Reg Filings',     icon: '📋', bg: '#fffbeb', color: '#d97706' },
    { id: 'medical_chart',         name: 'Medical Charts',  icon: '🩺', bg: '#fff1f2', color: '#be123c' },
    { id: 'intake_form',           name: 'Intake Forms',    icon: '📝', bg: '#f0fdfa', color: '#0f766e' },
    { id: 'lab_report',            name: 'Lab Reports',     icon: '🔬', bg: '#faf5ff', color: '#6b21a8' },
    { id: 'appraisal',             name: 'Appraisals',      icon: '📉', bg: '#fef2f2', color: '#b91c1c' },
    { id: 'title_deed',            name: 'Title Deeds',     icon: '📜', bg: '#fff7ed', color: '#c2410c' },
    { id: 'closing_disclosure',    name: 'Disclosures',     icon: '📑', bg: '#f0fdf4', color: '#15803d' },
    { id: 'resume',                name: 'Resumes',         icon: '👤', bg: '#ecfdf5', color: '#047857' },
    { id: 'handbook',              name: 'Handbooks',       icon: '📘', bg: '#eff6ff', color: '#1d4ed8' },
    { id: 'performance_review',    name: 'Reviews',         icon: '📈', bg: '#fdf2f8', color: '#be185d' },
    { id: 'purchase_order',        name: 'PO Register',     icon: '📦', bg: '#fdf4ff', color: '#7e22ce' },
    { id: 'bill_of_lading',        name: 'Bills of Lading', icon: '🚚', bg: '#f0fdf4', color: '#16a34a' },
    { id: 'customs_manifest',      name: 'Manifests',       icon: '🚢', bg: '#eff6ff', color: '#0369a1' },
    { id: 'document',              name: 'Documents',       icon: '📁', bg: '#f8fafc', color: '#64748b' },
  ];

  get customFolderList(): string[] { return this.folderSvc.getFolders(); }

  get activeFolderLabel(): string {
    if (this.activeFolderFilter === 'all') return 'All Documents';
    const builtin = this.builtinFolders.find(f => f.id === this.activeFolderFilter);
    if (builtin) return builtin.name;
    return this.activeFolderFilter;
  }

  constructor(
    public  toast:     ToastService,
    private api:       ApiService,
    public  router:    Router,
    private dialog:    MatDialog,
    public  folderSvc: FolderService,
    private http:      HttpClient,
    private route:     ActivatedRoute,
    public  auth:      AuthService,
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadGlobalAlerts();
    this.sub = interval(30000).subscribe(() => this.silentRefresh());

    this.route.queryParams.subscribe(params => {
      const type = params['doc_type'];
      if (type) {
        this.setFolderFilter(type);
      } else {
        this.setFolderFilter('all');
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.fastPollSub?.unsubscribe();
    Object.values(this._archivePollers).forEach(t => clearInterval(t));
  }

  private hasProcessingDocs(): boolean {
    return this.docs.some(d => d.status === 'processing' || d.status === 'pending');
  }

  private startFastPoll(): void {
    if (this.fastPollSub) return;
    this.fastPollSub = interval(3000).subscribe(() => {
      this.api.getDocuments({}).subscribe({
        next: (res: any) => {
          this.docs = Array.isArray(res) ? res : res.documents || [];
          this.applySort();
          if (!this.hasProcessingDocs()) {
            this.fastPollSub?.unsubscribe();
            this.fastPollSub = undefined;
          }
        },
        error: () => {}
      });
    });
  }

  // ── Archive expansion methods ────────────────────────────────────────────

  toggleArchive(doc: any): void {
    if (this.expandedArchives.has(doc.id)) {
      this.expandedArchives.delete(doc.id);
      clearInterval(this._archivePollers[doc.id]);
      delete this._archivePollers[doc.id];
    } else {
      this.expandedArchives.add(doc.id);
      this._loadChildren(doc.id);
    }
  }

  private _loadChildren(docId: string): void {
    if (!this.archiveChildren[docId]) {
      this.archiveChildren[docId] = { loading: true, children: [], done: 0, total: 0 };
    }
    this.http.get<any>(`http://localhost:8000/api/documents/${docId}/children`).subscribe({
      next: res => {
        this.archiveChildren[docId] = {
          loading: false,
          children: res.children || [],
          done: res.done_count || 0,
          total: res.child_count || 0,
        };
        // Keep polling until all children are done
        if (!res.all_done && !this._archivePollers[docId]) {
          this._archivePollers[docId] = setInterval(() => this._pollChildren(docId), 4000);
        }
      },
      error: () => {
        if (this.archiveChildren[docId]) this.archiveChildren[docId].loading = false;
      }
    });
  }

  private _pollChildren(docId: string): void {
    this.http.get<any>(`http://localhost:8000/api/documents/${docId}/children`).subscribe({
      next: res => {
        this.archiveChildren[docId] = {
          loading: false,
          children: res.children || [],
          done: res.done_count || 0,
          total: res.child_count || 0,
        };
        if (res.all_done) {
          clearInterval(this._archivePollers[docId]);
          delete this._archivePollers[docId];
        }
      },
      error: () => {}
    });
  }

  archiveProgress(doc: any): string {
    const info = this.archiveChildren[doc.id];
    const total = info?.total ?? doc.child_count ?? 0;
    const done  = info?.done  ?? 0;
    if (!total) return `${total} files`;
    if (done === total) return `${total} files · all analyzed ✓`;
    return `${total} files · ${done}/${total} analyzed`;
  }

  loadGlobalAlerts(): void {
    this.http.get<any>('http://localhost:8000/api/insights/alerts').subscribe({
      next: (res) => {
        this.globalAlertCount   = res.total || 0;
        const alerts            = res.alerts || [];
        const parts: string[]   = [];
        if (alerts[0]) parts.push(alerts[0].title);
        if (alerts[1] && alerts[1].title !== alerts[0]?.title) parts.push(alerts[1].title);
        this.globalAlertSummary = parts.join(', ') || 'Review recommended';
      },
      error: () => {}
    });
  }

  load(): void {
    this.loading = true;
    this.api.getDocuments({}).subscribe({
      next: (res: any) => {
        this.docs    = Array.isArray(res) ? res : res.documents || [];
        this.applySort();
        this.loading = false;
        if (this.hasProcessingDocs()) this.startFastPoll();
      },
      error: () => { this.loading = false; }
    });
  }

  silentRefresh(): void {
    this.api.getDocuments({}).subscribe({
      next: (res: any) => {
        this.docs = Array.isArray(res) ? res : res.documents || [];
        this.applySort();
        if (this.hasProcessingDocs()) this.startFastPoll();
      },
      error: () => {}
    });
  }

  setFolderFilter(id: string): void {
    this.activeFolderFilter = id;
    this.applySort();
  }

  getFolderCount(folderId: string): number {
    return this.docs.filter(d => d.doc_type === folderId).length;
  }

  getCustomFolderCount(folderName: string): number {
    return this.docs.filter(d => this.folderSvc.getDocFolder(d.id) === folderName).length;
  }

  applySort(): void {
    let list = [...this.docs];

    if (this.activeFolderFilter !== 'all') {
      const isBuiltin = this.builtinFolders.some(f => f.id === this.activeFolderFilter);
      if (isBuiltin) {
        list = list.filter(d => d.doc_type === this.activeFolderFilter);
      } else {
        list = list.filter(d => this.folderSvc.getDocFolder(d.id) === this.activeFolderFilter);
      }
    }

    if (this.searchQ.trim()) {
      const q = this.searchQ.toLowerCase();
      list = list.filter(d =>
        d.filename?.toLowerCase().includes(q) ||
        d.doc_type?.toLowerCase().includes(q) ||
        d.summary?.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (this.sortBy === 'name') return (a.filename || '').localeCompare(b.filename || '');
      if (this.sortBy === 'size') return (b.file_size || 0) - (a.file_size || 0);
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

    this.filtered = list;
  }

  createFolder(): void {
    const name = this.newFolderName.trim();
    if (!name) return;
    if (this.folderSvc.getFolders().includes(name)) {
      this.toast.error(`Folder "${name}" already exists`); return;
    }
    this.folderSvc.addFolder(name);
    this.newFolderName    = '';
    this.showNewFolderInput = false;
    this.toast.success(`Folder "${name}" created`);
  }

  openDoc(doc: any): void { this.selectedDoc = doc; }
  selectedDocTab = 'summary';
  openDocTab(doc: any, tab: string): void { this.selectedDocTab = tab; this.selectedDoc = doc; }
  openAnalytics(doc: any): void { this.router.navigate(['/analytics', doc.id, 'advanced']); }
  previewDoc(doc: any): void {
    const token = localStorage.getItem('udv_access_token') || '';
    fetch(`http://localhost:8000/api/documents/${doc.id}/preview`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const w = window.open(url, '_blank');
        if (w) setTimeout(() => URL.revokeObjectURL(url), 60000);
      })
      .catch(() => window.open(`http://localhost:8000/api/documents/${doc.id}/preview`, '_blank'));
  }
  downloadDoc(doc: any): void {
    const token = localStorage.getItem('udv_access_token') || '';
    fetch(`http://localhost:8000/api/documents/${doc.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = doc.filename || 'document'; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      });
  }

  reprocessDoc(doc: any): void {
    const token = localStorage.getItem('udv_access_token') || '';
    doc._reprocessing = true;
    fetch(`http://localhost:8000/api/documents/${doc.id}/reprocess`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(() => {
        doc.status = 'pending';
        doc.doc_type = null;
        // Poll until completed (up to 60s)
        let attempts = 0;
        const poll = setInterval(() => {
          if (++attempts > 30) { clearInterval(poll); doc._reprocessing = false; return; }
          fetch(`http://localhost:8000/api/documents/${doc.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then(r => r.json())
            .then(updated => {
              if (updated.status === 'completed') {
                clearInterval(poll);
                doc.doc_type = updated.doc_type;
                doc.status = updated.status;
                doc._reprocessing = false;
              }
            });
        }, 2000);
      })
      .catch(() => { doc._reprocessing = false; });
  }

  openCompare(docA: any, docB: any): void {
    this.compareDocA = docA;
    this.compareDocB = docB;
    this.compareOpen = true;
  }

  openSimilar(doc: any): void {
    this.similarLoading = true;
    const ref = this.dialog.open(SimilarDocumentsDialogComponent, {
      width: '700px', maxHeight: '85vh',
      data: { sourceDocument: doc, similarDocuments: [], loading: true }
    });
    this.api.similarDocuments(doc.id, 5).subscribe({
      next: (res: any) => {
        const similar = Array.isArray(res) ? res : res.similar_documents || res.results || [];
        ref.componentInstance.data = { sourceDocument: doc, similarDocuments: similar, loading: false };
        this.similarLoading = false;
      },
      error: () => {
        ref.componentInstance.data = { sourceDocument: doc, similarDocuments: [], loading: false };
        this.similarLoading = false;
      }
    });
  }

  showMoveMenu = false;

  moveSelected(folderName: string): void {
    const ids = Array.from(this.selectedDocs);
    this.folderSvc.assignDocsToFolder(ids, folderName);
    this.toast.success(`Moved ${ids.length} doc${ids.length !== 1 ? 's' : ''} to "${folderName}"`);
    this.showMoveMenu = false;
    this.clearBulk();
  }

  toggleBulk(id: string, checked: boolean): void { checked ? this.selectedDocs.add(id) : this.selectedDocs.delete(id); }
  clearBulk(): void { this.selectedDocs.clear(); }

  confirmDeleteAll(): void {
    const count     = this.docs.length;
    const totalSize = this.docs.reduce((sum, d) => sum + (d.file_size || 0), 0);
    const ref = this.dialog.open(ConfirmDeleteAllDialogComponent, {
      width: '480px', data: { count, totalSize }
    });
    ref.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      this.loading = true;
      this.api.deleteAllDocuments().subscribe({
        next: () => {
          this.toast.error('All documents deleted');
          this.docs = []; this.filtered = []; this.selectedDoc = null;
          this.clearBulk(); this.loading = false;
        },
        error: () => { this.toast.error('Failed to delete documents'); this.loading = false; }
      });
    });
  }

  confirmingDelete = false;
  startDeleteConfirm(): void {
    if (this.selectedDocs.size === 0) { this.toast.error('No documents selected'); return; }
    this.confirmingDelete = true;
  }
  cancelDelete(): void { this.confirmingDelete = false; }

  deleteSelected(): void {
    if (this.selectedDocs.size === 0) { this.toast.error('No documents selected'); return; }
    const ids = Array.from(this.selectedDocs);
    this.api.deleteDocuments(ids).subscribe({
      next: () => {
        this.toast.success('Documents deleted');
        this.docs = this.docs.filter(d => !this.selectedDocs.has(d.id));
        this.applySort(); this.clearBulk(); this.confirmingDelete = false;
      },
      error: () => { this.toast.error('Failed to delete documents'); this.confirmingDelete = false; }
    });
  }

  private _docExt(doc: any): string {
    return (doc?.filename?.split('.').pop() || '').toLowerCase();
  }

  private _extClass(ext: string): string {
    if (['zip','rar','7z','tar','gz','tgz','bz2'].includes(ext)) return 'archive';
    if (['jpg','jpeg','png','gif','bmp','tiff','tif','webp','heic','heif'].includes(ext)) return 'img';
    if (['xlsx','xls','xlsm','csv','tsv','ods'].includes(ext)) return 'sheet';
    if (['pptx','ppt','odp'].includes(ext)) return 'slide';
    if (['eml','msg','mbox'].includes(ext)) return 'email';
    return 'doc';
  }

  icoClass(t: string, doc?: any): string {
    const m: any = {
      bank_statement: 'bank', tax_document: 'tax', payoff_statement: 'pdf',
      invoice: 'inv', credit_card_statement: 'cc',
    };
    if (m[t]) return m[t];
    return this._extClass(this._docExt(doc));
  }

  icoTxt(t: string, doc?: any): string {
    const m: any = {
      bank_statement: 'BNK', tax_document: 'TAX', payoff_statement: 'PAY',
      invoice: 'INV', credit_card_statement: 'CC', contract: 'CON', nda: 'NDA',
      lease_agreement: 'LSE', regulatory_filing: 'REG', medical_chart: 'MCH',
      intake_form: 'INT', lab_report: 'LAB', appraisal: 'APR', title_deed: 'DED',
      closing_disclosure: 'DIS', resume: 'RES', handbook: 'HBK',
      performance_review: 'REV', purchase_order: 'PO', bill_of_lading: 'BOL',
      customs_manifest: 'MNF',
      annual_report: 'AR', proxy_statement: 'PRX', insurance_policy: 'INS',
      pay_stub: 'PAY', w2: 'W-2', earnings_statement: 'ERN', document: 'DOC'
    };
    if (m[t]) return m[t];
    if (doc?.status === 'failed') return 'ERR';
    return 'DOC';
  }

  badgeClass(t: string, doc?: any): string {
    const m: any = {
      bank_statement: 'bank', tax_document: 'tax', payoff_statement: 'pay',
      invoice: 'inv', credit_card_statement: 'cc',
      annual_report: 'annual', proxy_statement: 'proxy',
      insurance_policy: 'ins', pay_stub: 'pay', w2: 'tax',
      earnings_statement: 'pay', document: 'doc',
    };
    if (m[t]) return m[t];
    return this._extClass(this._docExt(doc));
  }

  folderName(t: string): string {
    const m: any = {
      bank_statement: 'Bank Statements',
      tax_document: 'Tax Documents',
      payoff_statement: 'Payoff Stmts',
      invoice: 'Invoices',
      contract: 'Contracts',
      nda: 'NDAs',
      lease_agreement: 'Lease Agreements',
      regulatory_filing: 'Regulatory Filings',
      medical_chart: 'Medical Charts',
      intake_form: 'Intake Forms',
      lab_report: 'Lab Reports',
      appraisal: 'Appraisals',
      title_deed: 'Title Deeds',
      closing_disclosure: 'Closing Disclosures',
      resume: 'Resumes',
      handbook: 'Handbooks',
      performance_review: 'Reviews',
      purchase_order: 'Purchase Orders',
      bill_of_lading: 'Bills of Lading',
      customs_manifest: 'Manifests',
      annual_report: 'Annual Reports',
      proxy_statement: 'Proxy Statements',
      insurance_policy: 'Insurance Policies',
      pay_stub: 'Pay Stubs',
      w2: 'W-2 Forms',
      earnings_statement: 'Earnings Statements',
      document: 'Documents'
    };
    return m[t] || 'Documents';
  }
  fmtSize(b: number): string    { if(!b)return'0 B'; const k=1024,s=['B','KB','MB','GB'],i=Math.floor(Math.log(b)/Math.log(k)); return Math.round(b/Math.pow(k,i)*10)/10+' '+s[i]; }



// Select All logic
isAllSelected(): boolean {
  return this.filtered.length > 0 && 
         this.filtered.every(doc => this.selectedDocs.has(doc.id));
}

isIndeterminate(): boolean {
  return !this.isAllSelected() && 
         this.filtered.some(doc => this.selectedDocs.has(doc.id));
}

toggleSelectAll(e: Event): void {
  const checked = (e.target as HTMLInputElement).checked;
  
  if (checked) {
    this.filtered.forEach(doc => this.selectedDocs.add(doc.id));
  } else {
    this.filtered.forEach(doc => this.selectedDocs.delete(doc.id));
  }
}

}