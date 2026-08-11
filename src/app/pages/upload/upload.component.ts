import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { Router } from '@angular/router';

interface UploadFile { name:string; pct:number; state:'uploading'|'done'|'error'; status:string; file:File; }

const ALLOWED = new Set([
  // Documents
  'pdf','doc','docx','odt','rtf','txt','md','html','htm',
  // Spreadsheets
  'xlsx','xls','xlsm','csv','tsv','ods','parquet','json','jsonl',
  // Presentations
  'pptx','ppt','odp',
  // Images
  'jpg','jpeg','png','gif','bmp','tiff','tif','webp','heic','heif',
  // Emails
  'eml','msg','mbox',
  // Machine formats
  'xml','yaml','yml',
]);

const TYPE_GROUPS = [
  { label:'Documents',  types:['PDF','DOCX','DOC','TXT','MD','RTF','ODT','HTML'] },
  { label:'Sheets',     types:['XLSX','CSV','TSV','JSON','PARQUET','ODS'] },
  { label:'Slides',     types:['PPTX','PPT','ODP'] },
  { label:'Images',     types:['JPG','PNG','GIF','WEBP','TIFF','HEIC'] },
  { label:'Email',      types:['EML','MSG','MBOX'] },
  { label:'Data',       types:['XML','YAML','YML','JSONL'] },
];

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.scss']
})
export class UploadComponent implements OnInit {
  dragging = false;
  private _dragDepth = 0;
  uploads: UploadFile[] = [];
  groups = TYPE_GROUPS;

  clients: { id: string; name: string }[] = [];
  selectedClientId = '';

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private router: Router,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.http.get<any>('http://localhost:8000/api/ams/clients?limit=200').subscribe({
      next: r => this.clients = (r.clients || r.data || r || []).map((c: any) => ({ id: c.id, name: c.name || c.full_name || c.id })),
      error: () => {}
    });
  }

  onDragEnter(e: DragEvent): void {
    e.preventDefault();
    this._dragDepth++;
    this.dragging = true;
  }

  onDragLeave(e: DragEvent): void {
    e.preventDefault();
    this._dragDepth--;
    if (this._dragDepth === 0) this.dragging = false;
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this._dragDepth = 0;
    this.dragging = false;
    if (e.dataTransfer?.files) this.handleFiles(e.dataTransfer.files);
  }
  onFiles(e: Event): void {
    const f = (e.target as HTMLInputElement).files;
    if (f) this.handleFiles(f);
    (e.target as HTMLInputElement).value = '';
  }

  readonly MAX_BATCH = 10;

  handleFiles(files: FileList): void {
    const incoming = Array.from(files);

    if (incoming.length > this.MAX_BATCH) {
      this.toast.error(`You can select up to ${this.MAX_BATCH} files at once. ${incoming.length - this.MAX_BATCH} file${incoming.length - this.MAX_BATCH === 1 ? '' : 's'} skipped.`);
    }

    incoming.slice(0, this.MAX_BATCH).forEach(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      if (!ALLOWED.has(ext)) {
        this.toast.error(`.${ext} files are not supported`);
        return;
      }
      const item: UploadFile = { name:f.name, pct:0, state:'uploading', status:'Uploading…', file:f };
      this.uploads.push(item);
      this.uploadReal(item);
    });
  }

  uploadReal(item: UploadFile): void {
    let fake = 0;
    const iv = setInterval(() => {
      if (fake < 85) { fake += Math.random()*8+2; item.pct = Math.min(Math.round(fake), 85); }
      if (item.pct < 40)      item.status = 'Uploading…';
      else if (item.pct < 70) item.status = 'Extracting text…';
      else                    item.status = 'Running phi3:mini…';
    }, 120);

    this.api.uploadDocument(item.file, this.selectedClientId || undefined).subscribe({
      next: () => {
        clearInterval(iv);
        item.pct = 90; item.status = 'Finalizing…';
        setTimeout(() => { item.pct=100; item.state='done'; item.status='Upload Successful!'; this.toast.success(`"${item.name}" analyzed`); }, 900);
      },
      error: (err) => {
        clearInterval(iv);
        item.state = 'error';
        item.status = err?.error?.detail || 'Upload failed. Try again.';
        item.pct = Math.max(item.pct, 20);
        this.toast.error(`Failed: ${item.name}`);
      }
    });
  }

  remove(item: UploadFile): void { this.uploads = this.uploads.filter(u => u !== item); }

  // Add this getter
  get allDone(): boolean {
    return this.uploads.length > 0 && 
          this.uploads.every(u => u.state === 'done');
  }

  /** Navigate to Documents page */
  continueToDocuments(): void {
    this.router.navigate(['/documents']);   // Adjust route if needed
  }

}