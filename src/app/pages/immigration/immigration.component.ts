import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-immigration',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './immigration.component.html',
  styleUrls: ['./immigration.component.scss']
})
export class ImmigrationComponent implements OnInit {
  private readonly api = 'http://localhost:8000';

  loading   = true;
  buckets: any = {};
  counts:  any = {};
  total        = 0;
  activeTab: 'all' | 'expired' | 'critical' | 'high' | 'medium' | 'low' = 'all';

  constructor(private http: HttpClient) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.http.get<any>(`${this.api}/api/immigration/expiry-dashboard`).subscribe({
      next: res => {
        this.buckets = res.buckets || {};
        this.counts  = res.counts  || {};
        this.total   = res.total   || 0;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  get visibleRecords(): any[] {
    if (this.activeTab === 'all') {
      return [
        ...(this.buckets.expired  || []),
        ...(this.buckets.critical || []),
        ...(this.buckets.high     || []),
        ...(this.buckets.medium   || []),
        ...(this.buckets.low      || []),
        ...(this.buckets.unknown  || []),
      ];
    }
    return this.buckets[this.activeTab] || [];
  }

  urgencyIcon(u: string): string {
    return { expired:'🔴', critical:'🔴', high:'🟠', medium:'🟡', low:'🟢', unknown:'⚪' }[u] || '⚪';
  }

  urgencyClass(u: string): string {
    return { expired:'u-exp', critical:'u-crit', high:'u-high', medium:'u-med', low:'u-low' }[u] || '';
  }

  daysLabel(r: any): string {
    if (r.days_to_expiry == null) return '—';
    if (r.days_to_expiry < 0)  return `${Math.abs(r.days_to_expiry)}d overdue`;
    if (r.days_to_expiry === 0) return 'Today!';
    return `${r.days_to_expiry}d left`;
  }
}
