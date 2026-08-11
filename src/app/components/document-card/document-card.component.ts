import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-document-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './document-card.component.html',
  styleUrls: ['./document-card.component.scss']
})
export class DocumentCardComponent implements OnChanges {
  @Input() document: any = null;
  @Output() view    = new EventEmitter<any>();
  @Output() similar = new EventEmitter<any>();
  @Output() chat    = new EventEmitter<any>();
  @Output() delete  = new EventEmitter<any>();

  sparklineSvg: SafeHtml = '';
  chartValues: number[] = [];

  constructor(private san: DomSanitizer) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['document'] && this.document) {
      this.chartValues = this._extractValues(this.document);
      this.sparklineSvg = this.san.bypassSecurityTrustHtml(
        this._buildSparkline(this.chartValues, this._chartColor)
      );
    }
  }

  // ── Getters ────────────────────────────────────────────────────────────

  get icoClass(): string {
    const m: Record<string, string> = {
      bank_statement: 'bank', tax_document: 'tax',
      payoff_statement: 'pdf', invoice: 'inv',
      credit_card_statement: 'cc', loan_estimate: 'pdf',
    };
    return m[this.document?.doc_type] || 'doc';
  }

  get icoTxt(): string {
    const m: Record<string, string> = {
      bank_statement: 'BNK', tax_document: 'TAX',
      payoff_statement: 'PDF', invoice: 'INV',
      credit_card_statement: 'CC', loan_estimate: 'LOAN',
    };
    return m[this.document?.doc_type] || 'DOC';
  }

  get badgeClass(): string {
    const s = this.document?.status;
    if (s === 'completed') return 'badge-ok';
    if (s === 'processing') return 'badge-proc';
    if (s === 'failed') return 'badge-fail';
    return 'badge-pend';
  }

  get badgeTxt(): string {
    const m: Record<string, string> = {
      completed: '✓ Analyzed', processing: '⟳ Processing',
      failed: '✕ Failed', pending: '… Pending',
    };
    return m[this.document?.status] || this.document?.status || '';
  }

  get typeLabel(): string {
    return (this.document?.doc_type || 'document').replace(/_/g, ' ');
  }

  get fmtSize(): string {
    const b = this.document?.file_size || 0;
    if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
    if (b >= 1024)    return (b / 1024).toFixed(1) + ' KB';
    return b + ' B';
  }

  get fmtDate(): string {
    const d = this.document?.created_at;
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return d; }
  }

  get hasChart(): boolean { return this.chartValues.length >= 2; }

  get chartLabel(): string {
    const m: Record<string, string> = {
      bank_statement: 'Transactions', tax_document: 'Income',
      payoff_statement: 'Payoff', invoice: 'Amount',
      credit_card_statement: 'Spending', loan_estimate: 'Loan',
    };
    return m[this.document?.doc_type] || 'Data';
  }

  private get _chartColor(): string {
    const m: Record<string, string> = {
      bank_statement: '#0891b2', tax_document: '#7c3aed',
      payoff_statement: '#059669', invoice: '#d97706',
      credit_card_statement: '#4f46e5', loan_estimate: '#0891b2',
    };
    return m[this.document?.doc_type] || '#4f46e5';
  }

  // ── Value extraction from insights / key_points ───────────────────────

  private _extractValues(doc: any): number[] {
    const nums: number[] = [];

    // From insights[].description — extract first $ amount per insight
    for (const ins of (doc.insights || [])) {
      const desc = String(ins.description || '');
      const m = desc.match(/\$[\d,]+(?:\.\d+)?/);
      if (m) nums.push(this._n(m[0]));
    }

    // From key_points[] — extract $ amounts
    if (nums.length < 2) {
      for (const kp of (doc.key_points || [])) {
        const m = String(kp).match(/\$[\d,]+(?:\.\d+)?/);
        if (m) nums.push(this._n(m[0]));
      }
    }

    return nums.filter(n => n > 0).slice(0, 10);
  }

  // ── Pure SVG sparkline builder ─────────────────────────────────────────

  private _buildSparkline(values: number[], color: string): string {
    const W = 88, H = 32, pad = 3;

    // Use deterministic pseudo-random if no real values
    const pts = values.length >= 2
      ? values
      : this._pseudoRandom(color, 8);

    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const range = max - min || 1;

    const coords = pts.map((v, i) => ({
      x: Math.round(pad + i * (W - pad * 2) / (pts.length - 1)),
      y: Math.round(H - pad - ((v - min) / range) * (H - pad * 2))
    }));

    const polyPts = coords.map(p => `${p.x},${p.y}`).join(' ');
    const last = coords[coords.length - 1];

    const areaPath =
      `M${coords[0].x},${H - pad} ` +
      coords.map(p => `L${p.x},${p.y}`).join(' ') +
      ` L${last.x},${H - pad} Z`;

    const uid = color.replace(/[^a-z0-9]/gi, '');

    return `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
  <defs>
    <linearGradient id="sg${uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <path d="${areaPath}" fill="url(#sg${uid})"/>
  <polyline points="${polyPts}" fill="none" stroke="${color}" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${last.x}" cy="${last.y}" r="3" fill="${color}"/>
</svg>`;
  }

  private _pseudoRandom(seed: string, count: number): number[] {
    const n = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return Array.from({ length: count }, (_, i) =>
      30 + Math.abs(Math.sin((n + i) * 0.9) * 50 + Math.cos(i * 1.4) * 20)
    );
  }

  private _n(v: any): number {
    return parseFloat(String(v ?? '').replace(/[$,\s]/g, '').replace(/[^0-9.-]/g, '')) || 0;
  }
}
