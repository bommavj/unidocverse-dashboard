import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
export interface Folder { id:string; name:string; emoji:string; count:number; color:string; }
@Component({ selector:'app-folder-grid', standalone:true, imports:[CommonModule], templateUrl:'./folder-grid.component.html', styleUrls:['./folder-grid.component.scss'] })
export class FolderGridComponent {
  @Input() folders: Folder[] = [];
  @Output() folderClicked = new EventEmitter<string>();
  @Output() newFolder     = new EventEmitter<void>();
}
