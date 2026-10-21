// src/app/services/feature-flag.service.ts
import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface FeatureFlags {
  agency_mode: boolean;
  immigration_mode: boolean;
  legal_mode: boolean;
  medical_mode: boolean;
  finance_mode: boolean;
  real_estate_mode: boolean;
  hr_mode: boolean;
  supply_chain_mode: boolean;
  compliance_mode: boolean;
  operations_mode: boolean;
  clm_mode: boolean;
}

/** Module switch for each domain (agent sector, workflow pipeline, report) — matches the backend's DOMAIN_FLAG. */
export const DOMAIN_FLAG: Record<string, keyof FeatureFlags> = {
  insurance: 'agency_mode', claims: 'agency_mode', renewals: 'agency_mode', immigration: 'immigration_mode',
  legal: 'legal_mode', medical: 'medical_mode', finance: 'finance_mode', real_estate: 'real_estate_mode',
  hr: 'hr_mode', payroll: 'hr_mode', supply_chain: 'supply_chain_mode', procurement: 'supply_chain_mode',
  compliance: 'compliance_mode', operations: 'operations_mode', clm: 'clm_mode',
};

const DEFAULT_FLAGS: FeatureFlags = {
  agency_mode: false,
  immigration_mode: false,
  legal_mode: false,
  medical_mode: false,
  finance_mode: false,
  real_estate_mode: false,
  hr_mode: false,
  supply_chain_mode: false,
  compliance_mode: false,
  operations_mode: false,
  clm_mode: false,
};

const FLAGS_KEY = 'udv_feature_flags';

@Injectable({ providedIn: 'root' })
export class FeatureFlagService {

  private _flags = signal<FeatureFlags>(DEFAULT_FLAGS);

  constructor(private http: HttpClient) {
    this.restoreFlags();
  }

  // ── Public signals ────────────────────────────────────────────────────────

  agencyMode = () => this._flags().agency_mode;
  immigrationMode = () => this._flags().immigration_mode;
  legalMode = () => this._flags().legal_mode;
  medicalMode = () => this._flags().medical_mode;
  financeMode = () => this._flags().finance_mode;
  realEstateMode = () => this._flags().real_estate_mode;
  hrMode = () => this._flags().hr_mode;
  supplyChainMode = () => this._flags().supply_chain_mode;
  complianceMode = () => this._flags().compliance_mode;
  operationsMode = () => this._flags().operations_mode;
  clmMode = () => this._flags().clm_mode;

  /** Is this domain's module switched on? Unknown domains are shown. */
  domainOn = (domain: string): boolean => {
    const f = DOMAIN_FLAG[domain];
    return f ? !!this._flags()[f] : true;
  };

  /** Full flags object — for future expansion */
  flags = this._flags.asReadonly();

  // ── Load from backend ─────────────────────────────────────────────────────

  load(): Promise<void> {
    return new Promise(resolve => {
      this.http.get<{ flags: FeatureFlags }>('http://localhost:7979/api/features')
        .subscribe({
          next: res => {
            this._flags.set({ ...DEFAULT_FLAGS, ...res.flags });
            localStorage.setItem(FLAGS_KEY, JSON.stringify(res.flags));
            resolve();
          },
          error: () => {
            // Safe fallback — never block login on flag fetch failure
            this.restoreFlags();
            resolve();
          }
        });
    });
  }

  // ── Restore from localStorage (instant on page reload) ───────────────────

  restoreFlags() {
    const stored = localStorage.getItem(FLAGS_KEY);
    if (stored) {
      try {
        const f = JSON.parse(stored);
        // Older cached flags had no immigration switch — it followed HR
        this._flags.set({ ...DEFAULT_FLAGS, ...f, immigration_mode: f.immigration_mode ?? !!f.hr_mode });
      } catch {
        this._flags.set(DEFAULT_FLAGS);
      }
    }
  }

  // ── Clear on logout ───────────────────────────────────────────────────────

  clear() {
    localStorage.removeItem(FLAGS_KEY);
    this._flags.set(DEFAULT_FLAGS);
  }
}