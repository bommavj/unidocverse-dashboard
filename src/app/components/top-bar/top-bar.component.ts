// Top bar — global search, Ask AI, voice, upload, approvals, alerts, help and the user menu
import {
  Component, EventEmitter, Output, OnInit, OnDestroy, HostListener, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { LanguageService } from '../../services/language.service';
import { ToastService } from '../../services/toast.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { FeatureFlagService } from '../../services/feature-flag.service';

interface Jump { label: string; link: string; query?: Record<string, string>; flag?: string; }

@Component({
  selector: 'app-top-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TitleCasePipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './top-bar.component.html',
  styleUrls: ['./top-bar.component.scss'],
})
export class TopBarComponent implements OnInit, OnDestroy {
  @Output() openAskAi = new EventEmitter<void>();
  @Output() openVoice = new EventEmitter<void>();

  query = '';
  menu: '' | 'user' | 'help' = '';
  unreadAlerts = 0;
  pendingApprovals = 0;
  private poll?: any;

  // Pages the search box can jump straight to ("go to COI")
  readonly jumps: Jump[] = [
    { label: 'Home', link: '/dashboard' }, { label: 'Documents', link: '/documents-hub' }, { label: 'Upload', link: '/upload' },
    { label: 'Research agent', link: '/research' }, { label: 'Approvals', link: '/documents-hub', query: { tab: 'approvals' } },
    { label: 'Insights', link: '/insights' }, { label: 'Deadlines', link: '/deadlines' },
    { label: 'Clients', link: '/clients', flag: 'agencyMode' }, { label: 'Policies', link: '/policies', flag: 'agencyMode' }, { label: 'Renewals', link: '/renewals', flag: 'agencyMode' },
    { label: 'COI', link: '/coi', flag: 'agencyMode' }, { label: 'Claims', link: '/claims', flag: 'operationsMode' }, { label: 'Quotes', link: '/quotes', flag: 'operationsMode' },
    { label: 'Immigration', link: '/immigration', flag: 'immigrationMode' }, { label: 'Finance', link: '/finance', flag: 'financeMode' }, { label: 'Legal', link: '/legal', flag: 'legalMode' },
    { label: 'Healthcare', link: '/healthcare', flag: 'medicalMode' }, { label: 'HR', link: '/hr', flag: 'hrMode' }, { label: 'Real estate', link: '/real-estate', flag: 'realEstateMode' },
    { label: 'Supply chain', link: '/supply-chain', flag: 'supplyChainMode' }, { label: 'Risk', link: '/risk', flag: 'complianceMode' },
    { label: 'Audit', link: '/audit', flag: 'complianceMode' }, { label: 'Matters', link: '/matters', flag: 'operationsMode' }, { label: 'CLM', link: '/clm', flag: 'clmMode' },
    { label: 'Settings', link: '/settings' }, { label: 'Integrations', link: '/integrations' }, { label: 'Planner', link: '/planner' },
    { label: 'Notes', link: '/notes' }, { label: 'Timeline', link: '/timeline' }, { label: 'Watch folders', link: '/watch-folders' },
  ];

  readonly languages = [
    { code: 'en', name: 'English' }, { code: 'es', name: 'Español' }, { code: 'fr', name: 'Français' }, { code: 'de', name: 'Deutsch' },
  ];

  constructor(
    public auth: AuthService,
    public theme: ThemeService,
    public languageService: LanguageService,
    private toast: ToastService,
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private features: FeatureFlagService,
  ) {}

  ngOnInit(): void {
    this.refreshCounts();
    this.poll = setInterval(() => this.refreshCounts(), 60_000);
  }

  ngOnDestroy(): void {
    if (this.poll) clearInterval(this.poll);
  }

  refreshCounts(): void {
    this.http.get<{ unread: number }>('/api/notifications/unread').subscribe({
      next: r => { this.unreadAlerts = r.unread || 0; this.cdr.markForCheck(); }, error: () => {}
    });
    this.http.get<any>('http://localhost:7979/api/approvals/stats').subscribe({
      next: r => { this.pendingApprovals = r?.pending ?? r?.by_status?.pending ?? 0; this.cdr.markForCheck(); }, error: () => {}
    });
  }

  get matches(): Jump[] {
    const q = this.query.trim().toLowerCase();
    // Only offer pages from modules this organisation has switched on
    const on = (f?: string) => !f || !!(this.features as any)[f]?.();
    return q ? this.jumps.filter(j => on(j.flag) && j.label.toLowerCase().includes(q)).slice(0, 5) : [];
  }

  search(): void {
    const q = this.query.trim();
    if (!q) return;
    this.router.navigate(['/search'], { queryParams: { q } });
    this.query = '';
  }

  go(j: Jump): void {
    this.router.navigate([j.link], { queryParams: j.query || {} });
    this.query = '';
  }

  toggle(m: 'user' | 'help', e: Event): void {
    e.stopPropagation();
    this.menu = this.menu === m ? '' : m;
  }

  changeLanguage(code: string): void {
    this.languageService.currentLang.set(code);
    this.toast.success(`Language switched to ${code.toUpperCase()}`);
  }

  logout(): void { this.auth.logout(); }

  @HostListener('document:click') closeMenus(): void {
    if (this.menu) { this.menu = ''; this.cdr.markForCheck(); }
  }

  @HostListener('document:keydown', ['$event']) shortcuts(e: KeyboardEvent): void {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); (document.getElementById('udv-search') as HTMLInputElement)?.focus(); }
    if (mod && e.key.toLowerCase() === 'j') { e.preventDefault(); this.openAskAi.emit(); }
    if (e.key === 'Escape' && this.menu) { this.menu = ''; this.cdr.markForCheck(); }
  }
}
