import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../services/auth.service';

// Protects app pages: redirects to /login if not signed in. On a fresh
// install (initial setup not yet completed) the user is sent to /register
// instead, so first launch always lands on the Register page. Signed-in
// users whose email has not been verified yet are sent to /verify-email
// so they confirm the address before entering the app.
export const authGuard: CanActivateFn = async () => {

  const authService = inject(AuthService);
  const router = inject(Router);

  const user = await firstValueFrom(authService.user$);

  if (user) {

    if (!user.emailVerified) {

      return router.parseUrl('/verify-email');

    }

    return true;

  }

  const completedSetup =
    await authService.hasCompletedInitialSetup();

  return router.parseUrl(
    completedSetup ? '/login' : '/register'
  );

};

// Protects the login page: redirects already-signed-in users straight to
// /home, so the back button (or a stale bookmark/history entry) can never
// reveal the login form while a session is active. On a fresh install the
// user is sent to /register instead of the login form. Signed-in users
// with an unverified email are sent to /verify-email.
export const guestGuard: CanActivateFn = async () => {

  const authService = inject(AuthService);
  const router = inject(Router);

  const user = await firstValueFrom(authService.user$);

  if (user) {

    if (!user.emailVerified) {

      return router.parseUrl('/verify-email');

    }

    return router.parseUrl('/home');

  }

  const completedSetup =
    await authService.hasCompletedInitialSetup();

  if (completedSetup) {
    return true;
  }

  return router.parseUrl('/register');

};

// Protects the register page. Signed-in users always go straight to
// /home (unverified ones to /verify-email). Otherwise the page is shown
// to anyone, whether they arrived here from the first-launch flow
// (initial setup not yet completed) or via the "Create account" link on
// the login page.
export const registerGuard: CanActivateFn = async () => {

  const authService = inject(AuthService);
  const router = inject(Router);

  const user = await firstValueFrom(authService.user$);

  if (user) {

    if (!user.emailVerified) {

      return router.parseUrl('/verify-email');

    }

    return router.parseUrl('/home');

  }

  return true;

};


// Protects the email-verification page. Only signed-in users with an
// UNVERIFIED email may stay here; verified users go straight to /home
// and signed-out visitors to the login flow.
export const verifyEmailGuard: CanActivateFn = async () => {

  const authService = inject(AuthService);
  const router = inject(Router);

  const user = await firstValueFrom(authService.user$);

  if (!user) {

    const completedSetup =
      await authService.hasCompletedInitialSetup();

    return router.parseUrl(
      completedSetup ? '/login' : '/register'
    );

  }

  if (user.emailVerified) {

    return router.parseUrl('/home');

  }

  return true;

};