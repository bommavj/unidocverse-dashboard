import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ToastService, Toast } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.scss']
})
export class ToastComponent implements OnInit, OnDestroy {
  toasts: Toast[] = [];
  private subs = new Subscription();

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.subs.add(
      this.toastService.toasts$.subscribe((toast: Toast) => {
        this.toasts.push(toast);
        setTimeout(() => this.remove(toast.id), toast.duration);
      })
    );
    this.subs.add(
      this.toastService.dismiss$.subscribe((id: string) => this.remove(id))
    );
  }

  remove(id: string): void {
    const toast = this.toasts.find(t => t.id === id);
    if (toast) {
      toast.hiding = true;                          // ← no cast needed now
      setTimeout(() => {
        this.toasts = this.toasts.filter(t => t.id !== id);
      }, 220);
    }
  }

  icon(type: string): string {
    const icons: Record<string, string> = {
      success: '✓', error: '✕', warning: '⚠', info: 'ℹ'
    };
    return icons[type] || '✓';
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }
}