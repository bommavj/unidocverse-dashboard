import { Component, OnInit, ViewChildren, QueryList } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';

// Angular Material (same imports as before)
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';

// Services
import { ExportService } from '../../services/export.service';

// Chart.js
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';

Chart.register(...registerables);

// =========================================
// INTERFACES FOR V2 DASHBOARD
// =========================================

interface DashboardMeta {
  title: string;
  description: string;
  record_count: number;
  document_type: string;
}

interface InsightCard {
  type: string;
  title: string;
  value: string;
  metric: string;
  icon: string;
}

interface VisualizationConfig {
  type: 'horizontal_bar' | 'scatter' | 'grouped_bar' | 'line' | 'pie';
  title: string;
  subtitle?: string;
  x_axis: string;
  y_axis: string;
  data: any[];
  config: {
    orientation?: string;
    color?: string;
    show_values?: boolean;
    point_color?: string;
    point_size?: number;
    show_trend_line?: boolean;
    line_color?: string;
    line_width?: number;
    show_points?: boolean;
    show_area?: boolean;
    show_percentage?: boolean;
    show_legend?: boolean;
    color_palette?: string;
  };
  insight?: string;
}

interface UIVisualizationConfig {
  component: string;
  id: string;
  grid_position: {
    row: number;
    col: number;
    colspan: number;
    rowspan: number;
  };
  config: any;
}

@Component({
  selector: 'app-advanced-analytics-v2',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatButtonToggleModule,
    MatMenuModule,
    MatDividerModule,
    BaseChartDirective
  ],
  templateUrl: './advanced-analytics-v2.component.html',
  styleUrls: ['./advanced-analytics-v2.component.scss']
})
export class AdvancedAnalyticsV2Component implements OnInit {
  @ViewChildren(BaseChartDirective) charts!: QueryList<BaseChartDirective>;

  documentId = '';
  
  // V2 Data structures
  dashboardMeta: DashboardMeta | null = null;
  insights: InsightCard[] = [];
  visualizations: VisualizationConfig[] = [];
  uiConfig: any = null;
  
  // Chart configs (generated from visualizations)
  chartConfigs: { [key: string]: ChartConfiguration } = {};
  
  loading = true;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private exportService: ExportService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.documentId = params['id'];
      this.fetchDashboardAnalytics();
    });
  }

  fetchDashboardAnalytics(): void {
    this.loading = true;
    this.error = '';
  
    const analyzer = this.route.snapshot.queryParamMap.get('analyzer') || undefined;
    this.api.getAdvancedAnalyticsV2(this.documentId, analyzer).subscribe({
      next: res => {
        console.log('📦 V2 Dashboard Response:', res);
        
        const data = res.analyzed_data || res;
        
        // Extract V2 structure
        this.dashboardMeta = data.dashboard;
        this.insights = data.insights || [];
        this.visualizations = data.visualizations || [];
        this.uiConfig = data.ui_config;
        
        console.log('📊 Dashboard:', this.dashboardMeta);
        console.log('💡 Insights:', this.insights.length);
        console.log('📈 Visualizations:', this.visualizations.length);
        
        // Generate Chart.js configs
        this.generateChartConfigs();
        
        this.loading = false;
      },
      error: err => {
        console.error('❌ Error:', err);
        this.error = err.error?.detail || 'Failed to load dashboard analytics';
        this.loading = false;
      }
    });
  }

  generateChartConfigs(): void {
    console.log('🎨 Generating Chart.js configs...');
    
    this.visualizations.forEach((viz, index) => {
      const chartId = `viz_${index}`;
      const config = this.createChartConfig(viz);
      
      if (config) {
        this.chartConfigs[chartId] = config;
        console.log(`✅ Generated chart: ${viz.title}`);
      }
    });
    
    console.log(`✅ Total charts: ${Object.keys(this.chartConfigs).length}`);
  }

  createChartConfig(viz: VisualizationConfig): ChartConfiguration | null {
    if (!viz.data || viz.data.length === 0) {
      console.warn('⚠️ No data for:', viz.title);
      return null;
    }

    const chartType = this.mapVisualizationType(viz.type);
    
    // Extract labels and values based on chart type
    let labels: string[] = [];
    let datasets: any[] = [];

    if (viz.type === 'horizontal_bar') {
      labels = viz.data.map(d => String(d.label || d.category || d.name));
      const hbDs: any = { label: viz.title, data: viz.data.map(d => Number(d.value || d.total || 0)),
        backgroundColor: viz.config.color || '#667eea', borderRadius: 8, borderWidth: 0,
        maxBarThickness: 56, barPercentage: 0.6, categoryPercentage: 0.7 };
      datasets = [hbDs];
    } else if (viz.type === 'scatter') {
      labels = [];
      datasets = [{
        label: viz.title,
        data: viz.data.map(d => ({ x: d.x, y: d.y })),
        backgroundColor: viz.config.point_color || '#667eea',
        pointRadius: viz.config.point_size || 6,
        pointHoverRadius: (viz.config.point_size || 6) + 2
      }];
    } else if (viz.type === 'grouped_bar') {
      // Extract categories and series
      const categories = viz.data.map(d => d.category || d.label);
      const seriesKeys = Object.keys(viz.data[0] || {}).filter(k => k !== 'category' && k !== 'label');
      
      labels = categories;
      datasets = seriesKeys.map((key, i): any => ({
        label: key, data: viz.data.map(d => Number(d[key] || 0)),
        backgroundColor: this.getColorFromPalette(i, viz.config.color_palette),
        borderRadius: 6, maxBarThickness: 56, barPercentage: 0.6, categoryPercentage: 0.7
      }));
    } else if (viz.type === 'line') {
      labels = viz.data.map(d => String(d.x || d.year || d.category));
      datasets = [{
        label: viz.title,
        data: viz.data.map(d => Number(d.y || d.value || d.avg_rating || 0)),
        borderColor: viz.config.line_color || '#667eea',
        backgroundColor: 'transparent',
        borderWidth: viz.config.line_width || 3,
        tension: 0.4,
        pointRadius: viz.config.show_points !== false ? 5 : 0,
        pointBackgroundColor: viz.config.line_color || '#667eea',
        fill: viz.config.show_area || false
      }];
    } else if (viz.type === 'pie') {
      labels = viz.data.map(d => String(d.label || d.category));
      datasets = [{
        data: viz.data.map(d => Number(d.value || d.count || 0)),
        backgroundColor: this.getColors(viz.data.length, viz.config.color_palette),
        borderWidth: 2,
        borderColor: '#ffffff'
      }];
    }

    const config: ChartConfiguration = {
      type: chartType,
      data: { labels, datasets },
      options: this.getChartOptions(viz)
    };

    return config;
  }

  private mapVisualizationType(type: string): ChartType {
    const map: Record<string, ChartType> = {
      'horizontal_bar': 'bar',
      'scatter': 'scatter',
      'grouped_bar': 'bar',
      'line': 'line',
      'pie': 'doughnut'  // Use doughnut for modern look
    };
    return map[type] || 'bar';
  }

  private getChartOptions(viz: VisualizationConfig): ChartConfiguration['options'] {
    const baseOptions: any = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: viz.config.show_legend !== false,
          position: 'top',
          labels: {
            font: { size: 13, weight: 600 },
            padding: 15,
            usePointStyle: true,
            color: '#1e293b'
          }
        },
        tooltip: {
          backgroundColor: 'rgba(30, 41, 59, 0.95)',
          padding: 16,
          cornerRadius: 12,
          titleFont: { size: 14, weight: 700 },
          bodyFont: { size: 13, weight: 500 },
          borderColor: 'rgba(148, 163, 184, 0.1)',
          borderWidth: 1
        }
      }
    };

    // Add scales for bar/line/scatter charts
    if (['horizontal_bar', 'grouped_bar', 'line', 'scatter'].includes(viz.type)) {
      baseOptions.scales = {
        x: {
          grid: { 
            display: viz.type !== 'horizontal_bar',
            color: 'rgba(148, 163, 184, 0.1)' 
          },
          ticks: {
            font: { size: 12, weight: 500 },
            color: '#64748b'
          }
        },
        y: {
          beginAtZero: true,
          grid: { 
            color: 'rgba(148, 163, 184, 0.1)',
            drawBorder: false
          },
          ticks: {
            font: { size: 12, weight: 500 },
            color: '#64748b'
          }
        }
      };

      // Horizontal bar specific
      if (viz.type === 'horizontal_bar') {
        baseOptions.indexAxis = 'y';
      }
    }

    return baseOptions;
  }

  private getColors(count: number, palette?: string): string[] {
    const premiumColors = [
      '#667eea', '#764ba2', '#10b981', '#f59e0b', 
      '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'
    ];
    return Array.from({ length: count }, (_, i) => premiumColors[i % premiumColors.length]);
  }

  private getColorFromPalette(index: number, palette?: string): string {
    return this.getColors(10, palette)[index];
  }

  getChartConfig(index: number): ChartConfiguration | null {
    return this.chartConfigs[`viz_${index}`] || null;
  }

  goBack(): void {
    this.router.navigate(['/documents']);
  }

  // =========================================
  // PDF AGGREGATION HELPER (same as v1)
  // =========================================
  private aggregateForPDF(data: any[], chartType: string): any[] {
    if (!data || data.length <= 50) return data;

    const firstItem = data[0];
    const keys = Object.keys(firstItem);

    const xField = keys.find(k =>
      ['x', 'date', 'label', 'category', 'key', 'range', 'name'].includes(k.toLowerCase())
    ) || keys[0];

    const yField = keys.find(k =>
      ['y', 'value', 'total', 'amount', 'count', 'percentage'].includes(k.toLowerCase())
    ) || keys[1];

    const isTimeSeries =
      typeof firstItem[xField] === 'string' && /^\d{4}-\d{2}-\d{2}/.test(firstItem[xField]);

    // LINE / time series → monthly aggregation
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
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, agg]) => ({
          Month: month,
          Total: Math.round(agg.sum * 100) / 100,
          Avg: Math.round((agg.sum / agg.count) * 100) / 100,
          Count: agg.count
        }));
    }

    // SCATTER → uniform sample to 50 points
    if (chartType === 'scatter') {
      const step = Math.ceil(data.length / 50);
      return data.filter((_, i) => i % step === 0).slice(0, 50);
    }

    // BAR / HISTOGRAM with date x → monthly buckets
    if (chartType === 'horizontal_bar' || chartType === 'grouped_bar') {
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
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, agg]) => ({
            Month: month,
            Total: Math.round(agg.sum * 100) / 100,
            Count: agg.count
          }));
      }

      // Categorical bar with > 50 categories → top 50 by value
      return [...data]
        .sort((a, b) => (Number(b[yField]) || 0) - (Number(a[yField]) || 0))
        .slice(0, 50);
    }

    // Fallback: first 50 rows
    return data.slice(0, 50);
  }

  // =========================================
  // EXPORT METHODS
  // =========================================

  exportToExcel(): void {
    const sheets: { name: string; data: any[] }[] = [];

    // Sheet 1: Insights summary
    if (this.insights.length > 0) {
      sheets.push({
        name: 'Insights',
        data: this.insights.map(i => ({
          Title: i.title,
          Value: i.value,
          Metric: i.metric || ''
        }))
      });
    }

    // Sheet per visualization
    this.visualizations.forEach(viz => {
      if (viz.data && viz.data.length > 0) {
        sheets.push({
          name: viz.title.substring(0, 31),
          data: viz.data
        });
      }
    });

    if (sheets.length === 0) {
      alert('No data available to export.');
      return;
    }

    this.exportService.exportMultipleSheetsToExcel(
      sheets,
      this.dashboardMeta?.title || 'dashboard'
    );
  }

  exportToPDF(): void {
    if (!this.dashboardMeta) {
      alert('No dashboard data available');
      return;
    }

    // Give charts time to fully render before capturing
    setTimeout(() => {
      this.generatePDFWithCharts();
    }, 300);
  }

  private generatePDFWithCharts(): void {
    const sections: { title: string; data: any[]; description?: string; chartImage?: string }[] = [];

    // --- Section 1: Insights summary ---
    if (this.insights.length > 0) {
      sections.push({
        title: 'Key Insights',
        description: 'Summary metrics from the analysis',
        data: this.insights.map(i => ({
          Metric: i.title,
          Value: i.value,
          Detail: i.metric || ''
        }))
      });
    }

    // --- Build chart ID → canvas mapping ---
    const chartCanvasMap = new Map<string, string>();
    const chartElements = this.charts?.toArray() || [];

    console.log('🎨 Capturing charts for PDF...');
    console.log('  Chart directives found:', chartElements.length);
    console.log('  Visualizations:', this.visualizations.length);

    chartElements.forEach((chartDirective, index) => {
      try {
        const canvas = chartDirective.chart?.canvas;
        if (canvas && index < this.visualizations.length) {
          const imageData = canvas.toDataURL('image/png');
          chartCanvasMap.set(`viz_${index}`, imageData);
          console.log(`  ✅ Captured chart ${index}: ${this.visualizations[index].title}`);
        } else {
          console.warn(`  ⚠️ No canvas for chart ${index}`);
        }
      } catch (err) {
        console.error(`  ❌ Failed to capture chart ${index}:`, err);
      }
    });

    console.log('📸 Total charts captured:', chartCanvasMap.size);

    // --- Section per visualization (with image + aggregated data) ---
    this.visualizations.forEach((viz, index) => {
      if (viz.data && viz.data.length > 0) {
        const aggregatedData = this.aggregateForPDF(viz.data, viz.type);
        const chartImage = chartCanvasMap.get(`viz_${index}`);

        if (chartImage) {
          console.log(`  📊 Adding chart image for: ${viz.title}`);
        } else {
          console.warn(`  ⚠️ No chart image for: ${viz.title}`);
        }

        sections.push({
          title: viz.title,
          description: viz.subtitle || `${viz.data.length} records`,
          chartImage: chartImage,
          data: aggregatedData
        });
      }
    });

    if (sections.length === 0) {
      alert('No data available to export.');
      return;
    }

    console.log('📄 Calling exportFullReportToPDF with', sections.length, 'sections');
    console.log('   Sections with chartImage:', sections.filter(s => s.chartImage).length);

    this.exportService.exportFullReportToPDF(
      sections,
      this.dashboardMeta?.title || 'dashboard',
      this.dashboardMeta?.title || 'Analytics Report',
      {
        documentId: this.documentId,
        documentType: this.dashboardMeta?.document_type,
        generatedBy: 'UniDocVerse AI'
      }
    );
  }
}