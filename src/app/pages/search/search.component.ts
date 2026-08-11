import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { DocSheetComponent } from '../../components/doc-sheet/doc-sheet.component';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, DocSheetComponent],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent {
  query = '';
  results: any[] = [];
  selectedDoc: any = null;
  chips = ['bank statement balance','tax refund 2024','invoice payment terms','payoff amount'];

  constructor(private api: ApiService) {}

  loading = false;

  search(): void {
    if (!this.query.trim()) return;
    this.loading = true;
    this.results = [];
    this.api.search(this.query, 10).subscribe({
      next: (res: any) => {
        const raw = res.results || res || [];
        this.results = raw.map((d: any) => ({
          ...d,
          score: Math.round((d.similarity_score || d.score || 0.75) * 100)
        }));
        this.loading = false;
      },
      error: () => { this.results = []; this.loading = false; }
    });
  }

  openDoc(doc: any): void { this.selectedDoc = doc; }
  icoClass(t: string): string { const m: any={bank_statement:'bank',tax_document:'tax',payoff_statement:'pdf',invoice:'inv',credit_card_statement:'cc'}; return m[t]||'doc'; }
  icoTxt(t: string): string   { const m: any={bank_statement:'BNK',tax_document:'TAX',payoff_statement:'PDF',invoice:'INV',credit_card_statement:'CC'}; return m[t]||'DOC'; }
  badgeClass(t: string): string { const m: any={bank_statement:'bank',tax_document:'tax',payoff_statement:'pay',invoice:'inv',credit_card_statement:'cc'}; return m[t]||'doc'; }
}
