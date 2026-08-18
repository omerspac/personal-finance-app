import { Injectable } from '@angular/core';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithCredential,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  reload,
  User,
  authState
} from '@angular/fire/auth';
import { Observable } from 'rxjs';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

const INITIAL_SETUP_KEY = 'omfin_has_completed_initial_setup';
const GOOGLE_ID_TOKEN_KEY = 'omfin_google_id_token';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  readonly user$: Observable<User | null>;

  constructor(private auth: Auth) {
    this.user$ = authState(this.auth);
  }

  get currentUserEmail(): string | null {

    return this.auth.currentUser?.email ?? null;

  }

  get currentUser(): User | null {

    return this.auth.currentUser;

  }

  // =========================================================
  // EMAIL VERIFICATION
  // =========================================================
  //
  // After an email/password registration a verification email is sent so
  // the account can only be used once the address is confirmed to belong
  // to the person who signed up. Google sign-in accounts arrive
  // pre-verified and never need this.

  async sendEmailVerification(user: User): Promise<void> {

    await sendEmailVerification(user);

  }

  // Re-reads the user from Firebase so `emailVerified` reflects whether
  // the user actually clicked the link in the verification email.
  async refreshEmailVerificationStatus(user: User): Promise<void> {

    await reload(user);

  }

  // =========================================================
  // REGISTER
  // =========================================================

  async register(email: string, password: string): Promise<User> {

    const credential = await createUserWithEmailAndPassword(
      this.auth,
      email,
      password
    );

    return credential.user;

  }

  // =========================================================
  // GOOGLE SIGN-IN
  // =========================================================
  //
  // On native (Capacitor Android/iOS) the sign-in runs through the
  // native Google Sign-In SDK via @capacitor-firebase/authentication.
  // That avoids the Firebase web SDK OAuth redirect flow entirely, which
  // fails in the WebView with "Unable to process request due to missing
  // initial state" (storage-partitioned session).
  //
  // IMPORTANT: the native plugin only signs the user in on the NATIVE
  // layer of the app. The Firebase JS SDK (which user$ and every route
  // guard depend on) is a completely separate auth stack, so after the
  // native sign-in we must also sign in on the web/JS layer with the
  // returned ID token using signInWithCredential(). Without this the
  // user$ observable stays null and the guards keep redirecting /home
  // back to /login. In the browser (ionic serve) the plugin delegates to
  // the JS SDK anyway, so the standard popup flow is used there.

  async signInWithGoogle(): Promise<User> {

    if (Capacitor.isNativePlatform()) {

      const result = await FirebaseAuthentication.signInWithGoogle();

      // The native sign-in succeeded but the JS SDK is not yet aware of
      // it. Exchange the returned Google ID token for a JS SDK session,
      // so authState()/user$ picks up the user like any other sign-in.
      const idToken = result.credential?.idToken;

      if (!idToken) {
        throw new Error('Google sign-in was cancelled.');
      }

      // Persist the raw Google OAuth ID token (NOT a Firebase token) so
      // the biometric login flow can restore the session after a logout
      // via GoogleAuthProvider.credential(). It is only valid for about
      // an hour, but each new Google sign-in refreshes it.
      await Preferences.set({
        key: GOOGLE_ID_TOKEN_KEY,
        value: idToken
      });

      const googleCredential = GoogleAuthProvider.credential(idToken);

      const userCredential = await signInWithCredential(
        this.auth,
        googleCredential
      );

      return userCredential.user;

    }

    const provider = new GoogleAuthProvider();

    const credential = await signInWithPopup(
      this.auth,
      provider
    );

    // The popup flow also yields the raw Google OAuth ID token.
    const googleCredentialFromResult = GoogleAuthProvider.credentialFromResult(
      credential
    );

    if (googleCredentialFromResult?.idToken) {

      await Preferences.set({
        key: GOOGLE_ID_TOKEN_KEY,
        value: googleCredentialFromResult.idToken
      });

    }

    return credential.user;

  }

  // Returns the last Google OAuth ID token received from a sign-in. Used
  // by BiometricLockService to save a Google credential for the
  // fingerprint/face login flow. Returns null when the user never signed
  // in with Google.
  async getStoredGoogleIdToken(): Promise<string | null> {

    const result = await Preferences.get({ key: GOOGLE_ID_TOKEN_KEY });

    return result.value ?? null;

  }

  // =========================================================
  // LOGIN
  // =========================================================

  async login(email: string, password: string): Promise<User> {

    const credential = await signInWithEmailAndPassword(
      this.auth,
      email,
      password
    );

    return credential.user;

  }

  // Signs the Firebase JS SDK in with a Google ID token that was
  // previously stored (by BiometricLockService) as the biometric login
  // credential. Used by the fingerprint/face login path so a Google
  // account can be restored without showing the Google account picker
  // again.
  async loginWithGoogleIdToken(idToken: string): Promise<User> {

    const googleCredential = GoogleAuthProvider.credential(idToken);

    const userCredential = await signInWithCredential(
      this.auth,
      googleCredential
    );

    return userCredential.user;

  }

  // =========================================================
  // PASSWORD RESET
  // =========================================================

  async sendPasswordReset(email: string): Promise<void> {

    await sendPasswordResetEmail(this.auth, email);

  }

  // =========================================================
  // LOGOUT
  // =========================================================

  async logout(): Promise<void> {

    if (Capacitor.isNativePlatform()) {

      try {

        await FirebaseAuthentication.signOut();

      } catch (error) {

        console.warn(
          'Native sign-out failed:',
          error
        );

      }

    }

    await signOut(this.auth);

  }

  // =========================================================
  // FIRST-LAUNCH SETUP FLAG
  // =========================================================
  //
  // Determines whether the app should show the Register page (fresh
  // install) or the existing login flow (returning user). Only set via
  // a deliberate user action on the Register page: successful account
  // creation, or tapping "Already have an account? Login".

  async hasCompletedInitialSetup(): Promise<boolean> {

    const result = await Preferences.get({ key: INITIAL_SETUP_KEY });

    return result.value === 'true';

  }

  async markInitialSetupComplete(): Promise<void> {

    await Preferences.set({
      key: INITIAL_SETUP_KEY,
      value: 'true'
    });

  }

  // =========================================================
  // HUMAN-READABLE ERROR MESSAGES
  // =========================================================

  getErrorMessage(error: any): string {

    const code = error?.code ?? '';

    switch (code) {

      case 'auth/invalid-email':
        return 'Please enter a valid email address.';

      case 'auth/user-disabled':
        return 'This account has been disabled.';

      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Incorrect email or password.';

      case 'auth/email-already-in-use':
        return 'An account with this email already exists. Please log in instead.';

      case 'auth/weak-password':
        return 'Password is too weak. Please choose a stronger password.';

      case 'auth/missing-password':
        return 'Please enter a password.';

      case 'auth/operation-not-allowed':
        return 'This sign-in method is not enabled for this app.';

      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'Google sign-in was cancelled.';

      case 'auth/popup-blocked':
        return 'Google sign-in could not open. Please allow pop-ups and try again.';

      case 'auth/too-many-requests':
        return 'Too many attempts. Please try again later.';

      default:
        return 'Something went wrong. Please try again.';

    }

  }

}