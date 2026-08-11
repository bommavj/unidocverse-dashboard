import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
@Component({ selector:'app-document-compare', standalone:true, imports:[CommonModule], templateUrl:'./document-compare.component.html', styleUrls:['./document-compare.component.scss'] })
export class DocumentCompareComponent {
  @Input() isOpen = false;
  @Input() docA: any = null;
  @Input() docB: any = null;
  @Output() closed = new EventEmitter<void>();
  @Output() openDoc = new EventEmitter<{id:number,tab:string}>();
  getSummary(d:any): string { return (d?.summary || d?.intelligence?.summary || '').replace(/<[^>]+>/g,''); }
  getInsights(d:any): any[] { return d?.intelligence?.insights || d?.insights || []; }
  getKP(d:any): string[] { return d?.intelligence?.key_points || d?.key_points || []; }
}
