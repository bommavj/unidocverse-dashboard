import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth  = inject(AuthService);
  const router = inject(Router);

  const token = auth.getAccessToken();
  const lang = localStorage.getItem('udv_language') || 'en';

  const setHeaders: any = { 'Accept-Language': lang };
  if (token) {
    setHeaders['Authorization'] = `Bearer ${token}`;
  }

  const authReq = req.clone({ setHeaders });

  return next(authReq).pipe(
    catchError(err => {
      // Only redirect on 401 if we HAD a token (session expired)
      // Don't redirect if we never had a token — just let the request fail
      if (err.status === 401 && token) {
        auth.logout();
        router.navigate(['/dashboard']);
      }
      return throwError(() => err);
    })
  );
};