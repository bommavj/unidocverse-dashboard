import { ChangeDetectorRef, Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

const API = 'http://localhost:7979/api/immigration/graph';

const LANES: { id: string; label: string; types: (t: string) => boolean }[] = [
  { id: 'identity', label: 'Identity & entry', types: t => ['passport', 'visa', 'i94'].includes(t) },
  { id: 'filings', label: 'Petitions & USCIS notices', types: t => t.startsWith('form_') || t.startsWith('i797') || ['lca', 'perm', 'i140_approval'].includes(t) },
  { id: 'cards', label: 'Cards', types: t => ['ead', 'green_card'].includes(t) },
  { id: 'status', label: 'Status — what lets them stay or work', types: t => t === 'status_period' },
];
const FIELDS: Record<string, string> = {
  name: 'Name', dob: 'Date of birth', a_number: 'A-number', passport_no: 'Passport number', receipt: 'Receipt number',
  i94_number: 'I-94 number', visa_class: 'Class', valid_from: 'Valid from', valid_to: 'Valid to', entry_date: 'Date of entry',
};
const CARD_W = 208, CARD_H = 84, GAP_X = 40, LANE_H = 136, PAD = 20, LABEL_H = 26;

interface Pending { kind: 'fact' | 'edge' | 'check' | 'use' | 'family' | 'famlink'; id: string; title: string; field?: string; value?: string; decision?: string; relation?: string; }
const RELATIONS = ['spouse', 'child', 'parent', 'sibling', 'fiance', 'relative'];

/**
 * A person's immigration documents as a graph: what each document proves, how they link, where they
 * disagree — and the lawyer's corrections. Every change asks for a reason and is kept in the history.
 */
@Component({
  selector: 'app-imm-relationships',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="rel" *ngIf="g">
    <div class="rel-top">
      <div class="facts-strip">
        <div class="fs" *ngIf="g.permanent"><span>Status</span><b>Permanent resident</b><small>does not expire; the card renews</small></div>
        <div class="fs" *ngIf="!g.permanent"><span>In status until</span><b>{{ statusUntil ? (statusUntil | date:'d MMM y') : '—' }}</b><small *ngIf="statusWhat">{{ statusWhat }}</small></div>
        <div class="fs" *ngIf="g.class"><span>Current status</span><b>{{ g.class }}</b></div>
        <div class="fs"><span>Documents</span><b>{{ docCount }}</b></div>
        <div class="fs"><span>Open problems</span><b [class.red]="openBlockers" [class.amber]="!openBlockers && openWarnings">{{ openBlockers + openWarnings }}</b><small>{{ openBlockers }} blocking · {{ openWarnings }} warnings</small></div>
      </div>
      <button class="btn ghost" (click)="rebuild()" [disabled]="busy">Re-check documents</button>
    </div>

    <section class="panel" *ngIf="openChecks.length || otherChecks.length">
      <h3>Problems to review</h3>
      <p class="muted" *ngIf="!openChecks.length">No open problems.</p>
      <div class="check" *ngFor="let c of openChecks" [class.blocker]="c.severity==='blocker'" [class.warning]="c.severity==='warning'">
        <span class="sev">{{ c.severity === 'blocker' ? 'Blocking' : c.severity === 'warning' ? 'Warning' : 'Info' }}</span>
        <div class="check-body">
          <div>{{ c.message }}</div>
          <div class="actions">
            <ng-container *ngIf="c.rule==='identity_mismatch'">
              <button class="btn sm" *ngFor="let o of c.details?.options" (click)="ask({kind:'use', id:c.id, value:o.value, title:'Use “' + o.value + '” on every document'})">Use “{{ o.value }}”</button>
            </ng-container>
            <button class="btn sm" *ngIf="c.node_ids?.length" (click)="select(c.node_ids[0])">Show document</button>
            <button class="btn sm ghost" (click)="ask({kind:'check', id:c.id, decision:'waive', title:'Waive this check'})">Waive…</button>
          </div>
        </div>
      </div>
      <details *ngIf="otherChecks.length" class="older">
        <summary>{{ otherChecks.length }} waived or resolved</summary>
        <div class="check done" *ngFor="let c of otherChecks">
          <span class="sev">{{ c.state === 'waived' ? 'Waived' : 'Resolved' }}</span>
          <div class="check-body"><div>{{ c.message }}</div>
            <div class="muted small" *ngIf="c.state==='waived'">By {{ c.decided_by }} · “{{ c.reason }}”</div>
            <div class="actions" *ngIf="c.state==='waived'"><button class="btn sm ghost" (click)="ask({kind:'check', id:c.id, decision:'reopen', title:'Reopen this check'})">Reopen</button></div>
          </div>
        </div>
      </details>
    </section>


    <section class="panel">
      <div class="row-h"><h3>Family</h3>
        <button class="btn sm ghost" *ngIf="!linking" (click)="startLink()">Link a family member</button></div>
      <div class="link-form" *ngIf="linking">
        <label>Person <select [(ngModel)]="linkTo"><option value="">Choose…</option>
          <option *ngFor="let p of linkable" [value]="p.person_key">{{ p.name || 'Unnamed' }}</option></select></label>
        <label>Relation <select [(ngModel)]="linkRel"><option *ngFor="let r of relations" [value]="r">{{ rel(r) }}</option></select></label>
        <button class="btn sm" [disabled]="!linkTo" (click)="ask({kind:'famlink', id:linkTo, relation:linkRel, title:'Link as ' + rel(linkRel)})">Continue</button>
        <button class="btn sm ghost" (click)="linking=false">Cancel</button>
      </div>
      <p class="muted small" *ngIf="!g.family?.length && !linking">No family members linked. A dependent's status (H-4, L-2, F-2 …) lasts only as long as the principal's, so link them to check both together.</p>
      <div class="fam" *ngFor="let f of g.family">
        <div class="fam-main">
          <b>{{ f.name || 'Unnamed' }}</b>
          <span class="pill">{{ rel(f.relation_view || f.relation) }}</span>
          <span class="muted small">{{ f.class || 'status unknown' }}{{ f.status_until ? ' · until ' + (f.status_until | date:'d MMM y') : '' }}</span>
          <span class="pill" [class.ok]="f.state==='confirmed'" [class.prop]="f.state==='proposed'">{{ f.state === 'proposed' ? 'suggested' : f.state }}</span>
        </div>
        <div class="muted small">{{ f.basis }}<span *ngIf="f.reason"> · “{{ f.reason }}”</span></div>
        <div class="actions">
          <ng-container *ngIf="f.state==='proposed'">
            <select class="rel-sel" [(ngModel)]="f.relation_view" aria-label="Relation"><option *ngFor="let r of relations" [value]="r">{{ rel(r) }}</option></select>
            <button class="btn sm" (click)="ask({kind:'family', id:f.id, decision:'confirm', relation:f.relation_view, title:'Confirm ' + (f.name || 'this person') + ' as ' + rel(f.relation_view)})">Confirm</button>
          </ng-container>
          <button class="btn sm ghost" (click)="ask({kind:'family', id:f.id, decision:'reject', title: f.state==='proposed' ? 'Not family' : 'Remove family link'})">{{ f.state==='proposed' ? 'Not family' : 'Remove link' }}</button>
        </div>
      </div>
    </section>

    <div class="reason-bar" *ngIf="pending" role="dialog" aria-label="Confirm change">
      <b>{{ pending.title }}</b>
      <input *ngIf="pending.kind==='fact'" [(ngModel)]="pending.value" [attr.aria-label]="'New ' + fieldLabel(pending.field)" placeholder="New value" />
      <input [(ngModel)]="reason" placeholder="Reason (kept in the case history)" aria-label="Reason" (keyup.enter)="commit()" />
      <button class="btn" (click)="commit()" [disabled]="busy">Save</button>
      <button class="btn ghost" (click)="pending=null; error=''">Cancel</button>
      <span class="err" *ngIf="error">{{ error }}</span>
    </div>

    <div class="layout">
      <section class="panel graph-wrap">
        <h3>How the documents connect</h3>
        <p class="muted small">Solid lines are confirmed (same receipt or I-94 number, or a document granting a status). Dashed lines are suggestions to confirm. Click a document to see and correct what was read.</p>
        <div class="graph-scroll">
          <div class="graph" [style.width.px]="width" [style.height.px]="height">
            <div class="lane" *ngFor="let l of lanesShown; let i = index" [style.top.px]="laneTop(i)" [style.width.px]="width - 8">
              <span>{{ l.label }}</span>
            </div>
            <svg [attr.width]="width" [attr.height]="height" class="edges" aria-hidden="true">
              <path *ngFor="let e of drawn" [attr.d]="e.d" [class.proposed]="e.state==='proposed'" [class.rejected]="e.state==='rejected'" />
            </svg>
            <button *ngFor="let n of placed" class="node" type="button" [style.left.px]="n.x" [style.top.px]="n.y"
                    [class.sel]="sel?.id===n.id" [class.status]="n.node_type==='status_period'"
                    [class.blocker]="flag[n.id]==='blocker'" [class.warning]="flag[n.id]==='warning'" (click)="select(n.id)">
              <span class="n-title">{{ n.label }}<span class="edited" *ngIf="edited(n)" title="Corrected by a lawyer">edited</span></span>
              <span class="n-sub">{{ sub(n) }}</span>
              <span class="n-file" *ngIf="n.filename">{{ n.filename }}</span>
            </button>
          </div>
        </div>
        <p class="muted" *ngIf="!placed.length">No immigration documents for this person yet.</p>
      </section>

      <aside class="panel side" *ngIf="sel">
        <div class="side-h"><h3>{{ sel.label }}</h3><button class="x" (click)="sel=null" aria-label="Close">×</button></div>
        <div class="muted small" *ngIf="sel.filename">{{ sel.filename }}</div>
        <table class="facts">
          <tr *ngFor="let f of factRows(sel)">
            <th>{{ f.label }}</th>
            <td><b>{{ f.value || '—' }}</b>
              <div class="was" *ngIf="f.changed">read as “{{ f.extracted || 'blank' }}” · {{ f.by }}: {{ f.reason }}</div></td>
            <td class="ed"><button class="btn sm ghost" *ngIf="sel.node_type!=='status_period'" (click)="ask({kind:'fact', id:sel.id, field:f.key, value:f.value, title:'Correct ' + f.label})">Edit</button></td>
          </tr>
        </table>
        <button class="btn sm ghost add" *ngIf="sel.node_type!=='status_period'" (click)="addField()">Add a missing fact…</button>
        <h4>Links</h4>
        <p class="muted small" *ngIf="!links(sel).length">Not linked to other documents.</p>
        <div class="link" *ngFor="let e of links(sel)">
          <div><b>{{ e.edge_type === 'grants' ? 'Grants' : e.edge_type === 'supersedes' ? 'Replaces' : 'Linked to' }}</b> {{ other(e) }}
            <span class="pill" [class.ok]="e.state==='confirmed'" [class.prop]="e.state==='proposed'" [class.no]="e.state==='rejected'">{{ e.state }}</span></div>
          <div class="muted small">{{ e.basis }}<span *ngIf="e.reason"> · “{{ e.reason }}”</span></div>
          <div class="actions" *ngIf="e.state!=='rejected'">
            <button class="btn sm" *ngIf="e.state==='proposed'" (click)="ask({kind:'edge', id:e.id, decision:'confirm', title:'Confirm this link'})">Confirm</button>
            <button class="btn sm ghost" (click)="ask({kind:'edge', id:e.id, decision:'reject', title:'Remove this link'})">Not related</button>
          </div>
        </div>
      </aside>
    </div>

    <details class="panel history" *ngIf="g.log?.length">
      <summary>Change history ({{ g.log.length }})</summary>
      <div class="hrow" *ngFor="let l of g.log"><span>{{ l.at | date:'d MMM, HH:mm' }}</span><span>{{ l.actor }}</span><span>{{ actionLabel(l.action) }}</span><span class="muted">{{ l.reason }}</span></div>
    </details>
  </div>
  <p class="muted" *ngIf="!g && !loading">No immigration documents found.</p>`,
  styles: [`
    .rel { display: flex; flex-direction: column; gap: 14px; color: #14171f; font-size: 13.5px; }
    .rel-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
    .facts-strip { display: flex; gap: 10px; flex-wrap: wrap; }
    .fs { background: #fff; border: 1px solid #e4e7ec; border-radius: 10px; padding: 10px 14px; display: flex; flex-direction: column; gap: 2px; min-width: 150px; }
    .fs span { font-size: 12px; color: #5b6270; } .fs b { font-size: 18px; font-variant-numeric: tabular-nums; } .fs small { font-size: 12px; color: #5b6270; }
    .fs b.red { color: #a8251b; } .fs b.amber { color: #8a4b0f; }
    .panel { background: #fff; border: 1px solid #e4e7ec; border-radius: 10px; padding: 14px 16px; }
    .panel h3 { margin: 0 0 8px; font-size: 14px; font-weight: 600; } .panel h4 { margin: 14px 0 6px; font-size: 13px; }
    .muted { color: #5b6270; margin: 0; } .small { font-size: 12.5px; }
    .btn { display: inline-flex; align-items: center; height: 32px; padding: 0 12px; border-radius: 7px; border: 1px solid #2348c8; background: #2348c8; color: #fff; font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; }
    .btn.ghost { background: #fff; color: #2348c8; border-color: #d5d9e0; } .btn.sm { height: 28px; padding: 0 10px; font-size: 12.5px; }
    .btn:disabled { opacity: .5; cursor: default; } .btn:focus-visible, .node:focus-visible { outline: 2px solid #2348c8; outline-offset: 2px; }
    .check { display: flex; gap: 12px; padding: 10px 0; border-top: 1px solid #f0f2f5; }
    .check:first-of-type { border-top: 0; }
    .sev { flex: 0 0 72px; height: 22px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; font-size: 12px; font-weight: 600; background: #f1f3f6; color: #3d4350; }
    .check.blocker .sev { background: #fdeceA; color: #a8251b; } .check.warning .sev { background: #fdf1e3; color: #8a4b0f; }
    .check.done .sev { background: #eef0f3; color: #5b6270; } .check.done .check-body > div:first-child { color: #5b6270; }
    .check-body { display: flex; flex-direction: column; gap: 6px; line-height: 1.45; }
    .actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .older summary { cursor: pointer; font-size: 12.5px; color: #5b6270; margin-top: 8px; }
    .reason-bar { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); width: min(820px, calc(100vw - 32px)); box-sizing: border-box; box-shadow: 0 8px 28px rgba(20,23,31,.16); z-index: 50; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 10px 14px; background: #f3f6fe; border: 1px solid #c9d5f5; border-radius: 10px; }
    .reason-bar input { height: 32px; border: 1px solid #d5d9e0; border-radius: 7px; padding: 0 10px; font: inherit; font-size: 13px; min-width: 200px; flex: 1 1 200px; }
    .err { color: #a8251b; font-size: 12.5px; }
    .layout { display: flex; gap: 14px; align-items: flex-start; flex-wrap: wrap; }
    .graph-wrap { flex: 999 1 520px; min-width: 0; } .side { flex: 1 1 320px; max-width: 380px; position: sticky; top: 12px; }
    .graph-scroll { overflow-x: auto; margin-top: 8px; }
    .graph { position: relative; }
    .lane { position: absolute; left: 0; height: ${LANE_H - 12}px; background: #f6f7f9; border-radius: 8px; }
    .lane span { position: absolute; left: 12px; top: 6px; font-size: 11.5px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: #5b6270; }
    .edges { position: absolute; left: 0; top: 0; pointer-events: none; }
    .edges path { fill: none; stroke: #2348c8; stroke-width: 1.75; stroke-linejoin: round; } .edges path.proposed { stroke: #8a919e; stroke-dasharray: 5 5; } .edges path.rejected { display: none; }
    .node { position: absolute; width: ${CARD_W}px; height: ${CARD_H}px; box-sizing: border-box; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; text-align: left;
            background: #fff; border: 1.5px solid #c9d5f5; border-radius: 10px; font: inherit; cursor: pointer; overflow: hidden; }
    .node.status { border-color: #1a3699; border-width: 2px; background: #f3f6fe; }
    .node.warning { border-color: #c46a12; background: #fff8ee; } .node.blocker { border-color: #c2341f; background: #fdf2f1; }
    .node.sel { box-shadow: 0 0 0 3px #dce4f9; }
    .n-title { font-weight: 600; font-size: 13px; display: flex; gap: 6px; align-items: center; }
    .edited { font-size: 10.5px; font-weight: 600; color: #4b3ba3; background: #eae6f8; border-radius: 4px; padding: 0 5px; }
    .n-sub { font-size: 12.5px; color: #3d4350; } .n-file { font-size: 11.5px; color: #5b6270; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .side-h { display: flex; justify-content: space-between; align-items: center; }
    .x { border: 0; background: none; font-size: 20px; cursor: pointer; color: #5b6270; }
    .facts { width: 100%; border-collapse: collapse; margin-top: 10px; }
    .facts th { text-align: left; font-weight: 500; color: #5b6270; font-size: 12.5px; padding: 7px 8px 7px 0; vertical-align: top; width: 38%; border-top: 1px solid #f0f2f5; }
    .facts td { padding: 7px 0; border-top: 1px solid #f0f2f5; vertical-align: top; } .facts td.ed { text-align: right; width: 56px; }
    .was { font-size: 11.5px; color: #4b3ba3; margin-top: 2px; }
    .add { margin-top: 8px; }
    .link { padding: 8px 0; border-top: 1px solid #f0f2f5; display: flex; flex-direction: column; gap: 4px; }
    .pill { margin-left: 6px; font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 999px; background: #f1f3f6; color: #3d4350; }
    .pill.ok { background: #e6f4ec; color: #1f6b45; } .pill.prop { background: #f1f3f6; color: #3d4350; } .pill.no { background: #fdecea; color: #a8251b; }
    .row-h { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    .link-form { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; margin: 6px 0 10px; }
    .link-form label { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; color: #5b6270; }
    .link-form select, .rel-sel { height: 30px; border: 1px solid #d5d9e0; border-radius: 7px; padding: 0 8px; font: inherit; font-size: 13px; background: #fff; color: #14171f; }
    .fam { padding: 10px 0; border-top: 1px solid #f0f2f5; display: flex; flex-direction: column; gap: 5px; }
    .fam-main { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .history summary { cursor: pointer; font-weight: 600; font-size: 13.5px; }
    .hrow { display: grid; grid-template-columns: 110px 120px 140px 1fr; gap: 10px; padding: 6px 0; border-top: 1px solid #f0f2f5; font-size: 12.5px; }
  `],
})
export class ImmRelationshipsComponent implements OnChanges {
  @Input() clientId = '';
  @Input() personKey = '';
  g: any = null;
  loading = false;
  busy = false;
  sel: any = null;
  pending: Pending | null = null;
  reason = '';
  error = '';
  placed: any[] = [];
  drawn: any[] = [];
  lanesShown = LANES;
  flag: Record<string, string> = {};
  width = 600; height = 200;
  statusUntil = ''; statusWhat = '';
  relations = RELATIONS;
  linking = false;
  linkTo = '';
  linkRel = 'spouse';
  linkable: any[] = [];

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnChanges(): void { this.load(true); }

  get docCount() { return (this.g?.nodes || []).filter((n: any) => n.node_type !== 'status_period').length; }
  get openChecks() { return (this.g?.checks || []).filter((c: any) => c.state === 'open'); }
  get otherChecks() { return (this.g?.checks || []).filter((c: any) => c.state !== 'open'); }
  get openBlockers() { return this.openChecks.filter((c: any) => c.severity === 'blocker').length; }
  get openWarnings() { return this.openChecks.filter((c: any) => c.severity === 'warning').length; }

  load(retry = false): void {
    if (!this.clientId && !this.personKey) return;
    this.loading = true;
    const q = this.clientId ? `client_id=${encodeURIComponent(this.clientId)}` : `key=${encodeURIComponent(this.personKey)}`;
    this.http.get<any>(`${API}/person?${q}`).subscribe({
      next: g => this.set(g),
      error: () => { this.loading = false; if (retry) setTimeout(() => this.load(), 1500); this.cdr.markForCheck(); },
    });
  }

  private set(g: any): void {
    this.loading = false;
    this.g = g && g.nodes?.length ? g : null;
    if (this.g) this.layout();
    if (this.sel) this.sel = (this.g?.nodes || []).find((n: any) => n.id === this.sel.id) || null;
    this.cdr.markForCheck();
  }

  private layout(): void {
    const nodes = this.g.nodes;
    this.lanesShown = LANES.filter(l => nodes.some((n: any) => l.types(n.node_type)));
    const other = nodes.filter((n: any) => !LANES.some(l => l.types(n.node_type)));
    if (other.length) this.lanesShown = [...this.lanesShown.slice(0, 2), { id: 'other', label: 'Other documents', types: () => false }, ...this.lanesShown.slice(2)];
    const pos: Record<string, any> = {};
    let cols = 1;
    const colX = (j: number) => PAD + j * (CARD_W + GAP_X);
    const grantedBy: Record<string, string> = {};
    for (const e of this.g.edges || []) if (e.edge_type === 'grants') grantedBy[e.to_node] = e.from_node;
    this.lanesShown.forEach((l, i) => {
      const inLane = l.id === 'other' ? other : nodes.filter((n: any) => l.types(n.node_type));
      const used = new Set<number>();
      // a status sits under the document that grants it, so the line between them is straight
      const order = [...inLane].sort((a: any, b: any) => (grantedBy[a.id] ? 0 : 1) - (grantedBy[b.id] ? 0 : 1));
      for (const n of order) {
        const src = pos[grantedBy[n.id]];
        let j = src ? Math.round((src.x - PAD) / (CARD_W + GAP_X)) : 0;
        while (used.has(j)) j++;
        used.add(j);
        cols = Math.max(cols, j + 1);
        pos[n.id] = { ...n, x: colX(j), y: this.laneTop(i) + LABEL_H };
      }
    });
    this.placed = Object.values(pos);
    this.width = Math.max(600, PAD * 2 + cols * CARD_W + (cols - 1) * GAP_X);
    this.height = this.lanesShown.length * LANE_H;
    // right-angled connectors through the gaps between lanes and columns, never across a card
    this.drawn = (this.g.edges || []).filter((e: any) => pos[e.from_node] && pos[e.to_node]).map((e: any, k: number) => {
      const a = pos[e.from_node], b = pos[e.to_node];
      if (a.y === b.y) {
        const [l, r] = a.x < b.x ? [a, b] : [b, a];
        const y = l.y + CARD_H + 10 + (k % 3) * 4;
        return { state: e.state, d: `M ${l.x + CARD_W / 2} ${l.y + CARD_H} V ${y} H ${r.x + CARD_W / 2} V ${r.y + CARD_H}` };
      }
      const [t, d] = a.y < b.y ? [a, b] : [b, a];
      const x1 = t.x + CARD_W / 2, x2 = d.x + CARD_W / 2;
      if (x1 === x2) return { state: e.state, d: `M ${x1} ${t.y + CARD_H} V ${d.y}` };
      const mid = d.y - LABEL_H - 6 + ((k % 3) - 1) * 2;      // in the gap between lanes, clear of the lane label
      return { state: e.state, d: `M ${x1} ${t.y + CARD_H} V ${mid} H ${x2} V ${d.y}` };
    });
    this.flag = {};
    for (const c of this.openChecks) for (const id of c.node_ids || []) {
      if (this.flag[id] !== 'blocker') this.flag[id] = c.severity === 'info' ? this.flag[id] : c.severity;
    }
    const st = nodes.filter((n: any) => n.node_type === 'status_period' && n.valid_to).sort((a: any, b: any) => a.valid_to.localeCompare(b.valid_to));
    const live = st.filter((n: any) => n.valid_to >= new Date().toISOString().slice(0, 10));
    const governing = live.find((n: any) => n.label.includes('I-94')) || live[0];
    this.statusUntil = governing?.valid_to || ''; this.statusWhat = governing?.label || '';
    if (this.g.limited_by && this.g.status_until && (!this.statusUntil || this.g.status_until < this.statusUntil)) {
      this.statusUntil = this.g.status_until; this.statusWhat = `limited by ${this.g.limited_by}`;
    }
  }

  laneTop(i: number) { return i * LANE_H; }
  val(n: any, k: string) { const f = n.facts?.[k]; return f && typeof f === 'object' ? f.value : f; }
  fieldLabel(k?: string) { return FIELDS[k || ''] || k || ''; }
  edited(n: any) { return Object.values(n.facts || {}).some((f: any) => f && f.set_by); }
  sub(n: any): string {
    const to = this.val(n, 'valid_to'), r = this.val(n, 'receipt'), c = this.val(n, 'visa_class');
    const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return [c, r, to ? `to ${fmt(to)}` : ''].filter(Boolean).join(' · ') || this.val(n, 'name') || '';
  }
  factRows(n: any) {
    return Object.keys(FIELDS).filter(k => n.facts?.[k] !== undefined).map(k => {
      const f = n.facts[k] || {};
      return { key: k, label: FIELDS[k], value: f.value, extracted: f.extracted, changed: !!f.set_by, by: f.set_by, reason: f.reason };
    });
  }
  addField(): void {
    const missing = Object.keys(FIELDS).find(k => this.sel.facts?.[k] === undefined) || 'dob';
    this.ask({ kind: 'fact', id: this.sel.id, field: missing, value: '', title: `Add ${FIELDS[missing]}` });
  }
  links(n: any) { return (this.g?.edges || []).filter((e: any) => e.from_node === n.id || e.to_node === n.id); }
  other(e: any) {
    const id = e.from_node === this.sel?.id ? e.to_node : e.from_node;
    return (this.g.nodes.find((n: any) => n.id === id) || {}).label || 'document';
  }
  select(id: string) { this.sel = this.g.nodes.find((n: any) => n.id === id) || null; this.cdr.markForCheck(); }
  actionLabel(a: string) {
    return ({ correct_fact: 'Corrected a fact', confirm_link: 'Confirmed a link', reject_link: 'Removed a link', relink_link: 'Re-linked',
              waive_check: 'Waived a check', reopen_check: 'Reopened a check', link_family: 'Linked a family member',
              confirm_family: 'Confirmed a family link', reject_family: 'Removed a family link' } as any)[a] || a;
  }

  rel(r: string) { return ({ spouse: 'Spouse', child: 'Child', parent: 'Parent', sibling: 'Sibling', fiance: 'Fiancé(e)', relative: 'Relative' } as any)[r] || r; }

  startLink(): void {
    this.linking = true; this.linkTo = ''; this.linkRel = 'spouse';
    const linked = new Set((this.g.family || []).map((f: any) => f.other));
    this.http.get<any>(`${API}/people`).subscribe(r => {
      this.linkable = (r.people || []).filter((p: any) => p.person_key !== this.g.person_key && !linked.has(p.person_key));
      this.cdr.markForCheck();
    });
  }

  ask(p: Pending): void { this.pending = { ...p }; this.reason = ''; this.error = ''; this.cdr.markForCheck(); }

  commit(): void {
    const p = this.pending; if (!p) return;
    this.busy = true; this.error = '';
    const req = p.kind === 'fact' ? this.http.post(`${API}/nodes/${p.id}/facts`, { field: p.field, value: p.value, reason: this.reason })
      : p.kind === 'edge' ? this.http.post(`${API}/edges/${p.id}`, { decision: p.decision, reason: this.reason })
      : p.kind === 'use' ? this.http.post(`${API}/checks/${p.id}`, { decision: 'use_value', value: p.value, reason: this.reason })
      : p.kind === 'family' ? this.http.post(`${API}/family/${p.id}`, { decision: p.decision, relation: p.relation, reason: this.reason, viewer: this.g.person_key })
      : p.kind === 'famlink' ? this.http.post(`${API}/family`, { person_a: this.g.person_key, person_b: p.id, relation: p.relation, reason: this.reason })
      : this.http.post(`${API}/checks/${p.id}`, { decision: p.decision, reason: this.reason });
    req.subscribe({
      next: g => { this.busy = false; this.pending = null; this.linking = false; this.set(g); },
      error: e => { this.busy = false; this.error = e?.error?.detail || 'Could not save.'; this.cdr.markForCheck(); },
    });
  }

  rebuild(): void {
    this.busy = true;
    this.http.post(`${API}/rebuild`, {}).subscribe({ next: () => { this.busy = false; this.load(); }, error: () => { this.busy = false; } });
  }
}
