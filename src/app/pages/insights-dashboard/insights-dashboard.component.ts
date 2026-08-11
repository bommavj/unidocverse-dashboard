import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

interface Insight {
  code: string;
  severity: 'critical' | 'warning' | 'info' | 'positive';
  title: string;
  detail: string;
  action: string;
  domain: string;
  value?: number;
  value_label?: string;
  due_date?: string;
  tags: string[];
  document_id: string;
  filename: string;
  doc_type: string;
  created_at?: string;
}

interface InsightGroup {
  document_id: string;
  filename: string;
  doc_type: string;
  domain: string;
  insights: Insight[];
  worstSeverity: 'critical' | 'warning' | 'info' | 'positive';
  criticalCount: number;
  warningCount: number;
}

interface PortfolioStats {
  severity_counts: { critical: number; warning: number; info: number; positive: number };
  risk_score: number;
  risk_level: 'high' | 'medium' | 'low';
  top_issues: { code: string; count: number }[];
  top_tags: { tag: string; count: number }[];
  total_insights: number;
  total_documents: number;
  documents_with_insights: number;
}

@Component({
  selector: 'app-insights-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './insights-dashboard.component.html',
  styleUrls: ['./insights-dashboard.component.scss'],
})
export class InsightsDashboardComponent implements OnInit {

  private readonly base = 'http://localhost:8000';

  stats: PortfolioStats = {
    severity_counts: { critical: 0, warning: 0, info: 0, positive: 0 },
    risk_score: 0,
    risk_level: 'low',
    top_issues: [],
    top_tags: [],
    total_insights: 0,
    total_documents: 0,
    documents_with_insights: 0,
  };

  insights: Insight[] = [];
  tags: { tag: string; count: number }[] = [];

  loading = true;
  loadingInsights = false;
  runningBatch = false;

  // Filters
  selectedDomain = '';
  selectedSeverity = '';
  selectedTag = '';
  searchText = '';

  domains = [
    '', 'insurance', 'bank', 'tax', 'legal', 'medical',
    'payroll', 'loan', 'invoice', 'sales', 'hr', 'compliance',
  ];
  severities = ['', 'critical', 'warning', 'info', 'positive'];

  // Expanded doc group IDs
  expandedDocs = new Set<string>();
  // Expanded individual insight within a group
  expandedInsightId: string | null = null;

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit() {
    this.loadStats();
    this.loadInsights();
    this.loadTags();
  }

  loadStats() {
    this.http.get<PortfolioStats>(`${this.base}/api/insights/stats`).subscribe({
      next: (data) => { this.stats = data; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  loadInsights() {
    this.loadingInsights = true;
    const params: Record<string, any> = { limit: 100 };
    if (this.selectedDomain)   params['domain']   = this.selectedDomain;
    if (this.selectedSeverity) params['severity'] = this.selectedSeverity;
    if (this.selectedTag)      params['tag']      = this.selectedTag;

    this.http.get<any>(`${this.base}/api/insights/portfolio`, { params }).subscribe({
      next: (data) => { this.insights = data.insights || []; this.loadingInsights = false; },
      error: () => { this.loadingInsights = false; },
    });
  }

  loadTags() {
    this.http.get<any>(`${this.base}/api/insights/tags`).subscribe({
      next: (data) => { this.tags = (data.tags || []).slice(0, 12); },
      error: () => {},
    });
  }

  applyFilters() { this.loadInsights(); }

  clearFilters() {
    this.selectedDomain = this.selectedSeverity = this.selectedTag = this.searchText = '';
    this.loadInsights();
  }

  runAll() {
    if (this.runningBatch) return;
    this.runningBatch = true;
    this.http.post<any>(`${this.base}/api/insights/run-all`, {}).subscribe({
      next: () => { this.runningBatch = false; this.loadStats(); this.loadInsights(); this.loadTags(); },
      error: () => { this.runningBatch = false; },
    });
  }

  // ── Grouping ────────────────────────────────────────────────────────────────

  get filteredInsights(): Insight[] {
    if (!this.searchText.trim()) return this.insights;
    const q = this.searchText.toLowerCase();
    return this.insights.filter(i =>
      i.title?.toLowerCase().includes(q) ||
      i.filename?.toLowerCase().includes(q) ||
      i.detail?.toLowerCase().includes(q)
    );
  }

  get groupedInsights(): InsightGroup[] {
    const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2, positive: 3 };
    const map = new Map<string, InsightGroup>();

    for (const ins of this.filteredInsights) {
      if (!map.has(ins.document_id)) {
        map.set(ins.document_id, {
          document_id: ins.document_id,
          filename: ins.filename,
          doc_type: ins.doc_type,
          domain: ins.domain,
          insights: [],
          worstSeverity: 'positive',
          criticalCount: 0,
          warningCount: 0,
        });
      }
      const group = map.get(ins.document_id)!;
      group.insights.push(ins);

      if (SEVERITY_ORDER[ins.severity] < SEVERITY_ORDER[group.worstSeverity]) {
        group.worstSeverity = ins.severity;
      }
      if (ins.severity === 'critical') group.criticalCount++;
      if (ins.severity === 'warning')  group.warningCount++;
    }

    // Sort groups: worst severity first
    return Array.from(map.values()).sort(
      (a, b) => SEVERITY_ORDER[a.worstSeverity] - SEVERITY_ORDER[b.worstSeverity]
    );
  }

  // ── Expand / collapse ───────────────────────────────────────────────────────

  toggleDoc(docId: string) {
    if (this.expandedDocs.has(docId)) {
      this.expandedDocs.delete(docId);
      this.expandedInsightId = null;
    } else {
      this.expandedDocs.add(docId);
    }
  }

  isDocExpanded(docId: string): boolean {
    return this.expandedDocs.has(docId);
  }

  toggleInsight(id: string) {
    this.expandedInsightId = this.expandedInsightId === id ? null : id;
  }

  openDoc(docId: string) {
    this.router.navigate(['/documents'], { queryParams: { open: docId } });
  }

  // ── Display helpers ──────────────────────────────────────────────────────────

  severityIcon(s: string): string {
    return ({ critical: '🔴', warning: '🟡', info: '🔵', positive: '🟢' } as any)[s] ?? '⚪';
  }

  severityLabel(s: string): string {
    return ({ critical: 'Critical', warning: 'Warning', info: 'Info', positive: 'Good' } as any)[s] ?? s;
  }

  domainIcon(d: string): string {
    const m: Record<string, string> = {
      insurance: '🛡️', bank: '🏦', tax: '📋', legal: '⚖️',
      medical: '🏥', payroll: '💵', loan: '🏠', invoice: '📄',
      sales: '📈', hr: '👤', compliance: '✅', unknown: '📁',
    };
    return m[d] ?? '📁';
  }

  riskColor(level: string): string {
    return ({ high: '#ef4444', medium: '#f59e0b', low: '#22c55e' } as any)[level] ?? '#94a3b8';
  }

  tagColor(tag: string): string {
    const colors: Record<string, string> = {
      coverage_gap: '#7c3aed', risk_flag: '#dc2626', renewal: '#d97706',
      positive: '#16a34a', analysis: '#475569',
    };
    for (const [k, v] of Object.entries(colors)) {
      if (tag.includes(k)) return v;
    }
    return '#475569';
  }

  formatCode(code: string): string {
    if (!code) return 'General';
    return code.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  formatTag(tag: string): string {
    return (tag || '').replace(/_/g, ' ');
  }

  get criticalCount(): number  { return this.stats.severity_counts?.critical ?? 0; }
  get warningCount(): number   { return this.stats.severity_counts?.warning  ?? 0; }
  get riskScore(): number      { return this.stats.risk_score ?? 0; }
  get riskLevel(): string      { return this.stats.risk_level ?? 'low'; }
  get docsAnalyzed(): number   { return this.stats.documents_with_insights ?? 0; }
  get totalDocs(): number      { return this.stats.total_documents ?? 0; }
  get docsPercent(): number    { return this.totalDocs > 0 ? Math.round(this.docsAnalyzed / this.totalDocs * 100) : 0; }
  get topIssues()              { return (this.stats.top_issues || []).filter(i => !!i.code); }
  get hasFilters(): boolean    { return !!(this.selectedDomain || this.selectedSeverity || this.selectedTag || this.searchText); }
}