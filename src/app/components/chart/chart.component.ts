import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-chart',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './chart.component.html',
  styleUrl: './chart.component.scss'
})
export class ChartComponent implements OnChanges {

  @Input() config: any;
  @Input() data: any;

  chartType: ChartType = 'bar';
  chartData: ChartConfiguration['data'] = { labels: [], datasets: [] };
  chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true }
    }
  };

  ngOnChanges(): void {
    this.buildChart();
  }

  private buildChart(): void {
    if (!this.config) return;

    const typeMap: Record<string, ChartType> = {
      bar: 'bar',
      line: 'line',
      pie: 'pie',
      donut: 'doughnut',
      doughnut: 'doughnut',
      scatter: 'scatter'
    };
    this.chartType = typeMap[this.config.type] ?? 'bar';

    const raw = this.data;

    // CASE 1: {labels, values}
    if (raw && raw.labels && raw.values) {
      this.chartData = {
        labels: raw.labels,
        datasets: [
          {
            label: this.config.title || '',
            data: raw.values
          }
        ]
      };
      return;
    }

    // CASE 2: array of objects
    if (Array.isArray(raw) && raw.length && typeof raw[0] === 'object') {
      const xField = this.config.x_field || this.config.label_field;
      const yField = this.config.y_field || this.config.value_field;

      if (xField && yField) {
        this.chartData = {
          labels: raw.map(r => String(r[xField])),
          datasets: [
            {
              label: this.config.title || '',
              data: raw.map(r => Number(r[yField]))
            }
          ]
        };
        return;
      }

      // fallback: use first two keys
      const keys = Object.keys(raw[0]);
      this.chartData = {
        labels: raw.map(r => String(r[keys[0]])),
        datasets: [
          {
            label: this.config.title || '',
            data: raw.map(r => Number(r[keys[1]]))
          }
        ]
      };
      return;
    }

    // CASE 3: array of primitives
    if (Array.isArray(raw)) {
      this.chartData = {
        labels: raw.map((_, i) => String(i + 1)),
        datasets: [
          {
            label: this.config.title || '',
            data: raw
          }
        ]
      };
      return;
    }

    // CASE 4: unknown → empty chart
    this.chartData = { labels: [], datasets: [] };
  }
}
