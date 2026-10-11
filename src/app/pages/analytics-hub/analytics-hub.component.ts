import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HubTabsComponent, HubTab } from '../../components/hub-tabs/hub-tabs.component';
import { AnalyticsComponent } from '../analytics/analytics.component';
import { InsightsDashboardComponent } from '../insights-dashboard/insights-dashboard.component';
import { TimelineComponent } from '../timeline/timeline.component';

@Component({
  selector: 'app-analytics-hub',
  standalone: true,
  imports: [CommonModule, HubTabsComponent, AnalyticsComponent, InsightsDashboardComponent, TimelineComponent],
  template: `
<div class="hub-page">
  <app-hub-tabs [tabs]="tabs" [active]="activeTab" (select)="setTab($event)" />
  <div class="hub-content">
    <app-analytics           *ngIf="activeTab==='overview'" />
    <app-insights-dashboard  *ngIf="activeTab==='insights'" />
    <app-timeline            *ngIf="activeTab==='timeline'" />
  </div>
</div>
  `,
  styles: [`
.hub-page    { display:flex; flex-direction:column; height:var(--content-h); min-height:0; }
.hub-content { flex:1; overflow:hidden; display:flex; flex-direction:column; min-height:0; }
.hub-content > * { flex:1; overflow-y:auto; min-height:0; }   /* embedded pages scroll inside the hub */
  `],
})
export class AnalyticsHubComponent implements OnInit {
  activeTab = 'overview';
  tabs: HubTab[] = [
    { key: 'overview',  label: 'Overview' },
    { key: 'insights',  label: 'AI Insights' },
    { key: 'timeline',  label: 'Timeline' },
  ];

  constructor(private route: ActivatedRoute, private router: Router, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.route.queryParams.subscribe(p => {
      if (p['tab'] && this.tabs.find(t => t.key === p['tab'])) {
        this.activeTab = p['tab'];
        this.cdr.markForCheck();
      }
    });
  }

  setTab(key: string) {
    this.activeTab = key;
    this.router.navigate([], { queryParams: { tab: key }, replaceUrl: true });
    this.cdr.markForCheck();
  }
}
