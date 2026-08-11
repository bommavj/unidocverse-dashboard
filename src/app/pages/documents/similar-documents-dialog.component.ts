import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SearchResult } from '../../lib/api';

@Component({
  selector: 'app-similar-documents-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="dialog-header">
      <div class="header-content">
        <mat-icon class="header-icon">compare_arrows</mat-icon>
        <div>
          <h2>Similar Documents</h2>
          <p class="source-doc">Based on: {{ data.sourceDocument.filename }}</p>
        </div>
      </div>
      <button mat-icon-button mat-dialog-close>
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-dialog-content>
      <div class="content-container">
        
        <!-- Loading State -->
        <div *ngIf="data.loading" class="loading-state">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Finding similar documents using AI embeddings...</p>
        </div>

        <!-- Results -->
        <div *ngIf="!data.loading && data.similarDocuments.length > 0" class="results">
          <p class="results-header">
            Found {{ data.similarDocuments.length }} similar document{{ data.similarDocuments.length > 1 ? 's' : '' }}
          </p>

          <mat-card *ngFor="let doc of data.similarDocuments; let i = index" class="similar-card">
            <mat-card-header>
              <div class="rank-badge">{{ i + 1 }}</div>
              <mat-icon mat-card-avatar class="doc-icon">description</mat-icon>
              <mat-card-title>{{ doc.filename }}</mat-card-title>
              <mat-card-subtitle>
                <mat-chip>{{ doc.doc_type }}</mat-chip>
                <span 
                  class="similarity-badge"
                  [class]="getSimilarityClass(doc.similarity)">
                  {{ doc.similarity_percent }} similar
                </span>
              </mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <div class="similarity-bar-container">
                <div class="similarity-bar">
                  <div 
                    class="similarity-fill"
                    [style.width.%]="doc.similarity * 100"
                    [class]="getSimilarityClass(doc.similarity)">
                  </div>
                </div>
              </div>
              <p class="summary">{{ doc.summary }}</p>
            </mat-card-content>
            <mat-card-actions>
              <button mat-button color="primary">
                <mat-icon>visibility</mat-icon>
                View Document
              </button>
            </mat-card-actions>
          </mat-card>
        </div>

        <!-- Empty State -->
        <div *ngIf="!data.loading && data.similarDocuments.length === 0" class="empty-state">
          <mat-icon>search_off</mat-icon>
          <h3>No Similar Documents Found</h3>
          <p>There are no other documents similar to this one in your library.</p>
        </div>

      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px;
      background: linear-gradient(135deg, #2196f3 0%, #42a5f5 100%);
      color: white;
    }

    .header-content {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 24px;
      font-weight: 500;
    }

    .source-doc {
      margin: 4px 0 0 0;
      font-size: 13px;
      opacity: 0.9;
    }

    mat-dialog-content {
      padding: 0;
      max-height: 70vh;
    }

    .content-container {
      padding: 24px;
      background: #fafafa;
    }

    .loading-state {
      text-align: center;
      padding: 60px 20px;
      
      p {
        margin-top: 24px;
        color: #757575;
      }
    }

    .results-header {
      margin: 0 0 16px 0;
      color: #424242;
      font-size: 14px;
      font-weight: 500;
    }

    .similar-card {
      margin-bottom: 16px;
      background: #fff !important;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12) !important;
      position: relative;
      
      &:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        transform: translateY(-2px);
        transition: all 0.3s ease;
      }
    }

    .rank-badge {
      position: absolute;
      top: 12px;
      left: 12px;
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #2196f3 0%, #42a5f5 100%);
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 14px;
      box-shadow: 0 2px 4px rgba(33, 150, 243, 0.3);
    }

    .doc-icon {
      color: #4caf50 !important;
      margin-left: 40px;
    }

    .similarity-badge {
      margin-left: 12px;
      font-weight: 600;
      padding: 6px 12px;
      border-radius: 16px;
      font-size: 13px;
      display: inline-block;
      
      &.high {
        background: #e8f5e9;
        color: #2e7d32;
      }
      
      &.medium {
        background: #fff3e0;
        color: #e65100;
      }
      
      &.low {
        background: #ffebee;
        color: #c62828;
      }
    }

    .similarity-bar-container {
      margin: 16px 0;
    }

    .similarity-bar {
      height: 8px;
      background: #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
    }

    .similarity-fill {
      height: 100%;
      transition: width 0.3s ease;
      
      &.high {
        background: linear-gradient(90deg, #4caf50 0%, #66bb6a 100%);
      }
      
      &.medium {
        background: linear-gradient(90deg, #ff9800 0%, #ffa726 100%);
      }
      
      &.low {
        background: linear-gradient(90deg, #f44336 0%, #ef5350 100%);
      }
    }

    .summary {
      color: #616161;
      line-height: 1.6;
      margin: 0;
      font-size: 14px;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      
      mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: #e0e0e0;
        margin-bottom: 16px;
      }
      
      h3 {
        margin: 0 0 8px 0;
        font-size: 20px;
        color: #757575;
      }
      
      p {
        margin: 0;
        color: #9e9e9e;
      }
    }

    ::ng-deep .mat-mdc-card-title {
      color: #212121 !important;
      font-size: 16px !important;
    }

    ::ng-deep .mat-mdc-card-subtitle {
      color: #757575 !important;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px !important;
    }
  `]
})
export class SimilarDocumentsDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: {
      sourceDocument: any;
      similarDocuments: SearchResult[];
      loading: boolean;
    }
  ) {}

  getSimilarityClass(similarity: number): string {
    if (similarity >= 0.8) return 'high';
    if (similarity >= 0.6) return 'medium';
    return 'low';
  }
}