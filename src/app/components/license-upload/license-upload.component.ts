import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpClientModule } from '@angular/common/http';

interface LicenseStatus {
  is_valid: boolean;
  is_active: boolean;
  issued_to?: string;
  email?: string;
  plan?: string;
  issued_at?: string;
  expiry?: string;
  error?: string;
}

@Component({
  selector: 'app-license-upload',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    HttpClientModule
  ],
  templateUrl: './license-upload.component.html',
  styleUrls: ['./license-upload.component.scss']
})
export class LicenseUploadComponent implements OnInit {
  isDragging = false;
  isUploading = false;
  isActivated = false;
  licenseStatus: LicenseStatus | null = null;
  selectedFile: File | null = null;
  activatedLicense: any = null;

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private router: Router
  ) {}

  ngOnInit() {
    this.checkLicenseStatus();
  }

  // Validates .udv.json files including OS-duplicated copies:
  // license.udv.json        ✅
  // license.udv.json (1)    ✅
  // license.udv.json (2)    ✅
  // license.udv.json(1)     ✅
  // license.txt             ❌
  // license.udv.json.exe    ❌
  private isValidLicenseFile(fileName: string): boolean {
    return /\.udv\.json(\s*\(\d+\))?$/i.test(fileName);
  }

  checkLicenseStatus() {
    this.http.get<LicenseStatus>('http://localhost:8000/api/license/status')
      .subscribe({
        next: (status) => {
          this.licenseStatus = status;
          if (status.is_valid && status.is_active) {
            this.router.navigate(['/documents']);
          }
        },
        error: (err) => {
          console.error('Failed to check license status:', err);
        }
      });
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  handleFile(file: File) {
    if (!this.isValidLicenseFile(file.name)) {
      this.snackBar.open('Please select a valid .udv.json license file', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar']
      });
      return;
    }
    this.selectedFile = file;
    this.uploadLicense();
  }

  triggerFileInput() {
    const electronAPI = (window as any).electronAPI;

    // Electron: use native OS file dialog (HTML input click is blocked in Electron)
    if (electronAPI?.openFileDialog) {
      electronAPI.openFileDialog().then((result: any) => {
        if (!result) return; // user cancelled

        const fileName = result.filePath.split(/[\\/]/).pop() || '';
        if (!this.isValidLicenseFile(fileName)) {
          this.snackBar.open('Please select a valid .udv.json license file', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
          return;
        }

        try {
          const json = JSON.parse(result.content);
          this.submitLicense(json);
        } catch (e) {
          this.snackBar.open('❌ Invalid license file format', 'Close', { duration: 7000 });
        }
      }).catch((err: any) => {
        console.error('File dialog error:', err);
        this.snackBar.open('❌ Could not open file dialog', 'Close', { duration: 5000 });
      });
      return;
    }

    // Browser fallback
    document.getElementById('fileInput')?.click();
  }

  uploadLicense() {
    if (!this.selectedFile) return;

    this.isUploading = true;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string);
        this.submitLicense(json);
      } catch (e) {
        this.snackBar.open('❌ Invalid license file format', 'Close', { duration: 7000 });
        this.isUploading = false;
      }
    };
    reader.readAsText(this.selectedFile);
  }

  // Single method handles the actual HTTP call — used by both drag-drop and native dialog
  private submitLicense(json: any) {
    this.isUploading = true;

    this.http.post('http://localhost:8000/api/license/upload', json)
      .subscribe({
        next: (response: any) => {
          this.isUploading = false;
          this.isActivated = true;
          this.activatedLicense = response;
          this.snackBar.open(`✅ ${response.message}`, 'Close', {
            duration: 5000,
            panelClass: ['success-snackbar']
          });
          setTimeout(() => this.router.navigate(['/documents']), 3000);
        },
        error: (err) => {
          this.isUploading = false;
          this.selectedFile = null;
          this.snackBar.open(
            `❌ ${err.error?.detail || 'Failed to upload license'}`,
            'Close',
            { duration: 7000, panelClass: ['error-snackbar'] }
          );
        }
      });
  }
}