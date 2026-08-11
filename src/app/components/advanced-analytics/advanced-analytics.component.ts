import { Component, OnInit, ViewChildren, QueryList, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';

// Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatTableModule } from '@angular/material/table';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';

// Chart.js
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';

// Services
import { ExportService } from '../../services/export.service';

Chart.register(...registerables);

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

interface HeroMetric {
  key: string;
  label: string;
  value_path?: string;
  value?: any;
  format?: string;
  icon?: string;
  color?: string;
  is_hero?: boolean;
}

interface ChartConfig {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  data_path: string;
  data?: any[];
  x_field?: string;
  y_field?: string;
  label_field?: string;
  value_field?: string;
  value_fields?: string[];
  format?: string;
  color?: string;
  color_scheme?: string;
  full_width?: boolean;
  height?: string;
  show_legend?: boolean;
  legend_position?: string;
}

interface TableConfig {
  id: string;
  name: string;
  title: string;
  data_path?: string;
  data?: any[];
  columns?: any[];
  show_export?: boolean;
  show_search?: boolean;
  page_size?: number;
  priority?: number;
}

interface SectionConfig {
  id: string;
  title: string;
  metrics?: string[];
  charts?: string[];
  tables?: string[];
  priority?: number;
}

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-advanced-analytics',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatListModule,
    MatTableModule,
    MatExpansionModule,
    MatTooltipModule,
    MatTabsModule,
    MatButtonToggleModule,
    MatMenuModule,
    MatDialogModule,
    MatDividerModule,
    MatInputModule,
    MatFormFieldModule,
    BaseChartDirective,
  ],
  templateUrl: './advanced-analytics.component.html',
  styleUrls: ['./advanced-analytics.component.scss']
})
export class AdvancedAnalyticsComponent implements OnInit {
  @ViewChildren(BaseChartDirective) charts!: QueryList<BaseChartDirective>;

  documentId = '';
  analyzedData: any = null;
  uiConfig: any = null;
  chartConfigs: { [key: string]: ChartConfiguration } = {};

  private _tables: any[] = [];
  private _charts: any[] = [];
  private _heroMetrics: any[] = [];
  private _secondaryMetrics: any[] = [];

  viewMode: 'combined' | 'charts' | 'tables' = 'combined';
  loading = true;
  error = '';

  // QA panel
  qaOpen      = false;
  chatInput   = '';
  chatLoading = false;
  msgs: ChatMessage[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private exportService: ExportService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.documentId = params['id'];
      this.fetchAnalytics();
    });
  }

  tryV2Dashboard(): void {
    this.router.navigate(['/documents', this.documentId, 'analytics', 'v2']);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QA PANEL
  // ═══════════════════════════════════════════════════════════════════════════

  toggleQA(): void {
    this.qaOpen = !this.qaOpen;
    if (this.qaOpen && this.msgs.length === 0) {
      this.msgs.push({
        role: 'ai',
        text: "👋 Hi! I've analyzed this document. Ask me anything about it.",
        timestamp: new Date()
      });
    }
  }

  sendChat(): void {
    const q = this.chatInput.trim();
    if (!q || this.chatLoading) return;
    this.chatInput = '';
    this.msgs.push({ role: 'user', text: q, timestamp: new Date() });
    this.chatLoading = true;
    const aiIdx = this.msgs.length;
    this.msgs.push({ role: 'ai', text: '', timestamp: new Date() });
    this.cdr.detectChanges();

    fetch(`http://localhost:8000/api/documents/${this.documentId}/ask`, {
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
          if (done) { this.chatLoading = false; this.cdr.detectChanges(); return; }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const payload = JSON.parse(line.slice(6));
              if (payload.token) {
                this.msgs[aiIdx] = { ...this.msgs[aiIdx], text: this.msgs[aiIdx].text + payload.token };
                this.cdr.detectChanges();
              }
              if (payload.done)  { this.chatLoading = false; this.cdr.detectChanges(); }
              if (payload.error) {
                this.msgs[aiIdx] = { role: 'ai', text: '⚠ ' + payload.error, timestamp: new Date() };
                this.chatLoading = false;
                this.cdr.detectChanges();
              }
            } catch { /* skip malformed SSE */ }
          }
          return pump();
        });
      return pump();
    }).catch(() => {
      this.msgs[aiIdx] = {
        role: 'ai',
        text: '⚠ Unable to reach AI — check the backend is running.',
        timestamp: new Date()
      };
      this.chatLoading = false;
      this.cdr.detectChanges();
    });
  }

  onChatKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendChat(); }
  }

  clearChat(): void {
    this.msgs = [{
      role: 'ai',
      text: '👋 Chat cleared. Ask me anything about this document.',
      timestamp: new Date()
    }];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FETCH
  // ═══════════════════════════════════════════════════════════════════════════

  fetchAnalytics(): void {
    this.loading = true;
    this.error = '';

    this.api.getAdvancedAnalytics(this.documentId).subscribe({
      next: res => {
        try {
          this.analyzedData = res.analyzed_data || {};

          // Single universal call — works for every document type
          this.normalizeAnalyticsData(this.analyzedData);
          this.uiConfig = this.analyzedData.ui_config;

          const ui = this.uiConfig;
          if (!ui.hero_metrics?.length && !ui.charts?.length && !ui.tables?.length) {
            this.error = 'This document type does not support advanced analytics.';
          }

          this.generateCharts();
          this._memoize();
        } catch (e: any) {
          console.error('[advanced-analytics] render error:', e);
          this.error = 'Failed to render analytics: ' + (e?.message || e);
        }
        this.loading = false;
      },
      error: err => {
        console.error('[advanced-analytics] API error:', err?.status, err?.error?.detail, err);
        this.error = err.error?.detail || `Failed to load analytics (${err?.status || 'network error'})`;
        this.loading = false;
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UNIVERSAL DATA NORMALIZER
  // Converts ANY backend response shape into one consistent internal format.
  // Supports: dataset, financial, insurance, tax, W2, and any future types.
  // To add a new document type: add one extractor method — nothing else changes.
  // ═══════════════════════════════════════════════════════════════════════════

  private normalizeAnalyticsData(ad: any): void {
    ad.ui_config = ad.ui_config || {};
    const ui = ad.ui_config;

    // ── HERO METRICS: try all known locations in priority order ──────────────
    ui.hero_metrics =
      this.extractMetrics_fromUiConfigDirect(ui)   ||  // ui_config.hero_metrics[]
      this.extractMetrics_fromSections(ui)         ||  // ui_config.sections[type=metrics]
      this.extractMetrics_fromFlatHeroMetrics(ad)  ||  // analyzed_data.hero_metrics[]
      this.extractMetrics_fromSegments(ad)         ||  // analyzed_data.segments (dataset)
      this.extractMetrics_fromKeyMetrics(ad)       ||  // analyzed_data.key_metrics{}
      this.extractMetrics_fromSummaryStats(ad)     ||  // analyzed_data.summary_stats{}
      [];

    // ── CHARTS: try all known locations in priority order ────────────────────
    ui.charts =
      this.extractCharts_fromUiConfigDirect(ui)    ||  // ui_config.charts[]
      this.extractCharts_fromSections(ui)          ||  // ui_config.sections[type=chart]
      this.extractCharts_fromFlat(ad)              ||  // analyzed_data.charts[]
      [];

    // ── TABLES: try all known locations in priority order ────────────────────
    ui.tables =
      this.extractTables_fromUiConfigDirect(ui)    ||  // ui_config.tables[]
      this.extractTables_fromSections(ui)          ||  // ui_config.sections[type=table]
      this.extractTables_fromFlat(ad)              ||  // analyzed_data.tables[]
      [];
  }

  // ── Hero Metric Extractors ─────────────────────────────────────────────────

  private extractMetrics_fromUiConfigDirect(ui: any): any[] | null {
    if (!ui.hero_metrics?.length) return null;
    return ui.hero_metrics.map((m: any) => this.normalizeMetric(m));
  }

  private extractMetrics_fromSections(ui: any): any[] | null {
    if (!ui.sections?.length) return null;
    const section = ui.sections.find((s: any) =>
      s.type === 'metrics' || s.id === 'hero' || s.id === 'summary' || s.id === 'kpi'
    );
    if (!section?.data?.length) return null;
    return section.data.map((m: any) => this.normalizeMetric(m));
  }

  private extractMetrics_fromFlatHeroMetrics(ad: any): any[] | null {
    if (!ad.hero_metrics?.length) return null;
    return ad.hero_metrics.map((m: any) => this.normalizeMetric(m));
  }

  private extractMetrics_fromSegments(ad: any): any[] | null {
    // Dataset-style: { segments: { metric: "Discount", segments: [{label, count, percentage}] } }
    const segs: any[] = ad.segments?.segments || [];
    if (!segs.length) return null;

    const total = segs.reduce((s: number, g: any) => s + (g.count || 0), 0);
    const metrics: any[] = [
      {
        label: 'Total Records',
        _value: total,
        icon: 'dataset',
        format: 'number',
        is_hero: true
      },
      {
        label: 'Segmented By',
        _value: ad.segments?.metric || '—',
        icon: 'tune',
        format: 'text',
        is_hero: true
      }
    ];

    segs.forEach((s: any) => {
      metrics.push({
        label:   s.label,
        _value:  `${(s.count || 0).toLocaleString()} rows`,
        icon:    (s.percentage || 0) >= 50 ? 'people' : 'person',
        format:  'text',
        badge:   `${s.percentage}%`,
        is_hero: true
      });
    });

    return metrics;
  }

  private extractMetrics_fromKeyMetrics(ad: any): any[] | null {
    const km = ad.key_metrics;
    if (!km || typeof km !== 'object' || Array.isArray(km)) return null;
    const entries = Object.entries(km);
    if (!entries.length) return null;
    return entries.map(([key, value]) => this.normalizeMetric({
      label: this.humanize(key),
      value,
      key,
      format: typeof value === 'number' && (value as number) > 100 ? 'currency' : 'number'
    }));
  }

  private extractMetrics_fromSummaryStats(ad: any): any[] | null {
    const ss = ad.summary_stats;
    if (!ss || typeof ss !== 'object' || Array.isArray(ss)) return null;
    const entries = Object.entries(ss);
    if (!entries.length) return null;
    return entries.map(([key, value]) => this.normalizeMetric({
      label: this.humanize(key),
      value,
      key,
      format: 'number'
    }));
  }

  private normalizeMetric(m: any): any {
    return {
      label:      m.label || this.humanize(m.key || m.name || 'Metric'),
      _value:     m._value ?? m.value ?? m.current ?? null,
      icon:       m.icon   || 'analytics',
      format:     m.format || 'text',
      is_hero:    m.is_hero !== false,
      status:     m.status || null,
      badge:      m.badge  || null,
      color:      m.color  || null,
      value_path: m.value_path || m.key || null,
    };
  }

  // ── Chart Extractors ───────────────────────────────────────────────────────

  private extractCharts_fromUiConfigDirect(ui: any): any[] | null {
    return ui.charts?.length ? [...ui.charts] : null;
  }

  private extractCharts_fromSections(ui: any): any[] | null {
    if (!ui.sections?.length) return null;
    const charts: any[] = [];
    for (const sec of ui.sections) {
      if ((sec.type === 'chart' || sec.type === 'visualization') && sec.data) {
        charts.push({
          id:    sec.id || `chart_${charts.length}`,
          title: sec.title,
          type:  sec.chart_type || sec.chartType || 'bar',
          data:  sec.data,
          subtitle: sec.subtitle
        });
      }
    }
    return charts.length ? charts : null;
  }

  private extractCharts_fromFlat(ad: any): any[] | null {
    return ad.charts?.length ? ad.charts : null;
  }

  // ── Table Extractors ───────────────────────────────────────────────────────

  private extractTables_fromUiConfigDirect(ui: any): any[] | null {
    return ui.tables?.length ? [...ui.tables] : null;
  }

  private extractTables_fromSections(ui: any): any[] | null {
    if (!ui.sections?.length) return null;
    const tables: any[] = [];
    for (const sec of ui.sections) {
      if (sec.type === 'table' && sec.data?.length) {
        tables.push({
          id:      sec.id   || `table_${tables.length}`,
          title:   sec.title,
          data:    sec.data,
          columns: sec.columns || null
        });
      }
    }
    return tables.length ? tables : null;
  }

  private extractTables_fromFlat(ad: any): any[] | null {
    return ad.tables?.length ? ad.tables : null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHART GENERATION
  // ═══════════════════════════════════════════════════════════════════════════

  generateCharts(): void {
    this.chartConfigs = {};
    if (!this.uiConfig?.charts) return;

    for (const chartConfig of this.uiConfig.charts) {
      if (chartConfig.type === 'progress') continue;

      let chartData = chartConfig.data || this.getValue(chartConfig.data_path);
      if (!chartData) continue;

      // Convert object → array if needed
      if (!Array.isArray(chartData) && typeof chartData === 'object') {
        chartData = Object.entries(chartData).map(([key, value]) => ({
          key, value, category: key, total: value
        }));
      }

      if (!Array.isArray(chartData) || chartData.length === 0) continue;

      const config = this.generateChartConfig(chartData, chartConfig);
      if (config) this.chartConfigs[chartConfig.id] = config;
    }
  }

  generateChartConfig(data: any[], config: ChartConfig): ChartConfiguration | null {
    if (!Array.isArray(data) || data.length === 0) return null;

    const firstItem = data[0];

    // ── SCATTER: items have numeric {x, y} keys ────────────────────────────
    const isScatter =
      config.type === 'scatter' ||
      (
        'x' in firstItem && 'y' in firstItem &&
        typeof firstItem.x === 'number' && typeof firstItem.y === 'number'
      );

    if (isScatter) {
      const points = data.map(d => ({ x: Number(d.x), y: Number(d.y) }));

      // Colour-code by x-value quartile for visual depth
      const sortedX = [...points].map(p => p.x).sort((a, b) => a - b);
      const q1 = sortedX[Math.floor(sortedX.length * 0.25)];
      const q3 = sortedX[Math.floor(sortedX.length * 0.75)];
      const pointColors = points.map(p =>
        p.x < q1 ? 'rgba(96,165,250,0.75)'  :
        p.x < q3 ? 'rgba(99,102,241,0.70)'  :
                   'rgba(167,139,250,0.80)'
      );

      return {
        type: 'scatter',
        data: {
          datasets: [{
            label:           config.title,
            data:            points,
            backgroundColor: pointColors,
            pointRadius:     4,
            pointHoverRadius: 7,
          } as any]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(15,15,30,0.95)',
              titleColor: '#fff',
              bodyColor:  '#a5b4fc',
              padding: 12,
              cornerRadius: 10,
              callbacks: {
                label: (c: any) =>
                  ` x: ${c.parsed.x.toFixed(2)}  ·  y: ${c.parsed.y.toFixed(2)}`
              }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(99,102,241,0.08)' },
              ticks: { color: '#64748b', font: { size: 11 } }
            },
            y: {
              grid: { color: 'rgba(99,102,241,0.08)' },
              ticks: { color: '#64748b', font: { size: 11 } }
            }
          }
        }
      };
    }

    // ── BAR / LINE / PIE / DOUGHNUT / HISTOGRAM ───────────────────────────
    const keys = Object.keys(firstItem);

    // Resolve x / label field
    let xField: string =
      (config as any).x_key   || (config as any).label_key ||
      config.x_field           || config.label_field        || '';

    if (!xField || !(xField in firstItem)) {
      xField = keys.find(k =>
        ['label','category','name','description','key','range',
         'date','bucket','bin','group','x'].includes(k.toLowerCase())
      ) || keys[0];
    }

    // Resolve y / value field
    let yField: string =
      (config as any).y_key   || (config as any).value_key ||
      config.y_field           || config.value_field        || '';

    if (!yField || !(yField in firstItem)) {
      yField = keys.find(k =>
        ['amount','value','count','total','current','y',
         'percentage','freq','frequency','qty','quantity'].includes(k.toLowerCase())
      ) || keys[1];
    }

    if (!(xField in firstItem) || !(yField in firstItem)) return null;

    const labels = data.map(item => this.formatChartLabel(item[xField]));
    const values = data.map(item => Number(item[yField]) || 0);
    const isPie  = config.type === 'pie' || config.type === 'doughnut' || config.type === 'donut';

    const _ds: any = {
      label:            config.title,
      data:             values,
      backgroundColor:  this.getColors(values.length, config.color_scheme),
      borderColor:      config.type === 'line' ? '#818cf8' : 'transparent',
      borderWidth:      config.type === 'line' ? 2 : 0,
      tension:          config.type === 'line' ? 0.4 : 0,
      maxBarThickness:  56,
      barPercentage:    0.65,
      categoryPercentage: 0.75,
      borderRadius:     ['bar','histogram'].includes(config.type) ? 6 : 0,
      fill:             config.type === 'line'
        ? { target: 'origin', above: 'rgba(99,102,241,0.08)' }
        : false,
    };

    if (!isPie) {
      _ds.backgroundColor = values.map((_: any, i: number) =>
        this.getColors(values.length, config.color_scheme)[i]
      );
    }

    return {
      type: this.mapChartType(config.type),
      data: { labels, datasets: [_ds] },
      options: this.getChartOptions(config)
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MEMOIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  private _memoize(): void {
    this._heroMetrics      = (this.uiConfig?.hero_metrics || []).filter((m: any) => m.is_hero !== false);
    this._secondaryMetrics = (this.uiConfig?.hero_metrics || []).filter((m: any) => m.is_hero === false);
    this._charts           = this.uiConfig?.charts || [];
    this._tables           = this._buildTables();
  }

  private _buildTables(): any[] {
    const tables = this.uiConfig?.tables || [];
    return tables.map((table: any) => {
      let rawData: any[] = [];
      if (table.data && Array.isArray(table.data)) {
        rawData = table.data;
      } else if (table.data_path) {
        const resolved = this.getValue(table.data_path);
        rawData = Array.isArray(resolved) ? resolved : [];
      }
      const data = rawData.length > 0 && typeof rawData[0] === 'string'
        ? rawData.map((s: string) => ({ item: s }))
        : rawData;

      let columns = this._buildColumns(table, data);

      // ── Replace generic "Value" column label with the actual metric name ──
      const tid = (table.id || table.name || '').toLowerCase();
      if (columns.some((c: any) => c.field === 'value')) {
        let metricLabel: string | null = null;
        if (tid.includes('popular')) {
          metricLabel =
            this.analyzedData?.popularity_metric_label ||
            this.humanize(this.analyzedData?.popularity_metric_column || '');
        } else if (tid.includes('rated') || tid.includes('quality')) {
          metricLabel =
            this.analyzedData?.quality_metric_label ||
            this.humanize(this.analyzedData?.quality_metric_column || '');
        }
        if (metricLabel) {
          columns = columns.map((c: any) =>
            c.field === 'value' ? { ...c, label: metricLabel } : c
          );
        }
      }

      return {
        id:      table.id   || table.name,
        name:    table.name || table.id,
        title:   table.title,
        data,
        columns,
      };
    });
  }

  private _buildColumns(table: any, fallbackData?: any[]): any[] {
    const data = fallbackData || table.data || [];

    if (!table.columns?.length) {
      if (!data.length) return [];
      if (typeof data[0] === 'object' && Object.keys(data[0]).length === 1 && 'item' in data[0]) {
        return [{ field: 'item', label: '', align: 'left' }];
      }
      return Object.keys(data[0]).map(key => ({
        field:  key,
        label:  this.humanize(key),
        format: null,
        align:  typeof data[0]?.[key] === 'number' ? 'right' : 'left',
      }));
    }

    const explicit = table.columns.map((col: any) => ({
      field:  col.key || col.field,
      label:  col.label || this.humanize(col.key || col.field || ''),
      format: col.format || null,
      align:  ['currency', 'number', 'percent'].includes(col.format) ? 'right' : 'left',
    }));

    if (data.length) {
      const coveredFields = new Set(explicit.map((c: any) => c.field));
      const extraCols = Object.keys(data[0])
        .filter(k => !coveredFields.has(k))
        .map(key => ({
          field:  key,
          label:  this.humanize(key),
          format: null,
          align:  typeof data[0][key] === 'number' ? 'right' : 'left',
        }));
      return [...explicit, ...extraCols];
    }

    return explicit;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCESSORS
  // ═══════════════════════════════════════════════════════════════════════════

  getTables(): any[]             { return this._tables; }
  getCharts(): any[]             { return this._charts; }
  getSections(): SectionConfig[] { return this.uiConfig?.sections || []; }
  getHeroMetrics(): any[]        { return this._heroMetrics; }
  getSecondaryMetrics(): any[]   { return this._secondaryMetrics; }

  getChartById(id: string): ChartConfig | undefined {
    return this.getCharts().find(c => c.id === id);
  }

  getTableByName(name: string): TableConfig | undefined {
    return this.getTables().find(t => t.id === name || t.name === name);
  }

  getChartData(config: ChartConfig | undefined): ChartConfiguration | null {
    if (!config?.id) return null;
    return this.chartConfigs[config.id] || null;
  }

  getValue(path: string | undefined): any {
    if (!path || !this.analyzedData) return null;
    const keys = path.split('.');
    let value: any = this.analyzedData;
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return null;
      }
    }
    return value;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORMATTING
  // ═══════════════════════════════════════════════════════════════════════════

  private formatChartLabel(value: any): string {
    if (value === null || value === undefined) return 'Unknown';
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      try {
        return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } catch { return value; }
    }
    return String(value);
  }

  private mapChartType(type: string): ChartType {
    const typeMap: Record<string, ChartType> = {
      'histogram':    'bar',
      'donut':        'doughnut',
      'bar':          'bar',
      'line':         'line',
      'pie':          'pie',
      'doughnut':     'doughnut',
      'scatter':      'scatter',
      'scatter_plot': 'scatter',
    };
    return (typeMap[type] || 'bar') as ChartType;
  }

  getTableDisplayColumns(table: any): string[] {
    if (table.columns?.length) return table.columns.map((col: any) => col.field);
    if (table.data?.length)    return Object.keys(table.data[0]);
    return [];
  }

  getMetricValue(metric: any): any {
    if (metric._value !== undefined) return metric._value;
    return this.getValue(metric.value_path || metric.key);
  }

  formatMetric(metric: any): string {
    const value = this.getMetricValue(metric);
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string') return value;
    const fmt = metric.format;
    if (fmt === 'currency') return this.formatCurrency(Number(value));
    if (fmt === 'percent')  return `${Number(value).toFixed(1)}%`;
    if (fmt === 'number')   return Number(value).toLocaleString('en-US');
    return this.formatValue(value);
  }

  formatValue(value: any, format?: string): string {
    if (value === null || value === undefined) return '—';
    if (format === 'currency') return this.formatCurrency(Number(value));
    if (format === 'percent')  return `${Number(value).toFixed(1)}%`;
    if (format === 'boolean')  return value ? 'Yes' : 'No';
    if (format === 'number')   return Number(value).toLocaleString('en-US');
    if (typeof value === 'number') {
      if (value > 100 && value < 1_000_000)
        return new Intl.NumberFormat('en-US', {
          style: 'currency', currency: 'USD',
          minimumFractionDigits: 0, maximumFractionDigits: 0
        }).format(value);
      if (value > 1_000)
        return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      if (value < 1 && value > 0) return (value * 100).toFixed(1) + '%';
      return value.toFixed(2);
    }
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  }

  formatTableValue(value: any, column: any): string {
    if (value === null || value === undefined) return '—';
    const fmt = column?.format;
    if (fmt === 'currency') return this.formatCurrency(Number(value));
    if (fmt === 'percent')  return `${Number(value).toFixed(1)}%`;
    if (fmt === 'boolean')  return value ? 'Yes' : 'No';
    if (fmt === 'number' && typeof value === 'number')
      return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    if (typeof value === 'number')
      return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return String(value);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(value);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PDF AGGREGATION
  // ═══════════════════════════════════════════════════════════════════════════

  private aggregateForPDF(data: any[], chartType: string): any[] {
    if (!data || data.length <= 50) return data;
    const firstItem = data[0];
    const keys = Object.keys(firstItem);
    const xField = keys.find(k => ['x','date','label','category','key','range','name'].includes(k.toLowerCase())) || keys[0];
    const yField = keys.find(k => ['y','value','total','amount','count','percentage'].includes(k.toLowerCase())) || keys[1];
    const isTimeSeries = typeof firstItem[xField] === 'string' && /^\d{4}-\d{2}-\d{2}/.test(firstItem[xField]);

    if (chartType === 'line' || (isTimeSeries && chartType !== 'scatter')) {
      const monthly: Record<string, { sum: number; count: number }> = {};
      for (const row of data) {
        const d = new Date(row[xField]);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthly[key]) monthly[key] = { sum: 0, count: 0 };
        monthly[key].sum += Number(row[yField]) || 0;
        monthly[key].count++;
      }
      return Object.entries(monthly)
        .sort(([a],[b]) => a.localeCompare(b))
        .map(([month, agg]) => ({
          Month: month,
          Total: Math.round(agg.sum * 100) / 100,
          Avg:   Math.round((agg.sum / agg.count) * 100) / 100,
          Count: agg.count
        }));
    }
    if (chartType === 'scatter') {
      const step = Math.ceil(data.length / 50);
      return data.filter((_, i) => i % step === 0).slice(0, 50);
    }
    if (chartType === 'bar' || chartType === 'histogram') {
      if (isTimeSeries) {
        const buckets: Record<string, { sum: number; count: number }> = {};
        for (const row of data) {
          const d = new Date(row[xField]);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (!buckets[key]) buckets[key] = { sum: 0, count: 0 };
          buckets[key].sum += Number(row[yField]) || 0;
          buckets[key].count++;
        }
        return Object.entries(buckets)
          .sort(([a],[b]) => a.localeCompare(b))
          .map(([month, agg]) => ({
            Month: month,
            Total: Math.round(agg.sum * 100) / 100,
            Count: agg.count
          }));
      }
      return [...data]
        .sort((a, b) => (Number(b[yField]) || 0) - (Number(a[yField]) || 0))
        .slice(0, 50);
    }
    return data.slice(0, 50);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════

  exportToExcel(): void {
    if (!this.uiConfig || !this.analyzedData) { alert('No data available to export'); return; }
    const sheets: { name: string; data: any[] }[] = [];
    const heroMetrics = this.getHeroMetrics();
    if (heroMetrics.length > 0) {
      sheets.push({
        name: 'Metrics',
        data: heroMetrics.map(m => ({ Metric: m.label, Value: this.getMetricValue(m) }))
      });
    }
    this.getTables().forEach(t => {
      if (t.data?.length > 0)
        sheets.push({ name: this.humanize(t.title).substring(0, 31), data: t.data });
    });
    if (sheets.length === 0) { alert('No data available to export'); return; }
    this.exportService.exportMultipleSheetsToExcel(sheets, `analytics_${this.documentId}`);
  }

  exportToPDF(): void {
    if (!this.uiConfig || !this.analyzedData) { alert('No data available to export'); return; }
    setTimeout(() => this.generatePDFWithCharts(), 300);
  }

  private generatePDFWithCharts(): void {
    const sections: { title: string; data: any[]; description?: string; chartImage?: string }[] = [];
    const heroMetrics = this.getHeroMetrics();
    if (heroMetrics.length > 0) {
      sections.push({
        title: 'Key Insights',
        description: 'Summary metrics',
        data: heroMetrics.map(m => ({ Metric: m.label, Value: this.getMetricValue(m) }))
      });
    }

    const chartCanvasMap = new Map<string, string>();
    const chartElements  = this.charts?.toArray() || [];
    const chartConfigs   = this.getCharts();
    chartElements.forEach((d, i) => {
      try {
        const canvas = d.chart?.canvas;
        if (canvas && i < chartConfigs.length)
          chartCanvasMap.set(chartConfigs[i].id, canvas.toDataURL('image/png'));
      } catch {}
    });

    for (const chart of this.getCharts()) {
      let chartData: any[] | null = chart.data || this.getValue(chart.data_path);
      if (!chartData) continue;
      if (!Array.isArray(chartData) && typeof chartData === 'object')
        chartData = Object.entries(chartData).map(([k, v]) => ({ Category: k, Value: v }));
      if (!Array.isArray(chartData) || chartData.length === 0) continue;
      sections.push({
        title:       chart.title,
        description: chart.subtitle || `${chartData.length} records`,
        chartImage:  chartCanvasMap.get(chart.id),
        data:        this.aggregateForPDF(chartData, chart.type)
      });
    }

    for (const table of this.getTables()) {
      if (table.data?.length > 0) {
        sections.push({
          title:       table.title,
          description: `${table.data.length} records`,
          data:        this.aggregateForPDF(table.data, 'table')
        });
      }
    }

    if (sections.length === 0) { alert('No data available to export'); return; }
    this.exportService.exportFullReportToPDF(
      sections,
      `analytics_${this.documentId}`,
      'Advanced Analytics Report',
      { documentId: this.documentId, generatedBy: 'UniDocVerse AI' }
    );
  }

  exportTable(tableName: string): void {
    const t = this.getTableByName(tableName);
    if (!t?.data?.length) { alert('No data in table'); return; }
    this.exportService.exportToExcel(t.data, this.humanize(tableName));
  }

  exportTableAsCSV(tableName: string): void {
    const t = this.getTableByName(tableName);
    if (!t?.data?.length) { alert('No data in table'); return; }
    this.exportService.exportToCSV(t.data, this.humanize(tableName));
  }

  exportTableAsPDF(tableName: string): void {
    const t = this.getTableByName(tableName);
    if (!t?.data?.length) { alert('No data in table'); return; }
    const orientation = Object.keys(t.data[0] || {}).length > 6 ? 'landscape' : 'portrait';
    this.exportService.exportToPDF(t.data, this.humanize(tableName), this.humanize(tableName), orientation);
  }

  goBack(): void { this.router.navigate(['/documents']); }

  // ═══════════════════════════════════════════════════════════════════════════
  // INTELLIGENCE ACCESSORS
  // ═══════════════════════════════════════════════════════════════════════════

  getInsights(): any[] {
    const raw: any[] = this.analyzedData?.intelligence?.key_insights || this.analyzedData?.insights || [];
    return raw.map((item: any) => {
      if (typeof item === 'object' && item?.title) return item;
      if (typeof item === 'object' && item?.value !== undefined) {
        const text = String(item.value);
        const dashIdx = text.indexOf(' — ');
        return dashIdx > -1
          ? { title: text.substring(0, dashIdx), description: text.substring(dashIdx + 3), category: 'info' }
          : { title: text, description: '', category: 'info' };
      }
      const text = String(item);
      const emojiMap: Record<string, string> = {
        '✅': 'positive', '💰': 'positive', '📊': 'budget',
        '🔴': 'negative', '⚠️': 'warning',  '🟡': 'warning',
        '💡': 'tip',       '📱': 'subscriptions', '💳': 'spending',
        '💼': 'income',    '🔄': 'recurring',     '⚡': 'anomaly'
      };
      let category = 'info';
      for (const [emoji, cat] of Object.entries(emojiMap)) {
        if (text.startsWith(emoji)) { category = cat; break; }
      }
      const dashIdx = text.indexOf(' — ');
      const dotIdx  = text.indexOf('. ');
      const splitAt = dashIdx > -1 ? dashIdx : dotIdx > -1 ? dotIdx : -1;
      return {
        category,
        title:       splitAt > -1 ? text.slice(0, splitAt) : text,
        description: splitAt > -1 ? text.slice(splitAt + (dashIdx > -1 ? 3 : 2)) : ''
      };
    });
  }

  getAlerts(): any[] {
    const raw: any[] = this.analyzedData?.alerts || [];
    return raw.map((item: any) => {
      if (typeof item === 'object' && item?.title) return item;
      const text = String(item);
      let type = 'info';
      if (text.includes('⚠️') || text.includes('unusual') || text.includes('warning')) type = 'warning';
      if (text.includes('🔴') || text.includes('error') || text.includes('critical') || text.includes('fraud')) type = 'error';
      const colonIdx = text.indexOf(': ');
      return {
        type,
        title:   colonIdx > -1 ? text.slice(0, colonIdx) : text,
        message: colonIdx > -1 ? text.slice(colonIdx + 2) : ''
      };
    });
  }

  getActionPlan(): any[] {
    const raw: any[] = this.analyzedData?.action_plan || [];
    if (raw.length > 0) return raw;
    const actions = this.analyzedData?.intelligence?.actions;
    if (!actions) return [];
    const result: any[] = [];
    (actions.immediate  || []).forEach((a: any) => result.push({ priority: 'immediate',  action: a.title, detail: a.detail, monthly_impact: a.savings_monthly || 0 }));
    (actions.short_term || []).forEach((a: any) => result.push({ priority: 'short_term', action: a.title, detail: a.detail, monthly_impact: a.savings_monthly || 0 }));
    (actions.long_term  || []).forEach((a: any) => result.push({ priority: 'long_term',  action: a.title, detail: a.detail, monthly_impact: a.savings_monthly || 0 }));
    return result;
  }

  getWithholdingSignal(): string  { return this.analyzedData?.withholding_signal  || ''; }
  getWithholdingMessage(): string { return this.analyzedData?.withholding_message || ''; }
  getRetirementAnalysis(): any    { return this.analyzedData?.retirement_analysis  || null; }
  getW2Projection(): any          { return this.analyzedData?.w2_projection         || null; }
  getBenefitAnalysis(): any[]     { return this.analyzedData?.benefit_analysis      || []; }
  getFilingChecklist(): string[]  { return this.analyzedData?.filing_checklist      || []; }

  getAlertClass(type: string): string {
    return ({ error: 'alert-error', warning: 'alert-warning', info: 'alert-info' } as any)[type] || 'alert-info';
  }
  getAlertIcon(type: string): string {
    return ({ error: 'error', warning: 'warning', info: 'info' } as any)[type] || 'info';
  }
  getPriorityClass(priority: string): string {
    return ({
      high: 'priority-high', medium: 'priority-medium', low: 'priority-low',
      immediate: 'priority-high', short_term: 'priority-medium', long_term: 'priority-low'
    } as any)[priority] || 'priority-low';
  }
  getInsightIcon(category: string): string {
    return ({
      summary: 'summarize', tax: 'receipt_long', retirement: 'savings',
      projection: 'trending_up', benefits: 'health_and_safety',
      positive: 'check_circle', negative: 'cancel',
      budget: 'account_balance_wallet', warning: 'warning',
      tip: 'lightbulb', subscriptions: 'subscriptions',
      spending: 'credit_card', income: 'payments',
      recurring: 'repeat', anomaly: 'bolt', info: 'info'
    } as any)[category] || 'insights';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROGRESS CHARTS
  // ═══════════════════════════════════════════════════════════════════════════

  getProgressCharts(): any[] {
    return (this.uiConfig?.charts || []).filter((c: any) => c.type === 'progress');
  }

  getProgressValue(chartCfg: any): number {
    const data = this.getValue(chartCfg.data_path);
    if (!data) return 0;
    const v = data[chartCfg.value_key];
    return v != null ? Number(v) : 0;
  }

  getProgressMax(chartCfg: any): number {
    const data = this.getValue(chartCfg.data_path);
    if (!data) return 1;
    const v = data[chartCfg.max_key];
    return v != null ? Number(v) : 1;
  }

  getProgressPct(chartCfg: any): number {
    const max = this.getProgressMax(chartCfg);
    if (!max) return 0;
    return Math.min(100, Math.round(this.getProgressValue(chartCfg) / max * 100));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  humanize(key: string): string {
    if (!key) return '';
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private getColors(count: number, scheme?: string): string[] {
    const palettes: Record<string, string[]> = {
      default: [
        '#6366f1','#8b5cf6','#10b981','#f59e0b',
        '#ef4444','#06b6d4','#ec4899','#14b8a6',
        '#f97316','#84cc16','#a855f7','#0ea5e9'
      ],
      cool: ['#06b6d4','#6366f1','#8b5cf6','#a855f7','#3b82f6','#0ea5e9'],
      warm: ['#f97316','#ef4444','#f59e0b','#ec4899','#84cc16','#10b981'],
      mono: ['#818cf8','#a5b4fc','#c7d2fe','#e0e7ff','#6366f1','#4f46e5'],
    };
    const palette = palettes[scheme || 'default'] || palettes['default'];
    return Array.from({ length: count }, (_, i) => palette[i % palette.length]);
  }

  private getChartOptions(config: ChartConfig): ChartConfiguration['options'] {
    const isAxisChart = ['line','bar','histogram'].includes(config.type);
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: config.show_legend !== false,
          position: (config.legend_position as any) || 'top',
          labels: { font: { size: 12, weight: 500 }, padding: 14, usePointStyle: true, color: '#94a3b8' }
        },
        tooltip: {
          backgroundColor: 'rgba(15,15,30,0.95)',
          titleColor: '#f0f2ff',
          bodyColor:  '#94a3b8',
          padding: 14,
          cornerRadius: 10,
          borderColor: 'rgba(99,102,241,0.25)',
          borderWidth: 1,
        }
      },
      ...(isAxisChart ? {
        scales: {
          y: {
            beginAtZero: true,
            grid:  { color: 'rgba(99,102,241,0.07)' },
            ticks: { color: '#64748b', font: { size: 11 } },
            border: { dash: [4, 4] }
          },
          x: {
            grid:  { display: false },
            ticks: { color: '#64748b', font: { size: 11 } }
          }
        }
      } : {})
    };
  }
}