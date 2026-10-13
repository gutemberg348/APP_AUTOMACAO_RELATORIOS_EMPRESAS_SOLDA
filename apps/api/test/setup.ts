import { randomBytes } from 'node:crypto';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= randomBytes(48).toString('hex');
process.env.REFRESH_TOKEN_SECRET ??= randomBytes(48).toString('hex');
process.env.DATABASE_URL ??= 'postgresql://unused:unused@localhost:1/weldcosta_test';
