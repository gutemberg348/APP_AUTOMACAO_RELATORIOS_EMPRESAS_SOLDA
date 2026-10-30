import { config } from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { permissions, rolePermissions, userRoleLabels } from '@weldcosta/shared';
config({ path: '../../.env', quiet: true });
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
async function seed() {
  for (const code of permissions)
    await prisma.permission.upsert({ where: { code }, create: { code }, update: {} });
  for (const [code, granted] of Object.entries(rolePermissions)) {
    const role = await prisma.role.upsert({
      where: { code },
      create: { code, name: userRoleLabels[code] ?? code },
      update: { name: userRoleLabels[code] ?? code },
    });
    const matching = await prisma.permission.findMany({ where: { code: { in: [...granted] } } });
    await prisma.rolePermission.deleteMany({
      where: {
        roleId: role.id,
        permissionId: { notIn: matching.map((permission) => permission.id) },
      },
    });
    for (const permission of matching)
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      });
  }
  const types = {
    EVS: 'Ensaio Visual / Endoscopia',
    EVD: 'Ensaio Visual Direto',
    LP: 'Líquido Penetrante',
    TH: 'Teste Hidrostático',
    ME: 'Medição de Espessura',
    RDO: 'Relatório Diário de Inspeção',
  };
  for (const [code, name] of Object.entries(types))
    await prisma.reportType.upsert({
      where: { code },
      create: { code, name, config: { submissionRequiredKeys: [], editableFieldsByRoleCode: {} } },
      update: {},
    });
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    if (
      process.env.ADMIN_PASSWORD.length < 12 ||
      Buffer.byteLength(process.env.ADMIN_PASSWORD) > 72
    )
      throw new Error('ADMIN_PASSWORD deve ter ao menos 12 caracteres e no máximo 72 bytes.');
    const role = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } });
    const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
    const existingAdmin = await prisma.user.findFirst({ where: { roleId: role.id } });
    if (!existingAdmin)
      await prisma.user.upsert({
        where: { email },
        create: {
          name: 'Administrador',
          email,
          passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12),
          roleId: role.id,
        },
        update: {},
      });
    console.log(
      existingAdmin
        ? 'Administrador já configurado. Cadastros, e-mails e senhas do painel preservados.'
        : 'Administrador inicial provisionado pelo ENV (senha existente preservada).',
    );
  } else console.log('ADMIN_EMAIL/ADMIN_PASSWORD ausentes: nenhum administrador criado.');
  console.log('Seed concluído: cargos, permissões e tipos. Nenhum dado dos PDFs foi importado.');
}
seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
