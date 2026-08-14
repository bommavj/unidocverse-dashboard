import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { authFetch } from '../../lib/api';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ThemeService } from '../../services/theme.service';

export interface VoiceEvent {
  title: string;
  subtitle?: string;
  time?: string;
  source?: string;
  type: string;
}

@Component({
  selector: 'app-voice-assistant',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './voice-assistant.component.html',
  styleUrls: ['./voice-assistant.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VoiceAssistantComponent implements OnInit, OnDestroy, OnChanges {
  @Input() isOpen = false;
  @Output() closed = new EventEmitter<void>();
  @Output() forwardToAi = new EventEmitter<string>();

  status = 'Wake word active: Say "Hey Bomma" or click the orb to speak';
  transcript = '...';
  isListening = false;
  isSpeaking = false;
  wakeWordMode = true;

  eventsList: VoiceEvent[] = [];
  summariesList: string[] = [];
  outputMode: 'idle' | 'schedule' | 'summaries' | 'ai_answer' = 'idle';
  aiAnswer = '';
  chatHistory: { question: string, answer: string, document?: any }[] = [];
  activeSpeakingIndex: number | null = null;
  showConfirmClear = false;
  activeDocument: any = null;
  suggestedQuestions: string[] = [];
  expectingNoteContent = false;
  expectingScheduleTitle = false;
  autoReadAloud = false;

  private wakeWordRec: any = null;
  private commandRec: any = null;
  private SpeechRecognition: any = null;
  private expectingCommand = false;
  private silenceTimer: any = null;

  constructor(
    private http: HttpClient,
    private router: Router,
    public  theme: ThemeService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechAPI) {
      this.SpeechRecognition = SpeechAPI;
      this.initRecognition();
    } else {
      this.status = 'Speech API is not supported in this browser.';
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']) {
      if (this.isOpen) {
        this.startListening();
      } else {
        this.stopListening();
      }
    }
  }

  ngOnDestroy(): void {
    this.stopListening();
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  private initRecognition(): void {
    // Wake Word Recognizer
    this.wakeWordRec = new this.SpeechRecognition();
    this.wakeWordRec.continuous = true;
    this.wakeWordRec.interimResults = true;
    this.wakeWordRec.lang = 'en-US';

    this.wakeWordRec.onresult = (event: any) => {
      let phrase = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        phrase += event.results[i][0].transcript;
      }
      const text = phrase.trim().toLowerCase();
      console.log('Wake word monitor heard:', text);

      const cleanText = text.replace(/\s+/g, '');
      if (
        cleanText.includes('unidocverse') || 
        text.includes('uni doc') || 
        text.includes('doc verse') || 
        text.includes('unidoc') || 
        text.includes('docverse') ||
        text.includes('universe') || 
        text.includes('uni verse') || 
        text.includes('hey bomma') || 
        text.includes('bomma') || 
        text.includes('hey boma') || 
        text.includes('boma') || 
        text.includes('obama') || 
        text.includes('comma') || 
        text.includes('llama') || 
        text.includes('hey dashboard')
      ) {
        this.activateCommandListen();
      }
    };

    this.wakeWordRec.onerror = (err: any) => {
      console.error('Wake word recognition error:', err);
      if (err.error === 'not-allowed') {
        this.status = 'Microphone blocked. Please click the orb to speak.';
        this.cdr.detectChanges();
      }
    };

    this.wakeWordRec.onend = () => {
      if (this.isListening && this.wakeWordMode && !this.expectingCommand) {
        try {
          this.wakeWordRec.start();
        } catch (e) {}
      }
    };

    // Command Recognizer
    this.commandRec = new this.SpeechRecognition();
    this.commandRec.continuous = true;
    this.commandRec.interimResults = true;
    this.commandRec.lang = 'en-US';

    this.commandRec.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcriptSegment = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptSegment;
        } else {
          interimTranscript += transcriptSegment;
        }
      }

      const currentText = finalTranscript || interimTranscript;
      if (currentText.trim()) {
        this.transcript = currentText;
        this.status = 'Listening...';
        this.cdr.markForCheck();

        clearTimeout(this.silenceTimer);
        this.silenceTimer = setTimeout(() => {
          const phrase = this.transcript.trim();
          if (phrase && phrase !== '...') {
            try {
              this.commandRec.stop();
            } catch (e) {}
            this.handleCommand(phrase);
          }
        }, 1500); // 1.5s silence timeout
      }
    };

    this.commandRec.onend = () => {
      this.expectingCommand = false;
      if (!this.isSpeaking && !this.wakeWordMode && this.isListening) {
        this.resetOrbVisuals();
      }
    };
  }

  startListening(): void {
    if (!this.wakeWordRec) return;
    this.isListening = true;
    this.wakeWordMode = true;
    this.expectingCommand = false;
    this.isSpeaking = false;
    this.status = 'Wake word active: Say "Hey Bomma" or click the orb to speak';
    this.transcript = '...';
    this.cdr.markForCheck();

    try {
      this.wakeWordRec.start();
    } catch (e) {}
  }

  stopListening(): void {
    this.isListening = false;
    this.expectingCommand = false;
    clearTimeout(this.silenceTimer);
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.resetOrbVisuals();
    try {
      this.wakeWordRec.stop();
    } catch (e) {}
    try {
      this.commandRec.stop();
    } catch (e) {}
    this.cdr.detectChanges();
  }

  triggerManualListen(): void {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    clearTimeout(this.silenceTimer);
    try {
      this.wakeWordRec.stop();
    } catch (e) {}
    try {
      this.commandRec.stop();
    } catch (e) {}

    setTimeout(() => {
      this.activateCommandListen();
    }, 150);
  }

  private activateCommandListen(): void {
    this.wakeWordMode = false;
    this.expectingCommand = true;
    this.status = 'Listening for your command...';
    this.transcript = '...';
    this.cdr.detectChanges();

    try {
      this.wakeWordRec.stop();
    } catch (e) {}

    // Speak to the user first, then trigger command recognition once done
    this.speak('I am listening, please speak.', () => {
      this.playChime(523.25, 659.25, 0.25); // C5 to E5 listening tone
      setTimeout(() => {
        try {
          this.commandRec.start();
        } catch (e) {}
      }, 150);
    });
  }

  private resetOrbVisuals(): void {
    this.wakeWordMode = true;
    this.expectingCommand = false;
    this.isSpeaking = false;
    this.status = 'Wake word active: Say "Hey Bomma" or click the orb';
    this.cdr.detectChanges();

    if (this.isListening) {
      try {
        this.wakeWordRec.start();
      } catch (e) {}
    }
  }

  private handleCommand(phrase: string): void {
    const query = phrase.toLowerCase().trim();
    if (query.includes("i'm listening") || query.includes("please speak") || query.includes("listening please speak")) {
      console.log('Voice assistant ignored its own prompt transcript.');
      this.resetOrbVisuals();
      return;
    }

    if (this.expectingNoteContent) {
      this.expectingNoteContent = false;
      this.saveNoteWithContent(phrase);
      return;
    }

    if (this.expectingScheduleTitle) {
      this.expectingScheduleTitle = false;
      this.saveScheduleWithTitle(phrase);
      return;
    }

    this.isSpeaking = true;
    this.status = 'Analyzing command...';
    this.cdr.detectChanges();

    // Voice scheduling intent matching:
    if (query.includes('schedule') || query.includes('add task') || query.includes('create task') || query.includes('add a task') || query.includes('create a task')) {
      this.handleVoiceSchedule(phrase);
      return;
    }

    // Voice note intent matching:
    if (query.includes('take a note') || query.includes('write a note') || query.includes('save a note') || query.includes('create a note')) {
      this.handleVoiceNote(phrase);
      return;
    }

    // Allow user to reset or unlock the current document context
    if (this.activeDocument && (query.includes('clear document') || query.includes('exit document') || query.includes('reset document') || query.includes('stop lock') || query.includes('clear context'))) {
      this.clearActiveDocument();
      return;
    }

    // Scan the library to see if the phrase mentions any document name
    this.http.get<any>('/api/documents').subscribe({
      next: (res) => {
        const docs = Array.isArray(res) ? res : res.documents || [];
        let matchedDoc: any = null;
        const stopwords = new Set(['and', 'the', 'for', 'pdf', 'xlsx', 'csv', 'doc', 'docx', 'statement', 'report', 'of', 'to', 'in', 'on', 'at', 'by', 'with', 'about', 'some', 'any', 'file', 'document', 'can', 'you', 'provide', 'important', 'information']);

        const queryWords = query.split(/\s+/).filter((w: string) => w.length > 2 && !stopwords.has(w));

        for (const doc of docs) {
          const filename = doc.filename.toLowerCase();
          const cleanFilename = filename.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9]/g, '');

          if (queryWords.length > 0) {
            const matchedWords = queryWords.filter((w: string) => cleanFilename.includes(w));
            const requiredMatches = Math.min(2, queryWords.length);
            if (matchedWords.length >= requiredMatches) {
              matchedDoc = doc;
              break;
            }
          }
        }

        if (matchedDoc && (!this.activeDocument || this.activeDocument.id !== matchedDoc.id)) {
          this.activeDocument = matchedDoc;
          this.suggestedQuestions = this.getSuggestedQuestions(matchedDoc.doc_type);
          this.cdr.detectChanges();
          this.askAiAgent(phrase);
        } else {
          this.processStandardIntent(phrase);
        }
      },
      error: () => {
        this.processStandardIntent(phrase);
      }
    });
  }

  private processStandardIntent(phrase: string): void {
    const query = phrase.toLowerCase();
    this.http.post<any>('/api/documents/voice/intent', { query: phrase }).subscribe({
      next: (res) => {
        if (res.action === 'redirect' && res.route) {
          if (res.route === '/search' && res.search_term) {
            this.tryLockDocumentOrSearch(res.search_term);
          } else {
            this.router.navigate([res.route]);
            this.speak(`Navigating to the ${res.route.substring(1)} page.`);
            this.transcript = `Redirecting to ${res.route.substring(1)}...`;
            this.outputMode = 'idle';
            this.closed.emit();
            this.cdr.detectChanges();
          }
        } else {
          if (query.includes('schedule') || query.includes('calendar') || query.includes('appointment') || query.includes('today looks like')) {
            this.fetchSchedule();
          } else if (query.includes('summary') || query.includes('summaries') || query.includes('today')) {
            this.fetchSummaries();
          } else {
            this.askAiAgent(phrase);
          }
        }
      },
      error: () => {
        if (query.includes('schedule') || query.includes('calendar') || query.includes('appointment') || query.includes('today looks like')) {
          this.fetchSchedule();
        } else if (query.includes('summary') || query.includes('summaries') || query.includes('today')) {
          this.fetchSummaries();
        } else if (query.includes('search')) {
          const match = phrase.match(/search(?:\s+the)?(?:\s+document)?(?:\s+for)?\s+(.+)/i);
          if (match && match[1]) {
            this.tryLockDocumentOrSearch(match[1].trim());
          } else {
            this.speak('What search term would you like me to find?');
          }
        } else {
          this.askAiAgent(phrase);
        }
      }
    });
  }

  private tryLockDocumentOrSearch(term: string): void {
    this.status = 'Searching documents...';
    this.cdr.detectChanges();

    this.http.get<any>('/api/documents').subscribe({
      next: (res) => {
        const docs = Array.isArray(res) ? res : res.documents || [];
        const matches = docs.filter((d: any) => 
          d.filename.toLowerCase().includes(term.toLowerCase())
        );

        if (matches.length > 0) {
          const match = matches[0];
          this.activeDocument = match;
          this.suggestedQuestions = this.getSuggestedQuestions(match.doc_type);
          this.outputMode = 'ai_answer';
          this.aiAnswer = `Locked onto 📄 **${match.filename}**.\n\nYou can now ask questions specifically about this document.`;
          this.speak(`I found ${match.filename}. I am now locked on this document. What would you like to know about it?`);
          this.status = 'Ready';
          this.cdr.detectChanges();
        } else {
          // Fallback to global search route redirect
          this.searchDocument(term);
        }
      },
      error: () => {
        this.searchDocument(term);
      }
    });
  }

  clearActiveDocument(): void {
    this.activeDocument = null;
    this.suggestedQuestions = [];
    this.chatHistory = [];
    this.activeSpeakingIndex = null;
    this.outputMode = 'idle';
    this.aiAnswer = '';
    this.status = 'Ready';
    this.showConfirmClear = false;
    this.speak('Conversation and context cleared.');
    this.cdr.detectChanges();
  }

  askSuggestedQuestion(q: string): void {
    this.transcript = q;
    this.askAiAgent(q);
  }

  onTextInput(phrase: string): void {
    const query = phrase.trim();
    if (!query) return;
    this.transcript = query;
    this.handleCommand(query);
  }

  private getSuggestedQuestions(docType: string): string[] {
    const type = (docType || '').toLowerCase();
    if (type.includes('bank')) {
      return [
        'What is the ending balance?',
        'List any large transactions or fees.',
        'What is the statement period?'
      ];
    }
    if (type.includes('policy') || type.includes('declaration') || type.includes('insurance')) {
      return [
        'What are the coverage limits?',
        'When does this policy expire?',
        'Who is the carrier and what is the premium?'
      ];
    }
    if (type.includes('invoice')) {
      return [
        'What is the total amount due?',
        'What is the payment due date?',
        'Who is the billing vendor?'
      ];
    }
    if (type.includes('tax')) {
      return [
        'What is the total income reported?',
        'How much tax was withheld?',
        'What is the filing deadline?'
      ];
    }
    if (type.includes('loss')) {
      return [
        'What is the overall loss ratio?',
        'How many total claims are reported?',
        'Are there any large individual losses?'
      ];
    }
    if (type.includes('commission')) {
      return [
        'What is the total commission amount?',
        'Are there any variance discrepancies?',
        'What is the statement date?'
      ];
    }
    if (type.includes('gap')) {
      return [
        'What is the overall coverage grade?',
        'What are the critical coverage gaps?',
        'What lines of business are recommended?'
      ];
    }
    return [
      'Summarize this document in 3 key points.',
      'What is the main topic of this document?',
      'Are there any important dates or deadlines?'
    ];
  }

  private askAiAgent(phrase: string): void {
    this.outputMode = 'ai_answer';
    this.status = 'Thinking...';
    this.isSpeaking = false;

    const historyItem = {
      question: phrase,
      answer: this.activeDocument ? 'Consulting document...' : 'Consulting documents...',
      document: this.activeDocument
    };
    this.chatHistory.push(historyItem);
    this.cdr.detectChanges();

    const url = this.activeDocument 
      ? `http://localhost:8000/api/documents/${this.activeDocument.id}/ask`
      : 'http://localhost:8000/api/documents/ask';

    authFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: phrase })
    })
      .then(res => {
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        historyItem.answer = '';
        this.status = 'Responding...';
        this.cdr.detectChanges();

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const pump = (): Promise<void> =>
          reader.read().then(({ done, value }) => {
            if (done) {
              this.isSpeaking = false;
              this.status = 'Ready';
              this.cdr.detectChanges();
              if (this.autoReadAloud) {
                const newIndex = this.chatHistory.length - 1;
                if (newIndex >= 0) {
                  this.readAloudHistoryItem(this.chatHistory[newIndex], newIndex);
                }
              }
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              try {
                const p = JSON.parse(line.slice(6));
                if (p.source_document) {
                  historyItem.document = p.source_document;
                  // Only lock to the document context if the user was already scoped to a document.
                  // For a global query, we show the matching document as a source reference in the chat bubble
                  // but keep the assistant in global mode.
                  if (this.activeDocument) {
                    this.activeDocument = p.source_document;
                    this.suggestedQuestions = this.getSuggestedQuestions(p.source_document.doc_type);
                  }
                  this.cdr.detectChanges();
                }
                if (p.token) {
                  historyItem.answer += p.token;
                  this.cdr.detectChanges();
                }
              } catch {}
            }
            return pump();
          });
        return pump();
      })
      .catch(() => {
        historyItem.answer = 'Unable to connect to the local AI model. Please ensure the backend is running.';
        this.cdr.detectChanges();
      });
  }

  readAloudHistoryItem(item: any, index: number): void {
    if (this.activeSpeakingIndex === index) {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      this.activeSpeakingIndex = null;
      this.isSpeaking = false;
      this.status = 'Ready';
      this.cdr.detectChanges();
      return;
    }

    const plainText = item.answer.replace(/<[^>]*>/g, '').replace(/\*+/g, '').trim();
    if (plainText) {
      this.activeSpeakingIndex = index;
      this.isSpeaking = true;
      this.cdr.detectChanges();

      this.http.post('http://localhost:8000/api/tts/speak', { text: plainText }, { responseType: 'arraybuffer' })
        .subscribe({
          next: async (buffer: ArrayBuffer) => {
            try {
              const ctx = new AudioContext();
              const audioBuffer = await ctx.decodeAudioData(buffer);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              source.onended = () => {
                this.activeSpeakingIndex = null;
                this.isSpeaking = false;
                this.resetOrbVisuals();
                this.cdr.detectChanges();
              };
              source.start();
            } catch {
              this.activeSpeakingIndex = null;
              this.isSpeaking = false;
              this.resetOrbVisuals();
              this.cdr.detectChanges();
            }
          },
          error: () => {
            // Fallback to browser TTS if backend unavailable
            if ('speechSynthesis' in window) {
              window.speechSynthesis.cancel();
              const utterance = new SpeechSynthesisUtterance(plainText);
              utterance.onend = () => { this.activeSpeakingIndex = null; this.isSpeaking = false; this.resetOrbVisuals(); this.cdr.detectChanges(); };
              utterance.onerror = () => { this.activeSpeakingIndex = null; this.isSpeaking = false; this.resetOrbVisuals(); this.cdr.detectChanges(); };
              window.speechSynthesis.speak(utterance);
            } else {
              this.activeSpeakingIndex = null;
              this.isSpeaking = false;
              this.resetOrbVisuals();
              this.cdr.detectChanges();
            }
          }
        });
    }
  }

  private fetchSchedule(): void {
    const today = new Date().toISOString().split('T')[0];
    this.http.get<any>(`/api/ams/calendar/events?start=${today}&end=${today}`).subscribe({
      next: (res) => {
        const events = res.events || [];
        this.eventsList = events.map((e: any) => ({
          title: e.title,
          subtitle: e.subtitle,
          time: e.date,
          type: e.type,
          source: e.type.includes('policy') ? 'Policies' : 'System'
        }));

        if (this.eventsList.length === 0) {
          this.outputMode = 'schedule';
          this.speak('Your schedule looks clear today. You have no events or deadlines listed.');
        } else {
          this.outputMode = 'schedule';
          const spokenSchedule = this.eventsList.map(e => e.title).join(', and ');
          this.speak(`Your schedule today includes: ${spokenSchedule}.`);
        }
        this.cdr.markForCheck();
      },
      error: () => {
        // Fallback mock schedule
        this.eventsList = [
          { title: 'Client Policy Review Briefing', time: '09:30 AM', source: 'Gmail', type: 'policy_expiry' },
          { title: 'Underwriting Sync on Product-Sales-Region', time: '11:00 AM', source: 'Teams', type: 'activity' }
        ];
        this.outputMode = 'schedule';
        this.speak('I could not reach the server, but your offline schedule shows Client Policy Review Briefing at 9:30 AM, and Underwriting Sync at 11:00 AM.');
        this.cdr.markForCheck();
      }
    });
  }

  private fetchSummaries(): void {
    this.http.get<any>('/api/notifications').subscribe({
      next: (res) => {
        const notifications = res.notifications || [];
        const unread = notifications.filter((n: any) => !n.is_read).slice(0, 3);
        
        if (unread.length === 0) {
          this.summariesList = ['No new notifications or alerts today. All items are clear.'];
          this.outputMode = 'summaries';
          this.speak('Here is your daily summary: You have no unread notifications or warnings today.');
        } else {
          this.summariesList = unread.map((n: any) => `${n.title}: ${n.message}`);
          this.outputMode = 'summaries';
          const spokenSummaries = unread.map((n: any) => `${n.title}, ${n.message}`).join('. Also, ');
          this.speak(`Here are the summaries of today. ${spokenSummaries}`);
        }
        this.cdr.markForCheck();
      },
      error: () => {
        // Fallback mock summaries
        this.summariesList = [
          'Gmail: Received Product-Sales-Region.xlsx from broker bommavj.',
          'Teams: Underwriting team approved policy renewal for Carlos.',
          'Slack: Anomalies check completed: 0 critical issues found.'
        ];
        this.outputMode = 'summaries';
        this.speak('Here are your one line summaries: Gmail received Product Sales spreadsheet; Teams approved policy renewal for Carlos; Slack anomalies check completed with zero issues.');
        this.cdr.markForCheck();
      }
    });
  }

  private searchDocument(term: string): void {
    this.router.navigate(['/search'], { queryParams: { q: term } });
    this.speak(`Searching the document logs for ${term}. Navigating to search view.`);
    this.transcript = `Searching for: "${term}"`;
    this.outputMode = 'idle';
    this.cdr.markForCheck();
  }

  private speak(text: string, onEndCallback?: () => void): void {
    let callbackFired = false;
    const fireCallback = () => {
      if (callbackFired) return;
      callbackFired = true;
      if (onEndCallback) onEndCallback();
      else this.resetOrbVisuals();
    };

    this.http.post('http://localhost:8000/api/tts/speak', { text }, { responseType: 'arraybuffer' })
      .subscribe({
        next: async (buffer: ArrayBuffer) => {
          try {
            const ctx = new AudioContext();
            const audioBuffer = await ctx.decodeAudioData(buffer);
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            source.onended = () => fireCallback();
            source.start();
          } catch {
            fireCallback();
          }
        },
        error: () => {
          // Fallback to browser TTS if backend unavailable
          if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.onend = () => fireCallback();
            utterance.onerror = () => fireCallback();
            const fallbackTimer = setTimeout(() => fireCallback(), 2500);
            utterance.addEventListener('end', () => clearTimeout(fallbackTimer));
            utterance.addEventListener('error', () => clearTimeout(fallbackTimer));
            window.speechSynthesis.speak(utterance);
          } else {
            fireCallback();
          }
        }
      });
  }

  private playChime(freq1: number, freq2: number, duration: number): void {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq1, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq2, audioCtx.currentTime + duration);

      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }

  private handleVoiceSchedule(phrase: string): void {
    const query = phrase.toLowerCase().trim();
    
    // Check if the query is just trigger words without title
    const triggerWords = ['schedule', 'add task', 'create task', 'add a task', 'create a task'];
    let isJustTrigger = false;
    if (triggerWords.includes(query)) {
      isJustTrigger = true;
    }

    if (isJustTrigger) {
      this.expectingScheduleTitle = true;
      this.wakeWordMode = false;
      this.expectingCommand = true;
      this.speak('What task would you like to schedule?', () => {
        this.status = 'Listening for task title...';
        this.transcript = '...';
        this.cdr.detectChanges();
        this.playChime(523.25, 659.25, 0.25);
        try {
          this.wakeWordRec.stop();
        } catch (e) {}
        setTimeout(() => {
          try {
            this.commandRec.start();
          } catch (e) {}
        }, 150);
      });
      return;
    }

    this.saveScheduleWithTitle(phrase);
  }

  private saveScheduleWithTitle(phrase: string): void {
    const query = phrase.toLowerCase();
    let title = '';
    let targetDateStr = '';

    const forMatch = phrase.match(/schedule\s+(.+?)\s+for\s+(.+)/i);
    const onMatch = phrase.match(/schedule\s+(.+?)\s+on\s+(.+)/i);

    if (forMatch && forMatch[1] && forMatch[2]) {
      title = forMatch[1].trim();
      targetDateStr = forMatch[2].trim().toLowerCase();
    } else if (onMatch && onMatch[1] && onMatch[2]) {
      title = onMatch[1].trim();
      targetDateStr = onMatch[2].trim().toLowerCase();
    } else {
      title = phrase.replace(/schedule/i, '').trim();
      targetDateStr = 'today';
    }

    // Default to the phrase itself if parsing leaves it blank
    if (!title) {
      title = phrase;
      targetDateStr = 'today';
    }

    let due: string | null = null;
    let spokenDate = '';

    if (targetDateStr.includes('tomorrow')) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      due = tomorrow.toISOString().split('T')[0];
      spokenDate = 'tomorrow';
    } else if (targetDateStr.includes('next week') || targetDateStr.includes('next monday')) {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      due = nextWeek.toISOString().split('T')[0];
      spokenDate = 'next week';
    } else if (targetDateStr.includes('today')) {
      due = new Date().toISOString().split('T')[0];
      spokenDate = 'today';
    } else {
      try {
        const parsed = new Date(targetDateStr);
        if (!isNaN(parsed.getTime())) {
          due = parsed.toISOString().split('T')[0];
          spokenDate = `on ${parsed.toLocaleDateString()}`;
        } else {
          due = new Date().toISOString().split('T')[0];
          spokenDate = 'today';
        }
      } catch {
        due = new Date().toISOString().split('T')[0];
        spokenDate = 'today';
      }
    }

    this.status = 'Scheduling task...';
    this.cdr.detectChanges();

    const payload = {
      title: title,
      priority: 'medium',
      due_date: due
    };

    this.http.post<any>('http://localhost:8000/api/personal/planner', payload).subscribe({
      next: () => {
        this.status = 'Ready';
        this.aiAnswer = `📅 Scheduled Task:\n\n**${payload.title}** for **${due}**`;
        this.speak(`I have scheduled: ${payload.title} ${spokenDate} for you.`);
        this.cdr.detectChanges();
      },
      error: () => {
        this.status = 'Ready';
        this.aiAnswer = `Failed to schedule task: **${payload.title}**`;
        this.speak('Sorry, I was unable to connect to the scheduling database.');
        this.cdr.detectChanges();
      }
    });
  }

  private handleVoiceNote(phrase: string): void {
    const query = phrase.toLowerCase();
    let content = '';
    const triggers = ['take a note', 'write a note', 'save a note', 'create a note'];
    for (const t of triggers) {
      const idx = query.indexOf(t);
      if (idx !== -1) {
        content = phrase.substring(idx + t.length).trim();
        break;
      }
    }

    if (!content) {
      this.expectingNoteContent = true;
      this.wakeWordMode = false;
      this.expectingCommand = true;
      this.speak('What would you like me to write in your note?', () => {
        this.status = 'Listening for note content...';
        this.transcript = '...';
        this.cdr.detectChanges();
        this.playChime(523.25, 659.25, 0.25);
        try {
          this.wakeWordRec.stop();
        } catch (e) {}
        setTimeout(() => {
          try {
            this.commandRec.start();
          } catch (e) {}
        }, 150);
      });
      return;
    }

    this.saveNoteWithContent(content);
  }

  private saveNoteWithContent(content: string): void {
    content = content.charAt(0).toUpperCase() + content.slice(1);
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const title = `Voice Note - ${dateStr}`;

    this.status = 'Saving note...';
    this.cdr.detectChanges();

    const payload = {
      title: title,
      content: content,
      doc_id: this.activeDocument ? this.activeDocument.id : null
    };

    this.http.post<any>('http://localhost:8000/api/personal/notes', payload).subscribe({
      next: () => {
        this.status = 'Ready';
        this.aiAnswer = `📝 Note Saved:\n\n**${title}**\n\n"${content}"`;
        this.speak(`I have saved your note: ${content}`);
        this.cdr.detectChanges();
      },
      error: () => {
        this.status = 'Ready';
        this.aiAnswer = 'Failed to save voice note';
        this.speak('Sorry, I was unable to save the note to the database.');
        this.cdr.detectChanges();
      }
    });
  }
}
