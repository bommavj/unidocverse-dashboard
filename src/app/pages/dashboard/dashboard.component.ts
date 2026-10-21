import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { DocSheetComponent } from '../../components/doc-sheet/doc-sheet.component';
import { VoiceService } from '../../services/voice.service';
import { FeatureFlagService } from '../../services/feature-flag.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, DocSheetComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  docs: any[] = [];
  selectedDoc: any = null;

  // ── Real data properties ─────────────────────────────────────────────────
  anomalyCount = 0;
  totalStorageMB = 0;
  greeting = '';
  today = '';
  activity: any[] = [];

  // ── Unlock modal ─────────────────────────────────────────────────────────
  unlockDoc: any = null;
  unlockPassword = '';
  unlockLoading = false;
  unlockError = '';

  promptUnlock(doc: any): void {
    this.unlockDoc = doc;
    this.unlockPassword = '';
    this.unlockError = '';
    this.unlockLoading = false;
  }

  submitUnlock(): void {
    if (!this.unlockPassword || !this.unlockDoc) return;
    this.unlockLoading = true;
    this.unlockError = '';
    this.http.post(
      `http://localhost:7979/api/documents/${this.unlockDoc.id}/unlock`,
      { password: this.unlockPassword }
    ).subscribe({
      next: () => {
        this.unlockLoading = false;
        this.unlockDoc!.status = 'processing';
        this.unlockDoc = null;
        this.unlockPassword = '';
        // Refresh list after a short delay to pick up re-processing
        setTimeout(() => this.loadDocs(), 3000);
      },
      error: (err: any) => {
        this.unlockLoading = false;
        this.unlockError = err?.error?.detail || 'Incorrect password. Please try again.';
      }
    });
  }

  // ── Disclaimer banner ────────────────────────────────────────────────────
  disclaimerVisible = true;
  private readonly DISC_KEY = 'udv_disclaimer_dismissed';

  // ── Needs-your-attention queue ───────────────────────────────────────────
  approvals: any[] = [];
  pendingApprovals = 0;
  deadlines: any[] = [];
  anomalies: any[] = [];
  attention: AttentionItem[] = [];
  firstName = '';

  // ── Immigration expiry ───────────────────────────────────────────────────
  immExpiring: any[] = [];   // critical + high urgency records
  immCritical = 0;
  immHigh     = 0;
  immExpired  = 0;

  engine: any = null;          // { ollama: {reachable, models}, cloud, ready }

  loadEngine(): void {
    this.http.get<any>('http://localhost:7979/api/llm-providers/engine-status').subscribe({
      next: e => this.engine = e, error: () => this.engine = null });
  }

  brief: any = null;
  briefOpen = true;
  briefRunning = false;

  get briefSections(): { name: string; severity: string; items: any[] }[] {
    const out: any[] = [];
    for (const i of this.brief?.items || []) {
      let sec = out.find(x => x.name === i.section);
      if (!sec) out.push(sec = { name: i.section, severity: i.severity, items: [] });
      sec.items.push(i);
    }
    return out;
  }

  loadBrief(): void {
    this.http.get<any>('http://localhost:7979/api/brief/today').subscribe({ next: b => this.brief = b, error: () => this.brief = null });
  }

  refreshBrief(): void {
    this.briefRunning = true;
    this.http.post<any>('http://localhost:7979/api/brief/run', {}).subscribe({
      next: b => { this.brief = b; this.briefRunning = false; }, error: () => this.briefRunning = false });
  }

  openBriefItem(i: any): void {
    const [path, q] = String(i.link || '/').split('?');
    this.router.navigateByUrl(q ? `${path}?${q}` : path);
  }

  constructor(
    private api: ApiService,
    private router: Router,
    private auth: AuthService,
    private voiceSvc: VoiceService,
    private http: HttpClient,
    public features: FeatureFlagService,
  ) {}

  openVoice(): void {
    this.voiceSvc.open();
  }

  ngOnInit(): void {
    this.disclaimerVisible = localStorage.getItem(this.DISC_KEY) !== '1';
    this.setGreetingAndDate();
    this.loadDocs();
    this.loadAlerts();
    if (this.features.immigrationMode()) this.loadImmigrationExpiry();
    this.loadApprovals();
    this.loadBrief();
    this.loadEngine();
    this.loadDeadlines();
    this.firstName = (this.auth.currentUser()?.full_name || '').split(' ')[0];
  }

  loadApprovals(): void {
    this.http.get<any[]>('http://localhost:7979/api/approvals?status=pending').subscribe({
      next: rows => { this.approvals = rows || []; this.pendingApprovals = this.approvals.length; this.buildAttention(); },
      error: () => {}
    });
  }

  loadDeadlines(): void {
    this.http.get<any>('http://localhost:7979/api/alerts/all').subscribe({
      next: r => {
        this.deadlines = (r?.alerts || [])
          .filter((a: any) => a.days_until_expiry !== null && a.days_until_expiry !== undefined)
          .sort((a: any, b: any) => a.days_until_expiry - b.days_until_expiry);
        this.buildAttention();
      },
      error: () => {}
    });
  }

  get dueThisWeek(): number {
    return this.deadlines.filter(d => d.days_until_expiry >= 0 && d.days_until_expiry <= 7).length;
  }

  /** One list, most urgent first: overdue items, anomalies, approvals, then upcoming deadlines. */
  buildAttention(): void {
    const items: AttentionItem[] = [];
    for (const a of this.anomalies.slice(0, 5)) {
      items.push({ kind: 'Exception', icon: 'alert-triangle', tone: 'bad', rank: 1,
        title: a.title || a.message || 'Anomaly detected', sub: a.filename || a.doc_type || '', when: '', link: '/insights' });
    }
    for (const a of this.approvals.slice(0, 5)) {
      items.push({ kind: 'Approval', icon: 'user-check', tone: 'warn', rank: 2,
        title: a.title, sub: a.priority ? `${a.priority} priority` : '', when: this._timeAgo(a.created_at), link: '/approvals' });
    }
    for (const r of this.immExpiring.slice(0, 4)) {
      items.push({ kind: 'Immigration', icon: 'world', tone: r.days_to_expiry < 0 ? 'bad' : 'warn', rank: r.days_to_expiry < 0 ? 0 : 3,
        title: r.doc_label, sub: [r.beneficiary_name, r.visa_class].filter(Boolean).join(' · '),
        when: r.days_to_expiry < 0 ? `${-r.days_to_expiry}d overdue` : `in ${r.days_to_expiry}d`, link: '/immigration' });
    }
    for (const d of this.deadlines.slice(0, 6)) {
      items.push({ kind: 'Deadline', icon: 'calendar-due', tone: d.days_until_expiry < 0 ? 'bad' : d.days_until_expiry <= 7 ? 'warn' : 'neutral',
        rank: d.days_until_expiry < 0 ? 0 : 4, title: d.label || d.filename, sub: d.label ? d.filename : '',
        when: d.status_text || (d.days_until_expiry < 0 ? `${-d.days_until_expiry}d overdue` : `in ${d.days_until_expiry}d`), link: '/deadlines' });
    }
    this.attention = items.sort((a, b) => a.rank - b.rank).slice(0, 10);
  }

  dismissDisclaimer(): void {
    this.disclaimerVisible = false;
    localStorage.setItem(this.DISC_KEY, '1');
  }

  setGreetingAndDate(): void {
    const h = new Date().getHours();
    this.greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    this.today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric'
    });
  }

  loadDocs(): void {
    this.api.getDocuments({}).subscribe({
      next: (res: any) => {
        this.docs = Array.isArray(res) ? res : res.documents || [];
        this.calcStorage();
        this.buildActivity();
      },
      error: () => {}
    });
  }

  loadImmigrationExpiry(): void {
    this.http.get<any>('http://localhost:7979/api/immigration/expiry-dashboard').subscribe({
      next: res => {
        const buckets = res.buckets || {};
        this.immExpired  = (buckets.expired  || []).length;
        this.immCritical = (buckets.critical || []).length;
        this.immHigh     = (buckets.high     || []).length;
        // show expired + critical + high on dashboard, capped at 8
        this.immExpiring = [
          ...(buckets.expired  || []),
          ...(buckets.critical || []),
          ...(buckets.high     || []),
        ].slice(0, 8);
        this.buildAttention();
      },
      error: () => {}
    });
  }

  immUrgencyClass(u: string): string {
    return { expired:'imm-exp', critical:'imm-crit', high:'imm-hi', medium:'imm-med', low:'imm-lo' }[u] || '';
  }

  loadAlerts(): void {
    this.api.get('/insights/alerts').subscribe({
      next: (res: any) => {
        this.anomalyCount = res.total || 0;
        this.anomalies = res.alerts || [];
        this.buildAttention();
      },
      error: () => {}
    });
  }

  calcStorage(): void {
    const totalBytes = this.docs.reduce((sum, d) => sum + (d.file_size || 0), 0);
    this.totalStorageMB = Math.round(totalBytes / 1024 / 1024 * 100) / 100;
  }

  buildActivity(): void {
    this.activity = this.docs.slice(0, 5).map(d => {
      const typeMap: Record<string, { ico: string; bg: string; dot: string; verb: string }> = {
        bank_statement:       { ico: '🏦', bg: '#eff6ff', dot: '#0891b2', verb: 'classified' },
        tax_document:         { ico: '📋', bg: '#fefce8', dot: '#d97706', verb: 'analyzed' },
        tax_form:             { ico: '📋', bg: '#fefce8', dot: '#d97706', verb: 'analyzed' },
        payoff_statement:     { ico: '📄', bg: '#eef2ff', dot: '#4f46e5', verb: 'analyzed' },
        invoice:              { ico: '🧾', bg: '#f0fdf4', dot: '#059669', verb: 'processed' },
        credit_card_statement:{ ico: '💳', bg: '#fdf4ff', dot: '#9333ea', verb: 'classified' },
        sales_report:         { ico: '📈', bg: '#f0fdf4', dot: '#059669', verb: 'analyzed' },
        document:             { ico: '📄', bg: '#eef2ff', dot: '#4f46e5', verb: 'analyzed' },
      };
      const t = typeMap[d.doc_type] || { ico: '📁', bg: '#f1f5f9', dot: '#64748b', verb: 'uploaded' };
      const name = d.filename?.replace(/\.[^/.]+$/, '') || 'Document';
      const time = this._timeAgo(d.created_at);
      return {
        ico: t.ico,
        bg: t.bg,
        dot: t.dot,
        name,
        verb: t.verb,
        time,
        icon: this.docIcon(d),
        doc: d,
      };
    });
  }

  docIcon(doc: any): string {
    if (doc.status === 'password_required') return 'lock';
    const m: Record<string, string> = { bank_statement: 'building-bank', tax_document: 'receipt-tax', tax_form: 'receipt-tax',
      invoice: 'file-invoice', credit_card_statement: 'credit-card', payoff_statement: 'file-dollar', medical_record: 'heartbeat' };
    if (m[doc.doc_type]) return m[doc.doc_type];
    const c = this.icoClass(doc.doc_type, doc);
    return ({ img: 'photo', sheet: 'table', slide: 'presentation', email: 'mail', archive: 'file-zip' } as any)[c] || 'file-text';
  }

  typeLabel(doc: any): string {
    const t = (doc.doc_type || '').replace(/_/g, ' ');
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : (doc.filename?.split('.').pop() || '').toUpperCase();
  }

  private _timeAgo(dateStr: string): string {
    if (!dateStr) return 'Recently';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs  = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (mins < 60)  return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
    if (hrs  < 24)  return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  }

  get storagePct(): string {
    return ((this.totalStorageMB / (10 * 1024)) * 100).toFixed(2) + '%';
  }

  get storageLabel(): string {
    return this.totalStorageMB < 1
      ? `${Math.round(this.totalStorageMB * 1024)} KB of 10 GB used`
      : `${this.totalStorageMB} MB of 10 GB used`;
  }

  logout(): void { this.auth.logout(); }

  openDoc(doc: any): void { this.selectedDoc = doc; }
  goSearch(): void { this.router.navigate(['/search']); }

  private _ext(doc: any): string {
    return (doc.filename?.split('.').pop() || '').toLowerCase();
  }

  icoClass(t: string, doc?: any): string {
    const m: any = { bank_statement:'bank', tax_document:'tax', payoff_statement:'pdf', invoice:'inv', credit_card_statement:'cc' };
    if (m[t]) return m[t];
    const ext = doc ? this._ext(doc) : '';
    if (['zip','rar','7z','tar','gz','tgz','bz2'].includes(ext)) return 'archive';
    if (['jpg','jpeg','png','gif','bmp','tiff','tif','webp','heic','heif'].includes(ext)) return 'img';
    if (['xlsx','xls','xlsm','csv','tsv','ods'].includes(ext)) return 'sheet';
    if (['pptx','ppt','odp'].includes(ext)) return 'slide';
    if (['eml','msg','mbox'].includes(ext)) return 'email';
    return 'doc';
  }
  icoTxt(t: string, doc?: any): string {
    const m: any = { bank_statement:'BNK', tax_document:'TAX', payoff_statement:'PDF', invoice:'INV', credit_card_statement:'CC' };
    if (m[t]) return m[t];
    const ext = (doc ? this._ext(doc) : '').toUpperCase();
    if (ext) return ext.slice(0, 3);
    return 'DOC';
  }
  badgeClass(t: string, doc?: any): string {
    const m: any = { bank_statement:'bank', tax_document:'tax', payoff_statement:'pay', invoice:'inv', credit_card_statement:'cc' };
    if (m[t]) return m[t];
    const ext = doc ? this._ext(doc) : '';
    if (['zip','rar','7z','tar','gz','tgz','bz2'].includes(ext)) return 'archive';
    if (['jpg','jpeg','png','gif','bmp','tiff','tif','webp','heic','heif'].includes(ext)) return 'img';
    if (['xlsx','xls','xlsm','csv','tsv','ods'].includes(ext)) return 'sheet';
    if (['pptx','ppt','odp'].includes(ext)) return 'slide';
    if (['eml','msg','mbox'].includes(ext)) return 'email';
    return 'doc';
  }
  fmtSize(b: number): string {
    if (!b) return '0 B';
    const k = 1024, s = ['B','KB','MB','GB'], i = Math.floor(Math.log(b) / Math.log(k));
    return Math.round(b / Math.pow(k, i) * 10) / 10 + ' ' + s[i];
  }
}

interface AttentionItem {
  kind: string; icon: string; tone: 'bad' | 'warn' | 'neutral'; rank: number;
  title: string; sub: string; when: string; link: string;
}
