import {
  Component, Input, Output, EventEmitter,
  ViewChild, ElementRef, OnChanges, SimpleChanges,
  ChangeDetectorRef, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

export interface Message { role: 'user' | 'ai'; text: string; }

interface CtxTab { label: string; icon: string; docType: string | null; count: number; }

@Component({
  selector: 'app-global-ask-ai',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './global-ask-ai.component.html',
  styleUrls: ['./global-ask-ai.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush   // explicit control
})
export class GlobalAskAiComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() initialQuery = '';
  @Output() closed = new EventEmitter<void>();
  @Output() openDoc = new EventEmitter<{ id: number; tab: string }>();
  @ViewChild('threadEl') threadEl!: ElementRef;

  query   = '';
  loading = false;
  msgCount = 1;
  messages: Message[] = [];

  // ── Real data ──────────────────────────────────────────────────────────────
  totalDocs  = 0;
  activeTab: string | null = null;   // null = All docs
  tabs: CtxTab[] = [];

  private readonly TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
    bank_statement:        { label: 'Bank Statements', icon: '🏦' },
    tax_document:          { label: 'Tax Documents',   icon: '📋' },
    tax_form:              { label: 'Tax Forms',       icon: '📋' },
    payoff_statement:      { label: 'Payoff Stmts',    icon: '💰' },
    invoice:               { label: 'Invoices',        icon: '🧾' },
    credit_card_statement: { label: 'Credit Cards',    icon: '💳' },
    sales_report:          { label: 'Sales Reports',   icon: '📈' },
    insurance:             { label: 'Insurance',       icon: '🛡️' },
    document:              { label: 'Documents',       icon: '📄' },
    legal:                 { label: 'Contracts',       icon: '📋' },
    medical:               { label: 'Medical',         icon: '🏥' },
    payroll:               { label: 'Payroll',         icon: '💵' },
  };

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      if (this.initialQuery) {
        this.query = this.initialQuery;
        this.loadDocs(true); // Skip greeting reset
        this.send();
        this.initialQuery = ''; // Clear it
      } else {
        this.loadDocs(false);
      }
    }
  }

  // ── Scroll to bottom without triggering change detection on every cycle ────
  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.threadEl) {
        this.threadEl.nativeElement.scrollTop = this.threadEl.nativeElement.scrollHeight;
      }
    }, 0);
  }

  loadDocs(skipResetMessages = false): void {
    this.api.getDocuments({}).subscribe({
      next: (res: any) => {
        const docs: any[] = Array.isArray(res) ? res : res.documents || [];
        this.totalDocs = docs.length;

        const typeCounts: Record<string, number> = {};
        for (const d of docs) {
          const t = d.doc_type || 'document';
          typeCounts[t] = (typeCounts[t] || 0) + 1;
        }

        this.tabs = Object.entries(typeCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([docType, count]) => {
            const cfg = this.TYPE_CONFIG[docType] || { label: docType.replace('_', ' '), icon: '📁' };
            return { label: cfg.label, icon: cfg.icon, docType, count };
          });

        if (!skipResetMessages) {
          this.messages = [{
            role: 'ai',
            text: `I have access to all <strong>${this.totalDocs} document${this.totalDocs === 1 ? '' : 's'}</strong> in your library. Ask me anything — totals, deadlines, comparisons, patterns, or risks across all your files.`
          }];
          this.msgCount = 1;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        if (!skipResetMessages) {
          this.messages = [{
            role: 'ai',
            text: 'I\'m ready to help. Ask me anything across your documents.'
          }];
        }
        this.cdr.detectChanges();
      }
    });
  }

  selectTab(docType: string | null): void {
    this.activeTab = docType;
    this.cdr.detectChanges();
  }

  send(): void {
    const q = this.query.trim();
    if (!q || this.loading) return;

    this.query   = '';
    this.loading = true;
    this.msgCount++;

    // Push user message
    this.messages.push({ role: 'user', text: q });

    // Push empty AI message — we will mutate .text in-place per token
    this.messages.push({ role: 'ai', text: '' });
    const aiIdx = this.messages.length - 1;

    this.cdr.detectChanges();
    this.scrollToBottom();

    fetch('http://localhost:8000/api/documents/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: q,
        ...(this.activeTab ? { doc_type: this.activeTab } : {})
      })
    })
      .then(res => {
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer    = '';

        const pump = (): Promise<void> =>
          reader.read().then(({ done, value }) => {
            if (done) {
              this.loading = false;
              this.cdr.detectChanges();
              this.scrollToBottom();
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              try {
                const p = JSON.parse(line.slice(6));

                if (p.token) {
                  // Mutate in-place — critical for OnPush + streaming
                  this.messages[aiIdx].text += p.token;
                  this.cdr.detectChanges();   // render this token NOW
                  this.scrollToBottom();
                }

                if (p.done) {
                  this.loading = false;
                  this.cdr.detectChanges();
                }

                if (p.error) {
                  this.messages[aiIdx].text = '⚠ ' + p.error;
                  this.loading = false;
                  this.cdr.detectChanges();
                }
              } catch { /* malformed SSE line — skip */ }
            }

            return pump();
          });

        return pump();
      })
      .catch(() => {
        this.messages[aiIdx] = {
          role: 'ai',
          text: 'Unable to connect to phi3:mini. Make sure the backend is running.'
        };
        this.loading = false;
        this.cdr.detectChanges();
      });
  }

  onKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.send();
    }
  }
}