import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { api } from '../../lib/api';

interface SummaryStats {
  total_documents: number;
  status_breakdown: { [key: string]: number };
  type_breakdown: { [key: string]: number };
  processing: {
    success_rate: number;
    avg_processing_time_seconds: number;
    completed: number;
    failed: number;
    needs_review: number;
  };
  activity: {
    last_7_days: number;
    today: number;
  };
  storage: {
    total_mb: number;
    avg_file_size_bytes: number;
  };
}

@Component({
  selector: 'app-summary-cards',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="summary-cards" *ngIf="stats">
      <mat-card class="stat-card total">
        <mat-card-content>
          <div class="stat-icon">
            <mat-icon>description</mat-icon>
          </div>
          <div class="stat-details">
            <h2>{{ stats.total_documents }}</h2>
            <p>Total Documents</p>
            <small>{{ stats.activity.today }} today</small>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="stat-card success">
        <mat-card-content>
          <div class="stat-icon">
            <mat-icon>check_circle</mat-icon>
          </div>
          <div class="stat-details">
            <h2>{{ stats.processing.success_rate.toFixed(1) }}%</h2>
            <p>Success Rate</p>
            <small>{{ stats.processing.completed }} completed</small>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="stat-card activity">
        <mat-card-content>
          <div class="stat-icon">
            <mat-icon>trending_up</mat-icon>
          </div>
          <div class="stat-details">
            <h2>{{ stats.activity.last_7_days }}</h2>
            <p>Last 7 Days</p>
            <small>{{ getAvgPerDay() }} per day</small>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="stat-card storage">
        <mat-card-content>
          <div class="stat-icon">
            <mat-icon>storage</mat-icon>
          </div>
          <div class="stat-details">
            <h2>{{ stats.storage.total_mb.toFixed(1) }} MB</h2>
            <p>Storage Used</p>
            <small>{{ formatAvgSize() }} avg</small>
          </div>
        </mat-card-content>
      </mat-card>
    </div>

    <div class="loading-stats" *ngIf="!stats">
      <mat-spinner diameter="40"></mat-spinner>
    </div>
  `,
  styles: [`
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      transition: transform 0.2s, box-shadow 0.2s;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }

      mat-card-content {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        padding: 1.5rem !important;
        height: 100px;
      }

      .stat-icon {
        flex-shrink: 0;
        
        mat-icon {
          font-size: 48px;
          width: 48px;
          height: 48px;
        }
      }

      .stat-details {
        flex: 1;
        min-width: 0;

        h2 {
          margin: 0;
          font-size: 1.75rem;
          font-weight: 600;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        p {
          margin: 0.25rem 0;
          color: #666;
          font-weight: 500;
          font-size: 0.95rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        small {
          color: #999;
          font-size: 0.85rem;
          display: block;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }

      &.total {
        .stat-icon { color: #1976d2; }
        border-left: 4px solid #1976d2;
      }

      &.success {
        .stat-icon { color: #4caf50; }
        border-left: 4px solid #4caf50;
      }

      &.activity {
        .stat-icon { color: #ff9800; }
        border-left: 4px solid #ff9800;
      }

      &.storage {
        .stat-icon { color: #9c27b0; }
        border-left: 4px solid #9c27b0;
      }
    }

    .loading-stats {
      display: flex;
      justify-content: center;
      padding: 2rem;
    }

    @media (max-width: 768px) {
      .summary-cards {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class SummaryCardsComponent implements OnInit {
  stats: SummaryStats | null = null;

  async ngOnInit() {
    await this.loadStats();
    
    // Refresh every 60 seconds
    setInterval(() => this.loadStats(), 60000);
  }

  async loadStats() {
    try {
      // Use your existing API
      const response = await api.getDocuments(0, 100);
      
      // Calculate stats from documents
      const docs = response.documents;
      const completed = docs.filter((d: any) => d.status === 'completed').length;
      const failed = docs.filter((d: any) => d.status === 'failed').length;
      const processing = docs.filter((d: any) => d.status === 'processing').length;
      const pending = docs.filter((d: any) => d.status === 'pending').length;
      const needsReview = docs.filter((d: any) => d.status === 'needs_review').length;
      
      const total = docs.length;
      const totalProcessed = completed + failed + needsReview;
      const successRate = totalProcessed > 0 ? (completed / totalProcessed * 100) : 0;
      
      // Calculate today and last 7 days
      const now = new Date();
      const today = docs.filter((d: any) => {
        const createdDate = new Date(d.created_at);
        return createdDate.toDateString() === now.toDateString();
      }).length;
      
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last7Days = docs.filter((d: any) => {
        const createdDate = new Date(d.created_at);
        return createdDate >= sevenDaysAgo;
      }).length;
      
      // Calculate storage
      const totalBytes = docs.reduce((sum: number, d: any) => sum + (d.file_size || 0), 0);
      const avgBytes = total > 0 ? totalBytes / total : 0;
      
      this.stats = {
        total_documents: total,
        status_breakdown: {
          completed,
          failed,
          processing,
          pending,
          needs_review: needsReview
        },
        type_breakdown: {},
        processing: {
          success_rate: successRate,
          avg_processing_time_seconds: 0,
          completed,
          failed,
          needs_review: needsReview
        },
        activity: {
          last_7_days: last7Days,
          today
        },
        storage: {
          total_mb: totalBytes / (1024 * 1024),
          avg_file_size_bytes: avgBytes
        }
      };
    } catch (error) {
      console.error('Failed to load stats:', error);
      
      // Set default stats on error
      this.stats = {
        total_documents: 0,
        status_breakdown: {},
        type_breakdown: {},
        processing: {
          success_rate: 0,
          avg_processing_time_seconds: 0,
          completed: 0,
          failed: 0,
          needs_review: 0
        },
        activity: {
          last_7_days: 0,
          today: 0
        },
        storage: {
          total_mb: 0,
          avg_file_size_bytes: 0
        }
      };
    }
  }

  getAvgPerDay(): number {
    if (!this.stats) return 0;
    return Math.round(this.stats.activity.last_7_days / 7);
  }

  formatAvgSize(): string {
    if (!this.stats) return '0 KB';
    const bytes = this.stats.storage.avg_file_size_bytes;
    const kb = bytes / 1024;
    const mb = kb / 1024;
    
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${kb.toFixed(0)} KB`;
  }
}