import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';

/**
 * The tenant's uploaded documents for a domain page tab (contracts, resumes, lab reports…),
 * with the key facts extracted from each. Domain pages show this above their specialised views,
 * so a page is never blank when matching documents exist.
 */
@Component({
  selector: 'app-domain-documents',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <section class="dd">
      <div class="dd-head">
        <h3>{{ label || 'Documents' }} <span class="dd-count">({{ docs.length }})</span></h3>
        <a routerLink="/upload" class="dd-upload">↑ Upload</a>
      </div>
      <div *ngIf="!loaded" class="dd-empty">Loading…</div>
      <div *ngIf="loaded && error" class="dd-empty">Couldn't load documents — {{ error }}</div>
      <div *ngIf="loaded && !error && !docs.length" class="dd-empty">
        No {{ (label || 'documents') | lowercase }} uploaded yet.
        <span *ngIf="types.length" class="dd-types">Shown here: {{ prettyTypes() }}.</span>
        <span *ngIf="other.length" class="dd-types">Your other documents in this section are listed below.</span>
      </div>
      <div class="dd-wrap" *ngIf="shown().length">
        <table>
          <thead><tr><th>Document</th><th>Type</th><th>Key details</th><th>Uploaded</th></tr></thead>
          <tbody>
            <tr *ngFor="let d of shown()">
              <td class="dd-file">{{ d.filename }}</td>
              <td>{{ pretty(d.doc_type) }}</td>
              <td>
                <span *ngFor="let f of d.facts; let last = last" class="dd-fact">{{ f.label }}: <b>{{ f.value }}</b><span *ngIf="!last"> · </span></span>
                <span *ngIf="!d.facts.length" class="dd-muted">—</span>
              </td>
              <td class="dd-date">{{ d.uploaded | date: 'mediumDate' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: [`
    .dd { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:20px 24px; margin-bottom:16px; }
    .dd-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap:12px; }
    .dd-head h3 { font-size:16px; font-weight:700; color:#0f172a; margin:0; }
    .dd-count { color:#94a3b8; font-size:13px; font-weight:600; }
    .dd-upload { background:#4f46e5; color:#fff; border-radius:6px; padding:6px 12px; font-size:12px; font-weight:600; text-decoration:none; white-space:nowrap; }
    .dd-upload:hover { background:#4338ca; }
    .dd-upload:focus-visible { outline:2px solid #a5b4fc; outline-offset:2px; }
    .dd-empty { color:#64748b; font-size:13px; padding:8px 0; }
    .dd-types { display:block; color:#94a3b8; font-size:12px; margin-top:4px; }
    .dd-wrap { overflow-x:auto; }
    table { width:100%; border-collapse:collapse; font-size:12.5px; }
    th { text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:#64748b; padding:8px; border-bottom:1px solid #e2e8f0; }
    td { padding:10px 8px; border-bottom:1px solid #f1f5f9; vertical-align:top; color:#334155; }
    .dd-file { font-weight:600; color:#0f172a; }
    .dd-fact { white-space:nowrap; }
    .dd-muted { color:#94a3b8; }
    .dd-date { white-space:nowrap; font-variant-numeric:tabular-nums; }
    :host-context(html.dark-mode) .dd { background:#0f172a; border-color:#1e293b; }
    :host-context(html.dark-mode) .dd-head h3, :host-context(html.dark-mode) .dd-file { color:#f1f5f9; }
    :host-context(html.dark-mode) td { color:#cbd5e1; border-color:#1e293b; }
    :host-context(html.dark-mode) th { border-color:#1e293b; }
  `],
})
export class DomainDocumentsComponent implements OnChanges {
  @Input() domain = '';
  @Input() tab = '';
  /** Emits how many documents the current tab shows, so the page can hide its own empty state. */
  @Output() count = new EventEmitter<number>();

  docs: any[] = [];
  other: any[] = [];
  types: string[] = [];
  label = '';
  loaded = false;
  error = '';

  constructor(private http: HttpClient) {}

  ngOnChanges() {
    if (!this.domain) return;
    this.loaded = false;
    this.error = '';
    this.http.get<any>(`http://localhost:8000/api/domains/${this.domain}/uploaded`, { params: { tab: this.tab || '' } })
      .subscribe({
        next: r => {
          this.docs = r.documents || [];
          this.other = r.other || [];
          this.types = r.types || [];
          this.label = r.label || '';
          this.loaded = true;
          this.count.emit(this.docs.length + this.other.length);
        },
        error: e => { this.loaded = true; this.error = e.status === 401 ? 'please sign in again' : `server error ${e.status}`; this.count.emit(0); },
      });
  }

  /** This tab's documents, or the section's other documents when the tab has none. */
  shown() { return this.docs.length ? this.docs : this.other; }

  pretty(t: string) { return (t || 'document').replace(/_/g, ' '); }
  prettyTypes() { return this.types.map(t => this.pretty(t)).join(', '); }
}
