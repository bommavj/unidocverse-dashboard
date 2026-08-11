// src/app/guards/agency.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { FeatureFlagService } from '../services/feature-flag.service';

export const agencyGuard: CanActivateFn = () => {
  const features = inject(FeatureFlagService);
  const router   = inject(Router);

  if (features.agencyMode()) {
    return true;
  }

  // Agency mode is off — redirect to dashboard silently
  router.navigate(['/dashboard']);
  return false;
};