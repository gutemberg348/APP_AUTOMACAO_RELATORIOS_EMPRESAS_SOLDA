import { app } from './app';
import { env } from './config/env';
import { prisma } from './prisma/client';
const server = app.listen(env.PORT, '0.0.0.0', () =>
  console.log(`Weldcosta API disponível na porta ${env.PORT}`),
);
const shutdown = () =>
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
