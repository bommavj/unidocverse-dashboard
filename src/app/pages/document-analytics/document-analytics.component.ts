import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartData, ChartType, registerables } from 'chart.js';

import { ApiService } from '../../services/api.service';

Chart.register(...registerables);

interface ChartConfigWrapper {
  type: ChartType;
  data: ChartData;
  options: any;
}

interface InsightSection {
  id: string;
  title: string;
  description: string;
  icon: string;
  charts: any[];
  loaded: boolean;
}

@Component({
  selector: 'app-document-analytics',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    BaseChartDirective,
  ],
  templateUrl: './document-analytics.component.html',
  styleUrls: ['./document-analytics.component.scss']
})
export class DocumentAnalyticsComponent implements OnInit {
  docId: string = '';
  documentName: string = '';
  loading = true;
  loadingMessage = 'Initializing...';
  dashboardData: any = null;
  error: string = '';
  errorDetails: any = null;

  chartConfigs: Map<string, ChartConfigWrapper> = new Map();

  // ✅ Infinite Scroll State
  insightSections: InsightSection[] = [];
  currentSectionIndex = 0;
  loadingMoreInsights = false;
  allInsightsLoaded = false;

  // Available insight types to load progressively
  private availableInsights = [
    { 
      id: 'top_performers',
      title: 'Top Performers',
      description: 'Highest performing categories and items',
      icon: 'emoji_events'
    },
    {
      id: 'comparisons',
      title: 'Category Comparisons',
      description: 'Compare performance across different segments',
      icon: 'compare_arrows'
    },
    {
      id: 'trends',
      title: 'Trends & Patterns',
      description: 'Identify trends and patterns in your data',
      icon: 'trending_up'
    },
    {
      id: 'distributions',
      title: 'Statistical Distributions',
      description: 'Analyze data distributions and outliers',
      icon: 'bar_chart'
    },
    {
      id: 'correlations',
      title: 'Correlations',
      description: 'Discover relationships between variables',
      icon: 'link'
    },
    {
      id: 'time_analysis',
      title: 'Time-based Analysis',
      description: 'Analyze patterns over time periods',
      icon: 'schedule'
    }
  ];

  constructor(
    private apiService: ApiService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.docId = params['id'];
      console.log('📄 Document ID:', this.docId);
      this.loadDashboard();
    });
  }

  // ✅ Listen for scroll events
  @HostListener('window:scroll', ['$event'])
  onScroll() {
    const scrollPosition = window.innerHeight + window.scrollY;
    const scrollThreshold = document.body.offsetHeight - 800; // Trigger 800px from bottom

    if (scrollPosition >= scrollThreshold && !this.loadingMoreInsights && !this.allInsightsLoaded) {
      this.loadMoreInsights();
    }
  }

  loadDashboard() {
    this.loading = true;
    this.error = '';
    this.loadingMessage = 'Fetching analytics data...';

    this.apiService.getDocument(this.docId).subscribe({
      next: (data: any) => {
        console.log('✅ Dashboard data received:', data);
        this.dashboardData = data;
        
        // Extract document name if available
        this.documentName = data.document_name || `Document ${this.docId.substring(0, 8)}`;
        
        this.prepareCharts();
        this.loading = false;

        // ✅ Auto-load first insight section after 1 second
        setTimeout(() => this.loadMoreInsights(), 1000);
      },
      error: (err: any) => {
        console.error('❌ Dashboard error:', err);
        this.loading = false;
        this.error = err.error?.detail || err.message || 'Unknown error occurred';
        this.errorDetails = {
          status: err.status,
          statusText: err.statusText,
          url: err.url,
          error: err.error
        };
      }
    });
  }

  prepareCharts() {
    if (!this.dashboardData || !this.dashboardData.charts) return;

    this.chartConfigs.clear();

    this.dashboardData.charts.forEach((chartConfig: any) => {
      const config = this.createChartConfig(chartConfig);
      if (config) {
        this.chartConfigs.set(chartConfig.id, config);
      }
    });
  }

  // ✅ Load more insights on scroll
  async loadMoreInsights() {
    if (this.currentSectionIndex >= this.availableInsights.length) {
      this.allInsightsLoaded = true;
      return;
    }

    this.loadingMoreInsights = true;

    const nextInsight = this.availableInsights[this.currentSectionIndex];
    
    console.log(`📊 Loading insight section: ${nextInsight.title}`);

    // Create section placeholder
    const section: InsightSection = {
      id: nextInsight.id,
      title: nextInsight.title,
      description: nextInsight.description,
      icon: nextInsight.icon,
      charts: [],
      loaded: false
    };

    this.insightSections.push(section);

    // ✅ Generate charts for this section
    try {
      const charts = await this.generateInsightCharts(nextInsight.id);
      
      // Update section with charts
      section.charts = charts;
      section.loaded = true;

      // Prepare chart configs
      charts.forEach((chartConfig: any) => {
        const config = this.createChartConfig(chartConfig);
        if (config) {
          this.chartConfigs.set(chartConfig.id, config);
        }
      });

      this.currentSectionIndex++;
      this.loadingMoreInsights = false;

      console.log(`✅ Loaded insight section: ${nextInsight.title}`);
    } catch (error) {
      console.error('❌ Failed to load insight:', error);
      section.loaded = true;
      this.loadingMoreInsights = false;
      this.currentSectionIndex++;
    }
  }

  // ✅ Generate charts based on insight type
  async generateInsightCharts(insightType: string): Promise<any[]> {
    if (!this.dashboardData || !this.dashboardData.schema) {
      return [];
    }

    const schema = this.dashboardData.schema;
    const charts: any[] = [];

    // Simulate API delay for smooth scrolling experience
    await new Promise(resolve => setTimeout(resolve, 500));

    switch (insightType) {
      case 'top_performers':
        // Top 10 by each categorical column
        schema.categorical_columns.slice(0, 3).forEach((col: string, idx: number) => {
          if (schema.numeric_columns.length > 0) {
            charts.push({
              id: `top_${col}_${idx}`,
              title: `Top 10 ${col} by ${schema.numeric_columns[0]}`,
              type: 'bar',
              data: this.generateTopPerformersData(col, schema.numeric_columns[0])
            });
          }
        });
        break;

      case 'comparisons':
        // Pie charts for distribution
        schema.categorical_columns.slice(0, 2).forEach((col: string, idx: number) => {
          if (schema.numeric_columns.length > 0) {
            charts.push({
              id: `pie_${col}_${idx}`,
              title: `${schema.numeric_columns[0]} Distribution by ${col}`,
              type: 'pie',
              data: this.generateDistributionData(col, schema.numeric_columns[0])
            });
          }
        });
        break;

      case 'trends':
        // Line charts for trends
        if (schema.date_columns.length > 0 && schema.numeric_columns.length > 0) {
          schema.numeric_columns.slice(0, 2).forEach((col: string, idx: number) => {
            charts.push({
              id: `trend_${col}_${idx}`,
              title: `${col} Trend Over Time`,
              type: 'line',
              data: this.generateTrendData(schema.date_columns[0], col)
            });
          });
        } else if (schema.numeric_columns.length >= 2) {
          // If no date columns, show comparison trends
          charts.push({
            id: 'trend_comparison',
            title: 'Performance Comparison Trend',
            type: 'line',
            data: this.generateComparisonTrendData()
          });
        }
        break;

      case 'distributions':
        // Histogram-style data
        schema.numeric_columns.slice(0, 3).forEach((col: string, idx: number) => {
          charts.push({
            id: `dist_${col}_${idx}`,
            title: `${col} Distribution`,
            type: 'bar',
            data: this.generateHistogramData(col)
          });
        });
        break;

      case 'correlations':
        // Multi-dimensional analysis
        if (schema.categorical_columns.length > 1 && schema.numeric_columns.length > 0) {
          charts.push({
            id: 'correlation_multi',
            title: 'Multi-dimensional Performance',
            type: 'bar',
            data: this.generateCorrelationData()
          });
          
          // Add a second correlation chart if enough data
          if (schema.categorical_columns.length > 2) {
            charts.push({
              id: 'correlation_secondary',
              title: 'Secondary Correlation Analysis',
              type: 'line',
              data: this.generateSecondaryCorrelationData()
            });
          }
        }
        break;

      case 'time_analysis':
        // Time-based patterns
        charts.push({
          id: 'time_patterns_weekly',
          title: 'Weekly Activity Patterns',
          type: 'line',
          data: this.generateTimePatternData('weekly')
        });
        
        charts.push({
          id: 'time_patterns_daily',
          title: 'Daily Performance',
          type: 'bar',
          data: this.generateTimePatternData('daily')
        });
        break;
    }

    return charts;
  }

  // ✅ Data generation methods (would normally call backend APIs)
  private generateTopPerformersData(category: string, metric: string): any {
    const labels = Array.from({ length: 10 }, (_, i) => `${category} ${i + 1}`);
    const values = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10000) + 1000)
      .sort((a, b) => b - a); // Sort descending
    
    return { labels, values };
  }

  private generateDistributionData(category: string, metric: string): any {
    const labels = Array.from({ length: 6 }, (_, i) => `${category} ${String.fromCharCode(65 + i)}`);
    const values = Array.from({ length: 6 }, () => Math.floor(Math.random() * 5000) + 500);
    
    return { labels, values };
  }

  private generateTrendData(dateCol: string, metric: string): any {
    const labels = Array.from({ length: 12 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (11 - i));
      return date.toLocaleDateString('en-US', { month: 'short' });
    });
    const values = Array.from({ length: 12 }, (_, i) => {
      const base = 5000;
      const trend = i * 200; // Upward trend
      const variance = Math.random() * 1000 - 500;
      return Math.floor(base + trend + variance);
    });
    
    return { labels, values };
  }

  private generateComparisonTrendData(): any {
    const labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'];
    const values = Array.from({ length: 6 }, () => Math.floor(Math.random() * 8000) + 2000);
    
    return { labels, values };
  }

  private generateHistogramData(metric: string): any {
    const labels = ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%'];
    const values = Array.from({ length: 5 }, () => Math.floor(Math.random() * 300) + 50);
    
    return { labels, values };
  }

  private generateCorrelationData(): any {
    const labels = ['Group A', 'Group B', 'Group C', 'Group D', 'Group E', 'Group F'];
    const values = Array.from({ length: 6 }, () => Math.floor(Math.random() * 6000) + 1000);
    
    return { labels, values };
  }

  private generateSecondaryCorrelationData(): any {
    const labels = ['Q1', 'Q2', 'Q3', 'Q4'];
    const values = Array.from({ length: 4 }, () => Math.floor(Math.random() * 15000) + 5000);
    
    return { labels, values };
  }

  private generateTimePatternData(type: 'weekly' | 'daily'): any {
    if (type === 'weekly') {
      const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const values = Array.from({ length: 7 }, () => Math.floor(Math.random() * 5000) + 1500);
      return { labels, values };
    } else {
      const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
      const values = Array.from({ length: 24 }, () => Math.floor(Math.random() * 2000) + 200);
      return { labels, values };
    }
  }

  createChartConfig(chartConfig: any): ChartConfigWrapper | null {
    const data = chartConfig.data;

    if (!data || !data.labels || !data.values) {
      console.warn('Invalid chart data:', chartConfig);
      return null;
    }

    const baseColors = this.generateColors(data.labels.length);

    switch (chartConfig.type) {
      case 'bar':
        return {
          type: 'bar' as ChartType,
          data: {
            labels: data.labels,
            datasets: [{
              label: chartConfig.title,
              data: data.values,
              backgroundColor: baseColors[0],
              borderColor: '#2196f3',
              borderWidth: 1,
              borderRadius: 6,
              barThickness: 'flex'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                padding: 12,
                titleFont: { size: 14, weight: 'bold' },
                bodyFont: { size: 13 },
                callbacks: {
                  label: (context: any) => `${context.parsed.y.toLocaleString()}`
                }
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                grid: { color: 'rgba(0, 0, 0, 0.05)' },
                ticks: { 
                  callback: (value: any) => value.toLocaleString(),
                  font: { size: 11 }
                }
              },
              x: { 
                grid: { display: false },
                ticks: { 
                  font: { size: 11 },
                  maxRotation: 45,
                  minRotation: 0
                }
              }
            }
          }
        };

      case 'line':
        return {
          type: 'line' as ChartType,
          data: {
            labels: data.labels,
            datasets: [{
              label: chartConfig.title,
              data: data.values,
              borderColor: '#2196f3',
              backgroundColor: 'rgba(33, 150, 243, 0.1)',
              tension: 0.4,
              fill: true,
              pointRadius: 5,
              pointHoverRadius: 7,
              pointBackgroundColor: '#2196f3',
              pointBorderColor: '#fff',
              pointBorderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                padding: 12,
                titleFont: { size: 14, weight: 'bold' },
                bodyFont: { size: 13 }
              }
            },
            scales: {
              y: { 
                beginAtZero: true, 
                grid: { color: 'rgba(0, 0, 0, 0.05)' },
                ticks: { font: { size: 11 } }
              },
              x: { 
                grid: { display: false },
                ticks: { font: { size: 11 } }
              }
            }
          }
        };

      case 'pie':
        return {
          type: 'pie' as ChartType,
          data: {
            labels: data.labels,
            datasets: [{
              data: data.values,
              backgroundColor: this.generateColors(data.labels.length),
              borderWidth: 3,
              borderColor: '#fff'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'right',
                labels: { 
                  padding: 15, 
                  font: { size: 12 },
                  generateLabels: (chart: any) => {
                    const data = chart.data;
                    return data.labels.map((label: string, i: number) => {
                      const value = data.datasets[0].data[i];
                      const total = data.datasets[0].data.reduce((a: number, b: number) => a + b, 0);
                      const percentage = ((value / total) * 100).toFixed(1);
                      return {
                        text: `${label} (${percentage}%)`,
                        fillStyle: data.datasets[0].backgroundColor[i],
                        hidden: false,
                        index: i
                      };
                    });
                  }
                }
              },
              tooltip: {
                callbacks: {
                  label: (context: any) => {
                    const value = context.parsed;
                    return `${value.toLocaleString()}`;
                  }
                }
              }
            }
          }
        };

      default:
        return null;
    }
  }

  generateColors(count: number): string[] {
    const baseColors = [
      '#2196f3', '#4caf50', '#ff9800', '#f44336', '#9c27b0',
      '#00bcd4', '#8bc34a', '#ffc107', '#e91e63', '#3f51b5',
      '#009688', '#ff5722', '#607d8b', '#795548', '#e91e63'
    ];
    
    return Array.from({ length: count }, (_, i) => baseColors[i % baseColors.length]);
  }

  retry() {
    this.loadDashboard();
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  getChartIcon(type: string): string {
    const icons: any = {
      'line': 'show_chart',
      'bar': 'bar_chart',
      'pie': 'pie_chart',
    };
    return icons[type] || 'insert_chart';
  }

  formatValue(value: number, type: string): string {
    if (type === 'currency') {
      return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (type === 'quantity') {
      return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
    } else {
      return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }
  }

  exportDashboard() {
    alert('Export feature coming soon! This will generate a PDF with all charts and insights.');
  }
}