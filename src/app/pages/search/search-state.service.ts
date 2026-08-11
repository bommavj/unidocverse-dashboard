import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SearchStateService {
  private highlightedIdSubject = new BehaviorSubject<string | null>(null);
  highlightedId$ = this.highlightedIdSubject.asObservable();

  highlightDocument(documentId: string): void {
    console.log('🎯 Highlighting document:', documentId); // ✅ Debug log
    this.highlightedIdSubject.next(documentId);
    
    // Auto-clear after 5 seconds
    setTimeout(() => {
      if (this.highlightedIdSubject.value === documentId) {
        console.log('⏰ Auto-clearing highlight'); // ✅ Debug log
        this.clearHighlight();
      }
    }, 5000);
  }

  clearHighlight(): void {
    console.log('🧹 Clearing highlight'); // ✅ Debug log
    this.highlightedIdSubject.next(null);
  }
}