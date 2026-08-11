import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-renewals',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './renewals.component.html',
  styleUrls: ['./renewals.component.scss']
})
export class RenewalsComponent implements OnInit, OnDestroy {

  urgent:  any[] = [];
  soon:    any[] = [];
  planned: any[] = [];
  summary: any   = {};
  loading  = false;

  private sub?: Subscription;
  private readonly api = 'http://localhost:8000';

  constructor(
    public  toast:  ToastService,
    private http:   HttpClient,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.load();
    this.sub = interval(60_000).subscribe(() => this.load());
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  // ── Data ──────────────────────────────────────────────────────────────────

  load(): void {
    this.loading = true;
    this.http.get<any>(`${this.api}/api/ams/renewal/pipeline`).subscribe({
      next: res => {
        const p = res.pipeline || {};
        const allPolicies = [
          ...(p.not_started || []),
          ...(p.contacted   || []),
          ...(p.in_progress || []),
          ...(p.complete    || []),
          ...(p.lost        || []),
        ];
        this.urgent  = allPolicies.filter((x: any) => x.days_until_expiry != null && x.days_until_expiry <= 14);
        this.soon    = allPolicies.filter((x: any) => x.days_until_expiry != null && x.days_until_expiry > 14 && x.days_until_expiry <= 30);
        this.planned = allPolicies.filter((x: any) => x.days_until_expiry != null && x.days_until_expiry > 30);
        this.summary = {
          ...(res.summary || {}),
          urgent_count:          this.urgent.length,
          soon_count:            this.soon.length,
          planned_count:         this.planned.length,
          total_expiring:        this.urgent.length + this.soon.length + this.planned.length,
          total_premium_at_risk: allPolicies.reduce((s: number, pol: any) => s + (pol.premium_amount || 0), 0),
        };
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  updateStatus(policy: any, status: string): void {
    this.http.patch(`${this.api}/api/ams/policies/${policy.id}/renewal-status`,
      { renewal_status: status }
    ).subscribe({
      next: (res: any) => {
        policy.renewal_status = res.renewal_status;
        this.toast.success(`${policy.client_name || policy.first_name} — marked as ${status.replace('_', ' ')}`);
      },
      error: () => { this.toast.error('Failed to update status'); }
    });
  }

  openClient(policy: any): void {
    this.router.navigate(['/clients', policy.client_id]);
  }

  contactClient(policy: any, method: 'email' | 'phone'): void {
    if (method === 'email') {
      const clientEmail = policy.client_email || policy.email;
      if (!clientEmail) {
        this.toast.show('No email on file for this client', 'error');
        return;
      }
      policy._sending = true;
      const clientName = [policy.first_name, policy.last_name].filter(Boolean).join(' ');
      this.http.post<any>(`${this.api}/api/ams/renewal/send-reminder`, {
        policy_id:         policy.id,
        client_email:      clientEmail,
        client_name:       clientName,
        policy_number:     policy.policy_number,
        carrier_name:      policy.carrier_name,
        expiry_date:       policy.expiry_date,
        days_until_expiry: policy.days_until_expiry,
      }).subscribe({
        next: () => {
          policy._sending = false;
          this.updateStatus(policy, 'contacted');
          this.toast.show(`Email sent to ${clientEmail}`, 'success');
        },
        error: (err: any) => {
          policy._sending = false;
          const msg = err.error?.detail || 'Failed to send';
          if (msg.includes('not configured')) {
            // Fallback to mailto if SMTP not set up
            window.open(`mailto:${clientEmail}?subject=Policy%20Renewal%20%E2%80%94%20${policy.policy_number}`);
            this.updateStatus(policy, 'contacted');
          } else {
            this.toast.show(msg, 'error');
          }
        }
      });

    } else if (method === 'phone') {
      if (policy.client_phone) {
        window.open(`tel:${policy.client_phone}`);
        this.updateStatus(policy, 'contacted');
      } else {
        this.toast.show('No phone number on file', 'error');
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  daysClass(days: number | null): string {
    if (days === null) return 'days-ok';
    if (days <= 7)  return 'days-urgent';
    if (days <= 30) return 'days-soon';
    return 'days-ok';
  }

  fmtPremium(amount: number): string {
    if (!amount) return '—';
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}/yr`;
  }

  renewalStatusLabel(status: string): string {
    const map: Record<string, string> = {
      not_started: 'Not Started',
      contacted:   'Contacted',
      in_progress: 'In Progress',
      complete:    'Complete',
      lost:        'Lost',
    };
    return map[status] || status;
  }

  get isEmpty(): boolean {
    return !this.loading
        && this.urgent.length  === 0
        && this.soon.length    === 0
        && this.planned.length === 0;
  }
}