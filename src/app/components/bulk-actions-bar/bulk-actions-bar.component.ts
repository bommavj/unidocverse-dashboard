import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
@Component({ selector: 'app-bulk-actions-bar', standalone: true, imports: [CommonModule], templateUrl: './bulk-actions-bar.component.html', styleUrls: ['./bulk-actions-bar.component.scss'] })
export class BulkActionsBarComponent {
  @Input()  count = 0;
  @Output() moveFolder = new EventEmitter<void>();
  @Output() export     = new EventEmitter<void>();
  @Output() compare    = new EventEmitter<void>();
  @Output() delete     = new EventEmitter<void>();
  @Output() clear      = new EventEmitter<void>();
}
