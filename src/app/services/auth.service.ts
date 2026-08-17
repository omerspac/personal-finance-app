import { Injectable } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  User,
  authState
} from '@angular/fire/auth';
import { Observable } from 'rxjs';

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

    await signOut(this.auth);

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

      case 'auth/too-many-requests':
        return 'Too many attempts. Please try again later.';

      default:
        return 'Something went wrong. Please try again.';

    }

  }

}