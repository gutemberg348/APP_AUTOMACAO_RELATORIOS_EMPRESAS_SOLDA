import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { rolePermissions } from '@weldcosta/shared';
import { app } from '../../src/app';
import { authService } from '../../src/modules/auth/auth.service';
import { prisma } from '../../src/prisma/client';
vi.mock('../../src/modules/auth/auth.service', () => ({ authService: { authenticate: vi.fn() } }));
vi.mock('../../src/prisma/client', () => ({
  prisma: {
    project: { findFirst: vi.fn() },
    report: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));
const allowedId = randomUUID(),
  deniedId = randomUUID(),
  userId = randomUUID();
const auth = { Authorization: 'Bearer qa-test' };
const actor = (code: string) => ({
  id: userId,
  name: code,
  email: 'scope@qa.invalid',
  phone: null,
  role: { id: randomUUID(), code, name: code },
  permissions: [...rolePermissions[code]!],
  companyIds: [allowedId],
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.project.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.report.findFirst).mockResolvedValue(null);
});
describe('Access enforcement before reading or writing report data', () => {
  it('blocks an inspector from accessing another company or creating a project/report there', async () => {
    vi.mocked(authService.authenticate).mockResolvedValue(actor('INSPECTOR'));
    const responses = await Promise.all([
      request(app)
        .get('/companies/' + deniedId)
        .set(auth),
      request(app)
        .get('/companies/' + deniedId + '/projects')
        .set(auth),
      request(app).post('/projects').set(auth).send({ name: 'Denied', companyId: deniedId }),
      request(app)
        .post('/reports')
        .set(auth)
        .send({ companyId: deniedId, projectId: randomUUID(), reportTypeId: randomUUID() }),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('COMPANY_ACCESS_DENIED');
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it.each(['INSPECTOR', 'OPERATOR'])(
    'protects direct project, report, media and PDF URLs for %s',
    async (code) => {
      vi.mocked(authService.authenticate).mockResolvedValue(actor(code));
      const responses = await Promise.all([
        request(app)
          .get('/projects/' + deniedId)
          .set(auth),
        request(app)
          .get('/reports/' + deniedId)
          .set(auth),
        request(app)
          .get('/reports/' + deniedId + '/pdf')
          .set(auth),
        request(app)
          .get('/reports/' + deniedId + '/pdf/preview')
          .set(auth),
        request(app)
          .post('/reports/' + deniedId + '/pdf')
          .set(auth)
          .send({ version: 1 }),
        request(app)
          .get('/reports/' + deniedId + '/media/' + randomUUID())
          .set(auth),
        request(app)
          .post('/reports/' + deniedId + '/media')
          .set(auth)
          .field('version', '1')
          .attach('file', Buffer.from('not processed'), 'file.png'),
        request(app)
          .put('/reports/' + deniedId)
          .set(auth)
          .send({ version: 1, title: 'Denied' }),
        request(app)
          .patch('/reports/' + deniedId + '/status')
          .set(auth)
          .send({ status: 'APPROVED', version: 1 }),
      ]);
      for (const response of responses) expect(response.status).toBe(404);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.report.findFirst).toHaveBeenCalledWith({
        where: {
          id: deniedId,
          deletedAt: null,
          companyId: { in: [allowedId] },
          ...(code === 'OPERATOR' ? { createdById: userId } : {}),
        },
        select: { id: true },
      });
    },
  );
});
