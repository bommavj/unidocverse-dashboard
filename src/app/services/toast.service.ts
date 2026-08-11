import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  hiding?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private toastSubject  = new Subject<Toast>();
  private dismissSubject = new Subject<string>();

  toasts$:  Observable<Toast>   = this.toastSubject.asObservable();
  dismiss$: Observable<string>  = this.dismissSubject.asObservable();

  show(message: string, type: ToastType = 'success', duration = 3500): void {
    const id = Math.random().toString(36).slice(2);
    this.toastSubject.next({ id, message, type, duration });
  }

  success(message: string): void { this.show(message, 'success'); }
  error(message: string):   void { this.show(message, 'error');   }
  warning(message: string): void { this.show(message, 'warning'); }
  info(message: string):    void { this.show(message, 'info');    }

  dismiss(id: string): void { this.dismissSubject.next(id); }
}