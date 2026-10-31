import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ImmRelationshipsComponent } from '../relationships/relationships.component';

const API = 'http://localhost:7979/api/immigration/graph';

/** Everyone with immigration documents, worst problems first; select a person to see how their documents connect. */
@Component({
  selector: 'app-imm-people',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ImmRelationshipsComponent],
  template: `
  <div class="pp">
    <header>
      <div>
        <h1>People &amp; documents</h1>
        <p>Every person named on your immigration documents, with the problems found between their documents. Blocking problems first.</p>
      </div>
      <label class="search"><span class="sr">Search people</span>
        <input type="search" [(ngModel)]="q" placeholder="Search name" /></label>
    </header>

    <div class="cols">
      <nav class="list" aria-label="People">
        <button *ngFor="let p of shown" type="button" class="person" [class.on]="p.person_key===key" (click)="open(p)">
          <span class="av">{{ initials(p.name) }}</span>
          <span class="who"><b>{{ p.name || 'Unnamed' }}</b>
            <small>{{ p.documents }} document{{ p.documents === 1 ? '' : 's' }}{{ p.client_id ? ' · client' : ' · not a client yet' }}</small></span>
          <span class="badge red" *ngIf="p.blockers">{{ p.blockers }}</span>
          <span class="badge amber" *ngIf="!p.blockers && p.warnings">{{ p.warnings }}</span>
        </button>
        <p class="muted" *ngIf="loaded && !people.length">No immigration documents yet. Upload a passport, I-94 or USCIS notice to start.</p>
      </nav>
      <section class="detail">
        <ng-container *ngIf="current">
          <h2>{{ current.name }}</h2>
          <app-imm-relationships [personKey]="current.person_key"></app-imm-relationships>
        </ng-container>
        <p class="muted" *ngIf="!current && people.length">Select a person.</p>
      </section>
    </div>
  </div>`,
  styles: [`
    .pp { padding: 24px 28px; display: flex; flex-direction: column; gap: 18px; color: #14171f; background: #f6f7f9; min-height: 100%; box-sizing: border-box; }
    header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
    h1 { margin: 0; font-size: 22px; font-weight: 600; } header p { margin: 4px 0 0; color: #5b6270; font-size: 13.5px; max-width: 70ch; }
    h2 { margin: 0 0 12px; font-size: 18px; font-weight: 600; }
    .search input { height: 34px; width: 260px; max-width: 100%; border: 1px solid #d5d9e0; border-radius: 7px; padding: 0 10px; font: inherit; font-size: 13.5px; background: #fff; }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .cols { display: flex; gap: 18px; align-items: flex-start; flex-wrap: wrap; }
    .list { flex: 1 1 260px; max-width: 300px; background: #fff; border: 1px solid #e4e7ec; border-radius: 10px; padding: 6px; display: flex; flex-direction: column; }
    .detail { flex: 999 1 560px; min-width: 0; }
    .person { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border: 0; background: none; border-radius: 8px; text-align: left; font: inherit; cursor: pointer; color: inherit; }
    .person:hover { background: #f1f3f6; } .person.on { background: #e8edfb; }
    .person:focus-visible { outline: 2px solid #2348c8; outline-offset: 1px; }
    .av { width: 30px; height: 30px; border-radius: 50%; background: #e8edfb; color: #1a3699; display: grid; place-items: center; font-size: 12px; font-weight: 600; flex: none; }
    .who { display: flex; flex-direction: column; flex: 1; min-width: 0; } .who b { font-size: 13.5px; font-weight: 600; } .who small { font-size: 12px; color: #5b6270; }
    .badge { min-width: 20px; height: 20px; border-radius: 10px; display: grid; place-items: center; font-size: 11.5px; font-weight: 700; padding: 0 6px; }
    .badge.red { background: #fdecea; color: #a8251b; } .badge.amber { background: #fdf1e3; color: #8a4b0f; }
    .muted { color: #5b6270; font-size: 13px; padding: 8px; margin: 0; }
  `],
})
export class ImmPeopleComponent implements OnInit {
  people: any[] = [];
  key = '';
  q = '';
  loaded = false;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef, private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    this.key = this.route.snapshot.queryParamMap.get('person') || '';
    this.load(true);
  }

  get shown() { const q = this.q.trim().toLowerCase(); return q ? this.people.filter(p => (p.name || '').toLowerCase().includes(q)) : this.people; }
  get current() { return this.people.find(p => p.person_key === this.key) || null; }

  load(retry = false): void {
    this.http.get<any>(`${API}/people`).subscribe({
      next: r => { this.people = r.people || []; this.loaded = true; if (!this.key && this.people.length) this.key = this.people[0].person_key; this.cdr.markForCheck(); },
      error: () => { if (retry) setTimeout(() => this.load(), 1500); },
    });
  }

  open(p: any): void {
    this.key = p.person_key;
    this.router.navigate([], { queryParams: { person: p.person_key }, replaceUrl: true });
  }

  initials(n: string) { return (n || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase(); }
}
