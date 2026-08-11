import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
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
  private readonly api = 'http://localhost:8000';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    // Load all domain reports — no agent_type filter
    this.http.get<{ reports: AgentReport[] }>(`${this.api}/api/agent-reports?limit=60`)
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

  select(r: AgentReport) { this.selected = r; }

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

  statusClass(s: string): string {
    return s === 'completed' ? 'badge-ok' : s === 'failed' ? 'badge-err' : 'badge-info';
  }

  runNow() {
    this.running = true;
    this.http.post<{ message: string; triggered: number; agents: string[] }>(
      `${this.api}/api/agent-reports/run-now`, {}
    ).subscribe({
      next: res => {
        // Poll for new reports after a short delay to let agents complete
        setTimeout(() => this.reload(), 8000);
      },
      error: () => { this.running = false; }
    });
  }

  private reload() {
    this.http.get<{ reports: AgentReport[] }>(`${this.api}/api/agent-reports?limit=60`)
      .subscribe({
        next: res => {
          this.reports = res.reports;
          this.running = false;
          if (this.reports.length && !this.selected) this.selected = this.reports[0];
          // Auto-select the newest report
          if (this.reports.length) this.selected = this.reports[0];
        },
        error: () => { this.running = false; }
      });
  }
}
