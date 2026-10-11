import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

const API = 'http://localhost:7979';

interface Turn {
  question: string;
  answer: string;
  sources: string[];
  chartData?: any;
}

interface ConversationSession {
  id: string;
  rootQuestion: string;
  turns: Turn[];          // all turns: root first, then follow-ups
  sources: string[];      // union of all sources
  ts: Date;
  iterations: number;
}

@Component({
  selector: 'app-research-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="rh-root">

  <!-- Header -->
  <div class="rh-header">
    <div class="rh-title-row">
      <div>
        <div class="rh-title">🔬 Agent Conversation History</div>
        <div class="rh-sub">Past research sessions — select a session to review its full conversation</div>
      </div>
      <div class="rh-meta" *ngIf="total > 0">{{ total }} session{{ total !== 1 ? 's' : '' }}</div>
    </div>
    <div class="rh-search-wrap">
      <input class="rh-search" [(ngModel)]="searchQ" (ngModelChange)="onSearch()" placeholder="Search across all conversations…">
      <button class="rh-clear" *ngIf="searchQ" (click)="searchQ = ''; onSearch()">✕</button>
    </div>
  </div>

  <!-- Loading -->
  <div class="rh-loading" *ngIf="loading && sessions.length === 0">
    <span class="dots"><span></span><span></span><span></span></span>
    <span>Loading history…</span>
  </div>

  <!-- Empty -->
  <div class="rh-empty" *ngIf="!loading && filtered.length === 0">
    <div class="rh-empty-ico">🕑</div>
    <div class="rh-empty-msg">{{ searchQ ? 'No sessions match "' + searchQ + '"' : 'No research sessions yet' }}</div>
    <div class="rh-empty-sub">Run a query on the Research Agent page and it will appear here.</div>
    <button class="rh-go-btn" (click)="goToResearch()">Go to Research Agent →</button>
  </div>

  <!-- Session list + detail pane -->
  <div class="rh-body" *ngIf="filtered.length > 0">

    <!-- Left: session list -->
    <div class="rh-list">
      <div *ngFor="let s of filtered"
           class="rh-item"
           [class.active]="selected?.id === s.id"
           (click)="select(s)">
        <div class="rh-item-header">
          <div class="rh-item-q">{{ s.rootQuestion | slice:0:70 }}{{ s.rootQuestion.length > 70 ? '…' : '' }}</div>
          <button class="rh-del-btn" title="Delete" (click)="deleteSession(s, $event)">🗑</button>
        </div>
        <div class="rh-item-meta">
          <span class="rh-turns-badge">{{ s.turns.length }} turn{{ s.turns.length !== 1 ? 's' : '' }}</span>
          <span class="rh-ts">{{ s.ts | date:'MMM d · HH:mm' }}</span>
        </div>
        <div class="rh-sources" *ngIf="s.sources?.length">
          <span *ngFor="let src of s.sources.slice(0,2)" class="rh-src-chip">{{ src }}</span>
          <span *ngIf="s.sources.length > 2" class="rh-src-more">+{{ s.sources.length - 2 }}</span>
        </div>
      </div>

      <button class="rh-more-btn" *ngIf="hasMore" (click)="loadMore()" [disabled]="loading">
        {{ loading ? 'Loading…' : 'Load more' }}
      </button>
    </div>

    <!-- Right: conversation thread -->
    <div class="rh-detail" *ngIf="selected">
      <div class="rh-detail-top">
        <div class="rh-detail-title">{{ selected.rootQuestion | slice:0:80 }}{{ selected.rootQuestion.length > 80 ? '…' : '' }}</div>
        <div class="rh-detail-sub">{{ selected.ts | date:'MMMM d, y' }} · {{ selected.turns.length }} turn{{ selected.turns.length !== 1 ? 's' : '' }}</div>
      </div>

      <!-- All turns as a conversation thread -->
      <div class="rh-thread">
        <div *ngFor="let turn of selected.turns; let i = index" class="rh-turn">
          <div class="rh-turn-q">
            <span class="rh-q-ico">❓</span>
            <span class="rh-q-text">{{ turn.question }}</span>
            <span class="rh-turn-num">{{ i + 1 }}</span>
          </div>
          <div class="rh-answer-card">
            <div class="rh-answer-label">✅ ANSWER</div>
            <div class="rh-answer-body" [innerHTML]="md(turn.answer)"></div>
            <div class="rh-sources-row" *ngIf="turn.sources?.length">
              <span class="rh-sources-lbl">SOURCES:</span>
              <span *ngFor="let src of turn.sources" class="rh-src-chip">{{ src }}</span>
            </div>
          </div>
        </div>
      </div>

      <button class="rh-research-again" (click)="goToResearch()">
        🔬 Research again →
      </button>
    </div>

    <div class="rh-detail rh-detail-empty" *ngIf="!selected">
      <div class="rh-pick-ico">👈</div>
      <div class="rh-pick-msg">Select a session to view the full conversation</div>
    </div>

  </div>

</div>
<!-- Delete confirm dialog -->
<div class="del-overlay" *ngIf="pendingDelete" (click)="confirmDelete(false)">
  <div class="del-dialog" (click)="$event.stopPropagation()">
    <div class="del-icon">🗑️</div>
    <div class="del-title">Delete this session?</div>
    <div class="del-msg">
      "<span class="del-q">{{ (pendingDelete!.rootQuestion || '') | slice:0:60 }}{{ (pendingDelete!.rootQuestion.length || 0) > 60 ? '…' : '' }}</span>"
      <br>All follow-up turns will also be deleted.
    </div>
    <div class="del-actions">
      <button class="del-cancel-btn" (click)="confirmDelete(false)">Cancel</button>
      <button class="del-confirm-btn" (click)="confirmDelete(true)">Delete</button>
    </div>
  </div>
</div>
  `,
  styleUrls: ['./research-history.component.scss'],
})
export class ResearchHistoryComponent implements OnInit {
  sessions: ConversationSession[] = [];
  filtered: ConversationSession[] = [];
  selected: ConversationSession | null = null;
  loading = false;
  total = 0;
  hasMore = false;
  offset = 0;
  searchQ = '';
  pendingDelete: ConversationSession | null = null;

  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private zone: NgZone,
  ) {}

  ngOnInit() {
    this.load();
  }

  load(append = false) {
    this.zone.run(() => { this.loading = true; });
    const off = append ? this.offset : 0;
    this.http.get<any>(`${API}/api/research/history?limit=30&offset=${off}`).subscribe({
      next: res => this.zone.run(() => {
        const rows: any[] = res.items ?? [];
        const mapped: ConversationSession[] = rows.map(r => {
          const children: any[] = r.thread || [];
          // Build all turns: root turn first, then each follow-up child
          const turns: Turn[] = [
            { question: r.question, answer: r.answer || '', sources: r.sources || [], chartData: r.chart_data },
            ...children.map((c: any) => ({
              question: c.question,
              answer: c.answer || '',
              sources: c.sources || [],
              chartData: c.chartData,
            })),
          ];
          // Union of all sources across turns
          const allSources = [...new Set(turns.flatMap(t => t.sources))];
          return {
            id: r.id,
            rootQuestion: r.question,
            turns,
            sources: allSources,
            ts: new Date(r.ts),
            iterations: r.iterations,
          };
        });
        this.sessions = append ? [...this.sessions, ...mapped] : mapped;
        this.total = res.total ?? this.sessions.length;
        this.offset = (res.offset ?? 0) + rows.length;
        this.hasMore = res.has_more ?? false;
        this.applyFilter();
        if (!this.selected && this.filtered.length > 0) this.selected = this.filtered[0];
        this.loading = false;
        this.cdr.detectChanges();
      }),
      error: () => this.zone.run(() => { this.loading = false; this.cdr.detectChanges(); })
    });
  }

  loadMore() { this.load(true); }

  onSearch() {
    this.zone.run(() => this.applyFilter());
  }

  applyFilter() {
    const q = this.searchQ.toLowerCase().trim();
    this.filtered = q
      ? this.sessions.filter(s =>
          s.rootQuestion.toLowerCase().includes(q) ||
          s.turns.some(t => t.question.toLowerCase().includes(q) || t.answer.toLowerCase().includes(q))
        )
      : [...this.sessions];
  }

  select(s: ConversationSession) {
    this.zone.run(() => { this.selected = s; this.cdr.detectChanges(); });
  }

  deleteSession(s: ConversationSession, e: Event) {
    e.stopPropagation();
    this.zone.run(() => { this.pendingDelete = s; this.cdr.detectChanges(); });
  }

  confirmDelete(yes: boolean) {
    const s = this.pendingDelete;
    this.zone.run(() => { this.pendingDelete = null; this.cdr.detectChanges(); });
    if (!yes || !s) return;
    this.http.delete(`${API}/api/research/history/${s.id}`).subscribe({
      next: () => this.zone.run(() => {
        this.sessions = this.sessions.filter(x => x.id !== s.id);
        this.total = Math.max(0, this.total - 1);
        if (this.selected?.id === s.id) this.selected = this.filtered[0] ?? null;
        this.applyFilter();
        this.cdr.detectChanges();
      }),
      error: () => {}
    });
  }

  goToResearch() { this.router.navigate(['/research']); }

  md(text: string): SafeHtml {
    if (!text) return this.sanitizer.bypassSecurityTrustHtml('');
    let t = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, r => '<ul>' + r + '</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    return this.sanitizer.bypassSecurityTrustHtml('<p>' + t + '</p>');
  }
}
