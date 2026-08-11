import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmService, ConfirmOptions } from '../../services/confirm.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
<div *ngIf="visible"
  style="position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;padding:24px;"
  (click)="cancel()">
  <div style="position:absolute;inset:0;background:rgba(0,0,0,.4);backdrop-filter:blur(6px);"></div>

  <div (click)="$event.stopPropagation()"
    style="position:relative;background:var(--surf);border-radius:20px;padding:28px 28px 24px;width:100%;max-width:360px;
           box-shadow:0 32px 64px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.08);
           border:1px solid rgba(255,255,255,.15);">

    <!-- Icon -->
    <div style="width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;"
      [style.background]="opts.danger ? 'rgba(239,68,68,.1)' : 'rgba(59,130,246,.1)'">
      <svg *ngIf="opts.danger" width="22" height="22" viewBox="0 0 24 24" fill="none"
        [attr.stroke]="'#ef4444'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
      </svg>
      <svg *ngIf="!opts.danger" width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    </div>

    <h3 style="margin:0 0 8px;font-size:17px;font-weight:700;color:var(--t1);text-align:center;letter-spacing:-.3px;">
      {{opts.title}}
    </h3>
    <p style="margin:0 0 24px;font-size:14px;color:var(--t2);text-align:center;line-height:1.5;">
      {{opts.message}}
    </p>

    <div style="display:flex;flex-direction:column;gap:10px;">
      <button (click)="confirm()"
        style="width:100%;padding:13px;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;letter-spacing:-.1px;transition:opacity .15s;color:#fff;"
        [style.background]="opts.danger ? '#ef4444' : '#3b82f6'">
        {{opts.confirmLabel || (opts.danger ? 'Delete' : 'Confirm')}}
      </button>
      <button (click)="cancel()"
        style="width:100%;padding:13px;border:1px solid var(--bdr);border-radius:12px;font-size:15px;font-weight:500;cursor:pointer;background:transparent;color:var(--t2);transition:opacity .15s;">
        {{opts.cancelLabel || 'Cancel'}}
      </button>
    </div>
  </div>
</div>
  `,
})
export class ConfirmModalComponent implements OnInit, OnDestroy {
  visible = false;
  opts: ConfirmOptions = { title: '', message: '' };
  private _resolve?: (v: boolean) => void;
  private _sub?: Subscription;

  constructor(private svc: ConfirmService) {}

  ngOnInit() {
    this._sub = this.svc.request$.subscribe(({ opts, resolve }) => {
      this.opts = { danger: true, ...opts };
      this._resolve = resolve;
      this.visible = true;
    });
  }

  confirm() { this.visible = false; this._resolve?.(true); }
  cancel()  { this.visible = false; this._resolve?.(false); }

  ngOnDestroy() { this._sub?.unsubscribe(); }
}
