import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-confirm-delete-all-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="delete-all-dialog">
      <div class="dialog-header">
        <mat-icon class="warning-icon">warning</mat-icon>
        <h2 mat-dialog-title>Delete All Documents?</h2>
      </div>
      
      <mat-dialog-content>
        <div class="warning-content">
          <p class="warning-text">
            <strong>⚠️ This action cannot be undone!</strong>
          </p>
          
          <div class="stats">
            <div class="stat-item">
              <mat-icon>description</mat-icon>
              <span><strong>{{ data.count }}</strong> documents will be deleted</span>
            </div>
            <div class="stat-item">
              <mat-icon>storage</mat-icon>
              <span><strong>{{ formatSize(data.totalSize) }}</strong> will be freed</span>
            </div>
          </div>
          
          <p class="consequence-text">
            All documents, analyses, and files will be permanently removed.
          </p>
        </div>
      </mat-dialog-content>
      
      <mat-dialog-actions align="end">
        <button mat-button (click)="onCancel()">
          Cancel
        </button>
        <button mat-raised-button color="warn" (click)="onConfirm()">
          <mat-icon>delete_forever</mat-icon>
          Delete All
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .delete-all-dialog {
      padding: 8px;
    }
    
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      
      .warning-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: #f59e0b;
      }
      
      h2 {
        margin: 0;
        font-size: 24px;
        font-weight: 600;
      }
    }
    
    .warning-content {
      .warning-text {
        font-size: 16px;
        color: #ef4444;
        margin-bottom: 20px;
      }
      
      .stats {
        background: #fef3c7;
        border-left: 4px solid #f59e0b;
        padding: 16px;
        border-radius: 8px;
        margin-bottom: 20px;
        
        .stat-item {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
          
          &:last-child {
            margin-bottom: 0;
          }
          
          mat-icon {
            color: #d97706;
          }
          
          span {
            font-size: 14px;
            color: #92400e;
          }
        }
      }
      
      .consequence-text {
        font-size: 14px;
        color: #64748b;
        line-height: 1.6;
      }
    }
    
    mat-dialog-actions {
      padding: 16px 0 0 0;
      gap: 8px;
    }
  `]
})
export class ConfirmDeleteAllDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDeleteAllDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { count: number; totalSize: number }
  ) {}

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  formatSize(bytes: number): string {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}