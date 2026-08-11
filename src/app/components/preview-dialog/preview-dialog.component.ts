import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService } from '../../services/api.service';

export interface DocumentPreview {
  id: string;
  filename: string;
  doc_type: string;
  file_size: number;
  created_at: string;
  preview_type: string;
  content?: any;
  download_url?: string;
  message?: string;
}

@Component({
  selector: 'app-preview-dialog',
  standalone: true,  // ✅ Add this
  imports: [         // ✅ Add this entire imports array
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTabsModule,
    MatTooltipModule
  ],
  templateUrl: './preview-dialog.component.html',
  styleUrls: ['./preview-dialog.component.scss']
})
export class PreviewDialogComponent implements OnInit {
  preview: DocumentPreview | null = null;
  loading = true;
  error = '';
  
  safeUrl: SafeResourceUrl | null = null;
  textContent = '';
  spreadsheetHeaders: string[] = [];
  spreadsheetData: any[] = [];

  constructor(
    public dialogRef: MatDialogRef<PreviewDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { docId: string },
    private apiService: ApiService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    console.log('🚀 Preview Dialog Initialized with docId:', this.data.docId);
    this.loadPreview();
  }

  loadPreview() {
    this.loading = true;
    this.error = '';

    console.log('🔍 Loading preview for:', this.data.docId);

    this.apiService.getDocumentPreview(this.data.docId).subscribe({
      next: (preview) => {
        console.log('✅ Preview loaded:', preview);
        console.log('📋 Preview type:', preview.preview_type);
        
        this.preview = preview;
        this.preparePreview(preview);
        this.loading = false;
      },
      error: (err) => {
        console.error('❌ Preview error:', err);
        console.error('Status:', err.status);
        console.error('Message:', err.message);
        console.error('Error object:', err.error);
        
        this.error = err.error?.detail || err.statusText || err.message || 'Failed to load preview';
        this.loading = false;
      }
    });
  }

  // preview-dialog.component.ts

preparePreview(preview: DocumentPreview) {
    console.log('🎨 Preparing preview for type:', preview.preview_type);
  
    switch (preview.preview_type) {
      case 'pdf':
      case 'image':
        // Use /preview endpoint for inline display
        const previewUrl = this.apiService.getPreviewUrl(preview.id);
        console.log('🔗 Preview URL:', previewUrl);
        this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(previewUrl);
        console.log('✅ SafeUrl created');
        break;
  
      case 'spreadsheet':
        console.log('📊 Processing spreadsheet data');
        if (preview.content && preview.content.headers && preview.content.data) {
          this.spreadsheetHeaders = preview.content.headers;
          this.spreadsheetData = preview.content.data.map((row: any[]) => {
            const obj: any = {};
            preview.content.headers.forEach((header: string, index: number) => {
              obj[header] = row[index];
            });
            return obj;
          });
          console.log('✅ Spreadsheet prepared:', this.spreadsheetData.length, 'rows');
        } else {
          console.warn('⚠️ No spreadsheet data found');
        }
        break;
  
      case 'text':
      case 'document':
        this.textContent = preview.content || '';
        console.log('📝 Text content loaded:', this.textContent.length, 'chars');
        break;
  
      default:
        console.log('ℹ️ Preview type:', preview.preview_type);
    }
  }

  getFileIcon(preview: DocumentPreview): string {
    const ext = preview.filename.split('.').pop()?.toLowerCase();
    
    const iconMap: { [key: string]: string } = {
      'pdf': 'picture_as_pdf',
      'doc': 'description',
      'docx': 'description',
      'xls': 'table_chart',
      'xlsx': 'table_chart',
      'csv': 'table_chart',
      'txt': 'text_snippet',
      'jpg': 'image',
      'jpeg': 'image',
      'png': 'image',
      'gif': 'image',
      'webp': 'image'
    };

    return iconMap[ext || ''] || 'insert_drive_file';
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

  download() {
    if (!this.preview) return;
    
    const downloadUrl = this.apiService.getDownloadUrl(this.preview.id);
    console.log('⬇️ Downloading from:', downloadUrl);
    
    window.open(downloadUrl, '_blank');
  }

  close() {
    this.dialogRef.close();
  }
}