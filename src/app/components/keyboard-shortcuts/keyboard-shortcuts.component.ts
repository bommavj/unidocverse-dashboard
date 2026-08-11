import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
@Component({ selector: 'app-keyboard-shortcuts', standalone: true, imports: [CommonModule], templateUrl: './keyboard-shortcuts.component.html', styleUrls: ['./keyboard-shortcuts.component.scss'] })
export class KeyboardShortcutsComponent {
  isOpen = false;
  shortcuts = [
    { label:'Focus search',    keys:['⌘','K'] },{ label:'Upload files',    keys:['⌘','U'] },
    { label:'Close modal',     keys:['Esc']   },{ label:'Select all',      keys:['⌘','A'] },
    { label:'Navigate rows',   keys:['↑','↓'] },{ label:'Open selected',   keys:['Enter'] },
    { label:'Ask AI (global)', keys:['⌘','J'] },{ label:'Toggle timeline', keys:['⌘','T'] },
    { label:'Find similar',    keys:['⌘','S'] },{ label:'Export report',   keys:['⌘','E'] },
    { label:'Delete selected', keys:['⌘','⌫']},{ label:'Show shortcuts',  keys:['?']     },
  ];
  @HostListener('document:keydown',['$event'])
  onKey(e: KeyboardEvent): void {
    const tag = (document.activeElement as HTMLElement)?.tagName;
    if (['INPUT','TEXTAREA','SELECT'].includes(tag)) return;
    if (e.key==='?') this.isOpen=true;
    if (e.key==='Escape') this.isOpen=false;
  }
  close(): void { this.isOpen=false; }
}
