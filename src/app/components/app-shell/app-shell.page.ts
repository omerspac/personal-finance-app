import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';

import {
  IonContent,
  IonButton,
  IonIcon
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';

import {
  moonOutline,
  sunnyOutline,
  logOutOutline,
  receiptOutline,
  barChartOutline,
  settingsOutline,
  homeOutline
} from 'ionicons/icons';

import { ThemeService } from 'src/app/services/theme.service';
import { AuthService } from 'src/app/services/auth.service';
import { Subscription } from 'rxjs';


@Component({
  selector: 'app-app-shell',
  templateUrl: './app-shell.page.html',
  styleUrls: ['./app-shell.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonButton,
    IonIcon,
    CommonModule,
    RouterOutlet
  ]
})
export class AppShellPage implements OnDestroy {

  isDarkMode = false;

  currentPage = 'home';

  private themeSubscription?: Subscription;


  constructor(
    private router: Router,
    private themeService: ThemeService,
    private authService: AuthService
  ) {

    this.isDarkMode =
      this.themeService.getIsDarkMode();

    // Stay in sync if the theme is changed from anywhere else
    // (login page, settings page, etc.) - not just this button.
    this.themeSubscription =
      this.themeService.darkMode$.subscribe(
        (isDark) => {

          this.isDarkMode = isDark;

        }
      );


    addIcons({
      moonOutline,
      sunnyOutline,
      logOutOutline,
      receiptOutline,
      barChartOutline,
      settingsOutline,
      homeOutline
    });


    /*
     * Detect which page is currently active.
     */
    this.router.events.subscribe(event => {

      if (event instanceof NavigationEnd) {

        const url = event.urlAfterRedirects;

        if (url.includes('/transactions')) {
          this.currentPage = 'transactions';
        }

        else if (url.includes('/reports')) {
          this.currentPage = 'reports';
        }

        else if (url.includes('/settings')) {
          this.currentPage = 'settings';
        }

        else {
          this.currentPage = 'home';
        }

      }

    });

  }


  /* =========================================
     THEME
     ========================================= */

  toggleTheme(): void {

    // Delegate entirely to ThemeService, so this persists to
    // localStorage AND notifies every other page (login, settings)
    // subscribed to darkMode$ - instead of only changing this page's
    // own local state.
    this.themeService.toggleTheme();

  }


  /* =========================================
     LOGOUT
     ========================================= */

  async logout(): Promise<void> {

    try {

      await this.authService.logout();

    } catch (error) {

      console.error('Failed to log out:', error);

    } finally {

      this.router.navigateByUrl('/login', { replaceUrl: true });

    }

  }


  /* =========================================
     NAVIGATION
     ========================================= */

  goTo(page: string): void {

    switch (page) {

      case 'home':
        this.router.navigate(['/home']);
        break;

      case 'transactions':
        this.router.navigate(['/transactions']);
        break;

      case 'reports':
        this.router.navigate(['/reports']);
        break;

      case 'settings':
        this.router.navigate(['/settings']);
        break;

    }

  }


  ngOnDestroy(): void {

    this.themeSubscription?.unsubscribe();

  }

}