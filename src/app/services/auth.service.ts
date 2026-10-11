// src/app/services/auth.service.ts
import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { FeatureFlagService } from './feature-flag.service';

export interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
  avatar_color: string;
  language?: string;
}

interface LoginResponse {
  access_token:  string;
  refresh_token: string;
  token_type:    string;
  user:          User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {

  currentUser = signal<User | null>(null);
  isLoggedIn  = signal<boolean>(false);

  private readonly ACCESS_KEY  = 'udv_access_token';
  private readonly REFRESH_KEY = 'udv_refresh_token';
  private readonly USER_KEY    = 'udv_user';

  constructor(
    private http:     HttpClient,
    private router:   Router,
    private features: FeatureFlagService,
  ) {
    this.restoreSession();
  }

  restoreSession() {
    const token = localStorage.getItem(this.ACCESS_KEY);
    const user  = localStorage.getItem(this.USER_KEY);
    if (token && user) {
      try {
        this.currentUser.set(JSON.parse(user) as User);
        this.isLoggedIn.set(true);
        // Restore flags instantly from cache — no flicker on reload
        this.features.restoreFlags();
      } catch {
        this.clearSession();
      }
    }
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      'http://localhost:8000/api/auth/login',
      { username, password }
    ).pipe(
      tap(res => {
        localStorage.setItem(this.ACCESS_KEY,  res.access_token);
        localStorage.setItem(this.REFRESH_KEY, res.refresh_token);
        localStorage.setItem(this.USER_KEY,    JSON.stringify(res.user));
        this.currentUser.set(res.user);
        this.isLoggedIn.set(true);
        window.dispatchEvent(new CustomEvent('udv-login', { detail: { token: res.access_token } }));
        // Load fresh feature flags from backend after login
        this.features.load();
      })
    );
  }

  logout() {
    this.features.clear();
    this.clearSession();
    window.dispatchEvent(new CustomEvent('udv-logout'));
    this.router.navigate(['/login']);
  }

  private clearSession() {
    localStorage.removeItem(this.ACCESS_KEY);
    localStorage.removeItem(this.REFRESH_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
    this.isLoggedIn.set(false);
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_KEY);
  }

  getAuthHeaders(): HttpHeaders {
    const token = this.getAccessToken();
    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
  }

  changePassword(currentPassword: string, newPassword: string): Observable<any> {
    return this.http.post(
      'http://localhost:8000/api/auth/change-password',
      { current_password: currentPassword, new_password: newPassword },
      { headers: this.getAuthHeaders() }
    );
  }

  getInitials(): string {
    const user = this.currentUser();
    if (!user) return '?';
    return user.full_name
      .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }

  isAdmin(): boolean {
    return this.currentUser()?.role === 'admin';
  }
}