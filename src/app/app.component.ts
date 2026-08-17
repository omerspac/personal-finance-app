import {
  AfterViewInit,
  Component,
  CUSTOM_ELEMENTS_SCHEMA
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SplashScreen } from '@capacitor/splash-screen';

import {
  IonApp,
  IonRouterOutlet
} from '@ionic/angular/standalone';

import { DatabaseService } from './services/database.service';
import { BiometricLockService } from './services/biometric-lock.service';
import { NetworkService } from './services/network.service';
import { ThemeService } from './services/theme.service';
import { LockScreenPage } from './components/lock-screen/lock-screen.page';
import { AppLoadingPage } from './components/app-loading/app-loading.page';
import { ConnectionLostPage } from './components/connection-lost/connection-lost.page';

// Minimum time our animated logo splash stays visible, even if
// initialization finishes faster than this. Gives the app an
// intentional "brand moment" rather than a flash.
const MIN_SPLASH_DURATION_MS = 2000;

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    IonApp,
    IonRouterOutlet,
    CommonModule,
    LockScreenPage,
    AppLoadingPage,
    ConnectionLostPage
  ]
})
export class AppComponent implements AfterViewInit {

  isInitializing = true;

  constructor(
    private databaseService: DatabaseService,
    public lockService: BiometricLockService,
    public networkService: NetworkService,
    // Injected purely to force ThemeService to instantiate immediately
    // at app bootstrap, so the saved theme applies before ANY page
    // (including login) renders - otherwise it stays light-mode until
    // something else (e.g. Settings) happens to inject it first.
    private themeService: ThemeService
  ) {}

  async ngAfterViewInit(): Promise<void> {

    const startTime = Date.now();

    // Hand off from the native splash to our own animated logo screen
    // immediately, so there's no gap or double-flash between the two.
    try {

      await SplashScreen.hide();

    } catch (error) {

      // Not fatal on web / if the plugin isn't configured yet.
      console.warn('SplashScreen.hide() failed:', error);

    }

    try {

      await customElements.whenDefined(
        'jeep-sqlite'
      );

      await this.databaseService.initializeDatabase();

    } catch (error) {

      console.error(
        'Failed to initialize OmFin:',
        error
      );

    }

    try {

      await this.lockService.initialize();

    } catch (error) {

      console.error(
        'Failed to initialize biometric lock:',
        error
      );

    }

    try {

      await this.networkService.initialize();

    } catch (error) {

      console.error(
        'Failed to initialize network monitoring:',
        error
      );

    }

    // Keep the splash on screen for at least MIN_SPLASH_DURATION_MS,
    // regardless of how fast initialization actually finished.
    const elapsed = Date.now() - startTime;
    const remaining = MIN_SPLASH_DURATION_MS - elapsed;

    if (remaining > 0) {

      await new Promise(resolve => setTimeout(resolve, remaining));

    }

    this.isInitializing = false;

  }
}