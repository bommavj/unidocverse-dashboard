import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Subscription } from 'rxjs';
import { LicenseService, LicenseWarning } from '../../services/license.service';

@Component({
  selector: 'app-license-warning-banner',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './license-warning-banner.component.html',
  styleUrls: ['./license-warning-banner.component.scss']
})
export class LicenseWarningBannerComponent implements OnInit, OnDestroy {

  warning: LicenseWarning | null = null;
  private sub?: Subscription;

  constructor(private licenseService: LicenseService) {}

  ngOnInit(): void {
    this.sub = this.licenseService.warning$.subscribe(w => {
      this.warning = w;
    });
  }

  dismiss(): void {
    this.licenseService.dismiss();
  }

  get showBanner(): boolean {
    return !!this.warning && this.warning.show;
  }

  get isWelcome(): boolean {
    return !!this.warning && this.warning.isTrial &&
           this.warning.level === 'warning' &&
           this.warning.daysRemaining > 30;
  }

  get icon(): string {
    if (!this.warning) return 'info';
    if (this.isWelcome) return 'celebration';
    switch (this.warning.level) {
      case 'expired': return 'block';
      case 'urgent':  return 'error';
      default:        return 'warning_amber';
    }
  }

  get message(): string {
    if (!this.warning) return '';
    const { daysRemaining, expiryDate, level, isTrial } = this.warning;
    const subject = isTrial ? 'trial' : 'license';

    // Welcome banner — trial active, more than 30 days remaining
    if (this.isWelcome) {
      return `🎉 Your 90-day free trial is active! ${daysRemaining} days remaining${expiryDate ? ' · Expires ' + expiryDate : ''}.`;
    }

    if (level === 'expired') {
      return isTrial
        ? `Your 90-day trial has expired. Request a license to continue.`
        : `Your license expired${expiryDate ? ' on ' + expiryDate : ''}. Please upload a new license.`;
    }
    if (daysRemaining <= 3) {
      return `⚠️ Your ${subject} expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}. Act now to avoid interruption.`;
    }
    if (daysRemaining <= 7) {
      return `Your ${subject} expires in ${daysRemaining} days${expiryDate ? ' on ' + expiryDate : ''}. Request a license to keep going.`;
    }
    // Last 30 days warning
    return `Your free trial ends in ${daysRemaining} days${expiryDate ? ' on ' + expiryDate : ''}. Request a license to continue.`;
  }

  get ctaLabel(): string {
    if (!this.warning) return '';
    if (this.isWelcome) return 'Learn More →';
    if (this.warning.isTrial || this.warning.level === 'expired') {
      return 'Request Free License →';
    }
    return 'Renew License →';
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}