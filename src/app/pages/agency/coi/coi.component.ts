import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../../services/toast.service';
import { RouterModule, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-coi',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './coi.component.html',
  styleUrls: ['./coi.component.scss']
})
export class CoiComponent implements OnInit {
  private api = 'http://localhost:8000';
  clients: any[] = [];
  certificates: any[] = [];
  expiring: any[] = [];
  selectedCert: any = null;
  loading = false;
  generating = false;
  activeTab: 'generate' | 'certificates' | 'expiring' = 'certificates';

  form = {
    client_id: '',
    holder_name: '',
    holder_address: '',
    holder_email: '',
    purpose: '',
    additional_insured: '',
    requested_by: 'agent',
  };

  constructor(private http: HttpClient, public toast: ToastService,   
    private route: ActivatedRoute) {}

    ngOnInit() {
      this.loadClients();
      this.loadExpiring();
      // Auto-select client + open generate tab from query param (from card button)
      this.route.queryParams.subscribe(params => {
        if (params['client']) {
          this.form.client_id = params['client'];
          this.activeTab = params['tab'] === 'generate' ? 'generate' : 'certificates';
          // Load certs for this client
          this.loadClientCerts(params['client']);
        }
      });
    }

  loadClients() {
    this.http.get<any>(`${this.api}/api/ams/clients?limit=100`).subscribe({
      next: r => this.clients = r.clients || [],
    });
  }

  loadExpiring() {
    this.http.get<any>(`${this.api}/api/ams/coi/expiring/soon?days=30`).subscribe({
      next: r => this.expiring = r.expiring_certificates || [],
    });
  }

  loadClientCerts(clientId: string) {
    if (!clientId) return;
    this.loading = true;
    this.http.get<any>(`${this.api}/api/ams/coi/client/${clientId}`).subscribe({
      next: r => { this.certificates = r.certificates || []; this.loading = false; },
      error: () => this.loading = false,
    });
  }

  generate() {
    if (!this.form.client_id || !this.form.holder_name) {
      this.toast.show('Client and certificate holder are required', 'error'); return;
    }
    this.generating = true;
    this.http.post<any>(`${this.api}/api/ams/coi/request`, this.form).subscribe({
      next: r => {
        this.toast.show(`Certificate ${r.certificate_number} generated!`, 'success');
        this.generating = false;
        this.selectedCert = r;
        this.activeTab = 'certificates';
        this.loadClientCerts(this.form.client_id);
        this.loadExpiring();
        this.form.holder_name = '';
        this.form.holder_address = '';
        this.form.holder_email = '';
        this.form.purpose = '';
      },
      error: () => { this.toast.show('Generation failed', 'error'); this.generating = false; }
    });
  }

  viewCert(certId: string) {
    this.http.get<any>(`${this.api}/api/ams/coi/${certId}`).subscribe({
      next: r => this.selectedCert = r,
    });
  }

  printCert() {
    window.print();
  }
}