// app/shared/components/notification-bell/notification-bell.component.ts
import {
    Component, OnInit, OnDestroy,
    ChangeDetectionStrategy, ChangeDetectorRef
  } from '@angular/core';
  import { CommonModule } from '@angular/common';
  import { HttpClient } from '@angular/common/http';
  import { Router } from '@angular/router';
  import { interval, Subscription } from 'rxjs';
  import { switchMap } from 'rxjs/operators';
  
  interface Notification {
    id: number;
    doc_id: string;
    filename: string;
    severity: 'expired' | 'critical' | 'urgent' | 'warning';
    title: string;
    message: string;
    expiry_date: string;
    days_until: number;
    is_read: boolean;
  }
  
  @Component({
    selector: 'app-notification-bell',
    standalone: true,
    imports: [CommonModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
      <div class="bell-wrapper" (clickOutside)="closeDropdown()">
  
        <!-- Bell button -->
        <button class="bell-btn" (click)="toggleDropdown()" [class.has-unread]="unreadCount > 0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span class="badge" *ngIf="unreadCount > 0">
            {{ unreadCount > 99 ? '99+' : unreadCount }}
          </span>
        </button>
  
        <!-- Dropdown -->
        <div class="dropdown" *ngIf="open">
          <div class="dropdown-header">
            <span class="dropdown-title">Alerts</span>
            <button class="mark-all-btn" (click)="markAllRead()" *ngIf="unreadCount > 0">
              Mark all read
            </button>
          </div>
  
          <div class="dropdown-loading" *ngIf="loadingList">
            Loading…
          </div>
  
          <div class="dropdown-empty" *ngIf="!loadingList && notifications.length === 0">
            <span>✅</span>
            <p>No active alerts</p>
          </div>
  
          <div class="notification-list" *ngIf="!loadingList && notifications.length > 0">
            <div
              *ngFor="let n of notifications"
              class="notification-item"
              [class.unread]="!n.is_read"
              [class]="'notification-item ' + 'sev-' + n.severity"
              (click)="openAlert(n)"
            >
              <div class="notif-icon">{{ severityIcon(n.severity) }}</div>
              <div class="notif-body">
                <div class="notif-title">{{ n.title }}</div>
                <div class="notif-meta">{{ n.expiry_date }} · {{ daysText(n.days_until) }}</div>
              </div>
              <div class="unread-dot" *ngIf="!n.is_read"></div>
            </div>
          </div>
  
          <div class="dropdown-footer" *ngIf="notifications.length > 0">
            <button class="view-all-btn" (click)="viewAll()">
              View all alerts →
            </button>
          </div>
        </div>
  
      </div>
    `,
    styles: [`
      .bell-wrapper {
        position: relative;
        display: inline-block;
      }
  
      /* Bell button */
      .bell-btn {
        position: relative;
        background: none;
        border: none;
        cursor: pointer;
        padding: 8px;
        border-radius: 8px;
        color: #6b7280;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      .bell-btn:hover { background: #f3f4f6; color: #111827; }
      .bell-btn.has-unread { color: #6366f1; }
  
      /* Badge */
      .badge {
        position: absolute;
        top: 2px;
        right: 2px;
        background: #ef4444;
        color: white;
        font-size: 10px;
        font-weight: 700;
        min-width: 16px;
        height: 16px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 3px;
        border: 2px solid white;
        animation: pulse 2s infinite;
      }
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }
  
      /* Dropdown */
      .dropdown {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        width: 360px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.15);
        z-index: 1000;
        overflow: hidden;
      }
  
      .dropdown-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 16px;
        border-bottom: 1px solid #f3f4f6;
      }
      .dropdown-title { font-weight: 700; font-size: 15px; color: #111827; }
      .mark-all-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 12px;
        color: #6366f1;
        font-weight: 500;
      }
      .mark-all-btn:hover { text-decoration: underline; }
  
      .dropdown-loading, .dropdown-empty {
        padding: 24px;
        text-align: center;
        color: #6b7280;
        font-size: 13px;
      }
      .dropdown-empty span { font-size: 24px; display: block; margin-bottom: 4px; }
      .dropdown-empty p { margin: 0; }
  
      /* Notification items */
      .notification-list { max-height: 320px; overflow-y: auto; }
  
      .notification-item {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        padding: 12px 16px;
        cursor: pointer;
        border-bottom: 1px solid #f9fafb;
        transition: background 0.15s;
        position: relative;
      }
      .notification-item:hover { background: #f9fafb; }
      .notification-item.unread { background: #fafafe; }
  
      .notification-item.sev-expired  { border-left: 3px solid #ef4444; }
      .notification-item.sev-critical { border-left: 3px solid #f97316; }
      .notification-item.sev-urgent   { border-left: 3px solid #f59e0b; }
      .notification-item.sev-warning  { border-left: 3px solid #6366f1; }
  
      .notif-icon { font-size: 18px; margin-top: 1px; }
      .notif-body { flex: 1; min-width: 0; }
      .notif-title {
        font-size: 13px;
        font-weight: 600;
        color: #111827;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 2px;
      }
      .notif-meta { font-size: 11px; color: #9ca3af; }
  
      .unread-dot {
        width: 8px;
        height: 8px;
        background: #6366f1;
        border-radius: 50%;
        margin-top: 4px;
        flex-shrink: 0;
      }
  
      /* Footer */
      .dropdown-footer {
        padding: 10px 16px;
        border-top: 1px solid #f3f4f6;
        text-align: center;
      }
      .view-all-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 13px;
        color: #6366f1;
        font-weight: 600;
      }
      .view-all-btn:hover { text-decoration: underline; }
    `]
  })
  export class NotificationBellComponent implements OnInit, OnDestroy {
  
    open = false;
    unreadCount = 0;
    notifications: Notification[] = [];
    loadingList = false;
  
    private pollSub?: Subscription;
  
    constructor(
      private http: HttpClient,
      private router: Router,
      private cdr: ChangeDetectorRef,
    ) {}
  
    ngOnInit() {
      // Poll unread count every 60 seconds
      this.pollUnread();
      this.pollSub = interval(60_000).pipe(
        switchMap(() => this.http.get<{ unread: number }>('/api/notifications/unread'))
      ).subscribe(res => {
        this.unreadCount = res.unread;
        this.cdr.markForCheck();
      });
    }
  
    ngOnDestroy() {
      this.pollSub?.unsubscribe();
    }
  
    pollUnread() {
      this.http.get<{ unread: number }>('/api/notifications/unread').subscribe(res => {
        this.unreadCount = res.unread;
        this.cdr.markForCheck();
      });
    }
  
    toggleDropdown() {
      this.open = !this.open;
      if (this.open) this.loadNotifications();
      this.cdr.markForCheck();
    }
  
    closeDropdown() {
      this.open = false;
      this.cdr.markForCheck();
    }
  
    loadNotifications() {
      this.loadingList = true;
      this.cdr.markForCheck();
      this.http.get<{ notifications: Notification[]; unread: number }>('/api/notifications')
        .subscribe(res => {
          this.notifications = res.notifications;
          this.unreadCount   = res.unread;
          this.loadingList   = false;
          this.cdr.markForCheck();
        });
    }
  
    openAlert(n: Notification) {
      // Mark as read
      this.http.post('/api/notifications/mark-read', { id: n.id }).subscribe();
      n.is_read = true;
      this.unreadCount = Math.max(0, this.unreadCount - 1);
      this.open = false;
      this.router.navigate(['/alerts']);
      this.cdr.markForCheck();
    }
  
    markAllRead() {
      this.http.post('/api/notifications/mark-read', {}).subscribe(() => {
        this.notifications.forEach(n => n.is_read = true);
        this.unreadCount = 0;
        this.cdr.markForCheck();
      });
    }
  
    viewAll() {
      this.open = false;
      this.router.navigate(['/alerts']);
    }
  
    severityIcon(s: string): string {
      return { expired: '🔴', critical: '🟠', urgent: '🟡', warning: '🟣' }[s] || '⚪';
    }
  
    daysText(days: number): string {
      if (days < 0) return `Expired ${Math.abs(days)} days ago`;
      if (days === 0) return 'Expires today';
      return `${days} days remaining`;
    }
  }