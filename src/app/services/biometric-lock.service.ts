import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import { BiometryType, NativeBiometric } from 'capacitor-native-biometric';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';

const BIOMETRIC_ENABLED_KEY = 'omfin_biometric_enabled';
const BIOMETRIC_LOGIN_READY_KEY = 'omfin_biometric_login_ready';
const BIOMETRIC_CREDENTIAL_SERVER = 'omfin.app.login';
const MAX_FAILED_ATTEMPTS = 5;

@Injectable({
  providedIn: 'root'
})
export class BiometricLockService {

  private lockedSubject = new BehaviorSubject<boolean>(false);
  readonly isLocked$ = this.lockedSubject.asObservable();

  private failedAttempts = 0;
  private wasInBackground = false;
  private initialized = false;

  constructor(
    private router: Router,
    private authService: AuthService
  ) { }

  // =========================================================
  // INITIALIZATION - call once from AppComponent
  // =========================================================

  async initialize(): Promise<void> {

    if (this.initialized) {
      return;
    }

    this.initialized = true;

    App.addListener('appStateChange', async ({ isActive }) => {

      if (!isActive) {

        this.wasInBackground = true;
        return;

      }

      if (this.wasInBackground) {

        this.wasInBackground = false;
        await this.checkAndLock();

      }

    });

    // Cold launch check
    await this.checkAndLock();

  }

  private async checkAndLock(): Promise<void> {

    const enabled = await this.isEnabled();

    if (!enabled) {
      return;
    }

    // Wait for Firebase auth state to resolve before deciding whether
    // there's actually a logged-in session worth locking.
    const user = await firstValueFrom(this.authService.user$);

    if (user) {

      this.failedAttempts = 0;
      this.lockedSubject.next(true);

    }

  }

  // =========================================================
  // PREFERENCE
  // =========================================================

  async isEnabled(): Promise<boolean> {

    const result = await Preferences.get({ key: BIOMETRIC_ENABLED_KEY });
    return result.value === 'true';

  }

  async setEnabled(enabled: boolean): Promise<void> {

    await Preferences.set({
      key: BIOMETRIC_ENABLED_KEY,
      value: String(enabled)
    });

  }

  async hasSavedLogin(): Promise<boolean> {

    const result = await Preferences.get({ key: BIOMETRIC_LOGIN_READY_KEY });
    return result.value === 'true';

  }

  async saveLoginCredentials(email: string, password: string): Promise<void> {

    if (!await this.isEnabled()) {
      return;
    }

    await NativeBiometric.setCredentials({
      username: email,
      password,
      server: BIOMETRIC_CREDENTIAL_SERVER
    });

    await Preferences.set({
      key: BIOMETRIC_LOGIN_READY_KEY,
      value: 'true'
    });

  }

  async clearSavedLogin(): Promise<void> {

    try {
      await NativeBiometric.deleteCredentials({
        server: BIOMETRIC_CREDENTIAL_SERVER
      });
    } finally {
      await Preferences.remove({ key: BIOMETRIC_LOGIN_READY_KEY });
    }

  }

  async loginWithBiometrics(mode: 'fingerprint' | 'face'): Promise<void> {

    await NativeBiometric.verifyIdentity({
      reason: 'Log in to OmFin',
      title: mode === 'face' ? 'Face Lock Login' : 'Fingerprint Login',
      subtitle: 'Confirm your identity to log in',
      description: mode === 'face' ? 'Scan your face to log in' : 'Scan your fingerprint to log in',
      useFallback: false
    });

    const credentials = await NativeBiometric.getCredentials({
      server: BIOMETRIC_CREDENTIAL_SERVER
    });

    await this.authService.login(credentials.username, credentials.password);

  }

  // =========================================================
  // AVAILABILITY
  // =========================================================

  async verifyBiometricIsAvailable(
    mode?: 'fingerprint' | 'face'
  ): Promise<boolean> {

    try {

      const result = await NativeBiometric.isAvailable();
      if (!result.isAvailable || !mode) {
        return result.isAvailable;
      }

      const supportedTypes = mode === 'face'
        ? [BiometryType.FACE_ID, BiometryType.FACE_AUTHENTICATION, BiometryType.MULTIPLE]
        : [BiometryType.TOUCH_ID, BiometryType.FINGERPRINT, BiometryType.MULTIPLE];

      return supportedTypes.includes(result.biometryType);

    } catch {

      return false;

    }

  }

  // =========================================================
  // VERIFY FOR SETUP (Settings "enable" flow)
  // =========================================================
  //
  // IMPORTANT: this is intentionally separate from attemptUnlock() below.
  // attemptUnlock() drives the app-lock screen's 5-strike forced-logout
  // behavior — a failed *enable* attempt in Settings has nothing to do
  // with that, and must never contribute to it or trigger a forced logout.
  //
  // The Android side of the plugin (AuthActivity) only allows retries
  // inside one prompt session when `maxAttempts` is passed explicitly.
  // Its default is 1, which means the FIRST failed scan immediately
  // finishes the auth activity and rejects the promise - even though the
  // system BiometricPrompt dialog is still on screen and would accept a
  // correct scan. We therefore pass maxAttempts: 5 so a wrong first scan
  // does NOT settle the promise: the same native session stays open for
  // retries, and the promise resolves only on real success, or rejects
  // only when the session truly ends (user cancel, device lockout, or
  // all attempts used). We never call verifyIdentity() a second time.
  // (maxAttempts is ignored on iOS, where the system prompt does not
  // offer retries in the same session.)
  //
  // A single verifyIdentity() call is trusted to encapsulate the native
  // OS-level biometric prompt, including its own internal retry UI for
  // a wrong scan - the promise settles only once the native flow is
  // genuinely finished.

  async verifyForSetup(mode: 'fingerprint' | 'face'): Promise<boolean> {

    try {

      await NativeBiometric.verifyIdentity({
        reason: 'Enable biometric login',
        title: mode === 'face' ? 'Enable Face Lock' : 'Enable Fingerprint Lock',
        subtitle: 'Confirm your identity to continue',
        description: mode === 'face'
          ? 'Scan your face to enable Face Lock'
          : 'Scan your fingerprint to enable Fingerprint Lock',
        useFallback: false,
        maxAttempts: 5
      });

      return true;

    } catch (error) {

      console.warn(
        'Biometric setup verification failed:',
        error
      );

      return false;

    }

  }

  // =========================================================
  // UNLOCK ATTEMPT (app-lock screen only - unchanged)
  // =========================================================

  async attemptUnlock(): Promise<{ success: boolean; loggedOut: boolean }> {

    try {

      await NativeBiometric.verifyIdentity({
        reason: 'Unlock OmFin',
        title: 'Biometric Unlock',
        subtitle: 'Confirm your identity to continue',
        description: 'Use your fingerprint or Face ID',
        useFallback: false
      });

      this.failedAttempts = 0;
      this.lockedSubject.next(false);

      return { success: true, loggedOut: false };

    } catch (error) {

      this.failedAttempts += 1;

      if (this.failedAttempts >= MAX_FAILED_ATTEMPTS) {

        await this.forceLogout();
        return { success: false, loggedOut: true };

      }

      return { success: false, loggedOut: false };

    }

  }

  get remainingAttempts(): number {

    return Math.max(0, MAX_FAILED_ATTEMPTS - this.failedAttempts);

  }

  private async forceLogout(): Promise<void> {

    this.failedAttempts = 0;
    this.lockedSubject.next(false);

    try {

      await this.authService.logout();

    } catch (error) {

      console.error(
        'Failed to log out after max biometric attempts:',
        error
      );

    }

    // Require the user to deliberately re-enable it after a lockout,
    // rather than silently re-locking them out again on next login.
    await this.setEnabled(false);

    this.router.navigateByUrl('/login', { replaceUrl: true });

  }

}