import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';

interface ReportSection {
  [key: string]: any;
}

interface AgentReport {
  id: string;
  agent_type: string;
  report_date: string;
  title: string;
  summary: string;
  body: { sections?: ReportSection; [key: string]: any };
  created_at: string;
  run_status: string;
}

const DOMAIN_LABELS: Record<string, string> = {
  insurance:    'Insurance Agency',
  hr:           'HR & People',
  real_estate:  'Real Estate',
  legal:        'Legal',
  finance:      'Finance',
  medical:      'Medical',
  supply_chain: 'Supply Chain',
  compliance:   'Compliance & Risk',
  operations:   'Operations',
  immigration:  'Immigration',
};

@Component({
  selector: 'app-agency-reports',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss']
})
export class AgencyReportsComponent implements OnInit {
  reports: AgentReport[] = [];
  selected: AgentReport | null = null;
  loading = true;
  running = false;
  agentType: string | null = null;
  pageTitle = 'AI Reports';
  readonly pageSize = 25;
  sectionPages: Record<string, number> = {};
  private readonly api = 'http://localhost:7979';

  constructor(private http: HttpClient, private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.queryParamMap.subscribe(params => {
      this.agentType = params.get('type');
      this.pageTitle = this.agentType ? (DOMAIN_LABELS[this.agentType] ?? this.agentType) + ' AI Reports' : 'AI Reports';
      this.load();
    });
  }

  private load() {
    this.loading = true;
    const url = this.agentType
      ? `${this.api}/api/agent-reports?limit=30&agent_type=${this.agentType}`
      : `${this.api}/api/agent-reports?limit=60`;
    this.http.get<{ reports: AgentReport[] }>(url)
      .subscribe({
        next: res => { this.reports = res.reports; this.loading = false;
                       if (this.reports.length) this.selected = this.reports[0]; },
        error: ()  => { this.loading = false; }
      });
  }

  domainIcon(agentType: string): string {
    const icons: Record<string, string> = {
      insurance:    '🛡️',
      legal:        '⚖️',
      medical:      '🏥',
      finance:      '💰',
      hr:           '👥',
      real_estate:  '🏠',
      supply_chain: '📦',
    };
    return icons[agentType] ?? '📊';
  }

  select(r: AgentReport) { this.selected = r; this.sectionPages = {}; }

  sections(): { label: string; data: any }[] {
    if (!this.selected?.body?.sections) return [];
    return Object.entries(this.selected.body.sections).map(([k, v]) => ({
      label: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      data: v
    }));
  }

  isArray(v: any): boolean { return Array.isArray(v); }
  isObject(v: any): boolean { return v !== null && typeof v === 'object' && !Array.isArray(v); }

  objectEntries(v: any): { k: string; v: any }[] {
    return Object.entries(v).map(([k, val]) => ({
      k: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      v: val
    }));
  }

  currentPage(label: string): number { return this.sectionPages[label] ?? 0; }
  totalPages(data: any[]): number { return Math.ceil(data.length / this.pageSize); }
  pagedRows(label: string, data: any[]): any[] {
    const p = this.currentPage(label);
    return data.slice(p * this.pageSize, (p + 1) * this.pageSize);
  }
  prevPage(label: string) { this.sectionPages[label] = Math.max(0, this.currentPage(label) - 1); }
  nextPage(label: string, data: any[]) {
    this.sectionPages[label] = Math.min(this.totalPages(data) - 1, this.currentPage(label) + 1);
  }

  statusClass(s: string): string {
    return s === 'completed' ? 'badge-ok' : s === 'failed' ? 'badge-err' : 'badge-info';
  }

  downloadPdf() {
    if (!this.selected) return;
    const secs = this.sections();
    const formatValue = (v: any): string => {
      if (v === null || v === undefined) return '—';
      if (typeof v === 'number') return v.toLocaleString();
      return String(v);
    };
    const renderSection = (sec: { label: string; data: any }): string => {
      if (this.isObject(sec.data)) {
        const rows = this.objectEntries(sec.data)
          .map(e => `<tr><td class="kpi-k">${e.k}</td><td class="kpi-v">${formatValue(e.v)}</td></tr>`)
          .join('');
        return `<table class="kpi-tbl">${rows}</table>`;
      }
      if (this.isArray(sec.data) && sec.data.length > 0) {
        const cols = this.objectEntries(sec.data[0]);
        const head = cols.map(c => `<th>${c.k}</th>`).join('');
        const body = sec.data.map((row: any) =>
          `<tr>${this.objectEntries(row).map(e => `<td>${formatValue(e.v)}</td>`).join('')}</tr>`
        ).join('');
        return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
      }
      return `<p class="empty">No data for this period</p>`;
    };

    const sectionsHtml = secs.map(sec => `
      <div class="section">
        <div class="sec-title">${sec.label}</div>
        ${renderSection(sec)}
      </div>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${this.selected.title}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a2e; margin: 32px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #666; font-size: 11px; margin-bottom: 8px; }
  .summary { background: #f0f4ff; border-left: 4px solid #6366f1; padding: 10px 14px; border-radius: 4px; margin-bottom: 24px; font-size: 13px; }
  .section { margin-bottom: 24px; page-break-inside: avoid; }
  .sec-title { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #6366f1; border-bottom: 1px solid #e0e0f0; padding-bottom: 4px; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #f5f5ff; text-align: left; padding: 6px 8px; font-weight: 600; border-bottom: 2px solid #d0d0e8; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; }
  tr:last-child td { border-bottom: none; }
  .kpi-tbl { width: auto; }
  .kpi-k { color: #555; width: 200px; }
  .kpi-v { font-weight: 600; }
  .empty { color: #999; font-style: italic; }
  @media print { body { margin: 16px; } }
</style></head><body>
<h1>${this.selected.title}</h1>
<div class="meta">Generated ${new Date(this.selected.created_at).toLocaleString()} &nbsp;|&nbsp; ${this.pageTitle}</div>
<div class="summary">${this.selected.summary}</div>
${sectionsHtml}
</body></html>`;

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  }

  runNow() {
    this.running = true;
    const url = this.agentType
      ? `${this.api}/api/agent-reports/run-now?agent_type=${this.agentType}`
      : `${this.api}/api/agent-reports/run-now`;
    this.http.post<{ message: string; triggered: number; agents: string[] }>(
      url, {}
    ).subscribe({
      next: () => { setTimeout(() => this.reload(), 8000); },
      error: () => { this.running = false; }
    });
  }

  private reload() {
    const url = this.agentType
      ? `${this.api}/api/agent-reports?limit=30&agent_type=${this.agentType}`
      : `${this.api}/api/agent-reports?limit=60`;
    this.http.get<{ reports: AgentReport[] }>(url)
      .subscribe({
        next: res => {
          this.reports = res.reports;
          this.running = false;
          if (this.reports.length) this.selected = this.reports[0];
        },
        error: () => { this.running = false; }
      });
  }
}
