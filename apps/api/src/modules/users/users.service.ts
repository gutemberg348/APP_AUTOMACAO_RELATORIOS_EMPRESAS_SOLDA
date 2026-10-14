import bcrypt from 'bcryptjs';
import {
  userRoleLabels,
  type userCreateSchema,
  type userUpdateSchema,
  type userListSchema,
} from '@weldcosta/shared';
import type { z } from 'zod';
import { Prisma, type UserStatus } from '../../generated/prisma/client';
import { prisma } from '../../prisma/client';
import { AppError } from '../../errors/app-error';
import { pageResult } from '../../utils/http';

const select = {
  id: true,
  name: true,
  email: true,
  phone: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  role: { select: { id: true, code: true, name: true } },
} satisfies Prisma.UserSelect;
type Tx = Prisma.TransactionClient;
const missing = () => new AppError(404, 'NOT_FOUND', 'Usuário não encontrado. Atualize a lista.');

export async function userWriteTransaction<T>(work: (tx: Tx) => Promise<T>) {
  try {
    return await prisma.$transaction(work, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2034')
        throw new AppError(
          409,
          'VERSION_CONFLICT',
          'O cadastro mudou durante esta ação. Atualize a lista e tente novamente.',
        );
      if (error.code === 'P2002')
        throw new AppError(
          409,
          'EMAIL_IN_USE',
          'Esse e-mail já está cadastrado. Busque o usuário ou confira a aba Excluídos para restaurá-lo.',
        );
    }
    throw error;
  }
}
const transaction = userWriteTransaction;
async function role(tx: Tx, id: string) {
  const found = await tx.role.findUnique({ where: { id } });
  if (!found || !userRoleLabels[found.code])
    throw new AppError(400, 'INVALID_ROLE', 'Selecione um perfil de acesso válido.');
  return found;
}
async function current(tx: Tx, id: string, updatedAt: string, deleted = false) {
  const user = await tx.user.findUnique({ where: { id }, include: { role: true } });
  if (!user || !!user.deletedAt !== deleted) throw missing();
  if (user.updatedAt.toISOString() !== updatedAt)
    throw new AppError(
      409,
      'VERSION_CONFLICT',
      'Este usuário foi alterado. Atualize o cadastro antes de salvar.',
    );
  return user;
}
async function protectAdmin(
  tx: Tx,
  user: { id: string; status: UserStatus; role: { code: string } },
  actorId: string,
  removesAccess: boolean,
) {
  if (!removesAccess) return;
  if (user.id === actorId)
    throw new AppError(
      409,
      'SELF_ACCESS_CHANGE',
      'Você não pode inativar, excluir ou retirar seu próprio perfil de administrador. Use outra conta administradora.',
    );
  if (
    user.status === 'ACTIVE' &&
    user.role.code === 'ADMIN' &&
    (await tx.user.count({
      where: { status: 'ACTIVE', deletedAt: null, role: { code: 'ADMIN' } },
    })) <= 1
  )
    throw new AppError(
      409,
      'LAST_ADMIN',
      'Mantenha pelo menos um administrador ativo. Cadastre ou ative outro administrador primeiro.',
    );
}
async function audit(tx: Tx, actorId: string, id: string, action: string) {
  await tx.auditLog.create({ data: { userId: actorId, entity: 'User', entityId: id, action } });
}
async function revoke(tx: Tx, id: string) {
  await tx.refreshToken.updateMany({
    where: { userId: id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function createUserRecord(
  tx: Tx,
  data: z.infer<typeof userCreateSchema>,
  actorId: string,
  passwordHash: string,
) {
  await role(tx, data.roleId);
  const user = await tx.user.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      roleId: data.roleId,
      passwordHash,
    },
    select,
  });
  await audit(tx, actorId, user.id, 'CREATE_USER');
  return user;
}

export const usersService = {
  roles() {
    return prisma.role.findMany({
      where: { code: { in: Object.keys(userRoleLabels) } },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });
  },
  async list(query: z.infer<typeof userListSchema>) {
    const where: Prisma.UserWhereInput = {
      deletedAt: query.status === 'DELETED' ? { not: null } : null,
      ...(query.status && query.status !== 'DELETED' ? { status: query.status } : {}),
      ...(query.roleId ? { roleId: query.roleId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
      }),
      prisma.user.count({ where }),
    ]);
    return pageResult(items, total, query);
  },
  async get(id: string) {
    const found = await prisma.user.findUnique({ where: { id }, select });
    if (!found) throw missing();
    return found;
  },
  async create(data: z.infer<typeof userCreateSchema>, actorId: string) {
    const passwordHash = await bcrypt.hash(data.password, 12);
    return transaction((tx) => createUserRecord(tx, data, actorId, passwordHash));
  },
  update(id: string, data: z.infer<typeof userUpdateSchema>, actorId: string) {
    return transaction(async (tx) => {
      const user = await current(tx, id, data.updatedAt);
      const nextRole = await role(tx, data.roleId);
      await protectAdmin(
        tx,
        user,
        actorId,
        nextRole.code !== 'ADMIN' && user.role.code === 'ADMIN',
      );
      const roleChanged = user.roleId !== nextRole.id;
      const saved = await tx.user.update({
        where: { id },
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          roleId: nextRole.id,
          ...(roleChanged ? { authVersion: { increment: 1 } } : {}),
        },
        select,
      });
      if (roleChanged) await revoke(tx, id);
      await audit(tx, actorId, id, 'UPDATE_USER');
      return saved;
    });
  },
  status(id: string, status: UserStatus, updatedAt: string, actorId: string) {
    return transaction(async (tx) => {
      const user = await current(tx, id, updatedAt);
      await protectAdmin(tx, user, actorId, status === 'DISABLED');
      const saved = await tx.user.update({
        where: { id },
        data: { status, authVersion: { increment: 1 } },
        select,
      });
      await revoke(tx, id);
      await audit(tx, actorId, id, status === 'ACTIVE' ? 'ACTIVATE_USER' : 'DISABLE_USER');
      return saved;
    });
  },
  async password(id: string, password: string, updatedAt: string, actorId: string) {
    const passwordHash = await bcrypt.hash(password, 12);
    return transaction(async (tx) => {
      await current(tx, id, updatedAt);
      const saved = await tx.user.update({
        where: { id },
        data: { passwordHash, authVersion: { increment: 1 } },
        select,
      });
      await revoke(tx, id);
      await audit(tx, actorId, id, 'RESET_USER_PASSWORD');
      return saved;
    });
  },
  remove(id: string, updatedAt: string, actorId: string) {
    return transaction(async (tx) => {
      const user = await current(tx, id, updatedAt);
      await protectAdmin(tx, user, actorId, true);
      await tx.user.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'DISABLED', authVersion: { increment: 1 } },
      });
      await revoke(tx, id);
      await audit(tx, actorId, id, 'DELETE_USER');
      return { deleted: true };
    });
  },
  restore(id: string, updatedAt: string, actorId: string) {
    return transaction(async (tx) => {
      await current(tx, id, updatedAt, true);
      const saved = await tx.user.update({
        where: { id },
        data: { deletedAt: null, status: 'ACTIVE', authVersion: { increment: 1 } },
        select,
      });
      await revoke(tx, id);
      await audit(tx, actorId, id, 'RESTORE_USER');
      return saved;
    });
  },
};
