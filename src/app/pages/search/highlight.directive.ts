import { Directive, Input, ElementRef, Renderer2, OnInit, OnDestroy } from '@angular/core';
import { SearchStateService } from './search-state.service';
import { Subscription } from 'rxjs';

@Directive({
  selector: '[appHighlightDoc]',
  standalone: true  // ✅ Add this line
})
export class HighlightDocDirective implements OnInit, OnDestroy {
  @Input('appHighlightDoc') docId!: string;
  private sub!: Subscription;

  constructor(
    private el: ElementRef, 
    private renderer: Renderer2, 
    private searchState: SearchStateService
  ) {}

  ngOnInit() {
    this.sub = this.searchState.highlightedId$.subscribe(id => {
      if (id && id === this.docId) {
        this.applyHighlight();
      } else {
        this.removeHighlight();
      }
    });
  }

  private applyHighlight() {
    // 1. Scroll into view
    this.el.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // 2. Apply "Pulse" Styles directly to override Material defaults
    this.renderer.setStyle(this.el.nativeElement, 'border', '3px solid #673ab7');
    this.renderer.setStyle(this.el.nativeElement, 'box-shadow', '0 0 20px rgba(103, 58, 183, 0.6)');
    this.renderer.setStyle(this.el.nativeElement, 'transform', 'scale(1.03)');
    this.renderer.setStyle(this.el.nativeElement, 'transition', 'all 0.5s ease');
    this.renderer.addClass(this.el.nativeElement, 'highlight-active');
  }

  private removeHighlight() {
    this.renderer.removeStyle(this.el.nativeElement, 'border');
    this.renderer.removeStyle(this.el.nativeElement, 'box-shadow');
    this.renderer.removeStyle(this.el.nativeElement, 'transform');
    this.renderer.removeClass(this.el.nativeElement, 'highlight-active');
  }

  ngOnDestroy() { if (this.sub) this.sub.unsubscribe(); }
}