import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

@Component({
  selector: 'app-excel-visualizer',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatFormFieldModule, MatSelectModule,
    MatButtonModule, MatTabsModule, MatTableModule, MatCardModule,
    MatChipsModule, MatIconModule, BaseChartDirective
  ],
  templateUrl: './excel-visualizer.component.html',
  styleUrls: ['./excel-visualizer.component.scss']
})
export class ExcelVisualizerComponent implements OnInit {
  @Input() tableData: any;

  columns: string[] = [];
  numericColumns: string[] = [];
  dataRows: any[][] = [];
  displayData: any[][] = [];
  selectedXColumn = '';
  selectedYColumns: string[] = [];

  chartData: ChartConfiguration['data'] = { labels: [], datasets: [] };
  pieChartData: ChartConfiguration['data'] = { labels: [], datasets: [{ data: [] }] };

  chartOptions: ChartConfiguration['options'] = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top' } } };
  lineChartOptions: ChartConfiguration['options'] = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top' } }, scales: { y: { beginAtZero: false } } };
  stackedChartOptions: ChartConfiguration['options'] = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top' } }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } };
  radarChartOptions: ChartConfiguration['options'] = { responsive: true, maintainAspectRatio: false };
  pieChartOptions: ChartConfiguration['options'] = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'right' } } };

  ngOnInit() { this.initializeChart(); }

  initializeChart() {
    if (!this.tableData) return;
    const rawData = this.tableData.data || [];
    this.columns = this.tableData.columns || [];
    if (!rawData.length || !this.columns.length) return;
    const isObj = typeof rawData[0] === 'object' && !Array.isArray(rawData[0]);
    this.dataRows = isObj ? rawData.map((r: any) => this.columns.map((c: string) => r[c] ?? null)) : rawData.slice(1);
    this.displayData = this.dataRows.slice(0, 50);
    this.numericColumns = this.identifyNumericColumns();
    this.selectedXColumn = this.columns[0] || '';
    this.selectedYColumns = this.numericColumns.slice();
    if (this.selectedXColumn && this.selectedYColumns.length) this.updateCharts();
  }

  identifyNumericColumns(): string[] {
    return this.columns.filter((col, i) => {
      const sample = this.dataRows.slice(0, 10).map(r => r[i]);
      return sample.filter(v => v !== null && v !== '' && !isNaN(parseFloat(v))).length > 0;
    });
  }

  removeYColumn(col: string) { this.selectedYColumns = this.selectedYColumns.filter(c => c !== col); if (this.selectedYColumns.length) this.updateCharts(); }

  updateCharts() {
    if (!this.selectedXColumn || !this.selectedYColumns.length) return;
    const xi = this.columns.indexOf(this.selectedXColumn);
    const limited = this.dataRows.slice(0, 20);
    const labels = limited.map(r => String(r[xi] ?? ''));
    const datasets = this.selectedYColumns.map((yc, idx) => {
      const yi = this.columns.indexOf(yc);
      return { data: limited.map(r => parseFloat(r[yi]) || 0), label: yc, backgroundColor: this.getColor(idx, .6), borderColor: this.getColor(idx, 1), borderWidth: 2, fill: false };
    });
    this.chartData = { labels, datasets };
    const fyi = this.columns.indexOf(this.selectedYColumns[0]);
    this.pieChartData = { labels, datasets: [{ data: limited.map(r => parseFloat(r[fyi]) || 0), backgroundColor: labels.map((_, i) => this.getColor(i, .8)) }] };
  }

  getColor(i: number, a = 1): string {
    const c = ['76,175,80','33,150,243','255,152,0','244,67,54','156,39,176','0,188,212','255,87,34','63,81,181'];
    return `rgba(${c[i % c.length]},${a})`;
  }

  calculateSum(col: string): number { const i = this.columns.indexOf(col); return this.dataRows.reduce((s, r) => s + (parseFloat(r[i]) || 0), 0); }
  calculateAverage(col: string): number { return this.dataRows.length ? this.calculateSum(col) / this.dataRows.length : 0; }
  calculateMin(col: string): number { const i = this.columns.indexOf(col); const v = this.dataRows.map(r => parseFloat(r[i])).filter(n => !isNaN(n)); return v.length ? Math.min(...v) : 0; }
  calculateMax(col: string): number { const i = this.columns.indexOf(col); const v = this.dataRows.map(r => parseFloat(r[i])).filter(n => !isNaN(n)); return v.length ? Math.max(...v) : 0; }
}
