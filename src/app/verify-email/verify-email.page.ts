import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import {
  IonButton,
  IonIcon,
  IonToast,
  IonContent
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';

import {
  mailOutline,
  moonOutline,
  sunnyOutline,
  refreshOutline,
  logOutOutline
} from 'ionicons/icons';

import { AuthService } from '../services/auth.service';
import { ThemeService } from '../services/theme.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-verify-email',
  templateUrl: './verify-email.page.html',
  styleUrls: ['./verify-email.page.scss'],
  standalone: true,
  imports: [
    IonButton,
    IonIcon,
    IonToast,
    IonContent,
    CommonModule
  ]
})
export class VerifyEmailPage implements OnDestroy {

  // =========================================
  // EMAIL
  // =========================================

  email = this.authService.currentUserEmail ?? '';

  isResending = false;

  isChecking = false;

  // Cooldown (seconds) before the "Resend email" button can be tapped
  // again, so it cannot be spammed.
  resendCooldown = 0;

  private resendCooldownTimer?: ReturnType<typeof setInterval>;

  // Number of seconds until the next automatic verification check.
  countdown = 5;

  private countdownTimer?: ReturnType<typeof setInterval>;

  private checkTimer?: ReturnType<typeof setInterval>;


  // =========================================
  // TOAST
  // =========================================

  isToastOpen = false;

  toastMessage = '';


  // =========================================
  // THEME
  // =========================================

  isDarkMode = false;

  private themeSubscription?: Subscription;


  constructor(
    private authService: AuthService,
    private router: Router,
    private themeService: ThemeService
  ) {

    addIcons({
      mailOutline,
      moonOutline,
      sunnyOutline,
      refreshOutline,
      logOutOutline
    });

    this.isDarkMode = this.themeService.getIsDarkMode();

    this.themeSubscription = this.themeService.darkMode$.subscribe(
      (isDark) => {
        this.isDarkMode = isDark;
      }
    );

    this.startAutoCheck();

  }


  // =========================================
  // THEME
  // =========================================

  toggleTheme(): void {

    this.themeService.toggleTheme();

  }


  // =========================================
  // TOAST
  // =========================================

  private showToast(message: string): void {

    this.toastMessage = message;

    // Close the toast first so it can be
    // reopened even if another message occurred
    // immediately before this one.
    this.isToastOpen = false;

    setTimeout(() => {

      this.isToastOpen = true;

    });

  }


  // =========================================
  // AUTO CHECK
  // =========================================

  // Polls Firebase every few seconds. As soon as the user clicks the
  // link in the verification email, `emailVerified` flips to true and
  // the app proceeds to /home automatically.
  private startAutoCheck(): void {

    this.countdown = 5;

    this.checkTimer = setInterval(async () => {

      this.countdown -= 1;

      if (this.countdown > 0) {
        return;
      }

      this.countdown = 5;

      await this.checkNow(true);

    }, 1000);

  }

  private stopAutoCheck(): void {

    if (this.checkTimer) {

      clearInterval(this.checkTimer);
      this.checkTimer = undefined;

    }

    if (this.countdownTimer) {

      clearInterval(this.countdownTimer);
      this.countdownTimer = undefined;

    }

    this.clearResendCooldownTimer();

  }


  // =========================================
  // CHECK VERIFICATION
  // =========================================

  // Called by the "I've verified — Continue" button and periodically by
  // the auto-check. silent=true means no error toast (automatic poll).
  async checkNow(silent = false): Promise<void> {

    if (this.isChecking) {
      return;
    }

    const user = this.authService.currentUser;

    if (!user) {

      this.stopAutoCheck();

      await this.router.navigateByUrl('/login', {
        replaceUrl: true
      });

      return;

    }

    this.isChecking = true;

    try {

      await this.authService.refreshEmailVerificationStatus(user);

      if (user.emailVerified) {

        this.stopAutoCheck();

        await this.router.navigateByUrl('/home', {
          replaceUrl: true
        });

        return;

      }

      if (!silent) {

        this.showToast(
          'Your email is not verified yet. Please click the link we sent you.'
        );

      }

    } catch (error) {

      console.warn(
        'Failed to check email verification status:',
        error
      );

      if (!silent) {

        this.showToast(
          'Could not check your verification status. Please try again.'
        );

      }

    } finally {

      this.isChecking = false;

    }

  }


  // =========================================
  // RESEND EMAIL
  // =========================================

  async resendEmail(): Promise<void> {

    if (
      this.isResending ||
      this.isChecking ||
      this.resendCooldown > 0
    ) {
      return;
    }

    const user = this.authService.currentUser;

    if (!user) {

      await this.router.navigateByUrl('/login', {
        replaceUrl: true
      });

      return;

    }

    this.isResending = true;

    try {

      await this.authService.sendEmailVerification(user);

      this.showToast(
        'Verification email sent. Please check your inbox.'
      );

      this.startResendCooldown();

    } catch (error) {

      console.error(
        'Failed to resend verification email:',
        error
      );

      this.showToast(
        this.authService.getErrorMessage(error)
      );

    } finally {

      this.isResending = false;

    }

  }


  // =========================================
  // RESEND COOLDOWN
  // =========================================

  // Counts down 60 seconds before the resend button is enabled again,
  // preventing spam of the verification email.
  private startResendCooldown(): void {

    this.resendCooldown = 60;

    this.clearResendCooldownTimer();

    this.resendCooldownTimer = setInterval(() => {

      this.resendCooldown -= 1;

      if (this.resendCooldown <= 0) {

        this.clearResendCooldownTimer();

      }

    }, 1000);

  }


  private clearResendCooldownTimer(): void {

    if (this.resendCooldownTimer) {

      clearInterval(this.resendCooldownTimer);
      this.resendCooldownTimer = undefined;

    }

  }


  // =========================================
  // USE A DIFFERENT ACCOUNT
  // =========================================

  async useDifferentAccount(): Promise<void> {

    this.stopAutoCheck();

    try {

      await this.authService.logout();

    } catch (error) {

      console.warn(
        'Failed to log out:',
        error
      );

    }

    await this.router.navigateByUrl('/login', {
      replaceUrl: true
    });

  }


  ngOnDestroy(): void {

    this.stopAutoCheck();

    this.themeSubscription?.unsubscribe();

  }

}