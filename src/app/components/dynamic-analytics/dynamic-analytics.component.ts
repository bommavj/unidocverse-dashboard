@Component({
    selector: 'app-dynamic-analytics',
    template: `
      <div class="analytics-container">
        <!-- Hero Metrics -->
        <div class="hero-metrics" *ngIf="uiConfig?.hero_metrics">
          <mat-card *ngFor="let metric of uiConfig.hero_metrics" class="metric-card">
            <span class="icon">{{metric.icon}}</span>
            <div class="metric-content">
              <div class="label">{{metric.label}}</div>
              <div class="value">{{formatValue(metric.value, metric.format)}}</div>
            </div>
          </mat-card>
        </div>
  
        <!-- Dynamic Charts -->
        <div class="charts-grid">
          <mat-card *ngFor="let chart of sortedCharts" class="chart-card">
            <mat-card-header>
              <mat-card-title>{{chart.title}}</mat-card-title>
              <mat-card-subtitle *ngIf="chart.subtitle">{{chart.subtitle}}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <app-dynamic-chart 
                [type]="chart.type"
                [data]="getDataByPath(chart.data_path)"
                [config]="chart">
              </app-dynamic-chart>
            </mat-card-content>
          </mat-card>
        </div>
  
        <!-- Dynamic Tables -->
        <mat-card *ngFor="let table of uiConfig?.tables" class="table-card">
          <mat-card-header>
            <mat-card-title>{{table.title}}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <app-dynamic-table 
              [data]="getDataByPath(table.data_path)"
              [columns]="table.columns">
            </app-dynamic-table>
          </mat-card-content>
        </mat-card>
  
        <!-- Insights -->
        <mat-card *ngIf="insights?.length" class="insights-card">
          <mat-card-header>
            <mat-card-title>
              {{uiConfig?.insights_config?.icon}} {{uiConfig?.insights_config?.title}}
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <ul>
              <li *ngFor="let insight of insights">{{insight}}</li>
            </ul>
          </mat-card-content>
        </mat-card>
      </div>
    `
  })
  export class DynamicAnalyticsComponent {
    @Input() analyticsData: any;
    
    uiConfig: any;
    insights: string[];
    
    ngOnChanges() {
      this.uiConfig = this.analyticsData?.ui_config;
      this.insights = this.analyticsData?.insights;
    }
    
    get sortedCharts() {
      return this.uiConfig?.charts?.sort((a, b) => a.priority - b.priority);
    }
    
    getDataByPath(path: string): any {
      return path.split('.').reduce((obj, key) => obj?.[key], this.analyticsData);
    }
    
    formatValue(value: number, format: string): string {
      if (!value) return '—';
      switch(format) {
        case 'currency': return `$${value.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
        case 'number': return value.toLocaleString('en-US');
        case 'percent': return `${value.toFixed(2)}%`;
        default: return String(value);
      }
    }
  }