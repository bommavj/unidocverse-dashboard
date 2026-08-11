import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private _theme$ = new BehaviorSubject<Theme>(this._loadTheme());
  readonly theme$ = this._theme$.asObservable();

  get isDark(): boolean { return this._theme$.value === 'dark'; }
  get current(): Theme  { return this._theme$.value; }

  toggle(): void {
    const next: Theme = this.isDark ? 'light' : 'dark';
    this._apply(next);
    this._theme$.next(next);
    localStorage.setItem('udv_theme', next);
  }

  init(): void {
    this._apply(this._theme$.value);
  }

  private _loadTheme(): Theme {
    const stored = localStorage.getItem('udv_theme') as Theme | null;
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private _apply(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
  }
}
