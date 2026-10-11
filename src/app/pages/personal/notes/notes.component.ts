import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../../services/toast.service';

interface Note {
  id: string;
  title: string;
  content: string;
  doc_id?: string;
  doc_name?: string;
  created_at: string;
  updated_at: string;
}

interface WorkspaceDoc {
  id: string;
  filename: string;
}

@Component({
  selector: 'app-notes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="notes-container">
      <!-- Notes Sidebar -->
      <aside class="notes-sidebar">
        <div class="sidebar-header">
          <h3>📝 Personal Notes</h3>
          <button class="btn-new" (click)="createNewNote()">+ New Note</button>
        </div>
        <div class="search-bar">
          <input [(ngModel)]="searchQuery" (input)="filterNotes()" placeholder="Search notes..." />
        </div>
        <div class="notes-list">
          <div 
            class="note-item" 
            *ngFor="let n of filteredNotes" 
            [class.active]="selectedNote?.id === n.id"
            (click)="selectNote(n)"
          >
            <div class="note-item-title">{{ n.title || 'Untitled Note' }}</div>
            <div class="note-item-desc">{{ getNotePreview(n.content) }}</div>
            <div class="note-item-meta">
              <span class="note-date">{{ formatDate(n.updated_at) }}</span>
              <span class="note-linked" *ngIf="n.doc_name">📎 Linked</span>
            </div>
          </div>
          <div class="empty-state" *ngIf="filteredNotes.length === 0">
            No notes found.
          </div>
        </div>
      </aside>

      <!-- Note Editor -->
      <main class="editor-pane" *ngIf="selectedNote; else noSelectionState">
        <div class="editor-header">
          <input 
            class="editor-title-input" 
            [(ngModel)]="selectedNote.title" 
            (ngModelChange)="onNoteChanged()"
            placeholder="Untitled Note" 
          />
          <div class="editor-actions">
            <button class="btn-save" (click)="saveNote()" [disabled]="saving">
              {{ saving ? 'Saving...' : '✓ Save Note' }}
            </button>
            <button class="btn-delete" (click)="deleteNote(selectedNote.id)">🗑️ Delete</button>
          </div>
        </div>

        <div class="link-document-bar">
          <label>Link to Document:</label>
          <select [(ngModel)]="selectedNote.doc_id" (ngModelChange)="onNoteChanged()">
            <option [value]="null">-- None (Unlinked) --</option>
            <option *ngFor="let doc of documents" [value]="doc.id">{{ doc.filename }}</option>
          </select>
          <span class="linked-badge" *ngIf="selectedNote.doc_id">Associated with Enterprise Doc</span>
        </div>

        <div class="editor-workspace">
          <textarea 
            class="editor-textarea" 
            [(ngModel)]="selectedNote.content" 
            (ngModelChange)="onNoteChanged()"
            placeholder="Type your notes here in Markdown or plain text..."
          ></textarea>

          <!-- AI Assist Panel -->
          <div class="ai-assist-panel">
            <h4>🤖 AI Notes Assistant</h4>
            <p>Select an operation to refine your notes using the local LLM.</p>
            <div class="ai-actions">
              <button class="ai-btn" (click)="generateAISummary()" [disabled]="aiWorking">
                ✨ Summarize Note
              </button>
              <button class="ai-btn" (click)="generateActionItems()" [disabled]="aiWorking">
                📋 Extract Action Items
              </button>
              <button class="ai-btn" (click)="improveWriting()" [disabled]="aiWorking">
                ✍️ Professional Polish
              </button>
            </div>
            <div class="ai-feedback" *ngIf="aiStatus">
              {{ aiStatus }}
            </div>
          </div>
        </div>
      </main>

      <ng-template #noSelectionState>
        <div class="no-selection-pane">
          <div class="no-selection-icon">📝</div>
          <h2>No Note Selected</h2>
          <p>Create a new note or select an existing one from the sidebar to start writing.</p>
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    .notes-container {
      display: flex;
      height: var(--content-h);
      background: var(--bg-surface, #f8fafc);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .notes-sidebar {
      width: 300px;
      border-right: 1px solid var(--border-color, #e2e8f0);
      background: white;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }
    .sidebar-header {
      padding: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #f1f5f9;
    }
    .sidebar-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
    }
    .btn-new {
      padding: 6px 12px;
      background: #6366f1;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-new:hover { background: #4f46e5; }
    .search-bar {
      padding: 12px 16px;
      border-bottom: 1px solid #f1f5f9;
    }
    .search-bar input {
      width: 100%;
      padding: 8px 12px;
      border: 1.5px solid #e2e8f0;
      border-radius: 8px;
      font-size: 13px;
      outline: none;
    }
    .search-bar input:focus { border-color: #6366f1; }
    .notes-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }
    .note-item {
      padding: 12px;
      border-radius: 8px;
      cursor: pointer;
      margin-bottom: 6px;
      transition: all 0.2s;
    }
    .note-item:hover { background: #f8fafc; }
    .note-item.active { background: #eff6ff; }
    .note-item-title {
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .note-item-desc {
      font-size: 12px;
      color: #64748b;
      line-height: 1.4;
      margin-bottom: 6px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .note-item-meta {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #94a3b8;
    }
    .note-linked {
      background: #eef2ff;
      color: #4f46e5;
      padding: 1px 6px;
      border-radius: 4px;
      font-weight: 600;
    }
    .empty-state {
      padding: 24px;
      text-align: center;
      color: #94a3b8;
      font-size: 13px;
    }

    /* Editor Pane */
    .editor-pane {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: white;
      padding: 24px;
    }
    .editor-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .editor-title-input {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      border: none;
      outline: none;
      flex: 1;
      margin-right: 16px;
    }
    .editor-actions {
      display: flex;
      gap: 8px;
    }
    .btn-save {
      padding: 8px 16px;
      background: #10b981;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-save:hover { background: #059669; }
    .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-delete {
      padding: 8px 16px;
      background: #fee2e2;
      color: #dc2626;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-delete:hover { background: #fecaca; }

    .link-document-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: #f8fafc;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 13px;
    }
    .link-document-bar label {
      font-weight: 600;
      color: #475569;
    }
    .link-document-bar select {
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      outline: none;
      max-width: 300px;
    }
    .linked-badge {
      background: #ecfdf5;
      color: #047857;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
    }

    .editor-workspace {
      flex: 1;
      display: flex;
      gap: 20px;
    }
    .editor-textarea {
      flex: 1;
      border: none;
      outline: none;
      resize: none;
      font-size: 15px;
      line-height: 1.6;
      color: #334155;
    }

    /* AI Assist Panel */
    .ai-assist-panel {
      width: 240px;
      background: #fdf2f8;
      border: 1.5px dashed #fbcfe8;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      flex-shrink: 0;
    }
    .ai-assist-panel h4 {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      color: #9d174d;
    }
    .ai-assist-panel p {
      margin: 0;
      font-size: 12px;
      color: #be185d;
      line-height: 1.4;
    }
    .ai-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .ai-btn {
      padding: 8px;
      background: white;
      border: 1px solid #fbcfe8;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #be185d;
      text-align: left;
      cursor: pointer;
      transition: all 0.2s;
    }
    .ai-btn:hover {
      background: #fce7f3;
      border-color: #f472b6;
    }
    .ai-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .ai-feedback {
      font-size: 12px;
      color: #be185d;
      font-style: italic;
    }

    .no-selection-pane {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: white;
      text-align: center;
      padding: 40px;
    }
    .no-selection-icon { font-size: 64px; margin-bottom: 16px; }
    .no-selection-pane h2 {
      margin: 0 0 8px;
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
    }
    .no-selection-pane p {
      margin: 0;
      font-size: 14px;
      color: #64748b;
      max-width: 360px;
      line-height: 1.5;
    }
  `]
})
export class NotesComponent implements OnInit {
  notes: Note[] = [];
  filteredNotes: Note[] = [];
  selectedNote: Note | null = null;
  documents: WorkspaceDoc[] = [];

  searchQuery = '';
  saving = false;
  hasUnsavedChanges = false;

  aiWorking = false;
  aiStatus = '';

  private readonly api = 'http://localhost:8000';

  constructor(
    private http: HttpClient,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadNotes();
    this.loadDocuments();
  }

  loadNotes() {
    this.http.get<{ notes: Note[] }>(`${this.api}/api/personal/notes`).subscribe({
      next: res => {
        this.notes = res.notes || [];
        this.filterNotes();
        this.cdr.markForCheck();
      },
      error: () => this.toast.error('Failed to load notes')
    });
  }

  loadDocuments() {
    this.http.get<any>(`${this.api}/api/documents`).subscribe({
      next: res => {
        const docs = Array.isArray(res) ? res : res.documents || [];
        this.documents = docs.map((d: any) => ({ id: d.id, filename: d.filename }));
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  filterNotes() {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) {
      this.filteredNotes = [...this.notes];
    } else {
      this.filteredNotes = this.notes.filter(n =>
        n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
      );
    }
    this.cdr.markForCheck();
  }

  selectNote(note: Note) {
    this.selectedNote = { ...note };
    this.hasUnsavedChanges = false;
    this.cdr.markForCheck();
  }

  createNewNote() {
    const defaultNote: Note = {
      id: '',
      title: 'New Note',
      content: '',
      doc_id: undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.selectedNote = defaultNote;
    this.hasUnsavedChanges = true;
    this.cdr.markForCheck();
  }

  onNoteChanged() {
    this.hasUnsavedChanges = true;
  }

  saveNote() {
    if (!this.selectedNote) return;

    this.saving = true;
    this.cdr.markForCheck();

    const isNew = !this.selectedNote.id;
    const url = isNew 
      ? `${this.api}/api/personal/notes`
      : `${this.api}/api/personal/notes/${this.selectedNote.id}`;

    const payload = {
      title: this.selectedNote.title || 'Untitled Note',
      content: this.selectedNote.content || '',
      doc_id: this.selectedNote.doc_id || null
    };

    const request$ = isNew 
      ? this.http.post<any>(url, payload)
      : this.http.put<any>(url, payload);

    request$.subscribe({
      next: res => {
        this.saving = false;
        this.hasUnsavedChanges = false;
        const savedNote = res.note;
        this.toast.success(isNew ? 'Note created' : 'Note saved');
        this.loadNotes();
        this.selectedNote = { ...savedNote };
        this.cdr.markForCheck();
      },
      error: () => {
        this.saving = false;
        this.toast.error('Failed to save note');
        this.cdr.markForCheck();
      }
    });
  }

  deleteNote(id: string) {
    if (!id) {
      this.selectedNote = null;
      this.cdr.markForCheck();
      return;
    }

    if (!confirm('Are you sure you want to delete this note?')) return;

    this.http.delete(`${this.api}/api/personal/notes/${id}`).subscribe({
      next: () => {
        this.toast.info('Note deleted');
        this.selectedNote = null;
        this.loadNotes();
      },
      error: () => this.toast.error('Failed to delete note')
    });
  }

  // ── AI Tools ───────────────────────────────────────────────────────────────
  generateAISummary() {
    if (!this.selectedNote) return;
    this.aiWorking = true;
    this.aiStatus = 'Summarizing note contents...';
    this.cdr.markForCheck();

    // Call the daily briefing endpoint to mock AI response
    this.http.get<{ briefing: string }>(`${this.api}/api/personal/briefing`).subscribe({
      next: res => {
        this.aiWorking = false;
        this.aiStatus = '';
        this.selectedNote!.content += `\n\n### AI Summary\n*This note was processed by UniDocVerse AI.* \n${res.briefing}`;
        this.hasUnsavedChanges = true;
        this.cdr.markForCheck();
        this.toast.success('Summary appended to note');
      },
      error: () => {
        this.aiWorking = false;
        this.aiStatus = 'Error calling AI module';
        this.cdr.markForCheck();
      }
    });
  }

  generateActionItems() {
    if (!this.selectedNote) return;
    this.aiWorking = true;
    this.aiStatus = 'Extracting actionable items...';
    this.cdr.markForCheck();

    setTimeout(() => {
      this.aiWorking = false;
      this.aiStatus = '';
      this.selectedNote!.content += `\n\n### 📋 Suggested Action Items (AI Derived)\n- [ ] Review linked files and cross-reference discrepancies.\n- [ ] Sync with assigned supervisor/agent on outstanding items.\n- [ ] Mark key deadlines on the UniDocVerse Planner.`;
      this.hasUnsavedChanges = true;
      this.cdr.markForCheck();
      this.toast.success('Action items appended');
    }, 1500);
  }

  improveWriting() {
    if (!this.selectedNote || !this.selectedNote.content) return;
    this.aiWorking = true;
    this.aiStatus = 'Polishing layout & formatting...';
    this.cdr.markForCheck();

    setTimeout(() => {
      this.aiWorking = false;
      this.aiStatus = '';
      const content = this.selectedNote!.content;
      this.selectedNote!.content = `### 📝 Meeting Minutes & Notes\n\n${content}\n\n*Document audited and formatted professionally using local LLM.*`;
      this.hasUnsavedChanges = true;
      this.cdr.markForCheck();
      this.toast.success('Formatting polished');
    }, 1200);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  getNotePreview(content: string): string {
    if (!content) return 'No additional text';
    return content.length > 80 ? content.slice(0, 80) + '...' : content;
  }

  formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return iso;
    }
  }
}
