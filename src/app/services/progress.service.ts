import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { HttpClient } from '@angular/common/http';

export interface DocumentProgress {
  documentId: string;
  progress: number;
  stage: string;
  status: string;
  timestamp: number;
}

export interface ActiveTask {
  progress: number;
  stage: string;
  elapsed: number;
  eta: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class ProgressService {
  private progressSubjects = new Map<string, Subject<DocumentProgress>>();
  private activeProcessing = new BehaviorSubject<Set<string>>(new Set());
  
  constructor(private http: HttpClient) {}
  
  /**
   * Subscribe to progress updates for a specific document
   */
  watchProgress(documentId: string): Observable<DocumentProgress> {
    if (!this.progressSubjects.has(documentId)) {
      const subject = new Subject<DocumentProgress>();
      this.progressSubjects.set(documentId, subject);
      
      // Start SSE connection
      this.startProgressStream(documentId, subject);
      
      // Add to active processing
      const active = this.activeProcessing.value;
      active.add(documentId);
      this.activeProcessing.next(active);
    }
    
    return this.progressSubjects.get(documentId)!.asObservable();
  }
  
  /**
   * Get current progress status (one-time, non-streaming)
   */
  private baseUrl = 'http://localhost:8000';

  getProgressStatus(documentId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/documents/${documentId}/progress/status`);
  }
  
  /**
   * Get all active processing tasks
   */
  getActiveProcessing(): Observable<{ active_count: number; tasks: Record<string, ActiveTask> }> {
    return this.http.get<any>('/api/documents/progress/active');
  }
  
  /**
   * Observable of all document IDs currently being processed
   */
  get activeProcessing$(): Observable<Set<string>> {
    return this.activeProcessing.asObservable();
  }
  
  /**
   * Check if a specific document is being processed
   */
  isProcessing(documentId: string): boolean {
    return this.activeProcessing.value.has(documentId);
  }
  
  private startProgressStream(documentId: string, subject: Subject<DocumentProgress>) {
    const eventSource = new EventSource(`/api/documents/${documentId}/progress`);
    
    eventSource.onmessage = (event) => {
      try {
        const update: DocumentProgress = JSON.parse(event.data);
        subject.next(update);
        
        // If complete, cleanup
        if (update.progress >= 100 || update.stage === 'complete') {
          this.completeProcessing(documentId, eventSource, subject);
        }
      } catch (error) {
        console.error('Failed to parse progress update:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('SSE error for document:', documentId, error);
      eventSource.close();
      
      // Retry connection after delay
      setTimeout(() => {
        if (this.activeProcessing.value.has(documentId)) {
          this.startProgressStream(documentId, subject);
        }
      }, 2000);
    };
  }
  
  private completeProcessing(
    documentId: string,
    eventSource: EventSource,
    subject: Subject<DocumentProgress>
  ) {
    // Close SSE connection
    eventSource.close();
    
    // Complete the subject
    subject.complete();
    
    // Remove from active processing
    const active = this.activeProcessing.value;
    active.delete(documentId);
    this.activeProcessing.next(active);
    
    // Cleanup
    this.progressSubjects.delete(documentId);
  }
  
  /**
   * Manually stop watching progress for a document
   */
  stopWatching(documentId: string) {
    const subject = this.progressSubjects.get(documentId);
    if (subject) {
      subject.complete();
      this.progressSubjects.delete(documentId);
      
      const active = this.activeProcessing.value;
      active.delete(documentId);
      this.activeProcessing.next(active);
    }
  }
  
  /**
   * Cleanup all progress streams
   */
  cleanup() {
    this.progressSubjects.forEach((subject) => subject.complete());
    this.progressSubjects.clear();
    this.activeProcessing.next(new Set());
  }
}