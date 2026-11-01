import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { installSelectMenu } from './app/services/select-menu';

installSelectMenu();

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
