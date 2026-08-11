// app/main-nav/main-nav.component.ts
import {
  Component, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
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
  ) {}

  ngOnInit(): void {
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
    this.http.get<{ installed_models: string[] }>('http://localhost:8000/api/models/list-models').subscribe({
      next: (res) => {
        this.models = res.installed_models;
        this.cdr.markForCheck();
      },
      error: () => {}
    });
    this.http.get<{ selected_model: string }>('http://localhost:8000/api/models/get-model').subscribe({
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
    this.http.post<{ selected_model: string }>('http://localhost:8000/api/models/set-model', {
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