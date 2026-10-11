import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ConfirmService } from '../../services/confirm.service';
import { UdvSelectComponent, SelectOption } from '../../components/udv-select/udv-select.component';

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  trigger_config: any;
  condition_config: any;
  action_type: string;
  action_config: any;
  enabled: boolean;
  run_count: number;
  last_run_at: string | null;
  running?: boolean;
}

interface LogEntry {
  id?: string;
  timestamp: string;
  rule_name: string;
  entity: string;
  action_taken: string;
  result: string;
  error?: string;
}

interface Notification {
  id: string;
  message: string;
  priority: string;
  created_at: string;
  read: boolean;
}

const TRIGGER_LABELS: Record<string, string> = {
  quote_created: 'Quote Created',
  quote_stage_changed: 'Quote Stage Changed',
  carrier_no_response: 'Carrier No Response',
  quote_expiring: 'Quote Expiring',
  policy_expiring: 'Policy Expiring',
  carrier_quote_received: 'Carrier Quote Received',
  quote_below_minimum: 'Quote Below Jurisdiction Minimum',
  quote_comparing: 'Quote Enters Comparing Stage',
  quote_bound: 'Quote Bound (Policy Created)',
  renewal_due: 'Renewal Due',
};

const ACTION_LABELS: Record<string, string> = {
  notify_agent: 'Notify Assigned Agent',
  send_email_client: 'Send Email to Client',
  send_email_carrier: 'Send Email to Carrier',
  send_comparison: 'Send Comparison to Client',
  flag_compliance: 'Flag for Compliance',
  create_renewal_quote: 'Auto-Create Renewal Quote',
  move_stage: 'Move to Stage',
  block_bind: 'Block Binding Until Reviewed',
  create_task: 'Create Follow-up Task',
};

const STAGES = ['new', 'gathering_info', 'quoting', 'comparing', 'binding', 'bound', 'cancelled'];
const LOBS = ['any', 'auto', 'homeowners', 'commercial_auto', 'commercial_property', 'liability', 'workers_comp', 'life', 'health'];

@Component({
  selector: 'app-insurance-automation',
  standalone: true,
  imports: [CommonModule, FormsModule, UdvSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="ia-root">
  <!-- Toast -->
  <div class="toast" *ngIf="toastMsg" [class.toast-error]="toastIsError">{{ toastMsg }}</div>

  <!-- Header -->
  <div class="ia-header">
    <div class="ia-header-left">
      <h1 class="ia-title">Insurance Workflow Automation</h1>
      <p class="ia-subtitle">
        Rules run every hour automatically.
        <span *ngIf="schedulerStatus" class="sched-status">
          <span *ngIf="schedulerStatus.last_run">
            · Last run: <strong>{{ timeAgo(schedulerStatus.last_run) }}</strong>
            <span *ngIf="schedulerStatus.last_actions > 0"> ({{ schedulerStatus.last_actions }} action{{ schedulerStatus.last_actions === 1 ? '' : 's' }})</span>
          </span>
          <span *ngIf="!schedulerStatus.last_run"> · Never run yet</span>
          <span *ngIf="schedulerStatus.next_run"> · Next in <strong>{{ timeUntil(schedulerStatus.next_run) }}</strong></span>
        </span>
      </p>
    </div>
    <div class="ia-header-actions">
      <button class="btn btn-secondary" (click)="seedTemplates()" [disabled]="loading">
        &#9889; Seed Templates
      </button>
      <button class="btn btn-primary" (click)="runNow()" [disabled]="loading">
        &#9654; Run Now
      </button>
      <div class="notif-wrapper">
        <button class="btn btn-icon" (click)="toggleNotifications()">
          &#128276;
          <span class="badge" *ngIf="unreadCount > 0">{{ unreadCount }}</span>
        </button>
        <div class="notif-dropdown" *ngIf="showNotifications">
          <div class="notif-header">
            <span>Notifications</span>
            <button class="btn-link" (click)="markAllRead()">Mark all read</button>
          </div>
          <div class="notif-empty" *ngIf="notifications.length === 0">No notifications</div>
          <div class="notif-item" *ngFor="let n of notifications" [class.notif-unread]="!n.read">
            <div class="notif-msg">{{ n.message }}</div>
            <div class="notif-meta">
              <span class="priority-badge" [class.priority-high]="n.priority === 'high'" [class.priority-normal]="n.priority !== 'high'">
                {{ n.priority }}
              </span>
              <span class="notif-time">{{ timeAgo(n.created_at) }}</span>
              <button class="btn-link" *ngIf="!n.read" (click)="markRead(n.id)">✓</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Main layout -->
  <div class="ia-body" [class.panel-open]="panelOpen">
    <!-- Rules list -->
    <div class="ia-rules-area">
      <div class="rules-empty" *ngIf="!loading && rules.length === 0">
        <div class="empty-icon">&#9889;</div>
        <p>No automation rules yet. Click 'Seed Templates' to load 9 pre-built rules.</p>
      </div>

      <div class="rules-grid" *ngIf="rules.length > 0">
        <div class="rule-card" *ngFor="let rule of rules">
          <div class="rule-card-top">
            <label class="toggle-switch">
              <input type="checkbox" [checked]="rule.enabled" (change)="toggleRule(rule)">
              <span class="toggle-slider"></span>
            </label>
            <div class="rule-info">
              <div class="rule-name">{{ rule.name }}</div>
              <div class="rule-desc">{{ rule.description }}</div>
            </div>
            <div class="rule-actions-btns">
              <button class="btn btn-sm btn-edit" (click)="openEdit(rule)">&#9998;</button>
              <button class="btn btn-sm btn-delete" (click)="deleteRule(rule)">&#128465;</button>
            </div>
          </div>

          <div class="rule-flow">
            <span class="badge-trigger">{{ getTriggerLabel(rule) }}</span>
            <span class="arrow">&#8594;</span>
            <span class="badge-action">{{ getActionLabel(rule) }}</span>
          </div>

          <div class="rule-footer">
            <div class="rule-stats">
              <span>Fired {{ rule.run_count }} times</span>
              <span class="dot">·</span>
              <span>Last run: {{ rule.last_run_at ? timeAgo(rule.last_run_at) : 'Never run' }}</span>
            </div>
            <button class="btn btn-run-single" [disabled]="rule.running" (click)="runSingle(rule); $event.stopPropagation()" title="Run this rule now">
              <span *ngIf="!rule.running">▶ Run</span>
              <span *ngIf="rule.running">⏳ Running…</span>
            </button>
          </div>
        </div>
      </div>

      <div class="add-rule-row">
        <button class="btn btn-outline" (click)="openCreate()">+ New Rule</button>
      </div>

      <!-- Activity log -->
      <div class="log-section">
        <div class="log-header" (click)="logExpanded = !logExpanded">
          <span>&#128203; Activity Log</span>
          <span class="log-chevron">{{ logExpanded ? '&#9650;' : '&#9660;' }}</span>
          <button class="btn btn-sm" (click)="$event.stopPropagation(); loadLog()">Refresh Log</button>
        </div>
        <div class="log-body" *ngIf="logExpanded">
          <div class="log-empty" *ngIf="log.length === 0">No recent activity.</div>
          <table class="log-table" *ngIf="log.length > 0">
            <thead>
              <tr>
                <th>Time</th>
                <th>Rule</th>
                <th>Entity</th>
                <th>Action</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let entry of log">
                <td class="log-time">{{ timeAgo(entry.timestamp) }}</td>
                <td>{{ entry.rule_name }}</td>
                <td>{{ entry.entity }}</td>
                <td>{{ entry.action_taken }}</td>
                <td>
                  <span class="result-badge" [class.result-ok]="entry.result === 'ok'" [class.result-error]="entry.result !== 'ok'">
                    {{ entry.result }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Right panel -->
    <div class="ia-panel" *ngIf="panelOpen">
      <div class="panel-header">
        <h2>{{ editingRule ? 'Edit Rule' : 'New Rule' }}</h2>
        <button class="btn btn-icon" (click)="closePanel()">&#10005;</button>
      </div>

      <div class="panel-body">
        <div class="field-group">
          <label>Name</label>
          <input class="form-input" type="text" [(ngModel)]="form.name" placeholder="Rule name">
        </div>
        <div class="field-group">
          <label>Description</label>
          <textarea class="form-input" rows="2" [(ngModel)]="form.description" placeholder="What this rule does"></textarea>
        </div>

        <!-- WHEN -->
        <div class="section-label when-label">WHEN</div>
        <div class="field-group">
          <label>Trigger</label>
          <udv-select [(ngModel)]="form.trigger_type" [options]="triggerOptions" placeholder="Select trigger…" (valueChange)="onTriggerChange()"></udv-select>
        </div>
        <div class="field-group" *ngIf="triggerHasDays(form.trigger_type)">
          <label>Days</label>
          <input class="form-input" type="number" [(ngModel)]="form.trigger_days" min="1" placeholder="Number of days">
        </div>
        <div class="field-group" *ngIf="form.trigger_type === 'quote_stage_changed'">
          <label>Stage</label>
          <udv-select [(ngModel)]="form.trigger_stage" [options]="stageOptionsWithAny" placeholder="Any stage"></udv-select>
        </div>

        <!-- IF -->
        <div class="section-label if-label">IF (optional conditions)</div>
        <div class="field-group">
          <label>Line of Business</label>
          <udv-select [(ngModel)]="form.condition_lob" [options]="lobOptions" placeholder="Any LOB"></udv-select>
        </div>
        <div class="field-group">
          <label>Stage filter</label>
          <udv-select [(ngModel)]="form.condition_stage" [options]="stageOptionsWithAny" placeholder="Any stage"></udv-select>
        </div>

        <!-- THEN -->
        <div class="section-label then-label">THEN</div>
        <div class="field-group">
          <label>Action</label>
          <udv-select [(ngModel)]="form.action_type" [options]="actionOptions" placeholder="Select action…" (valueChange)="onActionChange()"></udv-select>
        </div>

        <!-- Message fields -->
        <div class="field-group" *ngIf="actionHasMessage(form.action_type)">
          <label>Message</label>
          <textarea class="form-input" rows="3" [(ngModel)]="form.action_message" placeholder="Message text"></textarea>
        </div>
        <div *ngIf="actionHasEmail(form.action_type)">
          <div class="field-group">
            <label>Subject</label>
            <input class="form-input" type="text" [(ngModel)]="form.action_subject" placeholder="Email subject">
          </div>
          <div class="field-group">
            <label>Body</label>
            <textarea class="form-input" rows="4" [(ngModel)]="form.action_body" placeholder="Email body"></textarea>
          </div>
        </div>
        <div class="field-group" *ngIf="form.action_type === 'move_stage'">
          <label>Move to Stage</label>
          <udv-select [(ngModel)]="form.action_stage" [options]="stageOptions" placeholder="Select stage"></udv-select>
        </div>
        <div *ngIf="form.action_type === 'create_renewal_quote'">
          <div class="field-group">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="form.action_assign_original">
              Assign to original agent
            </label>
          </div>
          <div class="field-group">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="form.action_same_carriers">
              Add same carriers
            </label>
          </div>
        </div>

        <!-- Priority for notify_agent -->
        <div class="field-group" *ngIf="form.action_type === 'notify_agent'">
          <label>Priority</label>
          <udv-select [(ngModel)]="form.action_priority" [options]="priorityOptions" placeholder="Select priority…"></udv-select>
        </div>

        <div class="field-group">
          <label class="checkbox-label">
            <input type="checkbox" [(ngModel)]="form.enabled">
            Enable this rule
          </label>
        </div>

        <div class="panel-footer">
          <button class="btn btn-secondary" (click)="closePanel()">Cancel</button>
          <button class="btn btn-primary" (click)="saveRule()" [disabled]="saving">
            {{ saving ? 'Saving...' : 'Save Rule' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
  `,
  styles: [`
    .ia-root {
      min-height: var(--content-h);
      background: #f8fafc;
      color: #1e293b;
      font-family: Inter, -apple-system, sans-serif;
      padding: 0;
      position: relative;
    }
    :host-context(html.dark-mode) .ia-root {
      background: #0f1117;
      color: #e2e8f0;
    }

    /* Toast */
    .toast {
      position: fixed;
      top: 20px;
      right: 24px;
      background: #10b981;
      color: #fff;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 9999;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      animation: slideIn 0.2s ease;
    }
    .toast-error { background: #ef4444; }
    @keyframes slideIn {
      from { transform: translateX(40px); opacity: 0; }
      to   { transform: translateX(0);   opacity: 1; }
    }

    /* Header */
    .ia-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 28px 32px 20px;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;
      gap: 16px;
    }
    :host-context(html.dark-mode) .ia-header { border-bottom-color: #1e2330; }
    .ia-title {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 4px;
    }
    :host-context(html.dark-mode) .ia-title { color: #f1f5f9; }
    .ia-subtitle {
      font-size: 13px;
      color: #64748b;
      margin: 0;
    }
    .sched-status { font-size: 12px; color: #94a3b8; }
    .sched-status strong { color: #4f46e5; font-weight: 600; }
    :host-context(html.dark-mode) .sched-status { color: #64748b; }
    :host-context(html.dark-mode) .sched-status strong { color: #a5b4fc; }
    .ia-header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    /* Buttons */
    .btn {
      padding: 8px 16px;
      border-radius: 8px;
      border: none;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.15s, background 0.15s;
    }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary  { background: #6366f1; color: #fff; }
    .btn-primary:hover:not(:disabled) { background: #4f46e5; }
    .btn-secondary { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
    .btn-secondary:hover:not(:disabled) { background: #e2e8f0; }
    :host-context(html.dark-mode) .btn-secondary { background: #1e2330; color: #cbd5e1; border-color: #2d3748; }
    :host-context(html.dark-mode) .btn-secondary:hover:not(:disabled) { background: #252d3d; }
    .btn-outline { background: transparent; color: #6366f1; border: 1px solid #6366f1; }
    .btn-outline:hover { background: #6366f115; }
    .btn-icon { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; padding: 8px 12px; position: relative; }
    :host-context(html.dark-mode) .btn-icon { background: #1e2330; color: #cbd5e1; border-color: #2d3748; }
    .btn-sm { padding: 4px 8px; font-size: 12px; border-radius: 6px; }
    .btn-edit   { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }
    .btn-edit:hover { color: #6366f1; border-color: #6366f1; }
    :host-context(html.dark-mode) .btn-edit { background: #1e2330; color: #94a3b8; border-color: #2d3748; }
    .btn-delete { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }
    .btn-delete:hover { color: #ef4444; border-color: #ef4444; }
    :host-context(html.dark-mode) .btn-delete { background: #1e2330; color: #94a3b8; border-color: #2d3748; }
    .btn-link { background: none; border: none; color: #6366f1; cursor: pointer; font-size: 12px; padding: 0; }
    .btn-run-single { background: #eef2ff; color: #4f46e5; border: 1px solid #c7d2fe; padding: 4px 12px; font-size: 11px; font-weight: 600; border-radius: 6px; cursor: pointer; transition: all .15s; white-space: nowrap; }
    .btn-run-single:hover:not(:disabled) { background: #4f46e5; color: #fff; }
    .btn-run-single:disabled { opacity: .55; cursor: not-allowed; }
    :host-context(html.dark-mode) .btn-run-single { background: #1e1b4b; color: #a5b4fc; border-color: #3730a3; }

    /* Notification badge */
    .badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #ef4444;
      color: #fff;
      border-radius: 9999px;
      font-size: 10px;
      padding: 1px 5px;
      font-weight: 700;
    }

    /* Notification dropdown */
    .notif-wrapper { position: relative; }
    .notif-dropdown {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: 340px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.12);
      z-index: 200;
      max-height: 420px;
      overflow-y: auto;
    }
    :host-context(html.dark-mode) .notif-dropdown { background: #161b27; border-color: #2d3748; box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
    .notif-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
    }
    :host-context(html.dark-mode) .notif-header { border-bottom-color: #2d3748; color: #f1f5f9; }
    .notif-item {
      padding: 12px 16px;
      border-bottom: 1px solid #f1f5f9;
    }
    :host-context(html.dark-mode) .notif-item { border-bottom-color: #1e2330; }
    .notif-unread { background: #f8faff; }
    :host-context(html.dark-mode) .notif-unread { background: #1a1f2e; }
    .notif-msg { font-size: 13px; color: #1e293b; margin-bottom: 6px; }
    :host-context(html.dark-mode) .notif-msg { color: #e2e8f0; }
    .notif-meta { display: flex; align-items: center; gap: 8px; }
    .notif-time { font-size: 11px; color: #64748b; flex: 1; }
    .priority-badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
    .priority-high   { background: #ef44441a; color: #ef4444; }
    .priority-normal { background: #6366f11a; color: #818cf8; }
    .notif-empty { padding: 20px 16px; font-size: 13px; color: #64748b; text-align: center; }

    /* Body layout */
    .ia-body {
      display: flex;
      height: calc(var(--content-h) - 110px);
      overflow: hidden;
    }
    .ia-rules-area {
      flex: 1;
      overflow-y: auto;
      padding: 24px 32px;
    }
    .panel-open .ia-rules-area { padding-right: 16px; }

    /* Empty state */
    .rules-empty {
      text-align: center;
      padding: 80px 20px;
      color: #475569;
    }
    .empty-icon { font-size: 48px; margin-bottom: 16px; }

    /* Rules grid */
    .rules-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    @media (max-width: 900px) { .rules-grid { grid-template-columns: 1fr; } }

    /* Rule card */
    .rule-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: border-color 0.2s;
    }
    .rule-card:hover { border-color: #a5b4fc; }
    :host-context(html.dark-mode) .rule-card { background: #161b27; border-color: #1e2a3a; }
    :host-context(html.dark-mode) .rule-card:hover { border-color: #6366f133; }
    .rule-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; }

    .rule-card-top {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .rule-info { flex: 1; min-width: 0; }
    .rule-name { font-size: 14px; font-weight: 600; color: #0f172a; }
    :host-context(html.dark-mode) .rule-name { color: #f1f5f9; }
    .rule-desc { font-size: 12px; color: #64748b; margin-top: 2px; }
    .rule-actions-btns { display: flex; gap: 6px; flex-shrink: 0; }

    .rule-flow {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .badge-trigger {
      background: #8b5cf61a;
      color: #a78bfa;
      border: 1px solid #8b5cf633;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 500;
    }
    .badge-action {
      background: #10b9811a;
      color: #34d399;
      border: 1px solid #10b98133;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 500;
    }
    .arrow { color: #475569; font-size: 16px; }

    .rule-stats {
      font-size: 11px;
      color: #64748b;
      display: flex;
      gap: 6px;
    }
    .dot { color: #2d3748; }

    /* Toggle switch */
    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 36px;
      height: 20px;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .toggle-switch input { opacity: 0; width: 0; height: 0; }
    .toggle-slider {
      position: absolute;
      cursor: pointer;
      inset: 0;
      background: #2d3748;
      border-radius: 9999px;
      transition: background 0.2s;
    }
    .toggle-slider::before {
      content: '';
      position: absolute;
      height: 14px;
      width: 14px;
      left: 3px;
      bottom: 3px;
      background: #94a3b8;
      border-radius: 50%;
      transition: transform 0.2s, background 0.2s;
    }
    .toggle-switch input:checked + .toggle-slider { background: #6366f1; }
    .toggle-switch input:checked + .toggle-slider::before {
      transform: translateX(16px);
      background: #fff;
    }

    /* Add rule row */
    .add-rule-row { margin: 20px 0; }

    /* Activity log */
    .log-section {
      background: #161b27;
      border: 1px solid #1e2a3a;
      border-radius: 12px;
      overflow: hidden;
      margin-top: 8px;
    }
    .log-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 18px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      color: #cbd5e1;
      user-select: none;
    }
    .log-header:hover { background: #1a2035; }
    .log-chevron { margin-right: auto; color: #475569; }
    .log-body { padding: 0 18px 18px; }
    .log-empty { color: #64748b; font-size: 13px; padding: 16px 0; }
    .log-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .log-table th {
      color: #64748b;
      text-align: left;
      padding: 8px 6px;
      border-bottom: 1px solid #1e2330;
      font-weight: 600;
    }
    .log-table td {
      padding: 8px 6px;
      border-bottom: 1px solid #1a1f2e;
      color: #94a3b8;
    }
    .log-time { white-space: nowrap; color: #64748b; }
    .result-badge { padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px; }
    .result-ok    { background: #10b9811a; color: #34d399; }
    .result-error { background: #ef44441a; color: #f87171; }

    /* Right panel */
    .ia-panel {
      width: 400px;
      flex-shrink: 0;
      background: #f8fafc;
      border-left: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      animation: slideRight 0.2s ease;
    }
    :host-context(html.dark-mode) .ia-panel { background: #161b27; border-left-color: #1e2a3a; }
    @keyframes slideRight {
      from { transform: translateX(40px); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }
    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid #e2e8f0;
    }
    :host-context(html.dark-mode) .panel-header { border-bottom-color: #1e2a3a; }
    .panel-header h2 {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }
    :host-context(html.dark-mode) .panel-header h2 { color: #f1f5f9; }
    .panel-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px 24px;
    }
    .panel-footer {
      display: flex;
      gap: 10px;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #1e2a3a;
    }
    .panel-footer .btn { flex: 1; }

    /* Form */
    .field-group { margin-bottom: 14px; }
    .field-group label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #94a3b8;
      margin-bottom: 5px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .form-input {
      width: 100%;
      background: #0f1117;
      border: 1px solid #2d3748;
      border-radius: 8px;
      color: #e2e8f0;
      padding: 9px 12px;
      font-size: 13px;
      box-sizing: border-box;
      outline: none;
      resize: vertical;
    }
    .form-input:focus { border-color: #6366f1; }
    .form-input option { background: #161b27; }

    .section-label {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      padding: 10px 12px;
      border-radius: 6px;
      margin: 16px 0 10px;
    }
    .when-label { background: #8b5cf61a; color: #a78bfa; }
    .if-label   { background: #f59e0b1a; color: #fbbf24; }
    .then-label { background: #10b9811a; color: #34d399; }

    .checkbox-label {
      display: flex !important;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      text-transform: none !important;
      letter-spacing: 0 !important;
      font-size: 13px !important;
      color: #e2e8f0 !important;
    }
    .checkbox-label input[type=checkbox] {
      width: 16px;
      height: 16px;
      cursor: pointer;
      accent-color: #6366f1;
    }
  `],
})
export class InsuranceAutomationComponent implements OnInit {
  private http    = inject(HttpClient);
  private cdr     = inject(ChangeDetectorRef);
  private confirm = inject(ConfirmService);

  private base = 'http://localhost:7979/api/insurance/automations';

  rules: AutomationRule[] = [];
  log: LogEntry[] = [];
  notifications: Notification[] = [];

  loading = false;
  saving = false;
  logExpanded = false;
  showNotifications = false;
  panelOpen = false;
  editingRule: AutomationRule | null = null;

  toastMsg = '';
  toastIsError = false;
  private toastTimer: any;

  schedulerStatus: { last_run: string | null; last_actions: number; next_run: string | null; interval_minutes: number } | null = null;

  triggerLabels = TRIGGER_LABELS;
  actionLabels = ACTION_LABELS;
  triggerKeys = Object.keys(TRIGGER_LABELS);
  actionKeys = Object.keys(ACTION_LABELS);
  stages = STAGES;
  lobs = LOBS;

  readonly triggerOptions: SelectOption[] = Object.entries(TRIGGER_LABELS).map(([v, l]) => ({ value: v, label: l }));
  readonly actionOptions: SelectOption[] = Object.entries(ACTION_LABELS).map(([v, l]) => ({ value: v, label: l }));
  readonly stageOptions: SelectOption[] = STAGES.map(s => ({ value: s, label: s }));
  readonly stageOptionsWithAny: SelectOption[] = [{ value: '', label: 'Any stage' }, ...STAGES.map(s => ({ value: s, label: s }))];
  readonly lobOptions: SelectOption[] = LOBS.map(l => ({ value: l, label: l === 'any' ? 'Any LOB' : l }));
  readonly priorityOptions: SelectOption[] = [
    { value: 'normal', label: 'Normal' },
    { value: 'high', label: 'High' },
  ];

  form = this.emptyForm();

  get unreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  ngOnInit(): void {
    this.loadRules();
    this.loadNotifications();
    this.loadSchedulerStatus();
  }

  loadSchedulerStatus(): void {
    this.http.get<any>(`${this.base}/scheduler/status`).subscribe({
      next: s => { this.schedulerStatus = s; this.cdr.markForCheck(); },
      error: () => {}
    });
  }

  private emptyForm() {
    return {
      name: '',
      description: '',
      trigger_type: '',
      trigger_days: 3,
      trigger_stage: '',
      condition_lob: 'any',
      condition_stage: '',
      action_type: '',
      action_message: '',
      action_subject: '',
      action_body: '',
      action_stage: '',
      action_priority: 'normal',
      action_assign_original: true,
      action_same_carriers: false,
      enabled: true,
    };
  }

  loadRules(): void {
    this.loading = true;
    this.http.get<AutomationRule[]>(this.base).subscribe({
      next: rules => {
        this.rules = rules;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.showToast('Failed to load rules', true);
        this.cdr.markForCheck();
      },
    });
  }

  loadLog(): void {
    this.http.get<LogEntry[]>(`${this.base}/log`).subscribe({
      next: entries => {
        this.log = (entries || []).slice(0, 20);
        this.cdr.markForCheck();
      },
      error: () => this.showToast('Failed to load log', true),
    });
  }

  loadNotifications(): void {
    this.http.get<Notification[]>(`${this.base}/notifications`).subscribe({
      next: notifs => {
        this.notifications = notifs || [];
        this.cdr.markForCheck();
      },
      error: () => {},
    });
  }

  seedTemplates(): void {
    this.loading = true;
    this.http.post(`${this.base}/seed-templates`, {}).subscribe({
      next: () => {
        this.showToast('9 template rules seeded');
        this.loadRules();
      },
      error: () => {
        this.loading = false;
        this.showToast('Seed failed', true);
        this.cdr.markForCheck();
      },
    });
  }

  runNow(): void {
    this.loading = true;
    this.http.post<{ actions_taken: number; results: any[] }>(`${this.base}/run/sync`, {}).subscribe({
      next: res => {
        this.loading = false;
        const n = res.actions_taken;
        this.showToast(n > 0 ? `${n} action(s) fired across all rules` : `Rules ran — no matching records found`);
        this.loadRules();
        this.logExpanded = true;
        this.loadLog();
      },
      error: () => {
        this.loading = false;
        this.showToast('Run failed', true);
        this.cdr.markForCheck();
      },
    });
  }

  runSingle(rule: AutomationRule): void {
    rule.running = true;
    this.cdr.markForCheck();
    this.http.post<{ actions_taken: number; results?: any[] }>(`${this.base}/${rule.id}/run`, {}).subscribe({
      next: res => {
        rule.running = false;
        const errors = (res.results || []).filter((r: any) => r.error);
        if (errors.length) {
          this.showToast(`Rule ran but hit an error — check activity log`, true);
        } else if (res.actions_taken === 0) {
          rule.last_run_at = new Date().toISOString();
          this.showToast(`"${rule.name}" ran — no matching records found`);
        } else {
          rule.run_count = (rule.run_count || 0) + res.actions_taken;
          rule.last_run_at = new Date().toISOString();
          this.showToast(`"${rule.name}" fired — ${res.actions_taken} action(s) taken`);
        }
        this.logExpanded = true;
        this.loadLog();
        this.cdr.markForCheck();
      },
      error: (err) => {
        rule.running = false;
        const msg = err?.error?.detail || `Failed to run "${rule.name}"`;
        this.showToast(msg, true);
        this.cdr.markForCheck();
      },
    });
  }

  toggleRule(rule: AutomationRule): void {
    const newEnabled = !rule.enabled;
    this.http.patch(`${this.base}/${rule.id}`, { enabled: newEnabled }).subscribe({
      next: () => {
        rule.enabled = newEnabled;
        this.cdr.markForCheck();
      },
      error: () => this.showToast('Failed to toggle rule', true),
    });
  }

  async deleteRule(rule: AutomationRule): Promise<void> {
    if (!await this.confirm.ask({ title: 'Delete Rule', message: `"${rule.name}" will be permanently deleted.`, danger: true })) return;
    this.http.delete(`${this.base}/${rule.id}`).subscribe({
      next: () => {
        this.rules = this.rules.filter(r => r.id !== rule.id);
        this.showToast('Rule deleted');
        this.cdr.markForCheck();
      },
      error: () => this.showToast('Delete failed', true),
    });
  }

  openCreate(): void {
    this.editingRule = null;
    this.form = this.emptyForm();
    this.panelOpen = true;
    this.cdr.markForCheck();
  }

  openEdit(rule: AutomationRule): void {
    this.editingRule = rule;
    const tc = (rule.trigger_config as any) || {};
    const cc = (rule.condition_config as any) || {};
    const ac = (rule.action_config as any) || {};
    this.form = {
      name: rule.name,
      description: rule.description,
      trigger_type: rule.trigger_type,
      trigger_days: tc.days ?? 3,
      trigger_stage: tc.stage ?? '',
      condition_lob: cc.lob ?? 'any',
      condition_stage: cc.stage ?? '',
      action_type: rule.action_type,
      action_message: ac.message ?? '',
      action_subject: ac.subject ?? '',
      action_body: ac.body ?? '',
      action_stage: ac.stage ?? '',
      action_priority: ac.priority ?? 'normal',
      action_assign_original: ac.assign_to_original_agent ?? true,
      action_same_carriers: ac.same_carriers ?? false,
      enabled: rule.enabled,
    };
    this.panelOpen = true;
    this.cdr.markForCheck();
  }

  closePanel(): void {
    this.panelOpen = false;
    this.editingRule = null;
    this.cdr.markForCheck();
  }

  saveRule(): void {
    if (!this.form.name.trim() || !this.form.trigger_type || !this.form.action_type) {
      this.showToast('Name, trigger, and action are required', true);
      return;
    }

    const trigger_config: any = {};
    if (this.triggerHasDays(this.form.trigger_type)) trigger_config.days = this.form.trigger_days;
    if (this.form.trigger_type === 'quote_stage_changed' && this.form.trigger_stage) trigger_config.stage = this.form.trigger_stage;

    const condition_config: any = {};
    if (this.form.condition_lob && this.form.condition_lob !== 'any') condition_config.lob = this.form.condition_lob;
    if (this.form.condition_stage) condition_config.stage = this.form.condition_stage;

    const action_config: any = {};
    if (this.actionHasMessage(this.form.action_type)) {
      action_config.message = this.form.action_message;
      if (this.form.action_type === 'notify_agent') action_config.priority = this.form.action_priority;
    }
    if (this.actionHasEmail(this.form.action_type)) {
      action_config.subject = this.form.action_subject;
      action_config.body = this.form.action_body;
    }
    if (this.form.action_type === 'move_stage') action_config.stage = this.form.action_stage;
    if (this.form.action_type === 'create_renewal_quote') {
      action_config.assign_to_original_agent = this.form.action_assign_original;
      action_config.same_carriers = this.form.action_same_carriers;
    }

    const payload = {
      name: this.form.name.trim(),
      description: this.form.description.trim(),
      trigger_type: this.form.trigger_type,
      trigger_config,
      condition_config,
      action_type: this.form.action_type,
      action_config,
      enabled: this.form.enabled,
    };

    this.saving = true;
    const req = this.editingRule
      ? this.http.patch<AutomationRule>(`${this.base}/${this.editingRule.id}`, payload)
      : this.http.post<AutomationRule>(this.base, payload);

    req.subscribe({
      next: saved => {
        this.saving = false;
        if (this.editingRule) {
          const idx = this.rules.findIndex(r => r.id === saved.id);
          if (idx >= 0) this.rules[idx] = saved;
        } else {
          this.rules = [saved, ...this.rules];
        }
        this.showToast(this.editingRule ? 'Rule updated' : 'Rule created');
        this.closePanel();
        this.cdr.markForCheck();
      },
      error: () => {
        this.saving = false;
        this.showToast('Save failed', true);
        this.cdr.markForCheck();
      },
    });
  }

  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) this.loadNotifications();
    this.cdr.markForCheck();
  }

  markRead(id: string): void {
    this.http.post(`${this.base}/notifications/${id}/read`, {}).subscribe({
      next: () => {
        const n = this.notifications.find(x => x.id === id);
        if (n) n.read = true;
        this.cdr.markForCheck();
      },
      error: () => {},
    });
  }

  markAllRead(): void {
    const unread = this.notifications.filter(n => !n.read);
    unread.forEach(n => this.markRead(n.id));
  }

  getTriggerLabel(rule: AutomationRule): string {
    const base = TRIGGER_LABELS[rule.trigger_type] || rule.trigger_type;
    const days = (rule.trigger_config as any)?.days;
    if (days !== undefined) return `${base} (${days}d)`;
    return base;
  }

  getActionLabel(rule: AutomationRule): string {
    return ACTION_LABELS[rule.action_type] || rule.action_type;
  }

  triggerHasDays(t: string): boolean {
    return ['carrier_no_response', 'quote_expiring', 'policy_expiring', 'renewal_due'].includes(t);
  }

  actionHasMessage(a: string): boolean {
    return ['notify_agent', 'flag_compliance', 'block_bind', 'create_task'].includes(a);
  }

  actionHasEmail(a: string): boolean {
    return ['send_email_client', 'send_email_carrier', 'send_comparison'].includes(a);
  }

  onTriggerChange(): void {
    this.cdr.markForCheck();
  }

  onActionChange(): void {
    this.cdr.markForCheck();
  }

  timeAgo(dateStr: string): string {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }

  timeUntil(dateStr: string): string {
    if (!dateStr) return '—';
    const diff = new Date(dateStr).getTime() - Date.now();
    if (diff <= 0) return 'any moment';
    const m = Math.ceil(diff / 60000);
    if (m < 60) return `${m}m`;
    return `${Math.ceil(m / 60)}h`;
  }

  private showToast(msg: string, isError = false): void {
    this.toastMsg = msg;
    this.toastIsError = isError;
    this.cdr.markForCheck();
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastMsg = '';
      this.cdr.markForCheck();
    }, 3500);
  }
}
