import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router)
  const authenticated = authService.checkIsTokenValid();
  if(authenticated)
    return true;
  authService.markTokenInvalid();
  return router.parseUrl('/login');
};
