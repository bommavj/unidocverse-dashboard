import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
export interface Anomaly { severity: 'high'|'med'|'low'; docId: number; title: string; description: string; }
@Component({ selector: 'app-anomaly-bar', standalone: true, imports: [CommonModule], templateUrl: './anomaly-bar.component.html', styleUrls: ['./anomaly-bar.component.scss'] })
export class AnomalyBarComponent {
  @Output() openDoc = new EventEmitter<number>();
  expanded = false;
  anomalies: Anomaly[] = [
    { severity: 'high', docId: 2, title: 'Unusually large ATM withdrawal', description: 'BROAMERICA ATM $4,100 on Nov 6 — 8–20× normal ATM range. Recommend verifying.' },
    { severity: 'med',  docId: 0, title: 'Payoff deadline approaching',    description: 'Good-through date April 15, 2026 — per diem $42.18/day begins in 34 days.' },
    { severity: 'med',  docId: 4, title: 'Invoice payment due soon',       description: 'Design Studio LLC $4,500 due April 1, 2026 — 2%/month late fee applies.' },
  ];
  toggle(): void { this.expanded = !this.expanded; }
}
