import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Chart, registerables } from 'chart.js';
import { take } from 'rxjs/operators';
Chart.register(...registerables);

const API = 'http://localhost:7979';
const PALETTE = ['#6366f1','#06b6d4','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16'];

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, DatePipe, CurrencyPipe, RouterModule],
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.scss'],
})
export class AnalyticsComponent implements OnInit, OnDestroy {

  // KPI tiles
  totalTxns    = 0;
  totalSpend   = 0;
  totalIncome  = 0;
  netBalance   = 0;

  // Chart data
  monthlyLabels:   string[] = [];
  monthlySpend:    number[] = [];
  monthlyIncome:   number[] = [];
  topMerchants:    { label: string; amount: number }[] = [];
  byDoc:           { label: string; amount: number }[] = [];

  // Paginated transactions
  txns:        any[] = [];
  txnTotal     = 0;
  txnPage      = 0;
  txnPageSize  = 15;
  txnLoading   = false;

  // Research chart from sessionStorage
  researchChart:    any    = null;
  researchQuestion  = '';
  researchSources:  string[] = [];
  activeChartType   = 'bar';

  // Session-specific view
  isSessionView = false;
  researchKpis: { total: number; avg: number; max: number; maxLabel: string; count: number } = { total: 0, avg: 0, max: 0, maxLabel: '', count: 0 };
  researchTableRows:  { label: string; value: number }[] = [];
  researchTopItems:   { label: string; value: number }[] = [];
  researchGroupLabel = 'Category';

  loading = true;
  error   = '';

  private _charts: Chart[] = [];

  readonly chartTypes = [
    { key: 'bar',           label: 'Bar',       icon: '▊' },
    { key: 'pie',           label: 'Pie',        icon: '◕' },
    { key: 'line',          label: 'Line',       icon: '📈' },
    { key: 'horizontalBar', label: 'Horizontal', icon: '▬' },
  ];

  constructor(private http: HttpClient, private zone: NgZone, private cdr: ChangeDetectorRef, public router: Router, private route: ActivatedRoute, private sanitizer: DomSanitizer) {}

  private _loadChartPayload(raw: string | null) {
    if (!raw) return;
    try {
      const p = JSON.parse(raw);
      this.researchChart    = p.chartData;
      this.researchQuestion = p.question || '';
      this.researchSources  = p.sources  || [];
      this.activeChartType  = this.researchChart?.type || 'bar';
    } catch {}
  }

  ngOnInit() {
    const routeSessionId = this.route.snapshot.paramMap.get('id');

    // Only load latest chart from sessionStorage when NOT navigating to a specific session
    if (!routeSessionId) {
      this._loadChartPayload(
        sessionStorage.getItem('research_chart_latest') ||
        sessionStorage.getItem('research_chart')
      );
    }

    if (routeSessionId) {
      // Session-specific view — only load research history, skip financial charts
      this._fetchSessionById(routeSessionId).then(() => {
        this.loading = false;
        this.cdr.detectChanges();
        this.zone.onStable.pipe(take(1)).subscribe(() => this._renderAllCharts());
      });
    } else {
      Promise.all([
        this._fetchFinancial(),
        this._fetchHistory(),
        this._fetchTxns(0),
      ]).then(() => {
        this.loading = false;
        this.cdr.detectChanges();
        this.zone.onStable.pipe(take(1)).subscribe(() => this._renderAllCharts());
      });
    }
  }

  private _fetchSessionById(id: string): Promise<void> {
    this.isSessionView = true;
    return new Promise(resolve => {
      this.http.get<any>(`${API}/api/research/session/${id}`).subscribe({
        next: s => {
          // Build all turns: root first, then follow-ups
          const children: any[] = s.thread || [];
          const allTurns = [
            { question: s.question, answer: s.answer, sources: s.sources || [], chart_data: s.chart_data },
            ...children.map((c: any) => ({ question: c.question, answer: c.answer, sources: c.sources || [], chart_data: c.chartData })),
          ];
          // Use the last turn that has a chart; fall back to root
          const withChart = [...allTurns].reverse().find(t => t.chart_data);
          const last = allTurns[allTurns.length - 1];
          const chosen = withChart || last;
          if (chosen?.chart_data) {
            this.researchChart    = chosen.chart_data;
            this.researchQuestion = chosen.question;
            this.researchSources  = chosen.sources || [];
            this.activeChartType  = chosen.chart_data.type || 'bar';
            this._buildResearchDerivedData();
          }
          resolve();
        },
        error: () => {
          // Fallback: search history list
          this.http.get<any>(`${API}/api/research/history?limit=100`).subscribe({
            next: d => {
              const s = (d.items || []).find((i: any) => i.id === id);
              if (s?.chart_data) {
                this.researchChart    = s.chart_data;
                this.researchQuestion = s.question;
                this.researchSources  = s.sources || [];
                this.activeChartType  = s.chart_data.type || 'bar';
                this._buildResearchDerivedData();
              }
              resolve();
            },
            error: () => resolve(),
          });
        },
      });
    });
  }

  private _buildResearchDerivedData() {
    const chart = this.researchChart;
    if (!chart?.labels?.length || !chart?.datasets?.[0]?.data?.length) return;
    const labels: string[]  = chart.labels;
    const values: number[]  = chart.datasets[0].data.map((v: any) => Number(v) || 0);
    const metric: string    = chart.datasets[0].label || 'Value';
    this.researchGroupLabel = chart._group_col || metric;

    const total   = values.reduce((a, b) => a + b, 0);
    const avg     = total / values.length;
    const maxVal  = Math.max(...values);
    const maxIdx  = values.indexOf(maxVal);

    this.researchKpis = { total, avg, max: maxVal, maxLabel: labels[maxIdx] || '', count: labels.length };

    const paired = labels.map((l, i) => ({ label: l, value: values[i] }));
    this.researchTableRows = [...paired].sort((a, b) => b.value - a.value);
    this.researchTopItems  = this.researchTableRows.slice(0, 10);
  }

  fmtNum(n: number): string {
    if (Math.abs(n) >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private _fetchFinancial(): Promise<void> {
    return new Promise(resolve => {
      this.http.get<any>(`${API}/api/analytics/financial`).subscribe({
        next: d => {
          this.error = '';
          this.totalTxns   = d.kpis?.total_transactions || 0;
          this.totalSpend  = d.kpis?.total_spend  || 0;
          this.totalIncome = d.kpis?.total_income || 0;
          this.netBalance  = d.kpis?.net          || 0;
          this.monthlyLabels  = (d.monthly?.labels || []).map((m: string) => {
            const [y, mo] = m.split('-');
            return new Date(+y, +mo - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
          });
          this.monthlySpend  = d.monthly?.spend  || [];
          this.monthlyIncome = d.monthly?.income || [];
          this.topMerchants  = d.top_merchants   || [];
          this.byDoc         = d.by_doc          || [];
          resolve();
        },
        error: (err) => {
          console.error('[analytics/financial]', err?.status, err?.message, err);
          this.error = `Could not load financial data (${err?.status || 'network error'})`;
          resolve();
        },
      });
    });
  }

  retry() {
    this.loading = true;
    this.error   = '';
    this.cdr.detectChanges();
    Promise.all([
      this._fetchFinancial(),
      this._fetchHistory(),
      this._fetchTxns(0),
    ]).then(() => {
      this.loading = false;
      this.cdr.detectChanges();
      this.zone.onStable.pipe(take(1)).subscribe(() => this._renderAllCharts());
    });
  }

  _fetchTxns(page: number): Promise<void> {
    this.txnLoading = true;
    this.cdr.markForCheck();
    return new Promise(resolve => {
      const offset = page * this.txnPageSize;
      this.http.get<any>(`${API}/api/analytics/transactions?limit=${this.txnPageSize}&offset=${offset}`).subscribe({
        next: d => {
          this.txns      = d.items || [];
          this.txnTotal  = d.total || 0;
          this.txnPage   = page;
          this.txnLoading = false;
          this.cdr.markForCheck();
          resolve();
        },
        error: () => { this.txnLoading = false; resolve(); },
      });
    });
  }

  get txnTotalPages(): number { return Math.ceil(this.txnTotal / this.txnPageSize); }
  get txnPageEnd(): number { return Math.min((this.txnPage + 1) * this.txnPageSize, this.txnTotal); }

  txnGoTo(page: number) {
    if (page < 0 || page >= this.txnTotalPages || this.txnLoading) return;
    this._fetchTxns(page);
  }

  recentQuestions: { id: string; question: string; ts: string; answer: string; sources: string[]; chartData?: any; matchedDocIds?: string[] }[] = [];
  selectedSession: { id: string; question: string; ts: string; answer: string; sources: string[]; chartData?: any; matchedDocIds?: string[] } | null = null;
  totalQueries = 0;

  private _fetchHistory(): Promise<void> {
    return new Promise(resolve => {
      this.http.get<any>(`${API}/api/research/history?limit=100`).subscribe({
        next: d => {
          const items: any[] = d.items || [];
          this.totalQueries = d.total || items.length;
          this.recentQuestions = items.slice(0, 6).map(s => ({
            id:              s.id || '',
            question:        s.question,
            ts:              s.ts,
            answer:          s.answer || '',
            sources:         s.sources || [],
            chartData:       s.chart_data || null,
            matchedDocIds:   s.matched_doc_ids || [],
          }));
          resolve();
        },
        error: () => resolve(),
      });
    });
  }

  fmt(n: number): string {
    return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  private _renderAllCharts() {
    this.zone.runOutsideAngular(() => {
      if (!this.isSessionView) this._renderMonthly();
      this._renderMerchants();
      this._renderByDoc();
      if (this.researchChart) this._renderResearchChart();
    });
  }

  private _destroyCanvas(id: string) {
    const canvas = document.getElementById(id) as HTMLCanvasElement;
    if (canvas) Chart.getChart(canvas)?.destroy();
    return canvas;
  }

  private _renderMonthly() {
    const canvas = this._destroyCanvas('monthly-canvas');
    if (!canvas || !this.monthlyLabels.length) return;
    const c = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: this.monthlyLabels,
        datasets: [
          {
            label: 'Spend',
            data: this.monthlySpend,
            backgroundColor: '#ef444499',
            borderColor: '#ef4444',
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: 'Income',
            data: this.monthlyIncome,
            backgroundColor: '#10b98199',
            borderColor: '#10b981',
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 10, font: { size: 11 } } } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f1f5f9' },
               ticks: { callback: (v: any) => '$' + Number(v).toLocaleString() } },
          x: { grid: { display: false } },
        },
      },
    });
    this._charts.push(c);
  }

  private _renderMerchants() {
    const canvas = this._destroyCanvas('merchant-canvas');
    const items  = this.isSessionView ? this.researchTopItems.map(r => ({ label: r.label, amount: r.value })) : this.topMerchants;
    if (!canvas || !items.length) return;
    const labels = items.map(m => m.label);
    const data   = items.map(m => m.amount);
    const c = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Amount ($)',
          data,
          backgroundColor: PALETTE.map(p => p + 'bb'),
          borderColor: PALETTE,
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, grid: { color: '#f1f5f9' },
               ticks: { callback: (v: any) => '$' + Number(v).toLocaleString() } },
          y: { grid: { display: false }, ticks: { font: { size: 11 } } },
        },
      },
    });
    this._charts.push(c);
  }

  private _renderByDoc() {
    const canvas = this._destroyCanvas('doc-canvas');
    const items  = this.isSessionView ? this.researchTableRows.map(r => ({ label: r.label, amount: r.value })) : this.byDoc;
    if (!canvas || !items.length) return;
    const labels = items.map(d => d.label);
    const data   = items.map(d => d.amount);
    const c = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: PALETTE.slice(0, labels.length),
          borderWidth: 2,
          borderColor: '#fff',
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        cutout: '65%',
        plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 9, font: { size: 10.5 } } } },
      },
    });
    this._charts.push(c);
  }

  switchType(type: string) {
    this.activeChartType = type;
    this.cdr.detectChanges();
    this.zone.onStable.pipe(take(1)).subscribe(() => {
      this.zone.runOutsideAngular(() => this._renderResearchChart());
    });
  }

  private _renderResearchChart() {
    const canvas = this._destroyCanvas('research-chart-canvas');
    if (!canvas || !this.researchChart) return;
    const data = this.researchChart;
    let type: any = this.activeChartType;
    const opts: any = { responsive: true, maintainAspectRatio: false, animation: false };
    if (type === 'horizontalBar') { type = 'bar'; opts.indexAxis = 'y'; }
    if (type === 'pie' || type === 'doughnut') {
      opts.plugins = { legend: { display: true, position: 'bottom' } };
    } else {
      opts.scales  = { y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { callback: (v: any) => '$' + Number(v).toLocaleString() } }, x: { grid: { display: false } } };
      opts.plugins = { legend: { display: data.datasets?.length > 1 } };
    }
    try {
      const c = new Chart(canvas, { type, data: { labels: data.labels, datasets: data.datasets }, options: opts });
      this._charts.push(c);
    } catch(e) { console.error('[research chart]', e); }
  }

  sessionKey(q: { id: string; question: string; ts: string }): string {
    return q.id || (q.question + '|' + q.ts);
  }

  viewSession(q: { id: string; question: string; ts: string; answer: string; sources: string[]; chartData?: any; matchedDocIds?: string[] }) {
    const key = this.sessionKey(q);
    if (this.selectedSession && this.sessionKey(this.selectedSession) === key) {
      // Closing — restore latest chart from sessionStorage
      this.selectedSession = null;
      this._loadChartPayload(
        sessionStorage.getItem('research_chart_latest') ||
        sessionStorage.getItem('research_chart')
      );
      this.zone.onStable.pipe(take(1)).subscribe(() => {
        this.zone.runOutsideAngular(() => this._renderResearchChart());
      });
    } else {
      this.selectedSession = q;
      // 1. Try chart from DB (history response) — source of truth
      if (q.chartData) {
        this.researchChart    = q.chartData;
        this.researchQuestion = q.question;
        this.researchSources  = q.sources || [];
        this.activeChartType  = q.chartData.type || 'bar';
      } else {
        // 2. Fallback: sessionStorage (in-memory for current browser session)
        const cached = q.id ? sessionStorage.getItem(`research_chart_${q.id}`) : null;
        if (cached) this._loadChartPayload(cached);
      }
      this.cdr.detectChanges();
      this.zone.onStable.pipe(take(1)).subscribe(() => {
        this.zone.runOutsideAngular(() => this._renderResearchChart());
      });
    }
  }

  closeSession() { this.selectedSession = null; }

  deleteSession(q: { id: string; question: string; ts: string; answer: string; sources: string[] }) {
    if (!q.id) return;
    this.http.delete(`${API}/api/research/history/${q.id}`).subscribe({
      next: () => {
        this.recentQuestions = this.recentQuestions.filter(s => s.id !== q.id);
        if (this.selectedSession?.id === q.id) this.selectedSession = null;
        this.totalQueries = Math.max(0, this.totalQueries - 1);
        this.cdr.detectChanges();
      },
      error: err => console.error('[deleteSession]', err),
    });
  }

  dismissChart() {
    sessionStorage.removeItem('research_chart_latest');
    sessionStorage.removeItem('research_chart'); // legacy key
    this.researchChart = null;
    this.selectedSession = null;
    this.cdr.detectChanges();
  }

  md(text: string): SafeHtml {
    if (!text) return this.sanitizer.bypassSecurityTrustHtml('');
    let t = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
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
    return this.sanitizer.bypassSecurityTrustHtml('<p>' + t + '</p>');
  }

  ngOnDestroy() { this._charts.forEach(c => c.destroy()); }
}
