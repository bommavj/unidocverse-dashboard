import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HubTabsComponent, HubTab } from '../../components/hub-tabs/hub-tabs.component';
import { DocumentsComponent } from '../documents/documents.component';
import { ClmComponent } from '../clm/clm.component';
import { ApprovalsComponent } from '../approvals/approvals.component';
import { HttpClient } from '@angular/common/http';
import { FeatureFlagService } from '../../services/feature-flag.service';

@Component({
  selector: 'app-documents-hub',
  standalone: true,
  imports: [CommonModule, HubTabsComponent, DocumentsComponent, ClmComponent, ApprovalsComponent],
  template: `
<div class="hub-page">
  <app-hub-tabs [tabs]="tabs" [active]="activeTab" (select)="setTab($event)" />
  <div class="hub-content">
    <app-documents  *ngIf="activeTab==='all'" />
    <app-clm        *ngIf="activeTab==='clm'" />
    <app-approvals  *ngIf="activeTab==='approvals'" />
  </div>
</div>
  `,
  styles: [`
.hub-page    { display:flex; flex-direction:column; height:var(--content-h); min-height:0; }
.hub-content { flex:1; overflow:hidden; display:flex; flex-direction:column; min-height:0; }
.hub-content > * { flex:1; overflow-y:auto; min-height:0; }   /* embedded pages scroll inside the hub */
  `],
})
export class DocumentsHubComponent implements OnInit {
  activeTab = 'all';
  tabs: HubTab[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private flags: FeatureFlagService,
    private http: HttpClient,
  ) {}

  pendingApprovals = 0;

  ngOnInit() {
    this.buildTabs();
    this.http.get<any>('http://localhost:7979/api/approvals/stats').subscribe({
      next: r => { this.pendingApprovals = r?.pending ?? 0; this.buildTabs(); }, error: () => {} });
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

    // Sign-offs between people: the tab appears only while something is waiting (or when linked to directly).
    // The research agent asks for its own confirmations in the chat.
    if (this.pendingApprovals > 0 || this.route.snapshot.queryParams['tab'] === 'approvals') {
      this.tabs.push({ key: 'approvals', label: `Approvals (${this.pendingApprovals})`, icon: '✅' });
    }

    if (this.flags.clmMode()) {
      this.tabs.push({ key: 'clm', label: 'Contracts (CLM)', icon: '📝' });
    }

  }

  setTab(key: string) {
    this.activeTab = key;
    this.router.navigate([], { queryParams: { tab: key }, replaceUrl: true });
  }
}
