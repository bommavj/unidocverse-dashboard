import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HubTabsComponent, HubTab } from '../../components/hub-tabs/hub-tabs.component';
import { DocumentsComponent } from '../documents/documents.component';
import { ClmComponent } from '../clm/clm.component';
import { ApprovalsComponent } from '../approvals/approvals.component';
import { RiskComponent } from '../risk/risk.component';
import { WorkflowComponent } from '../workflow/workflow.component';
import { FeatureFlagService } from '../../services/feature-flag.service';

@Component({
  selector: 'app-documents-hub',
  standalone: true,
  imports: [CommonModule, HubTabsComponent, DocumentsComponent, ClmComponent, ApprovalsComponent, RiskComponent, WorkflowComponent],
  template: `
<div class="hub-page">
  <app-hub-tabs [tabs]="tabs" [active]="activeTab" (select)="setTab($event)" />
  <div class="hub-content">
    <app-documents  *ngIf="activeTab==='all'" />
    <app-clm        *ngIf="activeTab==='clm'" />
    <app-approvals  *ngIf="activeTab==='approvals'" />
    <app-workflow   *ngIf="activeTab==='workflow'" />
    <app-risk       *ngIf="activeTab==='risk'" />
  </div>
</div>
  `,
  styles: [`
.hub-page    { display:flex; flex-direction:column; height:100%; min-height:0; }
.hub-content { flex:1; overflow:hidden; display:flex; flex-direction:column; min-height:0; }
.hub-content > * { flex:1; overflow:hidden; min-height:0; }
  `],
})
export class DocumentsHubComponent implements OnInit {
  activeTab = 'all';
  tabs: HubTab[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private flags: FeatureFlagService,
  ) {}

  ngOnInit() {
    this.buildTabs();
    this.route.queryParams.subscribe(p => {
      if (p['tab'] && this.tabs.find(t => t.key === p['tab'])) {
        this.activeTab = p['tab'];
      } else {
        this.activeTab = 'all';
      }
    });
  }

  buildTabs() {
    this.tabs = [{ key: 'all', label: 'All Documents', icon: '📄' }];

    if (this.flags.legalMode() || this.flags.agencyMode()) {
      this.tabs.push({ key: 'approvals',  label: 'Approvals',           icon: '✅' });
      this.tabs.push({ key: 'workflow',   label: 'Approval Workflows',  icon: '🔀' });
    }

    if (this.flags.legalMode()) {
      this.tabs.push({ key: 'clm', label: 'Contracts (CLM)', icon: '📝' });
    }

    if (this.flags.medicalMode()) {
      this.tabs.push({ key: 'risk', label: 'Risk & Health', icon: '🏥' });
    }
  }

  setTab(key: string) {
    this.activeTab = key;
    this.router.navigate([], { queryParams: { tab: key }, replaceUrl: true });
  }
}
