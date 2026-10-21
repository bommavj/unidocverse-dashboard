import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { authFetch } from '../../lib/api';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UdvSelectComponent, SelectOption } from '../../components/udv-select/udv-select.component';

const ACTION_ICONS: Record<string, string> = {
  upload: '⬆', view: '👁', download: '⬇', edit: '✏', delete: '🗑',
  approve: '✓', reject: '✗', comment: '💬', share: '🔗', export: '📤',
  clm_move: '→', workflow_run: '⚙', alert_triggered: '🔔', email_sent: '✉',
  tag_added: '🏷', tag_removed: '🏷', linked: '🔗', unlinked: '🔗',
};
const ACTION_COLOR: Record<string, string> = {
  upload: '#6366f1', view: '#3b82f6', download: '#8b5cf6', edit: '#f59e0b',
  delete: '#ef4444', approve: '#10b981', reject: '#ef4444', comment: '#06b6d4',
  share: '#6366f1', export: '#8b5cf6', clm_move: '#f59e0b', workflow_run: '#3b82f6',
  alert_triggered: '#ef4444', email_sent: '#10b981',
};

interface AuditEvent {
  id: string;
  doc_id?: string;
  action: string;
  actor: string;
  detail?: string;
  ip?: string;
  extra?: any;
  created_at: string;
  filename?: string;
  doc_type?: string;
}

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, FormsModule, UdvSelectComponent],
  templateUrl: './audit.component.html',
  styleUrls: ['./audit.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditComponent implements OnInit {
  events: AuditEvent[] = [];
  summary: any = null;
  loading = true;
  view: 'timeline' | 'table' = 'timeline';

  // Retention (admins): how long reads and changes are kept, legal hold, archives
  showRetention = false;
  retention: any = null;
  retentionSaving = false;
  retentionMsg = '';
  archives: { name: string; size: number; modified: string }[] = [];

  readLabel(d: number): string { return d === 30 ? '30 days' : d === 90 ? '90 days' : d === 365 ? '1 year' : `${d} days`; }
  changeLabel(d: number): string {
    return d === 0 ? 'Keep forever' : d === 365 ? '1 year' : d === 1095 ? '3 years' : d === 2555 ? '7 years' : `${d} days`;
  }

  async toggleRetention() {
    this.showRetention = !this.showRetention;
    if (this.showRetention) await this.loadRetention();
    this.cdr.markForCheck();
  }

  async loadRetention() {
    const [r, a] = await Promise.all([
      authFetch(`${this.api}/api/audit/retention`).then(x => x.ok ? x.json() : null),
      authFetch(`${this.api}/api/audit/archives`).then(x => x.ok ? x.json() : { archives: [] }),
    ]);
    this.retention = r;
    this.archives = a.archives || [];
    if (!r) this.retentionMsg = 'Only administrators can change retention.';
    this.cdr.markForCheck();
  }

  async saveRetention() {
    if (!this.retention) return;
    this.retentionSaving = true; this.retentionMsg = '';
    const res = await authFetch(`${this.api}/api/audit/retention`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read_days: +this.retention.read_days, change_days: +this.retention.change_days,
                             legal_hold: !!this.retention.legal_hold }),
    });
    this.retentionSaving = false;
    this.retentionMsg = res.ok ? 'Saved' : 'Could not save';
    this.cdr.markForCheck();
  }

  async runRetention() {
    this.retentionSaving = true; this.retentionMsg = '';
    const res = await authFetch(`${this.api}/api/audit/retention/run`, { method: 'POST' });
    const r = res.ok ? await res.json() : null;
    this.retentionSaving = false;
    this.retentionMsg = !r ? 'Cleanup failed' : r.skipped ? 'Skipped — legal hold is on'
      : `Archived and removed ${(r.read?.archived || 0) + (r.change?.archived || 0)} entries`;
    await this.loadRetention(); this.load();
  }

  async downloadArchive(name: string) {
    const res = await authFetch(`${this.api}/api/audit/archives/${encodeURIComponent(name)}`);
    if (!res.ok) return;
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  filterAction = '';
  filterActor  = '';
  actions: string[] = [];

  get actionOptions(): SelectOption[] {
    return this.actions.map(a => ({ value: a, label: a }));
  }

  readonly ACTION_ICONS  = ACTION_ICONS;
  readonly ACTION_COLOR  = ACTION_COLOR;
  private readonly api   = 'http://localhost:7979';

  constructor(public cdr: ChangeDetectorRef) {}

  ngOnInit() { this.load(); }

  get filtered(): AuditEvent[] {
    return this.events.filter(e =>
      (!this.filterAction || e.action === this.filterAction) &&
      (!this.filterActor  || e.actor.toLowerCase().includes(this.filterActor.toLowerCase()))
    );
  }

  async load() {
    try {
      const [eventsRes, summaryRes, actionsRes] = await Promise.all([
        authFetch(`${this.api}/api/audit?limit=200`).then(r => r.json()),
        authFetch(`${this.api}/api/audit/summary`).then(r => r.json()),
        authFetch(`${this.api}/api/audit/actions`).then(r => r.json()),
      ]);
      this.events  = eventsRes.events  || [];
      this.summary = summaryRes;
      this.actions = actionsRes.actions || [];
    } catch(e) { console.error(e); }
    this.loading = false;
    this.cdr.markForCheck();
  }

  icon(action: string)  { return ACTION_ICONS[action]  || '•'; }
  color(action: string) { return ACTION_COLOR[action]  || '#6366f1'; }

  fmtDate(iso: string) {
    try { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
    catch { return iso; }
  }

  groupByDay(events: AuditEvent[]): { day: string; items: AuditEvent[] }[] {
    const map = new Map<string, AuditEvent[]>();
    for (const e of events) {
      const day = new Date(e.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(e);
    }
    return Array.from(map.entries()).map(([day, items]) => ({ day, items }));
  }
}
