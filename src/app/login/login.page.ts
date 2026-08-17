import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import {
  IonLabel,
  IonInput,
  IonButton,
  IonIcon,
  IonItem,
  IonToast
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';

import {
  mailOutline,
  lockClosedOutline,
  eyeOutline,
  eyeOffOutline,
  fingerPrintOutline,
  scanOutline,
  arrowBackOutline,
  moonOutline,
  sunnyOutline
} from 'ionicons/icons';

import { AuthService } from '../services/auth.service';
import { BiometricLockService } from '../services/biometric-lock.service';
import { ThemeService } from '../services/theme.service';
import { Preferences } from '@capacitor/preferences';
import { Subscription } from 'rxjs';

const BIOMETRIC_MODE_KEY = 'omfin_biometric_mode';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    IonLabel,
    IonInput,
    IonButton,
    IonIcon,
    IonItem,
    IonToast,
    CommonModule,
    FormsModule
  ]
})
export class LoginPage implements OnInit, OnDestroy {

  // =========================================
  // VIEW STATE
  // =========================================

  view: 'login' | 'forgot' = 'login';


  // =========================================
  // LOGIN
  // =========================================

  email = '';
  password = '';
  showPassword = false;

  isLoading = false;


  // =========================================
  // BIOMETRIC LOGIN
  // =========================================

  isBiometricLoading = false;

  biometricLoginAvailable = false;

  biometricMode: 'fingerprint' | 'face' = 'fingerprint';

  // Reflects the persisted "fingerprint" mode specifically, drives the
  // toggle switch on the login page.
  fingerprintToggleEnabled = false;

  // Direct reference to the native <input type="checkbox"> switch. It is
  // fully controlled: every tap is intercepted with preventDefault() so
  // the browser can never flip its checked state on its own - the visual
  // only ever follows fingerprintToggleEnabled. setFingerprintToggleVisual
  // remains the single commit point that keeps the model and the element
  // in sync in real time.
  @ViewChild('fingerprintToggle')
  private fingerprintToggleRef?: ElementRef<HTMLInputElement>;


  // =========================================
  // LOGIN TOAST
  // =========================================

  isLoginToastOpen = false;

  loginToastMessage = '';


  // =========================================
  // FORGOT PASSWORD
  // =========================================

  resetEmail = '';
  isSendingReset = false;
  resetMessage: string | null = null;
  resetErrorMessage: string | null = null;

  resendCooldown = 0;

  private cooldownInterval?: ReturnType<typeof setInterval>;


  // =========================================
  // DISABLE FINGERPRINT CONFIRMATION
  // =========================================

  showDisableConfirm = false;


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
      fingerPrintOutline,
      scanOutline,
      arrowBackOutline,
      moonOutline,
      sunnyOutline
    });

    this.isDarkMode = this.themeService.getIsDarkMode();

    this.themeSubscription = this.themeService.darkMode$.subscribe(
      (isDark) => {
        this.isDarkMode = isDark;
      }
    );

  }


  // =========================================
  // INITIALIZATION
  // =========================================

  async ngOnInit(): Promise<void> {

    const mode =
      (await Preferences.get({
        key: BIOMETRIC_MODE_KEY
      })).value;

    // Drives the toggle switch regardless of whether auto-login below
    // ends up running. This is the very first render, so the [checked]
    // binding alone is sufficient here - no ViewChild correction needed
    // yet, since the element hasn't rendered with a conflicting user
    // interaction at this point.
    this.fingerprintToggleEnabled = mode === 'fingerprint';

    const isEnabled =
      await this.biometricLockService.isEnabled();

    const hasSavedLogin =
      await this.biometricLockService.hasSavedLogin();


    if (
      !isEnabled ||
      !hasSavedLogin ||
      (mode !== 'fingerprint' && mode !== 'face')
    ) {
      return;
    }


    this.biometricMode = mode;


    this.biometricLoginAvailable =
      await this.biometricLockService
        .verifyBiometricIsAvailable(
          this.biometricMode
        );


    if (this.biometricLoginAvailable) {

      await this.loginWithBiometrics();

    }

  }


  // =========================================
  // PASSWORD VISIBILITY
  // =========================================

  togglePassword(): void {

    this.showPassword =
      !this.showPassword;

  }


  // =========================================
  // THEME
  // =========================================

  toggleTheme(): void {

    this.themeService.toggleTheme();

  }


  // =========================================
  // LOGIN ERROR / INFO TOAST
  // =========================================

  private showLoginError(message: string): void {

    this.loginToastMessage = message;

    // Close the toast first so it can be
    // reopened even if another message occurred
    // immediately before this one.
    this.isLoginToastOpen = false;


    setTimeout(() => {

      this.isLoginToastOpen = true;

    });

  }


  // =========================================
  // NORMAL LOGIN
  // =========================================

  async login(): Promise<void> {

    // -----------------------------------------
    // VALIDATION
    // -----------------------------------------

    if (!this.email || !this.password) {

      this.showLoginError(
        'Please enter both email and password.'
      );

      return;

    }


    this.isLoading = true;


    try {

      // -----------------------------------------
      // AUTHENTICATE
      // -----------------------------------------

      await this.authService.login(
        this.email,
        this.password
      );


      // -----------------------------------------
      // SAVE LOGIN FOR BIOMETRIC LOGIN
      // -----------------------------------------

      await this.biometricLockService.saveLoginCredentials(
        this.email,
        this.password
      );


      // -----------------------------------------
      // GO TO HOME
      // -----------------------------------------

      await this.router.navigateByUrl(
        '/home',
        {
          replaceUrl: true
        }
      );

    } catch (error) {

      console.error(
        'Login failed:',
        error
      );

      this.showLoginError(
        this.authService.getErrorMessage(error)
      );

    } finally {

      this.isLoading = false;

    }

  }


  // =========================================
  // BIOMETRIC LOGIN
  // =========================================

  async loginWithBiometrics(): Promise<void> {

    if (
      this.isLoading ||
      this.isBiometricLoading
    ) {

      return;

    }


    this.isBiometricLoading = true;


    try {

      await this.biometricLockService.loginWithBiometrics(
        this.biometricMode
      );

      await this.router.navigateByUrl(
        '/home',
        {
          replaceUrl: true
        }
      );

    } catch (error) {

      this.showLoginError(
        'Biometric login was cancelled or could not be completed.'
      );

      console.warn(
        'Biometric login failed:',
        error
      );

    } finally {

      this.isBiometricLoading = false;

    }

  }


  // =========================================
  // FINGERPRINT TOGGLE (login page)
  // =========================================

  // Sets both the Angular model AND the native checkbox's checked
  // property, so the visual switch always reflects the committed state
  // in real time - the single write point for the login-page toggle.
  private setFingerprintToggleVisual(value: boolean): void {

    this.fingerprintToggleEnabled = value;

    const toggleEl = this.fingerprintToggleRef?.nativeElement;

    if (toggleEl) {

      toggleEl.checked = value;

    }

  }


  // =========================================================
  // FINGERPRINT TOGGLE TAP (login page)
  // =========================================================
  //
  // The login-page switch is a fully-controlled native checkbox. The
  // browser is NEVER allowed to flip it by itself: we always call
  // preventDefault() so the checked state cannot change from the tap -
  // it only ever changes when WE commit fingerprintToggleEnabled via
  // setFingerprintToggleVisual. This guarantees the toggle can never be
  // left visually out of sync with the persisted state in real time.
  onFingerprintToggleTap(event: Event): void {

    // Never let the checkbox toggle natively.
    event.preventDefault();

    // While the disable-confirmation modal is open the overlay blocks
    // the switch, but guard anyway against any spurious re-entry.
    if (this.showDisableConfirm) {
      return;
    }

    // =========================================================
    // FINGERPRINT IS OFF - cannot enable from the Login page
    // =========================================================

    if (!this.fingerprintToggleEnabled) {

      this.showLoginError(
        'To re-enable fingerprint login, please log in and turn it on from Settings.'
      );

      return;
    }

    // =========================================================
    // FINGERPRINT IS ON - user tapped to turn it OFF
    // =========================================================

    // Switch stays visually ON (preventDefault already kept it there).
    // Only Confirm actually disables it.
    this.showDisableConfirm = true;

  }

  cancelDisableFingerprint(): void {

    // Close popup
    this.showDisableConfirm = false;

    // Fingerprint was NOT disabled.
    // Keep the switch ON - explicitly forced, so it can't be left
    // showing OFF from the user's original tap.
    this.setFingerprintToggleVisual(true);

  }

  async confirmDisableFingerprint(): Promise<void> {

    this.showDisableConfirm = false;

    try {

      // Disable biometric authentication
      await this.biometricLockService.setEnabled(false);

      // Remove saved login credentials
      await this.biometricLockService.clearSavedLogin();

      // Persist biometric mode as OFF
      await Preferences.set({
        key: BIOMETRIC_MODE_KEY,
        value: 'off'
      });

      // Only turn the UI toggle OFF AFTER
      // everything has successfully been disabled.
      this.setFingerprintToggleVisual(false);

      this.biometricLoginAvailable = false;

    } catch (error) {

      console.error(
        'Failed to disable fingerprint login:',
        error
      );

      // If anything failed, fingerprint stays enabled.
      this.setFingerprintToggleVisual(true);

      this.showLoginError(
        'Could not disable fingerprint login. Please try again.'
      );

    }

  }


  // =========================================
  // FORGOT PASSWORD
  // =========================================

  showForgotPassword(): void {

    this.view = 'forgot';
    this.resetEmail = this.email;
    this.resetMessage = null;
    this.resetErrorMessage = null;

  }


  backToLogin(): void {

    this.view = 'login';

  }


  async sendResetEmail(): Promise<void> {

    if (!this.resetEmail.trim()) {

      this.resetErrorMessage = 'Please enter your email address.';
      return;

    }

    this.isSendingReset = true;
    this.resetErrorMessage = null;
    this.resetMessage = null;

    try {

      await this.authService.sendPasswordReset(
        this.resetEmail.trim()
      );

      this.resetMessage =
        'If an account exists for this email, a password reset link has been sent. Check your inbox (and spam folder).';

      this.startResendCooldown();

    } catch (error: any) {

      if (error?.code === 'auth/invalid-email') {

        this.resetErrorMessage = 'Please enter a valid email address.';

      } else {

        this.resetMessage =
          'If an account exists for this email, a password reset link has been sent. Check your inbox (and spam folder).';

        this.startResendCooldown();

      }

    } finally {

      this.isSendingReset = false;

    }

  }


  // =========================================
  // RESEND COOLDOWN
  // =========================================

  private startResendCooldown(): void {

    this.resendCooldown = 30;

    this.clearCooldownTimer();

    this.cooldownInterval = setInterval(() => {

      this.resendCooldown -= 1;

      if (this.resendCooldown <= 0) {

        this.clearCooldownTimer();

      }

    }, 1000);

  }


  private clearCooldownTimer(): void {

    if (this.cooldownInterval) {

      clearInterval(this.cooldownInterval);
      this.cooldownInterval = undefined;

    }

  }

  ngOnDestroy(): void {

    this.clearCooldownTimer();
    this.themeSubscription?.unsubscribe();
  }

}