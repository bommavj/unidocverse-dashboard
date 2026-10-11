import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements OnInit {

  today        = new Date();
  currentYear  = this.today.getFullYear();
  currentMonth = this.today.getMonth(); // 0-indexed

  events:    any[] = [];
  byDate:    Record<string, any[]> = {};
  loading    = false;

  selectedDate: string | null = null;
  selectedEvents: any[] = [];
  quickEventTitle = '';
  quickEventPriority = 'medium';
  scheduling = false;

  weeks: (Date | null)[][] = [];

  filterType = '';
  readonly EVENT_TYPES = [
    { value: '',                  label: 'All Events' },
    { value: 'policy_expiry',     label: '🔴 Policy Expiry' },
    { value: 'renewal_reminder',  label: '🟡 Renewal Reminder' },
    { value: 'policy_effective',  label: '🟢 Policy Effective' },
    { value: 'commission',        label: '🟣 Commission' },
    { value: 'loss_run',          label: '🔵 Loss Run' },
    { value: 'activity',          label: '🔷 Activity' },
    { value: 'document',          label: '⬜ Document' },
  ];

  private readonly api = 'http://localhost:7979';

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.buildCalendar();
    this.loadEvents();
  }

  // ── Calendar grid ─────────────────────────────────────────────────────────

  buildCalendar(): void {
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const lastDay  = new Date(this.currentYear, this.currentMonth + 1, 0);
    const weeks: (Date | null)[][] = [];
    let week: (Date | null)[] = [];

    // Pad start
    for (let i = 0; i < firstDay.getDay(); i++) week.push(null);

    for (let d = 1; d <= lastDay.getDate(); d++) {
      week.push(new Date(this.currentYear, this.currentMonth, d));
      if (week.length === 7) { weeks.push(week); week = []; }
    }
    // Pad end
    while (week.length > 0 && week.length < 7) week.push(null);
    if (week.length) weeks.push(week);

    this.weeks = weeks;
  }

  // ── Data ─────────────────────────────────────────────────────────────────

  loadEvents(): void {
    this.loading = true;
    const month  = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}`;
    this.http.get<any>(`${this.api}/api/ams/calendar/events?month=${month}`).subscribe({
      next: res => {
        this.events  = res.events  || [];
        this.byDate  = res.by_date || {};
        this.loading = false;
        // Reselect if a date was selected
        if (this.selectedDate) {
          this.selectedEvents = this._eventsForDate(this.selectedDate);
        }
      },
      error: () => { this.loading = false; }
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  prevMonth(): void {
    if (this.currentMonth === 0) { this.currentMonth = 11; this.currentYear--; }
    else this.currentMonth--;
    this.buildCalendar();
    this.loadEvents();
  }

  nextMonth(): void {
    if (this.currentMonth === 11) { this.currentMonth = 0; this.currentYear++; }
    else this.currentMonth++;
    this.buildCalendar();
    this.loadEvents();
  }

  goToday(): void {
    this.currentYear  = this.today.getFullYear();
    this.currentMonth = this.today.getMonth();
    this.buildCalendar();
    this.loadEvents();
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  selectDate(d: Date | null): void {
    if (!d) return;
    this.selectedDate   = this.dateKey(d);
    this.selectedEvents = this._eventsForDate(this.selectedDate);
  }

  _eventsForDate(key: string): any[] {
    const evs = this.byDate[key] || [];
    if (!this.filterType) return evs;
    return evs.filter(e => e.type === this.filterType);
  }

  openEvent(ev: any): void {
    if (ev.client_id && ev.policy_id) {
      this.router.navigate(['/clients', ev.client_id]);
    } else if (ev.document_id) {
      this.router.navigate(['/documents', ev.document_id]);
    } else if (ev.client_id) {
      this.router.navigate(['/clients', ev.client_id]);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  dateKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  isToday(d: Date | null): boolean {
    if (!d) return false;
    return d.toDateString() === this.today.toDateString();
  }

  isSelected(d: Date | null): boolean {
    if (!d) return false;
    return this.dateKey(d) === this.selectedDate;
  }

  eventsOnDay(d: Date | null): any[] {
    if (!d) return [];
    const key = this.dateKey(d);
    const evs = this.byDate[key] || [];
    if (!this.filterType) return evs;
    return evs.filter(e => e.type === this.filterType);
  }

  hasUrgent(d: Date | null): boolean {
    return this.eventsOnDay(d).some(e => e.urgent);
  }

  get monthLabel(): string {
    return new Date(this.currentYear, this.currentMonth, 1)
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  get filteredEvents(): any[] {
    if (!this.filterType) return this.events;
    return this.events.filter(e => e.type === this.filterType);
  }

  onFilterChange(): void {
    if (this.selectedDate) {
      this.selectedEvents = this._eventsForDate(this.selectedDate);
    }
  }

  daysAgo(days: number): string {
    return Math.abs(days) + 'd ago';
  }

  get upcomingUrgent(): any[] {
    const today = this.dateKey(this.today);
    return this.events
      .filter(e => e.urgent && e.date >= today)
      .slice(0, 5);
  }

  addQuickEvent(): void {
    if (!this.selectedDate || !this.quickEventTitle.trim()) return;
    this.scheduling = true;
    const payload = {
      title: this.quickEventTitle.trim(),
      priority: this.quickEventPriority,
      due_date: this.selectedDate
    };
    this.http.post<any>(`${this.api}/api/personal/planner`, payload).subscribe({
      next: () => {
        this.quickEventTitle = '';
        this.quickEventPriority = 'medium';
        this.scheduling = false;
        this.loadEvents();
      },
      error: () => {
        this.scheduling = false;
      }
    });
  }
}