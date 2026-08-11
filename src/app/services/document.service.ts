// src/app/services/document.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Define interfaces separately
export interface DashboardMeta {
  title: string;
  description: string;
  record_count: number;
  document_type: string;
  data_characteristics?: string[];
}

export interface Insight {
  type: string;
  title: string;
  value: string;
  metric?: string;
  icon: string;
  dimension?: string;
}

export interface Visualization {
  type: string;
  title: string;
  subtitle?: string;
  data: any[];
  x_axis?: string;
  y_axis?: string;
  insight?: string;
  config?: any;
}

export interface DashboardAnalyzedData {
  dashboard: DashboardMeta;
  visualizations: Visualization[];
  insights: Insight[];
  statistics?: any;
  outliers?: any;
  segments?: any[];
  predictions?: any;
  data_quality?: any;
  column_metadata?: any;
}

export interface DashboardResponse {
  analyzed_data: DashboardAnalyzedData;
}

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private apiUrl = 'http://localhost:8000/api';

  constructor(private http: HttpClient) {}

  /**
   * Get advanced analytics V2 dashboard for a document
   */
  getAdvancedAnalyticsV2(documentId: string): Observable<DashboardResponse> {
    return this.http.get<DashboardResponse>(
      `${this.apiUrl}/analytics/${documentId}/advanced-analytics/v2`
    );
  }

  /**
   * Get all documents
   */
  getDocuments(skip: number = 0, limit: number = 100): Observable<any> {
    return this.http.get(`${this.apiUrl}/documents`, {
      params: { skip: skip.toString(), limit: limit.toString() }
    });
  }

  /**
   * Get a single document by ID
   */
  getDocument(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/documents/${id}`);
  }

  /**
   * Upload a document
   */
  uploadDocument(file: File, clientId?: string): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    const url = clientId
      ? `${this.apiUrl}/upload?client_id=${encodeURIComponent(clientId)}`
      : `${this.apiUrl}/upload`;
    return this.http.post(url, formData);
  }

  /**
   * Delete a document
   */
  deleteDocument(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/documents/${id}`);
  }

  /**
   * Download a document
   */
  downloadDocument(id: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/documents/${id}/download`, {
      responseType: 'blob'
    });
  }
}