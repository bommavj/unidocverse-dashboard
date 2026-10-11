// src/app/guards/reports.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { FeatureFlagService } from '../services/feature-flag.service';

// AI reports serve every workspace (?type=…); allow them when that workspace's module is on
const FLAG_FOR_TYPE: Record<string, keyof FeatureFlagService> = {
  insurance: 'agencyMode', immigration: 'immigrationMode', legal: 'legalMode', medical: 'medicalMode',
  finance: 'financeMode', real_estate: 'realEstateMode', hr: 'hrMode', supply_chain: 'supplyChainMode',
  compliance: 'complianceMode', operations: 'operationsMode',
};

export const reportsGuard: CanActivateFn = (route) => {
  const features = inject(FeatureFlagService);
  const router = inject(Router);
  const on = (k: keyof FeatureFlagService) => !!(features[k] as unknown as () => boolean)();
  const type = route.queryParamMap.get('type');
  const allowed = type && FLAG_FOR_TYPE[type]
    ? on(FLAG_FOR_TYPE[type])
    : Object.values(FLAG_FOR_TYPE).some(on);
  if (allowed) return true;
  router.navigate(['/dashboard']);
  return false;
};
