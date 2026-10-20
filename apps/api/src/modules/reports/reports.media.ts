import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../../prisma/client';
import { env } from '../../config/env';
import { AppError } from '../../errors/app-error';
import { requirePermission } from '../../middlewares/auth';
import { idParam, send } from '../../utils/http';
import { LocalStorageProvider } from '../../services/storage/local-storage-provider';
import { assertEditable } from './reports.policy';
import { reportScope } from '../../middlewares/access-scope';
import { assertPhotoPoint, lockPhotoHash } from './reports.media-duplicates';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 6 },
});
const storage = new LocalStorageProvider(env.STORAGE_PATH);
const metadata = z
  .object({
    version: z.coerce.number().int().positive(),
    caption: z.string().max(2000).optional(),
    sectionKey: z.enum(['photos', 'drawing']).default('photos'),
    reportPointId: z.uuid().optional(),
    clientUploadId: z.string().min(1).max(100).optional(),
  })
  .strict();
async function prepareImage(file: Express.Multer.File | undefined) {
  if (!file) throw new AppError(400, 'FILE_REQUIRED', 'Selecione uma imagem.');
  let content: Buffer;
  try {
    const image = sharp(file.buffer, { limitInputPixels: 40_000_000 });
    const info = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(info.format ?? '')) throw new Error('Unsupported format');
    content = await image
      .rotate()
      .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
  } catch {
    throw new AppError(
      400,
      'INVALID_IMAGE',
      'Use uma imagem JPG, PNG ou WebP válida, de até 10 MB.',
    );
  }
  const sha256 = createHash('sha256').update(file.buffer).digest('hex');
  return { content, sha256 };
}

// No report or media is created by this check; it also works before the first draft save.
export const reportMediaCheckRoutes = Router();
reportMediaCheckRoutes.post(
  '/media/check',
  requirePermission('media.upload'),
  upload.single('file'),
  async (req, res) => {
    const target = z
      .object({ reportId: z.uuid().optional(), reportPointId: z.uuid().optional() })
      .strict()
      .parse(req.body);
    if (target.reportPointId && !target.reportId)
      throw new AppError(400, 'INVALID_POINT', 'Selecione o relatório deste ponto.');
    if (target.reportId) {
      const report = await prisma.report.findFirst({
        where: { id: target.reportId, deletedAt: null, ...reportScope(req.user!) },
      });
      if (!report)
        throw new AppError(404, 'NOT_FOUND', 'Relatório não encontrado ou não liberado para você.');
      assertEditable(report.status, req.user!);
      if (
        target.reportPointId &&
        !(await prisma.reportPoint.findFirst({
          where: { id: target.reportPointId, reportId: target.reportId },
        }))
      )
        throw new AppError(400, 'INVALID_POINT', 'Selecione um ponto deste relatório.');
    }
    const { sha256 } = await prepareImage(req.file);
    await assertPhotoPoint(prisma, sha256, target);
    send(res, { sha256 });
  },
);
export const reportMediaRoutes = Router({ mergeParams: true });
reportMediaRoutes.post(
  '/',
  requirePermission('media.upload'),
  upload.single('file'),
  async (req, res) => {
    const reportId = idParam(req),
      input = metadata.parse(req.body);
    const { content, sha256 } = await prepareImage(req.file);
    const fileName = randomUUID() + '.jpg',
      filePath = `reports/${reportId}/images/${fileName}`;
    await storage.save(filePath, content);
    try {
      const saved = await prisma.$transaction(async (tx) => {
        const report = await tx.report.findFirst({ where: { id: reportId, deletedAt: null } });
        if (!report) throw new AppError(404, 'NOT_FOUND', 'Relatório não encontrado.');
        assertEditable(report.status, req.user!);
        if (
          input.reportPointId &&
          !(await tx.reportPoint.findFirst({ where: { id: input.reportPointId, reportId } }))
        )
          throw new AppError(400, 'INVALID_POINT', 'Selecione um ponto deste relatório.');
        await lockPhotoHash(tx, sha256);
        if (input.clientUploadId) {
          const previous = await tx.reportMedia.findFirst({
            where: { reportId, clientUploadId: input.clientUploadId },
          });
          if (previous) {
            if (
              previous.sha256 !== sha256 ||
              previous.reportPointId !== (input.reportPointId ?? null)
            )
              throw new AppError(
                409,
                'UPLOAD_CONFLICT',
                'Esta seleção de foto mudou. Remova a foto pendente e selecione novamente.',
              );
            return { id: previous.id, reused: true };
          }
        }
        await assertPhotoPoint(tx, sha256, { reportId, reportPointId: input.reportPointId });
        const changed = await tx.report.updateMany({
          where: { id: reportId, version: input.version, status: report.status },
          data: { version: { increment: 1 } },
        });
        if (changed.count !== 1)
          throw new AppError(409, 'VERSION_CONFLICT', 'O relatório foi alterado. Atualize a tela.');
        const media = await tx.reportMedia.create({
          data: {
            reportId,
            reportPointId: input.reportPointId,
            sectionKey: input.sectionKey,
            caption: input.caption,
            type: input.sectionKey === 'drawing' ? 'DRAWING' : 'IMAGE',
            originalName: req.file!.originalname,
            fileName,
            filePath,
            mimeType: 'image/jpeg',
            fileSize: content.length,
            sha256,
            clientUploadId: input.clientUploadId,
            uploadedById: req.user!.id,
            sortOrder: await tx.reportMedia.count({ where: { reportId } }),
          },
        });
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: 'UPLOAD_MEDIA',
            entity: 'Report',
            entityId: reportId,
            metadata: { mediaId: media.id },
          },
        });
        return { id: media.id, reused: false };
      });
      if (saved.reused) await storage.delete(filePath).catch(() => {});
      send(res, { id: saved.id }, 201);
    } catch (error) {
      await storage.delete(filePath).catch(() => {});
      throw error;
    }
  },
);
reportMediaRoutes.get('/:mediaId', requirePermission('reports.view'), async (req, res) => {
  const media = await prisma.reportMedia.findFirst({
    where: { id: idParam(req, 'mediaId'), reportId: idParam(req), report: { deletedAt: null } },
  });
  if (!media) throw new AppError(404, 'NOT_FOUND', 'Imagem não encontrada.');
  res
    .type(media.mimeType)
    .set('Cache-Control', 'private, no-store')
    .send(await storage.get(media.filePath));
});
reportMediaRoutes.delete('/:mediaId', requirePermission('media.delete'), async (req, res) => {
  const reportId = idParam(req),
    mediaId = idParam(req, 'mediaId'),
    { version } = z.object({ version: z.number().int().positive() }).strict().parse(req.body);
  const media = await prisma.$transaction(async (tx) => {
    const report = await tx.report.findFirst({ where: { id: reportId, deletedAt: null } });
    if (!report) throw new AppError(404, 'NOT_FOUND', 'Relatório não encontrado.');
    assertEditable(report.status, req.user!);
    const item = await tx.reportMedia.findFirst({ where: { id: mediaId, reportId } });
    if (!item) throw new AppError(404, 'NOT_FOUND', 'Imagem não encontrada.');
    const changed = await tx.report.updateMany({
      where: { id: reportId, version, status: report.status },
      data: { version: { increment: 1 } },
    });
    if (changed.count !== 1)
      throw new AppError(409, 'VERSION_CONFLICT', 'O relatório foi alterado. Atualize a tela.');
    await tx.reportMedia.delete({ where: { id: mediaId } });
    await tx.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'DELETE_MEDIA',
        entity: 'Report',
        entityId: reportId,
        metadata: { mediaId },
      },
    });
    return item;
  });
  await storage
    .delete(media.filePath)
    .catch((error) => console.error('Media cleanup failed', error));
  send(res, { deleted: true });
});
reportMediaRoutes.patch('/:mediaId', requirePermission('media.upload'), async (req, res) => {
  const reportId = idParam(req),
    mediaId = idParam(req, 'mediaId');
  const input = z
    .object({
      version: z.number().int().positive(),
      caption: z.string().max(2000),
      reportPointId: z.uuid().nullable(),
      sectionKey: z.enum(['photos', 'drawing']),
    })
    .strict()
    .parse(req.body);
  await prisma.$transaction(async (tx) => {
    const report = await tx.report.findFirst({ where: { id: reportId, deletedAt: null } });
    if (!report) throw new AppError(404, 'NOT_FOUND', 'Relatório não encontrado.');
    assertEditable(report.status, req.user!);
    const item = await tx.reportMedia.findFirst({ where: { id: mediaId, reportId } });
    if (!item) throw new AppError(404, 'NOT_FOUND', 'Imagem não encontrada.');
    if (
      input.reportPointId &&
      !(await tx.reportPoint.findFirst({ where: { id: input.reportPointId, reportId } }))
    )
      throw new AppError(400, 'INVALID_POINT', 'Selecione um ponto deste relatório.');
    const targetPointId = input.sectionKey === 'drawing' ? null : input.reportPointId;
    await lockPhotoHash(tx, item.sha256);
    await assertPhotoPoint(tx, item.sha256, { reportId, reportPointId: targetPointId }, item.id);
    const changed = await tx.report.updateMany({
      where: { id: reportId, version: input.version, status: report.status },
      data: { version: { increment: 1 } },
    });
    if (changed.count !== 1)
      throw new AppError(409, 'VERSION_CONFLICT', 'O relatório foi alterado. Atualize a tela.');
    await tx.reportMedia.update({
      where: { id: mediaId },
      data: {
        caption: input.caption,
        sectionKey: input.sectionKey,
        type: input.sectionKey === 'drawing' ? 'DRAWING' : 'IMAGE',
        reportPointId: targetPointId,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'UPDATE_MEDIA',
        entity: 'Report',
        entityId: reportId,
        metadata: { mediaId },
      },
    });
  });
  send(res, { id: mediaId });
});
