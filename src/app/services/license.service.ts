import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Subscription, interval } from 'rxjs';
import { Router } from '@angular/router';

export interface LicenseStatus {
  is_valid: boolean;
  is_active: boolean;
  license_type: 'trial' | 'full' | 'none' | 'unknown';
  days_remaining?: number;
  message?: string;
  expiry_at?: string;
  issued_to?: string;
  plan?: string;
}

export interface LicenseWarning {
  show: boolean;
  daysRemaining: number;
  level: 'warning' | 'urgent' | 'expired';  // warning=≤15d, urgent=≤3d, expired=0
  expiryDate: string;
  dismissedToday: boolean;
  isTrial: boolean;                          // drives "trial" vs "license" copy in banner
}

const DISMISS_KEY       = 'udv_license_banner_dismissed';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Fallback if Electron API not available (dev mode)
const DEV_BACKEND_URL = 'http://localhost:7979';

@Injectable({ providedIn: 'root' })
export class LicenseService implements OnDestroy {

  private _status$  = new BehaviorSubject<LicenseStatus | null>(null);
  private _warning$ = new BehaviorSubject<LicenseWarning | null>(null);

  readonly status$  = this._status$.asObservable();
  readonly warning$ = this._warning$.asObservable();

  private intervalSub?: Subscription;
  private backendUrl: string = DEV_BACKEND_URL;

  constructor(
    private http: HttpClient,
    private router: Router,
    private ngZone: NgZone
  ) {}

  /** Call once at app startup from AppComponent or MainNavComponent */
  init(): void {
    this.resolveBackendUrl().then(() => {
      // Listen for IPC event from main.js (fires when trial ≤ 7 days on startup)
      this.listenForElectronWarning();

      // Initial check
      this.checkLicense();

      // Re-check every 24 hours
      this.intervalSub = interval(CHECK_INTERVAL_MS).subscribe(() => {
        this.checkLicense();
      });
    });
  }

  private async resolveBackendUrl(): Promise<void> {
    try {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.getBackendUrl) {
        const url = await electronAPI.getBackendUrl();
        if (url) this.backendUrl = url;
      }
    } catch {
      // Stay with DEV_BACKEND_URL
    }
  }

  private listenForElectronWarning(): void {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.onLicenseWarning) return;

    electronAPI.onLicenseWarning((data: any) => {
      // main.js sends: { show, daysRemaining, message }
      // Pre-populate warning before HTTP check completes
      this.ngZone.run(() => {
        if (!data?.show) return;
        const daysRemaining  = data.daysRemaining ?? 0;
        const dismissedToday = this.isDismissedToday();

        this._warning$.next({
          show: !dismissedToday,
          daysRemaining,
          level: daysRemaining <= 3 ? 'urgent' : 'warning',
          expiryDate: '',    // filled in when HTTP check completes
          dismissedToday,
          isTrial: true
        });
      });
    });
  }

  checkLicense(): void {
    this.http.get<LicenseStatus>(`${this.backendUrl}/api/license/status`).subscribe({
      next: (status) => {
        this._status$.next(status);
        this.evaluateExpiry(status);

        // Redirect only if truly invalid — Electron blocking dialog handles
        // trial expiry before app opens, this is just a safety net
        if (!status.is_valid && status.license_type !== 'none') {
          this.router.navigate(['/license']);
        }
      },
      error: (err) => {
        // Backend may still be warming up — don't redirect, just log
        console.warn('[LicenseService] Status check failed (non-fatal):', err.message);
      }
    });
  }

  private evaluateExpiry(status: LicenseStatus): void {
    const isTrial = status.license_type === 'trial';

    // ── Invalid / expired ──────────────────────────────────────────────────
    if (!status.is_valid) {
      this._warning$.next({
        show: true,
        daysRemaining: 0,
        level: 'expired',
        expiryDate: status.expiry_at ? this.formatDate(status.expiry_at) : '',
        dismissedToday: false,   // expired = never dismissible
        isTrial
      });
      return;
    }

    // ── Use days_remaining from backend if present (trial always sends it) ─
    const daysRemaining = status.days_remaining !== undefined
      ? status.days_remaining
      : this.calcDaysRemaining(status.expiry_at);

    // ── No expiry (perpetual full license) → no warning ───────────────────
    if (daysRemaining === null) {
      this._warning$.next(null);
      return;
    }

    const expiryDate = status.expiry_at ? this.formatDate(status.expiry_at) : '';

    // ── Expired edge case (Electron dialog should have caught this) ────────
    if (daysRemaining <= 0) {
      this._warning$.next({
        show: true,
        daysRemaining: 0,
        level: 'expired',
        expiryDate,
        dismissedToday: false,
        isTrial
      });
      this.router.navigate(['/license']);
      return;
    }

    // ── Trial: always show banner (welcome if >30d, warning if ≤30d) ────────
    if (isTrial || daysRemaining <= 30) {
      const dismissedToday = this.isDismissedToday();
      this._warning$.next({
        show: !dismissedToday,
        daysRemaining,
        level: daysRemaining <= 3 ? 'urgent' : daysRemaining <= 7 ? 'warning' : 'warning',
        expiryDate,
        dismissedToday,
        isTrial
      });
      return;
    }

    // ── > 15 days → no banner ──────────────────────────────────────────────
    this._warning$.next(null);
  }

  dismiss(): void {
    const today = new Date().toDateString();
    localStorage.setItem(DISMISS_KEY, today);

    const current = this._warning$.value;
    if (current) {
      this._warning$.next({ ...current, show: false, dismissedToday: true });
    }
  }

  private isDismissedToday(): boolean {
    const stored = localStorage.getItem(DISMISS_KEY);
    return stored === new Date().toDateString();
  }

  private calcDaysRemaining(expiryAt?: string): number | null {
    if (!expiryAt) return null;
    const msRemaining = new Date(expiryAt).getTime() - Date.now();
    return Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
  }

  private formatDate(isoString: string): string {
    try {
      return new Date(isoString).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    } catch {
      return isoString;
    }
  }

  ngOnDestroy(): void {
    this.intervalSub?.unsubscribe();
  }
}