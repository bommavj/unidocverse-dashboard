import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../services/toast.service';
export interface ExportFormat { id:string; label:string; desc:string; emoji:string; color:string; }
@Component({ selector:'app-export-modal', standalone:true, imports:[CommonModule], templateUrl:'./export-modal.component.html', styleUrls:['./export-modal.component.scss'] })
export class ExportModalComponent {
  @Input() isOpen = false;
  @Input() doc: any = null;
  @Output() closed = new EventEmitter<void>();
  selected = 'pdf';
  formats: ExportFormat[] = [
    { id:'pdf',  label:'PDF Report',    desc:'AI summary, key points, analytics charts', emoji:'📄', color:'#fef2f2' },
    { id:'csv',  label:'CSV / Excel',   desc:'Extracted entities and key metrics table',  emoji:'📊', color:'#f0fdf4' },
    { id:'json', label:'JSON',          desc:'Full structured extraction output',          emoji:'{ }',color:'#eff6ff' },
    { id:'md',   label:'Markdown',      desc:'Plain text summary for notes / docs',       emoji:'📝', color:'#f5f3ff' },
  ];
  constructor(private toast: ToastService) {}
  export(): void {
    const fmt = this.formats.find(f=>f.id===this.selected);
    const name = this.doc?.filename || this.doc?.name || 'document';
    this.closed.emit();
    this.toast.info(`Generating ${fmt?.label} for "${name}"…`);
    setTimeout(() => this.toast.success(`${fmt?.label} export ready — downloading`), 1800);
  }
}
