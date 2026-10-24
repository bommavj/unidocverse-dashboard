// app/main-nav/main-nav.component.ts
import {
  Component, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../services/api.service';
import { ToastService } from '../services/toast.service';
import { ToastComponent } from '../components/toast/toast.component';
import { FolderService } from '../services/folder.service';
import { AuthService } from '../services/auth.service';
import { FeatureFlagService } from '../services/feature-flag.service';   // ← NEW
import { ThemeService } from '../services/theme.service';
import { LanguageService } from '../services/language.service';
import { TranslatePipe } from '../services/translate.pipe';

@Component({
  selector: 'app-main-nav',
  standalone: true,
  imports: [CommonModule, RouterModule, ToastComponent, FormsModule, TitleCasePipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './main-nav.component.html',
  styleUrls: ['./main-nav.component.scss']
})
export class MainNavComponent implements OnInit, OnDestroy {

  // Document counts
  docCount = 0;

  // Alerts badge
  unreadAlerts = 0;

  // Storage
  storageUsed    = 0;
  storagePercent = 0;

  // Folder state
  activeFolder     = 'all';
  activeFolderName = '';
  showNewFolder    = false;
  newFolderName    = '';
  editingFolder    = '';
  editFolderName   = '';

  // Model switcher
  models: string[] = [];
  currentModel     = '';
  switchingModel   = false;

  // Built-in folders
  folders = [
    { id: 'all',                  name: 'All Documents',    color: '#4f46e5', count: 0 },
    { id: 'declarations_page',    name: 'Insurance',        color: '#0891b2', count: 0 },
    { id: 'bank_statement',       name: 'Bank Statements',  color: '#0891b2', count: 0 },
    { id: 'tax_form',             name: 'Tax Documents',    color: '#7c3aed', count: 0 },
    { id: 'invoice',              name: 'Invoices',         color: '#d97706', count: 0 },
    { id: 'payoff_statement',     name: 'Payoff Stmts',     color: '#059669', count: 0 },
    { id: 'credit_card_statement',name: 'Credit Cards',     color: '#0891b2', count: 0 },
    { id: 'medical_record',       name: 'Medical Records',  color: '#f59e0b', count: 0 },
    { id: 'document',             name: 'Documents',        color: '#e11d48', count: 0 },
  ];

  // Custom folders
  customFolders: { name: string; count: number }[] = [];

  // ── Navigation model: every page of the app has exactly one home here ────────
  // flag: feature-flag method on FeatureFlagService that must be on for the item to show
  readonly groups: NavGroup[] = [
    { key: 'main', label: 'Main', items: [
      { label: 'Home', icon: 'home', link: '/dashboard' },
      { label: 'Documents', icon: 'files', link: '/documents-hub', badge: 'docs', also: ['/documents'] },
      { label: 'Insights', icon: 'bulb', link: '/insights' },
      { label: 'Statistics', icon: 'chart-bar', link: '/statistics' },
      { label: 'Timeline', icon: 'timeline', link: '/timeline' },
      { label: 'Deadlines', icon: 'calendar-due', link: '/deadlines', also: ['/alerts'] },
      { label: 'Watch folders', icon: 'folder-search', link: '/watch-folders' },
      { label: 'Gmail import', icon: 'mail', link: '/gmail' },
    ]},
    { key: 'ai', label: 'AI and automation', items: [
      { label: 'Research agent', icon: 'microscope', link: '/research' },
      { label: 'Conversation history', icon: 'history', link: '/conversations', also: ['/history', '/research-history'] },
      { label: 'Automation hub', icon: 'bolt', link: '/automation-hub', also: ['/agent-builder', '/workflow'] },
    ]},
    { key: 'workspaces', label: 'Workspaces', workspaces: [
      { label: 'Insurance', icon: 'shield-check', flag: 'agencyMode', items: [
        { label: 'Clients', link: '/clients' }, { label: 'Policies', link: '/policies' }, { label: 'Renewals', link: '/renewals' },
        { label: 'Calendar', link: '/calendar' }, { label: 'Commission', link: '/commission' }, { label: 'Loss runs', link: '/loss-runs' },
        { label: 'Gap analysis', link: '/gap-analysis' }, { label: 'COI', link: '/coi' }, { label: 'Automation', link: '/insurance-automation' },
        { label: 'AI reports', link: '/agency-reports', query: { type: 'insurance' } } ]},
      { label: 'Immigration', icon: 'world', flag: 'immigrationMode', items: [
        { label: 'Visa tracker', link: '/immigration', exact: true, also: ['/immigration-case'] },
        { label: 'Cases', link: '/immigration', query: { section: 'cases' } },
        { label: 'Clients', link: '/immigration', query: { section: 'crm' } },
        { label: 'Forms', link: '/immigration', query: { section: 'forms' } },
        { label: 'E-signature', link: '/immigration', query: { section: 'esign' } },
        { label: 'Reports', link: '/immigration', query: { section: 'reports' } },
        { label: 'Legal AI', link: '/immigration', query: { section: 'ai' } },
        { label: 'Translations', link: '/immigration', query: { section: 'translate' } },
        { label: 'AI reports', link: '/agency-reports', query: { type: 'immigration' } } ]},
      { label: 'Finance', icon: 'receipt-tax', flag: 'financeMode', items: [
        { label: 'Expenses', link: '/finance', query: { tab: 'expenses' } },
        { label: 'Reconciliations', link: '/finance', query: { tab: 'reconciliation' } },
        { label: 'Payments', link: '/finance', query: { tab: 'payments' } },
        { label: 'Vendors', link: '/finance', query: { tab: 'vendors' } },
        { label: 'Taxes', link: '/finance', query: { tab: 'tax' } },
        { label: 'AI reports', link: '/agency-reports', query: { type: 'finance' } } ]},
      { label: 'Legal', icon: 'scale', flag: 'legalMode', items: [
        { label: 'Clauses', link: '/legal', query: { tab: 'clauses' } },
        { label: 'Obligations', link: '/legal', query: { tab: 'obligations' } },
        { label: 'Renewals', link: '/legal', query: { tab: 'renewals' } },
        { label: 'Counterparties', link: '/legal', query: { tab: 'counterparties' } },
        { label: 'Litigation holds', link: '/legal', query: { tab: 'holds' } },
        { label: 'Compare to template', link: '/legal', query: { tab: 'template' } },
        { label: 'AI reports', link: '/agency-reports', query: { type: 'legal' } } ]},
      { label: 'Healthcare', icon: 'heartbeat', flag: 'medicalMode', items: [
        { label: 'Prescriptions', link: '/healthcare', query: { tab: 'prescriptions' } },
        { label: 'Diagnoses', link: '/healthcare', query: { tab: 'diagnoses' } },
        { label: 'Procedures', link: '/healthcare', query: { tab: 'procedures' } },
        { label: 'Consents', link: '/healthcare', query: { tab: 'consents' } },
        { label: 'Referrals', link: '/healthcare', query: { tab: 'referrals' } },
        { label: 'AI reports', link: '/agency-reports', query: { type: 'medical' } } ]},
      { label: 'Real estate', icon: 'building-estate', flag: 'realEstateMode', items: [
        { label: 'Leases', link: '/real-estate', query: { tab: 'leases' } },
        { label: 'Closings', link: '/real-estate', query: { tab: 'closing' } },
        { label: 'Inspections', link: '/real-estate', query: { tab: 'inspections' } },
        { label: 'Escrow', link: '/real-estate', query: { tab: 'escrow' } },
        { label: 'Ownership', link: '/real-estate', query: { tab: 'ownership' } },
        { label: 'AI reports', link: '/agency-reports', query: { type: 'real_estate' } } ]},
      { label: 'HR and people', icon: 'users', flag: 'hrMode', items: [
        { label: 'Candidates', link: '/hr', query: { tab: 'talent' } },
        { label: 'Onboarding', link: '/hr', query: { tab: 'onboarding' } },
        { label: 'Policies', link: '/hr', query: { tab: 'policies' } },
        { label: 'Training', link: '/hr', query: { tab: 'training' } },
        { label: 'Promotions', link: '/hr', query: { tab: 'promotions' } },
        { label: 'AI reports', link: '/agency-reports', query: { type: 'hr' } } ]},
      { label: 'Supply chain', icon: 'truck', flag: 'supplyChainMode', items: [
        { label: 'Shipments', link: '/supply-chain', query: { tab: 'logistics' } },
        { label: 'Carriers', link: '/supply-chain', query: { tab: 'carriers' } },
        { label: 'Suppliers', link: '/supply-chain', query: { tab: 'sanctions' } },
        { label: 'Customs', link: '/supply-chain', query: { tab: 'customs' } },
        { label: 'Inventory', link: '/supply-chain', query: { tab: 'inventory' } },
        { label: 'AI reports', link: '/agency-reports', query: { type: 'supply_chain' } } ]},
      { label: 'Operations', icon: 'briefcase', flag: 'operationsMode', items: [
        { label: 'Matters', link: '/matters' }, { label: 'Claims', link: '/claims' }, { label: 'Quotes', link: '/quotes' },
        { label: 'CLM', link: '/clm', flag: 'clmMode' }, { label: 'Jurisdiction', link: '/jurisdiction' },
        { label: 'AI reports', link: '/agency-reports', query: { type: 'operations' } } ]},
    ]},
    { key: 'governance', label: 'Governance', flag: 'complianceMode', items: [
      { label: 'Risk', icon: 'alert-triangle', link: '/risk' },
      { label: 'Audit', icon: 'list-search', link: '/audit' },
      { label: 'Pilot report', icon: 'clipboard-check', link: '/pilot-report' },
      { label: 'AI reports', icon: 'report-analytics', link: '/agency-reports', query: { type: 'compliance' } },
    ]},
    { key: 'productivity', label: 'Productivity', items: [
      { label: 'Daily planner', icon: 'calendar-check', link: '/planner' },
      { label: 'Quick notes', icon: 'notes', link: '/notes' },
    ]},
    { key: 'tools', label: 'Tools', items: [
      { label: 'Code scanner', icon: 'code', link: '/code-scanner' },
    ]},
  ];

  closed: Record<string, boolean> = this.loadState('udv_nav_closed');
  openWs: Record<string, boolean> = this.loadState('udv_nav_ws');
  collapsed = localStorage.getItem('udv_nav_collapsed') === '1';

  @Output() openAskAi      = new EventEmitter<void>();
  @Output() openVoice      = new EventEmitter<void>();
  @Output() folderSelected = new EventEmitter<string>();

  private alertPollInterval?: any;

  constructor(
    public theme: ThemeService,
    public  toast:     ToastService,
    private api:       ApiService,
    public  folderSvc: FolderService,
    public  auth:      AuthService,
    public  features:  FeatureFlagService,   // ← NEW
    public  languageService: LanguageService,
    private http:      HttpClient,
    private cdr:       ChangeDetectorRef,
    private router:    Router,
  ) {}

  // ── Nav helpers ──────────────────────────────────────────────────────────────
  private loadState(key: string): Record<string, boolean> {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
  }
  private saveState(key: string, v: any): void {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
  }
  on(flag?: string): boolean {
    return !flag || !!(this.features as any)[flag]?.();
  }
  visible(item: NavItem): boolean {
    return this.on(item.flag) && (!item.admin || this.auth.isAdmin());
  }
  toggleGroup(key: string): void {
    this.closed = { ...this.closed, [key]: !this.closed[key] };
    this.saveState('udv_nav_closed', this.closed);
  }
  toggleWs(label: string): void {
    this.openWs = { ...this.openWs, [label]: !this.openWs[label] };
    this.saveState('udv_nav_ws', this.openWs);
  }
  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    localStorage.setItem('udv_nav_collapsed', this.collapsed ? '1' : '0');
  }
  wsActive(ws: NavWorkspace): boolean {
    const path = this.router.url.split('?')[0];
    return ws.items.some(i => i.link === path || path.startsWith(i.link + '/') || !!i.also?.includes(path));
  }
  /** Exact match on path and query, so sibling tabs of one page highlight separately. */
  isActive(item: NavItem | { link: string; query?: Record<string, string> }): boolean {
    const [path, qs] = this.router.url.split('?');
    if ((item as NavItem).also?.includes(path)) return true;
    if (path !== item.link) return false;
    if (!item.query) return !(item as NavItem).exact || !qs;
    const p = new URLSearchParams(qs || '');
    return Object.entries(item.query).every(([k, v]) => p.get(k) === v);
  }

  ngOnInit(): void {
    // Open the workspace that contains the current page, and re-render highlights on navigation
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      const ws = (this.groups.find(g => g.key === 'workspaces')?.workspaces || []).find(w => this.wsActive(w));
      if (ws && !this.openWs[ws.label]) this.openWs = { ...this.openWs, [ws.label]: true };
      this.cdr.markForCheck();
    });
    this.loadDocuments();
    this.loadCustomFolders();
    this.pollAlerts();
    this.loadModels();
    this.alertPollInterval = setInterval(() => this.pollAlerts(), 60_000);
  }

  ngOnDestroy(): void {
    if (this.alertPollInterval) clearInterval(this.alertPollInterval);
  }

  // ---------------------------------------------------------------------------
  // Documents + folder counts
  // ---------------------------------------------------------------------------
  loadDocuments(): void {
    this.api.getDocuments({}).subscribe({
      next: (res: any) => {
        const docs = Array.isArray(res) ? res : res.documents || [];
        this.docCount = docs.length;

        this.folders = this.folders.map(f => ({
          ...f,
          count: f.id === 'all'
            ? docs.length
            : docs.filter((d: any) => d.doc_type === f.id).length
        }));

        this.customFolders = this.folderSvc.getFolders().map(name => ({
          name,
          count: this.folderSvc.countInFolder(docs, name)
        }));

        const totalBytes = docs.reduce((sum: number, d: any) => sum + (d.file_size || 0), 0);
        this.storageUsed    = Math.round((totalBytes / 1024 / 1024) * 100) / 100;
        this.storagePercent = Math.min((this.storageUsed / 10240) * 100, 100);

        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  // ---------------------------------------------------------------------------
  // Alerts badge
  // ---------------------------------------------------------------------------
  pollAlerts(): void {
    this.http.get<{ unread: number }>('/api/notifications/unread').subscribe({
      next: (res) => {
        this.unreadAlerts = res.unread;
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  // ---------------------------------------------------------------------------
  // Model switcher
  // ---------------------------------------------------------------------------
  loadModels(): void {
    this.http.get<{ installed_models: string[] }>('http://localhost:7979/api/models/list-models').subscribe({
      next: (res) => {
        this.models = res.installed_models;
        this.cdr.markForCheck();
      },
      error: () => {}
    });
    this.http.get<{ selected_model: string }>('http://localhost:7979/api/models/get-model').subscribe({
      next: (res) => {
        this.currentModel = res.selected_model;
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  switchModel(modelName: string): void {
    if (modelName === this.currentModel || this.switchingModel) return;
    this.switchingModel = true;
    this.cdr.markForCheck();
    this.http.post<{ selected_model: string }>('http://localhost:7979/api/models/set-model', {
      model_name: modelName
    }).subscribe({
      next: (res) => {
        this.currentModel   = res.selected_model;
        this.switchingModel = false;
        this.toast.success(`Switched to ${res.selected_model}`);
        this.cdr.markForCheck();
      },
      error: () => {
        this.switchingModel = false;
        this.toast.error('Failed to switch model');
        this.cdr.markForCheck();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Folder operations
  // ---------------------------------------------------------------------------
  loadCustomFolders(): void {
    this.customFolders = this.folderSvc.getFolders().map(name => ({
      name,
      count: 0
    }));
    this.cdr.markForCheck();
  }

  createFolder(): void {
    const name = this.newFolderName.trim();
    if (!name) return;

    const existing = this.folderSvc.getFolders();
    if (existing.includes(name)) {
      this.toast.error(`Folder "${name}" already exists`);
      return;
    }

    this.folderSvc.addFolder(name);
    this.newFolderName = '';
    this.showNewFolder = false;
    this.loadDocuments();
    this.toast.success(`Folder "${name}" created`);
  }

  deleteCustomFolder(name: string): void {
    this.folderSvc.deleteFolder(name);
    if (this.activeFolderName === name) {
      this.activeFolderName = '';
      this.activeFolder     = 'all';
    }
    this.loadCustomFolders();
    this.toast.info(`Folder "${name}" deleted`);
  }

  startRename(name: string): void {
    this.editingFolder  = name;
    this.editFolderName = name;
    this.cdr.markForCheck();
  }

  confirmRename(oldName: string): void {
    const newName = this.editFolderName.trim();
    if (!newName || newName === oldName) {
      this.cancelRename();
      return;
    }
    this.folderSvc.renameFolder(oldName, newName);
    if (this.activeFolderName === oldName) {
      this.activeFolderName = newName;
    }
    this.editingFolder  = '';
    this.editFolderName = '';
    this.loadCustomFolders();
    this.toast.success(`Renamed to "${newName}"`);
  }

  cancelRename(): void {
    this.editingFolder  = '';
    this.editFolderName = '';
    this.cdr.markForCheck();
  }

  selectFolder(id: string): void {
    this.activeFolder     = id;
    this.activeFolderName = '';
    this.folderSelected.emit(id);
  }

  selectCustomFolder(name: string): void {
    this.activeFolderName = name;
    this.activeFolder     = '';
    this.folderSelected.emit(name);
  }

  logout(): void { this.auth.logout(); }

  changeLanguage(lang: string): void {
    this.languageService.currentLang.set(lang);
    this.toast.success(`Language switched to ${lang.toUpperCase()}`);
    this.loadDocuments();
    this.cdr.markForCheck();
  }
}

export interface NavItem {
  label: string; icon?: string; link: string;
  query?: Record<string, string>; badge?: 'docs'; flag?: string; admin?: boolean;
  also?: string[];
  exact?: boolean;   // only active when the URL has no query (a page's default tab)   // other routes that belong to this entry (hub tabs, older pages) — highlight it there too
}
export interface NavWorkspace { label: string; icon: string; flag?: string; items: NavItem[]; }
export interface NavGroup { key: string; label: string; flag?: string; items?: NavItem[]; workspaces?: NavWorkspace[]; }
