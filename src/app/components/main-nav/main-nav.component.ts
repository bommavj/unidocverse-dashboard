// app/main-nav/main-nav.component.ts
import {
  Component, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../services/api.service';
import { ToastService } from '../services/toast.service';
import { ToastComponent } from '../components/toast/toast.component';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-main-nav',
  standalone: true,
  imports: [CommonModule, RouterModule, ToastComponent, FormsModule, TitleCasePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './main-nav.component.html',
  styleUrls: ['./main-nav.component.scss']
})
export class MainNavComponent implements OnInit, OnDestroy {

  docCount       = 0;
  unreadAlerts   = 0;
  storageUsed    = 0;
  storagePercent = 0;

  @Output() openAskAi = new EventEmitter<void>();

  private alertPollInterval?: any;

  constructor(
    public  toast: ToastService,
    private api:   ApiService,
    public  auth:  AuthService,
    private http:  HttpClient,
    private cdr:   ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadDocuments();
    this.pollAlerts();
    this.alertPollInterval = setInterval(() => this.pollAlerts(), 60_000);
  }

  ngOnDestroy(): void {
    if (this.alertPollInterval) clearInterval(this.alertPollInterval);
  }

  loadDocuments(): void {
    this.api.getDocuments({}).subscribe({
      next: (res: any) => {
        const docs = Array.isArray(res) ? res : res.documents || [];
        this.docCount = docs.length;
        const totalBytes = docs.reduce((sum: number, d: any) => sum + (d.file_size || 0), 0);
        this.storageUsed    = Math.round((totalBytes / 1024 / 1024) * 100) / 100;
        this.storagePercent = Math.min((this.storageUsed / 10240) * 100, 100);
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  pollAlerts(): void {
    this.http.get<{ unread: number }>('/api/notifications/unread').subscribe({
      next: (res) => { this.unreadAlerts = res.unread; this.cdr.markForCheck(); },
      error: () => {}
    });
  }

  logout(): void { this.auth.logout(); }
}