// src/app/pages/code-scanner/code-scanner.component.ts
import {
  Component, OnInit, OnDestroy, ViewChild,
  ElementRef, ChangeDetectorRef, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

interface ScanResult {
  id: string;
  value: string;
  format: string;
  type: 'url' | 'text' | 'email' | 'phone' | 'wifi' | 'other';
  scannedAt: Date;
  copied?: boolean;
}

@Component({
  selector: 'app-code-scanner',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="cs-page">

      <!-- Header -->
      <div class="cs-header">
        <div class="cs-header-left">
          <a class="cs-back" routerLink="/integrations">← Integrations</a>
          <h1 class="cs-title">Code Scanner</h1>
          <p class="cs-sub">Scan QR codes and barcodes directly from your camera or upload an image.</p>
        </div>
        <div class="cs-header-badges">
          <span class="cs-badge cs-badge--qr">📷 QR Code</span>
          <span class="cs-badge cs-badge--bar">||||  Barcode</span>
          <span class="cs-badge cs-badge--live" *ngIf="streaming">● Live</span>
        </div>
      </div>

      <div class="cs-body">

        <!-- Left: Camera / Upload -->
        <div class="cs-left">

          <!-- Camera viewfinder -->
          <div class="cs-viewfinder" [class.cs-viewfinder--active]="streaming">

            <video #videoEl autoplay playsinline muted
                   [class.cs-hidden]="!streaming"></video>
            <canvas #canvasEl class="cs-canvas"></canvas>

            <!-- Overlay scanner frame -->
            <div class="cs-frame" *ngIf="streaming">
              <div class="cs-frame-corner cs-frame-corner--tl"></div>
              <div class="cs-frame-corner cs-frame-corner--tr"></div>
              <div class="cs-frame-corner cs-frame-corner--bl"></div>
              <div class="cs-frame-corner cs-frame-corner--br"></div>
              <div class="cs-scan-line" [class.cs-scan-line--anim]="streaming"></div>
            </div>

            <!-- Flash on detect -->
            <div class="cs-flash" *ngIf="flashVisible"></div>

            <!-- Placeholder when camera off -->
            <div class="cs-placeholder" *ngIf="!streaming">
              <div class="cs-placeholder-icon">📷</div>
              <div class="cs-placeholder-text">Camera inactive</div>
              <div class="cs-placeholder-sub">Click Start Camera to begin scanning</div>
            </div>

            <!-- Last detected overlay -->
            <div class="cs-detected-banner" *ngIf="lastResult && streaming">
              ✓ {{ lastResult.value | slice:0:40 }}{{ lastResult.value.length > 40 ? '…' : '' }}
            </div>
          </div>

          <!-- Camera controls -->
          <div class="cs-controls">
            <button class="cs-btn cs-btn--start" (click)="startCamera()" *ngIf="!streaming" [disabled]="starting">
              <span>{{ starting ? '⏳' : '▶' }}</span>
              {{ starting ? 'Starting…' : 'Start Camera' }}
            </button>
            <button class="cs-btn cs-btn--stop" (click)="stopCamera()" *ngIf="streaming">
              <span>⏹</span> Stop
            </button>
            <button class="cs-btn cs-btn--cam" (click)="flipCamera()" *ngIf="streaming && hasMultipleCameras" title="Flip camera">
              🔄
            </button>
            <button class="cs-btn cs-btn--upload" (click)="fileInput.click()">
              <span>📁</span> Upload Image
            </button>
            <button class="cs-btn cs-btn--torch" (click)="toggleTorch()" *ngIf="streaming && hasTorch" title="Toggle flashlight">
              {{ torchOn ? '🔦' : '💡' }}
            </button>
          </div>

          <input #fileInput type="file" accept="image/*" class="cs-hidden" (change)="onFileSelected($event)">

          <!-- Error -->
          <div class="cs-error" *ngIf="errorMsg">⚠ {{ errorMsg }}</div>

          <!-- Camera not supported fallback -->
          <div class="cs-info-box" *ngIf="!apiSupported">
            <strong>BarcodeDetector not supported</strong> in this browser.<br>
            Chrome / Edge 88+ on desktop or Android is required.<br>
            You can still scan by uploading an image file.
          </div>

          <!-- Supported formats -->
          <div class="cs-formats">
            <div class="cs-formats-label">Supported formats</div>
            <div class="cs-format-tags">
              <span *ngFor="let f of supportedFormats" class="cs-format-tag">{{ f }}</span>
            </div>
          </div>
        </div>

        <!-- Right: Results -->
        <div class="cs-right">
          <div class="cs-results-header">
            <span class="cs-results-title">Scan History</span>
            <button class="cs-clear-btn" (click)="clearHistory()" *ngIf="results.length > 0">Clear</button>
          </div>

          <div class="cs-empty" *ngIf="results.length === 0">
            <div class="cs-empty-icon">🔍</div>
            <div class="cs-empty-text">No scans yet</div>
            <div class="cs-empty-sub">Start the camera or upload an image to scan codes</div>
          </div>

          <div class="cs-result-list">
            <div class="cs-result-card" *ngFor="let r of results; let i = index"
                 [class.cs-result-card--url]="r.type === 'url'"
                 [class.cs-result-card--new]="i === 0">

              <div class="cs-result-top">
                <span class="cs-result-type-icon">{{ typeIcon(r.type) }}</span>
                <span class="cs-result-format">{{ r.format }}</span>
                <span class="cs-result-time">{{ r.scannedAt | date:'HH:mm:ss' }}</span>
              </div>

              <div class="cs-result-value">{{ r.value }}</div>

              <div class="cs-result-actions">
                <button class="cs-action-btn" (click)="copyResult(r)" title="Copy">
                  {{ r.copied ? '✓ Copied' : '📋 Copy' }}
                </button>
                <a class="cs-action-btn cs-action-btn--link" [href]="r.value" target="_blank"
                   *ngIf="r.type === 'url'" title="Open URL">
                  🔗 Open
                </a>
                <a class="cs-action-btn cs-action-btn--link" [href]="'mailto:' + r.value"
                   *ngIf="r.type === 'email'" title="Send email">
                  ✉ Email
                </a>
                <a class="cs-action-btn cs-action-btn--link" [href]="'tel:' + r.value"
                   *ngIf="r.type === 'phone'" title="Call">
                  📞 Call
                </a>
                <button class="cs-action-btn" (click)="removeResult(r.id)" title="Remove">
                  🗑
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; font-family: 'Poppins', system-ui, sans-serif; }
    .cs-page { padding: 28px 36px; max-width: 1100px; }
    .cs-hidden { display: none !important; }

    /* Header */
    .cs-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px; flex-wrap: wrap; gap: 12px; }
    .cs-back { font-size: 13px; color: #6366f1; text-decoration: none; font-weight: 600;
      &:hover { text-decoration: underline; } }
    .cs-title { font-size: 26px; font-weight: 800; color: #111827; margin: 4px 0 6px; letter-spacing: -0.5px; }
    .cs-sub { font-size: 13.5px; color: #6b7280; margin: 0; }
    .cs-header-badges { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .cs-badge { font-size: 11.5px; font-weight: 600; padding: 4px 12px; border-radius: 20px; }
    .cs-badge--qr  { background: #eef2ff; color: #4f46e5; border: 1px solid #c7d2fe; }
    .cs-badge--bar { background: #f0fdf4; color: #059669; border: 1px solid #a7f3d0; }
    .cs-badge--live { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }

    /* Body layout */
    .cs-body { display: grid; grid-template-columns: 480px 1fr; gap: 24px; }

    /* Viewfinder */
    .cs-left { display: flex; flex-direction: column; gap: 14px; }
    .cs-viewfinder {
      position: relative; width: 100%; aspect-ratio: 4/3;
      background: #0f172a; border-radius: 20px; overflow: hidden;
      border: 2px solid #334155;
      box-shadow: 0 8px 40px rgba(0,0,0,.3);
      transition: border-color .3s;
      &.cs-viewfinder--active { border-color: #6366f1; box-shadow: 0 8px 40px rgba(99,102,241,.25); }
    }
    video {
      width: 100%; height: 100%; object-fit: cover;
      border-radius: 18px;
    }
    .cs-canvas { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; pointer-events: none; }

    /* Scanner frame */
    .cs-frame {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      pointer-events: none;
    }
    .cs-frame-corner {
      position: absolute; width: 28px; height: 28px;
      border-color: #6366f1; border-style: solid;
    }
    .cs-frame-corner--tl { top: 20%; left: 20%; border-width: 3px 0 0 3px; border-radius: 4px 0 0 0; }
    .cs-frame-corner--tr { top: 20%; right: 20%; border-width: 3px 3px 0 0; border-radius: 0 4px 0 0; }
    .cs-frame-corner--bl { bottom: 20%; left: 20%; border-width: 0 0 3px 3px; border-radius: 0 0 0 4px; }
    .cs-frame-corner--br { bottom: 20%; right: 20%; border-width: 0 3px 3px 0; border-radius: 0 0 4px 0; }
    .cs-scan-line {
      position: absolute; left: 20%; right: 20%;
      height: 2px; background: linear-gradient(90deg, transparent, #6366f1, transparent);
      box-shadow: 0 0 8px #6366f1;
    }
    .cs-scan-line--anim {
      animation: scanLine 2s ease-in-out infinite;
    }
    @keyframes scanLine {
      0%   { top: 22%; }
      50%  { top: 76%; }
      100% { top: 22%; }
    }

    /* Flash effect */
    .cs-flash {
      position: absolute; inset: 0; background: rgba(255,255,255,.6);
      border-radius: 18px; animation: flash .25s ease-out forwards;
      pointer-events: none;
    }
    @keyframes flash { from { opacity: 1; } to { opacity: 0; } }

    /* Placeholder */
    .cs-placeholder {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 10px;
    }
    .cs-placeholder-icon { font-size: 52px; opacity: .3; }
    .cs-placeholder-text { font-size: 16px; font-weight: 600; color: #64748b; }
    .cs-placeholder-sub  { font-size: 13px; color: #475569; }

    /* Detected banner */
    .cs-detected-banner {
      position: absolute; bottom: 0; left: 0; right: 0;
      background: rgba(99,102,241,.9); backdrop-filter: blur(8px);
      color: #fff; font-size: 12.5px; font-weight: 600; padding: 10px 16px;
      text-align: center; animation: slideUp .2s ease;
    }
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

    /* Controls */
    .cs-controls { display: flex; gap: 10px; flex-wrap: wrap; }
    .cs-btn {
      display: flex; align-items: center; gap: 7px; padding: 9px 18px;
      border-radius: 10px; font-size: 13px; font-weight: 600;
      cursor: pointer; border: none; transition: all .15s;
      font-family: 'Poppins', system-ui, sans-serif;
      &:disabled { opacity: .5; cursor: not-allowed; }
    }
    .cs-btn--start  { background: #4f46e5; color: #fff; box-shadow: 0 4px 14px rgba(79,70,229,.3);
      &:hover:not(:disabled) { background: #3730a3; transform: translateY(-1px); } }
    .cs-btn--stop   { background: #fee2e2; color: #dc2626; border: 1.5px solid #fecaca;
      &:hover { background: #fecaca; } }
    .cs-btn--upload { background: #f8fafc; color: #475569; border: 1.5px solid #e2e8f0;
      &:hover { background: #f1f5f9; border-color: #6366f1; color: #4f46e5; } }
    .cs-btn--cam    { background: #f0fdf4; color: #059669; border: 1.5px solid #a7f3d0; padding: 9px 14px; }
    .cs-btn--torch  { background: #fefce8; color: #ca8a04; border: 1.5px solid #fde68a; padding: 9px 14px; }

    .cs-error { font-size: 13px; color: #dc2626; background: #fef2f2;
      border: 1px solid #fecaca; padding: 10px 14px; border-radius: 10px; }
    .cs-info-box { font-size: 12.5px; color: #374151; background: #fffbeb;
      border: 1px solid #fde68a; border-left: 3px solid #f59e0b;
      padding: 12px 14px; border-radius: 8px; line-height: 1.6; }

    /* Formats */
    .cs-formats { }
    .cs-formats-label { font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 8px; }
    .cs-format-tags { display: flex; flex-wrap: wrap; gap: 6px; }
    .cs-format-tag { font-size: 11px; background: #f1f5f9; color: #475569; padding: 3px 9px; border-radius: 20px; font-family: 'DM Mono', monospace; border: 1px solid #e2e8f0; }

    /* Results panel */
    .cs-right { display: flex; flex-direction: column; gap: 12px; }
    .cs-results-header { display: flex; align-items: center; justify-content: space-between; }
    .cs-results-title { font-size: 15px; font-weight: 700; color: #111827; }
    .cs-clear-btn { font-size: 12px; color: #6b7280; background: #f3f4f6; border: none; padding: 4px 12px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all .15s;
      &:hover { background: #fee2e2; color: #dc2626; } }

    .cs-empty { display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 60px 20px; text-align: center; }
    .cs-empty-icon { font-size: 44px; margin-bottom: 12px; opacity: .4; }
    .cs-empty-text { font-size: 15px; font-weight: 600; color: #9ca3af; margin-bottom: 6px; }
    .cs-empty-sub  { font-size: 13px; color: #cbd5e1; }

    .cs-result-list { display: flex; flex-direction: column; gap: 10px; max-height: 620px; overflow-y: auto; padding-right: 4px; }
    .cs-result-card {
      background: #fff; border: 1.5px solid #e5e7eb; border-radius: 14px;
      padding: 14px 16px; transition: all .2s;
      &:hover { border-color: #c7d2fe; box-shadow: 0 2px 12px rgba(99,102,241,.08); }
      &.cs-result-card--url  { border-left: 3px solid #6366f1; }
      &.cs-result-card--new  { animation: cardIn .3s ease; }
    }
    @keyframes cardIn { from { transform: translateY(-6px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .cs-result-top { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .cs-result-type-icon { font-size: 16px; }
    .cs-result-format { font-size: 10.5px; font-weight: 700; background: #eef2ff; color: #4f46e5;
      padding: 2px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: .3px; }
    .cs-result-time  { font-size: 11px; color: #94a3b8; margin-left: auto; font-family: 'DM Mono', monospace; }
    .cs-result-value { font-size: 13px; color: #1e293b; word-break: break-all; line-height: 1.5;
      margin-bottom: 10px; max-height: 64px; overflow: hidden; }
    .cs-result-actions { display: flex; gap: 7px; flex-wrap: wrap; }
    .cs-action-btn {
      font-size: 11.5px; font-weight: 600; padding: 4px 11px; border-radius: 7px;
      background: #f8fafc; color: #475569; border: 1px solid #e2e8f0;
      cursor: pointer; transition: all .14s; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;
      &:hover { background: #eef2ff; color: #4f46e5; border-color: #c7d2fe; }
      &.cs-action-btn--link { background: #f0fdf4; color: #059669; border-color: #a7f3d0;
        &:hover { background: #dcfce7; } }
    }

    @media (max-width: 900px) {
      .cs-body { grid-template-columns: 1fr; }
      .cs-page { padding: 16px; }
    }
  `]
})
export class CodeScannerComponent implements OnInit, OnDestroy {
  @ViewChild('videoEl')  videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasEl!: ElementRef<HTMLCanvasElement>;

  streaming         = false;
  starting          = false;
  errorMsg          = '';
  flashVisible      = false;
  lastResult: ScanResult | null = null;
  results: ScanResult[]         = [];
  apiSupported      = false;
  hasTorch          = false;
  torchOn           = false;
  hasMultipleCameras = false;
  supportedFormats: string[] = [];

  private detector: any = null;          // BarcodeDetector instance
  private stream: MediaStream | null = null;
  private scanInterval: any = null;
  private facingMode: 'user' | 'environment' = 'environment';
  private recentValues = new Set<string>(); // debounce duplicates
  private recentTimer: any = null;

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  ngOnInit(): void {
    this.initDetector();
    this.checkCameras();
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  // ── Init ────────────────────────────────────────────────────────────────────

  private async initDetector(): Promise<void> {
    const BD = (window as any)['BarcodeDetector'];
    if (!BD) {
      this.apiSupported = false;
      this.supportedFormats = ['qr_code', 'ean_13', 'ean_8', 'code_128', 'pdf417', 'aztec'];
      this.cdr.markForCheck();
      return;
    }
    this.apiSupported = true;
    try {
      const formats: string[] = await BD.getSupportedFormats();
      this.supportedFormats = formats;
      this.detector = new BD({ formats });
    } catch {
      this.detector = new BD({ formats: ['qr_code', 'ean_13', 'code_128'] });
      this.supportedFormats = ['qr_code', 'ean_13', 'code_128'];
    }
    this.cdr.markForCheck();
  }

  private async checkCameras(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter(d => d.kind === 'videoinput');
      this.hasMultipleCameras = cams.length > 1;
      this.cdr.markForCheck();
    } catch { /* no-op */ }
  }

  // ── Camera ──────────────────────────────────────────────────────────────────

  async startCamera(): Promise<void> {
    this.starting  = true;
    this.errorMsg  = '';
    this.cdr.markForCheck();

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: this.facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });

      const video = this.videoEl.nativeElement;
      video.srcObject = this.stream;
      await video.play();

      // Check torch support
      const track = this.stream.getVideoTracks()[0];
      const caps = track.getCapabilities?.() as any;
      this.hasTorch = !!caps?.torch;

      this.streaming = true;
      this.starting  = false;
      this.cdr.markForCheck();

      this.startScanLoop();
    } catch (e: any) {
      this.starting = false;
      this.errorMsg = e?.name === 'NotAllowedError'
        ? 'Camera permission denied. Please allow camera access in your browser settings.'
        : `Could not access camera: ${e?.message || e}`;
      this.cdr.markForCheck();
    }
  }

  stopCamera(): void {
    clearInterval(this.scanInterval);
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream   = null;
    this.streaming = false;
    this.lastResult = null;
    if (this.videoEl?.nativeElement) this.videoEl.nativeElement.srcObject = null;
    this.cdr.markForCheck();
  }

  async flipCamera(): Promise<void> {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    this.stopCamera();
    await this.startCamera();
  }

  async toggleTorch(): Promise<void> {
    const track = this.stream?.getVideoTracks()[0];
    if (!track) return;
    this.torchOn = !this.torchOn;
    await (track as any).applyConstraints({ advanced: [{ torch: this.torchOn }] });
    this.cdr.markForCheck();
  }

  // ── Scan loop ───────────────────────────────────────────────────────────────

  private startScanLoop(): void {
    clearInterval(this.scanInterval);
    this.scanInterval = setInterval(() => this.scanFrame(), 250);
  }

  private async scanFrame(): Promise<void> {
    if (!this.streaming || !this.videoEl || !this.detector) return;
    const video  = this.videoEl.nativeElement;
    const canvas = this.canvasEl.nativeElement;
    if (video.readyState < 2) return;

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    try {
      const barcodes = await this.detector.detect(canvas);
      if (barcodes?.length > 0) {
        for (const b of barcodes) {
          this.ngZone.run(() => this.onDetected(b.rawValue, b.format));
        }
      }
    } catch { /* detector not ready */ }
  }

  // ── Image upload fallback ───────────────────────────────────────────────────

  async onFileSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !this.detector) return;

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src   = url;
    await new Promise(r => img.onload = r);

    const canvas = this.canvasEl.nativeElement;
    canvas.width  = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    try {
      const barcodes = await this.detector.detect(canvas);
      if (barcodes?.length > 0) {
        barcodes.forEach((b: any) => this.onDetected(b.rawValue, b.format));
      } else {
        this.errorMsg = 'No barcode or QR code found in this image.';
        this.cdr.markForCheck();
      }
    } catch (e: any) {
      this.errorMsg = 'Could not scan image: ' + (e?.message || e);
      this.cdr.markForCheck();
    }
  }

  // ── Result handling ─────────────────────────────────────────────────────────

  private onDetected(value: string, format: string): void {
    if (!value || this.recentValues.has(value)) return;

    // Debounce same value for 3 s
    this.recentValues.add(value);
    clearTimeout(this.recentTimer);
    this.recentTimer = setTimeout(() => { this.recentValues.clear(); }, 3000);

    const result: ScanResult = {
      id:        crypto.randomUUID(),
      value,
      format:    format?.replace(/_/g, ' ').toUpperCase() ?? 'QR CODE',
      type:      this.detectType(value),
      scannedAt: new Date()
    };

    this.results.unshift(result);
    this.lastResult   = result;
    this.flashVisible = true;
    this.errorMsg     = '';
    setTimeout(() => { this.flashVisible = false; this.cdr.markForCheck(); }, 300);
    this.cdr.markForCheck();
  }

  private detectType(value: string): ScanResult['type'] {
    if (/^https?:\/\//i.test(value))                        return 'url';
    if (/^mailto:/i.test(value) || /^[^@]+@[^@]+\.[^@]+$/.test(value)) return 'email';
    if (/^tel:/i.test(value) || /^\+?[\d\s\-()]{7,}$/.test(value))     return 'phone';
    if (/^WIFI:/i.test(value))                              return 'wifi';
    return 'text';
  }

  typeIcon(type: ScanResult['type']): string {
    const icons: Record<string, string> = {
      url: '🔗', email: '✉️', phone: '📞', wifi: '📶', text: '📄', other: '📄'
    };
    return icons[type] ?? '📄';
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  copyResult(r: ScanResult): void {
    navigator.clipboard.writeText(r.value).then(() => {
      r.copied = true;
      this.cdr.markForCheck();
      setTimeout(() => { r.copied = false; this.cdr.markForCheck(); }, 2000);
    });
  }

  removeResult(id: string): void {
    this.results = this.results.filter(r => r.id !== id);
    this.cdr.markForCheck();
  }

  clearHistory(): void {
    this.results    = [];
    this.lastResult = null;
    this.cdr.markForCheck();
  }
}
