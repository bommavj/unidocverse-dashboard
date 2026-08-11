// src/app/services/feature-flag.service.ts
import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface FeatureFlags {
  agency_mode: boolean;
  legal_mode: boolean;
  medical_mode: boolean;
  finance_mode: boolean;
  real_estate_mode: boolean;
  hr_mode: boolean;
  supply_chain_mode: boolean;
  compliance_mode: boolean;
  operations_mode: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  agency_mode: false,
  legal_mode: false,
  medical_mode: false,
  finance_mode: false,
  real_estate_mode: false,
  hr_mode: false,
  supply_chain_mode: false,
  compliance_mode: false,
  operations_mode: false,
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
  legalMode = () => this._flags().legal_mode;
  medicalMode = () => this._flags().medical_mode;
  financeMode = () => this._flags().finance_mode;
  realEstateMode = () => this._flags().real_estate_mode;
  hrMode = () => this._flags().hr_mode;
  supplyChainMode = () => this._flags().supply_chain_mode;
  complianceMode = () => this._flags().compliance_mode;
  operationsMode = () => this._flags().operations_mode;

  /** Full flags object — for future expansion */
  flags = this._flags.asReadonly();

  // ── Load from backend ─────────────────────────────────────────────────────

  load(): Promise<void> {
    return new Promise(resolve => {
      this.http.get<{ flags: FeatureFlags }>('http://localhost:8000/api/features')
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
        this._flags.set({ ...DEFAULT_FLAGS, ...JSON.parse(stored) });
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