import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../../services/toast.service';

interface PlannerTask {
  id: string;
  title: string;
  priority: string;  // low | medium | high
  due_date?: string;
  is_completed: boolean;
  created_at: string;
}

@Component({
  selector: 'app-planner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="planner-page">
      <header class="page-header">
        <h1>📅 Daily Assistant & Planner</h1>
        <p class="subtitle">Keep track of your day-to-day agenda and enterprise activities.</p>
      </header>

      <!-- AI Morning Briefing -->
      <section class="briefing-card" [class.loading]="loadingBrief">
        <div class="brief-header">
          <span class="sparkle">✦</span>
          <h3>AI Morning Briefing</h3>
        </div>
        <p class="brief-content" *ngIf="!loadingBrief">
          {{ dailyBrief || 'Failed to generate brief. Add some documents or tasks to get started!' }}
        </p>
        <div class="brief-loader" *ngIf="loadingBrief">
          Parsing database stats and drafting summaries...
        </div>
      </section>

      <div class="planner-grid">
        <!-- Checklist Section -->
        <div class="card tasks-card">
          <div class="card-header">
            <h2 class="card-title">📝 My Tasks</h2>
            <button class="btn-clear" (click)="clearCompleted()" *ngIf="hasCompletedTasks()">
              Clear Completed
            </button>
          </div>

          <!-- Quick Add Task -->
          <div class="task-add-bar">
            <input 
              [(ngModel)]="newTaskTitle" 
              (keyup.enter)="addTask()"
              placeholder="Add a new task (e.g. Call client for renewal confirmation)" 
            />
            <select [(ngModel)]="newTaskPriority">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <input type="date" [(ngModel)]="newTaskDueDate" />
            <button class="btn-add" (click)="addTask()">+ Add</button>
          </div>

          <!-- Tasks List -->
          <div class="tasks-list">
            <div 
              class="task-row" 
              *ngFor="let t of tasks"
              [class.completed]="t.is_completed"
            >
              <label class="checkbox-container">
                <input 
                  type="checkbox" 
                  [checked]="t.is_completed" 
                  (change)="toggleTask(t)"
                />
                <span class="checkmark"></span>
              </label>

              <div class="task-info">
                <span class="task-title">{{ t.title }}</span>
                <div class="task-meta" *ngIf="t.due_date">
                  📅 Due: {{ formatDate(t.due_date) }}
                </div>
              </div>

              <span class="priority-badge" [class]="t.priority">
                {{ t.priority }}
              </span>

              <button class="btn-delete-task" (click)="deleteTask(t.id)">✕</button>
            </div>

            <div class="empty-tasks" *ngIf="tasks.length === 0">
              🎉 All caught up! Create a task above to schedule your activities.
            </div>
          </div>
        </div>

        <!-- Dynamic Schedule Agenda -->
        <div class="card schedule-card">
          <h2 class="card-title">🕒 Today's Schedule</h2>
          <div class="schedule-timeline">
            <div 
              class="timeline-event" 
              *ngFor="let t of getTodayAgenda(); let i = index" 
              [class.important]="t.priority === 'high'"
            >
              <div class="event-time">{{ getAgendaTime(i) }}</div>
              <div class="event-body">
                <h4 style="display:flex; align-items:center; gap:6px;">
                  <span *ngIf="t.priority === 'high'">🔴</span>
                  <span *ngIf="t.priority === 'medium'">🟡</span>
                  <span *ngIf="t.priority === 'low'">🟢</span>
                  {{ t.title }}
                </h4>
                <p>Scheduled Agenda Item · Priority: {{ t.priority | titlecase }}</p>
              </div>
            </div>

            <!-- Fallback if empty -->
            <div class="timeline-event" *ngIf="getTodayAgenda().length === 0">
              <div class="event-time">09:00 AM</div>
              <div class="event-body">
                <h4>🌞 Inbox Standup</h4>
                <p>No active tasks scheduled for today. Create some tasks on your checklist to plan your agenda.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .planner-page {
      padding: 28px;
      max-width: 1200px;
      margin: 0 auto;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg-surface, #f8fafc);
      min-height: calc(100vh - 56px);
    }
    .page-header {
      margin-bottom: 24px;
    }
    .page-header h1 {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 4px;
    }
    .subtitle {
      font-size: 14px;
      color: #64748b;
      margin: 0;
    }

    /* Briefing Card */
    .briefing-card {
      background: linear-gradient(135deg, #eef2ff, #f5f3ff);
      border: 1px solid #e0e7ff;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.05);
      transition: all 0.3s;
    }
    .brief-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .sparkle {
      font-size: 18px;
      color: #6366f1;
      font-weight: bold;
    }
    .brief-header h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      color: #4f46e5;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .brief-content {
      margin: 0;
      font-size: 14px;
      color: #374151;
      line-height: 1.6;
      white-space: pre-line;
    }
    .brief-loader {
      font-size: 13px;
      color: #6366f1;
      font-style: italic;
    }

    /* Grid layout */
    .planner-grid {
      display: grid;
      grid-template-columns: 1fr 400px;
      gap: 24px;
    }
    @media (max-width: 968px) {
      .planner-grid { grid-template-columns: 1fr; }
    }

    .card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
    }
    .card-title {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .btn-clear {
      font-size: 12px;
      color: #6366f1;
      background: none;
      border: none;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-clear:hover { text-decoration: underline; }

    /* Task Add Bar */
    .task-add-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 18px;
      flex-wrap: wrap;
    }
    .task-add-bar input[type="text"] {
      flex: 1;
      min-width: 200px;
    }
    .task-add-bar input, .task-add-bar select {
      padding: 8px 12px;
      border: 1.5px solid #e2e8f0;
      border-radius: 8px;
      font-size: 13px;
      outline: none;
    }
    .task-add-bar input:focus, .task-add-bar select:focus {
      border-color: #6366f1;
    }
    .btn-add {
      padding: 8px 16px;
      background: #6366f1;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-add:hover { background: #4f46e5; }

    /* Task Rows */
    .tasks-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .task-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border: 1px solid #f1f5f9;
      border-radius: 8px;
      background: #f8fafc;
      transition: all 0.2s;
    }
    .task-row:hover { background: #f1f5f9; }
    .task-row.completed {
      opacity: 0.65;
      background: #f1f5f9;
    }
    .task-row.completed .task-title {
      text-decoration: line-through;
      color: #94a3b8;
    }

    /* Checkbox Styles */
    .checkbox-container {
      display: block;
      position: relative;
      width: 18px;
      height: 18px;
      cursor: pointer;
      user-select: none;
    }
    .checkbox-container input {
      position: absolute;
      opacity: 0;
      cursor: pointer;
      height: 0;
      width: 0;
    }
    .checkmark {
      position: absolute;
      top: 0;
      left: 0;
      height: 18px;
      width: 18px;
      background-color: white;
      border: 1.5px solid #cbd5e1;
      border-radius: 4px;
      transition: all 0.2s;
    }
    .checkbox-container:hover input ~ .checkmark {
      border-color: #6366f1;
    }
    .checkbox-container input:checked ~ .checkmark {
      background-color: #6366f1;
      border-color: #6366f1;
    }
    .checkmark:after {
      content: "";
      position: absolute;
      display: none;
    }
    .checkbox-container input:checked ~ .checkmark:after {
      display: block;
    }
    .checkbox-container .checkmark:after {
      left: 6px;
      top: 2px;
      width: 4px;
      height: 9px;
      border: solid white;
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
    }

    .task-info {
      flex: 1;
      min-width: 0;
    }
    .task-title {
      font-size: 14px;
      font-weight: 500;
      color: #334155;
    }
    .task-meta {
      font-size: 11px;
      color: #94a3b8;
      margin-top: 2px;
    }
    .priority-badge {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: 4px;
      letter-spacing: 0.3px;
    }
    .priority-badge.low { background: #e2e8f0; color: #475569; }
    .priority-badge.medium { background: #fef3c7; color: #d97706; }
    .priority-badge.high { background: #fee2e2; color: #dc2626; }
    .btn-delete-task {
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 14px;
      padding: 4px;
    }
    .btn-delete-task:hover { color: #dc2626; }
    .empty-tasks {
      padding: 32px;
      text-align: center;
      color: #94a3b8;
      font-size: 13px;
    }

    /* Schedule Timeline */
    .schedule-timeline {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-top: 16px;
      position: relative;
    }
    .timeline-event {
      display: flex;
      gap: 16px;
      position: relative;
      padding-bottom: 4px;
    }
    .event-time {
      font-size: 12px;
      font-weight: 700;
      color: #6366f1;
      width: 70px;
      flex-shrink: 0;
      padding-top: 2px;
    }
    .event-body {
      flex: 1;
      background: #f8fafc;
      padding: 12px;
      border-radius: 8px;
      border-left: 3px solid #cbd5e1;
    }
    .timeline-event.important .event-body {
      background: #eef2ff;
      border-left-color: #6366f1;
    }
    .event-body h4 {
      margin: 0 0 4px;
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
    }
    .event-body p {
      margin: 0;
      font-size: 12px;
      color: #64748b;
      line-height: 1.4;
    }
  `]
})
export class PlannerComponent implements OnInit {
  tasks: PlannerTask[] = [];
  dailyBrief = '';
  loadingBrief = true;

  newTaskTitle = '';
  newTaskPriority = 'medium';
  newTaskDueDate = '';

  private readonly api = 'http://localhost:8000';

  constructor(
    private http: HttpClient,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadTasks();
    this.loadBriefing();
  }

  loadTasks() {
    this.http.get<{ tasks: PlannerTask[] }>(`${this.api}/api/personal/planner`).subscribe({
      next: res => {
        this.tasks = res.tasks || [];
        this.cdr.markForCheck();
      },
      error: () => this.toast.error('Failed to load planner tasks')
    });
  }

  loadBriefing() {
    this.loadingBrief = true;
    this.cdr.markForCheck();
    this.http.get<{ briefing: string }>(`${this.api}/api/personal/briefing`).subscribe({
      next: res => {
        this.dailyBrief = res.briefing;
        this.loadingBrief = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingBrief = false;
        this.cdr.markForCheck();
      }
    });
  }

  addTask() {
    const title = this.newTaskTitle.trim();
    if (!title) return;

    const payload = {
      title,
      priority: this.newTaskPriority,
      due_date: this.newTaskDueDate || null
    };

    this.http.post<any>(`${this.api}/api/personal/planner`, payload).subscribe({
      next: () => {
        this.toast.success('Task added');
        this.newTaskTitle = '';
        this.newTaskDueDate = '';
        this.newTaskPriority = 'medium';
        this.loadTasks();
        this.loadBriefing();
      },
      error: () => this.toast.error('Failed to add task')
    });
  }

  toggleTask(task: PlannerTask) {
    const payload = { is_completed: !task.is_completed };
    this.http.put<any>(`${this.api}/api/personal/planner/${task.id}`, payload).subscribe({
      next: () => {
        this.loadTasks();
        this.loadBriefing();
      },
      error: () => this.toast.error('Failed to update task')
    });
  }

  deleteTask(id: string) {
    this.http.delete(`${this.api}/api/personal/planner/${id}`).subscribe({
      next: () => {
        this.loadTasks();
        this.loadBriefing();
      },
      error: () => this.toast.error('Failed to delete task')
    });
  }

  hasCompletedTasks(): boolean {
    return this.tasks.some(t => t.is_completed);
  }

  clearCompleted() {
    const completed = this.tasks.filter(t => t.is_completed);
    completed.forEach(t => {
      this.http.delete(`${this.api}/api/personal/planner/${t.id}`).subscribe({
        next: () => {
          this.tasks = this.tasks.filter(x => x.id !== t.id);
          this.cdr.markForCheck();
        }
      });
    });
    this.toast.info('Completed tasks cleared');
    this.loadBriefing();
  }

  formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return iso;
    }
  }

  getTodayAgenda(): PlannerTask[] {
    return this.tasks.filter(t => !t.is_completed).slice(0, 5);
  }

  getAgendaTime(index: number): string {
    const times = ['09:00 AM', '11:30 AM', '02:00 PM', '04:30 PM', '06:00 PM'];
    return times[index] || '09:00 AM';
  }
}
