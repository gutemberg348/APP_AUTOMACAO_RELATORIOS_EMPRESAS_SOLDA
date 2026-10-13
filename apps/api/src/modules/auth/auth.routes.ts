import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireAuth } from '../../middlewares/auth';
import { authController } from './auth.controller';
const throttle = (limit: number) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: 'RATE_LIMIT', message: 'Muitas tentativas. Aguarde alguns minutos.' },
    },
  });
export const authRoutes = Router();
authRoutes.post('/login', throttle(20), authController.login);
authRoutes.post('/refresh', throttle(120), authController.refresh);
authRoutes.post('/logout', throttle(120), authController.logout);
authRoutes.get('/me', requireAuth, authController.me);
