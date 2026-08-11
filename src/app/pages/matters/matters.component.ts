import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { UdvSelectComponent, SelectOption } from '../../components/udv-select/udv-select.component';

const API = 'http://localhost:8000/api';

const STAGE_ORDER = ['intake', 'investigation', 'negotiation', 'litigation', 'settlement', 'closed'] as const;
type Stage = typeof STAGE_ORDER[number];

const STAGE_COLORS: Record<Stage, string> = {
  intake: '#94a3b8',
  investigation: '#3b82f6',
  negotiation: '#f59e0b',
  litigation: '#ef4444',
  settlement: '#8b5cf6',
  closed: '#10b981'
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#94a3b8',
  normal: '#3b82f6',
  high: '#f59e0b',
  urgent: '#ef4444'
};

const MATTER_ICONS: Record<string, string> = {
  contract: '📄',
  litigation: '⚖️',
  compliance: '🛡',
  ip: '💡',
  employment: '👥',
  general: '📁'
};

const ROLE_OPTIONS = ['primary', 'supporting', 'evidence', 'correspondence', 'filed'];

@Component({
  selector: 'app-matters',
  standalone: true,
  imports: [CommonModule, FormsModule, UdvSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="matters-root">
  <!-- HEADER -->
  <div class="matters-header">
    <div class="header-left">
      <span class="header-icon">⚖️</span>
      <h1>Legal Matters</h1>
    </div>
    <button class="btn-primary" (click)="openNewModal()">+ New Matter</button>
  </div>

  <!-- KANBAN BOARD -->
  <div class="kanban-board" [class.panel-open]="selectedMatter">
    <div class="kanban-columns">
      <div class="kanban-col" *ngFor="let stage of stages">
        <div class="col-header" [style.borderTopColor]="stageColor(stage)">
          <span class="col-title" [style.color]="stageColor(stage)">{{ stage | titlecase }}</span>
          <span class="col-count">{{ mattersForStage(stage).length }}</span>
        </div>
        <div class="col-cards">
          <div
            class="matter-card"
            *ngFor="let m of mattersForStage(stage)"
            [class.selected]="selectedMatter?.id === m.id"
            (click)="selectMatter(m)"
          >
            <div class="card-top">
              <span class="matter-icon">{{ matterIcon(m.matter_type) }}</span>
              <span class="priority-badge" [style.background]="priorityColor(m.priority)">{{ m.priority }}</span>
            </div>
            <div class="card-title">{{ m.title }}</div>
            <div class="card-client" *ngIf="m.client_name">👤 {{ m.client_name }}</div>
            <div class="card-counsel" *ngIf="m.assigned_counsel">🏛 {{ m.assigned_counsel }}</div>
            <div class="card-footer">
              <span class="card-deadline" *ngIf="m.deadline">📅 {{ m.deadline | date:'MMM d, y' }}</span>
              <span class="card-docs">📎 {{ m.doc_count || 0 }}</span>
            </div>
          </div>
          <div class="col-empty" *ngIf="mattersForStage(stage).length === 0">No matters</div>
        </div>
      </div>
    </div>

    <!-- DETAIL PANEL -->
    <div class="detail-panel" *ngIf="selectedMatter">
      <div class="panel-header">
        <div class="panel-title-row">
          <span class="matter-icon lg">{{ matterIcon(selectedMatter.matter_type) }}</span>
          <input
            class="panel-title-input"
            [(ngModel)]="editTitle"
            (blur)="saveTitle()"
            (keydown.enter)="saveTitle()"
          />
        </div>
        <div class="panel-badges">
          <span class="type-badge">{{ selectedMatter.matter_type }}</span>
          <span class="priority-badge" [style.background]="priorityColor(selectedMatter.priority)">{{ selectedMatter.priority }}</span>
        </div>
        <button class="panel-close" (click)="selectedMatter = null; cdr.markForCheck()">✕</button>
      </div>

      <div class="panel-body">
        <!-- Fields -->
        <div class="field-grid">
          <div class="field-group">
            <label>Client</label>
            <input class="field-input" [(ngModel)]="editClient" placeholder="Client name" (blur)="patchField('client_name', editClient)" />
          </div>
          <div class="field-group">
            <label>Counsel</label>
            <input class="field-input" [(ngModel)]="editCounsel" placeholder="Assigned counsel" (blur)="patchField('assigned_counsel', editCounsel)" />
          </div>
          <div class="field-group">
            <label>Deadline</label>
            <input class="field-input" type="date" [(ngModel)]="editDeadline" (change)="patchField('deadline', editDeadline)" />
          </div>
        </div>

        <!-- Stage mover -->
        <div class="stage-mover">
          <label>Stage</label>
          <div class="stage-row">
            <udv-select [(ngModel)]="editStage" [options]="stageOptions" placeholder="Select stage…"></udv-select>
            <button class="btn-sm" (click)="saveStage()">Move</button>
          </div>
        </div>

        <!-- Documents section -->
        <div class="panel-section">
          <div class="section-header">
            <span>Documents</span>
            <button class="btn-sm" (click)="toggleDocPicker()">+ Add</button>
          </div>

          <!-- Doc picker -->
          <div class="doc-picker" *ngIf="showDocPicker">
            <input class="field-input" [(ngModel)]="docPickerSearch" placeholder="Search documents..." />
            <udv-select [(ngModel)]="newDocRole" [options]="roleSelectOptions" placeholder="Select role…"></udv-select>
            <div class="picker-list">
              <div
                class="picker-item"
                *ngFor="let d of filteredPickerDocs()"
                (click)="attachDoc(d)"
              >
                📄 {{ d.title || d.filename || d.id }}
              </div>
              <div class="picker-empty" *ngIf="filteredPickerDocs().length === 0">No documents found</div>
            </div>
          </div>

          <!-- Docs grouped by role -->
          <div *ngFor="let role of roleOptions">
            <div *ngIf="docsForRole(role).length > 0">
              <div class="role-label">{{ role | titlecase }}</div>
              <div class="doc-item" *ngFor="let md of docsForRole(role)">
                <span>📄 {{ md.title || md.doc_id }}</span>
                <button class="btn-icon" (click)="removeDoc(md.doc_id)">✕</button>
              </div>
            </div>
          </div>
          <div class="no-docs" *ngIf="matterDetail?.documents?.length === 0">No documents attached</div>
        </div>

        <!-- Notes section -->
        <div class="panel-section">
          <div class="section-header"><span>Notes</span></div>
          <div class="note-input-row">
            <textarea class="note-textarea" [(ngModel)]="newNoteText" placeholder="Add a note..." rows="2"></textarea>
            <button class="btn-sm" (click)="addNote()">Add</button>
          </div>
          <div class="note-list">
            <div class="note-item" *ngFor="let n of matterDetail?.notes || []">
              <div class="note-text">{{ n.content || n.text || n }}</div>
              <div class="note-meta" *ngIf="n.created_at">{{ n.created_at | date:'short' }}</div>
            </div>
            <div class="no-notes" *ngIf="(matterDetail?.notes?.length || 0) === 0">No notes yet</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- NEW MATTER MODAL -->
  <div class="modal-backdrop" *ngIf="showNewModal" (click)="closeModal($event)">
    <div class="modal-box" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <h2>New Legal Matter</h2>
        <button class="panel-close" (click)="showNewModal = false; cdr.markForCheck()">✕</button>
      </div>
      <div class="modal-body">
        <div class="field-group">
          <label>Title <span class="req">*</span></label>
          <input class="field-input" [(ngModel)]="newMatter.title" placeholder="Matter title" />
        </div>
        <div class="field-group">
          <label>Type <span class="req">*</span></label>
          <udv-select [(ngModel)]="newMatter.matter_type" [options]="matterTypeOptions" placeholder="Select type…"></udv-select>
        </div>
        <div class="field-group">
          <label>Client Name</label>
          <input class="field-input" [(ngModel)]="newMatter.client_name" placeholder="Client name" />
        </div>
        <div class="field-group">
          <label>Assigned Counsel</label>
          <input class="field-input" [(ngModel)]="newMatter.assigned_counsel" placeholder="Assigned counsel" />
        </div>
        <div class="field-group">
          <label>Priority</label>
          <udv-select [(ngModel)]="newMatter.priority" [options]="priorityOptions" placeholder="Select priority…"></udv-select>
        </div>
        <div class="field-group">
          <label>Deadline</label>
          <input class="field-input" type="date" [(ngModel)]="newMatter.deadline" />
        </div>
        <div class="field-group">
          <label>Description</label>
          <textarea class="field-input" [(ngModel)]="newMatter.description" rows="3" placeholder="Matter description..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" (click)="showNewModal = false; cdr.markForCheck()">Cancel</button>
        <button class="btn-primary" (click)="createMatter()" [disabled]="!newMatter.title || !newMatter.matter_type">Create Matter</button>
      </div>
    </div>
  </div>

  <!-- Loading overlay -->
  <div class="loading-overlay" *ngIf="loading">
    <div class="spinner"></div>
  </div>
</div>
  `,
  styles: [`
    :host { display: block; height: 100%; }

    .matters-root {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--surf);
      color: var(--t1);
      font-family: 'Inter', sans-serif;
      position: relative;
      overflow: hidden;
    }

    /* HEADER */
    .matters-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 24px;
      background: var(--surf2);
      border-bottom: 1px solid var(--bdr);
      flex-shrink: 0;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .header-icon { font-size: 22px; }
    h1 { font-size: 20px; font-weight: 700; margin: 0; color: var(--t1); }

    /* BUTTONS */
    .btn-primary {
      background: #6366f1;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 8px 18px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-primary:hover { background: #4f46e5; }
    .btn-primary:disabled { background: #475569; cursor: not-allowed; }
    .btn-ghost {
      background: transparent;
      color: var(--t2);
      border: 1px solid var(--bdr);
      border-radius: 8px;
      padding: 8px 16px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-ghost:hover { border-color: #6366f1; color: var(--t1); }
    .btn-sm {
      background: var(--surf3);
      color: var(--t1);
      border: none;
      border-radius: 6px;
      padding: 5px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s;
    }
    .btn-sm:hover { background: #475569; }
    .btn-icon {
      background: transparent;
      border: none;
      color: var(--t3);
      cursor: pointer;
      font-size: 13px;
      padding: 2px 5px;
      border-radius: 4px;
      transition: color 0.1s;
    }
    .btn-icon:hover { color: #ef4444; }

    /* KANBAN */
    .kanban-board {
      display: flex;
      flex: 1;
      overflow: hidden;
      position: relative;
    }
    .kanban-columns {
      display: flex;
      gap: 12px;
      padding: 16px;
      overflow-x: auto;
      flex: 1;
      transition: flex 0.25s;
    }
    .panel-open .kanban-columns {
      max-width: calc(100% - 400px);
    }
    .kanban-col {
      display: flex;
      flex-direction: column;
      min-width: 220px;
      flex: 1;
      background: var(--surf2);
      border-radius: 12px;
      overflow: hidden;
    }
    .col-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      border-top: 3px solid;
      background: var(--surf2);
    }
    .col-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
    .col-count {
      font-size: 12px;
      background: var(--surf3);
      color: var(--t2);
      border-radius: 10px;
      padding: 1px 7px;
      font-weight: 600;
    }
    .col-cards {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .col-empty {
      text-align: center;
      color: var(--t2);
      font-size: 12px;
      margin-top: 20px;
    }

    /* MATTER CARD */
    .matter-card {
      background: var(--surf);
      border-radius: 8px;
      padding: 12px;
      cursor: pointer;
      border: 1px solid var(--bdr);
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .matter-card:hover { border-color: #6366f1; box-shadow: 0 0 0 1px #6366f133; }
    .matter-card.selected { border-color: #6366f1; box-shadow: 0 0 0 2px #6366f155; }
    .card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .matter-icon { font-size: 16px; }
    .matter-icon.lg { font-size: 22px; }
    .priority-badge {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #fff;
      border-radius: 4px;
      padding: 2px 6px;
      letter-spacing: 0.04em;
    }
    .card-title { font-size: 13px; font-weight: 600; color: var(--t1); margin-bottom: 4px; line-height: 1.4; }
    .card-client, .card-counsel { font-size: 11px; color: var(--t2); margin-bottom: 2px; }
    .card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 8px;
    }
    .card-deadline { font-size: 11px; color: var(--t2); }
    .card-docs { font-size: 11px; color: var(--t3); }

    /* DETAIL PANEL */
    .detail-panel {
      width: 400px;
      flex-shrink: 0;
      background: var(--surf2);
      border-left: 1px solid #334155;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .panel-header {
      padding: 16px 18px 12px;
      border-bottom: 1px solid var(--bdr);
      position: relative;
    }
    .panel-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .panel-title-input {
      flex: 1;
      background: transparent;
      border: none;
      border-bottom: 1px solid var(--bdr);
      color: var(--t1);
      font-size: 16px;
      font-weight: 700;
      padding: 2px 4px;
      outline: none;
      transition: border-color 0.15s;
    }
    .panel-title-input:focus { border-bottom-color: #6366f1; }
    .panel-badges { display: flex; gap: 6px; flex-wrap: wrap; }
    .type-badge {
      font-size: 11px;
      background: var(--surf3);
      color: var(--t2);
      border-radius: 4px;
      padding: 2px 8px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .panel-close {
      position: absolute;
      top: 14px;
      right: 14px;
      background: transparent;
      border: none;
      color: var(--t3);
      font-size: 16px;
      cursor: pointer;
      padding: 4px 6px;
      border-radius: 4px;
      transition: color 0.1s;
    }
    .panel-close:hover { color: #ef4444; }
    .panel-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    /* FIELDS */
    .field-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }
    .field-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .field-group:last-child:nth-child(odd) { grid-column: span 2; }
    label {
      font-size: 11px;
      font-weight: 600;
      color: var(--t3);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .req { color: #ef4444; }
    .field-input {
      background: var(--surf);
      border: 1px solid var(--bdr);
      border-radius: 6px;
      color: var(--t1);
      padding: 7px 10px;
      font-size: 13px;
      outline: none;
      width: 100%;
      box-sizing: border-box;
      transition: border-color 0.15s;
      font-family: inherit;
    }
    .field-input:focus { border-color: #6366f1; }
    textarea.field-input { resize: vertical; }
    select.field-input { cursor: pointer; }

    /* STAGE MOVER */
    .stage-mover {
      margin-bottom: 16px;
    }
    .stage-mover label {
      display: block;
      margin-bottom: 6px;
      font-size: 11px;
      font-weight: 600;
      color: var(--t3);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .stage-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .stage-row select { flex: 1; }

    /* PANEL SECTIONS */
    .panel-section {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--bdr);
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 13px;
      font-weight: 600;
      color: var(--t2);
      margin-bottom: 10px;
    }

    /* DOC PICKER */
    .doc-picker {
      background: var(--surf);
      border: 1px solid var(--bdr);
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .picker-list {
      max-height: 140px;
      overflow-y: auto;
    }
    .picker-item {
      font-size: 12px;
      padding: 6px 8px;
      border-radius: 5px;
      cursor: pointer;
      color: #cbd5e1;
      transition: background 0.1s;
    }
    .picker-item:hover { background: var(--surf2); }
    .picker-empty { font-size: 12px; color: var(--t2); padding: 8px; text-align: center; }

    /* DOC LIST */
    .role-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--t3);
      letter-spacing: 0.05em;
      margin: 8px 0 4px;
    }
    .doc-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      color: #cbd5e1;
      padding: 5px 6px;
      border-radius: 5px;
      transition: background 0.1s;
    }
    .doc-item:hover { background: var(--surf); }
    .no-docs, .no-notes { font-size: 12px; color: var(--t2); text-align: center; padding: 12px; }

    /* NOTES */
    .note-input-row {
      display: flex;
      gap: 8px;
      align-items: flex-end;
      margin-bottom: 10px;
    }
    .note-textarea {
      flex: 1;
      background: var(--surf);
      border: 1px solid var(--bdr);
      border-radius: 6px;
      color: var(--t1);
      padding: 7px 10px;
      font-size: 13px;
      font-family: inherit;
      outline: none;
      resize: vertical;
      transition: border-color 0.15s;
    }
    .note-textarea:focus { border-color: #6366f1; }
    .note-list { display: flex; flex-direction: column; gap: 6px; }
    .note-item {
      background: var(--surf);
      border-radius: 6px;
      padding: 8px 10px;
      border-left: 2px solid #6366f1;
    }
    .note-text { font-size: 13px; color: #cbd5e1; line-height: 1.5; }
    .note-meta { font-size: 10px; color: var(--t2); margin-top: 3px; }

    /* MODAL */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.65);
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .modal-box {
      background: var(--surf2);
      border-radius: 12px;
      width: 480px;
      max-width: 95vw;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 24px 48px rgba(0,0,0,0.5);
      border: 1px solid var(--bdr);
    }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 20px 14px;
      border-bottom: 1px solid var(--bdr);
    }
    .modal-header h2 { font-size: 16px; font-weight: 700; margin: 0; color: var(--t1); }
    .modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .modal-footer {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      padding: 14px 20px;
      border-top: 1px solid var(--bdr);
    }

    /* LOADING */
    .loading-overlay {
      position: absolute;
      inset: 0;
      background: rgba(15,23,42,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 50;
    }
    .spinner {
      width: 36px;
      height: 36px;
      border: 3px solid var(--bdr);
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* SCROLLBARS */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--surf3); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #475569; }
  `]
})
export class MattersComponent implements OnInit {
  stages = STAGE_ORDER as unknown as Stage[];
  roleOptions = ROLE_OPTIONS;

  readonly stageOptions: SelectOption[] = STAGE_ORDER.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }));
  readonly roleSelectOptions: SelectOption[] = ROLE_OPTIONS.map(r => ({ value: r, label: r }));
  readonly matterTypeOptions: SelectOption[] = [
    { value: 'contract', label: 'Contract' },
    { value: 'litigation', label: 'Litigation' },
    { value: 'compliance', label: 'Compliance' },
    { value: 'ip', label: 'IP' },
    { value: 'employment', label: 'Employment' },
    { value: 'general', label: 'General' },
  ];
  readonly priorityOptions: SelectOption[] = [
    { value: 'low', label: 'Low' },
    { value: 'normal', label: 'Normal' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ];

  matters: any[] = [];
  selectedMatter: any = null;
  matterDetail: any = null;

  loading = false;
  showNewModal = false;
  showDocPicker = false;

  // Edit fields
  editTitle = '';
  editClient = '';
  editCounsel = '';
  editDeadline = '';
  editStage: Stage = 'intake';

  // New matter form
  newMatter: any = {
    title: '',
    matter_type: '',
    client_name: '',
    assigned_counsel: '',
    priority: 'normal',
    stage: 'intake',
    deadline: '',
    description: ''
  };

  // Doc picker
  allDocs: any[] = [];
  docPickerSearch = '';
  newDocRole = 'supporting';

  // Notes
  newNoteText = '';

  constructor(private http: HttpClient, public cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadMatters();
    this.loadAllDocs();
  }

  loadMatters() {
    this.loading = true;
    this.http.get<any[]>(`${API}/matters`).subscribe({
      next: (data) => {
        this.matters = data;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadAllDocs() {
    this.http.get<any>(`${API}/documents?limit=100`).subscribe({
      next: (data) => {
        this.allDocs = Array.isArray(data) ? data : (data?.documents || data?.items || []);
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  mattersForStage(stage: Stage): any[] {
    return this.matters.filter(m => m.stage === stage);
  }

  stageColor(stage: Stage): string {
    return STAGE_COLORS[stage] || '#94a3b8';
  }

  priorityColor(priority: string): string {
    return PRIORITY_COLORS[priority] || '#94a3b8';
  }

  matterIcon(type: string): string {
    return MATTER_ICONS[type] || '📁';
  }

  selectMatter(m: any) {
    this.selectedMatter = m;
    this.editTitle = m.title;
    this.editClient = m.client_name || '';
    this.editCounsel = m.assigned_counsel || '';
    this.editDeadline = m.deadline ? m.deadline.substring(0, 10) : '';
    this.editStage = m.stage;
    this.showDocPicker = false;
    this.newNoteText = '';
    this.matterDetail = null;
    this.cdr.markForCheck();
    this.loadMatterDetail(m.id);
  }

  loadMatterDetail(id: string | number) {
    this.http.get<any>(`${API}/matters/${id}`).subscribe({
      next: (data) => {
        this.matterDetail = data;
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  saveTitle() {
    if (!this.selectedMatter || this.editTitle === this.selectedMatter.title) return;
    this.patchField('title', this.editTitle);
  }

  patchField(field: string, value: any) {
    if (!this.selectedMatter) return;
    this.http.patch<any>(`${API}/matters/${this.selectedMatter.id}`, { [field]: value }).subscribe({
      next: (updated) => {
        Object.assign(this.selectedMatter, updated);
        const idx = this.matters.findIndex(m => m.id === this.selectedMatter.id);
        if (idx >= 0) Object.assign(this.matters[idx], updated);
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  saveStage() {
    if (!this.selectedMatter || this.editStage === this.selectedMatter.stage) return;
    this.patchField('stage', this.editStage);
  }

  openNewModal() {
    this.newMatter = {
      title: '',
      matter_type: '',
      client_name: '',
      assigned_counsel: '',
      priority: 'normal',
      stage: 'intake',
      deadline: '',
      description: ''
    };
    this.showNewModal = true;
    this.cdr.markForCheck();
  }

  closeModal(event: MouseEvent) {
    this.showNewModal = false;
    this.cdr.markForCheck();
  }

  createMatter() {
    if (!this.newMatter.title || !this.newMatter.matter_type) return;
    const body: any = {
      title: this.newMatter.title,
      matter_type: this.newMatter.matter_type,
      stage: 'intake',
      priority: this.newMatter.priority
    };
    if (this.newMatter.client_name) body.client_name = this.newMatter.client_name;
    if (this.newMatter.assigned_counsel) body.assigned_counsel = this.newMatter.assigned_counsel;
    if (this.newMatter.deadline) body.deadline = this.newMatter.deadline;
    if (this.newMatter.description) body.description = this.newMatter.description;

    this.loading = true;
    this.http.post<any>(`${API}/matters`, body).subscribe({
      next: (created) => {
        this.matters = [created, ...this.matters];
        this.showNewModal = false;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  toggleDocPicker() {
    this.showDocPicker = !this.showDocPicker;
    this.docPickerSearch = '';
    this.cdr.markForCheck();
  }

  filteredPickerDocs(): any[] {
    const q = this.docPickerSearch.toLowerCase();
    const attached = new Set((this.matterDetail?.documents || []).map((d: any) => d.doc_id));
    return this.allDocs.filter(d => {
      const name = (d.title || d.filename || d.id || '').toLowerCase();
      return name.includes(q) && !attached.has(d.id);
    });
  }

  docsForRole(role: string): any[] {
    return (this.matterDetail?.documents || []).filter((d: any) => d.role === role);
  }

  attachDoc(doc: any) {
    if (!this.selectedMatter) return;
    const body = { doc_id: doc.id, role: this.newDocRole };
    this.http.post<any>(`${API}/matters/${this.selectedMatter.id}/documents`, body).subscribe({
      next: () => {
        this.showDocPicker = false;
        this.loadMatterDetail(this.selectedMatter.id);
      },
      error: () => {}
    });
  }

  removeDoc(docId: string | number) {
    if (!this.selectedMatter) return;
    this.http.delete(`${API}/matters/${this.selectedMatter.id}/documents/${docId}`).subscribe({
      next: () => this.loadMatterDetail(this.selectedMatter.id),
      error: () => {}
    });
  }

  addNote() {
    if (!this.newNoteText.trim() || !this.selectedMatter) return;
    // Notes are typically posted to a notes sub-resource; use PATCH with notes array or dedicated endpoint
    // Attempting a notes endpoint; fallback to patch
    this.http.post<any>(`${API}/matters/${this.selectedMatter.id}/notes`, { content: this.newNoteText.trim() }).subscribe({
      next: () => {
        this.newNoteText = '';
        this.loadMatterDetail(this.selectedMatter.id);
      },
      error: () => {
        // fallback: store locally
        if (!this.matterDetail) this.matterDetail = { ...this.selectedMatter, documents: [], notes: [] };
        if (!this.matterDetail.notes) this.matterDetail.notes = [];
        this.matterDetail.notes.unshift({ content: this.newNoteText.trim(), created_at: new Date().toISOString() });
        this.newNoteText = '';
        this.cdr.markForCheck();
      }
    });
  }
}
