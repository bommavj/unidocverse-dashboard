import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-risk-badge',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .risk-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.3px;
      white-space: nowrap;

      &.green  { background: #d1fae5; color: #065f46; }
      &.amber  { background: #fef3c7; color: #92400e; }
      &.red    { background: #fee2e2; color: #991b1b; }
      &.darkred{ background: #fecaca; color: #7f1d1d; }
      &.empty  { background: #f3f4f6; color: #9ca3af; }
    }

    .risk-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;

      .green &  { background: #10b981; }
      .amber &  { background: #f59e0b; }
      .red &    { background: #ef4444; }
      .darkred &{ background: #dc2626; }
    }

    .health-ring {
      position: relative;
      width: 26px;
      height: 26px;
      flex-shrink: 0;
    }

    .health-ring svg {
      width: 26px;
      height: 26px;
      transform: rotate(-90deg);
    }

    .health-ring .track {
      fill: none;
      stroke: #e5e7eb;
      stroke-width: 3;
    }

    .health-ring .fill {
      fill: none;
      stroke-width: 3;
      stroke-linecap: round;
      transition: stroke-dashoffset 0.4s ease;
    }

    .health-label {
      font-size: 10px;
      font-weight: 600;
      color: #6b7280;
      white-space: nowrap;
    }
  `],
  template: `
    <!-- Risk Score Badge -->
    <span class="risk-badge" [ngClass]="riskClass">
      <span class="risk-dot" *ngIf="riskScore !== undefined && riskScore !== null"></span>
      {{ riskScore !== undefined && riskScore !== null ? riskScore : '—' }}
      <ng-container *ngIf="riskScore !== undefined && riskScore !== null">risk</ng-container>
    </span>

    <!-- Health Score Ring -->
    <ng-container *ngIf="healthScore !== undefined && healthScore !== null; else noHealth">
      <div class="health-ring" [title]="'Health: ' + healthScore + '%'">
        <svg viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">
          <circle class="track" cx="13" cy="13" r="10"/>
          <circle
            class="fill"
            cx="13" cy="13" r="10"
            [attr.stroke]="healthColor"
            [attr.stroke-dasharray]="circumference"
            [attr.stroke-dashoffset]="dashOffset"
          />
        </svg>
      </div>
      <span class="health-label">{{ healthScore }}%</span>
    </ng-container>
    <ng-template #noHealth>
      <span class="risk-badge empty">— health</span>
    </ng-template>
  `
})
export class RiskBadgeComponent {
  @Input() riskScore?: number;
  @Input() healthScore?: number;

  readonly circumference = 2 * Math.PI * 10; // r=10

  get riskClass(): string {
    if (this.riskScore === undefined || this.riskScore === null) return 'empty';
    if (this.riskScore < 30) return 'green';
    if (this.riskScore < 60) return 'amber';
    if (this.riskScore < 80) return 'red';
    return 'darkred';
  }

  get dashOffset(): number {
    if (this.healthScore === undefined || this.healthScore === null) return this.circumference;
    const pct = Math.min(100, Math.max(0, this.healthScore)) / 100;
    return this.circumference * (1 - pct);
  }

  get healthColor(): string {
    if (this.healthScore === undefined || this.healthScore === null) return '#e5e7eb';
    if (this.healthScore >= 75) return '#10b981';
    if (this.healthScore >= 50) return '#f59e0b';
    return '#ef4444';
  }
}
