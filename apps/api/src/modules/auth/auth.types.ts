import type { CurrentUser } from '@weldcosta/shared';
declare global {
  // Express request augmentation uses the namespace supplied by @types/express.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: CurrentUser;
    }
  }
}
export {};
