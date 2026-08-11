import {
  Component, Input, Output, EventEmitter, forwardRef,
  HostListener, ElementRef, ChangeDetectionStrategy, ChangeDetectorRef,
  signal, OnDestroy, Renderer2, ApplicationRef, Injector,
  createComponent, EnvironmentInjector
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOption {
  value: any;
  label: string;
  disabled?: boolean;
}

@Component({
  selector: 'udv-select',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => UdvSelectComponent),
    multi: true
  }],
  styles: [`
    :host { display: block; position: relative; width: 100%; }

    .trigger {
      display: flex; align-items: center; justify-content: space-between;
      height: 40px; padding: 0 14px;
      border-radius: 10px; border: 1.5px solid var(--bdr);
      background: var(--surf); color: var(--t1);
      font-size: 13px; font-weight: 500; font-family: var(--font);
      cursor: pointer; user-select: none; outline: none;
      transition: border-color .15s, box-shadow .15s;
      box-shadow: 0 1px 3px rgba(0,0,0,.06);
      width: 100%;
    }
    .trigger:hover { border-color: var(--bdr2); }
    .trigger.open, .trigger:focus {
      border-color: var(--blue);
      box-shadow: 0 0 0 3px rgba(79,70,229,.12);
    }
    .trigger-label {
      flex: 1; text-align: left; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap;
    }
    .trigger-label.placeholder { color: var(--t3); font-weight: 400; }

    .chevron {
      flex-shrink: 0; margin-left: 8px; width: 16px; height: 16px; color: var(--t3);
      transition: transform .2s ease;
    }
    .chevron.up { transform: rotate(180deg); }

    :host-context(html.dark-mode) .trigger { background: var(--surf2); }
    :host-context(html.dark-mode) .trigger.open,
    :host-context(html.dark-mode) .trigger:focus {
      box-shadow: 0 0 0 3px rgba(129,140,248,.18);
    }
  `],
  template: `
<button type="button" class="trigger" [class.open]="open()"
  (click)="toggle()" (keydown)="onKeyDown($event)" [attr.aria-expanded]="open()">
  <span class="trigger-label" [class.placeholder]="value === null || value === undefined || value === ''">
    {{selectedLabel || placeholder}}
  </span>
  <svg class="chevron" [class.up]="open()" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M6 8l4 4 4-4"/>
  </svg>
</button>
  `,
})
export class UdvSelectComponent implements ControlValueAccessor, OnDestroy {
  @Input() options: SelectOption[] = [];
  @Input() placeholder = 'Select…';
  @Output() valueChange = new EventEmitter<any>();

  open = signal(false);
  value: any = null;
  disabled = false;

  private onChange: (v: any) => void = () => {};
  private onTouched: () => void = () => {};
  private portalEl: HTMLElement | null = null;
  private scrollHandler?: () => void;
  private resizeHandler?: () => void;

  constructor(
    private el: ElementRef,
    private cdr: ChangeDetectorRef,
    private renderer: Renderer2,
  ) {}

  get selectedLabel(): string {
    const found = this.options.find(o => o.value === this.value);
    return found ? found.label : '';
  }

  toggle() {
    if (this.disabled) return;
    if (this.open()) {
      this.closePortal();
    } else {
      this.openPortal();
    }
  }

  openPortal() {
    this.open.set(true);
    this.cdr.markForCheck();

    // Remove any stale portal
    this.removePortal();

    const isDark = document.documentElement.classList.contains('dark-mode');

    // Build the DOM portal
    const el = this.renderer.createElement('div') as HTMLElement;
    el.className = 'udv-select-portal';

    const styles = `
      position: fixed;
      z-index: 99999;
      background: var(--surf);
      border-radius: 12px;
      border: 1.5px solid var(--bdr);
      box-shadow: 0 12px 40px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.08);
      overflow: hidden;
      max-height: 260px;
      overflow-y: auto;
      min-width: 160px;
      animation: udvDropIn .15s ease;
      font-family: var(--font);
    `;
    el.setAttribute('style', styles);

    // Inject keyframe if not present
    if (!document.getElementById('udv-select-kf')) {
      const style = document.createElement('style');
      style.id = 'udv-select-kf';
      style.textContent = `
        @keyframes udvDropIn {
          from { opacity:0; transform: translateY(-6px) scale(.98); }
          to   { opacity:1; transform: translateY(0) scale(1); }
        }
        .udv-select-portal::-webkit-scrollbar { width: 4px; }
        .udv-select-portal::-webkit-scrollbar-track { background: transparent; }
        .udv-select-portal::-webkit-scrollbar-thumb { background: var(--bdr); border-radius: 4px; }
        .udv-select-option {
          display: flex; align-items: center; justify-content: space-between;
          padding: 11px 14px; cursor: pointer; gap: 8px;
          font-size: 13px; font-weight: 500; color: var(--t1);
          transition: background .1s;
          white-space: nowrap;
        }
        .udv-select-option:hover { background: var(--surf2); }
        .udv-select-option.selected {
          background: rgba(79,70,229,.08); color: var(--blue); font-weight: 600;
        }
        html.dark-mode .udv-select-option.selected {
          background: rgba(129,140,248,.12);
        }
        .udv-select-option.disabled { opacity: .45; pointer-events: none; }
        .udv-select-option .opt-label { flex: 1; overflow: hidden; text-overflow: ellipsis; }
        .udv-select-option .opt-check { flex-shrink: 0; width: 16px; height: 16px; color: var(--blue); }
        .udv-select-option .opt-blank { flex-shrink: 0; width: 16px; }
      `;
      document.head.appendChild(style);
    }

    // Render options
    this.options.forEach(opt => {
      const row = document.createElement('div');
      row.className = 'udv-select-option' +
        (opt.value === this.value ? ' selected' : '') +
        (opt.disabled ? ' disabled' : '');

      const label = document.createElement('span');
      label.className = 'opt-label';
      label.textContent = opt.label;
      row.appendChild(label);

      if (opt.value === this.value) {
        const check = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        check.setAttribute('class', 'opt-check');
        check.setAttribute('viewBox', '0 0 20 20');
        check.setAttribute('fill', 'none');
        check.setAttribute('stroke', 'currentColor');
        check.setAttribute('stroke-width', '2.5');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('d', 'M4 10l5 5 7-8');
        check.appendChild(path);
        row.appendChild(check);
      } else {
        const blank = document.createElement('span');
        blank.className = 'opt-blank';
        row.appendChild(blank);
      }

      row.addEventListener('mousedown', (e) => {
        e.preventDefault(); // prevent blur
        if (!opt.disabled) this.select(opt);
      });

      el.appendChild(row);
    });

    document.body.appendChild(el);
    this.portalEl = el;
    this.positionPortal();

    // Reposition on scroll/resize
    this.scrollHandler = () => this.positionPortal();
    this.resizeHandler = () => this.positionPortal();
    window.addEventListener('scroll', this.scrollHandler, true);
    window.addEventListener('resize', this.resizeHandler);
  }

  positionPortal() {
    if (!this.portalEl) return;
    const rect = this.el.nativeElement.getBoundingClientRect();
    const vpH = window.innerHeight;
    const dropH = Math.min(260, this.options.length * 43 + 4);

    // Open below or above depending on space
    const below = vpH - rect.bottom > dropH + 8;
    const top = below ? rect.bottom + 4 : rect.top - dropH - 4;

    this.portalEl.style.top = `${top}px`;
    this.portalEl.style.left = `${rect.left}px`;
    this.portalEl.style.width = `${rect.width}px`;
  }

  closePortal() {
    this.open.set(false);
    this.removePortal();
    this.cdr.markForCheck();
  }

  removePortal() {
    if (this.portalEl) {
      this.portalEl.remove();
      this.portalEl = null;
    }
    if (this.scrollHandler) window.removeEventListener('scroll', this.scrollHandler, true);
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
  }

  select(opt: SelectOption) {
    if (opt.disabled) return;
    this.value = opt.value;
    this.closePortal();
    this.onChange(this.value);
    this.onTouched();
    this.valueChange.emit(this.value);
    this.cdr.markForCheck();
  }

  onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.toggle(); }
    if (e.key === 'Escape') this.closePortal();
  }

  @HostListener('document:click', ['$event'])
  onOutsideClick(e: MouseEvent) {
    if (this.open() && !this.el.nativeElement.contains(e.target) && !this.portalEl?.contains(e.target as Node)) {
      this.closePortal();
    }
  }

  ngOnDestroy() { this.removePortal(); }

  writeValue(v: any) { this.value = v; this.cdr.markForCheck(); }
  registerOnChange(fn: any) { this.onChange = fn; }
  registerOnTouched(fn: any) { this.onTouched = fn; }
  setDisabledState(d: boolean) { this.disabled = d; this.cdr.markForCheck(); }
}
