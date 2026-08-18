import { Component, OnDestroy, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ToggleCustomEvent } from '@ionic/angular';
import { Preferences } from '@capacitor/preferences';

import {
  // IonContent,
  IonIcon,
  IonToggle,
  IonToast
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';

import {
  moonOutline,
  fingerPrintOutline,
  scanOutline,
  eyeOutline,
  notificationsOutline,
  downloadOutline,
  cloudOutline,
  walletOutline,
  chevronForwardOutline,
  logOutOutline
} from 'ionicons/icons';

import { ThemeService } from '../services/theme.service';
import { AuthService } from '../services/auth.service';
import { DatabaseService } from '../services/database.service';
import { ExportService } from '../services/export.service';
import { NotificationService } from '../services/notification.service';
import { SyncService } from '../services/sync.service';
import { BiometricLockService } from '../services/biometric-lock.service';

import { Subscription } from 'rxjs';

const NOTIFICATIONS_PREFERENCE_KEY = 'omfin_notifications_enabled';
const BIOMETRIC_MODE_KEY = 'omfin_biometric_mode';


@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  imports: [
    // IonContent,
    IonIcon,
    IonToggle,
    CommonModule,
    FormsModule,
    IonToast
  ]
})
export class SettingsPage implements OnInit, OnDestroy {

isDarkMode = false;

  fingerprintEnabled = false;

  faceLockEnabled = false;

  // True while a biometric enable/disable operation is running, so taps
  // during the native prompt are ignored and can never spawn duplicate
  // authentication calls.
  fingerprintPending = false;

  notificationsEnabled = false;

  isExporting = false;

  isSyncing = false;

  isSyncToastOpen = false;

  syncToastMessage = '';

  syncToastType: 'sync-success' | 'sync-error' = 'sync-success';

  private themeSubscription?: Subscription;

  // Direct reference to the native <input type="checkbox"> switch. It is
  // fully controlled: every tap is intercepted with preventDefault() so
  // the browser can never flip its checked state on its own - the visual
  // only ever follows fingerprintEnabled. setFingerprintToggleVisual
  // remains the single commit point that keeps the model and the element
  // in sync in real time.
  @ViewChild('fingerprintToggle')
  private fingerprintToggleRef?: ElementRef<HTMLInputElement>;


  constructor(
    private router: Router,
    private themeService: ThemeService,
    private authService: AuthService,
    private databaseService: DatabaseService,
    private exportService: ExportService,
    private notificationService: NotificationService,
    private syncService: SyncService,
    private biometricLockService: BiometricLockService
  ) {

    addIcons({
      moonOutline,
      fingerPrintOutline,
      scanOutline,
      eyeOutline,
      notificationsOutline,
      downloadOutline,
      cloudOutline,
      walletOutline,
      chevronForwardOutline,
      logOutOutline
    });


    this.isDarkMode =
      this.themeService.getIsDarkMode();


    this.themeSubscription =
      this.themeService.darkMode$.subscribe(
        (isDark) => {

          this.isDarkMode = isDark;

        }
      );

  }

  async ngOnInit(): Promise<void> {

    const stored = await Preferences.get({
      key: NOTIFICATIONS_PREFERENCE_KEY
    });

    this.notificationsEnabled = stored.value === 'true';

    const modeResult = await Preferences.get({ key: BIOMETRIC_MODE_KEY });
    const mode = modeResult.value; // 'fingerprint' | 'face' | 'off' | null

    this.fingerprintEnabled = mode === 'fingerprint';
    this.faceLockEnabled = mode === 'face';
    
  }

  onThemeToggle(event: ToggleCustomEvent): void {

    this.themeService.setDarkMode(
      event.detail.checked
    );

  }


  // Sets both the Angular model AND the native checkbox's checked
  // property, so the visual switch always reflects the committed state
  // in real time - the single write point for the fingerprint toggle.
  private setFingerprintToggleVisual(value: boolean): void {

    this.fingerprintEnabled = value;

    const toggleEl = this.fingerprintToggleRef?.nativeElement;

    if (toggleEl) {

      toggleEl.checked = value;

    }

  }


  // =========================================================
  // FINGERPRINT TOGGLE TAP (Settings)
  // =========================================================
  //
  // The Fingerprint Lock switch is a fully-controlled native checkbox.
  // The browser is NEVER allowed to flip it by itself: we always call
  // preventDefault() so the checked state cannot change from the tap -
  // it only ever changes when WE commit fingerprintEnabled via
  // setFingerprintToggleVisual. Therefore the toggle always reflects the
  // FINAL result of the biometric operation, never the initial tap.
  async onFingerprintToggleTap(event: Event): Promise<void> {

    // Never let the checkbox toggle natively.
    event.preventDefault();

    // While a biometric operation is pending, ignore further taps so
    // duplicate authentication calls are never spawned.
    if (this.fingerprintPending) {
      return;
    }

    const wantsEnabled = !this.fingerprintEnabled;

    this.fingerprintPending = true;

    try {

      // =========================================================
      // ENABLE FINGERPRINT
      // =========================================================

      if (wantsEnabled) {

        // Make sure biometrics are actually available.
        const available =
          await this.biometricLockService.verifyBiometricIsAvailable(
            'fingerprint'
          );

        if (!available) {

          alert(
            'Fingerprint authentication is not available on this device.'
          );

          return;

        }

        // A single verifyIdentity() call (inside verifyForSetup)
        // encapsulates the native prompt's own retry UI for a wrong
        // scan - the promise only settles once the OS-level flow is
        // genuinely finished. We never call it a second time.
        //
        // While it is pending, the checkbox simply stays OFF (the
        // persisted state) - it only turns ON when authentication
        // ultimately succeeds, and turns OFF (stays OFF) on any final
        // failure or cancellation.
        const success =
          await this.biometricLockService.verifyForSetup('fingerprint');

        if (!success) {

          // Authentication failed / cancelled: fingerprintEnabled was
          // never changed, so the checkbox already reflects OFF. No
          // alert here - the native prompt already gave feedback.
          return;

        }

        // =====================================================
        // AUTHENTICATION SUCCESSFUL - NOW persist and enable
        // =====================================================

        await this.biometricLockService.setEnabled(true);

        // Store the current user's login credential (email/password or
        // Google ID token) so the login page can offer the fingerprint/
        // face prompt after a later logout.
        await this.biometricLockService.saveLoginForCurrentUser();

        await Preferences.set({
          key: BIOMETRIC_MODE_KEY,
          value: 'fingerprint'
        });

        // Only NOW turn the toggle ON.
        this.setFingerprintToggleVisual(true);

        // Fingerprint and face lock are mutually exclusive.
        this.faceLockEnabled = false;

        return;
      }

      // =========================================================
      // DISABLE FINGERPRINT
      // =========================================================

      await this.biometricLockService.setEnabled(false);

      await this.biometricLockService.clearSavedLogin();

      await Preferences.set({
        key: BIOMETRIC_MODE_KEY,
        value: 'off'
      });

      // Only turn OFF after successfully disabling it.
      this.setFingerprintToggleVisual(false);

    } catch (error) {

      console.error(
        'Failed to update fingerprint lock:',
        error
      );

      // Persisted state did NOT change, so re-assert the current
      // committed UI state - the UI and persisted state must agree.
      this.setFingerprintToggleVisual(this.fingerprintEnabled);

      alert(
        'Could not update fingerprint lock. Please make sure your device has fingerprint authentication set up and try again.'
      );

    } finally {

      this.fingerprintPending = false;

    }

  }


  async toggleFaceLock(): Promise<void> {

    const wantsEnabled = this.faceLockEnabled;

    if (wantsEnabled) {

      // Mutually exclusive with Fingerprint
      this.fingerprintEnabled = false;

    }

    await this.applyBiometricMode(
      wantsEnabled ? 'face' : 'off',
      () => { this.faceLockEnabled = !wantsEnabled; }
    );

  }


  // Shared logic: verify biometrics actually work before persisting "on",
  // persist the selected mode, and revert on failure.
  private async applyBiometricMode(
    mode: 'fingerprint' | 'face' | 'off',
    revert: () => void
  ): Promise<void> {

    try {

      if (mode !== 'off') {

        const available =
          await this.biometricLockService.verifyBiometricIsAvailable(mode);

        if (!available) {

          throw new Error(
            'Biometric authentication is not available on this device.'
          );

        }

        // Same dedicated setup-verification used by fingerprint above -
        // kept separate from attemptUnlock()/app-lock's failedAttempts.
        const success =
          await this.biometricLockService.verifyForSetup(mode);

        if (!success) {

          // The native prompt already handled retries and the user
          // cancelled or exhausted them — no need for our own alert
          // on top of it, that's what's ruining the UX.
          revert();
          return;

        }

        await this.biometricLockService.setEnabled(true);

        // Same as fingerprint: persist the login credential so the login
        // page can offer the biometric prompt after a later logout.
        await this.biometricLockService.saveLoginForCurrentUser();

      } else {

        await this.biometricLockService.setEnabled(false);
        await this.biometricLockService.clearSavedLogin();

      }

      await Preferences.set({
        key: BIOMETRIC_MODE_KEY,
        value: mode
      });

    } catch (error) {

      console.error(
        'Failed to update biometric lock:',
        error
      );

      revert();

      alert(
        'Could not enable this lock method. Please make sure your device has biometrics set up and try again.'
      );

    }

  }


  // =========================================================
  // NOTIFICATIONS
  // =========================================================

  async toggleNotifications(): Promise<void> {

    const wantsEnabled = this.notificationsEnabled;

    try {

      if (wantsEnabled) {

        await this.notificationService.enableReminderNotifications();

      } else {

        await this.notificationService.disableReminderNotifications();

      }

      await Preferences.set({
        key: NOTIFICATIONS_PREFERENCE_KEY,
        value: String(wantsEnabled)
      });

    } catch (error) {

      console.error(
        'Failed to update reminder notifications:',
        error
      );

      // Revert the toggle since the change failed
      this.notificationsEnabled = !wantsEnabled;

      alert(
        'Could not update payment reminders. Please check notification permissions and try again.'
      );

    }

  }


  // =========================================================
  // EXPORT
  // =========================================================

  async exportCSV(): Promise<void> {

    if (this.isExporting) {
      return;
    }

    this.isExporting = true;

    try {

      const transactions =
        await this.databaseService.getTransactions();

      if (transactions.length === 0) {

        alert('You have no transactions to export yet.');
        return;

      }

      await this.exportService.exportTransactionsToCsv(
        transactions
      );

    } catch (error) {

      console.error(
        'Failed to export transactions:',
        error
      );

      alert('Failed to export transactions. Please try again.');

    } finally {

      this.isExporting = false;

    }

  }


  // =========================================================
  // CLOUD SYNC
  // =========================================================

  async syncData(): Promise<void> {

  if (this.isSyncing) {
    return;
  }

  this.isSyncing = true;

  try {

    const result = await this.syncService.syncTransactions();

    this.syncToastMessage =
      `Sync complete. Uploaded ${result.pushed} and downloaded ${result.pulled} transaction(s).`;

    this.syncToastType = 'sync-success';
    this.isSyncToastOpen = true;

  } catch (error) {

    console.error(
      'Failed to sync data:',
      error
    );

    this.syncToastMessage =
      'Sync failed. Please make sure you are logged in and connected to the internet.';

    this.syncToastType = 'sync-error';
    this.isSyncToastOpen = true;

  } finally {

    this.isSyncing = false;

  }

}

  // =========================================================
  // LOGOUT
  // =========================================================

  async logout(): Promise<void> {

    try {

      await this.authService.logout();

    } catch (error) {

      console.error('Failed to log out:', error);

    } finally {

      try {

        // Close the current user's database so the next login opens a
        // fresh, user-scoped database and never shows the previous
        // account's local transactions.
        await this.databaseService.closeDatabase();

      } catch (closeError) {

        console.warn('Failed to close database on logout:', closeError);

      }

      this.router.navigateByUrl('/login', { replaceUrl: true });

    }

  }


  ngOnDestroy(): void {

    this.themeSubscription?.unsubscribe();

  }

}