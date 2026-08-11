import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class VoiceService {
  private openVoiceSubject = new Subject<void>();
  openVoice$ = this.openVoiceSubject.asObservable();

  open(): void {
    this.openVoiceSubject.next();
  }
}
