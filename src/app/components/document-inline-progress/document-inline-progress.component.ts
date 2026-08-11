import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressBarModule } from '@angular/material/progress-bar';

// ✅ Store progress OUTSIDE the component so it survives recreation
const progressStore = new Map<string, number>();

@Component({
  selector: 'app-document-inline-progress',
  standalone: true,
  imports: [CommonModule, MatProgressBarModule],
  template: `
    <div class="progress-container">
      <div class="progress-header">
        <span class="progress-label">{{ getStageLabel() }}</span>
        <span class="progress-percent">{{ progress }}%</span>
      </div>
      
      <mat-progress-bar 
        mode="determinate" 
        [value]="progress">
      </mat-progress-bar>
    </div>
  `,
  styles: [`
    .progress-container {
      padding: 12px;
      background: #FFF8E1;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .progress-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .progress-label {
      font-size: 14px;
      font-weight: 500;
      color: #E65100;
    }
    .progress-percent {
      font-size: 14px;
      font-weight: 600;
      color: #FF6F00;
    }
  `]
})
export class DocumentInlineProgressComponent implements OnInit {
  progress: number = 0;
  private instanceId = Math.random().toString();
  
  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    // ✅ Get stored progress or start fresh
    this.progress = progressStore.get(this.instanceId) || 0;
    console.log('Progress component init, current:', this.progress);
    
    this.animate();
  }

  private animate(): void {
    setTimeout(() => {
      if (this.progress < 85) {
        this.progress += 1;
        progressStore.set(this.instanceId, this.progress); // ✅ Save it
        this.cdr.detectChanges();
        this.animate();
      }
    }, 1000);
  }

  getStageLabel(): string {
    if (this.progress < 20) return 'Starting...';
    if (this.progress < 40) return 'Parsing...';
    if (this.progress < 70) return 'Analyzing...';
    return 'Almost done...';
  }
}