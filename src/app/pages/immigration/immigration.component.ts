import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ImmigrationSuiteComponent } from './immigration-suite.component';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-immigration',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ImmigrationSuiteComponent],
  templateUrl: './immigration.component.html',
  styleUrls: ['./immigration.component.scss']
})
export class ImmigrationComponent implements OnInit {
  private readonly api = 'http://localhost:8000';

  loading   = true;
  buckets: any = {};
  counts:  any = {};
  total        = 0;
  query        = '';
  activeTab: 'all' | 'expired' | 'critical' | 'high' | 'medium' | 'low' = 'all';

  readonly sections = [
    { id: 'tracker', label: 'Visa Tracker', icon: '🛂' },
    { id: 'cases', label: 'Cases', icon: '📁' },
    { id: 'crm', label: 'Clients', icon: '👥' },
    { id: 'forms', label: 'Forms', icon: '📝' },
    { id: 'esign', label: 'E-Signature', icon: '✍️' },
    { id: 'reports', label: 'Reports', icon: '📊' },
    { id: 'ai', label: 'Legal AI', icon: '✨' },
    { id: 'translate', label: 'Translations', icon: '🌐' },
  ];
  section: any = 'tracker';

  constructor(private http: HttpClient, private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(p => {
      this.section = this.sections.some(s => s.id === p['section']) ? p['section'] : 'tracker';
      if (this.section === 'tracker') this.load();
    });
  }

  go(id: string) { this.router.navigate([], { queryParams: { section: id === 'tracker' ? null : id }, queryParamsHandling: 'merge' }); }

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
    const words = this.query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return this.tabRecords;
    // Every word must appear somewhere in the record ("vijay h-1b" → Vijay's H-1B)
    return this.tabRecords.filter(r => {
      const hay = [r.beneficiary_name, r.visa_class, (r.visa_class || '').replace('-', ''), r.employer_sponsor,
                   r.doc_label, r.document_number, r.source_file, r.urgency_label].join(' ').toLowerCase();
      return words.every(w => hay.includes(w));
    });
  }

  private get tabRecords(): any[] {
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
