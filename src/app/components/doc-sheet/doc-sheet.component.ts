import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ChangeDetectorRef, NgZone } from '@angular/core';
import { authFetch } from '../../lib/api';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { RouterModule } from '@angular/router';
import { ExcelVisualizerComponent } from '../excel-visualizer/excel-visualizer.component';

@Component({
  selector: 'app-doc-sheet',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ExcelVisualizerComponent],
  templateUrl: './doc-sheet.component.html',
  styleUrls: ['./doc-sheet.component.scss']
})
export class DocSheetComponent implements OnChanges {
  @Input() doc: any = null;
  @Input() initialTab: string = 'summary';
  @Output() closed = new EventEmitter<void>();

  activeTab = 'summary';
  isMaximized = false;
  msgs: { role: 'user' | 'ai'; text: string }[] = [];
  chatInput = '';
  chatLoading = false;
  historyLoaded = false;

  fullDoc: any = null;
  loadingDoc = false;

  // Summary
  summary = '';
  summaryExpanded = false;
  summaryLoaded = false;
  summaryLoading = false;

  // Key Points
  keyPoints: string[] = [];
  kpExpanded = false;
  kpLoaded = false;
  kpLoading = false;

  // Insights
  insights: { label: string; value: string; sub: string }[] = [];
  insightsExpanded = false;
  insightsLoaded = false;
  insightsLoading = false;

  // Alert banner
  alertCount = 0;
  alertSummary = '';
  showPreview = false;
  topAlerts: any[] = [];

  // Generate More state
  generatingSummary  = false;
  generatingKP       = false;
  generatingInsights = false;
  genSummaryCount    = 0;
  genKPCount         = 0;
  genInsightsCount   = 0;
  insightsOffset     = 0;
  kpOffset           = 0;

  // Analytics
  analyticsLoaded  = false;
  analyticsLoading = false;
  heroMetrics: { label: string; value: string; icon: string }[] = [];
  analyticsCharts: { title: string; rows: { label: string; value: string; pct: number }[] }[] = [];

  tabs = [
    { id: 'summary',    label: '📝 Summary'       },
    { id: 'keypoints',  label: '✦ Key Points'     },
    { id: 'insights',   label: '💡 Insights'      },
    { id: 'analytics',  label: '📈 Analytics'     },
    { id: 'datacharts', label: '📊 Data & Charts' },
    { id: 'askai',      label: '💬 Ask AI'        },
    { id: 'details',    label: 'ℹ Details'        },
  ];

  constructor(private api: ApiService, private router: Router, private cdr: ChangeDetectorRef, private zone: NgZone) {}

  // ── Lifecycle ────────────────────────────────────────────────────────────
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['doc'] && this.doc) {
      this._reset();
      if (this.initialTab) { this.activeTab = this.initialTab; }
      this.msgs = [{
        role: 'ai',
        text: `I have <strong>${this.doc.filename}</strong> in full context. Ask me anything.`
      }];
      this._populate(this.doc);
      if (this.activeTab === 'askai') { this.loadQaHistory(); }

      this.loadingDoc = true;
      this.api.getDocument(this.doc.id).subscribe({
        next: (d: any) => {
          this.fullDoc = d;
          this.loadingDoc = false;
          this._populate(d);
          this.loadInsights();   // ✅ load alert banner eagerly on doc open
        },
        error: () => {
          this.fullDoc = this.doc;
          this.loadingDoc = false;
          this.loadInsights();   // ✅ also load on error fallback
        }
      });
    }
  }

  // ── Data population ──────────────────────────────────────────────────────
  private _populate(d: any): void {
    if (!d) return;

    if (!this.summaryLoaded && d.summary) {
      this.summary = d.summary;
      this.summaryLoaded = true;
    }

    if (!this.kpLoaded) {
      const parsed = this._parseKP(d.key_points || d.key_points_list);
      if (parsed.length) { this.keyPoints = parsed; this.kpLoaded = true; }
    }

    if (!this.insightsLoaded) {
      const raw: any[] = d.insights || [];
      if (raw.length) {
        this.insights = raw.map((ins: any) => {
          const desc  = String(ins.description || ins.sub || '');
          const title = String(ins.title || ins.label || ins.category || 'Insight');
          const amt   = (desc.match(/\$[\d,]+(?:\.\d+)?/) || [])[0] || '';
          return { label: title, value: amt, sub: desc };
        });
        this.insightsLoaded = true;
      }
    }
  }

  get d(): any { return this.fullDoc || this.doc || {}; }

  // ── Tab switching ────────────────────────────────────────────────────────
  switchTab(id: string): void {
    this.activeTab = id;
    if (id === 'summary'   && !this.summaryLoaded   && !this.summaryLoading)   this.loadSummary();
    if (id === 'keypoints' && !this.kpLoaded        && !this.kpLoading)        this.loadKeyPoints();
    if (id === 'insights'  && !this.insightsLoaded  && !this.insightsLoading)  this.loadInsights();
    if (id === 'analytics' && !this.analyticsLoaded && !this.analyticsLoading) this.loadAnalytics();
    if (id === 'askai'     && !this.historyLoaded)                             this.loadQaHistory();
  }

  private loadQaHistory(): void {
    if (!this.doc?.id) return;
    this.api.getDocumentQaHistory(this.doc.id).subscribe({
      next: (res: any) => {
        const history: any[] = res?.history || [];
        if (history.length) {
          const histMsgs = history.flatMap((h: any) => [
            { role: 'user' as const, text: h.question },
            { role: 'ai'   as const, text: h.answer   },
          ]);
          // Replace greeting with history, keep greeting at top
          this.msgs = [this.msgs[0], ...histMsgs];
        }
        this.historyLoaded = true;
      },
      error: () => { this.historyLoaded = true; }
    });
  }

  scrollToInsightsTab(): void {
    this.activeTab = 'insights';
    this.showPreview = false;
  }

  // ── Data loaders ─────────────────────────────────────────────────────────
  loadSummary(): void {
    if (this.summaryLoading || !this.d.id) return;
    this.summaryLoading = true;
    this.api.deepSummary(this.d.id).subscribe({
      next: (res: any) => {
        const raw = res.summary || res.result || '';
        this.summary = raw.replace(/\.{2,}$/, '').replace(/…$/, '').trim();
        this.summaryLoaded = true; this.summaryLoading = false;
      },
      error: () => { this.summaryLoaded = true; this.summaryLoading = false; }
    });
  }

  loadKeyPoints(): void {
    if (this.kpLoading || !this.d.id) return;
    this.kpLoading = true;
    this.api.deepKeyPoints(this.d.id).subscribe({
      next: (res: any) => {
        this.keyPoints = this._parseKP(res.key_points || res.result || []);
        this.kpLoaded = true; this.kpLoading = false;
      },
      error: () => { this.kpLoaded = true; this.kpLoading = false; }
    });
  }

  loadInsights(): void {
    if (this.insightsLoading || !this.d?.id) return;
    this.insightsLoading = true;

    this.api.getDocumentInsights(this.d.id).subscribe({
      next: (res: any) => {
        const raw: any[] = res.insights || res.items || res.result || [];
        console.log('🔍 insights debug:', raw.length, 'items, first:', JSON.stringify(raw[0]));


        if (Array.isArray(raw) && raw.length) {
          // Insights tab display
          this.insights = raw.map((ins: any) => {
            const desc  = String(ins.description || ins.detail || ins.sub || '');
            const title = String(ins.title || ins.label || ins.category || 'Insight');
            const amt   = (desc.match(/\$[\d,]+(?:\.\d+)?/) || [])[0] || '';
            return { label: title, value: amt, sub: desc };
          });

          // Alert banner
          const criticals = raw.filter((i: any) => i.severity === 'critical');
          const warnings  = raw.filter((i: any) => i.severity === 'warning');
          this.alertCount  = criticals.length + warnings.length;
          this.topAlerts   = [...criticals, ...warnings].slice(0, 3);

          const parts: string[] = [];
          if (criticals.length) parts.push(criticals[0].title);
          if (warnings.length && warnings[0].title !== criticals[0]?.title)
            parts.push(warnings[0].title);
          this.alertSummary = parts.join(', ') || 'Review recommended';
        } else {
          this.alertCount   = 0;
          this.alertSummary = '';
          this.topAlerts    = [];
        }

        this.insightsLoaded = true;
        this.insightsLoading = false;
      },
      error: () => {
        this.insightsLoaded  = true;
        this.insightsLoading = false;
      }
    });
  }

  loadAnalytics(): void {
    if (this.analyticsLoading || !this.d.id) return;
    this.analyticsLoading = true;

    this.api.getAdvancedAnalytics(this.d.id).subscribe({
      next: (res: any) => {
        try {
        const data     = res.analyzed_data || res;
        const uiConfig = data.ui_config || {};

        const rawHero: any[] = (uiConfig.hero_metrics || []).filter((m: any) => m.is_hero !== false);
        this.heroMetrics = rawHero.slice(0, 6).map((m: any) => {
          const val = this._resolvePath(m.value_path || m.key, data);
          return { label: m.label || m.key, value: this._fmtVal(val, m.format), icon: m.icon || 'analytics' };
        }).filter(m => m.value !== '—');

        this.analyticsCharts = [];
        const charts: any[] = (uiConfig.charts || []).filter((c: any) => c.type !== 'progress');

        for (const chart of charts.slice(0, 3)) {
          let raw: any[] = chart.data || this._resolvePath(chart.data_path, data) || [];
          if (!Array.isArray(raw) && typeof raw === 'object') {
            raw = Object.entries(raw).map(([k, v]) => ({ label: k, value: v }));
          }
          if (!Array.isArray(raw) || !raw.length) continue;

          const first  = raw[0];
          const keys   = Object.keys(first);
          const xField = chart.label_field || chart.x_field || chart.x_key ||
            keys.find((k: string) => ['label','category','name','key','description'].includes(k.toLowerCase())) || keys[0];
          const yField = chart.value_field || chart.y_field || chart.y_key ||
            keys.find((k: string) => ['total','value','amount','count','y'].includes(k.toLowerCase())) || keys[1];

          if (!xField || !yField || !(xField in first) || !(yField in first)) continue;

          const nums = raw.map(r => this._n(r[yField]));
          const max  = Math.max(...nums, 1);
          const rows = raw.slice(0, 8).map((r: any, i: number) => ({
            label: String(r[xField] ?? '').substring(0, 35),
            value: this._fmtVal(r[yField], chart.format),
            pct:   Math.max(Math.round(nums[i] / max * 100), 3)
          }));

          this.analyticsCharts.push({ title: chart.title, rows });
        }

        } catch (e: any) {
          console.error('[doc-sheet analytics] render error:', e);
        }
        this.analyticsLoaded  = true;
        this.analyticsLoading = false;
      },
      error: (err: any) => {
        console.error('[doc-sheet analytics] API error:', err?.status, err);
        this.analyticsCharts  = [{ title: this.analyticsTitle, rows: this._fallbackRows() }];
        this.analyticsLoaded  = true;
        this.analyticsLoading = false;
      }
    });
  }

  // ── Generate More ────────────────────────────────────────────────────────
  generateMoreSummary(): void {
    if (this.generatingSummary || !this.d.id) return;
    this.generatingSummary = true;
    this.genSummaryCount++;
    this.api.deepSummary(this.d.id).subscribe({
      next: (res: any) => {
        const newText = res.summary || res.result || '';
        if (newText) this.summary = this.summary + '\n\n' + newText;
        this.generatingSummary = false;
      },
      error: () => { this.generatingSummary = false; }
    });
  }

  generateMoreKeyPoints(): void {
    if (this.generatingKP || !this.d.id) return;
    this.generatingKP = true;
    this.genKPCount++;
    this.kpOffset = this.keyPoints.length;
    this.api.deepKeyPoints(this.d.id, this.kpOffset, 5).subscribe({
      next: (res: any) => {
        const newKPs = this._parseKP(res.key_points || res.items || res.result || []);
        const existing = new Set(this.keyPoints);
        const fresh = newKPs.filter((k: string) => !existing.has(k));
        if (fresh.length) { this.keyPoints = [...this.keyPoints, ...fresh]; this.kpExpanded = true; }
        this.generatingKP = false;
      },
      error: () => { this.generatingKP = false; }
    });
  }

  generateMoreInsights(): void {
    if (this.generatingInsights || !this.d.id) return;
    this.generatingInsights = true;
    this.genInsightsCount++;
    this.insightsOffset = this.insights.length;
    this.api.deepInsights(this.d.id, this.insightsOffset, 3).subscribe({
      next: (res: any) => {
        const raw: any[] = res.insights || res.items || res.result || [];
        if (Array.isArray(raw) && raw.length) {
          const newIns = raw.map((ins: any) => {
            const desc = String(ins.description || ins.sub || '');
            const amt  = (desc.match(/\$[\d,]+(?:\.\d+)?/) || [])[0] || '';
            return { label: String(ins.title || ins.category || 'Insight'), value: amt, sub: desc };
          });
          const existingLabels = new Set(this.insights.map(i => i.label + i.sub));
          const fresh = newIns.filter((i: any) => !existingLabels.has(i.label + i.sub));
          if (fresh.length) { this.insights = [...this.insights, ...fresh]; this.insightsExpanded = true; }
        }
        this.generatingInsights = false;
      },
      error: () => { this.generatingInsights = false; }
    });
  }

  // ── Severity icon helper ─────────────────────────────────────────────────
  severityIcon(s: string): string {
    return ({ critical: '🔴', warning: '🟡', info: '🔵', positive: '🟢' } as any)[s] ?? '⚪';
  }

  // ── Ask AI — SSE streaming ───────────────────────────────────────────────
  sendChat(): void {
    const q = this.chatInput.trim();
    if (!q) return;
    this.chatInput = '';
    this.msgs.push({ role: 'user', text: q });
    this.chatLoading = true;

    const aiIdx = this.msgs.length;
    this.msgs.push({ role: 'ai', text: '' });

    authFetch(`http://localhost:8000/api/documents/${this.d.id}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q })
    }).then(res => {
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const pump = (): Promise<void> =>
        reader.read().then(({ done, value }) => {
          if (done) { this.chatLoading = false; return; }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(String.fromCharCode(10));
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const payload = JSON.parse(line.slice(6));
              if (payload.token) {
                this.msgs[aiIdx] = { role: 'ai', text: this.msgs[aiIdx].text + payload.token };
                this.zone.run(() => this.cdr.markForCheck());
              }
              if (payload.done)  { this.chatLoading = false; this.zone.run(() => this.cdr.markForCheck()); }
              if (payload.error) { this.msgs[aiIdx] = { role: 'ai', text: '⚠ ' + payload.error }; this.chatLoading = false; this.zone.run(() => this.cdr.markForCheck()); }
            } catch { /* skip malformed */ }
          }
          return pump();
        });
      return pump();
    }).catch(() => {
      this.msgs[aiIdx] = { role: 'ai', text: '⚠ Unable to reach phi3:mini — check the backend is running.' };
      this.chatLoading = false;
    });
  }

  onKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendChat(); }
  }

  // ── Spreadsheet / table helpers ──────────────────────────────────────────
  isSpreadsheet(): boolean {
    const d = this.fullDoc || this.doc;
    if (!d) return false;
    const types = ['spreadsheet','sales_report','csv','excel','data','report'];
    const ext   = (d.filename || '').toLowerCase();
    const caps  = (d.doc_metadata || d.metadata || {}).capabilities || {};
    return types.includes(d.doc_type) || ext.endsWith('.xlsx') || ext.endsWith('.csv') || ext.endsWith('.xls') || caps.supports_visualization === true;
  }

  getTableData(): any {
    const d = this.fullDoc || this.doc;
    if (!d) return null;
    const meta = d.metadata || d.doc_metadata || {};

    const tables = meta.tables || [];
    if (tables.length > 0 && tables[0].columns && tables[0].data)
      return { columns: tables[0].columns, data: tables[0].data };

    const a = meta.analytics || {};
    if (a.column_names?.length > 0)
      return { columns: a.column_names, data: a.sample_rows || a.data_rows || [] };

    if (d.column_names?.length > 0)
      return { columns: d.column_names, data: d.sample_rows || d.data_rows || [] };

    const ad = meta.analyzed_data || {};
    const breakdowns = ['region_breakdown','product_breakdown','salesperson_breakdown','storelocation_breakdown','customertype_breakdown'];
    for (const key of breakdowns) {
      const bd = ad[key];
      if (bd?.top_5?.length) return { columns: Object.keys(bd.top_5[0]), data: bd.top_5 };
    }

    if (d.raw_text && (d.filename?.endsWith('.csv') || d.filename?.endsWith('.xlsx') || d.filename?.endsWith('.xls'))) {
      const lines = d.raw_text.split(String.fromCharCode(10)).filter((l: string) => l.includes('|'));
      const headerLine = lines.find((l: string) => !l.toLowerCase().includes('sheet') && !l.toLowerCase().includes('excel'));
      if (headerLine) {
        const columns   = headerLine.split('|').map((c: string) => c.trim()).filter(Boolean);
        const dataLines = lines.slice(lines.indexOf(headerLine) + 1, lines.indexOf(headerLine) + 51);
        const data = dataLines.map((line: string) => {
          const vals = line.split('|').map((v: string) => v.trim());
          const row: any = {};
          columns.forEach((col: string, i: number) => row[col] = vals[i] ?? '');
          return row;
        });
        if (data.length) return { columns, data };
      }
    }
    return null;
  }

  hasTableData(): boolean { return this.getTableData() !== null; }

  // ── Navigation ───────────────────────────────────────────────────────────
  openFullAnalytics(): void { this.closed.emit(); this.router.navigate(['/analytics', this.d.id, 'advanced']); }
  close(): void { this.closed.emit(); }

  toggleMaximize(): void { this.isMaximized = !this.isMaximized; }

  // ── Icon helpers ─────────────────────────────────────────────────────────
  get icoClass(): string {
    const m: Record<string, string> = {
      bank_statement: 'bank', tax_document: 'tax',
      payoff_statement: 'pdf', invoice: 'inv',
      credit_card_statement: 'cc', loan_estimate: 'pdf'
    };
    return m[this.d.doc_type] || 'doc';
  }

  get icoTxt(): string {
    const m: Record<string, string> = {
      bank_statement: 'BNK', tax_document: 'TAX',
      payoff_statement: 'PDF', invoice: 'INV',
      credit_card_statement: 'CC', loan_estimate: 'LOAN'
    };
    return m[this.d.doc_type] || 'DOC';
  }

  get analyticsTitle(): string {
    const m: Record<string, string> = {
      bank_statement: 'Transaction Summary', tax_document: 'Income Breakdown',
      payoff_statement: 'Payoff Breakdown',  invoice: 'Invoice Breakdown',
      credit_card_statement: 'Spending Breakdown', loan_estimate: 'Loan Breakdown',
    };
    return m[this.d.doc_type] || 'Document Analytics';
  }

  // ── Markdown renderer ────────────────────────────────────────────────────
  md(text: string): string {
    if (!text) return '';

    // Render markdown tables before escaping inline HTML
    const renderTable = (block: string): string => {
      const rows = block.trim().split('\n').filter(r => r.trim());
      if (rows.length < 2) return block;
      const header = rows[0].split('|').map(c => c.trim()).filter(c => c);
      // rows[1] is the separator (---|---), skip it
      const body = rows.slice(2).map(r => r.split('|').map(c => c.trim()).filter(c => c));
      const th = header.map(h => `<th>${h}</th>`).join('');
      const trs = body.map(cells => {
        const tds = cells.map(c => `<td>${c}</td>`).join('');
        return `<tr>${tds}</tr>`;
      }).join('');
      return `<div class="md-table-wrap"><table class="md-table"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div>`;
    };

    // Split on table blocks (lines starting with |), render them separately
    const parts = text.split(/((?:^\|.+\n?){2,})/m);
    const processed = parts.map((part, i) => {
      if (/^\|/.test(part.trim())) return renderTable(part);
      // Escape HTML then apply inline markdown
      return part
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
    });
    return processed.join('');
  }

  // ── Private utilities ────────────────────────────────────────────────────
  private _reset(): void {
    this.activeTab = 'summary';
    this.isMaximized = false;
    this.fullDoc = null;
    this.summary = ''; this.summaryExpanded = false; this.summaryLoaded = false; this.summaryLoading = false;
    this.keyPoints = []; this.kpExpanded = false; this.kpLoaded = false; this.kpLoading = false;
    this.insights = []; this.insightsExpanded = false; this.insightsLoaded = false; this.insightsLoading = false;
    this.heroMetrics = []; this.analyticsCharts = []; this.analyticsLoaded = false; this.analyticsLoading = false;
    this.generatingSummary = false; this.generatingKP = false; this.generatingInsights = false;
    this.genSummaryCount = 0; this.genKPCount = 0; this.genInsightsCount = 0;
    this.insightsOffset = 0; this.kpOffset = 0;
    this.alertCount = 0; this.alertSummary = ''; this.showPreview = false; this.topAlerts = [];
    this.historyLoaded = false;
  }

  // private _parseKP(kp: any): string[] {
  //   if (!kp) return [];
  //   if (typeof kp === 'string') {
  //     return kp.split('\n')
  //       .map((l: string) => l.replace(/^\d+[.)]\s*/, '').replace(/^[-*•]\s*/, '').trim())
  //       .filter((l: string) => l.length > 4);
  //   }
  //   return Array.isArray(kp)
  //     ? kp.filter(Boolean).map((k: any) => String(k).trim()).filter(s => s.length > 4)
  //     : [];
  // }

  // private _parseKP(kp: any): string[] {
  //   if (!kp) return [];
  
  //   // Case 1: backend returned a single string block
  //   if (typeof kp === 'string') {
  //     return kp.split('\n')
  //       .map(l => l.replace(/^\d+[.)]\s*/, '')      // remove "1." or "1)"
  //                  .replace(/^[-*•]\s*/, '')        // remove bullets
  //                  .trim())
  //       .filter(l => l.length > 4);
  //   }
  
  //   // Case 2: backend returned an array
  //   if (Array.isArray(kp)) {
  //     return kp
  //       .filter(Boolean)
  //       .map((item: any) => {
  //         // Structured object from backend
  //         if (typeof item === 'object') {
  //           const title = item.title || '';
  //           const desc = item.description || '';
  //           return desc ? `${title}: ${desc}` : title;
  //         }
  
  //         // Plain string
  //         if (typeof item === 'string') {
  //           return item.trim();
  //         }
  
  //         return '';
  //       })
  //       .filter(s => s.length > 4);
  //   }
  
  //   return [];
  // }


  private _parseKP(kp: any): string[] {
    if (!kp) return [];
  
    // --------------------------------------------------
    // CASE 1: Backend returned a single string block
    // --------------------------------------------------
    if (typeof kp === 'string') {
      return kp.split('\n')
        .map((l: string) =>
          l.replace(/^\d+[.)]\s*/, '')   // remove "1." or "1)"
           .replace(/^[-*•]\s*/, '')     // remove bullets
           .trim()
        )
        .filter((l: string) => l.length > 4);
    }
  
    // --------------------------------------------------
    // CASE 2: Backend returned an array of items
    // --------------------------------------------------
    if (Array.isArray(kp)) {
      return kp
        .filter(Boolean)
        .map((item: any) => this._normalizeKPItem(item))
        .filter((s: string) => s.length > 4);
    }
  
    return [];
  }

  
  private _normalizeKPItem(item: any): string {
    if (!item) return '';
  
    // --------------------------------------------------
    // CASE A: Plain string
    // --------------------------------------------------
    if (typeof item === 'string') {
      return item.trim();
    }
  
    // --------------------------------------------------
    // CASE B: Object with "title" + "description"
    // --------------------------------------------------
    if (item.title || item.description) {
      const title = item.title ? `**${item.title}**` : '';
      const desc = item.description || '';
  
      let out = title && desc ? `${title}: ${desc}` : (title || desc);
  
      // Handle details if present
      if (item.details && typeof item.details === 'object') {
        const detailKeys = Object.keys(item.details);
        detailKeys.forEach((dk: string) => {
          const dv = item.details[dk];
          if (Array.isArray(dv)) {
            out += `<br><u>${dk}:</u><br>• ${dv.join('<br>• ')}`;
          }
        });
      }
  
      return out;
    }
  
    // --------------------------------------------------
    // CASE C: Object with a single key (HOA style)
    // { "Main purpose": "..." }
    // --------------------------------------------------
    const keys = Object.keys(item);
    if (keys.length === 1) {
      const key = keys[0];
      const val = item[key];
  
      if (Array.isArray(val)) {
        return `**${key}:**<br>• ${val.join('<br>• ')}`;
      }
  
      return `**${key}:** ${val}`;
    }
  
    // --------------------------------------------------
    // CASE D: Fallback — stringify unknown shapes
    // --------------------------------------------------
    return JSON.stringify(item);
  }

  
  private _fallbackRows(): { label: string; value: string; pct: number }[] {
    const d = this.fullDoc || this.doc;
    if (!d) return [];
    const rows: { label: string; value: string; n: number }[] = [];
    const seen = new Set<string>();
    for (const ins of (d.insights || [])) {
      const label = String(ins.title || ins.category || 'Amount').substring(0, 40);
      const m = String(ins.description || '').match(/\$[\d,]+(?:\.\d+)?/);
      if (m && !seen.has(label)) { seen.add(label); rows.push({ label, value: m[0], n: this._n(m[0]) }); }
    }
    if (!rows.length) return [];
    const max = Math.max(...rows.map(r => r.n), 1);
    return rows.sort((a, b) => b.n - a.n).slice(0, 8)
      .map(r => ({ label: r.label, value: r.value, pct: Math.max(Math.round(r.n / max * 100), 4) }));
  }

  private _resolvePath(path: string | undefined, data: any): any {
    if (!path || !data) return null;
    return path.split('.').reduce((o: any, k: string) => o?.[k], data) ?? null;
  }

  private _fmtVal(v: any, format?: string): string {
    if (v === null || v === undefined) return '—';
    if (format === 'currency' || (typeof v === 'number' && v > 99))
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(v));
    if (format === 'percent') return `${Number(v).toFixed(1)}%`;
    if (format === 'number')  return Number(v).toLocaleString('en-US');
    return String(v);
  }

  private _n(v: any): number {
    return parseFloat(String(v ?? '').replace(/[$,\s]/g, '').replace(/[^0-9.-]/g, '')) || 0;
  }
}