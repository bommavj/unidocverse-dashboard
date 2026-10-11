// src/app/pages/settings/settings.component.ts
import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { FeatureFlagService } from '../../services/feature-flag.service';
import { LanguageService } from '../../services/language.service';
import { TranslatePipe } from '../../services/translate.pipe';

interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
  is_active: boolean;
  avatar_color: string;
  created_at: string;
  last_login: string | null;
  language?: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <div class="no-access" *ngIf="!auth.isAdmin()">
      <div class="no-access-icon">🔒</div>
      <h2>Access Denied</h2>
      <p>You don't have permission to view this page.</p>
    </div>

    <div class="settings-page" *ngIf="auth.isAdmin()">
      <div class="page-header">
        <h1>⚙️ {{ 'Settings' | translate }}</h1>
        <p class="subtitle">Manage users and agency settings</p>
      </div>

      <div class="tabs">
        <button class="tab" [class.active]="tab === 'users'"    (click)="tab='users';    cdr.markForCheck()">👥 {{ 'Users' | translate }}</button>
        <button class="tab" [class.active]="tab === 'password'" (click)="tab='password'; cdr.markForCheck()">🔑 {{ 'Change Password' | translate }}</button>
        <button class="tab" [class.active]="tab === 'tokens'"   (click)="tab='tokens'; loadTokens(); cdr.markForCheck()">🗝️ {{ 'API Tokens' | translate }}</button>
        <button class="tab" [class.active]="tab === 'language'" (click)="tab='language'; cdr.markForCheck()">🌐 {{ 'Language Preferences' | translate }}</button>
        <button class="tab" [class.active]="tab === 'features'" (click)="tab='features'; cdr.markForCheck()">🚩 {{ 'Features' | translate }}</button>
        <button class="tab" [class.active]="tab === 'agency'" *ngIf="agencyMode" (click)="tab='agency';   loadAgencySettings(); cdr.markForCheck()">🏢 {{ 'Agency' | translate }}</button>
        <button class="tab" [class.active]="tab === 'healthcare'" *ngIf="medicalMode" (click)="tab='healthcare'; loadAgencySettings(); cdr.markForCheck()">🏥 {{ 'Healthcare' | translate }}</button>
        <button class="tab" [class.active]="tab === 'finance'" *ngIf="financeMode" (click)="tab='finance'; loadAgencySettings(); cdr.markForCheck()">💰 {{ 'Finance' | translate }}</button>
        <button class="tab" [class.active]="tab === 'legal'" *ngIf="legalMode" (click)="tab='legal'; loadAgencySettings(); cdr.markForCheck()">⚖️ {{ 'Legal' | translate }}</button>
        <button class="tab" [class.active]="tab === 'real-estate'" *ngIf="realEstateMode" (click)="tab='real-estate'; loadAgencySettings(); cdr.markForCheck()">🏠 {{ 'Real Estate' | translate }}</button>
        <button class="tab" [class.active]="tab === 'hr'" *ngIf="hrMode" (click)="tab='hr'; loadAgencySettings(); cdr.markForCheck()">👥 {{ 'HR' | translate }}</button>
        <button class="tab" [class.active]="tab === 'supply-chain'" *ngIf="supplyChainMode" (click)="tab='supply-chain'; loadAgencySettings(); cdr.markForCheck()">📦 {{ 'Supply Chain' | translate }}</button>
      </div>

      <!-- ── Users tab ── -->
      <div *ngIf="tab === 'users'">
        <div class="card">
          <h2 class="card-title">Add New User</h2>
          <div class="form-grid">
            <div class="field"><label>Full Name</label><input [(ngModel)]="newUser.full_name" placeholder="Alex" /></div>
            <div class="field"><label>Username</label><input [(ngModel)]="newUser.username" placeholder="justinshield" /></div>
            <div class="field"><label>Password</label><input [(ngModel)]="newUser.password" type="password" placeholder="Min 8 characters" /></div>
            <div class="field"><label>Role</label>
              <select [(ngModel)]="newUser.role">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div class="form-footer">
            <span class="error-msg"   *ngIf="createError">{{ createError }}</span>
            <span class="success-msg" *ngIf="createSuccess">{{ createSuccess }}</span>
            <button class="btn-primary" (click)="createUser()" [disabled]="creating">{{ creating ? 'Creating...' : '+ Add User' }}</button>
          </div>
        </div>

        <div class="card">
          <h2 class="card-title">Users <span class="count-badge">{{ users.length }}</span></h2>
          <div class="loading" *ngIf="loadingUsers">Loading users…</div>
          <div class="users-table" *ngIf="!loadingUsers">
            <div class="user-row header-row"><span>User</span><span>Role</span><span>Last Login</span><span>Status</span><span>Actions</span></div>
            <div class="user-row" *ngFor="let u of users">
              <div class="user-info">
                <div class="avatar" [style.background]="u.avatar_color">{{ initials(u.full_name) }}</div>
                <div><div class="user-name">{{ u.full_name }}</div><div class="user-sub">{{ '@' + u.username }}</div></div>
              </div>
              <span class="role-badge" [class]="'role-' + u.role">{{ u.role }}</span>
              <span class="last-login">{{ u.last_login ? formatDate(u.last_login) : 'Never' }}</span>
              <span class="status-badge" [class.active]="u.is_active" [class.inactive]="!u.is_active">{{ u.is_active ? 'Active' : 'Inactive' }}</span>
              <div class="actions">
                <button class="btn-sm btn-reset"  (click)="startReset(u)">Reset PW</button>
                <button class="btn-sm btn-delete" (click)="confirmDelete(u)" [disabled]="u.username === 'admin'">Delete</button>
              </div>
            </div>
          </div>
        </div>

        <div class="card" *ngIf="resetTarget">
          <h2 class="card-title">Reset Password — {{ resetTarget.full_name }}</h2>
          <div class="form-grid">
            <div class="field"><label>New Password</label><input [(ngModel)]="resetPassword" type="password" placeholder="Min 8 characters" /></div>
          </div>
          <div class="form-footer">
            <span class="error-msg"   *ngIf="resetError">{{ resetError }}</span>
            <span class="success-msg" *ngIf="resetSuccess">{{ resetSuccess }}</span>
            <button class="btn-secondary" (click)="resetTarget = null; resetPassword = ''">Cancel</button>
            <button class="btn-primary"   (click)="resetUserPassword()" [disabled]="resetting">{{ resetting ? 'Resetting...' : 'Reset Password' }}</button>
          </div>
        </div>
      </div>

      <!-- ── Change Password tab ── -->
      <div *ngIf="tab === 'password'">
        <div class="card" style="max-width:480px">
          <h2 class="card-title">Change Your Password</h2>
          <div class="field"><label>Current Password</label><input [(ngModel)]="pwForm.current" type="password" placeholder="Current password" /></div>
          <div class="field" style="margin-top:14px"><label>New Password</label><input [(ngModel)]="pwForm.new_password" type="password" placeholder="Min 8 characters" /></div>
          <div class="field" style="margin-top:14px"><label>Confirm New Password</label><input [(ngModel)]="pwForm.confirm" type="password" placeholder="Confirm new password" /></div>
          <div class="form-footer">
            <span class="error-msg"   *ngIf="pwError">{{ pwError }}</span>
            <span class="success-msg" *ngIf="pwSuccess">{{ pwSuccess }}</span>
            <button class="btn-primary" (click)="changePassword()" [disabled]="changingPw">{{ changingPw ? 'Updating...' : 'Update Password' }}</button>
          </div>
        </div>
      </div>

      <!-- ── API tokens tab ── -->
      <div *ngIf="tab === 'tokens'">
        <div class="card" style="max-width:760px">
          <h2 class="card-title">Create an API token</h2>
          <p class="subtitle" style="margin:0 0 14px">Tokens let scripts and integrations call the UniDocVerse API as you, inside your organisation. Read tokens can only fetch data; read-write tokens can also create and update.</p>
          <div class="form-grid">
            <div class="field"><label>Name</label><input [(ngModel)]="tokenForm.name" placeholder="Nightly export script" /></div>
            <div class="field"><label>Access</label>
              <select [(ngModel)]="tokenForm.scope"><option value="read">Read only</option><option value="write">Read and write</option></select>
            </div>
            <div class="field"><label>Expires</label>
              <select [(ngModel)]="tokenForm.expires_days"><option [ngValue]="30">In 30 days</option><option [ngValue]="90">In 90 days</option><option [ngValue]="365">In 1 year</option><option [ngValue]="null">Never</option></select>
            </div>
          </div>
          <div class="form-footer">
            <span class="error-msg" *ngIf="tokenError">{{ tokenError }}</span>
            <button class="btn-primary" (click)="createToken()" [disabled]="tokenBusy">{{ tokenBusy ? 'Creating...' : 'Create token' }}</button>
          </div>
          <div *ngIf="newToken" style="margin-top:16px;padding:14px;border:1px solid #bfe3d3;background:#e7f5ef;border-radius:8px">
            <div style="font-weight:600;color:#0f7a55;margin-bottom:6px">Copy this token now — it won't be shown again</div>
            <div style="display:flex;gap:8px;align-items:center">
              <code style="flex:1;padding:8px 10px;background:#fff;border:1px solid #cbd4e1;border-radius:6px;font-size:12.5px;word-break:break-all">{{ newToken }}</code>
              <button class="btn-primary" (click)="copyToken()">{{ tokenCopied ? 'Copied' : 'Copy' }}</button>
            </div>
          </div>
        </div>
        <div class="card" style="max-width:760px;margin-top:16px">
          <h2 class="card-title">Your tokens</h2>
          <p *ngIf="!tokens.length" class="subtitle">No tokens yet.</p>
          <table *ngIf="tokens.length" style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="text-align:left;color:#76839a;font-size:11.5px;text-transform:uppercase;letter-spacing:.05em">
              <th style="padding:8px">Name</th><th style="padding:8px">Token</th><th style="padding:8px">Access</th><th style="padding:8px">Last used</th><th style="padding:8px">Status</th><th></th></tr></thead>
            <tbody>
              <tr *ngFor="let t of tokens" style="border-top:1px solid #edf1f6">
                <td style="padding:8px">{{ t.name }}<div style="color:#76839a;font-size:11.5px">{{ t.owner }}</div></td>
                <td style="padding:8px;font-family:monospace">{{ t.prefix }}…</td>
                <td style="padding:8px">{{ t.scope === 'write' ? 'Read and write' : 'Read only' }}</td>
                <td style="padding:8px">{{ t.last_used_at ? (t.last_used_at | date:'MMM d, y') : 'Never' }}</td>
                <td style="padding:8px"><span [style.color]="t.status === 'active' ? '#0f7a55' : '#b42318'">{{ t.status }}</span></td>
                <td style="padding:8px;text-align:right"><button *ngIf="t.status === 'active'" class="btn-secondary" (click)="revokeToken(t)">Revoke</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── Language tab ── -->
      <div *ngIf="tab === 'language'">
        <div class="card" style="max-width:480px">
          <h2 class="card-title">{{ 'Language Preferences' | translate }}</h2>
          <p class="card-desc">Choose your preferred language for the dashboard interface and AI analysis reports.</p>
          <div class="field">
            <label>{{ 'Preferred Language' | translate }}</label>
            <select [(ngModel)]="selectedLang" style="width:100%; padding:10px; border-radius:6px; border:1px solid var(--bdr); background:var(--surf2); color:var(--t1); font-size:14px; margin-top:6px; font-family:var(--font); outline:none;">
              <option value="en">English (EN)</option>
              <option value="es">Español (ES)</option>
              <option value="fr">Français (FR)</option>
              <option value="de">Deutsch (DE)</option>
            </select>
          </div>
          <div class="form-footer" style="margin-top:20px">
            <span class="success-msg" *ngIf="langSuccess">Language preference saved!</span>
            <span class="error-msg" *ngIf="langError">{{ langError }}</span>
            <button class="btn-primary" (click)="saveLanguage()">Save Language</button>
          </div>
        </div>
      </div>

      <!-- ── Features tab ── -->
      <div *ngIf="tab === 'features'">
        <div class="card" style="max-width:640px">
          <h2 class="card-title">Feature Flags</h2>
          <p class="card-desc">Enable or disable platform features. Changes take effect immediately.</p>
          <!-- Insurance Agency Flag -->
          <div class="feature-row">
            <div class="feature-info">
              <div class="feature-name"><span class="feature-icon">🏢</span>Insurance Agency Management</div>
              <div class="feature-desc">Enables Clients, Policy Register, and Renewal Pipeline pages in the sidebar.</div>
            </div>
            <div class="toggle-wrap">
              <button class="toggle" [class.on]="agencyMode" (click)="toggleFlag('agencyMode')" [disabled]="savingFlags"><span class="toggle-knob"></span></button>
              <span class="toggle-lbl" [class.on]="agencyMode">{{ agencyMode ? 'Enabled' : 'Disabled' }}</span>
            </div>
          </div>

          <!-- Immigration Flag -->
          <div class="feature-row">
            <div class="feature-info">
              <div class="feature-name"><span class="feature-icon">🛂</span>Immigration</div>
              <div class="feature-desc">Enables the visa tracker, immigration cases, client CRM, USCIS form auto-fill and filing packets.</div>
            </div>
            <div class="toggle-wrap">
              <button class="toggle" [class.on]="immigrationMode" (click)="toggleFlag('immigrationMode')" [disabled]="savingFlags"><span class="toggle-knob"></span></button>
              <span class="toggle-lbl" [class.on]="immigrationMode">{{ immigrationMode ? 'Enabled' : 'Disabled' }}</span>
            </div>
          </div>

          <!-- Legal & Compliance Flag -->
          <div class="feature-row">
            <div class="feature-info">
              <div class="feature-name"><span class="feature-icon">⚖️</span>Legal & Compliance</div>
              <div class="feature-desc">Enables clause auditing, non-disclosure risk detection, and legal contract analysis.</div>
            </div>
            <div class="toggle-wrap">
              <button class="toggle" [class.on]="legalMode" (click)="toggleFlag('legalMode')" [disabled]="savingFlags"><span class="toggle-knob"></span></button>
              <span class="toggle-lbl" [class.on]="legalMode">{{ legalMode ? 'Enabled' : 'Disabled' }}</span>
            </div>
          </div>

          <!-- Healthcare & Medical Flag -->
          <div class="feature-row">
            <div class="feature-info">
              <div class="feature-name"><span class="feature-icon">🏥</span>Healthcare & Medical Admin</div>
              <div class="feature-desc">Enables medical charts Q&A, HIPAA-compliant PII masking, and lab reports summarization.</div>
            </div>
            <div class="toggle-wrap">
              <button class="toggle" [class.on]="medicalMode" (click)="toggleFlag('medicalMode')" [disabled]="savingFlags"><span class="toggle-knob"></span></button>
              <span class="toggle-lbl" [class.on]="medicalMode">{{ medicalMode ? 'Enabled' : 'Disabled' }}</span>
            </div>
          </div>

          <!-- Finance Flag -->
          <div class="feature-row">
            <div class="feature-info">
              <div class="feature-name"><span class="feature-icon">💰</span>Finance, Tax & Auditing</div>
              <div class="feature-desc">Enables bank statement audits, tax returns reconciliation, and invoice discrepancy flags.</div>
            </div>
            <div class="toggle-wrap">
              <button class="toggle" [class.on]="financeMode" (click)="toggleFlag('financeMode')" [disabled]="savingFlags"><span class="toggle-knob"></span></button>
              <span class="toggle-lbl" [class.on]="financeMode">{{ financeMode ? 'Enabled' : 'Disabled' }}</span>
            </div>
          </div>

          <!-- Real Estate & Mortgages Flag -->
          <div class="feature-row">
            <div class="feature-info">
              <div class="feature-name"><span class="feature-icon">🏠</span>Real Estate & Mortgages</div>
              <div class="feature-desc">Enables property appraisals, title deeds, closing disclosures, and lease audits.</div>
            </div>
            <div class="toggle-wrap">
              <button class="toggle" [class.on]="realEstateMode" (click)="toggleFlag('realEstateMode')" [disabled]="savingFlags"><span class="toggle-knob"></span></button>
              <span class="toggle-lbl" [class.on]="realEstateMode">{{ realEstateMode ? 'Enabled' : 'Disabled' }}</span>
            </div>
          </div>

          <!-- HR Flag -->
          <div class="feature-row">
            <div class="feature-info">
              <div class="feature-name"><span class="feature-icon">👥</span>Human Resources (HR)</div>
              <div class="feature-desc">Enables resumes, employee handbooks, performance reviews, and visa documents.</div>
            </div>
            <div class="toggle-wrap">
              <button class="toggle" [class.on]="hrMode" (click)="toggleFlag('hrMode')" [disabled]="savingFlags"><span class="toggle-knob"></span></button>
              <span class="toggle-lbl" [class.on]="hrMode">{{ hrMode ? 'Enabled' : 'Disabled' }}</span>
            </div>
          </div>

          <!-- Supply Chain Flag -->
          <div class="feature-row">
            <div class="feature-info">
              <div class="feature-name"><span class="feature-icon">📦</span>Supply Chain & Logistics</div>
              <div class="feature-desc">Enables purchase orders, bills of lading, customs manifests, and vendor agreements.</div>
            </div>
            <div class="toggle-wrap">
              <button class="toggle" [class.on]="supplyChainMode" (click)="toggleFlag('supplyChainMode')" [disabled]="savingFlags"><span class="toggle-knob"></span></button>
              <span class="toggle-lbl" [class.on]="supplyChainMode">{{ supplyChainMode ? 'Enabled' : 'Disabled' }}</span>
            </div>
          </div>

          <!-- Compliance & Risk Flag -->
          <div class="feature-row">
            <div class="feature-info">
              <div class="feature-name"><span class="feature-icon">✅</span>Compliance & Risk</div>
              <div class="feature-desc">Enables Compliance, Risk, Audit, and Deadlines pages in the sidebar.</div>
            </div>
            <div class="toggle-wrap">
              <button class="toggle" [class.on]="complianceMode" (click)="toggleFlag('complianceMode')" [disabled]="savingFlags"><span class="toggle-knob"></span></button>
              <span class="toggle-lbl" [class.on]="complianceMode">{{ complianceMode ? 'Enabled' : 'Disabled' }}</span>
            </div>
          </div>

          <!-- Operations Flag -->
          <div class="feature-row">
            <div class="feature-info">
              <div class="feature-name"><span class="feature-icon">⚙️</span>Operations</div>
              <div class="feature-desc">Enables Matters, Claims, Approvals, Quotes, CLM, and Jurisdiction pages in the sidebar.</div>
            </div>
            <div class="toggle-wrap">
              <button class="toggle" [class.on]="operationsMode" (click)="toggleFlag('operationsMode')" [disabled]="savingFlags"><span class="toggle-knob"></span></button>
              <span class="toggle-lbl" [class.on]="operationsMode">{{ operationsMode ? 'Enabled' : 'Disabled' }}</span>
            </div>
          </div>

          <div class="feature-footer">
            <span class="success-msg" *ngIf="flagSuccess">{{ flagSuccess }}</span>
            <span class="error-msg"   *ngIf="flagError">{{ flagError }}</span>
          </div>
        </div>
      </div>

      <!-- ── Agency tab ── -->
      <div *ngIf="tab === 'agency' && agencyMode">

        <!-- Company Info -->
        <div class="card">
          <h2 class="card-title">🏢 Company Information</h2>
          <p class="card-desc">This information appears in emails, reports, and documents sent to clients.</p>
          <div class="form-grid">
            <div class="field"><label>Company Name</label><input [(ngModel)]="agency.agency_name" placeholder="Company Name"></div>
            <div class="field"><label>Contact Name</label><input [(ngModel)]="agency.agent_name" placeholder="Contact Name"></div>
            <div class="field"><label>Company Email</label><input [(ngModel)]="agency.agency_email" type="email" placeholder="you@example.com"></div>
            <div class="field"><label>Phone</label><input [(ngModel)]="agency.agent_phone" placeholder="Phone Number"></div>
            <div class="field"><label>License Number</label><input [(ngModel)]="agency.agent_license" placeholder="License / Registration #"></div>
            <div class="field"><label>Website</label><input [(ngModel)]="agency.agency_website" placeholder="www.example.com"></div>
            <div class="field full"><label>Address</label><input [(ngModel)]="agency.agency_address" placeholder="Address"></div>
          </div>
        </div>

        <!-- Email / SMTP -->
        <div class="card">
          <h2 class="card-title">📧 Email Settings</h2>
          <p class="card-desc">
            Used to send renewal reminders, COIs, and summaries to clients.
            Enter your SMTP email server authentication details.
          </p>
          <div class="form-grid">
            <div class="field"><label>From Name</label><input [(ngModel)]="agency.smtp_from_name" placeholder="Insurance Agent"></div>
            <div class="field"><label>Email Address</label><input [(ngModel)]="agency.smtp_user" type="email" placeholder="you@example.com"></div>
            <div class="field"><label>Password</label><input [(ngModel)]="agency.smtp_pass" type="password" placeholder="Password"></div>
            <div class="field"><label>SMTP Host</label><input [(ngModel)]="agency.smtp_host" placeholder="smtp.example.com"></div>
            <div class="field"><label>SMTP Port</label><input [(ngModel)]="agency.smtp_port" placeholder="465"></div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;margin-top:8px">
            <button class="btn-test" (click)="testEmail()" [disabled]="testingEmail">
              {{ testingEmail ? 'Sending…' : '📨 Send Test Email' }}
            </button>
            <span *ngIf="agencyMsg" [style.color]="agencyMsg.startsWith('✅') ? '#16a34a' : '#dc2626'" style="font-size:13px;font-weight:500">{{ agencyMsg }}</span>
          </div>
        </div>

        <!-- Renewal Notifications -->
        <div class="card">
          <h2 class="card-title">🔔 Renewal Notification Settings</h2>
          <div class="form-grid">
            <div class="field">
              <label>Email Reminders</label>
              <select [(ngModel)]="agency.renewal_notify_enabled">
                <option value="true">Enabled — send automatically</option>
                <option value="false">Disabled</option>
              </select>
            </div>
            <div class="field">
              <label>Remind at (days before expiry)</label>
              <input [(ngModel)]="agency.renewal_notify_days" placeholder="90,30,14,7">
              <span style="font-size:11px;color:#94a3b8;margin-top:3px">Comma separated</span>
            </div>
            <div class="field">
              <label>Calendar Events (.ics)</label>
              <select [(ngModel)]="agency.calendar_sync_enabled">
                <option value="true">Create .ics files for each renewal</option>
                <option value="false">Disabled</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Save -->
        <div style="display:flex;align-items:center;gap:12px;margin-top:4px">
          <button class="btn-primary" (click)="saveAgencySettings()" [disabled]="agencySaving">
            {{ agencySaving ? 'Saving…' : '✓ Save All Settings' }}
          </button>
          <span *ngIf="agencyMsg && !testingEmail" [style.color]="agencyMsg.startsWith('✅') ? '#16a34a' : '#dc2626'" style="font-size:13px;font-weight:500">{{ agencyMsg }}</span>
        </div>

      </div>

      <!-- ── Healthcare tab ── -->
      <div *ngIf="tab === 'healthcare' && medicalMode">

        <!-- Company Info -->
        <div class="card">
          <h2 class="card-title">🏢 Company Information</h2>
          <p class="card-desc">This information appears in emails, reports, and documents sent to clients.</p>
          <div class="form-grid">
            <div class="field"><label>Company Name</label><input [(ngModel)]="agency.agency_name" placeholder="Company Name"></div>
            <div class="field"><label>Contact Name</label><input [(ngModel)]="agency.agent_name" placeholder="Contact Name"></div>
            <div class="field"><label>Company Email</label><input [(ngModel)]="agency.agency_email" type="email" placeholder="you@example.com"></div>
            <div class="field"><label>Phone</label><input [(ngModel)]="agency.agent_phone" placeholder="Phone Number"></div>
            <div class="field"><label>License Number</label><input [(ngModel)]="agency.agent_license" placeholder="License / Registration #"></div>
            <div class="field"><label>Website</label><input [(ngModel)]="agency.agency_website" placeholder="www.example.com"></div>
            <div class="field full"><label>Address</label><input [(ngModel)]="agency.agency_address" placeholder="Address"></div>
          </div>
        </div>

        <div class="card">
          <h2 class="card-title">🏥 Healthcare Settings</h2>
          <p class="card-desc">Configure HIPAA compliance policies and patient chart review triggers.</p>
          <div class="form-grid">
            <div class="field">
              <label>Email Reminders</label>
              <select [(ngModel)]="agency.medical_notify_enabled">
                <option value="true">Enabled — send automatically</option>
                <option value="false">Disabled</option>
              </select>
            </div>
            <div class="field">
              <label>Remind at (days before chart review)</label>
              <input [(ngModel)]="agency.medical_notify_days" placeholder="30,14,7">
              <span style="font-size:11px;color:#94a3b8;margin-top:3px">Comma separated</span>
            </div>
            <div class="field">
              <label>HIPAA PII Masking</label>
              <select [(ngModel)]="agency.medical_pii_masking">
                <option value="true">Mask all patient details on report compilation</option>
                <option value="false">Show raw patient information</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Email Settings -->
        <div class="card">
          <h2 class="card-title">📧 Email Settings</h2>
          <p class="card-desc">
            Used to send reminders, alerts, and summaries.
            Enter your SMTP email server authentication details.
          </p>
          <div class="form-grid">
            <div class="field"><label>From Name</label><input [(ngModel)]="agency.smtp_from_name" placeholder="Sender Name"></div>
            <div class="field"><label>Email Address</label><input [(ngModel)]="agency.smtp_user" type="email" placeholder="you@example.com"></div>
            <div class="field"><label>Password</label><input [(ngModel)]="agency.smtp_pass" type="password" placeholder="Password"></div>
            <div class="field"><label>SMTP Host</label><input [(ngModel)]="agency.smtp_host" placeholder="smtp.example.com"></div>
            <div class="field"><label>SMTP Port</label><input [(ngModel)]="agency.smtp_port" placeholder="465"></div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;margin-top:8px">
            <button class="btn-test" (click)="testEmail()" [disabled]="testingEmail">
              {{ testingEmail ? 'Sending…' : '📨 Send Test Email' }}
            </button>
            <span *ngIf="agencyMsg" [style.color]="agencyMsg.startsWith('✅') ? '#16a34a' : '#dc2626'" style="font-size:13px;font-weight:500">{{ agencyMsg }}</span>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:12px;margin-top:4px">
          <button class="btn-primary" (click)="saveAgencySettings()" [disabled]="agencySaving">
            {{ agencySaving ? 'Saving…' : '✓ Save Healthcare Settings' }}
          </button>
          <span *ngIf="agencyMsg && !testingEmail" [style.color]="agencyMsg.startsWith('✅') ? '#16a34a' : '#dc2626'" style="font-size:13px;font-weight:500">{{ agencyMsg }}</span>
        </div>
      </div>

      <!-- ── Finance tab ── -->
      <div *ngIf="tab === 'finance' && financeMode">

        <!-- Company Info -->
        <div class="card">
          <h2 class="card-title">🏢 Company Information</h2>
          <p class="card-desc">This information appears in emails, reports, and documents sent to clients.</p>
          <div class="form-grid">
            <div class="field"><label>Company Name</label><input [(ngModel)]="agency.agency_name" placeholder="Company Name"></div>
            <div class="field"><label>Contact Name</label><input [(ngModel)]="agency.agent_name" placeholder="Contact Name"></div>
            <div class="field"><label>Company Email</label><input [(ngModel)]="agency.agency_email" type="email" placeholder="you@example.com"></div>
            <div class="field"><label>Phone</label><input [(ngModel)]="agency.agent_phone" placeholder="Phone Number"></div>
            <div class="field"><label>License Number</label><input [(ngModel)]="agency.agent_license" placeholder="License / Registration #"></div>
            <div class="field"><label>Website</label><input [(ngModel)]="agency.agency_website" placeholder="www.example.com"></div>
            <div class="field full"><label>Address</label><input [(ngModel)]="agency.agency_address" placeholder="Address"></div>
          </div>
        </div>

        <div class="card">
          <h2 class="card-title">💰 Finance Settings</h2>
          <p class="card-desc">Configure invoice reconciliation guidelines and transaction alert schedules.</p>
          <div class="form-grid">
            <div class="field">
              <label>Email Reminders</label>
              <select [(ngModel)]="agency.finance_notify_enabled">
                <option value="true">Enabled — send automatically</option>
                <option value="false">Disabled</option>
              </select>
            </div>
            <div class="field">
              <label>Remind at (days before payment due)</label>
              <input [(ngModel)]="agency.finance_notify_days" placeholder="15,5,1">
              <span style="font-size:11px;color:#94a3b8;margin-top:3px">Comma separated</span>
            </div>
            <div class="field">
              <label>Invoice Discrepancy Tolerance (%)</label>
              <input [(ngModel)]="agency.finance_tolerance_pct" type="number" placeholder="5">
              <span style="font-size:11px;color:#94a3b8;margin-top:3px">Percentage mismatch threshold for invoice flagging</span>
            </div>
          </div>
        </div>

        <!-- Email Settings -->
        <div class="card">
          <h2 class="card-title">📧 Email Settings</h2>
          <p class="card-desc">
            Used to send reminders, alerts, and summaries.
            Enter your SMTP email server authentication details.
          </p>
          <div class="form-grid">
            <div class="field"><label>From Name</label><input [(ngModel)]="agency.smtp_from_name" placeholder="Sender Name"></div>
            <div class="field"><label>Email Address</label><input [(ngModel)]="agency.smtp_user" type="email" placeholder="you@example.com"></div>
            <div class="field"><label>Password</label><input [(ngModel)]="agency.smtp_pass" type="password" placeholder="Password"></div>
            <div class="field"><label>SMTP Host</label><input [(ngModel)]="agency.smtp_host" placeholder="smtp.example.com"></div>
            <div class="field"><label>SMTP Port</label><input [(ngModel)]="agency.smtp_port" placeholder="465"></div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;margin-top:8px">
            <button class="btn-test" (click)="testEmail()" [disabled]="testingEmail">
              {{ testingEmail ? 'Sending…' : '📨 Send Test Email' }}
            </button>
            <span *ngIf="agencyMsg" [style.color]="agencyMsg.startsWith('✅') ? '#16a34a' : '#dc2626'" style="font-size:13px;font-weight:500">{{ agencyMsg }}</span>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:12px;margin-top:4px">
          <button class="btn-primary" (click)="saveAgencySettings()" [disabled]="agencySaving">
            {{ agencySaving ? 'Saving…' : '✓ Save Finance Settings' }}
          </button>
          <span *ngIf="agencyMsg && !testingEmail" [style.color]="agencyMsg.startsWith('✅') ? '#16a34a' : '#dc2626'" style="font-size:13px;font-weight:500">{{ agencyMsg }}</span>
        </div>
      </div>

      <!-- ── Legal tab ── -->
      <div *ngIf="tab === 'legal' && legalMode">

        <!-- Company Info -->
        <div class="card">
          <h2 class="card-title">🏢 Company Information</h2>
          <p class="card-desc">This information appears in emails, reports, and documents sent to clients.</p>
          <div class="form-grid">
            <div class="field"><label>Company Name</label><input [(ngModel)]="agency.agency_name" placeholder="Company Name"></div>
            <div class="field"><label>Contact Name</label><input [(ngModel)]="agency.agent_name" placeholder="Contact Name"></div>
            <div class="field"><label>Company Email</label><input [(ngModel)]="agency.agency_email" type="email" placeholder="you@example.com"></div>
            <div class="field"><label>Phone</label><input [(ngModel)]="agency.agent_phone" placeholder="Phone Number"></div>
            <div class="field"><label>License Number</label><input [(ngModel)]="agency.agent_license" placeholder="License / Registration #"></div>
            <div class="field"><label>Website</label><input [(ngModel)]="agency.agency_website" placeholder="www.example.com"></div>
            <div class="field full"><label>Address</label><input [(ngModel)]="agency.agency_address" placeholder="Address"></div>
          </div>
        </div>

        <div class="card">
          <h2 class="card-title">⚖️ Legal Settings</h2>
          <p class="card-desc">Configure legal contract expiration reminders and default jurisdiction rules.</p>
          <div class="form-grid">
            <div class="field">
              <label>Email Reminders</label>
              <select [(ngModel)]="agency.legal_notify_enabled">
                <option value="true">Enabled — send automatically</option>
                <option value="false">Disabled</option>
              </select>
            </div>
            <div class="field">
              <label>Remind at (days before contract expiry)</label>
              <input [(ngModel)]="agency.legal_notify_days" placeholder="90,30,14">
              <span style="font-size:11px;color:#94a3b8;margin-top:3px">Comma separated</span>
            </div>
            <div class="field">
              <label>Default Governing Law Jurisdiction</label>
              <input [(ngModel)]="agency.legal_default_law" placeholder="Delaware">
              <span style="font-size:11px;color:#94a3b8;margin-top:3px">Standard fallback for clause audits</span>
            </div>
          </div>
        </div>

        <!-- Email Settings -->
        <div class="card">
          <h2 class="card-title">📧 Email Settings</h2>
          <p class="card-desc">
            Used to send reminders, alerts, and summaries.
            Enter your SMTP email server authentication details.
          </p>
          <div class="form-grid">
            <div class="field"><label>From Name</label><input [(ngModel)]="agency.smtp_from_name" placeholder="Sender Name"></div>
            <div class="field"><label>Email Address</label><input [(ngModel)]="agency.smtp_user" type="email" placeholder="you@example.com"></div>
            <div class="field"><label>Password</label><input [(ngModel)]="agency.smtp_pass" type="password" placeholder="Password"></div>
            <div class="field"><label>SMTP Host</label><input [(ngModel)]="agency.smtp_host" placeholder="smtp.example.com"></div>
            <div class="field"><label>SMTP Port</label><input [(ngModel)]="agency.smtp_port" placeholder="465"></div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;margin-top:8px">
            <button class="btn-test" (click)="testEmail()" [disabled]="testingEmail">
              {{ testingEmail ? 'Sending…' : '📨 Send Test Email' }}
            </button>
            <span *ngIf="agencyMsg" [style.color]="agencyMsg.startsWith('✅') ? '#16a34a' : '#dc2626'" style="font-size:13px;font-weight:500">{{ agencyMsg }}</span>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:12px;margin-top:4px">
          <button class="btn-primary" (click)="saveAgencySettings()" [disabled]="agencySaving">
            {{ agencySaving ? 'Saving…' : '✓ Save Legal Settings' }}
          </button>
          <span *ngIf="agencyMsg && !testingEmail" [style.color]="agencyMsg.startsWith('✅') ? '#16a34a' : '#dc2626'" style="font-size:13px;font-weight:500">{{ agencyMsg }}</span>
        </div>
      </div>

      <!-- ── Real Estate tab ── -->
      <div *ngIf="tab === 'real-estate' && realEstateMode">

        <!-- Company Info -->
        <div class="card">
          <h2 class="card-title">🏢 Company Information</h2>
          <p class="card-desc">This information appears in emails, reports, and documents sent to clients.</p>
          <div class="form-grid">
            <div class="field"><label>Company Name</label><input [(ngModel)]="agency.agency_name" placeholder="Company Name"></div>
            <div class="field"><label>Contact Name</label><input [(ngModel)]="agency.agent_name" placeholder="Contact Name"></div>
            <div class="field"><label>Company Email</label><input [(ngModel)]="agency.agency_email" type="email" placeholder="you@example.com"></div>
            <div class="field"><label>Phone</label><input [(ngModel)]="agency.agent_phone" placeholder="Phone Number"></div>
            <div class="field"><label>License Number</label><input [(ngModel)]="agency.agent_license" placeholder="License / Registration #"></div>
            <div class="field"><label>Website</label><input [(ngModel)]="agency.agency_website" placeholder="www.example.com"></div>
            <div class="field full"><label>Address</label><input [(ngModel)]="agency.agency_address" placeholder="Address"></div>
          </div>
        </div>

        <div class="card">
          <h2 class="card-title">🏠 Real Estate Settings</h2>
          <p class="card-desc">Configure escrow milestone notifications and comparable pricing margins.</p>
          <div class="form-grid">
            <div class="field">
              <label>Email Reminders</label>
              <select [(ngModel)]="agency.real_estate_notify_enabled">
                <option value="true">Enabled — send automatically</option>
                <option value="false">Disabled</option>
              </select>
            </div>
            <div class="field">
              <label>Remind at (days before closing due)</label>
              <input [(ngModel)]="agency.real_estate_notify_days" placeholder="30,15,5">
              <span style="font-size:11px;color:#94a3b8;margin-top:3px">Comma separated</span>
            </div>
            <div class="field">
              <label>Valuation comp buffer (%)</label>
              <input [(ngModel)]="agency.real_estate_buffer" type="number" placeholder="10">
              <span style="font-size:11px;color:#94a3b8;margin-top:3px">Marginal buffer for comparable listings match alerts</span>
            </div>
          </div>
        </div>

        <!-- Email Settings -->
        <div class="card">
          <h2 class="card-title">📧 Email Settings</h2>
          <p class="card-desc">
            Used to send reminders, alerts, and summaries.
            Enter your SMTP email server authentication details.
          </p>
          <div class="form-grid">
            <div class="field"><label>From Name</label><input [(ngModel)]="agency.smtp_from_name" placeholder="Sender Name"></div>
            <div class="field"><label>Email Address</label><input [(ngModel)]="agency.smtp_user" type="email" placeholder="you@example.com"></div>
            <div class="field"><label>Password</label><input [(ngModel)]="agency.smtp_pass" type="password" placeholder="Password"></div>
            <div class="field"><label>SMTP Host</label><input [(ngModel)]="agency.smtp_host" placeholder="smtp.example.com"></div>
            <div class="field"><label>SMTP Port</label><input [(ngModel)]="agency.smtp_port" placeholder="465"></div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;margin-top:8px">
            <button class="btn-test" (click)="testEmail()" [disabled]="testingEmail">
              {{ testingEmail ? 'Sending…' : '📨 Send Test Email' }}
            </button>
            <span *ngIf="agencyMsg" [style.color]="agencyMsg.startsWith('✅') ? '#16a34a' : '#dc2626'" style="font-size:13px;font-weight:500">{{ agencyMsg }}</span>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:12px;margin-top:4px">
          <button class="btn-primary" (click)="saveAgencySettings()" [disabled]="agencySaving">
            {{ agencySaving ? 'Saving…' : '✓ Save Real Estate Settings' }}
          </button>
          <span *ngIf="agencyMsg && !testingEmail" [style.color]="agencyMsg.startsWith('✅') ? '#16a34a' : '#dc2626'" style="font-size:13px;font-weight:500">{{ agencyMsg }}</span>
        </div>
      </div>

      <!-- ── HR tab ── -->
      <div *ngIf="tab === 'hr' && hrMode">

        <!-- Company Info -->
        <div class="card">
          <h2 class="card-title">🏢 Company Information</h2>
          <p class="card-desc">This information appears in emails, reports, and documents sent to clients.</p>
          <div class="form-grid">
            <div class="field"><label>Company Name</label><input [(ngModel)]="agency.agency_name" placeholder="Company Name"></div>
            <div class="field"><label>Contact Name</label><input [(ngModel)]="agency.agent_name" placeholder="Contact Name"></div>
            <div class="field"><label>Company Email</label><input [(ngModel)]="agency.agency_email" type="email" placeholder="you@example.com"></div>
            <div class="field"><label>Phone</label><input [(ngModel)]="agency.agent_phone" placeholder="Phone Number"></div>
            <div class="field"><label>License Number</label><input [(ngModel)]="agency.agent_license" placeholder="License / Registration #"></div>
            <div class="field"><label>Website</label><input [(ngModel)]="agency.agency_website" placeholder="www.example.com"></div>
            <div class="field full"><label>Address</label><input [(ngModel)]="agency.agency_address" placeholder="Address"></div>
          </div>
        </div>

        <div class="card">
          <h2 class="card-title">👥 HR Settings</h2>
          <p class="card-desc">Configure recruitment onboarding task schedules and performance review cycles.</p>
          <div class="form-grid">
            <div class="field">
              <label>Email Reminders</label>
              <select [(ngModel)]="agency.hr_notify_enabled">
                <option value="true">Enabled — send automatically</option>
                <option value="false">Disabled</option>
              </select>
            </div>
            <div class="field">
              <label>Remind at (days before onboarding task due)</label>
              <input [(ngModel)]="agency.hr_notify_days" placeholder="7,3,1">
              <span style="font-size:11px;color:#94a3b8;margin-top:3px">Comma separated</span>
            </div>
            <div class="field">
              <label>Performance Review cycle</label>
              <select [(ngModel)]="agency.hr_review_freq">
                <option value="annual">Annual</option>
                <option value="semi-annual">Semi-Annual</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Email Settings -->
        <div class="card">
          <h2 class="card-title">📧 Email Settings</h2>
          <p class="card-desc">
            Used to send reminders, alerts, and summaries.
            Enter your SMTP email server authentication details.
          </p>
          <div class="form-grid">
            <div class="field"><label>From Name</label><input [(ngModel)]="agency.smtp_from_name" placeholder="Sender Name"></div>
            <div class="field"><label>Email Address</label><input [(ngModel)]="agency.smtp_user" type="email" placeholder="you@example.com"></div>
            <div class="field"><label>Password</label><input [(ngModel)]="agency.smtp_pass" type="password" placeholder="Password"></div>
            <div class="field"><label>SMTP Host</label><input [(ngModel)]="agency.smtp_host" placeholder="smtp.example.com"></div>
            <div class="field"><label>SMTP Port</label><input [(ngModel)]="agency.smtp_port" placeholder="465"></div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;margin-top:8px">
            <button class="btn-test" (click)="testEmail()" [disabled]="testingEmail">
              {{ testingEmail ? 'Sending…' : '📨 Send Test Email' }}
            </button>
            <span *ngIf="agencyMsg" [style.color]="agencyMsg.startsWith('✅') ? '#16a34a' : '#dc2626'" style="font-size:13px;font-weight:500">{{ agencyMsg }}</span>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:12px;margin-top:4px">
          <button class="btn-primary" (click)="saveAgencySettings()" [disabled]="agencySaving">
            {{ agencySaving ? 'Saving…' : '✓ Save HR Settings' }}
          </button>
          <span *ngIf="agencyMsg && !testingEmail" [style.color]="agencyMsg.startsWith('✅') ? '#16a34a' : '#dc2626'" style="font-size:13px;font-weight:500">{{ agencyMsg }}</span>
        </div>
      </div>

      <!-- ── Supply Chain tab ── -->
      <div *ngIf="tab === 'supply-chain' && supplyChainMode">

        <!-- Company Info -->
        <div class="card">
          <h2 class="card-title">🏢 Company Information</h2>
          <p class="card-desc">This information appears in emails, reports, and documents sent to clients.</p>
          <div class="form-grid">
            <div class="field"><label>Company Name</label><input [(ngModel)]="agency.agency_name" placeholder="Company Name"></div>
            <div class="field"><label>Contact Name</label><input [(ngModel)]="agency.agent_name" placeholder="Contact Name"></div>
            <div class="field"><label>Company Email</label><input [(ngModel)]="agency.agency_email" type="email" placeholder="you@example.com"></div>
            <div class="field"><label>Phone</label><input [(ngModel)]="agency.agent_phone" placeholder="Phone Number"></div>
            <div class="field"><label>License Number</label><input [(ngModel)]="agency.agent_license" placeholder="License / Registration #"></div>
            <div class="field"><label>Website</label><input [(ngModel)]="agency.agency_website" placeholder="www.example.com"></div>
            <div class="field full"><label>Address</label><input [(ngModel)]="agency.agency_address" placeholder="Address"></div>
          </div>
        </div>

        <div class="card">
          <h2 class="card-title">📦 Supply Chain Settings</h2>
          <p class="card-desc">Configure shipment delay warnings and customs clearance filing milestones.</p>
          <div class="form-grid">
            <div class="field">
              <label>Email Reminders</label>
              <select [(ngModel)]="agency.supply_chain_notify_enabled">
                <option value="true">Enabled — send automatically</option>
                <option value="false">Disabled</option>
              </select>
            </div>
            <div class="field">
              <label>Remind at (days before customs filing due)</label>
              <input [(ngModel)]="agency.supply_chain_notify_days" placeholder="14,7,2">
              <span style="font-size:11px;color:#94a3b8;margin-top:3px">Comma separated</span>
            </div>
            <div class="field">
              <label>Delay warning threshold (hours)</label>
              <input [(ngModel)]="agency.supply_chain_delay_threshold" type="number" placeholder="24">
              <span style="font-size:11px;color:#94a3b8;margin-top:3px">Alert if carrier cargo status unchanged for X hours</span>
            </div>
          </div>
        </div>

        <!-- Email Settings -->
        <div class="card">
          <h2 class="card-title">📧 Email Settings</h2>
          <p class="card-desc">
            Used to send reminders, alerts, and summaries.
            Enter your SMTP email server authentication details.
          </p>
          <div class="form-grid">
            <div class="field"><label>From Name</label><input [(ngModel)]="agency.smtp_from_name" placeholder="Sender Name"></div>
            <div class="field"><label>Email Address</label><input [(ngModel)]="agency.smtp_user" type="email" placeholder="you@example.com"></div>
            <div class="field"><label>Password</label><input [(ngModel)]="agency.smtp_pass" type="password" placeholder="Password"></div>
            <div class="field"><label>SMTP Host</label><input [(ngModel)]="agency.smtp_host" placeholder="smtp.example.com"></div>
            <div class="field"><label>SMTP Port</label><input [(ngModel)]="agency.smtp_port" placeholder="465"></div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;margin-top:8px">
            <button class="btn-test" (click)="testEmail()" [disabled]="testingEmail">
              {{ testingEmail ? 'Sending…' : '📨 Send Test Email' }}
            </button>
            <span *ngIf="agencyMsg" [style.color]="agencyMsg.startsWith('✅') ? '#16a34a' : '#dc2626'" style="font-size:13px;font-weight:500">{{ agencyMsg }}</span>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:12px;margin-top:4px">
          <button class="btn-primary" (click)="saveAgencySettings()" [disabled]="agencySaving">
            {{ agencySaving ? 'Saving…' : '✓ Save Supply Chain Settings' }}
          </button>
          <span *ngIf="agencyMsg && !testingEmail" [style.color]="agencyMsg.startsWith('✅') ? '#16a34a' : '#dc2626'" style="font-size:13px;font-weight:500">{{ agencyMsg }}</span>
        </div>
      </div>

    </div>

    <!-- Delete Confirm Dialog -->
    <div class="dialog-overlay" *ngIf="deleteTarget" (click)="deleteTarget = null">
      <div class="dialog" (click)="$event.stopPropagation()">
        <div class="dialog-icon">🗑️</div>
        <h3 class="dialog-title">Delete User</h3>
        <p class="dialog-msg">Are you sure you want to delete <strong>{{ deleteTarget.full_name }}</strong> ({{ '@' + deleteTarget.username }})? This cannot be undone.</p>
        <div class="dialog-actions">
          <button class="btn-secondary" (click)="deleteTarget = null">Cancel</button>
          <button class="btn-danger" (click)="deleteUser()" [disabled]="deleting">{{ deleting ? 'Deleting...' : 'Yes, Delete' }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .no-access { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:60vh; font-family:-apple-system,sans-serif; }
    .no-access-icon { font-size:56px; margin-bottom:16px; }
    .no-access h2 { font-size:22px; font-weight:700; color:#111827; margin:0 0 8px; }
    .no-access p  { font-size:14px; color:#6b7280; margin:0; }
    .settings-page { padding:28px; max-width:900px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
    .page-header { margin-bottom:24px; }
    .page-header h1 { font-size:24px; font-weight:700; margin:0 0 4px; color:#111827; }
    .subtitle { color:#6b7280; font-size:14px; margin:0; }
    .tabs { display:flex; gap:8px; margin-bottom:24px; flex-wrap:wrap; }
    .tab { padding:8px 20px; border-radius:8px; border:1px solid #e5e7eb; background:white; cursor:pointer; font-size:14px; font-weight:500; color:#6b7280; transition:all .2s; }
    .tab:hover { border-color:#6366f1; color:#6366f1; }
    .tab.active { background:#6366f1; border-color:#6366f1; color:white; }
    .card { background:white; border:1px solid #e5e7eb; border-radius:12px; padding:24px; margin-bottom:20px; }
    .card-title { font-size:16px; font-weight:700; color:#111827; margin:0 0 6px; }
    .card-desc  { font-size:13px; color:#6b7280; margin:0 0 18px; line-height:1.5; }
    .count-badge { background:#ede9fe; color:#7c3aed; font-size:12px; padding:2px 8px; border-radius:10px; font-weight:600; }
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:16px; }
    .field { display:flex; flex-direction:column; gap:5px; }
    .field.full { grid-column:1/-1; }
    .field label { font-size:11px; font-weight:700; color:#374151; text-transform:uppercase; letter-spacing:.4px; }
    input, select { padding:9px 12px; border:1.5px solid #e5e7eb; border-radius:8px; font-size:14px; outline:none; transition:border-color .2s; color:#0f172a; }
    input:focus, select:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,.08); }
    .form-footer { display:flex; align-items:center; gap:12px; justify-content:flex-end; margin-top:8px; }
    .error-msg   { color:#ef4444; font-size:13px; flex:1; }
    .success-msg { color:#10b981; font-size:13px; flex:1; }
    .btn-primary   { padding:9px 20px; background:#6366f1; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px; font-weight:600; }
    .btn-primary:hover { opacity:.9; } .btn-primary:disabled { opacity:.5; cursor:not-allowed; }
    .btn-secondary { padding:9px 20px; background:white; color:#374151; border:1px solid #e5e7eb; border-radius:8px; cursor:pointer; font-size:14px; font-weight:500; }
    .btn-secondary:hover { background:#f9fafb; }
    .btn-danger    { padding:9px 20px; background:#ef4444; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px; font-weight:600; }
    .btn-danger:hover { opacity:.9; } .btn-danger:disabled { opacity:.5; cursor:not-allowed; }
    .btn-test { padding:8px 16px; background:#f0fdf4; color:#16a34a; border:1.5px solid #bbf7d0; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; }
    .btn-test:hover { background:#dcfce7; } .btn-test:disabled { opacity:.5; cursor:not-allowed; }
    .users-table { display:flex; flex-direction:column; gap:2px; }
    .user-row { display:grid; grid-template-columns:2fr 80px 140px 80px 150px; align-items:center; gap:16px; padding:10px 12px; border-radius:8px; }
    .header-row { font-size:11px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:.5px; border-bottom:1px solid #f3f4f6; margin-bottom:4px; }
    .user-row:not(.header-row):hover { background:#f9fafb; }
    .user-info { display:flex; align-items:center; gap:10px; }
    .avatar { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; color:white; flex-shrink:0; }
    .user-name { font-size:14px; font-weight:600; color:#111827; }
    .user-sub  { font-size:12px; color:#6b7280; }
    .role-badge { font-size:11px; font-weight:600; padding:3px 8px; border-radius:4px; text-transform:uppercase; }
    .role-admin { background:#ede9fe; color:#7c3aed; }
    .role-user  { background:#dbeafe; color:#1d4ed8; }
    .last-login { font-size:12px; color:#6b7280; }
    .status-badge { font-size:11px; font-weight:600; padding:3px 8px; border-radius:4px; }
    .status-badge.active   { background:#d1fae5; color:#065f46; }
    .status-badge.inactive { background:#fee2e2; color:#991b1b; }
    .actions { display:flex; gap:6px; }
    .btn-sm   { padding:4px 10px; border-radius:6px; font-size:12px; font-weight:500; cursor:pointer; border:none; }
    .btn-reset  { background:#fef3c7; color:#92400e; } .btn-reset:hover { background:#fde68a; }
    .btn-delete { background:#fee2e2; color:#991b1b; } .btn-delete:hover:not(:disabled) { background:#fecaca; }
    .btn-delete:disabled { opacity:.35; cursor:not-allowed; }
    .feature-row { display:flex; align-items:flex-start; justify-content:space-between; gap:24px; padding:18px 0; border-bottom:1px solid #f3f4f6; }
    .feature-info { flex:1; }
    .feature-name { display:flex; align-items:center; gap:8px; font-size:15px; font-weight:700; color:#111827; margin-bottom:5px; }
    .feature-icon { font-size:18px; }
    .feature-desc { font-size:13px; color:#6b7280; line-height:1.5; max-width:400px; }
    .feature-footer { margin-top:16px; min-height:20px; }
    .toggle-wrap { display:flex; flex-direction:column; align-items:center; gap:5px; flex-shrink:0; }
    .toggle { width:48px; height:26px; border-radius:13px; background:#e5e7eb; border:none; cursor:pointer; position:relative; transition:background .2s; padding:0; }
    .toggle.on { background:#22c55e; }
    .toggle:disabled { opacity:.5; cursor:not-allowed; }
    .toggle-knob { position:absolute; top:3px; left:3px; width:20px; height:20px; border-radius:50%; background:white; box-shadow:0 1px 3px rgba(0,0,0,.2); transition:left .2s; }
    .toggle.on .toggle-knob { left:25px; }
    .toggle-lbl { font-size:11px; font-weight:600; color:#9ca3af; }
    .toggle-lbl.on { color:#16a34a; }
    .dialog-overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); display:flex; align-items:center; justify-content:center; z-index:1000; backdrop-filter:blur(2px); }
    .dialog { background:white; border-radius:16px; padding:32px; max-width:400px; width:90%; box-shadow:0 20px 60px rgba(0,0,0,.2); text-align:center; }
    .dialog-icon  { font-size:40px; margin-bottom:12px; }
    .dialog-title { font-size:18px; font-weight:700; color:#111827; margin:0 0 8px; }
    .dialog-msg   { font-size:14px; color:#6b7280; margin:0 0 24px; line-height:1.5; }
    .dialog-actions { display:flex; gap:10px; justify-content:center; }
    @media (max-width:768px) { .form-grid { grid-template-columns:1fr; } .user-row { grid-template-columns:1fr; } .header-row { display:none; } .feature-row { flex-direction:column; } }
  `]
})
export class SettingsComponent implements OnInit {
  tab = 'users';

  // Users
  users: User[] = [];
  loadingUsers = false;
  newUser = { full_name: '', username: '', password: '', role: 'user' };
  creating = false; createError = ''; createSuccess = '';
  resetTarget: User | null = null;
  resetPassword = ''; resetting = false; resetError = ''; resetSuccess = '';
  deleteTarget: User | null = null; deleting = false;

  // Password
  pwForm = { current: '', new_password: '', confirm: '' };
  changingPw = false; pwError = ''; pwSuccess = '';

  // Feature flags
  agencyMode      = false;
  legalMode       = false;
  medicalMode     = false;
  financeMode     = false;
  realEstateMode  = false;
  hrMode          = false;
  supplyChainMode = false;
  immigrationMode = false;
  complianceMode  = false;
  operationsMode  = false;
  savingFlags = false;
  flagSuccess = '';
  flagError   = '';

  // Agency settings
  agency: any = {
    agency_name:             '',
    agency_email:            '',
    agent_name:              '',
    agent_phone:             '',
    agent_license:           '',
    agency_address:          '',
    agency_website:          '',
    smtp_host:               '',
    smtp_port:               '',
    smtp_user:               '',
    smtp_pass:               '',
    smtp_from_name:          '',
    renewal_notify_enabled:  'true',
    renewal_notify_days:     '90,30,14,7',
    calendar_sync_enabled:   'false',
    medical_notify_enabled:  'true',
    medical_notify_days:     '30,14,7',
    medical_pii_masking:     'true',
    finance_notify_enabled:  'true',
    finance_notify_days:     '15,5,1',
    finance_tolerance_pct:   '5',
    legal_notify_enabled:    'true',
    legal_notify_days:       '90,30,14',
    legal_default_law:       'Delaware',
    real_estate_notify_enabled: 'true',
    real_estate_notify_days: '30,15,5',
    real_estate_buffer:      '10',
    hr_notify_enabled:       'true',
    hr_notify_days:          '7,3,1',
    hr_review_freq:          'annual',
    supply_chain_notify_enabled: 'true',
    supply_chain_notify_days: '14,7,2',
    supply_chain_delay_threshold: '24',
  };
  agencyLoaded  = false;
  agencySaving  = false;
  testingEmail  = false;
  agencyMsg     = '';

  tokens: any[] = [];
  tokenForm: { name: string; scope: string; expires_days: number | null } = { name: '', scope: 'read', expires_days: 90 };
  tokenBusy = false;
  tokenError = '';
  newToken = '';
  tokenCopied = false;

  selectedLang = 'en';
  langSuccess = false;
  langError = '';

  private readonly api = 'http://localhost:7979';

  constructor(
    private http:  HttpClient,
    public  cdr:   ChangeDetectorRef,
    public  auth:  AuthService,
    private flags: FeatureFlagService,
    public  languageService: LanguageService,
  ) {}

  ngOnInit() {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab === 'tokens') { this.tab = 'tokens' as any; this.loadTokens(); }
    if (this.auth.isAdmin()) {
      this.loadUsers();
      this.loadFlags();
      this.selectedLang = this.languageService.currentLang();
    }
  }

  saveLanguage(): void {
    this.languageService.currentLang.set(this.selectedLang);
    this.langSuccess = true;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.langSuccess = false;
      this.cdr.markForCheck();
    }, 3000);
  }

  // ── API tokens ────────────────────────────────────────────────────────────

  loadTokens(): void {
    this.http.get<{ tokens: any[] }>(`${this.api}/api/auth/tokens`).subscribe({
      next: r => { this.tokens = r.tokens || []; this.cdr.markForCheck(); },
      error: () => {}
    });
  }

  createToken(): void {
    this.tokenError = '';
    if (!this.tokenForm.name.trim()) { this.tokenError = 'Give the token a name'; this.cdr.markForCheck(); return; }
    this.tokenBusy = true;
    this.http.post<any>(`${this.api}/api/auth/tokens`, this.tokenForm).subscribe({
      next: r => {
        this.newToken = r.token; this.tokenCopied = false; this.tokenBusy = false;
        this.tokenForm = { name: '', scope: 'read', expires_days: 90 };
        this.loadTokens();
      },
      error: e => { this.tokenError = e?.error?.detail || 'Could not create the token'; this.tokenBusy = false; this.cdr.markForCheck(); }
    });
  }

  copyToken(): void {
    navigator.clipboard.writeText(this.newToken).then(() => { this.tokenCopied = true; this.cdr.markForCheck(); });
  }

  revokeToken(t: any): void {
    if (!confirm(`Revoke "${t.name}"? Anything using it will stop working.`)) return;
    this.http.post(`${this.api}/api/auth/tokens/${t.id}/revoke`, {}).subscribe({ next: () => this.loadTokens() });
  }

  // ── Agency settings ───────────────────────────────────────────────────────

  loadAgencySettings(): void {
    if (this.agencyLoaded) return;
    this.http.get<any>(`${this.api}/api/agency/settings`).subscribe({
      next: r => {
        // Only overwrite defaults if DB has a real value
        Object.keys(r).forEach(k => {
          if (r[k] !== null && r[k] !== undefined && r[k] !== '') {
            this.agency[k] = r[k];
          }
        });
        this.agencyLoaded = true;
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  saveAgencySettings(): void {
    this.agencySaving = true;
    this.agencyMsg    = '';
    const payload = { ...this.agency };
        delete payload['smtp_pass_set'];
        this.http.put(`${this.api}/api/agency/settings`, { settings: payload }).subscribe({
      next: () => {
        this.agencySaving = false;
        this.agencyMsg    = '✅ Settings saved';
        this.cdr.markForCheck();
        setTimeout(() => { this.agencyMsg = ''; this.cdr.markForCheck(); }, 3000);
      },
      error: () => {
        this.agencySaving = false;
        this.agencyMsg    = '❌ Save failed';
        this.cdr.markForCheck();
      }
    });
  }

  testEmail(): void {
    this.testingEmail = true;
    this.agencyMsg    = '';
    // Save first so backend uses latest values
    const payload = { ...this.agency };
        delete payload['smtp_pass_set'];
        this.http.put(`${this.api}/api/agency/settings`, { settings: payload }).subscribe({
      next: () => {
        this.http.post<any>(`${this.api}/api/agency/settings/test-email`, {}).subscribe({
          next: r => {
            this.testingEmail = false;
            this.agencyMsg    = '✅ ' + r.message;
            this.cdr.markForCheck();
          },
          error: err => {
            this.testingEmail = false;
            this.agencyMsg    = '❌ ' + (err.error?.detail || 'Failed to send');
            this.cdr.markForCheck();
          }
        });
      },
      error: () => {
        this.testingEmail = false;
        this.agencyMsg    = '❌ Save failed before test';
        this.cdr.markForCheck();
      }
    });
  }

  // ── Feature flags ─────────────────────────────────────────────────────────

  loadFlags() {
    this.http.get<{ flags: any }>(`${this.api}/api/features`).subscribe({
      next: res => {
        this.agencyMode      = res.flags?.agency_mode ?? false;
        this.legalMode       = res.flags?.legal_mode ?? false;
        this.medicalMode     = res.flags?.medical_mode ?? false;
        this.financeMode     = res.flags?.finance_mode ?? false;
        this.realEstateMode  = res.flags?.real_estate_mode ?? false;
        this.hrMode          = res.flags?.hr_mode ?? false;
        this.supplyChainMode = res.flags?.supply_chain_mode ?? false;
        this.immigrationMode = res.flags?.immigration_mode ?? res.flags?.hr_mode ?? false;
        this.complianceMode  = res.flags?.compliance_mode ?? false;
        this.operationsMode  = res.flags?.operations_mode ?? false;
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  toggleFlag(flag: 'agencyMode' | 'immigrationMode' | 'legalMode' | 'medicalMode' | 'financeMode' | 'realEstateMode' | 'hrMode' | 'supplyChainMode' | 'complianceMode' | 'operationsMode') {
    const prevValue = this[flag];
    this[flag] = !prevValue;
    this.savingFlags = true;
    this.flagSuccess = ''; this.flagError = '';
    this.cdr.markForCheck();

    const payload = {
      agency_mode: this.agencyMode,
      immigration_mode: this.immigrationMode,
      legal_mode: this.legalMode,
      medical_mode: this.medicalMode,
      finance_mode: this.financeMode,
      real_estate_mode: this.realEstateMode,
      hr_mode: this.hrMode,
      supply_chain_mode: this.supplyChainMode,
      compliance_mode: this.complianceMode,
      operations_mode: this.operationsMode,
    };

    this.http.patch<{ flags: any }>(`${this.api}/api/features`, payload).subscribe({
      next: res => {
        this.agencyMode      = res.flags.agency_mode;
        this.immigrationMode = res.flags.immigration_mode ?? res.flags.hr_mode;
        this.legalMode       = res.flags.legal_mode;
        this.medicalMode     = res.flags.medical_mode;
        this.financeMode     = res.flags.finance_mode;
        this.realEstateMode  = res.flags.real_estate_mode;
        this.hrMode          = res.flags.hr_mode;
        this.supplyChainMode = res.flags.supply_chain_mode;
        this.complianceMode  = res.flags.compliance_mode;
        this.operationsMode  = res.flags.operations_mode;
        this.savingFlags = false;
        this.flagSuccess = 'Feature flags updated successfully';
        this.flags.load();
        this.cdr.markForCheck();
        setTimeout(() => { this.flagSuccess = ''; this.cdr.markForCheck(); }, 3000);
      },
      error: () => {
        this[flag] = prevValue;
        this.savingFlags = false;
        this.flagError   = 'Failed to save';
        this.cdr.markForCheck();
      }
    });
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  loadUsers() {
    this.loadingUsers = true; this.cdr.markForCheck();
    this.http.get<{ users: User[] }>(`${this.api}/api/auth/users`).subscribe({
      next: res => { this.users = res.users; this.loadingUsers = false; this.cdr.markForCheck(); },
      error: ()  => { this.loadingUsers = false; this.cdr.markForCheck(); }
    });
  }

  createUser() {
    this.createError = ''; this.createSuccess = '';
    if (!this.newUser.full_name || !this.newUser.username || !this.newUser.password) {
      this.createError = 'All fields are required'; this.cdr.markForCheck(); return;
    }
    if (this.newUser.password.length < 8) {
      this.createError = 'Password must be at least 8 characters'; this.cdr.markForCheck(); return;
    }
    this.creating = true; this.cdr.markForCheck();
    this.http.post(`${this.api}/api/auth/register`, this.newUser).subscribe({
      next: (res: any) => {
        this.createSuccess = res.message || 'User created';
        this.newUser = { full_name: '', username: '', password: '', role: 'user' };
        this.creating = false; this.loadUsers(); this.cdr.markForCheck();
      },
      error: (err) => {
        this.createError = err.error?.detail || 'Failed to create user';
        this.creating = false; this.cdr.markForCheck();
      }
    });
  }

  confirmDelete(user: User) { this.deleteTarget = user; this.cdr.markForCheck(); }

  deleteUser() {
    if (!this.deleteTarget) return;
    this.deleting = true; this.cdr.markForCheck();
    this.http.delete(`${this.api}/api/auth/users/${this.deleteTarget.id}`).subscribe({
      next: () => {
        this.users = this.users.filter(u => u.id !== this.deleteTarget!.id);
        this.deleteTarget = null; this.deleting = false; this.cdr.markForCheck();
      },
      error: () => { this.deleteTarget = null; this.deleting = false; this.cdr.markForCheck(); }
    });
  }

  startReset(user: User) {
    this.resetTarget = user; this.resetPassword = '';
    this.resetError = ''; this.resetSuccess = ''; this.cdr.markForCheck();
  }

  resetUserPassword() {
    if (!this.resetPassword || this.resetPassword.length < 8) {
      this.resetError = 'Password must be at least 8 characters'; this.cdr.markForCheck(); return;
    }
    this.resetting = true; this.cdr.markForCheck();
    this.http.post(`${this.api}/api/auth/reset-password`, {
      username: this.resetTarget!.username, new_password: this.resetPassword
    }).subscribe({
      next: () => {
        this.resetSuccess = 'Password reset successfully';
        this.resetPassword = ''; this.resetting = false;
        setTimeout(() => { this.resetTarget = null; this.cdr.markForCheck(); }, 2000);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.resetError = err.error?.detail || 'Failed';
        this.resetting = false; this.cdr.markForCheck();
      }
    });
  }

  // ── Password ──────────────────────────────────────────────────────────────

  changePassword() {
    this.pwError = ''; this.pwSuccess = '';
    if (!this.pwForm.current || !this.pwForm.new_password || !this.pwForm.confirm) {
      this.pwError = 'All fields are required'; this.cdr.markForCheck(); return;
    }
    if (this.pwForm.new_password !== this.pwForm.confirm) {
      this.pwError = 'Passwords do not match'; this.cdr.markForCheck(); return;
    }
    if (this.pwForm.new_password.length < 8) {
      this.pwError = 'Password must be at least 8 characters'; this.cdr.markForCheck(); return;
    }
    this.changingPw = true; this.cdr.markForCheck();
    this.http.post(`${this.api}/api/auth/change-password`, {
      current_password: this.pwForm.current, new_password: this.pwForm.new_password
    }).subscribe({
      next: () => {
        this.pwSuccess = 'Password updated';
        this.pwForm = { current: '', new_password: '', confirm: '' };
        this.changingPw = false; this.cdr.markForCheck();
      },
      error: (err) => {
        this.pwError = err.error?.detail || 'Failed';
        this.changingPw = false; this.cdr.markForCheck();
      }
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  initials(name: string): string {
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }

  formatDate(iso: string): string {
    try { return new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }); }
    catch { return iso; }
  }
}