import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
@Component({ selector:'app-detail-panel', standalone:true, imports:[CommonModule], templateUrl:'./detail-panel.component.html', styleUrls:['./detail-panel.component.scss'] })
export class DetailPanelComponent {
  @Input() doc: any = null;
  @Output() openDoc    = new EventEmitter<{id:number,tab:string}>();
  @Output() openSimilar= new EventEmitter<any>();
  @Output() openExport = new EventEmitter<any>();
  get insights(): any[] { return this.doc?.intelligence?.insights || this.doc?.insights || []; }
  get summary(): string { return (this.doc?.summary || this.doc?.intelligence?.summary || '').replace(/<[^>]+>/g,''); }
}
