import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="login-page">
      <div class="login-card">

        <!-- Brand -->
        <div class="login-brand">
          <img src="assets/unidocverse-logo-transparent.png" style="height:100px;object-fit:contain;" alt="UniDocVerse"/>
        </div>

        <h2 class="login-title">Welcome back</h2>
        <p class="login-sub">Sign in to your account</p>

        <div class="login-error" *ngIf="error">{{ error }}</div>

        <div class="field">
          <label>Username</label>
          <input type="text" [(ngModel)]="username"
                 placeholder="Enter your username"
                 (keydown.enter)="submit()"
                 autocomplete="username" />
        </div>

        <div class="field">
          <label>Password</label>
          <div class="input-wrap">
            <input [type]="showPw ? 'text' : 'password'"
                   [(ngModel)]="password"
                   placeholder="••••••••"
                   (keydown.enter)="submit()" />
            <button type="button" class="eye-btn" (click)="showPw = !showPw">
              {{ showPw ? '🙈' : '👁️' }}
            </button>
          </div>
        </div>

        <button class="login-btn" (click)="submit()" [disabled]="loading">
          <span *ngIf="!loading">Sign in</span>
          <span *ngIf="loading" class="spinner"></span>
        </button>

        <p class="offline-note">🔒 Secure local authentication — works offline</p>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex; align-items: center; justify-content: center;
      font-family: -apple-system, sans-serif;
    }
    .login-card {
      background: white; border-radius: 20px;
      padding: 48px 40px; width: 100%; max-width: 420px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }

    /* ── Brand ── */
    .login-brand { display: flex; align-items: center; gap: 12px; margin-bottom: 32px; }

    .brand-logo {
      width: 42px; height: 42px;
      background: #22c55e;          /* solid green — matches Image 2 */
      border-radius: 10px;
      color: white; font-weight: 800; font-size: 20px;
      display: flex; align-items: center; justify-content: center;
    }

    .brand-name {
      font-size: 20px; font-weight: 500; color: #111827;
      letter-spacing: -.2px;
    }
    /* "Doc" in thick green — matches Image 2 */
    .brand-name strong {
      color: #22c55e;
      font-weight: 800;
      font-style: normal;
    }

    /* ── Form ── */
    .login-title { font-size: 24px; font-weight: 700; color: #111827; margin: 0 0 4px; }
    .login-sub   { color: #6b7280; font-size: 14px; margin: 0 0 28px; }

    .login-error {
      background: #fef2f2; border: 1px solid #fecaca;
      color: #dc2626; padding: 10px 14px;
      border-radius: 8px; font-size: 13px; margin-bottom: 20px;
    }

    .field { margin-bottom: 20px; }
    .field label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }

    input {
      width: 100%; padding: 11px 14px;
      border: 1.5px solid #e5e7eb; border-radius: 10px;
      font-size: 14px; outline: none; box-sizing: border-box;
      transition: border-color .15s;
    }
    input:focus { border-color: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.1); }

    .input-wrap { position: relative; }
    .input-wrap input { padding-right: 44px; }
    .eye-btn { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 16px; }

    .login-btn {
      width: 100%; padding: 13px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white; border: none; border-radius: 10px;
      font-size: 15px; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      margin-top: 8px; transition: all .16s;
    }
    .login-btn:hover:not(:disabled) { background: linear-gradient(135deg, #4f46e5, #7c3aed); transform: translateY(-1px); }
    .login-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    .spinner {
      width: 20px; height: 20px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: white; border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .offline-note { text-align: center; font-size: 12px; color: #9ca3af; margin: 20px 0 0; }
  `]
})
export class LoginComponent {
  username = ''; password = ''; error = ''; loading = false; showPw = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  submit() {
    if (!this.username || !this.password) {
      this.error = 'Please enter your username and password';
      this.cdr.markForCheck();
      return;
    }
    this.loading = true;
    this.error   = '';
    this.cdr.markForCheck();

    this.auth.login(this.username, this.password).subscribe({
      next: () => { this.router.navigate(['/dashboard']); },
      error: (err) => {
        this.error   = err.error?.detail || 'Invalid username or password';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }
}