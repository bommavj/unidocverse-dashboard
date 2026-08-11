import { Component, Inject, ViewChild, ElementRef, AfterViewChecked, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DocumentResponse, api } from '../../lib/api';
import { TextFieldModule } from '@angular/cdk/text-field';


interface Message {
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  streaming?: boolean;
}

interface ConversationExchange {
  question: string;
  answer: string;
}


@Component({
  selector: 'app-document-qa-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatMenuModule,
    MatTooltipModule,
    TextFieldModule,
  ],
  template: `
    <div class="qa-dialog">
      <div class="dialog-header">
        <div class="header-content">
          <mat-icon class="chat-icon">chat</mat-icon>
          <div>
            <h2>AI Document Assistant</h2>
            <p class="doc-name">{{ document.filename }}</p>
          </div>
        </div>
        <div class="header-actions">
          <button 
            mat-icon-button 
            (click)="clearChat()"
            matTooltip="Clear conversation"
            *ngIf="messages.length > 0">
            <mat-icon>refresh</mat-icon>
          </button>
          <button 
            mat-icon-button 
            [matMenuTriggerFor]="menu"
            matTooltip="Options">
            <mat-icon>more_vert</mat-icon>
          </button>
          <mat-menu #menu="matMenu">
            <button mat-menu-item (click)="exportChat()">
              <mat-icon>download</mat-icon>
              <span>Export Chat</span>
            </button>
            <button mat-menu-item (click)="copyLastAnswer()" [disabled]="messages.length === 0">
              <mat-icon>content_copy</mat-icon>
              <span>Copy Last Answer</span>
            </button>
          </mat-menu>
          <button mat-icon-button mat-dialog-close>
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Conversation Memory Indicator -->
      <div class="memory-indicator" *ngIf="conversationHistory.length > 0">
        <mat-icon>memory</mat-icon>
        <span>Remembering {{ conversationHistory.length }} previous exchange{{ conversationHistory.length > 1 ? 's' : '' }}</span>
      </div>
      

      <!-- <div class="chat-container" #chatContainer> -->
      <div class="chat-container" #chatContainer (scroll)="onScroll()">
        <!-- Welcome Message -->
        <div class="message ai-message" *ngIf="messages.length === 0">
          <mat-icon class="message-icon">smart_toy</mat-icon>
          <div class="message-content">
            <p><strong>👋 Hi! I'm your AI document assistant.</strong></p>
            <p>I've analyzed this document and can answer questions about it. I'll remember our conversation, so feel free to ask follow-up questions!</p>
            
            <div class="example-questions">
              <p class="example-label">
                <mat-spinner *ngIf="loadingQuestions" diameter="16" style="display: inline-block; vertical-align: middle; margin-right: 8px;"></mat-spinner>
                {{ loadingQuestions ? 'Generating smart questions...' : 'Try asking:' }}
                <span *ngIf="!loadingQuestions && hasAnalysis" class="smart-badge">✨ Smart</span>
              </p>
              
              <mat-chip 
                *ngFor="let q of exampleQuestions"
                (click)="askQuestion(q)"
                [disabled]="loadingQuestions"
                class="example-chip">
                <mat-icon>help_outline</mat-icon>
                {{ q }}
              </mat-chip>
              
              <p *ngIf="!loadingQuestions && exampleQuestions.length === 0" class="no-questions">
                No suggested questions available. Just type your question below!
              </p>
            </div>
          </div>
        </div>

        <!-- Messages -->
        <div 
          *ngFor="let message of messages; let i = index"
          [class]="'message ' + message.type + '-message'">
          <mat-icon class="message-icon">
            {{ message.type === 'user' ? 'person' : 'smart_toy' }}
          </mat-icon>
          <div class="message-content">
            <p>{{ message.content }}<span class="cursor" *ngIf="message.streaming">▋</span></p>
            <div class="message-footer" *ngIf="!message.streaming">
              <span class="timestamp">{{ formatTime(message.timestamp) }}</span>
              <button 
                mat-icon-button 
                *ngIf="message.type === 'ai'"
                (click)="copyToClipboard(message.content)"
                class="copy-btn"
                matTooltip="Copy answer">
                <mat-icon>content_copy</mat-icon>
              </button>
            </div>
          </div>
        </div>

        <!-- Initial loading spinner (before first token) -->
        <div class="message ai-message" *ngIf="loading && !streaming">
          <mat-icon class="message-icon">smart_toy</mat-icon>
          <div class="message-content">
            <div class="loading-container">
              <mat-spinner diameter="20"></mat-spinner>
              <p class="loading-text">Analyzing document...</p>
            </div>
          </div>
        </div>
      </div>

      <div class="input-container">
        <mat-form-field appearance="outline" class="question-field">
          <mat-label>Ask a question</mat-label>
          <textarea 
            matInput 
            [(ngModel)]="currentQuestion"
            (keydown.enter)="handleEnter($any($event))"
            [disabled]="loading"
            placeholder="E.g., What is the total amount due?"
            rows="1"
            cdkTextareaAutosize
            cdkAutosizeMinRows="1"
            cdkAutosizeMaxRows="3"></textarea>
          <button 
            mat-icon-button 
            matSuffix 
            (click)="sendQuestion()"
            [disabled]="!currentQuestion.trim() || loading"
            color="primary">
            <mat-icon>send</mat-icon>
          </button>
        </mat-form-field>
        <p class="hint-text" *ngIf="conversationHistory.length > 0">
          💡 I remember our previous conversation - feel free to ask follow-up questions!
        </p>
      </div>
    </div>
  `,
  styles: [`
    .qa-dialog {
      display: flex;
      flex-direction: column;
      height: 650px;
      width: 750px;
      background: #fafafa;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      background: linear-gradient(135deg, #4caf50 0%, #66bb6a 100%);
      color: white;
    }

    .header-content {
      display: flex;
      align-items: center;
      gap: 16px;
      flex: 1;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .chat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 500;
    }

    .doc-name {
      margin: 4px 0 0 0;
      font-size: 13px;
      opacity: 0.9;
      max-width: 400px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .memory-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 24px;
      background: #e8f5e9;
      color: #2e7d32;
      font-size: 13px;
      border-bottom: 1px solid #c8e6c9;
    }

    .memory-indicator mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .chat-container {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      background: #fff;
    }

    .message {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
      animation: fadeIn 0.3s ease-in;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .message-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      flex-shrink: 0;
      margin-top: 4px;
    }

    .user-message {
      .message-icon { color: #4caf50; }
      .message-content {
        background: #e8f5e9;
        border-left: 3px solid #4caf50;
      }
    }

    .ai-message {
      .message-icon { color: #2196f3; }
      .message-content {
        background: #f5f5f5;
        border-left: 3px solid #2196f3;
      }
    }

    .message-content {
      flex: 1;
      padding: 12px 16px;
      border-radius: 8px;
    }

    .message-content p {
      margin: 0 0 8px 0;
      line-height: 1.6;
      color: #212121;
      white-space: pre-wrap;
    }

    .message-content p:last-child {
      margin-bottom: 0;
    }

    .cursor {
      display: inline-block;
      animation: blink 0.7s infinite;
      color: #2196f3;
      font-weight: bold;
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }

    .message-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 8px;
    }

    .timestamp {
      font-size: 11px;
      color: #9e9e9e;
    }

    .copy-btn {
      width: 24px;
      height: 24px;
      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    .example-questions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 12px;
    }

    .example-label {
      font-size: 13px;
      color: #666;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .smart-badge {
      background: linear-gradient(135deg, #ffd700, #ffed4e);
      color: #333;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      margin-left: 8px;
    }

    .example-chip {
      cursor: pointer;
      transition: all 0.2s ease;
      background: #fff !important;
      justify-content: flex-start !important;
      
      &:hover:not([disabled]) {
        background: #e8f5e9 !important;
        transform: translateX(4px);
      }

      &[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
      }

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        margin-right: 8px;
      }
    }

    .no-questions {
      font-size: 13px;
      color: #999;
      font-style: italic;
      margin: 8px 0 0 0;
    }

    .loading-container {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .loading-text {
      color: #757575;
      font-style: italic;
    }

    .input-container {
      padding: 16px 24px;
      background: #fff;
      border-top: 1px solid #e0e0e0;
    }

    .question-field {
      width: 100%;
      margin: 0;
    }

    .hint-text {
      margin: 8px 0 0 0;
      font-size: 12px;
      color: #666;
      text-align: center;
    }

    ::ng-deep .question-field .mat-mdc-text-field-wrapper {
      background: #fafafa;
    }

    ::ng-deep .question-field textarea {
      resize: none;
    }
  `]
})
export class DocumentQaDialogComponent implements OnInit, AfterViewChecked {
  @ViewChild('chatContainer') private chatContainer!: ElementRef;
  
  currentQuestion = '';
  messages: Message[] = [];
  conversationHistory: ConversationExchange[] = [];
  loading = false;
  streaming = false;

  loadingQuestions = true;
  exampleQuestions: string[] = [];
  hasAnalysis = false;
  private autoScroll = true;

  constructor(
    @Inject(MAT_DIALOG_DATA) public document: DocumentResponse,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadSuggestedQuestions();
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  async loadSuggestedQuestions() {
    this.loadingQuestions = true;
    try {
      const response = await api.getSuggestedQuestions(this.document.id);
      this.exampleQuestions = response.suggested_questions || [];
      this.hasAnalysis = response.has_analysis || false;
    } catch (error) {
      this.exampleQuestions = this.getFallbackQuestions();
      this.hasAnalysis = false;
    } finally {
      this.loadingQuestions = false;
    }
  }

  getFallbackQuestions(): string[] {
    const docType = this.document.doc_type?.toLowerCase() || '';
    if (docType === 'bank_statement') return [
      'What is the ending balance?',
      'What were the total deposits?',
      'What are the largest withdrawals?'
    ];
    if (docType === 'invoice') return [
      'What is the total amount?',
      'When is payment due?',
      'Who is the vendor?'
    ];
    if (docType.includes('mortgage') || docType.includes('loan')) return [
      'What is the loan amount?',
      'What is the interest rate?',
      'What is the monthly payment?'
    ];
    return [
      'What is this document about?',
      'Summarize the main points',
      'What are the key details?'
    ];
  }

  handleEnter(event: KeyboardEvent) {
    if (!event.shiftKey) {
      event.preventDefault();
      this.sendQuestion();
    }
  }

  async sendQuestion() {
    if (!this.currentQuestion.trim() || this.loading) return;
    const question = this.currentQuestion.trim();
    this.currentQuestion = '';
    this.messages.push({ type: 'user', content: question, timestamp: new Date() });
    await this.getAnswer(question);
  }

  async askQuestion(question: string) {
    this.currentQuestion = question;
    await this.sendQuestion();
  }

  async getAnswer(question: string) {
    this.loading = true;
    this.streaming = false;

    // Placeholder AI message that will be filled token by token
    const aiMessage: Message = {
      type: 'ai',
      content: '',
      timestamp: new Date(),
      streaming: true
    };

    try {
      const response = await fetch(
        `http://localhost:8000/api/documents/${this.document.id}/ask`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question,
            conversation_history: this.conversationHistory
          })
        }
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const contentType = response.headers.get('content-type') || '';

      // ── Streaming (SSE) path ──
      if (contentType.includes('text/event-stream')) {
        this.streaming = true;
        this.messages.push(aiMessage);
        this.cdr.detectChanges();

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.token) {
                aiMessage.content += data.token;
                this.cdr.detectChanges();
              }
              if (data.done) {
                aiMessage.streaming = false;
                this.conversationHistory.push({ question, answer: aiMessage.content });
              }
              if (data.error) {
                aiMessage.content = 'Error: ' + data.error;
                aiMessage.streaming = false;
              }
            } catch {}
          }
        }

        aiMessage.streaming = false;
        this.cdr.detectChanges();

      // ── Non-streaming fallback (original JSON path) ──
      } else {
        const data = await response.json();
        aiMessage.content = data.answer || 'No answer returned.';
        aiMessage.streaming = false;
        this.messages.push(aiMessage);
        this.conversationHistory.push({ question, answer: aiMessage.content });
      }

    } catch (error: any) {
      aiMessage.content = `Sorry, I encountered an error: ${error.message}. Please try rephrasing your question.`;
      aiMessage.streaming = false;
      if (!this.messages.includes(aiMessage)) {
        this.messages.push(aiMessage);
      }
    } finally {
      this.loading = false;
      this.streaming = false;
      this.cdr.detectChanges();
    }
  }

  clearChat() {
    if (confirm('Clear the entire conversation? This cannot be undone.')) {
      this.messages = [];
      this.conversationHistory = [];
    }
  }

  exportChat() {
    const text = this.messages
      .map(m => `[${this.formatTime(m.timestamp)}] ${m.type === 'user' ? 'You' : 'AI'}:\n${m.content}\n`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${this.document.filename}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  copyLastAnswer() {
    const last = [...this.messages].reverse().find(m => m.type === 'ai');
    if (last) this.copyToClipboard(last.content);
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
/* 
  scrollToBottom() {
    try {
      this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
    } catch {}
  } */

  onScroll() {
      const el = this.chatContainer.nativeElement;
      const threshold = 80;
    
      const atBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    
      this.autoScroll = atBottom;
    }
    
  scrollToBottom() {
    if (!this.autoScroll) return;
  
    try {
      const el = this.chatContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    } catch {}
  }
  
}