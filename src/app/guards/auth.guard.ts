import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../services/auth.service';

// Protects app pages: redirects to /login if not signed in.
export const authGuard: CanActivateFn = async () => {

  const authService = inject(AuthService);
  const router = inject(Router);

  const user = await firstValueFrom(authService.user$);

  if (user) {
    return true;
  }

  return router.parseUrl('/login');

};

// Protects the login page: redirects already-signed-in users straight to
// /home, so the back button (or a stale bookmark/history entry) can never
// reveal the login form while a session is active.
export const guestGuard: CanActivateFn = async () => {

  const authService = inject(AuthService);
  const router = inject(Router);

  const user = await firstValueFrom(authService.user$);

  if (!user) {
    return true;
  }

  return router.parseUrl('/home');

};