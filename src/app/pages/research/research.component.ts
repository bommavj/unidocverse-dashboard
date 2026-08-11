import { Component, OnInit, OnDestroy, ElementRef, ViewChild, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Observable, Subject } from 'rxjs';

const API = 'http://localhost:8000';

interface ResearchDoc {
  id: string;
  filename: string;
  doc_type: string;
  chunk_count: number;
  searchable: boolean;
}

interface AgentStep {
  iteration: number;
  thought: string;
  tool: string;
  args: any;
  observation: any;
  latency_ms: number;
  expanded?: boolean;
  // HITL fields
  hitlPending?: boolean;
  hitlApprovalId?: string;
  hitlIntent?: string;
  hitlEntities?: any;
  hitlPreview?: string;
  hitlStatus?: 'pending' | 'confirmed' | 'cancelled';
}

interface ResearchSession {
  id?: string;
  question: string;
  steps: AgentStep[];
  answer: string;
  sources: string[];
  iterations: number;
  ts: Date;
  fromHistory?: boolean;
  // Pagination
  hasMore?: boolean;
  currentPage?: number;
  loadingMore?: boolean;
  docIds?: string[];
  // Chart
  chartData?: any;
  chartType?: string;
  hasStructuredData?: boolean; // true when query_transactions step found
  // Multi-turn follow-up
  matchedDocIds?: string[];   // doc ids resolved by the agent for this session
  priorQA?: { q: string; a: string }[]; // conversation history
  thread?: { question: string; answer: string; sources: string[]; chartData?: any; matchedDocIds?: string[] }[]; // prior turns in this conversation
  rootQuestion?: string; // the first question — shown in sidebar, never overwritten by follow-ups
}

@Component({
  selector: 'app-research',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './research.component.html',
  styleUrls: ['./research.component.scss'],
})
export class ResearchComponent implements OnInit, OnDestroy {
  @ViewChild('chatBottom') chatBottom!: ElementRef;
  @ViewChild('questionInput') questionInput!: ElementRef;
  docs: ResearchDoc[] = [];
  docsLoading = false;
  docSearch = '';

  selectedDocIds = new Set<string>();
  selectAll = false;

  activeModel = 'phi3:mini';
  question = '';
  running = false;
  sessions: ResearchSession[] = [];
  activeSession: ResearchSession | null = null;
  liveSteps: AgentStep[] = [];
  liveThinking = '';
  streamingAnswer = '';
  private _es: EventSource | null = null;
  showDownloadMenu = false;
  historyOffset = 0;
  historyHasMore = false;
  historyLoading = false;
  sideTab: 'docs' | 'history' = 'docs';
  showLeaveDialog = false;
  private _leaveSubject: Subject<boolean> | null = null;
  followUpQuestion = '';

  setSideTab(tab: 'docs' | 'history') {
    this.sideTab = tab;
    this.cdr.detectChanges();
  }

  toolIcons: Record<string, string> = {
    reason_question:  '🧠',
    search_documents: '🔍',
    ask_document:     '💬',
    list_documents:   '📋',
    final_answer:     '✅',
    error:            '❌',
    create_client:      '👤',
    create_policy:      '🛡️',
    create_claim:       '📝',
    create_quote:       '💰',
    create_matter:      '⚖️',
    create_clm:         '📃',
    create_approval:    '✔️',
    create_immigration: '🛂',
    create_note:        '🗒️',
    create_task:        '📌',
    update_client:      '✏️',
    update_policy:      '🔄',
    update_claim:       '📋',
    update_quote:       '💱',
    update_matter:      '⚖️',
    update_clm:         '🔀',
    update_immigration: '🛃',
    update_note:        '📝',
    update_task:        '✅',
    delete_request:     '🚫',
  };

  toolLabels: Record<string, string> = {
    reason_question:    'Understand Question',
    search_documents:   'Search Documents',
    ask_document:       'Ask Document',
    list_documents:     'Filter Documents',
    final_answer:       'Final Answer',
    create_client:      'Create Client',
    create_policy:      'Create Policy',
    create_claim:       'File Claim',
    create_quote:       'Create Quote',
    create_matter:      'Create Matter',
    create_clm:         'Add to CLM Pipeline',
    create_approval:    'Create Approval',
    create_immigration: 'Add Immigration Record',
    create_note:        'Save Note',
    create_task:        'Create Task',
    update_client:      'Update Client',
    update_policy:      'Update Policy',
    update_claim:       'Update Claim',
    update_quote:       'Update Quote',
    update_matter:      'Update Matter',
    update_clm:         'Move Contract Stage',
    update_immigration: 'Update Immigration Record',
    update_note:        'Update Note',
    update_task:        'Update Task',
    delete_request:     'Delete Requested',
  };

  exampleQuestions = [
    'What are the main risk factors for this company?',
    'How does executive compensation compare to company performance?',
    'What is the pipeline strategy and timeline?',
    'Why is the company proposing to increase authorized shares?',
    'What are the key revenue drivers and financial trends?',
  ];

  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    this.loadDocs();
    this.loadHistory();
    this.route.queryParams.subscribe(p => {
      if (p['q']) { this.question = p['q']; this.cdr.markForCheck(); }
      if (p['session']) {
        const targetId = p['session'];
        const tryOpen = () => {
          const found = this.sessions.find(s => s.id === targetId);
          if (found) { this.openSession(found); this.setSideTab('history'); this.cdr.markForCheck(); }
        };
        // Try immediately (if history already loaded) and again after history loads
        setTimeout(tryOpen, 800);
      }
    });
    this.http.get<{ selected_model: string }>(`${API}/api/models/get-model`).subscribe({
      next: r => { this.activeModel = r.selected_model || 'phi3:mini'; this.cdr.markForCheck(); },
      error: () => {}
    });
  }

  loadHistory(append = false) {
    if (this.historyLoading) return;
    this.historyLoading = true;
    const offset = append ? this.historyOffset : 0;
    this.http.get<any>(`${API}/api/research/history?limit=20&offset=${offset}`).subscribe({
      next: res => {
        this.historyLoading = false;
        const rows: any[] = res.items ?? res; // handle both paginated and legacy array
        const inMemIds = new Set(this.sessions.map(s => s.id).filter(Boolean));
        const incoming: ResearchSession[] = rows
          .filter(r => !inMemIds.has(r.id))
          .map(r => {
            // children = follow-up turns, chronological order from backend
            const children: any[] = r.thread || [];
            // All turns: root first, then each follow-up
            const allTurns = [
              { question: r.question, answer: r.answer, sources: r.sources || [], chartData: r.chart_data, matchedDocIds: r.matched_doc_ids || [] },
              ...children.map((c: any) => ({
                question: c.question, answer: c.answer, sources: c.sources || [],
                chartData: c.chartData, matchedDocIds: c.matchedDocIds || r.matched_doc_ids || [],
              })),
            ];
            const last = allTurns[allTurns.length - 1];
            const priorTurns = allTurns.slice(0, allTurns.length - 1);
            return {
              id: r.id,
              rootQuestion: r.question,
              question: last.question,
              answer: last.answer,
              sources: last.sources,
              chartData: last.chartData,
              matchedDocIds: last.matchedDocIds,
              thread: priorTurns.map(t => ({ question: t.question, answer: t.answer, sources: t.sources, chartData: t.chartData })),
              steps: (r.steps || []).map((s: AgentStep) => ({ ...s, expanded: false })),
              iterations: r.iterations,
              ts: new Date(r.ts),
              fromHistory: true,
            };
          });
        if (append) {
          this.sessions = [...this.sessions, ...incoming];
        } else {
          // Keep any fresh in-memory sessions (no id yet) at the top
          const noId = this.sessions.filter(s => !s.id);
          this.sessions = [...noId, ...incoming];
        }
        this.historyOffset = (res.offset ?? 0) + rows.length;
        this.historyHasMore = res.has_more ?? false;
        this.cdr.markForCheck();
      },
      error: () => { this.historyLoading = false; }
    });
  }

  loadMoreHistory() {
    this.loadHistory(true);
  }

  loadDocs() {
    this.docsLoading = true;
    this.http.get<ResearchDoc[]>(`${API}/api/research/docs`).subscribe({
      next: docs => {
        this.docs = docs;
        this.docsLoading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.docsLoading = false; }
    });
  }

  get filteredDocs(): ResearchDoc[] {
    const q = this.docSearch.toLowerCase();
    return q ? this.docs.filter(d => d.filename.toLowerCase().includes(q)) : this.docs;
  }

  toggleDoc(id: string) {
    if (this.selectedDocIds.has(id)) {
      this.selectedDocIds.delete(id);
    } else {
      this.selectedDocIds.add(id);
    }
    this.selectAll = this.selectedDocIds.size === this.docs.length;
    this.cdr.markForCheck();
  }

  toggleSelectAll() {
    if (this.selectAll) {
      this.selectedDocIds.clear();
      this.selectAll = false;
    } else {
      this.docs.forEach(d => this.selectedDocIds.add(d.id));
      this.selectAll = true;
    }
    this.cdr.markForCheck();
  }

  useExample(q: string) {
    this.question = q;
    setTimeout(() => this.questionInput?.nativeElement?.focus(), 50);
  }

  toggleDownloadMenu(e: Event) {
    e.stopPropagation();
    this.showDownloadMenu = !this.showDownloadMenu;
    if (this.showDownloadMenu) {
      setTimeout(() => document.addEventListener('click', this._closeDownloadMenu), 0);
    }
    this.cdr.markForCheck();
  }

  private _closeDownloadMenu = () => {
    this.showDownloadMenu = false;
    document.removeEventListener('click', this._closeDownloadMenu);
    this.cdr.markForCheck();
  };

  downloadAnswer(format: 'md' | 'txt' | 'json' | 'csv' | 'html' | 'pdf' | 'doc') {
    if (!this.activeSession) return;
    const { answer, question, sources } = this.activeSession;
    const slug = question.slice(0, 40).replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    const sourcesLine = sources?.length ? sources.join(', ') : '';

    if (format === 'pdf') {
      this._printAsPdf(question, answer, sourcesLine);
      this.showDownloadMenu = false;
      this.cdr.markForCheck();
      return;
    }

    let content = '';
    let mime = 'text/plain';
    let ext: string = format;

    if (format === 'md') {
      content = `# Research Answer\n\n**Question:** ${question}\n\n${answer}`;
      if (sourcesLine) content += `\n\n---\n**Sources:** ${sourcesLine}`;
      mime = 'text/markdown';

    } else if (format === 'txt') {
      const plain = answer
        .replace(/^#{1,3} /gm, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/^\|[-: |]+\|$/gm, '')
        .replace(/\|/g, '\t')
        .trim();
      content = `Question: ${question}\n\n${plain}`;
      if (sourcesLine) content += `\n\nSources: ${sourcesLine}`;

    } else if (format === 'json') {
      content = JSON.stringify({ question, answer, sources: sources || [] }, null, 2);
      mime = 'application/json';

    } else if (format === 'csv') {
      // Extract markdown tables into CSV; fall back to key-value pairs
      const tableRe = /((?:^|\n)\|.+\|(?:\n\|.+\|)*)/g;
      const tables: string[] = [];
      let tm;
      while ((tm = tableRe.exec(answer)) !== null) {
        const lines = tm[1].trim().split('\n')
          .filter((l: string) => l.trim() && !/^\|[-: |]+\|$/.test(l.trim()));
        const csvRows = lines.map((l: string) =>
          l.replace(/^\||\|$/g, '').split('|')
            .map((c: string) => `"${c.trim().replace(/"/g, '""')}"`).join(',')
        );
        tables.push(csvRows.join('\n'));
      }
      content = tables.length
        ? `# ${question}\n\n` + tables.join('\n\n')
        : `question,answer\n"${question.replace(/"/g, '""')}","${answer.replace(/"/g, '""')}"`;
      mime = 'text/csv';

    } else if (format === 'html') {
      const bodyHtml = (this.md(answer) as any).changingThisBreaksApplicationSecurity || answer;
      content = this._buildHtmlExport(question, bodyHtml, sourcesLine);
      mime = 'text/html';

    } else if (format === 'doc') {
      // Word-compatible HTML (Word opens HTML with .doc extension natively)
      const bodyHtml = (this.md(answer) as any).changingThisBreaksApplicationSecurity || answer;
      content = this._buildWordExport(question, bodyHtml, sourcesLine);
      mime = 'application/msword';
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research_${slug}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    this.showDownloadMenu = false;
    this.cdr.markForCheck();
  }

  copyAnswer() {
    if (!this.activeSession) return;
    const { answer, question, sources } = this.activeSession;
    const text = `Question: ${question}\n\n${answer}` +
      (sources?.length ? `\n\nSources: ${sources.join(', ')}` : '');
    navigator.clipboard.writeText(text).then(() => {
      this.showDownloadMenu = false;
      this.cdr.markForCheck();
      // Brief visual confirmation
      const btn = document.querySelector('.dl-btn') as HTMLElement;
      if (btn) { btn.textContent = '✅ Copied!'; setTimeout(() => { btn.textContent = '⬇ Download'; }, 1800); }
    });
  }

  private _buildHtmlExport(question: string, bodyHtml: string, sources: string): string {
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>${question}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 820px; margin: 40px auto; padding: 0 24px; color: #1e293b; line-height: 1.7; }
  h1 { font-size: 22px; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
  h2, h3 { color: #0f172a; margin-top: 24px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
  th { background: #f8fafc; padding: 8px 14px; text-align: left; border-bottom: 2px solid #e2e8f0; font-weight: 700; }
  td { padding: 7px 14px; border-bottom: 1px solid #f1f5f9; }
  tr:nth-child(even) td { background: #fafafa; }
  code { background: #f1f5f9; border-radius: 3px; padding: 1px 5px; font-family: monospace; font-size: 12px; }
  pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; overflow-x: auto; }
  .question { background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 12px 16px; font-weight: 600; color: #312e81; margin-bottom: 24px; }
  .sources { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
</style></head><body>
<div class="question">❓ ${question}</div>
${bodyHtml}
${sources ? `<div class="sources"><strong>Sources:</strong> ${sources}</div>` : ''}
<p style="margin-top:40px;font-size:11px;color:#94a3b8">Generated by UniDocVerse Research Agent</p>
</body></html>`;
  }

  private _buildWordExport(question: string, bodyHtml: string, sources: string): string {
    return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:w="urn:schemas-microsoft-com:office:word"
  xmlns="http://www.w3.org/TR/REC-html40"><head>
<meta charset="UTF-8">
<title>${question}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1e293b; }
  h1 { font-size: 16pt; color: #0f172a; border-bottom: 1pt solid #e2e8f0; padding-bottom: 6pt; }
  h2 { font-size: 13pt; color: #0f172a; margin-top: 18pt; }
  h3 { font-size: 11pt; color: #334155; margin-top: 14pt; }
  table { border-collapse: collapse; width: 100%; font-size: 10pt; margin: 10pt 0; }
  th { background: #f8fafc; padding: 6pt 10pt; text-align: left; border: 1pt solid #e2e8f0; font-weight: bold; }
  td { padding: 5pt 10pt; border: 1pt solid #f1f5f9; }
  code { font-family: Courier New, monospace; font-size: 9pt; background: #f1f5f9; }
  .question { background: #eef2ff; padding: 8pt 12pt; font-weight: bold; color: #312e81; margin-bottom: 18pt; }
  .sources { margin-top: 24pt; padding-top: 10pt; border-top: 1pt solid #e2e8f0; font-size: 9pt; color: #64748b; }
</style></head><body>
<div class="question">Question: ${question}</div>
${bodyHtml}
${sources ? `<div class="sources"><strong>Sources:</strong> ${sources}</div>` : ''}
<p style="margin-top:30pt;font-size:8pt;color:#94a3b8">Generated by UniDocVerse Research Agent</p>
</body></html>`;
  }

  private _printAsPdf(question: string, answer: string, sources: string): void {
    const bodyHtml = (this.md(answer) as any).changingThisBreaksApplicationSecurity || answer;
    const html = this._buildHtmlExport(question, bodyHtml, sources);
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 600);
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(e: BeforeUnloadEvent) {
    if (this.running) {
      e.preventDefault();
    }
  }

  canDeactivate(): boolean | Observable<boolean> {
    if (!this.running) return true;
    this._leaveSubject = new Subject<boolean>();
    this.showLeaveDialog = true;
    this.cdr.detectChanges();
    return this._leaveSubject.asObservable();
  }

  confirmLeave(leave: boolean) {
    this.showLeaveDialog = false;
    this._leaveSubject?.next(leave);
    this._leaveSubject?.complete();
    this._leaveSubject = null;
    this.cdr.detectChanges();
  }

  ngOnDestroy() {
    this._es?.close();
  }

  hasChart(session: ResearchSession | null): boolean {
    return !!(session?.chartData);
  }

  goToAnalytics(session: ResearchSession) {
    // Navigate to the session-specific analytics URL so the chart panel
    // loads this session's data from DB regardless of browser sessionStorage.
    if (session.id) {
      this.router.navigate(['/analytics/session', session.id]);
    } else {
      // Fallback for sessions without an id (shouldn't happen after V42 migration)
      if (session.chartData) {
        sessionStorage.setItem('research_chart_latest', JSON.stringify({
          chartData: session.chartData,
          question: session.question,
          sources: session.sources,
        }));
      }
      this.router.navigate(['/analytics']);
    }
  }

  submit() {
    if (!this.question.trim() || this.running) return;
    // If there's an active session with matched docs, auto-treat as follow-up
    if (this.activeSession?.matchedDocIds?.length) {
      this.followUpQuestion = this.question.trim();
      this.question = '';
      this.submitFollowUp();
      return;
    }
    const q = this.question.trim();
    this.question = '';
    this.running = true;
    this.liveSteps = [];
    this.liveThinking = 'Searching documents...';
    this.streamingAnswer = '';

    // Close any existing stream
    if (this._es) { this._es.close(); this._es = null; }

    const docIds = this.selectedDocIds.size > 0
      ? Array.from(this.selectedDocIds).join(',') : '';

    const params = new URLSearchParams({ question: q });
    if (docIds) params.set('doc_ids', docIds);

    // Create a placeholder session immediately so the UI shows up
    const session: ResearchSession = {
      id: undefined,
      question: q,
      rootQuestion: q,
      steps: [],
      answer: '',
      sources: [],
      iterations: 0,
      ts: new Date(),
      hasMore: false,
      currentPage: 0,
      docIds: docIds ? docIds.split(',') : [],
    };
    this.sessions.unshift(session);
    this.activeSession = session;
    this.cdr.markForCheck();

    this._es = new EventSource(`${API}/api/research/ask/stream?${params}`);
    this._attachSSEHandler(this._es, session);
  }

  /** Shared SSE event handler — wires up an EventSource to a ResearchSession. */
  private _attachSSEHandler(es: EventSource, session: ResearchSession, onDone?: () => void) {
    es.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);

      if (msg.type === 'step') {
        const s = msg.step;
        const obs = s.observation || {};
        const hitl = obs.hitl === true;
        const step = {
          ...s, expanded: false,
          hitlPending:    hitl,
          hitlApprovalId: hitl ? obs.approval_id : undefined,
          hitlIntent:     hitl ? obs.intent      : undefined,
          hitlEntities:   hitl ? obs.entities    : undefined,
          hitlPreview:    hitl ? obs.preview      : undefined,
          hitlStatus:     hitl ? 'pending'        : undefined,
        };
        session.steps.push(step);
        if (s.tool === 'query_transactions') {
          session.hasStructuredData = true;
        }
        this.liveThinking = s.thought || 'Processing...';
        this.cdr.markForCheck();

      } else if (msg.type === 'token') {
        this.streamingAnswer += msg.text;
        session.answer = this.streamingAnswer;
        this.liveThinking = 'Writing answer...';
        this.cdr.markForCheck();
        this.scrollBottom();

      } else if (msg.type === 'sources') {
        session.sources = msg.sources || [];
        this.cdr.markForCheck();

      } else if (msg.type === 'chart') {
        session.chartData = msg.chart;
        session.chartType = msg.chart?.type || 'bar';
        this.cdr.markForCheck();

      } else if (msg.type === 'done') {
        es.close();
        if (this._es === es) this._es = null;
        this.running = false;
        this.liveThinking = '';
        this.streamingAnswer = '';
        session.iterations = session.steps.length;
        if (msg.session_id) session.id = msg.session_id;
        if (msg.matched_doc_ids?.length) session.matchedDocIds = msg.matched_doc_ids;
        session.hasMore = msg.has_more === true;
        session.currentPage = msg.page ?? 0;
        if (session.chartData) {
          const payload = JSON.stringify({
            chartData: session.chartData,
            question:  session.question,
            sources:   session.sources,
          });
          // Store by session id so analytics can retrieve the right chart per session
          if (session.id) sessionStorage.setItem(`research_chart_${session.id}`, payload);
          // Also keep a pointer to the latest chart for the default analytics view
          sessionStorage.setItem('research_chart_latest', payload);
        } else {
          if (session.id) sessionStorage.removeItem(`research_chart_${session.id}`);
        }
        this.cdr.markForCheck();
        if (onDone) onDone();

      } else if (msg.type === 'error') {
        es.close();
        if (this._es === es) this._es = null;
        this.running = false;
        this.liveThinking = '';
        session.answer = `Error: ${msg.message}`;
        this.cdr.markForCheck();
      }
    };

    es.onerror = () => {
      es.close();
      if (this._es === es) this._es = null;
      this.running = false;
      this.liveThinking = '';
      this.cdr.markForCheck();
    };
  }

  loadMore() {
    const session = this.activeSession;
    if (!session || !session.hasMore || session.loadingMore) return;

    session.loadingMore = true;
    this.cdr.markForCheck();

    const nextPage = (session.currentPage ?? 0) + 1;
    const body: any = { question: session.question, page: nextPage };
    if (session.docIds && session.docIds.length > 0) {
      body.doc_ids = session.docIds;
    }

    this.http.post<any>(`${API}/api/research/ask`, body).subscribe({
      next: result => {
        session.loadingMore = false;
        session.hasMore = result.has_more === true;
        session.currentPage = nextPage;
        const newAnswer = result.answer || '';
        if (newAnswer) {
          session.answer = session.answer
            + `\n\n<div class="page-break-label">📄 Additional Details — Page ${nextPage + 1}</div>\n\n`
            + newAnswer;
        }
        if (result.sources) {
          const allSources = new Set([...(session.sources || []), ...result.sources]);
          session.sources = Array.from(allSources);
        }
        this.cdr.markForCheck();
        setTimeout(() => this.scrollBottom(), 100);
      },
      error: () => {
        session.loadingMore = false;
        this.cdr.markForCheck();
      }
    });
  }

  scrollBottom() {
    this.chatBottom?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
  }

  toggleStep(step: AgentStep) {
    step.expanded = !step.expanded;
  }

  confirmAction(step: AgentStep) {
    step.hitlStatus = 'confirmed';
    this.cdr.markForCheck();
    this.http.post<any>(`${API}/api/research/action/confirm`, {
      approval_id: step.hitlApprovalId,
      intent:      step.hitlIntent,
      entities:    step.hitlEntities,
    }).subscribe({
      next: result => {
        step.hitlPending = false;
        step.observation = { ...step.observation, ...result, hitl: false };
        if (this.activeSession) {
          this.activeSession.answer = result.message || this.activeSession.answer;
        }
        this.cdr.markForCheck();
      },
      error: err => {
        step.hitlStatus = 'pending';
        step.observation = { ...step.observation, error: 'Action failed. Please try again.' };
        this.cdr.markForCheck();
      }
    });
  }

  cancelAction(step: AgentStep) {
    step.hitlStatus = 'cancelled';
    step.hitlPending = false;
    this.cdr.markForCheck();
    this.http.post<any>(`${API}/api/research/action/cancel`, {
      approval_id: step.hitlApprovalId,
    }).subscribe();
    if (this.activeSession) {
      this.activeSession.answer = '❌ Action cancelled.';
    }
    this.cdr.markForCheck();
  }

  openSession(s: ResearchSession) {
    this.activeSession = s;
    this.cdr.markForCheck();
    // Always refresh thread from DB to ensure all turns are shown
    const rootId = (s as any)._rootId || s.id;
    if (!rootId) return;
    this.http.get<any>(`${API}/api/research/session/${rootId}`).subscribe({
      next: r => {
        const children: any[] = r.thread || [];
        const allTurns = [
          { question: r.question, answer: r.answer || '', sources: r.sources || [], chartData: r.chart_data, matchedDocIds: r.matched_doc_ids || [] },
          ...children.map((c: any) => ({ question: c.question, answer: c.answer || '', sources: c.sources || [], chartData: c.chartData, matchedDocIds: c.matchedDocIds || [] })),
        ];
        const last = allTurns[allTurns.length - 1];
        s.thread = allTurns.slice(0, -1).map(t => ({ question: t.question, answer: t.answer, sources: t.sources, chartData: t.chartData }));
        s.question = last.question;
        s.answer = last.answer;
        s.sources = last.sources;
        s.chartData = last.chartData;
        s.matchedDocIds = last.matchedDocIds?.length ? last.matchedDocIds : (r.matched_doc_ids || []);
        s.rootQuestion = r.question;
        (s as any)._rootId = r.id;
        this.cdr.markForCheck();
      }
    });
  }

  closeSession() {
    this.activeSession = null;
    this.followUpQuestion = '';
    this.cdr.markForCheck();
  }

  submitFollowUpEnter(event: Event) {
    const ke = event as KeyboardEvent;
    if (ke.shiftKey) return;
    event.preventDefault();
    this.submitFollowUp();
  }

  submitFollowUp() {
    const q = this.followUpQuestion.trim();
    if (!q || this.running || !this.activeSession) return;
    const prev = this.activeSession;
    this.followUpQuestion = '';

    // Archive the current turn into the thread before overwriting
    prev.thread = [
      ...(prev.thread || []),
      { question: prev.question, answer: prev.answer, sources: prev.sources, chartData: prev.chartData, matchedDocIds: prev.matchedDocIds },
    ];

    // Build prior_qa chain
    const priorQA: { q: string; a: string }[] = [
      ...(prev.priorQA || []),
      { q: prev.question, a: prev.answer },
    ];

    const contextDocIds = prev.matchedDocIds?.join(',') || '';
    // rootId = the DB id of the root session (never a child's id)
    const rootId = (prev as any)._rootId || prev.id || '';
    const params = new URLSearchParams({ question: q });
    if (contextDocIds) params.set('context_doc_ids', contextDocIds);
    if (rootId) params.set('parent_session_id', rootId);
    params.set('prior_qa', JSON.stringify(priorQA));

    // Update the SAME session in place — rootQuestion stays fixed for sidebar display
    prev.rootQuestion = prev.rootQuestion || prev.question;
    (prev as any)._rootId = rootId;  // persist root id across multi-turn chains
    prev.question    = q;
    prev.answer      = '';
    prev.sources     = [];
    prev.steps       = [];
    prev.chartData   = undefined;
    prev.iterations  = 0;
    prev.priorQA     = priorQA;

    this.running = true;
    this.liveSteps = [];
    this.liveThinking = 'Searching documents...';
    this.streamingAnswer = '';
    if (this._es) { this._es.close(); this._es = null; }

    this.cdr.markForCheck();
    this._es = new EventSource(`${API}/api/research/ask/stream?${params}`);

    // After done, refresh thread from DB so all prior turns are visible
    const onFollowUpDone = () => {
      if (!rootId) return;
      this.http.get<any>(`${API}/api/research/session/${rootId}`).subscribe({
        next: r => {
          const children: any[] = r.thread || [];
          const allTurns = [
            { question: r.question, answer: r.answer, sources: r.sources || [], chartData: r.chart_data, matchedDocIds: r.matched_doc_ids || [] },
            ...children.map((c: any) => ({ question: c.question, answer: c.answer, sources: c.sources || [], chartData: c.chartData, matchedDocIds: c.matchedDocIds || [] })),
          ];
          const last = allTurns[allTurns.length - 1];
          prev.thread = allTurns.slice(0, -1).map(t => ({ question: t.question, answer: t.answer, sources: t.sources, chartData: t.chartData }));
          prev.matchedDocIds = last.matchedDocIds?.length ? last.matchedDocIds : prev.matchedDocIds;
          this.cdr.markForCheck();
        }
      });
    };

    this._attachSSEHandler(this._es, prev, onFollowUpDone);
  }

  clearHistory() {
    this.sessions = [];
    this.activeSession = null;
    this.historyOffset = 0;
    this.historyHasMore = false;
    this.cdr.markForCheck();
  }

  formatObs(obs: any): string {
    if (!obs) return '';
    if (typeof obs === 'string') return obs;
    const str = JSON.stringify(obs, null, 2);
    return str.length > 1200 ? str.slice(0, 1200) + '\n...' : str;
  }

  md(text: string): SafeHtml {
    if (!text) return this.sanitizer.bypassSecurityTrustHtml('');

    // Split on fenced code blocks (```lang\n...\n```)
    const segments: { code: boolean; lang: string; content: string }[] = [];
    const fenceRe = new RegExp('`{3}(\\w*)\\n?([\\s\\S]*?)`{3}', 'g');
    let last = 0;
    let fm: RegExpExecArray | null;
    while ((fm = fenceRe.exec(text)) !== null) {
      if (fm.index > last) segments.push({ code: false, lang: '', content: text.slice(last, fm.index) });
      segments.push({ code: true, lang: fm[1] || '', content: fm[2] });
      last = fm.index + fm[0].length;
    }
    if (last < text.length) segments.push({ code: false, lang: '', content: text.slice(last) });

    const renderProse = (raw: string): string => {
      let t = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      // Tables: find consecutive blocks of | lines, skip separator rows
      t = t.replace(/((?:^|\n)\|.+\|[ \t]*(?:\n\|.+\|[ \t]*)*)/g, (block: string) => {
        const lines = block.trim().split('\n')
          .filter((l: string) => l.trim() && !/^\|[-: |]+\|$/.test(l.trim()));
        if (lines.length < 1) return block;
        const parseRow = (r: string) => r.replace(/^\||\|$/g, '').split('|').map((c: string) => c.trim());
        const headers = parseRow(lines[0]);
        const rows = lines.slice(1).map(parseRow);
        const th = headers.map((h: string) => '<th>' + h + '</th>').join('');
        const trs = rows.map((cells: string[]) =>
          '<tr>' + cells.map((c: string) => '<td>' + c + '</td>').join('') + '</tr>'
        ).join('');
        const tableHtml = '<div class="md-table-wrap"><table class="md-table"><thead><tr>' + th +
               '</tr></thead><tbody>' + trs + '</tbody></table></div>';
        if (rows.length > 8) {
          return `<details class="md-table-accordion"><summary class="md-table-summary">`
               + `<span class="mta-icon">📋</span>`
               + `<span class="mta-label">${rows.length} rows — click to expand</span>`
               + `<span class="mta-chevron">›</span></summary>${tableHtml}</details>`;
        }
        return tableHtml;
      });

      t = t
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, (r: string) => '<ul>' + r + '</ul>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
      return '<p>' + t + '</p>';
    };

    const html = segments.map(seg => {
      if (seg.code) {
        const escaped = seg.content
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const label = seg.lang ? '<span class="code-lang">' + seg.lang + '</span>' : '';
        return '<div class="md-code-block">' + label + '<pre><code>' + escaped + '</code></pre></div>';
      }
      return renderProse(seg.content);
    }).join('');

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  get selectedLabel(): string {
    if (this.selectedDocIds.size === 0) return 'All documents';
    if (this.selectedDocIds.size === 1) {
      const d = this.docs.find(d => this.selectedDocIds.has(d.id));
      return d ? d.filename : '1 document';
    }
    return `${this.selectedDocIds.size} documents`;
  }

  icoClass(type: string): string {
    const m: Record<string, string> = { pdf: 'ico-pdf', excel: 'ico-xl', csv: 'ico-csv', word: 'ico-doc' };
    return m[type] || 'ico-file';
  }

  icoTxt(type: string): string {
    const m: Record<string, string> = { pdf: 'PDF', excel: 'XLS', csv: 'CSV', word: 'DOC' };
    return m[type] || 'FILE';
  }

  autoResize(event: Event) {
    const el = event.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }
}

