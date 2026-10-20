import { beforeEach, expect, it, vi } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { rolePermissions } from '@weldcosta/shared';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma/client';
import { authService } from '../../src/modules/auth/auth.service';

vi.mock('../../src/modules/auth/auth.service', () => ({ authService: { authenticate: vi.fn() } }));
vi.mock('../../src/services/storage/local-storage-provider', () => ({
  LocalStorageProvider: class {
    save = vi.fn(async () => {});
    delete = vi.fn(async () => {});
  },
}));
vi.mock('../../src/prisma/client', () => ({
  prisma: {
    report: { findFirst: vi.fn(), updateMany: vi.fn() },
    reportPoint: { findFirst: vi.fn() },
    reportMedia: { findFirst: vi.fn(), create: vi.fn(), count: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
  },
}));
const reportId = randomUUID(),
  pointId = randomUUID(),
  otherPoint = randomUUID(),
  mediaId = randomUUID();
const auth = { Authorization: 'Bearer qa' };
let existing:
  { id: string; reportId: string; reportPointId: string | null; sha256?: string } | undefined;
let image: Buffer;
beforeEach(async () => {
  vi.clearAllMocks();
  existing = undefined;
  image = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'blue' } })
    .png()
    .toBuffer();
  vi.mocked(authService.authenticate).mockResolvedValue({
    id: randomUUID(),
    name: 'QA',
    email: 'qa@example.invalid',
    phone: null,
    role: { id: randomUUID(), code: 'ADMIN', name: 'Admin' },
    permissions: [...rolePermissions.ADMIN!],
  });
  vi.mocked(prisma.report.findFirst).mockResolvedValue({
    id: reportId,
    status: 'DRAFT',
    version: 1,
  } as never);
  vi.mocked(prisma.reportPoint.findFirst).mockImplementation(async (args) =>
    args?.where?.id === pointId || args?.where?.id === otherPoint
      ? ({ id: args.where.id } as never)
      : null,
  );
  vi.mocked(prisma.report.updateMany).mockResolvedValue({ count: 1 });
  vi.mocked(prisma.reportMedia.count).mockResolvedValue(1);
  vi.mocked(prisma.reportMedia.create).mockResolvedValue({ id: randomUUID() } as never);
  vi.mocked(prisma.$transaction).mockImplementation((async (fn: unknown) =>
    (fn as (tx: typeof prisma) => Promise<unknown>)(prisma)) as never);
  vi.mocked(prisma.reportMedia.findFirst).mockImplementation(async (args) => {
    const where = args?.where as {
      id?: string | { not: string };
      OR?: { reportId?: { not: string }; reportPointId?: { not: string } | null }[];
    };
    if (!existing) return null;
    if (where.id === mediaId) return existing as never;
    if (typeof where.id === 'object' && where.id?.not === existing.id) return null;
    if (!where.OR) return existing as never;
    const conflict = where.OR.some((clause) =>
      clause.reportId
        ? existing!.reportId !== clause.reportId.not
        : clause.reportPointId === null
          ? existing!.reportPointId === null
          : existing!.reportPointId !== clause.reportPointId?.not,
    );
    return conflict ? (existing as never) : null;
  });
});
const check = (point = pointId) =>
  request(app)
    .post('/reports/media/check')
    .set(auth)
    .field('reportId', reportId)
    .field('reportPointId', point)
    .attach('file', image, 'photo.png');
const upload = (point = pointId) =>
  request(app)
    .post(`/reports/${reportId}/media`)
    .set(auth)
    .field('version', '1')
    .field('reportPointId', point)
    .attach('file', image, 'renamed.png');

it('accepts a repeated image in the same saved point both during selection and upload', async () => {
  existing = { id: mediaId, reportId, reportPointId: pointId };
  expect((await check()).status).toBe(200);
  expect((await upload()).status).toBe(201);
  expect(prisma.$executeRaw).toHaveBeenCalledOnce();
  expect(prisma.reportMedia.create).toHaveBeenCalledOnce();
});
it.each(['other-point', 'other-report', 'unlinked'])(
  'rejects %s reuse before selection and during upload',
  async (kind) => {
    existing = {
      id: mediaId,
      reportId: kind === 'other-report' ? randomUUID() : reportId,
      reportPointId: kind === 'unlinked' ? null : kind === 'other-point' ? otherPoint : pointId,
    };
    for (const response of [await check(), await upload()]) {
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('DUPLICATE_MEDIA');
    }
    expect(prisma.reportMedia.create).not.toHaveBeenCalled();
  },
);
it('does not accept a forged or inaccessible point context', async () => {
  expect((await check(randomUUID())).status).toBe(400);
  vi.mocked(prisma.report.findFirst).mockResolvedValue(null);
  expect((await check()).status).toBe(404);
  expect(prisma.reportMedia.findFirst).not.toHaveBeenCalled();
});
it('returns an already completed slot after a lost response without creating another photo', async () => {
  const previous = {
    id: mediaId,
    reportId,
    reportPointId: pointId,
    sha256: createHash('sha256').update(image).digest('hex'),
  };
  vi.mocked(prisma.reportMedia.findFirst).mockResolvedValue(previous as never);
  const response = await request(app)
    .post(`/reports/${reportId}/media`)
    .set(auth)
    .field('version', '1')
    .field('reportPointId', pointId)
    .field('clientUploadId', 'slot-one')
    .attach('file', image, 'photo.png');
  expect(response.status).toBe(201);
  expect(response.body.data.id).toBe(mediaId);
  expect(prisma.reportMedia.create).not.toHaveBeenCalled();
  expect(prisma.report.updateMany).not.toHaveBeenCalled();
});
it('checks reassignment too, while permitting a caption change on the same point', async () => {
  existing = { id: mediaId, reportId, reportPointId: pointId, sha256: 'a'.repeat(64) };
  const original = vi.mocked(prisma.reportMedia.findFirst).getMockImplementation()!;
  vi.mocked(prisma.reportMedia.findFirst).mockImplementation(async (args) =>
    args?.where?.id === mediaId
      ? (existing as never)
      : original({ ...args, where: { ...args?.where, id: undefined } }),
  );
  const patch = (target: string | null) =>
    request(app)
      .patch(`/reports/${reportId}/media/${mediaId}`)
      .set(auth)
      .send({ version: 1, caption: 'Caption', sectionKey: 'photos', reportPointId: target });
  expect((await patch(pointId)).status).toBe(200);
  expect((await patch(otherPoint)).status).toBe(409);
  expect((await patch(null)).status).toBe(409);
  expect(prisma.reportMedia.update).toHaveBeenCalledOnce();
});
