import { Component, OnInit } from '@angular/core';
import { ThemeService } from './services/theme.service';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';
import { filter } from 'rxjs/operators';
import { MainNavComponent } from './main-nav/main-nav.component';
import { ToastComponent } from './components/toast/toast.component';
import { KeyboardShortcutsComponent } from './components/keyboard-shortcuts/keyboard-shortcuts.component';
import { GlobalAskAiComponent } from './components/global-ask-ai/global-ask-ai.component';
import { LicenseService } from './services/license.service';
import { LicenseWarningBannerComponent } from './components/license-warning-banner/license-warning-banner.component';
import { VoiceAssistantComponent } from './components/voice-assistant/voice-assistant.component';
import { VoiceService } from './services/voice.service';
import { TopBarComponent } from './components/top-bar/top-bar.component';

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
    TopBarComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  /** Trial / licence banner — off while UniDocVerse is offered free; set true to bring it back. */
  showLicenseBanner = false;
  askAiOpen = false;
  voiceOpen = false;
  voiceQuery = '';

  constructor(
    private licenseService: LicenseService,
    private themeService: ThemeService,
    private voiceSvc: VoiceService,
    private router: Router,
    protected auth: AuthService,
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

    // Fire udv-login once Angular routes to an authenticated page (on refresh)
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      if (e.url !== '/login' && e.url !== '/' && this.auth.isLoggedIn() === true) {
        window.dispatchEvent(new CustomEvent('udv-login'));
      }
    });
  }
}