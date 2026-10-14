import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { usersService, createUserRecord } from '../../src/modules/users/users.service';
import { prisma } from '../../src/prisma/client';
import type { Prisma } from '../../src/generated/prisma/client';
vi.mock('../../src/prisma/client', () => ({ prisma: { $transaction: vi.fn() } }));
const id = randomUUID(),
  roleId = randomUUID(),
  actorId = randomUUID(),
  first = randomUUID(),
  second = randomUUID();
const now = new Date('2026-10-14T12:00:00.000Z');
const tx = {
  role: { findUnique: vi.fn() },
  company: { count: vi.fn() },
  user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  refreshToken: { updateMany: vi.fn() },
  auditLog: { create: vi.fn() },
};
beforeEach(() => {
  vi.clearAllMocks();
  tx.role.findUnique.mockResolvedValue({ id: roleId, code: 'INSPECTOR' });
  tx.company.count.mockResolvedValue(1);
  tx.user.findUnique.mockResolvedValue({
    id,
    updatedAt: now,
    roleId,
    role: { code: 'INSPECTOR' },
    status: 'ACTIVE',
    deletedAt: null,
    companyAccess: [{ companyId: first }],
  });
  tx.user.create.mockResolvedValue({ id });
  tx.user.update.mockResolvedValue({ id });
  tx.refreshToken.updateMany.mockResolvedValue({ count: 1 });
  tx.auditLog.create.mockResolvedValue({});
  vi.mocked(prisma.$transaction).mockImplementation(
    async (work: unknown) => (work as (tx: unknown) => Promise<unknown>)(tx) as never,
  );
});
describe('Company assignments in user transactions', () => {
  it('creates the account and its company assignments in the same transaction', async () => {
    await createUserRecord(
      tx as unknown as Prisma.TransactionClient,
      {
        name: 'Pessoa',
        email: 'qa@qa.invalid',
        roleId,
        password: 'UnusedPassword123',
        companyIds: [first],
      },
      actorId,
      'hashed-only',
    );
    expect(tx.user.create.mock.calls[0]![0].data.companyAccess).toEqual({
      create: [{ companyId: first }],
    });
    expect(tx.user.create.mock.calls[0]![0].select.passwordHash).toBeUndefined();
  });
  it('replaces assignments and invalidates old sessions even when the role is unchanged', async () => {
    await usersService.update(
      id,
      {
        name: 'Pessoa',
        email: 'qa@qa.invalid',
        roleId,
        updatedAt: now.toISOString(),
        companyIds: [second],
      },
      actorId,
    );
    const data = tx.user.update.mock.calls[0]![0].data;
    expect(data.companyAccess).toEqual({ deleteMany: {}, create: [{ companyId: second }] });
    expect(data.authVersion).toEqual({ increment: 1 });
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: { userId: actorId, entity: 'User', entityId: id, action: 'UPDATE_USER' },
    });
  });
  it('rejects a missing company before changing the user or revoking sessions', async () => {
    tx.company.count.mockResolvedValue(0);
    await expect(
      usersService.update(
        id,
        {
          name: 'Pessoa',
          email: 'qa@qa.invalid',
          roleId,
          updatedAt: now.toISOString(),
          companyIds: [second],
        },
        actorId,
      ),
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_COMPANY_ACCESS' });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});
