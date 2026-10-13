import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';
config({ path: '../../.env', quiet: true });
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: {
    url:
      process.env.DATABASE_URL ?? 'postgresql://weldcosta:local_change_me@localhost:5434/weldcosta',
  },
});
