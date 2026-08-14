import { Component, Inject, OnInit, ViewChild, ElementRef } from '@angular/core';
import { authFetch } from '../../lib/api';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { DocumentResponse, api } from '../../lib/api';
import { ExcelVisualizerComponent } from '../../components/excel-visualizer/excel-visualizer.component';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpClient } from '@angular/common/http';


@Component({
  selector: 'app-document-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTabsModule,
    MatCardModule,
    MatListModule,
    MatDividerModule,
    ExcelVisualizerComponent,
    MatProgressSpinnerModule, // ✅ ADD THIS
  ],
  template: `
    <div class="dialog-header">
      <div class="header-content">
        <mat-icon class="file-icon">description</mat-icon>
        <div class="title-section">
          <h2>{{ document.filename }}</h2>
          <div class="meta">
            <mat-chip>{{ document.doc_type || 'Unknown' }}</mat-chip>
            <mat-chip [color]="getStatusColor()">{{ document.status }}</mat-chip>
          </div>
        </div>
      </div>
      <button mat-icon-button mat-dialog-close>
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-dialog-content>
      <mat-tab-group>
        
       <!-- Summary Tab -->
<mat-tab>
  <ng-template mat-tab-label>
    <mat-icon class="tab-icon">article</mat-icon>
    Summary
  </ng-template>
  <div class="tab-content">
    <mat-card class="info-card" *ngIf="displayedSummary">
      <mat-card-header>
        <mat-icon mat-card-avatar>auto_awesome</mat-icon>
        <mat-card-title>AI-Generated Summary</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <p class="summary-text">{{ getSummaryToDisplay() }}</p>
                 <!-- (click)="toggleSummary()"
                  <mat-icon>{{ summaryExpanded ? 'expand_less' : 'expand_more' }}</mat-icon>
                  {{ summaryExpanded ? 'Show Less' : 'Show More' }} -->
        <!-- Show More/Less Button for Summary -->
        <button 
          mat-button 
          color="primary"
          *ngIf="shouldShowSummaryToggle()"
          (click)="deepSummaryDone ? toggleSummary() : loadDeepSummary()"
          class="summary-toggle-btn">
          <mat-icon>{{ deepSummaryLoading ? 'hourglass_empty' : (deepSummaryDone && summaryExpanded ? 'expand_less' : 'expand_more') }}</mat-icon>
          {{ deepSummaryLoading ? 'Analyzing...' : (deepSummaryDone && summaryExpanded ? 'Show Less' : 'Show More') }}

        </button>
      </mat-card-content>
    </mat-card>

    <div *ngIf="!displayedSummary" class="empty-message">
      <mat-icon>info</mat-icon>
      <p>No summary available</p>
    </div>
  </div>
</mat-tab>

        <!-- Data Visualizations Tab (ALWAYS show for spreadsheets) -->
        <mat-tab *ngIf="isSpreadsheet()">
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">insert_chart</mat-icon>
            Data & Charts
          </ng-template>
          <div class="tab-content visualizations-tab">
            <!-- Show visualizer if we have table data -->
            <app-excel-visualizer 
              [tableData]="getTableData()"
              *ngIf="hasTableData()">
            </app-excel-visualizer>

            <!-- Show message if no table data yet -->
            <div *ngIf="!hasTableData()" class="empty-message">
              <mat-icon>insert_chart</mat-icon>
              <h3>Processing Spreadsheet Data</h3>
              <p>Table data will be available once processing is complete.</p>
              <p class="debug-info">Debug: {{ getDebugInfo() }}</p>
            </div>
          </div>
        </mat-tab>

        <!-- AI Insights Tab -->
<mat-tab>
  <ng-template mat-tab-label>
    <mat-icon class="tab-icon">lightbulb</mat-icon>
    AI Insights ({{ getInsightsCount() }})
  </ng-template>
  <div class="tab-content">
    
    <!-- ✅ SCROLLABLE CONTAINER -->
    <div 
      class="insights-scroll-container" 
      #insightsContainer
      >
      
      <!-- Insights Cards -->
      <mat-card 
        *ngFor="let insight of displayedInsights; let i = index" 
        class="insight-card">
        <mat-card-header>
          <mat-icon mat-card-avatar class="insight-icon">tips_and_updates</mat-icon>
          <mat-card-title>{{ insight.title }}</mat-card-title>
          <mat-card-subtitle>
            <mat-chip class="category-chip">{{ insight.category }}</mat-chip>
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <p class="insight-text">{{ insight.description }}</p>
        </mat-card-content>
      </mat-card>

      <!-- Loading Indicator -->
      <div class="loading-more" *ngIf="insightsLoading">
        <mat-spinner diameter="32"></mat-spinner>
        <p>Loading more insights...</p>
      </div>

      <!-- End of List Indicator -->
      <div class="end-of-list" *ngIf="!insightsHasMore && displayedInsights.length > 0">
        <mat-icon>check_circle</mat-icon>
        <p>All {{ totalInsights }} insights loaded</p>
      </div>

      <!-- Load More Button -->
      <div class="show-more-container" *ngIf="insightsHasMore && !insightsLoading">
        <button mat-stroked-button class="show-more-btn" (click)="loadMoreInsightsFromAPI()">
          <mat-icon>expand_more</mat-icon>
          Load More Insights
        </button>
      </div>

      <!-- Empty State -->
      <div *ngIf="displayedInsights.length === 0 && !insightsLoading" class="empty-message">
        <mat-icon>lightbulb_outline</mat-icon>
        <p>No insights generated for this document</p>
      </div>
    </div>
  </div>
</mat-tab>


<!-- Key Points Tab -->
<mat-tab>
  <ng-template mat-tab-label>
    <mat-icon class="tab-icon">checklist</mat-icon>
    Key Points ({{ totalKeyPoints }})
  </ng-template>
  <div class="tab-content">
    
    <!-- ✅ SCROLLABLE CONTAINER -->
    <div 
      class="keypoints-scroll-container"
      #keyPointsContainer
    >
      
      <!-- ✅ Put mat-list OUTSIDE the card for better scrolling -->
      <mat-list *ngIf="displayedKeyPoints.length > 0">
        <mat-list-item *ngFor="let point of displayedKeyPoints; let i = index" class="key-point-item">
          <mat-icon matListItemIcon class="check-icon">check_circle</mat-icon>
          <div matListItemTitle class="point-text">{{ point }}</div>
        </mat-list-item>
      </mat-list>

      <!-- Loading Indicator -->
      <div class="loading-more" *ngIf="keyPointsLoading">
        <mat-spinner diameter="32"></mat-spinner>
        <p>Loading more key points...</p>
      </div>

      <!-- End of List Indicator -->
      <div class="end-of-list" *ngIf="!keyPointsHasMore && displayedKeyPoints.length > 0">
        <mat-icon>check_circle</mat-icon>
        <p>All {{ totalKeyPoints }} key points loaded</p>
      </div>

      <!-- Load More Button -->
      <div class="show-more-container" *ngIf="keyPointsHasMore && !keyPointsLoading">
        <button mat-stroked-button class="show-more-btn" (click)="loadMoreKeyPointsFromAPI()">
          <mat-icon>expand_more</mat-icon>
          Load More Key Points
        </button>
      </div>

      <!-- Empty State -->
      <div *ngIf="displayedKeyPoints.length === 0 && !keyPointsLoading" class="empty-message">
        <mat-icon>checklist</mat-icon>
        <p>No key points extracted</p>
      </div>
    </div>
  </div>
</mat-tab>
       
        <!-- Classification Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">category</mat-icon>
            Classification
          </ng-template>
        <div class="tab-content">
            <mat-card class="info-card" *ngIf="getClassification()">
              <mat-card-header>
                <mat-icon mat-card-avatar>psychology</mat-icon>
                <mat-card-title>AI Classification</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="classification-info">
                  <div class="detail-row">
                    <strong>Document Type:</strong> 
                    <mat-chip class="type-chip">{{ getClassification()?.type || 'Unknown' }}</mat-chip>
                  </div>
                  <div class="detail-row">
                    <strong>Confidence:</strong>
                    <div class="confidence-display">
                      <div class="confidence-bar-large">
                        <div 
                          class="confidence-fill-large"
                          [style.width.%]="getConfidencePercent()"
                          [class.high]="getConfidencePercent() >= 80">
                        </div>
                      </div>
                      <span class="confidence-text">{{ getConfidencePercent() }}%</span>
                    </div>
                  </div>
                  <div class="detail-row" *ngIf="getClassification()?.reasoning">
                    <strong>Reasoning:</strong>
                    <p class="reasoning-text">{{ getClassification()?.reasoning }}</p>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>

        <!-- Details Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">info</mat-icon>
            Details
          </ng-template>
          <div class="tab-content">
            <mat-card class="info-card">
              <mat-card-header>
                <mat-icon mat-card-avatar>description</mat-icon>
                <mat-card-title>Document Information</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="detail-row">
                  <strong>Filename:</strong> {{ document.filename }}
                </div>
                <div class="detail-row">
                  <strong>Type:</strong> {{ document.doc_type || 'Unknown' }}
                </div>
                <div class="detail-row">
                  <strong>Status:</strong> 
                  <mat-chip [color]="getStatusColor()">{{ document.status }}</mat-chip>
                </div>
                <div class="detail-row">
                  <strong>File Size:</strong> {{ formatFileSize(document.file_size) }}
                </div>
                <div class="detail-row" *ngIf="document.created_at">
                  <strong>Uploaded:</strong> {{ formatDate(document.created_at) }}
                </div>
                <div class="detail-row" *ngIf="document.processed_at">
                  <strong>Processed:</strong> {{ formatDate(document.processed_at) }}
                </div>
                <div class="detail-row" *ngIf="getKeywords().length > 0">
                  <strong>Keywords:</strong>
                  <div class="keywords-container">
                    <mat-chip *ngFor="let keyword of getKeywords()">{{ keyword }}</mat-chip>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>
      </mat-tab-group>
    </mat-dialog-content>
  `,
  styles: [`

  // ✅ ADD THESE STYLES AT THE END (they're missing!)
  .insights-scroll-container,
  .keypoints-scroll-container {
  max-height: 250px !important;  /* ✅ Reduced from 400px to force scroll with 5 items */
  overflow-y: auto !important;
  overflow-x: hidden;
  padding: 16px !important;
  background: #fafafa;
}

.key-point-item {
  padding: 16px !important;
  margin-bottom: 12px;
  background: #fff;
  border-radius: 8px;
  border-left: 4px solid #4caf50;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  min-height: 60px !important;  /* ✅ Minimum height */
  height: auto !important;       /* ✅ Auto height to expand */
  display: flex !important;
  align-items: flex-start !important;  /* ✅ Align to top */

  &:hover {
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    transform: translateX(4px);
    transition: all 0.2s ease;
  }
}

.check-icon {
  color: #4caf50 !important;
  margin-right: 12px !important;
  font-size: 20px !important;
  width: 20px !important;
  height: 20px !important;
  flex-shrink: 0 !important;  /* ✅ Don't shrink icon */
  margin-top: 2px !important;  /* ✅ Align with text */
}

.point-text {
  color: #424242 !important;
  line-height: 1.6 !important;
  font-size: 14px !important;
  word-wrap: break-word !important;
  overflow-wrap: break-word !important;  /* ✅ Force word wrap */
  white-space: normal !important;         /* ✅ Allow text to wrap */
  flex: 1 !important;                     /* ✅ Take remaining space */
  max-width: 100% !important;             /* ✅ Don't overflow */
}

/* ✅ Override Material defaults that prevent wrapping */
::ng-deep .keypoints-scroll-container .mat-mdc-list {
  padding: 0 !important;
}

::ng-deep .keypoints-scroll-container .mat-mdc-list-item {
  height: auto !important;
  min-height: 60px !important;
  padding: 0 !important;
  white-space: normal !important;  /* ✅ Critical for text wrapping */
}

::ng-deep .keypoints-scroll-container .mat-mdc-list-item-title {
  white-space: normal !important;   /* ✅ Critical for text wrapping */
  word-wrap: break-word !important;
  overflow-wrap: break-word !important;
  line-height: 1.6 !important;
}

::ng-deep .keypoints-scroll-container .mdc-list-item__primary-text {
  white-space: normal !important;   /* ✅ Critical for text wrapping */
  word-wrap: break-word !important;
  overflow: visible !important;
}

/* ✅ Scrollbar styling */
.keypoints-scroll-container::-webkit-scrollbar {
  width: 8px;
}

.keypoints-scroll-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.keypoints-scroll-container::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.keypoints-scroll-container::-webkit-scrollbar-thumb:hover {
  background: #555;
}

  .loading-more {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px;
    gap: 12px;

    p {
      margin: 0;
      color: #666;
      font-size: 14px;
    }
  }

  .end-of-list {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px;
    color: #4caf50;
    font-size: 14px;
    font-weight: 500;

    mat-icon {
      color: #4caf50;
    }

    p {
      margin: 0;
    }
  }

  /* Scrollbar styling */
  .insights-scroll-container::-webkit-scrollbar,
  .keypoints-scroll-container::-webkit-scrollbar {
    width: 8px;
  }

  .insights-scroll-container::-webkit-scrollbar-track,
  .keypoints-scroll-container::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }

  .insights-scroll-container::-webkit-scrollbar-thumb,
  .keypoints-scroll-container::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;
  }

  .insights-scroll-container::-webkit-scrollbar-thumb:hover,
  .keypoints-scroll-container::-webkit-scrollbar-thumb:hover {
    background: #555;
  }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 24px;
      background: #fff;
      border-bottom: 1px solid #e0e0e0;
    }
  
    .header-content {
      display: flex;
      gap: 16px;
      align-items: center;
    }
  
    .file-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #00cc6f;
    }
  
    .title-section h2 {
      margin: 0;
      font-size: 24px;
      color: #212121;
    }
  
    .meta {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }
  
    mat-dialog-content {
      padding: 0;
      max-height: 70vh;
      background: #fafafa;
    }
  
    .tab-icon {
      margin-right: 8px;
      color: #666;
    }
  
    .tab-content {
      padding: 24px;
      background: #fafafa;
      
      &.visualizations-tab {
        padding: 0;
        background: #fff;
      }
    }
  
    .info-card, .insight-card {
      margin-bottom: 16px;
      background: #fff !important;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
      border-radius: 8px;
    }
  
    .insight-card {
      border-left: 4px solid #ff9800;
    }
  
    .insight-icon {
      color: #ff9800 !important;
    }
  
  
    .summary-text {
      line-height: 1.8;
      color: #424242 !important;
      font-size: 15px;
      padding: 20px;
      background: #f5f5f5;
      border-radius: 8px;
      border-left: 4px solid #4caf50;
    }
  
    .insight-text {
      line-height: 1.7;
      color: #616161 !important;
      font-size: 14px;
    }
  
  
    .category-chip {
      background: #fff3e0 !important;
      color: #e65100 !important;
      font-weight: 500;
    }
  
    .type-chip {
      background: #e8f5e9 !important;
      color: #2e7d32 !important;
      font-weight: 500;
      margin-left: 8px;
    }
  
    .classification-info {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
  
    .confidence-display {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-top: 12px;
    }
  
    .confidence-bar-large {
      flex: 1;
      height: 12px;
      background: #e0e0e0;
      border-radius: 6px;
      overflow: hidden;
    }
  
    .confidence-fill-large {
      height: 100%;
      background: linear-gradient(90deg, #4caf50 0%, #66bb6a 100%);
      transition: width 0.3s ease;
      box-shadow: 0 2px 4px rgba(76, 175, 80, 0.3);
    }
  
    .confidence-text {
      font-weight: 600;
      color: #4caf50;
      font-size: 16px;
    }
  
    .reasoning-text {
      margin-top: 8px;
      color: #757575 !important;
      line-height: 1.7;
    }
  
    .detail-row {
      padding: 16px 0;
      border-bottom: 1px solid #f0f0f0;
      color: #424242 !important;
    }
  
    .detail-row:last-child {
      border-bottom: none;
    }
  
    .detail-row strong {
      color: #212121 !important;
      margin-right: 8px;
      font-weight: 600;
    }
  
    .keywords-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }
  
    .empty-message {
      text-align: center;
      padding: 60px 20px;
      color: #bdbdbd;

      h3 {
        margin: 16px 0 8px 0;
        color: #757575;
      }

      .debug-info {
        margin-top: 16px;
        font-size: 0.85rem;
        color: #999;
        font-family: monospace;
      }
    }
  
    .empty-message mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
      color: #e0e0e0;
    }
  
    ::ng-deep .mat-mdc-dialog-container {
      background: #fff !important;
      box-shadow: 0 11px 15px -7px rgba(0,0,0,.2), 0 24px 38px 3px rgba(0,0,0,.14);
    }
  
    ::ng-deep .mat-mdc-card {
      background: #fff !important;
      color: #212121 !important;
    }
  
    ::ng-deep .mat-mdc-card-title {
      color: #212121 !important;
      font-weight: 500 !important;
    }
  
    ::ng-deep .mat-mdc-card-subtitle {
      color: #757575 !important;
    }
  
    ::ng-deep .mat-mdc-card-content {
      color: #424242 !important;
    }
  
    ::ng-deep .mat-mdc-tab-body-content {
      background: #fafafa;
    }
  
    ::ng-deep .mat-mdc-list-item-title {
      color: #424242 !important;
    }
  
    ::ng-deep .mat-mdc-tab {
      color: #616161 !important;
    }
  
    ::ng-deep .mat-mdc-tab.mdc-tab--active {
      color: #4caf50 !important;
    }
  
    ::ng-deep .mat-mdc-chip {
      font-weight: 500 !important;
    }

    // ✅ ADD THESE NEW STYLES
  .show-more-container {
    display: flex;
    justify-content: center;
    margin-top: 16px;
    padding: 16px 0;
  }

  .show-more-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 200px;
    justify-content: center;
    transition: all 0.3s ease;

    mat-spinner {
      display: inline-block;
    }

    mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    &:hover {
      background: rgba(76, 175, 80, 0.04);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  ::ng-deep .show-more-container .mat-mdc-progress-spinner {
    --mdc-circular-progress-active-indicator-color: #4caf50;
  }


.summary-toggle-btn {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  
  mat-icon {
    font-size: 20px;
    width: 20px;
    height: 20px;
  }
}

.loading-more {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  gap: 12px;

  p {
    margin: 0;
    color: #666;
    font-size: 14px;
  }
}

.end-of-list {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  color: #4caf50;
  font-size: 14px;
  font-weight: 500;

  mat-icon {
    color: #4caf50;
  }

  p {
    margin: 0;
  }
}

  `]
})
export class DocumentDetailsDialogComponent implements OnInit {
  
// ✅ INSIGHTS INFINITE SCROLL
displayedInsights: any[] = [];
totalInsights = 0;
insightsOffset = 0;
insightsLimit = 2;
insightsHasMore = false;
insightsLoading = false;

// ✅ KEY POINTS INFINITE SCROLL
displayedKeyPoints: string[] = [];
totalKeyPoints = 0;
keyPointsOffset = 0;
keyPointsLimit = 3;
keyPointsHasMore = false;
keyPointsLoading = false;

// ✅ SUMMARY
displayedSummary: string = '';
summaryExpanded: boolean = false;
summaryLimit: number = 500; // Show first 500 characters initially

@ViewChild('insightsContainer') insightsContainer!: ElementRef;
@ViewChild('keyPointsContainer') keyPointsContainer!: ElementRef;

  constructor(@Inject(MAT_DIALOG_DATA) public document: DocumentResponse,
  private http: HttpClient // ✅ ADD THIS
  ) {}

ngOnInit() {
  console.log('=' .repeat(60));
  console.log('📄 DOCUMENT DETAILS DIALOG OPENED');
  console.log('=' .repeat(60));
  console.log('Filename:', this.document.filename);
  console.log('Doc Type:', this.document.doc_type);
  console.log('Status:', this.document.status);
  console.log('');
  console.log('CHECKS:');
  console.log('  Is Spreadsheet:', this.isSpreadsheet());
  console.log('  Has Table Data:', this.hasTableData());
  console.log('  Table Data:', this.getTableData());
  console.log('');
  console.log('METADATA:');
  console.log('  Full Metadata:', this.document.metadata);
  console.log('  Metadata Keys:', Object.keys(this.document.metadata || {}));
  console.log('  Tables:', (this.document.metadata as any)?.tables);
  console.log('=' .repeat(60));

  // Summary - show truncated initially
  this.displayedSummary = this.document.summary || '';
    
  // Insights - show all existing
  this.displayedInsights = this.document.insights || [];
  this.totalInsights = this.displayedInsights.length;
  this.insightsOffset = this.displayedInsights.length;
  this.insightsHasMore = true; // Can always generate more
  
  // Key Points - show all existing
  this.displayedKeyPoints = this.document.key_points || [];
  this.totalKeyPoints = this.displayedKeyPoints.length;
  this.keyPointsOffset = this.displayedKeyPoints.length;
  this.keyPointsHasMore = true; // Can always generate more
  
  console.log('✅ Loaded existing data:', {
    summary: this.displayedSummary.length,
    insights: this.displayedInsights.length,
    keyPoints: this.displayedKeyPoints.length
  });

/*     // ✅ LOAD INITIAL DATA FROM BACKEND
    this.loadInsights(true);
    this.loadKeyPoints(true); */

}


// ===== SUMMARY METHODS =====
getSummaryToDisplay(): string {
  if (this.summaryExpanded || this.displayedSummary.length <= this.summaryLimit) {
    return this.displayedSummary;
  }
  return this.displayedSummary.substring(0, this.summaryLimit) + '...';
}

shouldShowSummaryToggle(): boolean {
  return this.displayedSummary.length > this.summaryLimit || !this.deepSummaryDone;
}

toggleSummary(): void {
  this.summaryExpanded = !this.summaryExpanded;
}

// ===== INSIGHTS METHODS =====
onInsightsScroll(event: any): void {
/*   const element = event.target;
  const threshold = 100;
  
  const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
  
  if (atBottom && this.insightsHasMore && !this.insightsLoading) {
    console.log('📜 Scrolled to bottom - loading more insights');
    this.loadMoreInsightsFromAPI();
  } */
}

async loadMoreInsightsFromAPI(): Promise<void> {
  this.insightsLoading = true;
  
  console.log('🔄 Fetching more insights from API...', {
    currentOffset: this.insightsOffset,
    limit: this.insightsLimit
  });

  try {
    const response: any = await this.http.get(
      `http://localhost:8000/api/documents/${this.document.id}/insights`,
      {
        params: {
          limit: this.insightsLimit.toString(),
          offset: this.insightsOffset.toString()
        }
      }
    ).toPromise();

    console.log('✅ API returned insights:', response);

    if (response.insights && response.insights.length > 0) {
      this.displayedInsights = [...this.displayedInsights, ...response.insights];
      this.totalInsights = response.total;
      this.insightsOffset += response.insights.length;
      this.insightsHasMore = response.has_more;
      
      console.log('📊 Updated insights:', {
        displayed: this.displayedInsights.length,
        total: this.totalInsights,
        hasMore: this.insightsHasMore
      });
    }

  } catch (error) {
    console.error('❌ Error loading more insights:', error);
    this.insightsHasMore = false;
  } finally {
    this.insightsLoading = false;
  }
}

getRemainingInsightsCount(): number {
  return this.totalInsights - this.displayedInsights.length;
}

// ===== KEY POINTS METHODS =====
onKeyPointsScroll(event: any): void {
  /* const element = event.target;
  const threshold = 100;
  
  const scrollTop = element.scrollTop;
  const scrollHeight = element.scrollHeight;
  const clientHeight = element.clientHeight;
  
  console.log('📜 Key Points Scroll:', {
    scrollTop,
    scrollHeight,
    clientHeight,
    distanceFromBottom: scrollHeight - scrollTop - clientHeight
  });
  
  const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
  
  if (atBottom && this.keyPointsHasMore && !this.keyPointsLoading) {
    console.log('📜 Scrolled to bottom - loading more key points');
    this.loadMoreKeyPointsFromAPI();
  } */
}
/* onKeyPointsScroll(event: any): void {
  const element = event.target;
  const threshold = 100;
  
  const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
  
  if (atBottom && this.keyPointsHasMore && !this.keyPointsLoading) {
    console.log('📜 Scrolled to bottom - loading more key points');
    this.loadMoreKeyPointsFromAPI();
  }
} */

async loadMoreKeyPointsFromAPI(): Promise<void> {
  this.keyPointsLoading = true;
  
  console.log('🔄 Fetching more key points from API...', {
    currentOffset: this.keyPointsOffset,
    limit: this.keyPointsLimit
  });

  try {
    const response: any = await this.http.get(
      `http://localhost:8000/api/documents/${this.document.id}/key-points`,
      {
        params: {
          limit: this.keyPointsLimit.toString(),
          offset: this.keyPointsOffset.toString()
        }
      }
    ).toPromise();

    console.log('✅ API returned key points:', response);

    if (response.key_points && response.key_points.length > 0) {
      this.displayedKeyPoints = [...this.displayedKeyPoints, ...response.key_points];
      this.totalKeyPoints = response.total;
      this.keyPointsOffset += response.key_points.length;
      this.keyPointsHasMore = response.has_more;
      
      console.log('📊 Updated key points:', {
        displayed: this.displayedKeyPoints.length,
        total: this.totalKeyPoints,
        hasMore: this.keyPointsHasMore
      });
    }

  } catch (error) {
    console.error('❌ Error loading more key points:', error);
    this.keyPointsHasMore = false;
  } finally {
    this.keyPointsLoading = false;
  }
}

getRemainingKeyPointsCount(): number {
  return this.totalKeyPoints - this.displayedKeyPoints.length;
}


  // Excel/Table Data Methods
  isSpreadsheet(): boolean {
    const filename = this.document.filename?.toLowerCase() || '';
    const docType = this.document.doc_type?.toLowerCase() || '';
    
    // Check file extension
    const isExcel = filename.endsWith('.xlsx') || 
                    filename.endsWith('.xls') || 
                    filename.endsWith('.csv');
    
    // List of ALL spreadsheet-related document types
    const spreadsheetTypes = [
      'spreadsheet',
      'sales_data',
      'financial_report',
      'data_table',
      'inventory',
      'budget',
      'expense_report',
      'bank_statement'  // Added based on your logs
    ];
    
    const isSpreadsheetType = spreadsheetTypes.includes(docType);
    
    console.log('📊 Spreadsheet check:', { 
      filename, 
      docType,
      isExcel, 
      isSpreadsheetType,
      result: isExcel || isSpreadsheetType
    });
    
    return isExcel || isSpreadsheetType;
  }

  hasTableData(): boolean {
    const metadata = this.document.metadata as any;
    
    // Standard tables
    const tables = metadata?.tables;
    if (tables && tables.length > 0) return true;
  
    // Dataset analyzer (CSV/XLSX)
    const a = metadata?.analytics;
    if (a?.column_names?.length > 0) return true;
  
    return false;
  }

  getTableData(): any {
    const metadata = this.document.metadata as any;
  
    // Standard tables (non-CSV)
    const tables = metadata?.tables;
    if (tables?.length > 0 && tables[0].columns && tables[0].data) {
      const t = tables[0];
      return { columns: t.columns, rows: t.rows || t.data.length, data: t.data };
    }
  
    // Dataset analyzer (CSV/XLSX) — data lives in analytics
    const a = metadata?.analytics;
    if (a?.column_names?.length > 0) {
      return {
        columns: a.column_names,
        rows: a.total_rows || 0,
        data: a.sample_rows || [],
        summary: a.summary,
        numeric_columns: a.numeric_columns || [],
        total_columns: a.total_columns || 0
      };
    }
  
    return null;
  }

  /* getTableData(): any {
    const metadata = this.document.metadata as any;
    const tables = metadata?.tables;
    
    if (!tables || tables.length === 0) {
      console.log('⚠️ No table data found in metadata');
      console.log('Metadata:', metadata);
      return null;
    }
    
    const table = tables[0]; // Use first/main table
    
    // Validate table structure
    if (!table.columns || !table.data) {
      console.log('⚠️ Invalid table structure:', table);
      return null;
    }
    
    const tableData = {
      columns: table.columns || [],
      rows: table.rows || table.data.length - 1, // Exclude header row
      data: table.data || []
    };
    
    console.log('✅ Returning table data:', {
      columns: tableData.columns.length,
      rows: tableData.rows,
      dataRows: tableData.data.length
    });
    
    return tableData;
  } */

  getDebugInfo(): string {
    const metadata = this.document.metadata as any;
    return JSON.stringify({
      doc_type: this.document.doc_type,
      has_metadata: !!this.document.metadata,
      has_tables: !!(metadata?.tables),
      table_count: metadata?.tables?.length || 0,
      metadata_keys: Object.keys(this.document.metadata || {})
    }, null, 2);
  }

  // Existing Methods
  getStatusColor(): string {
    switch (this.document.status) {
      case 'completed': return 'primary';
      case 'needs_review': return 'warn';
      case 'failed': return 'warn';
      default: return '';
    }
  }

  // ✅ UPDATE THESE TO USE THE NEW PROPERTIES

getInsights() {
  // Return displayed insights if loaded via API, otherwise fallback to document data
  if (this.displayedInsights.length > 0) {
    return this.displayedInsights;
  }
  return this.document.insights || [];
}


  getInsightsCount(): number {
    return this.totalInsights; // Return total count from API
  }


  getKeyPoints() {
    // Return displayed key points if loaded via API, otherwise fallback to document data
    if (this.displayedKeyPoints.length > 0) {
      return this.displayedKeyPoints;
    }
    return this.document.key_points || [];
  }

  
  getKeyPointsCount(): number {
    return this.totalKeyPoints; // Return total count from API
  }

  getKeywords() {
    return this.document.metadata?.keywords || [];
  }

  getClassification() {
    return this.document?.classification;
  }

  getConfidencePercent(): number {
    const confidence = this.getClassification()?.confidence || 0;
    return Math.round(confidence * 100);
  }

  formatFileSize(bytes: number): string {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  deepSummaryLoading = false;
deepSummaryDone = false;

async loadDeepSummary(): Promise<void> {
  if (this.deepSummaryDone || this.deepSummaryLoading) return;
  this.deepSummaryLoading = true;
  try {
    const result: any = await authFetch(
      `http://localhost:8000/api/documents/${this.document.id}/analyze-deep/summary`,
      { method: 'POST' }
    ).then(r => r.json());
    if (result.summary) this.displayedSummary = result.summary;
    this.summaryExpanded = true;
    this.deepSummaryDone = true;
  } catch (e) {
    console.error('Deep summary failed:', e);
    this.summaryExpanded = true;
  } finally {
    this.deepSummaryLoading = false;
  }
}
}