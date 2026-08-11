// src/app/app.routes.ts
import { Routes, CanDeactivateFn } from '@angular/router';
import { authGuard }   from './services/auth.guard';
import { adminGuard }  from './guards/admin.guard';
import { agencyGuard } from './guards/agency.guard';

interface CanDeactivateComponent { canDeactivate(): boolean; }
const pendingQueryGuard: CanDeactivateFn<CanDeactivateComponent> =
  (component) => component.canDeactivate();

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login',   loadComponent: () => import('./services/login.component').then(m => m.LoginComponent) },
  { path: 'license', loadComponent: () => import('./components/license-upload/license-upload.component').then(m => m.LicenseUploadComponent) },

  // ── Core pages ────────────────────────────────────────────────────────────
  { path: 'disclaimer',   canActivate: [authGuard], loadComponent: () => import('./pages/disclaimer/disclaimer.component').then(m => m.DisclaimerComponent) },
  { path: 'immigration',  canActivate: [authGuard], loadComponent: () => import('./pages/immigration/immigration.component').then(m => m.ImmigrationComponent) },
  { path: 'dashboard',     canActivate: [authGuard], loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent) },
  { path: 'documents',     canActivate: [authGuard], loadComponent: () => import('./pages/documents/documents.component').then(m => m.DocumentsComponent) },
  { path: 'search',        canActivate: [authGuard], loadComponent: () => import('./pages/search/search.component').then(m => m.SearchComponent) },
  { path: 'analytics',     canActivate: [authGuard], loadComponent: () => import('./pages/analytics/analytics.component').then(m => m.AnalyticsComponent) },
  { path: 'analytics/session/:id', canActivate: [authGuard], loadComponent: () => import('./pages/analytics/analytics.component').then(m => m.AnalyticsComponent) },
  { path: 'analytics/:id/advanced',     canActivate: [authGuard], loadComponent: () => import('./components/advanced-analytics/advanced-analytics.component').then(m => m.AdvancedAnalyticsComponent) },
  { path: 'documents/:id/analytics/v2', canActivate: [authGuard], loadComponent: () => import('./components/advanced-analytics-v2/advanced-analytics-v2.component').then(m => m.AdvancedAnalyticsV2Component) },
  { path: 'timeline',      canActivate: [authGuard], loadComponent: () => import('./pages/timeline/timeline.component').then(m => m.TimelineComponent) },
  { path: 'upload',        canActivate: [authGuard], loadComponent: () => import('./pages/upload/upload.component').then(m => m.UploadComponent) },
  { path: 'watch-folders', canActivate: [authGuard], loadComponent: () => import('./pages/watch-folders/watch-folders.component').then(m => m.WatchFoldersComponent) },
  { path: 'gmail',         canActivate: [authGuard], loadComponent: () => import('./pages/gmail/gmail-integration.component').then(m => m.GmailIntegrationComponent) },
  { path: 'insights',      canActivate: [authGuard], loadComponent: () => import('./pages/insights-dashboard/insights-dashboard.component').then(m => m.InsightsDashboardComponent) },
  { path: 'alerts',        canActivate: [authGuard], loadComponent: () => import('./services/alerts.component').then(m => m.AlertsComponent) },
  { path: 'settings',      canActivate: [authGuard], loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent) },
  { path: 'report-issue',  canActivate: [authGuard], loadComponent: () => import('./pages/report-issue/report-issue.component').then(m => m.ReportIssueComponent) },
  { path: 'notes',         canActivate: [authGuard], loadComponent: () => import('./pages/personal/notes/notes.component').then(m => m.NotesComponent) },
  { path: 'planner',       canActivate: [authGuard], loadComponent: () => import('./pages/personal/planner/planner.component').then(m => m.PlannerComponent) },
  { path: 'integrations',  canActivate: [authGuard], loadComponent: () => import('./pages/integrations/integrations.component').then(m => m.IntegrationsComponent) },
  { path: 'code-scanner',  canActivate: [authGuard], loadComponent: () => import('./pages/code-scanner/code-scanner.component').then(m => m.CodeScannerComponent) },
  { path: 'calendar',      canActivate: [authGuard], loadComponent: () => import('./pages/agency/calendar/calendar.component').then(m => m.CalendarComponent) },

  // ── Multi-domain Dashboards ────────────────────────────────────────────────
  { path: 'legal',         canActivate: [authGuard], loadComponent: () => import('./pages/legal/legal.component').then(m => m.LegalComponent) },
  { path: 'healthcare',    canActivate: [authGuard], loadComponent: () => import('./pages/healthcare/healthcare.component').then(m => m.HealthcareComponent) },
  { path: 'finance',       canActivate: [authGuard], loadComponent: () => import('./pages/finance/finance.component').then(m => m.FinanceComponent) },
  { path: 'real-estate',   canActivate: [authGuard], loadComponent: () => import('./pages/real-estate/real-estate.component').then(m => m.RealEstateComponent) },
  { path: 'hr',            canActivate: [authGuard], loadComponent: () => import('./pages/hr/hr.component').then(m => m.HRComponent) },
  { path: 'supply-chain',  canActivate: [authGuard], loadComponent: () => import('./pages/supply-chain/supply-chain.component').then(m => m.SupplyChainComponent) },

  // ── Agency Management — gated by agencyGuard ─────────────────────────────
  {
    path: 'clients',
    canActivate: [authGuard, agencyGuard],
    loadComponent: () => import('./pages/agency/clients/clients.component').then(m => m.ClientsComponent)
  },
  {
    path: 'clients/:id',
    canActivate: [authGuard, agencyGuard],
    loadComponent: () => import('./pages/agency/client-detail/client-detail.component').then(m => m.ClientDetailComponent)
  },
  {
    path: 'policies',
    canActivate: [authGuard, agencyGuard],
    loadComponent: () => import('./pages/agency/policies/policies.component').then(m => m.PoliciesComponent)
  },
  {
    path: 'renewals',
    canActivate: [authGuard, agencyGuard],
    loadComponent: () => import('./pages/agency/renewals/renewals.component').then(m => m.RenewalsComponent)
  },
  {
    path: 'calendar',
    canActivate: [],
    loadComponent: () => import('./pages/agency/calendar/calendar.component').then(m => m.CalendarComponent)
  },
  {
    path: 'commission',
    canActivate: [authGuard, agencyGuard],
    loadComponent: () => import('./pages/agency/commission/commission.component').then(m => m.CommissionComponent)
  },
  {
    path: 'loss-runs',
    canActivate: [authGuard, agencyGuard],
    loadComponent: () => import('./pages/agency/loss-runs/loss-runs.component').then(m => m.LossRunsComponent)
  },
  {
    path: 'gap-analysis',
    canActivate: [authGuard, agencyGuard],
    loadComponent: () => import('./pages/agency/gap-analysis/gap-analysis.component').then(m => m.GapAnalysisComponent)
  },
  {
    path: 'coi',
    canActivate: [authGuard, agencyGuard],
    loadComponent: () => import('./pages/agency/coi/coi.component').then(m => m.CoiComponent)
  },
  {
    path: 'agency-reports',
    canActivate: [authGuard, agencyGuard],
    loadComponent: () => import('./pages/agency/reports/reports.component').then(m => m.AgencyReportsComponent)
  },

  // ── AI & Automation ───────────────────────────────────────────────────────
  { path: 'automation-hub',       canActivate: [authGuard], loadComponent: () => import('./pages/automation-hub/automation-hub.component').then(m => m.AutomationHubComponent) },
  { path: 'agent-builder',        canActivate: [authGuard], loadComponent: () => import('./pages/agent-builder/agent-builder.component').then(m => m.AgentBuilderComponent) },
  { path: 'research',             canActivate: [authGuard], canDeactivate: [pendingQueryGuard], loadComponent: () => import('./pages/research/research.component').then(m => m.ResearchComponent) },
  { path: 'research-history',    canActivate: [authGuard], loadComponent: () => import('./pages/research-history/research-history.component').then(m => m.ResearchHistoryComponent) },
  { path: 'workflow',             canActivate: [authGuard], loadComponent: () => import('./pages/workflow/workflow.component').then(m => m.WorkflowComponent) },
  { path: 'insurance-automation', canActivate: [authGuard], loadComponent: () => import('./pages/insurance-automation/insurance-automation.component').then(m => m.InsuranceAutomationComponent) },

  // ── Analytics & Insights ──────────────────────────────────────────────────
  { path: 'analytics-hub',        canActivate: [authGuard], loadComponent: () => import('./pages/analytics-hub/analytics-hub.component').then(m => m.AnalyticsHubComponent) },
  { path: 'document-analytics',   canActivate: [authGuard], loadComponent: () => import('./pages/document-analytics/document-analytics.component').then(m => m.DocumentAnalyticsComponent) },
  { path: 'history',              canActivate: [authGuard], loadComponent: () => import('./pages/history/history.component').then(m => m.HistoryComponent) },

  // ── Compliance & Risk ─────────────────────────────────────────────────────
  { path: 'compliance',           canActivate: [authGuard], loadComponent: () => import('./pages/compliance/compliance.component').then(m => m.ComplianceComponent) },
  { path: 'risk',                 canActivate: [authGuard], loadComponent: () => import('./pages/risk/risk.component').then(m => m.RiskComponent) },
  { path: 'audit',                canActivate: [authGuard], loadComponent: () => import('./pages/audit/audit.component').then(m => m.AuditComponent) },
  { path: 'deadlines',            canActivate: [authGuard], loadComponent: () => import('./pages/deadlines/deadlines.component').then(m => m.DeadlinesComponent) },

  // ── Operations ────────────────────────────────────────────────────────────
  { path: 'matters',              canActivate: [authGuard], loadComponent: () => import('./pages/matters/matters.component').then(m => m.MattersComponent) },
  { path: 'claims',               canActivate: [authGuard], loadComponent: () => import('./pages/claims/claims.component').then(m => m.ClaimsComponent) },
  { path: 'approvals',            canActivate: [authGuard], loadComponent: () => import('./pages/approvals/approvals.component').then(m => m.ApprovalsComponent) },
  { path: 'quotes',               canActivate: [authGuard], loadComponent: () => import('./pages/quotes/quotes.component').then(m => m.QuotesComponent) },
  { path: 'clm',                  canActivate: [authGuard], loadComponent: () => import('./pages/clm/clm.component').then(m => m.ClmComponent) },
  { path: 'jurisdiction',         canActivate: [authGuard], loadComponent: () => import('./pages/jurisdiction/jurisdiction.component').then(m => m.JurisdictionComponent) },
  { path: 'documents-hub',        canActivate: [authGuard], loadComponent: () => import('./pages/documents-hub/documents-hub.component').then(m => m.DocumentsHubComponent) },

  { path: '**', redirectTo: '/login' },
];