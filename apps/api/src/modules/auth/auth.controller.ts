import type { Request, Response } from 'express';
import { loginSchema, refreshSchema } from '@weldcosta/shared';
import { send } from '../../utils/http';
import { authService } from './auth.service';
export const authController = {
  async login(req: Request, res: Response) {
    const input = loginSchema.parse(req.body);
    send(res, await authService.login(input.email, input.password));
  },
  async refresh(req: Request, res: Response) {
    send(res, await authService.refresh(refreshSchema.parse(req.body).refreshToken));
  },
  async logout(req: Request, res: Response) {
    send(res, await authService.logout(refreshSchema.parse(req.body).refreshToken));
  },
  me(req: Request, res: Response) {
    send(res, req.user);
  },
};
