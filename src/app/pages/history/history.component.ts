import { Component, OnInit, OnDestroy, ElementRef, ViewChild, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

interface DocEntry {
  document_id: string;
  filename: string;
  doc_type: string;
  turn_count: number;
  last_at: string;
  last_question: string;
}

interface QATurn {
  id: string;
  document_id: string;
  question: string;
  answer: string;
  sources: any[];
  doc_type: string;
  lang: string;
  confidence: number | null;
  created_at: string;
  filename?: string;
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="hist-root">

  <!-- ── Header ── -->
  <div class="hist-header">
    <div class="hist-title-row">
      <div>
        <div class="hist-title">💬 Document Conversation History</div>
        <div class="hist-sub">Past Q&amp;A sessions — select a document to review its full conversation</div>
      </div>
      <div class="hist-meta" *ngIf="docs.length > 0">{{ docs.length }} document{{ docs.length !== 1 ? 's' : '' }}</div>
    </div>
    <div class="hist-search-wrap">
      <input #searchEl class="hist-search" [(ngModel)]="searchQ"
             (input)="onSearch(searchEl.value)" placeholder="Search across all conversations…">
      <button *ngIf="searchQ" class="hist-search-clear" (click)="clearSearch()">✕</button>
    </div>
  </div>

  <!-- ── Body: list + detail ── -->
  <div class="hist-body">

    <!-- Left: document list -->
    <div class="hist-list">

      <!-- Loading -->
      <div *ngIf="docsLoading && docs.length === 0" class="hist-loading">
        <span class="dots"><span></span><span></span><span></span></span>
        <span>Loading…</span>
      </div>

      <!-- Empty -->
      <div *ngIf="!docsLoading && docs.length === 0 && !searchQ" class="hist-empty">
        <div class="hist-empty-ico">💬</div>
        <div class="hist-empty-msg">No conversations yet</div>
        <div class="hist-empty-sub">Ask a question on any document and it will appear here.</div>
      </div>

      <!-- Search results mode -->
      <ng-container *ngIf="searchQ && !searchLoading">
        <div *ngIf="groupedResults.length === 0" class="hist-empty">
          <div class="hist-empty-ico">🔍</div>
          <div class="hist-empty-msg">No results for "{{ searchQ }}"</div>
        </div>
        <div *ngFor="let g of groupedResults" class="hist-item"
             [class.active]="selectedDoc?.document_id === g.document_id"
             (click)="toggleGroup(g.document_id); openGroupDoc(g)">
          <div class="hist-item-header">
            <div class="hist-item-q">{{ docIcon(g.doc_type) }} {{ shortName(g.filename) }}</div>
            <span class="hist-iter">{{ g.turns.length }} match{{ g.turns.length !== 1 ? 'es' : '' }}</span>
          </div>
          <!-- Expanded occurrences -->
          <div *ngIf="expandedGroups.has(g.document_id)" class="hist-occurrences">
            <div *ngFor="let r of g.turns" class="hist-occ"
                 [class.active]="selectedTurnId === r.id"
                 (click)="openSearchResult(r); $event.stopPropagation()">
              <div class="hist-occ-q" [innerHTML]="highlightSidebar(r.question)"></div>
              <div class="hist-occ-ts">{{ friendly(r.created_at) }}</div>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- Normal doc list -->
      <ng-container *ngIf="!searchQ">
        <div *ngFor="let d of docs" class="hist-item"
             [class.active]="selectedDoc?.document_id === d.document_id"
             (click)="selectDoc(d)">
          <div class="hist-item-header">
            <div class="hist-item-q">{{ shortName(d.filename) }}</div>
          </div>
          <div class="hist-item-meta">
            <span class="hist-iter">{{ d.turn_count }} turn{{ d.turn_count !== 1 ? 's' : '' }}</span>
            <span class="hist-ts">{{ friendly(d.last_at) }}</span>
          </div>
          <div class="hist-preview" *ngIf="d.last_question">{{ d.last_question | slice:0:60 }}{{ d.last_question.length > 60 ? '…' : '' }}</div>
          <div class="hist-doc-type">
            <span class="hist-src-chip">{{ docIcon(d.doc_type) }} {{ d.doc_type || 'document' }}</span>
          </div>
        </div>
      </ng-container>

    </div>

    <!-- Right: conversation thread or empty state -->
    <div class="hist-detail" *ngIf="selectedDoc">

      <!-- Detail header -->
      <div class="hist-detail-hdr">
        <div class="hist-detail-doc">
          <span class="hist-doc-ico">{{ docIcon(selectedDoc.doc_type) }}</span>
          <div>
            <div class="hist-doc-name">{{ selectedDoc.filename }}</div>
            <div class="hist-doc-meta">{{ turnsTotal || selectedDoc.turn_count }} conversation{{ (turnsTotal || selectedDoc.turn_count) !== 1 ? 's' : '' }}</div>
          </div>
        </div>
        <button class="hist-clear-btn" (click)="promptClearAll()">🗑 Clear all</button>
      </div>

      <!-- Thread -->
      <div class="hist-thread" #threadWrap>

        <!-- Load more older -->
        <div *ngIf="turnsHasMore && !histLoading" class="hist-load-more-row">
          <button class="hist-load-more-btn" (click)="loadMoreTurns()">↑ Load older messages</button>
        </div>
        <div *ngIf="histLoading && turns.length > 0" class="hist-loading-more">
          <div class="spinner-sm"></div> Loading…
        </div>

        <!-- Spinner (initial) -->
        <div *ngIf="histLoading && turns.length === 0" class="hist-thread-loading">
          <div class="spinner"></div> Loading conversation…
        </div>

        <!-- Match navigator -->
        <div *ngIf="searchQ && hlMatchCount > 0" class="match-nav">
          <span class="match-nav-info">{{ hlCurrent || 1 }} of {{ hlMatchCount }} matches for "<strong>{{ searchQ }}</strong>"</span>
          <div class="match-nav-btns">
            <button *ngFor="let n of matchNumbers()" class="match-num-btn" [class.active]="hlCurrent === n" (click)="goToMatch(n)">{{ n }}</button>
            <button class="match-arrow" (click)="prevMatch()" title="Previous">↑</button>
            <button class="match-arrow" (click)="nextMatch()" title="Next">↓</button>
          </div>
        </div>

        <!-- Turns -->
        <ng-container *ngIf="!histLoading || turns.length > 0">
          <div *ngFor="let turn of turns; let first = first"
               class="qa-card" [id]="'turn-' + turn.id" [class.hl-card]="selectedTurnId === turn.id">

            <!-- Question row -->
            <div class="qa-question-row">
              <div class="qa-q-bubble" [innerHTML]="highlight(turn.question, first)"></div>
              <div class="qa-q-actions">
                <span class="qa-ts">{{ friendly(turn.created_at) }}</span>
                <button class="qa-del-btn" title="Delete this exchange" (click)="deleteTurn(turn)">🗑</button>
              </div>
            </div>

            <!-- Answer card -->
            <div class="qa-answer-card">
              <div class="qa-answer-label">✅ Answer</div>
              <div class="qa-answer-body" [innerHTML]="highlight(formatAnswer(turn.answer))"></div>
              <div *ngIf="turn.confidence != null" class="qa-conf-row">
                <span class="qa-conf-badge"
                      [style.background]="turn.confidence >= 0.8 ? '#dcfce7' : turn.confidence >= 0.6 ? '#fef9c3' : '#fee2e2'"
                      [style.color]="turn.confidence >= 0.8 ? '#166534' : turn.confidence >= 0.6 ? '#713f12' : '#991b1b'">
                  {{ (turn.confidence * 100).toFixed(0) }}% confident
                </span>
              </div>
            </div>

          </div>

          <div *ngIf="turns.length === 0 && !histLoading" class="hist-thread-empty">
            No Q&amp;A history for this document yet.
          </div>
        </ng-container>
      </div>
    </div>

    <!-- Pick-a-document placeholder -->
    <div class="hist-detail hist-detail-empty" *ngIf="!selectedDoc">
      <div class="hist-pick-ico">👈</div>
      <div class="hist-pick-msg">Select a document to view its conversation</div>
    </div>

  </div>
</div>

<!-- Delete turn confirm dialog -->
<div class="del-overlay" *ngIf="pendingDeleteTurn" (click)="confirmDeleteTurn(false)">
  <div class="del-dialog" (click)="$event.stopPropagation()">
    <div class="del-icon">🗑️</div>
    <div class="del-title">Delete this exchange?</div>
    <div class="del-msg">
      "<span class="del-q">{{ (pendingDeleteTurn!.question || '') | slice:0:60 }}{{ (pendingDeleteTurn!.question.length || 0) > 60 ? '…' : '' }}</span>"
      <br>This cannot be undone.
    </div>
    <div class="del-actions">
      <button class="del-cancel-btn" (click)="confirmDeleteTurn(false)">Cancel</button>
      <button class="del-confirm-btn" (click)="confirmDeleteTurn(true)">Delete</button>
    </div>
  </div>
</div>

<!-- Clear all confirm dialog -->
<div class="del-overlay" *ngIf="pendingClearAll" (click)="confirmClearAll(false)">
  <div class="del-dialog" (click)="$event.stopPropagation()">
    <div class="del-icon">🗑️</div>
    <div class="del-title">Clear all history?</div>
    <div class="del-msg">
      All conversation history for <strong>{{ pendingClearAll!.filename }}</strong> will be deleted.<br>This cannot be undone.
    </div>
    <div class="del-actions">
      <button class="del-cancel-btn" (click)="confirmClearAll(false)">Cancel</button>
      <button class="del-confirm-btn" (click)="confirmClearAll(true)">Clear all</button>
    </div>
  </div>
</div>
  `,
  styles: [`
:host { display: block; height: 100%; }

// ── Root: column flex (header + body) ────────────────────────────────────────
.hist-root {
  display: flex; flex-direction: column; height: 100%; overflow: hidden;
  background: var(--bg); color: var(--t1);
}

// ── Header ───────────────────────────────────────────────────────────────────
.hist-header {
  flex-shrink: 0; padding: 20px 24px 12px; border-bottom: 1px solid var(--bdr);
}
.hist-title-row {
  display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px;
}
.hist-title { font-size: 18px; font-weight: 700; color: var(--t1); }
.hist-sub   { font-size: 12px; color: var(--t3); margin-top: 2px; }
.hist-meta  {
  font-size: 11px; color: var(--t3); background: var(--surf);
  border: 1px solid var(--bdr); border-radius: 12px; padding: 3px 10px; flex-shrink: 0;
}
.hist-search-wrap { position: relative; }
.hist-search {
  width: 100%; box-sizing: border-box; padding: 8px 32px 8px 12px;
  border: 1px solid var(--bdr); border-radius: 8px; font-size: 13px;
  background: var(--surf); color: var(--t1); outline: none;
  &:focus { border-color: #6366f1; }
}
.hist-search-clear {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer; color: var(--t3); font-size: 13px;
  &:hover { color: var(--t1); }
}

// ── Body: list + detail ───────────────────────────────────────────────────────
.hist-body { display: flex; flex: 1; overflow: hidden; }

// ── Document list (left) ──────────────────────────────────────────────────────
.hist-list {
  width: 340px; flex-shrink: 0; border-right: 1px solid var(--bdr);
  overflow-y: auto; padding: 8px 6px;
}

// Loading / empty states
.hist-loading {
  display: flex; align-items: center; gap: 10px; justify-content: center;
  padding: 60px; color: var(--t3); font-size: 13px;
}
.dots span {
  display: inline-block; width: 6px; height: 6px; border-radius: 50%;
  background: #6366f1; margin: 0 2px;
  animation: dot-pulse 1.2s ease-in-out infinite;
  &:nth-child(2) { animation-delay: .2s; }
  &:nth-child(3) { animation-delay: .4s; }
}
@keyframes dot-pulse { 0%,80%,100% { transform: scale(.6); opacity: .4; } 40% { transform: scale(1); opacity: 1; } }

.hist-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 48px 24px; text-align: center; color: var(--t3);
}
.hist-empty-ico { font-size: 36px; margin-bottom: 10px; opacity: .4; }
.hist-empty-msg { font-size: 14px; font-weight: 600; color: var(--t2); margin-bottom: 4px; }
.hist-empty-sub { font-size: 12px; }

// Document item cards
.hist-item {
  padding: 10px 12px; border-radius: 8px; cursor: pointer; margin-bottom: 4px;
  border: 1px solid transparent; transition: background .1s;
  &:hover { background: rgba(99,102,241,.05); }
  &.active { background: rgba(99,102,241,.1); border-color: rgba(99,102,241,.2); }
}
.hist-item-header {
  display: flex; align-items: flex-start; gap: 6px; margin-bottom: 4px;
}
.hist-item-q { font-size: 12px; font-weight: 600; color: var(--t1); line-height: 1.4; flex: 1; }
.hist-item-meta {
  display: flex; align-items: center; gap: 8px; font-size: 10px; color: var(--t3); margin-bottom: 4px;
}
.hist-iter { background: var(--surf); border: 1px solid var(--bdr); border-radius: 10px; padding: 1px 6px; }
.hist-ts   { flex: 1; text-align: right; }
.hist-preview { font-size: 11px; color: var(--t3); margin-bottom: 4px; line-height: 1.4; }
.hist-doc-type { display: flex; flex-wrap: wrap; gap: 4px; }
.hist-src-chip {
  font-size: 9px; background: #eff6ff; color: #2563eb; border-radius: 10px;
  padding: 1px 6px; white-space: nowrap;
}

// Search occurrence sub-items
.hist-occurrences { margin-top: 4px; border-top: 1px solid var(--bdr); }
.hist-occ {
  padding: 6px 10px 6px 20px; cursor: pointer; border-radius: 6px;
  transition: background .1s;
  &:hover { background: rgba(99,102,241,.05); }
  &.active { background: rgba(99,102,241,.1); }
}
.hist-occ-q { font-size: 11px; color: var(--t2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hist-occ-ts { font-size: 10px; color: var(--t3); margin-top: 2px; }
.hl { background: #fde68a; color: #92400e; border-radius: 2px; padding: 0 2px; font-weight: 600; }
.hl.hl-active { background: #f97316; color: #fff; box-shadow: 0 0 0 2px #f97316; }

// ── Detail pane (right) ───────────────────────────────────────────────────────
.hist-detail {
  flex: 1; display: flex; flex-direction: column; overflow: hidden;
}
.hist-detail-empty {
  align-items: center; justify-content: center; gap: 8px; color: var(--t3);
}
.hist-pick-ico { font-size: 32px; opacity: .3; }
.hist-pick-msg { font-size: 13px; }

// Detail header (doc name + clear all)
.hist-detail-hdr {
  flex-shrink: 0; display: flex; align-items: center; gap: 12px;
  padding: 14px 20px; border-bottom: 1px solid var(--bdr);
  background: var(--surf);
}
.hist-detail-doc { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.hist-doc-ico { font-size: 20px; flex-shrink: 0; }
.hist-doc-name {
  font-size: 13px; font-weight: 700; color: var(--t1);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.hist-doc-meta { font-size: 11px; color: var(--t3); margin-top: 1px; }
.hist-clear-btn {
  flex-shrink: 0; font-size: 12px; font-weight: 600; color: #ef4444;
  background: rgba(239,68,68,.08); border: 1px solid rgba(239,68,68,.2);
  border-radius: 8px; padding: 5px 10px; cursor: pointer; transition: background .12s;
  &:hover { background: rgba(239,68,68,.15); }
}

// Thread scroll area
.hist-thread {
  flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 20px;
}

// Load older
.hist-load-more-row { display: flex; justify-content: center; }
.hist-load-more-btn {
  background: none; border: 1px solid var(--bdr); border-radius: 20px;
  padding: 6px 18px; font-size: 12px; color: var(--t3); cursor: pointer;
  transition: background .12s;
  &:hover { background: rgba(99,102,241,.06); color: var(--t2); border-color: rgba(99,102,241,.3); }
}
.hist-loading-more {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  font-size: 12px; color: var(--t3);
}
.hist-thread-loading {
  display: flex; align-items: center; gap: 10px; justify-content: center;
  padding: 40px; color: var(--t3); font-size: 13px;
}
.hist-thread-empty { text-align: center; color: var(--t3); padding: 40px; font-size: 13px; }

.spinner {
  width: 18px; height: 18px; border: 2px solid var(--bdr); border-top-color: #6366f1;
  border-radius: 50%; animation: spin .7s linear infinite;
}
.spinner-sm {
  width: 14px; height: 14px; border: 2px solid var(--bdr); border-top-color: #6366f1;
  border-radius: 50%; animation: spin .7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

// Q&A card
.qa-card {
  border-radius: 12px; overflow: hidden; border: 1px solid var(--bdr);
  background: var(--surf); transition: border-color .15s;
  &.hl-card { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.1); }
}

.qa-question-row {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;
  background: #eef2ff; border-bottom: 1px solid #c7d2fe; padding: 12px 16px;
}
.qa-q-bubble {
  flex: 1; font-size: 13px; font-weight: 600; color: #312e81; line-height: 1.5;
}
.qa-q-actions {
  display: flex; align-items: center; gap: 6px; flex-shrink: 0;
}
.qa-ts { font-size: 10px; color: #6366f1; opacity: .7; white-space: nowrap; }
.qa-del-btn {
  opacity: 0; background: none; border: none; cursor: pointer;
  font-size: 13px; padding: 2px 5px; border-radius: 5px;
  transition: opacity .15s, background .15s;
  .qa-card:hover & { opacity: 1; }
  &:hover { background: rgba(239,68,68,.12); }
}

.qa-answer-label {
  font-size: 11px; font-weight: 700; color: var(--t3); text-transform: uppercase;
  letter-spacing: .5px; padding: 8px 16px; border-bottom: 1px solid var(--bdr);
  background: rgba(99,102,241,.03);
}
.qa-answer-body {
  padding: 14px 16px; font-size: 13px; line-height: 1.7; color: var(--t1);
  white-space: pre-wrap; word-break: break-word;
}
.qa-conf-row { padding: 8px 16px; border-top: 1px solid var(--bdr); }
.qa-conf-badge {
  display: inline-block; font-size: 10.5px; font-weight: 700;
  border-radius: 20px; padding: 2px 10px;
}

// Match navigator
.match-nav {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;
  padding: 8px 12px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px;
}
.match-nav-info { font-size: 12px; color: #92400e; font-weight: 500; }
.match-nav-btns { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.match-num-btn {
  min-width: 28px; height: 26px; padding: 0 6px;
  border: 1px solid #fde68a; border-radius: 6px;
  background: #fff; color: #92400e; font-size: 12px; font-weight: 700;
  cursor: pointer; transition: all .14s;
  &:hover { background: #fde68a; }
  &.active { background: #f97316; color: #fff; border-color: #f97316; }
}
.match-arrow {
  width: 26px; height: 26px; border: 1px solid var(--bdr); border-radius: 6px;
  background: var(--surf); color: var(--t2); font-size: 13px; cursor: pointer;
  transition: all .14s;
  &:hover { background: var(--bg); }
}

// ── Delete / clear-all dialogs ────────────────────────────────────────────────
.del-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(15,23,42,.45); backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center;
  animation: dh-fade .15s ease;
}
@keyframes dh-fade { from { opacity: 0; } to { opacity: 1; } }

.del-dialog {
  background: var(--surf); border: 1px solid var(--bdr); border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,.18);
  padding: 28px 24px 20px; max-width: 360px; width: 90%; text-align: center;
  animation: dh-slide .2s ease;
}
@keyframes dh-slide { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

.del-icon  { font-size: 32px; margin-bottom: 10px; }
.del-title { font-size: 16px; font-weight: 700; color: var(--t1); margin-bottom: 8px; }
.del-msg   { font-size: 12px; color: var(--t3); line-height: 1.6; margin-bottom: 20px; }
.del-q     { color: var(--t2); font-style: italic; }

.del-actions { display: flex; gap: 10px; justify-content: center; }
.del-cancel-btn {
  flex: 1; padding: 9px 0; border-radius: 10px; font-size: 13px; font-weight: 600;
  cursor: pointer; border: 1px solid var(--bdr); background: var(--bg); color: var(--t1);
  &:hover { background: var(--surf); }
}
.del-confirm-btn {
  flex: 1; padding: 9px 0; border-radius: 10px; font-size: 13px; font-weight: 600;
  cursor: pointer; border: none; background: #ef4444; color: #fff;
  &:hover { background: #dc2626; }
}
  `]
})
export class HistoryComponent implements OnInit, OnDestroy {
  docs: DocEntry[] = [];
  docsLoading = true;
  selectedDoc: DocEntry | null = null;
  turns: QATurn[] = [];
  histLoading = false;
  turnsTotal = 0;
  turnsOffset = 0;
  turnsHasMore = false;
  pendingDeleteTurn: QATurn | null = null;
  pendingClearAll: DocEntry | null = null;
  searchQ = '';
  searchResults: QATurn[] = [];
  groupedResults: { document_id: string; filename: string; doc_type: string; turns: QATurn[] }[] = [];
  expandedGroups = new Set<string>();
  searchLoading = false;
  selectedTurnId: string | null = null;

  @ViewChild('threadWrap') threadWrap!: ElementRef<HTMLElement>;

  private search$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef, private zone: NgZone) {}

  private pollTimer: any;

  ngOnInit() {
    this.loadDocs();
    this.search$.pipe(
      debounceTime(350), distinctUntilChanged(), takeUntil(this.destroy$)
    ).subscribe(q => this.doSearch(q));
    this.pollTimer = setInterval(() => this.loadDocs(true), 5000);
  }

  ngOnDestroy() {
    clearInterval(this.pollTimer);
    this.destroy$.next(); this.destroy$.complete();
  }

  loadDocs(silent = false) {
    if (!silent) this.docsLoading = true;
    this.http.get<any>('http://localhost:8000/api/qa-history/docs').subscribe({
      next: res => {
        const fresh = res.docs || [];
        // If a new doc appeared or turn_count changed, refresh the selected doc thread too
        if (this.selectedDoc) {
          const updated = fresh.find((d: any) => d.document_id === this.selectedDoc!.document_id);
          if (updated && updated.turn_count !== this.selectedDoc.turn_count) {
            this.selectedDoc = updated;
            this.selectDoc(updated);
          }
        }
        this.docs = fresh;
        this.docsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.docsLoading = false; this.cdr.detectChanges(); }
    });
  }

  selectDoc(d: DocEntry) {
    this.selectedDoc = d;
    this.selectedTurnId = null;
    this.turns = [];
    this.turnsOffset = 0;
    this.turnsHasMore = false;
    this.loadTurns(false);
  }

  loadTurns(append = false) {
    if (!this.selectedDoc) return;
    this.histLoading = true;
    this.cdr.detectChanges();
    const offset = append ? this.turnsOffset : 0;
    this.http.get<any>(`http://localhost:8000/api/documents/${this.selectedDoc.document_id}/qa-history?limit=30&offset=${offset}`).subscribe({
      next: res => this.zone.run(() => {
        const incoming: QATurn[] = res.history || [];
        this.turns = append ? [...incoming, ...this.turns] : incoming;
        this.turnsTotal = res.total ?? incoming.length;
        this.turnsOffset = (res.offset ?? 0) + incoming.length;
        this.turnsHasMore = res.has_more ?? false;
        this.histLoading = false;
        this.hlCounter = 0;
        this.cdr.detectChanges();
        if (!append) {
          setTimeout(() => {
            this.scrollToBottom();
            if (this.searchQ) this.refreshMatchCount();
          }, 60);
        }
      }),
      error: () => this.zone.run(() => { this.histLoading = false; this.cdr.detectChanges(); })
    });
  }

  loadMoreTurns() {
    this.loadTurns(true);
  }

  onSearch(val: string) { this.searchQ = val; this.search$.next(val); }

  clearSearch() { this.searchQ = ''; this.searchResults = []; this.groupedResults = []; this.expandedGroups.clear(); this.cdr.detectChanges(); }

  doSearch(q: string) {
    if (!q.trim()) { this.searchResults = []; this.groupedResults = []; this.expandedGroups.clear(); this.cdr.detectChanges(); return; }
    this.searchLoading = true;
    this.http.get<any>(`http://localhost:8000/api/qa-history/search?q=${encodeURIComponent(q)}&limit=50`).subscribe({
      next: res => {
        this.searchResults = res.results || [];
        this.groupedResults = this.buildGroups(this.searchResults);
        this.expandedGroups.clear();
        this.searchLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.searchLoading = false; this.cdr.detectChanges(); }
    });
  }

  private buildGroups(turns: QATurn[]) {
    const map = new Map<string, { document_id: string; filename: string; doc_type: string; turns: QATurn[] }>();
    for (const t of turns) {
      if (!map.has(t.document_id)) {
        map.set(t.document_id, { document_id: t.document_id, filename: t.filename || t.document_id, doc_type: t.doc_type || 'document', turns: [] });
      }
      map.get(t.document_id)!.turns.push(t);
    }
    return Array.from(map.values());
  }

  toggleGroup(docId: string) {
    if (this.expandedGroups.has(docId)) this.expandedGroups.delete(docId);
    else this.expandedGroups.add(docId);
  }

  openGroupDoc(g: { document_id: string; filename: string; doc_type: string; turns: QATurn[] }) {
    let doc = this.docs.find(d => d.document_id === g.document_id);
    if (!doc) {
      doc = { document_id: g.document_id, filename: g.filename, doc_type: g.doc_type, turn_count: g.turns.length, last_at: g.turns[0]?.created_at, last_question: g.turns[0]?.question };
    }
    this.selectedTurnId = null;
    this.selectDoc(doc);
  }

  highlightSidebar(text: string): string {
    if (!this.searchQ || !text) return text;
    const escaped = this.searchQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(escaped, 'gi'), m => `<mark class="hl">${m}</mark>`);
  }

  openSearchResult(r: QATurn) {
    // Find the doc entry or create a stub
    let doc = this.docs.find(d => d.document_id === r.document_id);
    if (!doc) {
      doc = {
        document_id: r.document_id,
        filename: r.filename || r.document_id,
        doc_type: r.doc_type || 'document',
        turn_count: 1,
        last_at: r.created_at,
        last_question: r.question,
      };
    }
    this.selectedTurnId = r.id;
    this.selectDoc(doc);
    // After turns load, scroll to the specific turn
    setTimeout(() => {
      const el = document.getElementById('turn-' + r.id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 400);
  }

  deleteTurn(turn: QATurn) {
    this.zone.run(() => { this.pendingDeleteTurn = turn; this.cdr.detectChanges(); });
  }

  confirmDeleteTurn(yes: boolean) {
    const turn = this.pendingDeleteTurn;
    this.zone.run(() => { this.pendingDeleteTurn = null; this.cdr.detectChanges(); });
    if (!yes || !turn || !this.selectedDoc) return;
    this.http.delete(`http://localhost:8000/api/documents/${this.selectedDoc.document_id}/qa-history/${turn.id}`).subscribe({
      next: () => this.zone.run(() => {
        this.turns = this.turns.filter(t => t.id !== turn.id);
        this.turnsTotal = Math.max(0, this.turnsTotal - 1);
        // Update sidebar turn count
        const doc = this.docs.find(d => d.document_id === this.selectedDoc?.document_id);
        if (doc) doc.turn_count = Math.max(0, doc.turn_count - 1);
        if (this.turns.length === 0) { this.selectedDoc = null; this.docs = this.docs.filter(d => d.document_id !== this.selectedDoc?.document_id); }
        this.cdr.detectChanges();
      }),
      error: () => {}
    });
  }

  promptClearAll() {
    if (!this.selectedDoc) return;
    this.zone.run(() => { this.pendingClearAll = this.selectedDoc; this.cdr.detectChanges(); });
  }

  confirmClearAll(yes: boolean) {
    const doc = this.pendingClearAll;
    this.zone.run(() => { this.pendingClearAll = null; this.cdr.detectChanges(); });
    if (!yes || !doc) return;
    this.http.delete(`http://localhost:8000/api/documents/${doc.document_id}/qa-history`).subscribe({
      next: () => this.zone.run(() => {
        this.turns = [];
        this.turnsTotal = 0;
        this.turnsHasMore = false;
        this.docs = this.docs.filter(d => d.document_id !== doc.document_id);
        this.selectedDoc = null;
        this.cdr.detectChanges();
      })
    });
  }

  private scrollToBottom() {
    if (this.threadWrap?.nativeElement) {
      const el = this.threadWrap.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }

  formatAnswer(text: string): string {
    if (!text) return '';
    // Convert **bold**, bullet lines, and newlines to HTML
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gs, '<ul style="margin:6px 0 6px 16px;padding:0">$1</ul>')
      .replace(/\n/g, '<br>');
  }

  hlMatchCount = 0;
  hlCurrent = 0;
  private hlCounter = 0;

  highlight(text: string, resetCounter = false): string {
    if (!this.searchQ || !text) return text;
    if (resetCounter) this.hlCounter = 0;
    const escaped = this.searchQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(escaped, 'gi'), m => {
      ++this.hlCounter;
      return `<mark class="hl">${m}</mark>`;
    });
  }

  refreshMatchCount() {
    this.hlCounter = 0;
    this.hlMatchCount = 0;
    this.hlCurrent = 0;
    this.cdr.detectChanges();
    // After render, count actual marks
    setTimeout(() => {
      const wrap = document.querySelector('.thread-wrap');
      this.hlMatchCount = wrap ? wrap.querySelectorAll('mark.hl').length : 0;
      this.cdr.detectChanges();
    }, 60);
  }

  goToMatch(n: number) {
    const total = document.querySelectorAll('mark.hl').length;
    if (!total) return;
    this.hlCurrent = ((n - 1 + total) % total) + 1;
    const wrap = document.querySelector('.thread-wrap');
    const marks = wrap ? Array.from(wrap.querySelectorAll('mark.hl')) as HTMLElement[] : [];
    marks.forEach(m => m.classList.remove('hl-active'));
    const el = marks[this.hlCurrent - 1];
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('hl-active'); }
    this.cdr.detectChanges();
  }

  nextMatch() { this.goToMatch(this.hlCurrent + 1); }
  prevMatch() { this.goToMatch(this.hlCurrent - 1); }

  matchNumbers(): number[] {
    return Array.from({ length: this.hlMatchCount }, (_, i) => i + 1);
  }

  shortName(filename: string): string {
    if (!filename) return '—';
    return filename.length > 38 ? filename.substring(0, 36) + '…' : filename;
  }

  friendly(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)   return 'just now';
    if (mins < 60)  return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7)   return `${days}d ago`;
    return d.toLocaleDateString();
  }

  docIcon(type: string): string {
    const m: Record<string, string> = {
      insurance: '🛡️', bank_statement: '🏦', tax_document: '📊',
      invoice: '🧾', contract: '📝', nda: '🤫', lease: '🏠',
      medical: '🏥', lab_report: '🔬', policy: '📋',
      financial: '💰', legal: '⚖️', hr: '👥',
    };
    for (const [k, v] of Object.entries(m)) {
      if ((type || '').toLowerCase().includes(k)) return v;
    }
    return '📄';
  }
}
