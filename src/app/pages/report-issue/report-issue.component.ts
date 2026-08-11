import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

const CF_API = 'https://unidocverse.com/api/issues';

@Component({
  selector: 'app-report-issue',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './report-issue.component.html',
  styleUrls: ['./report-issue.component.scss'],
})
export class ReportIssueComponent implements OnInit {
  form = {
    title: '',
    description: '',
    type: 'bug',
    priority: 'medium',
    reporter_name: '',
    reporter_email: '',
    version: '1.0.0',
    os: '',
  };

  submitting = false;
  submitted = false;
  issueKey = '';

  recentIssues: any[] = [];
  loadingIssues = false;

  typeOptions = [
    { value: 'bug',         label: '🐛 Bug' },
    { value: 'feature',     label: '✨ Feature Request' },
    { value: 'improvement', label: '⚡ Improvement' },
    { value: 'question',    label: '❓ Question' },
  ];

  priorityOptions = [
    { value: 'critical', label: 'Critical', color: '#dc2626' },
    { value: 'high',     label: 'High',     color: '#ea580c' },
    { value: 'medium',   label: 'Medium',   color: '#ca8a04' },
    { value: 'low',      label: 'Low',      color: '#16a34a' },
  ];

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (user) {
      this.form.reporter_name  = user.full_name || user.username || '';
      this.form.reporter_email = user.username.includes('@') ? user.username : (user.username + '@local');
    }
    this.form.os = this.detectOS();
    this.loadRecent();
  }

  detectOS(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Mac'))     return 'macOS';
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Linux'))   return 'Linux';
    return '';
  }

  loadRecent(): void {
    this.loadingIssues = true;
    this.http.get<any>(CF_API + '?limit=10').subscribe({
      next: r => { this.recentIssues = r.issues || []; this.loadingIssues = false; },
      error: () => { this.loadingIssues = false; },
    });
  }

  submit(): void {
    if (!this.form.title.trim() || !this.form.description.trim()) {
      this.toast.error('Title and description are required');
      return;
    }
    this.submitting = true;
    this.http.post<any>(CF_API, this.form).subscribe({
      next: r => {
        this.submitting = false;
        this.submitted  = true;
        this.issueKey   = r.issue_key;
        this.loadRecent();
      },
      error: err => {
        this.submitting = false;
        this.toast.error(err?.error?.error || 'Failed to submit issue');
      },
    });
  }

  reset(): void {
    this.submitted = false;
    this.issueKey  = '';
    this.form.title       = '';
    this.form.description = '';
    this.form.type        = 'bug';
    this.form.priority    = 'medium';
  }

  prioColor(p: string): string {
    return this.priorityOptions.find(o => o.value === p)?.color ?? '#94a3b8';
  }

  statusBadge(s: string): string {
    const map: Record<string,string> = { open:'open', in_progress:'in-progress', resolved:'resolved', closed:'closed' };
    return map[s] ?? s;
  }
}
