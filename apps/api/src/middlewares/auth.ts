import type { RequestHandler } from 'express';
import { hasPermission, type PermissionCode } from '@weldcosta/shared';
import { AppError } from '../errors/app-error';
import { authService } from '../modules/auth/auth.service';
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    throw new AppError(401, 'AUTH_REQUIRED', 'Entre para acessar o sistema.');
  req.user = await authService.authenticate(header.slice(7));
  next();
};
export const requirePermission =
  (permission: PermissionCode): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !hasPermission(req.user.permissions, permission))
      throw new AppError(403, 'FORBIDDEN', 'Você não possui permissão para esta ação.');
    next();
  };
