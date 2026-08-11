import { Component, OnInit } from '@angular/core';
import { ThemeService } from './services/theme.service';
import { RouterOutlet } from '@angular/router';
import { MainNavComponent } from './main-nav/main-nav.component';
import { ToastComponent } from './components/toast/toast.component';
import { KeyboardShortcutsComponent } from './components/keyboard-shortcuts/keyboard-shortcuts.component';
import { GlobalAskAiComponent } from './components/global-ask-ai/global-ask-ai.component';
import { LicenseService } from './services/license.service';
import { LicenseWarningBannerComponent } from './components/license-warning-banner/license-warning-banner.component';
import { VoiceAssistantComponent } from './components/voice-assistant/voice-assistant.component';
import { VoiceService } from './services/voice.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    MainNavComponent,
    ToastComponent,
    KeyboardShortcutsComponent,
    GlobalAskAiComponent,
    LicenseWarningBannerComponent,
    VoiceAssistantComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  askAiOpen = false;
  voiceOpen = false;
  voiceQuery = '';

  constructor(
    private licenseService: LicenseService,
    private themeService: ThemeService,
    private voiceSvc: VoiceService
  ) {}

  onForwardToAi(query: string): void {
    this.voiceQuery = query;
    this.voiceOpen = false;
    this.askAiOpen = true;
  }

  ngOnInit(): void {
    this.themeService.init();
    this.licenseService.init();
    this.voiceSvc.openVoice$.subscribe(() => {
      this.voiceOpen = true;
    });
  }
}