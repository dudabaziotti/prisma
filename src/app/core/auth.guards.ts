import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Bloqueia páginas internas para quem não está logado. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await auth.currentUser();
  return user ? true : router.createUrlTree(['/login']);
};

/** Quem já está logado não precisa ver login nem cadastro. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await auth.currentUser();
  return user ? router.createUrlTree(['/feed']) : true;
};
