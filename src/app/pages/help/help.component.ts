import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FeatureFlagService } from '../../services/feature-flag.service';

interface Topic { id: string; title: string; group: string; link?: string; flag?: string; body: string[]; }

const TOPICS: Topic[] = [
  { id: 'start', group: 'Getting started', title: 'First steps', link: '/upload', body: [
    'Upload documents from Upload (PDF, Word, Excel, images, email). Scanned PDFs are read with OCR automatically.',
    'Each document is classified, its key facts (names, amounts, dates) are extracted and it becomes searchable.',
    'Ask questions in Research. Answers cite the documents they came from — open the citation to check the figure.',
    'Everything runs on this computer by default. Nothing leaves your network unless an admin turns on a cloud model.'] },
  { id: 'brief', group: 'Getting started', title: "Today's brief", link: '/dashboard', body: [
    'Every morning at 07:00 the brief lists what needs a person today: lapsed policies, expiring visas, deadlines, approvals waiting — only for the modules your organisation has switched on.',
    'Each item names who it is about and links to where you handle it. "New" marks items that were not in yesterday\'s brief; the count of resolved items shows what dropped off.',
    'Admins also get it by email when outgoing mail (SMTP) is set up in Settings, and integrations receive a brief.ready webhook.',
    'Use "Check again" on Home to rebuild it after you have made changes.'] },
  { id: 'upload', group: 'Documents', title: 'Uploading and duplicates', link: '/upload', body: [
    'Files identical to one already in your organisation are flagged as duplicates. Choose "Skip" or "Upload anyway".',
    'Watch folders import new files from a folder on this computer automatically.'] },
  { id: 'search', group: 'Documents', title: 'Search and Research', link: '/research', body: [
    'Search finds documents by words and meaning. Research answers a question by reading the relevant documents in full where they fit.',
    'If an answer has no source, or a number does not appear in the cited document, the answer says so instead of guessing.',
    'Mention a file name or a person to narrow the question to their documents.'] },
  { id: 'approvals', group: 'Documents', title: 'Approvals', link: '/approvals', body: [
    'When the research agent wants to create or change something, it asks you right in the chat — Confirm or Cancel. If you leave without answering, nothing happens and the request lapses after a day.',
    'For sign-off between people, send a document for approval and choose the approvers. The Approvals icon appears in the top bar only while something is waiting for you.',
    'Only listed approvers (or an admin) can decide. Every decision is recorded in the audit trail.'] },
  { id: 'clm', group: 'Documents', title: 'Contract lifecycle', link: '/clm', flag: 'clm', body: [
    'Track contracts from draft to review, approval, active and expiring. Moving a contract to "pending approval" creates an approval request; the decision moves it on.',
    'Contracts approaching their end date move to "expiring" automatically each night.'] },
  { id: 'insurance', group: 'Modules', title: 'Insurance agency', link: '/renewals', flag: 'insurance', body: [
    'Renewals shows policies by days to expiry. Lapsed policies, stalled renewals and expiring certificates appear in the brief.',
    'Send a renewal reminder to the client from the policy; it uses your organisation\'s outgoing mail.'] },
  { id: 'immigration', group: 'Modules', title: 'Immigration', link: '/immigration', flag: 'immigration', body: [
    'Visa and status documents (I-797, I-94, EAD, passports) are tracked by expiry. Expired and soon-to-expire items appear in the brief with the person and document named.'] },
  { id: 'legal', group: 'Modules', title: 'Legal matters', link: '/matters', flag: 'legal', body: [
    'Matters, deadlines in the next 14 days and matters idle for 30 days are tracked and appear in the brief.'] },
  { id: 'recommended', group: 'Getting started', title: 'Recommended models (best accuracy)', link: '/integrations', body: [
    'Answers: mistral:7b (in Terminal: ollama pull mistral:7b), or a cloud model added in Integrations. Needs 8 GB of memory or more.',
    'Forms and charts: the vision model gemma4 (ollama pull gemma4, about 10 GB, needs 16 GB of memory or more). It reads W-2 and 1099 boxes, passports and chart values at upload, and every value is checked against the page.',
    'Without the vision model, forms and charts are read as plain text only. Questions about a chart then say which values weren\'t read instead of guessing.',
    'After installing a model, reprocess documents uploaded before (Documents → 🔄) so they are read again. Choose which model does each step in Integrations → Model roles.'] },
  { id: 'models', group: 'AI models', title: 'Local and cloud models', link: '/integrations', body: [
    'By default answers come from the model running on this computer. Admins can add a cloud provider (Anthropic, OpenAI, Gemini and others) with their own key in Integrations.',
    'With a cloud model active, the local model answers first; the cloud is used only when the local answer can\'t be backed by your documents.',
    'Data protection settings decide which document types may never be sent, mask identifiers before sending, require consent and cap monthly spend. Every cloud call is logged.'] },
  { id: 'web', group: 'Connect', title: 'Web search', link: '/research', body: [
    'An admin can let Research also search the web through the organisation\'s own SearxNG server (Integrations → Web search). Then press 🌐 Web under the question box.',
    'Only the question\'s general topic is sent — names, ID numbers, amounts and document text are removed first, and the topic is written on this computer. Your documents never leave.',
    'Web results appear in their own "From the web" section with numbered links, separate from the answer from your documents.',
    'Every search is in the audit trail as research.web_search, with who asked, the exact words sent and the links that came back.'] },
  { id: 'integrations', group: 'Connect', title: 'Webhooks, QuickBooks, Salesforce and chat', link: '/integrations', body: [
    'Webhooks send signed events (document processed, approval decided, brief ready) to your systems.',
    'QuickBooks: connect once, then invoices become draft bills that post only after approval.',
    'Salesforce: connect once with a connected app, then send a document to the client\'s Account — the file is attached and a Task records the summary and key facts. Each send is reviewed and approved first.',
    'MCP lets assistants such as Claude Desktop use your documents with your permission.'] },
  { id: 'audit', group: 'Admin', title: 'Audit trail and retention', link: '/audit', body: [
    'Every change, deletion, sign-in and AI question is recorded and cannot be edited.',
    'Retention: choose how long to keep views and searches and how long to keep changes. Expired entries are archived to compressed files before removal. A legal hold pauses all cleanup.'] },
  { id: 'pilot', group: 'Admin', title: 'Pilot report', link: '/pilot-report', body: [
    'For organisations in the early-adopter program: at 30, 60 and 90 days, open Pilot report to see what this installation measured — documents processed, pages read, questions answered with a cited source, processing time and active users.',
    'Add your own feedback (minutes per document before and after, ratings, a testimonial) and choose whether it may be published as a case study. Time saved is calculated from your numbers.',
    'Save, then print to PDF or download JSON to share it. Nothing is sent automatically.'] },
  { id: 'modules', group: 'Admin', title: 'Turning modules on and off', link: '/settings', body: [
    'Settings → Features switches each industry module on or off. Menus, agents, workflows and the brief follow these switches, so people only see what applies to them.'] },
  { id: 'agents', group: 'Admin', title: 'Agent Queue', link: '/agent-builder', body: [
    'The Agent Queue is the record of every agent run — useful for admins checking what ran and why something failed. Day-to-day, use Today\'s brief instead.'] },
  { id: 'trouble', group: 'Help', title: 'Troubleshooting', link: '/report-issue', body: [
    'Can\'t sign in or uploads fail on the desktop app: make sure nothing else uses port 7979, then restart the app.',
    'An answer looks wrong: open the cited document and check the figure. Report it with Report issue so it can be fixed.',
    'Emails not arriving: check the outgoing mail settings and send a test from Settings.'] },
];

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
  <div class="help">
    <header class="ph">
      <h1>Help</h1>
      <p>How UniDocVerse works and where to find things.</p>
      <div class="q">
        <i class="ti ti-search"></i>
        <input [ngModel]="q()" (ngModelChange)="q.set($event)" placeholder="Search help" aria-label="Search help" />
        <button *ngIf="q()" (click)="q.set('')" aria-label="Clear search"><i class="ti ti-x"></i></button>
      </div>
    </header>
    <div class="cols">
      <nav class="toc">
        <ng-container *ngFor="let g of groups()">
          <h4>{{ g.name }}</h4>
          <a *ngFor="let t of g.topics" [href]="'#' + t.id" (click)="go($event, t.id)">{{ t.title }}</a>
        </ng-container>
      </nav>
      <main>
        <p class="none" *ngIf="!shown().length">No help topics match "{{ q() }}".</p>
        <section *ngFor="let t of shown()" [id]="t.id">
          <h2>{{ t.title }}</h2>
          <p *ngFor="let b of t.body">{{ b }}</p>
          <a *ngIf="t.link" class="open" [routerLink]="t.link">Open {{ t.title }} <i class="ti ti-arrow-right"></i></a>
        </section>
      </main>
    </div>
  </div>`,
  styles: [`
    .help { padding: 24px; max-width: 1100px; margin: 0 auto; }
    .ph h1 { margin: 0; font-size: 22px; } .ph p { margin: 4px 0 14px; color: #475467; }
    .q { display: flex; align-items: center; gap: 8px; border: 1px solid #d0d5dd; border-radius: 8px; padding: 6px 10px; max-width: 420px; background: #fff;
      input { border: 0; outline: 0; flex: 1; font: inherit; } button { border: 0; background: none; cursor: pointer; color: #667085; } }
    .cols { display: grid; grid-template-columns: 220px 1fr; gap: 32px; margin-top: 20px; }
    .toc { position: sticky; top: 16px; align-self: start; display: flex; flex-direction: column; gap: 4px;
      h4 { margin: 12px 0 2px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #667085; }
      a { color: #344054; text-decoration: none; font-size: 13.5px; padding: 2px 0; } a:hover { color: #1570ef; } }
    main { display: flex; flex-direction: column; gap: 22px; }
    section { scroll-margin-top: 16px; } section h2 { margin: 0 0 6px; font-size: 17px; }
    section p { margin: 0 0 8px; line-height: 1.6; color: #1d2939; max-width: 68ch; }
    .open { color: #1570ef; font-weight: 600; font-size: 13.5px; text-decoration: none; }
    .none { color: #667085; }
    @media (max-width: 760px) { .cols { grid-template-columns: 1fr; } .toc { position: static; } }
  `],
})
export class HelpComponent {
  q = signal('');
  constructor(private features: FeatureFlagService) {}

  private visible = computed(() => TOPICS.filter(t => !t.flag || this.features.domainOn(t.flag)));
  shown = computed(() => {
    const q = this.q().trim().toLowerCase();
    return q ? this.visible().filter(t => (t.title + ' ' + t.body.join(' ')).toLowerCase().includes(q)) : this.visible();
  });
  groups = computed(() => {
    const out: { name: string; topics: Topic[] }[] = [];
    for (const t of this.shown()) {
      let g = out.find(x => x.name === t.group);
      if (!g) out.push(g = { name: t.group, topics: [] });
      g.topics.push(t);
    }
    return out;
  });

  go(e: Event, id: string): void {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
