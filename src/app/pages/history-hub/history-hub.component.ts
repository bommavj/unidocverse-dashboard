import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HubTabsComponent, HubTab } from '../../components/hub-tabs/hub-tabs.component';
import { HistoryComponent } from '../history/history.component';
import { ResearchHistoryComponent } from '../research-history/research-history.component';

@Component({
  selector: 'app-history-hub',
  standalone: true,
  imports: [CommonModule, HubTabsComponent, HistoryComponent, ResearchHistoryComponent],
  template: `
<div class="hub-page">
  <app-hub-tabs [tabs]="tabs" [active]="activeTab" (select)="setTab($event)" />
  <div class="hub-content">
    <app-history *ngIf="activeTab==='documents'" />
    <app-research-history *ngIf="activeTab==='agents'" />
  </div>
</div>
  `,
  styles: [`
.hub-page    { display:flex; flex-direction:column; height:var(--content-h); min-height:0; }
.hub-content { flex:1; overflow:hidden; display:flex; flex-direction:column; min-height:0; }
.hub-content > * { flex:1; overflow-y:auto; min-height:0; }   /* embedded pages scroll inside the hub */
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryHubComponent implements OnInit {
  activeTab = 'documents';
  tabs: HubTab[] = [
    { key: 'documents', label: 'Document conversations' },
    { key: 'agents',    label: 'Agent conversations' },
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
