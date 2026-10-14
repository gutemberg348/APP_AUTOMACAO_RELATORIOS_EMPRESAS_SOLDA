const bcrypt = require('bcryptjs');

async function resetAdminPassword(prisma, env = process.env) {
  const email = (env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = env.ADMIN_PASSWORD ?? '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error('Preencha ADMIN_EMAIL no .env.production real.');
  if (password.length < 12 || Buffer.byteLength(password) > 72)
    throw new Error('ADMIN_PASSWORD deve ter ao menos 12 caracteres e no máximo 72 bytes.');
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { email }, include: { role: true } });
    if (!user)
      throw new Error('Administrador não encontrado. Confira o e-mail atual da conta em ADMIN_EMAIL.');
    if (user.role.code !== 'ADMIN')
      throw new Error('Esse e-mail pertence a outra função. Confira ADMIN_EMAIL.');
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash, status: 'ACTIVE', deletedAt: null, authVersion: { increment: 1 } },
    });
    await tx.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: 'RESET_ADMIN_PASSWORD_FROM_ENV',
        entity: 'User',
        entityId: user.id,
      },
    });
  });
  return email;
}

module.exports = { resetAdminPassword };

// Supports both `node scripts/reset-admin-password.cjs` and piping into Docker's node.
if (!module.parent) {
  let prisma;
  (async () => {
    if (!process.env.DATABASE_URL)
      throw new Error('Execute este comando dentro do container da API.');
    const path = require('node:path');
    const { PrismaClient } = require(
      path.join(process.cwd(), 'apps/api/dist/generated/prisma/client.js'),
    );
    const { PrismaPg } = require('@prisma/adapter-pg');
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    const email = await resetAdminPassword(prisma);
    console.log(`Senha atualizada para ${email}. Entre usando ADMIN_PASSWORD do .env.production.`);
  })()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (prisma) await prisma.$disconnect();
    });
}
