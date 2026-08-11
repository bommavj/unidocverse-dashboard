import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';

@Component({
  selector: 'app-document-details',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatListModule,
    MatDividerModule
  ],
  templateUrl: './document-details.component.html',
  styleUrls: ['./document-details.component.scss']
})
export class DocumentDetailsComponent implements OnInit {
  @Input() documentId!: string;

  // Tab data
  summary: string = '';
  insights: any[] = [];
  keyPoints: any[] = [];
  classifications: any = null;
  details: any = null;

  // Pagination states
  insightsOffset = 0;
  insightsLimit = 3;
  insightsHasMore = false;
  insightsLoading = false;

  keyPointsOffset = 0;
  keyPointsLimit = 5;
  keyPointsHasMore = false;
  keyPointsLoading = false;

  loading = true;
  selectedTabIndex = 0;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadInitialData();
  }

  loadInitialData(): void {
    this.loading = true;
    
    // Load all tabs data in parallel
    Promise.all([
      this.loadSummary(),
      this.loadInsights(true),
      this.loadKeyPoints(true),
      this.loadClassifications(),
      this.loadDetails()
    ]).finally(() => {
      this.loading = false;
    });
  }

  // ===== SUMMARY =====
  async loadSummary(): Promise<void> {
    try {
      const response: any = await this.http.get(
        `http://localhost:8000/api/documents/${this.documentId}/summary`
      ).toPromise();
      
      this.summary = response.summary;
    } catch (error) {
      console.error('Error loading summary:', error);
      this.summary = 'Failed to load summary';
    }
  }

  // ===== INSIGHTS =====
  async loadInsights(reset: boolean = false): Promise<void> {
    if (reset) {
      this.insightsOffset = 0;
      this.insights = [];
    }

    this.insightsLoading = true;

    try {
      const response: any = await this.http.get(
        `http://localhost:8000/api/documents/${this.documentId}/insights`,
        {
          params: {
            limit: this.insightsLimit.toString(),
            offset: this.insightsOffset.toString()
          }
        }
      ).toPromise();

      this.insights = [...this.insights, ...response.insights];
      this.insightsHasMore = response.has_more;
      this.insightsOffset += response.insights.length;
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      this.insightsLoading = false;
    }
  }

  loadMoreInsights(): void {
    this.loadInsights(false);
  }

  // ===== KEY POINTS =====
  async loadKeyPoints(reset: boolean = false): Promise<void> {
    if (reset) {
      this.keyPointsOffset = 0;
      this.keyPoints = [];
    }

    this.keyPointsLoading = true;

    try {
      const response: any = await this.http.get(
        `http://localhost:8000/api/documents/${this.documentId}/key-points`,
        {
          params: {
            limit: this.keyPointsLimit.toString(),
            offset: this.keyPointsOffset.toString()
          }
        }
      ).toPromise();

      this.keyPoints = [...this.keyPoints, ...response.key_points];
      this.keyPointsHasMore = response.has_more;
      this.keyPointsOffset += response.key_points.length;
    } catch (error) {
      console.error('Error loading key points:', error);
    } finally {
      this.keyPointsLoading = false;
    }
  }

  loadMoreKeyPoints(): void {
    this.loadKeyPoints(false);
  }

  // ===== CLASSIFICATIONS =====
  async loadClassifications(): Promise<void> {
    try {
      this.classifications = await this.http.get(
        `http://localhost:8000/api/documents/${this.documentId}/classifications`
      ).toPromise();
    } catch (error) {
      console.error('Error loading classifications:', error);
    }
  }

  // ===== DETAILS =====
  async loadDetails(): Promise<void> {
    try {
      this.details = await this.http.get(
        `http://localhost:8000/api/documents/${this.documentId}/details`
      ).toPromise();
    } catch (error) {
      console.error('Error loading details:', error);
    }
  }
}