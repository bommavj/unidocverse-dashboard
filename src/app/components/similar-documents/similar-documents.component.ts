import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

export interface SimilarDoc { id:number; name:string; type:string; score:number; tag:'similar'|'exact'; snippet:string; }

@Component({ selector:'app-similar-documents', standalone:true, imports:[CommonModule], templateUrl:'./similar-documents.component.html', styleUrls:['./similar-documents.component.scss'] })
export class SimilarDocumentsComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() sourceDoc: any = null;
  @Output() closed      = new EventEmitter<void>();
  @Output() openDoc     = new EventEmitter<number>();

  loading = false;
  results: SimilarDoc[] = [];

  constructor(private api: ApiService) {}

  ngOnChanges(): void {
    if (this.isOpen && this.sourceDoc) this.loadSimilar();
  }

  loadSimilar(): void {
    this.loading = true; this.results = [];
    this.api.get(`/documents/${this.sourceDoc.id}/similar`).subscribe({
      next: (res: any) => {
        this.results = (res.similar_documents || res || []).map((d: any) => ({
          id: d.id, name: d.filename || d.name,
          type: d.document_type || 'Document',
          score: Math.round((d.similarity_score || 0) * 100),
          tag: (d.similarity_score || 0) >= 0.9 ? 'exact' : 'similar',
          snippet: (d.summary || '').replace(/<[^>]+>/g,'').substring(0,200) + '…'
        }));
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }
}
