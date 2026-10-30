import { beforeEach, expect, it, vi } from 'vitest';
import { rolePermissions } from '@weldcosta/shared';
const mock = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), audit: vi.fn() }));
vi.mock('../../src/config/env', () => ({ env: { STORAGE_PATH: '.' } }));
vi.mock('../../src/prisma/client', () => {
  const db = {
    report: { findFirst: mock.get, updateMany: mock.update },
    auditLog: { create: mock.audit },
  };
  return { prisma: { ...db, $transaction: async (fn: (tx: typeof db) => unknown) => fn(db) } };
});
import { ReportsService } from '../../src/modules/reports/reports.service';
beforeEach(() => {
  vi.clearAllMocks();
  mock.update.mockResolvedValue({ count: 1 });
});
it.each(['EVS', 'EVD', 'LP', 'TH', 'ME', 'RDO'])(
  'changes %s status with a full database record and acknowledged missing fields',
  async (code) => {
    mock.get.mockResolvedValue({
      id: 'report',
      number: '001',
      title: '',
      reportDate: null,
      status: 'DRAFT',
      version: 1,
      specificData: {},
      reportType: { code, config: {} },
      points: [],
      signatures: [],
      drawings: [],
      media: [],
    });
    const service = new ReportsService();
    await service.transition(
      'report',
      { version: 1, status: 'IN_REVIEW', quick: true, acknowledgeIncomplete: true },
      {
        id: 'admin',
        name: 'Admin',
        email: 'qa@example.invalid',
        phone: null,
        role: { id: 'role', code: 'ADMIN', name: 'Admin' },
        permissions: [...rolePermissions.ADMIN!],
      },
    );
    expect(mock.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'IN_REVIEW' }) }),
    );
  },
);
