import { config } from 'dotenv';
import { z } from 'zod';
config({ path: '../../.env', quiet: true });
const duration = z.string().regex(/^\d+[smhd]$/);
export const env = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: duration.default('15m'),
    REFRESH_TOKEN_SECRET: z.string().min(32),
    REFRESH_TOKEN_EXPIRES_IN: duration.default('7d'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3301),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(3).default(0),
    CORS_ORIGIN: z.string().default('http://localhost:8085,http://127.0.0.1:8085'),
    STORAGE_PATH: z.string().default('../../storage'),
    PDF_CHROME_EXECUTABLE: z.string().optional(),
    PDF_DISABLE_SANDBOX: z.enum(['true', 'false']).default('false'),
  })
  .refine((value) => value.JWT_SECRET !== value.REFRESH_TOKEN_SECRET, {
    message: 'Os segredos de acesso e refresh devem ser diferentes.',
    path: ['REFRESH_TOKEN_SECRET'],
  })
  .parse(process.env);
export function durationSeconds(value: string) {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) throw new Error('Invalid duration');
  return Number(match[1]) * ({ s: 1, m: 60, h: 3600, d: 86400 }[match[2] ?? 's'] ?? 1);
}
