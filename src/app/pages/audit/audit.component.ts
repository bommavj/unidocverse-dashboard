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
