import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = 'http://localhost:8000/api';

  constructor(private http: HttpClient) {}

  get(path: string, params?: any): Observable<any> {
    let p = new HttpParams();
    if (params) Object.keys(params).forEach(k => { if (params[k] != null) p = p.set(k, params[k]); });
    return this.http.get(`${this.base}${path}`, { params: p });
  }
  post(path: string, body: any = {}): Observable<any> {
    return this.http.post(`${this.base}${path}`, body);
  }
  delete(path: string, params?: any): Observable<any> {
    let p = new HttpParams();
    if (params) Object.keys(params).forEach(k => { if (params[k] != null) p = p.set(k, params[k]); });
    return this.http.delete(`${this.base}${path}`, { params: p });
  }

  // ── documents ────────────────────────────────────────────
  getDocuments(filters: any = {}): Observable<any> { return this.get('/documents', filters); }
  getDocument(id: string | number): Observable<any> { return this.get(`/documents/${id}`); }
  getDocumentQaHistory(id: string | number, limit = 50): Observable<any> { return this.get(`/documents/${id}/qa-history?limit=${limit}`); }
  deleteDocument(id: string | number): Observable<any> { return this.delete(`/documents/${id}`); }
  deleteDocuments(ids: (string | number)[]): Observable<any> {
    return this.post('/documents/delete-bulk', { ids });
  }
  
  deleteAllDocuments(): Observable<any> { return this.delete('/documents/all', { confirm: true }); }

  // ── deep analyze (on-demand, each tab) ───────────────────
  deepSummary(id: string | number): Observable<any>              { return this.get(`/documents/${id}/analyze-deep/summary`); }
  deepKeyPoints(id: string | number, offset = 0, limit = 5): Observable<any> { return this.get(`/documents/${id}/analyze-deep/key-points`, { offset, limit }); }
  deepInsights(id: string | number, offset = 0, limit = 3): Observable<any>  { return this.get(`/documents/${id}/analyze-deep/insights`, { offset, limit }); }
  getDocumentInsights(id: string | number): Observable<any> {
    return this.get(`/insights/document/${id}`);
  }
  // ── ask ──────────────────────────────────────────────────
  askDocument(id: string | number, question: string): Observable<any> {
    return this.post(`/documents/${id}/ask`, { question });
  }

  // ── upload ───────────────────────────────────────────────
  uploadDocument(file: File, clientId?: string): Observable<any> {
    const fd = new FormData(); fd.append('file', file);
    const url = clientId ? `${this.base}/upload?client_id=${encodeURIComponent(clientId)}` : `${this.base}/upload`;
    return this.http.post(url, fd);
  }

  // ── research agent ───────────────────────────────────────
  researchDocs(): Observable<any> { return this.get('/research/docs'); }
  researchAsk(question: string, docIds?: string[]): Observable<any> {
    return this.post('/research/ask', { question, doc_ids: docIds || [] });
  }

  // ── search ───────────────────────────────────────────────
  search(query: string, limit = 10): Observable<any> {
    return this.post('/search/semantic', { query, limit });
  }

  // ── analytics ────────────────────────────────────────────
  getAnalyticsSummary(): Observable<any>                      { return this.get('/analytics/summary'); }
  getAdvancedAnalytics(id: string | number): Observable<any>  { return this.get(`/analytics/${id}/advanced-analytics`); }
  getAdvancedAnalyticsV2(id: string | number, analyzer?: string): Observable<any> {
    const path = analyzer
      ? `/analytics/${id}/${analyzer}`
      : `/analytics/${id}/advanced-analytics/v2`;
    return this.get(path);
  }

  // ── stats ────────────────────────────────────────────────
  getStats(): Observable<any> { return this.get('/documents/stats'); }

  // ── similar ──────────────────────────────────────────────
  similarDocuments(id: string | number, limit = 5): Observable<any> {
    // For now, omit query param; backend will use its default limit.
    return this.get(`/search/documents/${id}/similar`);
  }
}
