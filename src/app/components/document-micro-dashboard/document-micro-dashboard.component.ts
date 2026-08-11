import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';

@Component({
  selector: 'app-document-micro-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatExpansionModule
  ],
  template: `
    <mat-expansion-panel class="micro-dashboard" *ngIf="analytics">
      <mat-expansion-panel-header>
        <mat-panel-title>
          <mat-icon>analytics</mat-icon>
          <span>Document Analytics</span>
        </mat-panel-title>
        <mat-panel-description>
          {{ getQuickSummary() }}
        </mat-panel-description>
      </mat-expansion-panel-header>

      <div class="dashboard-content">
        <!-- Quick Insights -->
        <div class="insights-section" *ngIf="analytics.insights?.length > 0">
          <h4><mat-icon>lightbulb</mat-icon> Quick Insights</h4>
          <div class="insights-chips">
            <mat-chip *ngFor="let insight of analytics.insights" class="insight-chip">
              {{ insight }}
            </mat-chip>
          </div>
        </div>

        <!-- Financial Summary -->
        <div class="financial-section" *ngIf="analytics.financial_summary">
          <h4><mat-icon>attach_money</mat-icon> Financial Summary</h4>
          <div class="stats-grid">
            <div class="stat-item" *ngIf="analytics.financial_summary.total_amount">
              <span class="stat-label">Total Amount</span>
              <span class="stat-value">\${{ analytics.financial_summary.total_amount.toFixed(2) }}</span>
            </div>
            <div class="stat-item" *ngIf="analytics.financial_summary.tax">
              <span class="stat-label">Tax</span>
              <span class="stat-value">\${{ analytics.financial_summary.tax.toFixed(2) }}</span>
            </div>
            <div class="stat-item" *ngIf="analytics.financial_summary.total_credits">
              <span class="stat-label">Credits</span>
              <span class="stat-value positive">\${{ analytics.financial_summary.total_credits.toFixed(2) }}</span>
            </div>
            <div class="stat-item" *ngIf="analytics.financial_summary.total_debits">
              <span class="stat-label">Debits</span>
              <span class="stat-value negative">\${{ analytics.financial_summary.total_debits.toFixed(2) }}</span>
            </div>
          </div>
        </div>

        <!-- Document Stats -->
        <div class="stats-section" *ngIf="analytics.document_stats">
          <h4><mat-icon>description</mat-icon> Document Stats</h4>
          <div class="stats-grid compact">
            <div class="stat-item">
              <mat-icon>text_fields</mat-icon>
              <span>{{ analytics.document_stats.total_words?.toLocaleString() }} words</span>
            </div>
            <div class="stat-item">
              <mat-icon>timer</mat-icon>
              <span>{{ analytics.document_stats.reading_time_minutes }} min read</span>
            </div>
            <div class="stat-item" *ngIf="analytics.document_stats.numbers_found > 0">
              <mat-icon>pin</mat-icon>
              <span>{{ analytics.document_stats.numbers_found }} numbers</span>
            </div>
            <div class="stat-item" *ngIf="analytics.document_stats.dates_found > 0">
              <mat-icon>calendar_today</mat-icon>
              <span>{{ analytics.document_stats.dates_found }} dates</span>
            </div>
          </div>
        </div>

        <!-- Entities -->
        <div class="entities-section" *ngIf="hasEntities()">
          <h4><mat-icon>label</mat-icon> Extracted Entities</h4>
          <div class="entities-list">
            <div class="entity-group" *ngIf="analytics.entity_summary.companies?.length > 0">
              <span class="entity-label">Companies:</span>
              <mat-chip *ngFor="let company of analytics.entity_summary.companies.slice(0, 3)">
                {{ company }}
              </mat-chip>
            </div>
            <div class="entity-group" *ngIf="analytics.entity_summary.people?.length > 0">
              <span class="entity-label">People:</span>
              <mat-chip *ngFor="let person of analytics.entity_summary.people.slice(0, 3)">
                {{ person }}
              </mat-chip>
            </div>
            <div class="entity-group" *ngIf="analytics.entity_summary.emails?.length > 0">
              <span class="entity-label">Emails:</span>
              <mat-chip *ngFor="let email of analytics.entity_summary.emails.slice(0, 2)">
                {{ email }}
              </mat-chip>
            </div>
          </div>
        </div>

        <!-- Data Summary (for spreadsheets) -->
        <div class="data-section" *ngIf="analytics.data_summary?.row_count">
          <h4><mat-icon>table_chart</mat-icon> Data Summary</h4>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-label">Size</span>
              <span class="stat-value">{{ analytics.data_summary.estimated_size }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Tables</span>
              <span class="stat-value">{{ analytics.data_summary.table_count }}</span>
            </div>
          </div>
        </div>
      </div>
    </mat-expansion-panel>
  `,
  styles: [`
    .micro-dashboard {
      margin-top: 0.5rem;
      
      mat-expansion-panel-header {
        mat-panel-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          
          mat-icon {
            font-size: 20px;
            width: 20px;
            height: 20px;
            color: #1976d2;
          }
        }
      }
    }

    .dashboard-content {
      padding: 1rem 0;
      
      h4 {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 1rem 0 0.75rem 0;
        font-size: 0.95rem;
        font-weight: 600;
        color: #333;
        
        &:first-child {
          margin-top: 0;
        }
        
        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #666;
        }
      }
    }

    .insights-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      
      .insight-chip {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-size: 0.8rem;
      }
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      
      &.compact {
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      }
      
      .stat-item {
        background: #f5f5f5;
        padding: 0.75rem;
        border-radius: 6px;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        
        &.compact {
          flex-direction: row;
          align-items: center;
          gap: 0.5rem;
        }
        
        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: #666;
        }
        
        .stat-label {
          font-size: 0.75rem;
          color: #666;
          font-weight: 500;
        }
        
        .stat-value {
          font-size: 1.1rem;
          font-weight: 600;
          color: #333;
          
          &.positive {
            color: #4caf50;
          }
          
          &.negative {
            color: #f44336;
          }
        }
        
        span:not(.stat-label):not(.stat-value) {
          font-size: 0.85rem;
          color: #666;
        }
      }
    }

    .entities-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      
      .entity-group {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
        
        .entity-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: #666;
          min-width: 80px;
        }
        
        mat-chip {
          font-size: 0.75rem;
          background: #e3f2fd;
          color: #1976d2;
        }
      }
    }
  `]
})
export class DocumentMicroDashboardComponent {
  @Input() analytics: any;

  getQuickSummary(): string {
    if (!this.analytics) return '';
    
    const parts = [];
    
    if (this.analytics.document_stats?.total_words) {
      parts.push(`${this.analytics.document_stats.total_words.toLocaleString()} words`);
    }
    
    if (this.analytics.financial_summary?.total_amount) {
      parts.push(`$${this.analytics.financial_summary.total_amount.toFixed(2)}`);
    }
    
    if (this.analytics.insights?.length > 0) {
      parts.push(`${this.analytics.insights.length} insights`);
    }
    
    return parts.join(' • ') || 'View analytics';
  }

  hasEntities(): boolean {
    const entities = this.analytics?.entity_summary;
    if (!entities) return false;
    
    return (entities.companies?.length > 0) ||
           (entities.people?.length > 0) ||
           (entities.emails?.length > 0);
  }
}