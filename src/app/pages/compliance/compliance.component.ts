import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HubTabsComponent, HubTab } from '../../components/hub-tabs/hub-tabs.component';
import { DeadlinesComponent } from '../deadlines/deadlines.component';
import { AuditComponent } from '../audit/audit.component';
import { AlertsComponent } from '../../services/alerts.component';

@Component({
  selector: 'app-compliance',
  standalone: true,
  imports: [CommonModule, HubTabsComponent, DeadlinesComponent, AuditComponent, AlertsComponent],
  template: `
<div class="hub-page">
  <app-hub-tabs [tabs]="tabs" [active]="activeTab" (select)="setTab($event)" />
  <div class="hub-content">
    <app-deadlines *ngIf="activeTab==='deadlines'" />
    <app-alerts    *ngIf="activeTab==='alerts'" />
    <app-audit     *ngIf="activeTab==='audit'" />
  </div>
</div>
  `,
  styles: [`
.hub-page    { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.hub-content { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
.hub-content > * { flex: 1; min-height: 0; overflow: hidden; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComplianceComponent implements OnInit {
  activeTab = 'deadlines';

  tabs: HubTab[] = [
    { key: 'deadlines', label: 'Deadlines',  icon: '⏰' },
    { key: 'alerts',    label: 'Alerts',     icon: '🔔' },
    { key: 'audit',     label: 'Audit Trail', icon: '🛡' },
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
