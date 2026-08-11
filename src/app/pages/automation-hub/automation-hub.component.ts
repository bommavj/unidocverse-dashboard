import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HubTabsComponent, HubTab } from '../../components/hub-tabs/hub-tabs.component';
import { AgentBuilderComponent } from '../agent-builder/agent-builder.component';
import { WorkflowComponent } from '../workflow/workflow.component';

@Component({
  selector: 'app-automation-hub',
  standalone: true,
  imports: [CommonModule, HubTabsComponent, AgentBuilderComponent, WorkflowComponent],
  template: `
<div class="hub-page">
  <app-hub-tabs [tabs]="tabs" [active]="activeTab" (select)="setTab($event)" />
  <div class="hub-content">
    <app-agent-builder *ngIf="activeTab==='agents'" />
    <app-workflow      *ngIf="activeTab==='workflows'" />
  </div>
</div>
  `,
  styles: [`
.hub-page    { display:flex; flex-direction:column; height:calc(100vh - 56px); }
.hub-content { flex:1; overflow:hidden; display:flex; flex-direction:column; min-height:0; }
.hub-content > * { flex:1; overflow:hidden; min-height:0; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutomationHubComponent implements OnInit {
  activeTab = 'agents';
  tabs: HubTab[] = [
    { key: 'agents',    label: 'Agent Builder' },
    { key: 'workflows', label: 'Workflows' },
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
