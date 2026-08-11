import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';

// Register Chart.js components
Chart.register(...registerables);

@Component({
  selector: 'app-dynamic-chart',
  templateUrl: './dynamic-chart.component.html',
  styleUrls: ['./dynamic-chart.component.scss']
})
export class DynamicChartComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() type: ChartType = 'bar';
  @Input() data: any;
  @Input() config: any;
  @ViewChild('chartCanvas', { static: false }) canvas!: ElementRef<HTMLCanvasElement>;
  
  private chart: Chart | null = null;
  isLoading = true;
  hasError = false;
  errorMessage = '';

  ngOnInit() {
    this.validateInputs();
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.renderChart();
    }, 100);
  }

  ngOnDestroy() {
    this.destroyChart();
  }

  private validateInputs(): void {
    if (!this.data) {
      this.hasError = true;
      this.errorMessage = 'No data provided';
      this.isLoading = false;
      return;
    }

    if (!this.config) {
      this.hasError = true;
      this.errorMessage = 'No configuration provided';
      this.isLoading = false;
      return;
    }
  }

  private destroyChart(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  renderChart(): void {
    try {
      const ctx = this.canvas?.nativeElement?.getContext('2d');
      if (!ctx) {
        this.hasError = true;
        this.errorMessage = 'Unable to get canvas context';
        this.isLoading = false;
        return;
      }

      // Destroy existing chart
      this.destroyChart();

      // Prepare chart data
      const chartData = this.prepareChartData();
      const chartOptions = this.getChartOptions();

      // Create chart
      this.chart = new Chart(ctx, {
        type: this.getChartType(),
        data: chartData,
        options: chartOptions
      });

      this.isLoading = false;
      this.hasError = false;
    } catch (error) {
      console.error('Chart rendering error:', error);
      this.hasError = true;
      this.errorMessage = 'Failed to render chart';
      this.isLoading = false;
    }
  }

  private getChartType(): ChartType {
    // Map custom types to Chart.js types
    const typeMap: { [key: string]: ChartType } = {
      'donut': 'doughnut',
      'area': 'line'
    };
    return typeMap[this.type] || this.type as ChartType;
  }

  private prepareChartData(): any {
    if (this.type === 'bar' || this.type === 'line' || this.type === 'area') {
      return this.prepareBarLineData();
    } else if (this.type === 'pie' || this.type === 'donut') {
      return this.preparePieDonutData();
    }
    return {};
  }

  private prepareBarLineData(): any {
    let labels: string[] = [];
    let values: number[] = [];

    // Handle array data
    if (Array.isArray(this.data)) {
      labels = this.data.map(d => this.getFieldValue(d, this.config.x_field || 'label'));
      values = this.data.map(d => this.getFieldValue(d, this.config.y_field || 'value'));
    }
    // Handle object data (for time series)
    else if (typeof this.data === 'object') {
      const entries = Object.entries(this.data);
      labels = entries.map(([key]) => this.formatLabel(key));
      values = entries.map(([, value]) => Number(value));
    }

    // Determine background color
    let backgroundColor = this.config.color || '#3b82f6';
    if (this.type === 'bar') {
      backgroundColor = this.generateColors(labels.length, this.config.color_scheme);
    }

    const dataset: any = {
      label: this.config.title || 'Data',
      data: values,
      backgroundColor: backgroundColor,
      borderColor: this.config.border_color || '#3b82f6',
      borderWidth: this.config.border_width || 2
    };

    // Area chart specific
    if (this.type === 'area') {
      dataset.fill = true;
      dataset.backgroundColor = this.hexToRgba(this.config.color || '#3b82f6', 0.2);
    }

    // Line chart specific
    if (this.type === 'line') {
      dataset.tension = 0.4; // Smooth curves
      dataset.pointRadius = 3;
      dataset.pointHoverRadius = 6;
    }

    return {
      labels: labels,
      datasets: [dataset]
    };
  }

  private preparePieDonutData(): any {
    let labels: string[] = [];
    let values: number[] = [];

    // Handle array data
    if (Array.isArray(this.data)) {
      labels = this.data.map(d => this.getFieldValue(d, this.config.label_field || 'label'));
      values = this.data.map(d => this.getFieldValue(d, this.config.value_field || 'value'));
    }
    // Handle object data
    else if (typeof this.data === 'object') {
      const entries = Object.entries(this.data);
      labels = entries.map(([key]) => this.formatLabel(key));
      values = entries.map(([, value]) => Number(value));
    }

    return {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: this.generateColors(labels.length, this.config.color_scheme),
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    };
  }

  private getChartOptions(): ChartConfiguration['options'] {
    const baseOptions: ChartConfiguration['options'] = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: this.config.show_legend !== false,
          position: this.config.legend_position || 'top',
          labels: {
            font: {
              size: 12,
              family: "'Inter', sans-serif"
            },
            padding: 15
          }
        },
        title: {
          display: !!this.config.subtitle,
          text: this.config.subtitle,
          font: {
            size: 14,
            weight: 'normal'
          },
          padding: {
            bottom: 20
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          cornerRadius: 8,
          titleFont: {
            size: 14
          },
          bodyFont: {
            size: 13
          },
          callbacks: {
            label: (context: any) => {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              label += this.formatValue(context.parsed.y || context.parsed, this.config.format);
              return label;
            }
          }
        }
      }
    };

    // Add axes configuration for bar/line charts
    if (this.type === 'bar' || this.type === 'line' || this.type === 'area') {
      baseOptions.scales = {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value: any) => this.formatValue(value, this.config.format)
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      };
    }

    return baseOptions;
  }

  private getFieldValue(obj: any, field: string): any {
    if (!obj || !field) return '';
    return obj[field] || '';
  }

  private formatLabel(label: string): string {
    // Handle date strings
    if (label.includes('T')) {
      return new Date(label).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    }
    return label;
  }

  private formatValue(value: number, format: string): string {
    if (value === null || value === undefined) return '—';
    
    switch(format) {
      case 'currency':
        return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'number':
        return value.toLocaleString('en-US');
      case 'percent':
        return `${value.toFixed(2)}%`;
      default:
        return String(value);
    }
  }

  private generateColors(count: number, scheme?: string): string[] {
    const schemes: { [key: string]: string[] } = {
      'blue': ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'],
      'green': ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5'],
      'purple': ['#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe'],
      'orange': ['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a', '#fef3c7'],
      'red': ['#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2'],
      'mixed': ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']
    };

    const colors = schemes[scheme || 'mixed'] || schemes['mixed'];
    
    // Generate enough colors
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      result.push(colors[i % colors.length]);
    }
    
    return result;
  }

  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}