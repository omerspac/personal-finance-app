import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import {
  IonLabel,
  IonInput,
  IonButton,
  IonIcon,
  IonItem,
  IonToast,
  IonContent
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';

import {
  mailOutline,
  lockClosedOutline,
  eyeOutline,
  eyeOffOutline,
  moonOutline,
  sunnyOutline,
  logoGoogle
} from 'ionicons/icons';

import { AuthService } from '../services/auth.service';
import { BiometricLockService } from '../services/biometric-lock.service';
import { ThemeService } from '../services/theme.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [
    IonLabel,
    IonInput,
    IonButton,
    IonIcon,
    IonItem,
    IonToast,
    IonContent,
    CommonModule,
    FormsModule
  ]
})
export class RegisterPage implements OnDestroy {

  // =========================================
  // REGISTRATION FORM
  // =========================================

  email = '';
  password = '';
  confirmPassword = '';

  showPassword = false;
  showConfirmPassword = false;

  isLoading = false;
  isGoogleLoading = false;


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
    private biometricLockService: BiometricLockService,
    private themeService: ThemeService
  ) {

    addIcons({
      mailOutline,
      lockClosedOutline,
      eyeOutline,
      eyeOffOutline,
      moonOutline,
      sunnyOutline,
      logoGoogle
    });

    this.isDarkMode = this.themeService.getIsDarkMode();

    this.themeSubscription = this.themeService.darkMode$.subscribe(
      (isDark) => {
        this.isDarkMode = isDark;
      }
    );

  }


  // =========================================
  // THEME
  // =========================================

  toggleTheme(): void {

    this.themeService.toggleTheme();

  }


  // =========================================
  // PASSWORD VISIBILITY
  // =========================================

  togglePassword(): void {

    this.showPassword = !this.showPassword;

  }

  toggleConfirmPassword(): void {

    this.showConfirmPassword = !this.showConfirmPassword;

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


  private isValidEmail(email: string): boolean {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  }


  // =========================================
  // CREATE ACCOUNT
  // =========================================

  async register(): Promise<void> {

    if (this.isLoading || this.isGoogleLoading) {
      return;
    }

    const email = this.email.trim();

    // -----------------------------------------
    // VALIDATION
    // -----------------------------------------

    if (!email) {

      this.showToast(
        'Please enter your email address.'
      );

      return;
    }

    if (!this.isValidEmail(email)) {

      this.showToast(
        'Please enter a valid email address.'
      );

      return;
    }

    if (!this.password) {

      this.showToast(
        'Please enter a password.'
      );

      return;
    }

    if (!this.confirmPassword) {

      this.showToast(
        'Please confirm your password.'
      );

      return;
    }

    if (this.password !== this.confirmPassword) {

      this.showToast(
        'Passwords do not match.'
      );

      return;
    }

    this.isLoading = true;

    try {

      // -----------------------------------------
      // CREATE FIREBASE ACCOUNT
      // -----------------------------------------

      const user = await this.authService.register(email, this.password);

      // -----------------------------------------
      // SEND EMAIL VERIFICATION
      // -----------------------------------------

      // A verification email is sent so the address can be confirmed to
      // belong to the person registering. The account stays usable only
      // after the link is clicked. The user lands on the /verify-email
      // page and cannot reach /home until emailVerified becomes true.
      try {

        await this.authService.sendEmailVerification(user);

      } catch (verifyError) {

        console.warn(
          'Failed to send verification email:',
          verifyError
        );

      }

      // First-launch flow: a successful account creation is a deliberate
      // choice to proceed, so mark initial setup as completed.
      await this.authService.markInitialSetupComplete();

      // -----------------------------------------
      // GO TO EMAIL VERIFICATION
      // -----------------------------------------

      await this.router.navigateByUrl(
        '/verify-email',
        {
          replaceUrl: true
        }
      );

    } catch (error) {

      console.error(
        'Registration failed:',
        error
      );

      this.showToast(
        this.authService.getErrorMessage(error)
      );

    } finally {

      this.isLoading = false;

    }

  }


  // =========================================
  // CONTINUE WITH GOOGLE
  // =========================================

  async continueWithGoogle(): Promise<void> {

    if (this.isLoading || this.isGoogleLoading) {
      return;
    }

    this.isGoogleLoading = true;

    try {

      await this.authService.signInWithGoogle();

      await this.biometricLockService.saveLoginForCurrentUser();

      await this.authService.markInitialSetupComplete();

      await this.router.navigateByUrl(
        '/home',
        {
          replaceUrl: true
        }
      );

    } catch (error) {

      console.error(
        'Google sign-in failed:',
        error
      );

      this.showToast(
        this.authService.getErrorMessage(error)
      );

    } finally {

      this.isGoogleLoading = false;

    }

  }


  // =========================================
  // GO TO LOGIN
  // =========================================

  async goToLogin(): Promise<void> {

    if (this.isLoading || this.isGoogleLoading) {
      return;
    }

    // Choosing to log in instead of registering is also a deliberate
    // choice to proceed into the existing auth flow, so mark initial
    // setup as completed before navigating.
    try {

      await this.authService.markInitialSetupComplete();

    } catch (error) {

      console.warn(
        'Failed to mark initial setup as complete:',
        error
      );

    }

    await this.router.navigateByUrl(
      '/login',
      {
        replaceUrl: true
      }
    );

  }


  ngOnDestroy(): void {

    this.themeSubscription?.unsubscribe();

  }

}