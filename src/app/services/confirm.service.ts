import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private _request$ = new Subject<{ opts: ConfirmOptions; resolve: (v: boolean) => void }>();
  readonly request$ = this._request$.asObservable();

  ask(opts: ConfirmOptions): Promise<boolean> {
    return new Promise(resolve => this._request$.next({ opts, resolve }));
  }
}
