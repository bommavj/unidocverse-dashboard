import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface HubTab { key: string; label: string; icon?: string; badge?: number; }

@Component({
  selector: 'app-hub-tabs',
  standalone: true,
  imports: [CommonModule],
  template: `
<div class="hub-bar">
  <button class="hub-tab" *ngFor="let t of tabs"
          [class.active]="active === t.key"
          (click)="select.emit(t.key)">
    <span class="ht-icon" *ngIf="t.icon">{{ t.icon }}</span>
    {{ t.label }}
    <span class="ht-badge" *ngIf="t.badge">{{ t.badge }}</span>
  </button>
</div>
  `,
  styles: [`
.hub-bar {
  display: flex; align-items: center; gap: 0;
  border-bottom: 1.5px solid #e2e8f4;
  padding: 0 24px;
  background: rgba(255,255,255,.95);
  backdrop-filter: blur(12px);
  flex-shrink: 0;
}
.hub-tab {
  display: flex; align-items: center; gap: 7px;
  padding: 13px 18px; font-size: 13px; font-weight: 600;
  color: #94a3b8; font-family: var(--font, 'Plus Jakarta Sans', sans-serif);
  background: none; border: none; cursor: pointer;
  border-bottom: 2.5px solid transparent; margin-bottom: -1.5px;
  transition: color .15s, border-color .15s; white-space: nowrap;
}
.hub-tab:hover { color: #475569; }
.hub-tab.active { color: #6366f1; border-bottom-color: #6366f1; }
.ht-icon { font-size: 14px; line-height: 1; }
.ht-badge {
  font-size: 10px; font-weight: 800; background: #ef4444; color: #fff;
  border-radius: 20px; padding: 1px 7px; min-width: 18px; text-align: center; letter-spacing: .2px;
}
  `]
})
export class HubTabsComponent {
  @Input() tabs: HubTab[] = [];
  @Input() active = '';
  @Output() select = new EventEmitter<string>();
}
