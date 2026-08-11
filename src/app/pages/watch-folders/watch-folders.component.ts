import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FolderService } from '../../services/folder.service';

interface FolderConfig {
  id: string;
  path: string;
  label: string;
  source_type: string;
  batch_size: number;
  max_workers: number;
  status: 'active' | 'paused' | 'error' | 'idle';
  added_at: string;
  files_processed: number;
  files_pending: number;
  last_batch_at: string | null;
  last_error: string | null;
  target_folder: string;
}

interface BatchProgress {
  batch_id: string;
  total: number;
  done: number;
  succeeded: number;
  failed: number;
}

interface BatchReport {
  batch_id: string;
  started_at: string;
  completed_at: string;
  total: number;
  succeeded: number;
  failed: number;
  total_size_mb: number;
  files: any[];
}

interface FolderState {
  config: FolderConfig;
  progress: BatchProgress | null;
  recentReports: BatchReport[];
  sse: EventSource | null;
  expanded: boolean;
}

@Component({
  selector: 'app-watch-folders',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatChipsModule,
    MatProgressBarModule, MatTooltipModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatExpansionModule, MatDividerModule, MatBadgeModule, MatSnackBarModule,
  ],
  template: `
    <div class="watch-folders-page">

      <div class="page-header">
        <div class="header-left">
          <mat-icon class="page-icon">folder_open</mat-icon>
          <div>
            <h1>Watch Folders</h1>
            <p class="subtitle">Auto-ingest files from local, NFS, or any mounted path — processed in batches of 5</p>
          </div>
        </div>
        <button mat-raised-button color="primary" (click)="showAddDialog = true">
          <mat-icon>add</mat-icon> Add Folder
        </button>
      </div>

      <!-- Summary bar -->
      <div class="summary-bar" *ngIf="folderStates.length > 0">
        <div class="summary-chip">
          <mat-icon>folder</mat-icon>
          <span>{{ folderStates.length }} folder{{ folderStates.length !== 1 ? 's' : '' }}</span>
        </div>
        <div class="summary-chip active">
          <mat-icon>visibility</mat-icon>
          <span>{{ activeCount }} active</span>
        </div>
        <div class="summary-chip">
          <mat-icon>check_circle</mat-icon>
          <span>{{ totalProcessed }} processed</span>
        </div>
        <div class="summary-chip pending" *ngIf="totalPending > 0">
          <mat-icon>hourglass_empty</mat-icon>
          <span>{{ totalPending }} pending</span>
        </div>
        <div class="summary-chip batch-info">
          <mat-icon>lock</mat-icon>
          <span>Batch limit: 5 files per cycle</span>
        </div>
      </div>

      <!-- Empty state -->
      <div class="empty-state" *ngIf="folderStates.length === 0 && !showAddDialog">
        <mat-icon>folder_open</mat-icon>
        <h2>No watch folders configured</h2>
        <p>Add a folder and UniDocVerse will automatically detect, batch (5 at a time), and process new files — no manual uploads needed.</p>
        <button mat-raised-button color="primary" (click)="showAddDialog = true">
          <mat-icon>add</mat-icon> Add Your First Folder
        </button>
      </div>

      <!-- Add folder panel -->
      <mat-card class="add-folder-card" *ngIf="showAddDialog">
        <mat-card-header>
          <mat-icon mat-card-avatar>create_new_folder</mat-icon>
          <mat-card-title>Add Watch Folder</mat-card-title>
          <mat-card-subtitle>Files will be auto-processed in batches of 5 to protect system performance</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="add-form">

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Folder Path</mat-label>
              <input matInput [(ngModel)]="newFolder.path"
                     placeholder="/Users/you/Documents/invoices or \\\\server\\share\\docs">
              <mat-icon matSuffix>folder</mat-icon>
              <mat-hint>Full path — local folder, NFS mount, or any accessible path</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Label (optional)</mat-label>
              <input matInput [(ngModel)]="newFolder.label" placeholder="e.g. Invoices, Tax Docs">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Source Type</mat-label>
              <mat-select [(ngModel)]="newFolder.source_type">
                <mat-option value="local">📁 Local Folder / NFS / Network Share</mat-option>
                <mat-option value="sharepoint" disabled>☁️ SharePoint (coming soon)</mat-option>
                <mat-option value="gdrive" disabled>📗 Google Drive (coming soon)</mat-option>
                <mat-option value="s3" disabled>🪣 Amazon S3 (coming soon)</mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Batch size — locked to 5 -->
            <mat-form-field appearance="outline">
              <mat-label>Batch Size</mat-label>
              <input matInput [value]="'5 files per batch (locked)'" readonly>
              <mat-icon matSuffix matTooltip="Fixed at 5 per batch to protect system performance">lock</mat-icon>
              <mat-hint>5 files processed per batch cycle to protect performance</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Parallel Workers</mat-label>
              <mat-select [(ngModel)]="newFolder.max_workers">
                <mat-option [value]="1">1 (conservative)</mat-option>
                <mat-option [value]="2">2 (recommended)</mat-option>
                <mat-option [value]="3">3 (fast)</mat-option>
              </mat-select>
              <mat-hint>Number of files processed simultaneously within a batch</mat-hint>
            </mat-form-field>

          </div>
        </mat-card-content>
        <mat-card-actions>
          <button mat-raised-button color="primary" (click)="addFolder()" [disabled]="!newFolder.path || adding">
            <mat-icon>{{ adding ? 'hourglass_empty' : 'add' }}</mat-icon>
            {{ adding ? 'Adding...' : 'Start Watching' }}
          </button>
          <button mat-button (click)="showAddDialog = false; resetNewFolder()">Cancel</button>
        </mat-card-actions>
      </mat-card>

      <!-- Folder cards -->
      <div class="folders-list">
        <mat-card class="folder-card" *ngFor="let state of folderStates; trackBy: trackById">
          <div class="folder-header">
            <div class="folder-icon-wrap" [class]="'status-' + state.config.status">
              <mat-icon>{{ getStatusIcon(state.config.status) }}</mat-icon>
            </div>
            <div class="folder-info">
              <div class="folder-label">{{ state.config.label }}</div>
              <div class="folder-path">{{ state.config.path }}</div>
              <div class="folder-meta">
                Added {{ state.config.added_at | date:'MMM d, y' }}
                <span *ngIf="state.config.last_batch_at">· Last batch {{ state.config.last_batch_at | date:'short' }}</span>
                <span class="target-tag" *ngIf="state.config.target_folder">📁 {{ state.config.target_folder }}</span>
                <span class="batch-tag">5 per batch</span>
              </div>
            </div>
            <div class="folder-stats">
              <div class="stat">
                <span class="stat-value">{{ state.config.files_processed }}</span>
                <span class="stat-label">processed</span>
              </div>
              <div class="stat" *ngIf="state.config.files_pending > 0">
                <span class="stat-value pending">{{ state.config.files_pending }}</span>
                <span class="stat-label">pending</span>
              </div>
            </div>
            <div class="folder-actions">
              <span class="status-badge" [class]="'badge-' + state.config.status">{{ state.config.status }}</span>
              <button mat-icon-button [matTooltip]="state.config.status === 'active' ? 'Pause' : 'Resume'"
                      (click)="togglePause(state)">
                <mat-icon>{{ state.config.status === 'active' ? 'pause' : 'play_arrow' }}</mat-icon>
              </button>
              <button mat-icon-button matTooltip="Reports" (click)="loadReports(state); state.expanded = !state.expanded">
                <mat-icon>assessment</mat-icon>
              </button>
              <button mat-icon-button matTooltip="Remove folder" color="warn" (click)="removeFolder(state)">
                <mat-icon>delete_outline</mat-icon>
              </button>
            </div>
          </div>

          <!-- Batch progress -->
          <div class="batch-progress" *ngIf="state.progress && state.progress.total > 0">
            <div class="progress-label">
              <span>Batch in progress — {{ state.progress.done }} / {{ state.progress.total }} files</span>
              <span class="progress-counts">
                <span class="ok">✓ {{ state.progress.succeeded }}</span>
                <span class="err" *ngIf="state.progress.failed > 0">✗ {{ state.progress.failed }}</span>
              </span>
            </div>
            <mat-progress-bar mode="determinate"
              [value]="(state.progress.done / state.progress.total) * 100" color="primary">
            </mat-progress-bar>
          </div>

          <div class="folder-error" *ngIf="state.config.last_error">
            <mat-icon>error_outline</mat-icon>
            <span>{{ state.config.last_error }}</span>
          </div>

          <!-- Batch reports -->
          <div class="reports-section" *ngIf="state.expanded">
            <mat-divider></mat-divider>
            <div class="reports-header"><mat-icon>history</mat-icon> Recent Batch Reports</div>
            <div *ngIf="state.recentReports.length === 0" class="no-reports">No batches processed yet</div>
            <div class="report-row" *ngFor="let r of state.recentReports">
              <div class="report-meta">
                <span class="report-id">{{ r.batch_id }}</span>
                <span class="report-time">{{ r.completed_at | date:'short' }}</span>
              </div>
              <div class="report-counts">
                <span class="size-info">{{ r.total_size_mb | number:'1.1-1' }} MB</span>
                <span class="ok-count">✓ {{ r.succeeded }}</span>
                <span class="err-count" *ngIf="r.failed > 0">✗ {{ r.failed }}</span>
                <span class="total-count">{{ r.total }} files</span>
              </div>
            </div>
          </div>
        </mat-card>
      </div>

      <div class="formats-note" *ngIf="folderStates.length > 0">
        <mat-icon>info_outline</mat-icon>
        <span>Supported: Any file format · Batch limit: 5 files per cycle to protect system performance</span>
      </div>

    </div>
  `,
  styles: [`
    .watch-folders-page { padding: 2rem; max-width: 1100px; margin: 0 auto; }
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
    .header-left { display: flex; align-items: center; gap: 1rem; }
    .page-icon { font-size: 40px; width: 40px; height: 40px; color: #4caf50; }
    .page-header h1 { margin: 0 0 0.25rem 0; font-size: 24px; font-weight: 600; }
    .subtitle { margin: 0; color: #757575; font-size: 14px; }
    .summary-bar { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
    .summary-chip { display: flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.8rem; background: #f5f5f5; border-radius: 20px; font-size: 13px; color: #555; }
    .summary-chip mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .summary-chip.active { background: #e8f5e9; color: #2e7d32; }
    .summary-chip.pending { background: #fff8e1; color: #f57f17; }
    .summary-chip.batch-info { background: #e8f0fe; color: #1a73e8; }
    .empty-state { text-align: center; padding: 5rem 2rem; color: #bdbdbd; }
    .empty-state mat-icon { font-size: 72px; width: 72px; height: 72px; color: #e0e0e0; margin-bottom: 1rem; }
    .empty-state h2 { color: #757575; margin-bottom: 0.5rem; }
    .empty-state p { color: #9e9e9e; margin-bottom: 1.5rem; max-width: 480px; margin-inline: auto; }
    .add-folder-card { margin-bottom: 1.5rem; border: 2px dashed #4caf50 !important; }
    .add-form { display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 1rem; }
    .add-form .full-width { width: 100%; }
    .add-form mat-form-field { flex: 1; min-width: 220px; }
    .folders-list { display: flex; flex-direction: column; gap: 1rem; }
    .folder-card { overflow: hidden; }
    .folder-header { display: flex; align-items: flex-start; gap: 1rem; padding: 1.25rem 1.25rem 1rem; }
    .folder-icon-wrap { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .folder-icon-wrap.status-active  { background: #e8f5e9; color: #4caf50; }
    .folder-icon-wrap.status-paused  { background: #fff8e1; color: #ff9800; }
    .folder-icon-wrap.status-error   { background: #ffebee; color: #f44336; }
    .folder-icon-wrap.status-idle    { background: #f5f5f5; color: #9e9e9e; }
    .folder-info { flex: 1; min-width: 0; }
    .folder-label { font-weight: 600; font-size: 16px; color: #212121; }
    .folder-path { font-size: 12px; color: #757575; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 2px 0; }
    .folder-meta { font-size: 12px; color: #9e9e9e; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .target-tag { background: #e8f5e9; color: #2e7d32; padding: 1px 6px; border-radius: 10px; font-size: 11px; }
    .batch-tag { background: #e8f0fe; color: #1a73e8; padding: 1px 6px; border-radius: 10px; font-size: 11px; }
    .folder-stats { display: flex; gap: 1.5rem; align-items: center; }
    .stat { text-align: center; }
    .stat-value { display: block; font-size: 20px; font-weight: 700; color: #212121; }
    .stat-value.pending { color: #ff9800; }
    .stat-label { font-size: 11px; color: #9e9e9e; text-transform: uppercase; }
    .folder-actions { display: flex; align-items: center; gap: 0.25rem; flex-shrink: 0; }
    .status-badge { padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .badge-active  { background: #e8f5e9; color: #2e7d32; }
    .badge-paused  { background: #fff8e1; color: #e65100; }
    .badge-error   { background: #ffebee; color: #c62828; }
    .badge-idle    { background: #f5f5f5; color: #757575; }
    .batch-progress { padding: 0 1.25rem 1rem; }
    .progress-label { display: flex; justify-content: space-between; font-size: 13px; color: #555; margin-bottom: 0.4rem; }
    .progress-counts .ok  { color: #4caf50; margin-right: 0.5rem; }
    .progress-counts .err { color: #f44336; }
    .folder-error { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.25rem; background: #ffebee; color: #c62828; font-size: 13px; }
    .reports-section { padding: 0 1.25rem 1.25rem; }
    .reports-header { display: flex; align-items: center; gap: 0.5rem; font-weight: 600; font-size: 14px; color: #424242; padding: 1rem 0 0.75rem; }
    .no-reports { color: #9e9e9e; font-size: 13px; padding: 0.5rem 0; }
    .report-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid #f5f5f5; font-size: 13px; }
    .report-meta { display: flex; flex-direction: column; gap: 2px; }
    .report-id { font-family: monospace; font-size: 11px; color: #9e9e9e; }
    .report-time { color: #555; }
    .report-counts { display: flex; align-items: center; gap: 0.75rem; }
    .size-info { color: #9e9e9e; }
    .ok-count { color: #4caf50; font-weight: 600; }
    .err-count { color: #f44336; font-weight: 600; }
    .total-count { color: #757575; }
    .formats-note { display: flex; align-items: center; gap: 0.5rem; margin-top: 1.5rem; padding: 0.75rem 1rem; background: #f5f5f5; border-radius: 8px; font-size: 13px; color: #757575; }
  `]
})
export class WatchFoldersComponent implements OnInit, OnDestroy {

  folderStates: FolderState[] = [];
  showAddDialog = false;
  adding = false;

  readonly BATCH_SIZE = 5; // locked — protects system performance

  newFolder = {
    path:          '',
    label:         '',
    source_type:   'local',
    batch_size:    5,
    max_workers:   2,
    target_folder: '',
  };

  get availableFolders(): string[] {
    return this.folderSvc.getFolders();
  }

  private apiBase = 'http://localhost:8000';
  private pollInterval: any;

  constructor(
    private http:      HttpClient,
    private cd:        ChangeDetectorRef,
    private snack:     MatSnackBar,
    public  folderSvc: FolderService,
  ) {}

  ngOnInit() {
    this.loadFolders();
    this.pollInterval = setInterval(() => this.refreshStatuses(), 10000);
  }

  ngOnDestroy() {
    clearInterval(this.pollInterval);
    this.folderStates.forEach(s => s.sse?.close());
  }

  loadFolders() {
    this.http.get<any[]>(`${this.apiBase}/api/watch-folders/folders`).subscribe({
      next: folders => {
        this.folderStates = folders.map(f => ({ config: f, progress: null, recentReports: [], sse: null, expanded: false }));
        this.folderStates.forEach(s => this.subscribeSSE(s));
        this.cd.detectChanges();
      },
      error: () => {},
    });
  }

  refreshStatuses() {
    this.folderStates.forEach(state => {
      this.http.get<any>(`${this.apiBase}/api/watch-folders/folders/${state.config.id}/status`)
        .subscribe({ next: status => { Object.assign(state.config, status); this.cd.detectChanges(); }, error: () => {} });
    });
  }

  addFolder() {
    if (!this.newFolder.path) return;
    this.adding = true;
    const payload = { ...this.newFolder, batch_size: this.BATCH_SIZE };
    this.http.post<any>(`${this.apiBase}/api/watch-folders/folders`, payload).subscribe({
      next: config => {
        const state: FolderState = { config, progress: null, recentReports: [], sse: null, expanded: false };
        this.folderStates.push(state);
        this.subscribeSSE(state);
        this.showAddDialog = false;
        this.adding = false;
        this.resetNewFolder();
        this.snack.open(`✓ Watching: ${config.label} — batch size: 5`, 'OK', { duration: 3000 });
        this.cd.detectChanges();
      },
      error: err => {
        this.adding = false;
        this.snack.open(`Error: ${err.error?.detail || 'Failed to add folder'}`, 'OK', { duration: 4000, panelClass: 'error-snack' });
      },
    });
  }

  removeFolder(state: FolderState) {
    if (!confirm(`Remove watch folder "${state.config.label}"?`)) return;
    state.sse?.close();
    this.http.delete(`${this.apiBase}/api/watch-folders/folders/${state.config.id}`).subscribe({
      next: () => {
        this.folderStates = this.folderStates.filter(s => s.config.id !== state.config.id);
        this.snack.open('Folder removed', 'OK', { duration: 2000 });
        this.cd.detectChanges();
      },
      error: () => this.snack.open('Failed to remove folder', 'OK', { duration: 3000 }),
    });
  }

  togglePause(state: FolderState) {
    const action = state.config.status === 'active' ? 'pause' : 'resume';
    this.http.post(`${this.apiBase}/api/watch-folders/folders/${state.config.id}/${action}`, {}).subscribe({
      next: () => {
        state.config.status = action === 'pause' ? 'paused' : 'active';
        this.snack.open(action === 'pause' ? '⏸ Paused' : '▶ Resumed', 'OK', { duration: 2000 });
        this.cd.detectChanges();
      },
      error: () => {},
    });
  }

  loadReports(state: FolderState) {
    this.http.get<any>(`${this.apiBase}/api/watch-folders/folders/${state.config.id}/reports`)
      .subscribe({ next: res => { state.recentReports = res.reports || []; this.cd.detectChanges(); }, error: () => {} });
  }

  subscribeSSE(state: FolderState) {
    state.sse?.close();
    const es = new EventSource(`${this.apiBase}/api/watch-folders/folders/${state.config.id}/progress`);
    es.onmessage = (ev) => {
      try {
        const event = JSON.parse(ev.data);
        if (event.type === 'ping') return;
        if (event.type === 'status_change') { state.config.status = event.status; }
        if (event.type === 'batch_progress') {
          state.progress = { batch_id: event.batch_id, total: event.total, done: event.done, succeeded: event.succeeded, failed: event.failed };
          state.config.files_pending = event.total - event.done;
        }
        if (event.type === 'batch_complete') {
          state.progress = null;
          state.config.files_processed += event.succeeded;
          state.config.files_pending    = 0;
          state.config.last_batch_at    = event.completed_at;
          if (state.expanded) this.loadReports(state);
          this.snack.open(`✓ Batch complete — ${event.succeeded} processed, ${event.failed} failed`, 'OK', { duration: 4000 });
        }
        this.cd.detectChanges();
      } catch {}
    };
    es.onerror = () => { state.config.status = 'error'; this.cd.detectChanges(); };
    state.sse  = es;
  }

  getStatusIcon(status: string): string {
    return { active: 'visibility', paused: 'pause_circle', error: 'error', idle: 'folder' }[status] || 'folder';
  }

  resetNewFolder() {
    this.newFolder = { path: '', label: '', source_type: 'local', batch_size: 5, max_workers: 2, target_folder: '' };
  }

  trackById(_: number, s: FolderState) { return s.config.id; }

  get activeCount()    { return this.folderStates.filter(s => s.config.status === 'active').length; }
  get totalProcessed() { return this.folderStates.reduce((a, s) => a + s.config.files_processed, 0); }
  get totalPending()   { return this.folderStates.reduce((a, s) => a + s.config.files_pending, 0); }
}