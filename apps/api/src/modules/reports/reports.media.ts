import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../prisma/client';
import { env } from '../../config/env';
import { AppError } from '../../errors/app-error';
import { requirePermission } from '../../middlewares/auth';
import { idParam, send } from '../../utils/http';
import { LocalStorageProvider } from '../../services/storage/local-storage-provider';
import { assertEditable } from './reports.policy';
import { reportScope, projectScope } from '../../middlewares/access-scope';
import { assertPhotoPoint, lockPhotoHash } from './reports.media-duplicates';
import { photoAnnotationsSchema } from '@weldcosta/shared';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 7, fieldSize: 4 * 1024 * 1024 },
});
const storage = new LocalStorageProvider(env.STORAGE_PATH);
const metadata = z
  .object({
    version: z.coerce.number().int().positive(),
    caption: z.string().max(2000).optional(),
    sectionKey: z.enum(['photos', 'drawing', 'test-photos']).default('photos'),
    reportPointId: z.uuid().optional(),
    clientUploadId: z.string().min(1).max(100).optional(),
    annotations: z
      .string()
      .transform((value, ctx) => {
        try {
          return JSON.parse(value) as unknown;
        } catch {
          ctx.addIssue({ code: 'custom', message: 'Marcações da foto inválidas.' });
          return z.NEVER;
        }
      })
      .pipe(photoAnnotationsSchema)
      .optional(),
  })
  .strict()
  .refine((input) => input.sectionKey !== 'test-photos' || !input.reportPointId, {
    path: ['reportPointId'],
    message: 'As fotos do ensaio são gerais e não precisam de vínculo com um ponto.',
  });
async function prepareImage(file: Express.Multer.File | undefined) {
  if (!file) throw new AppError(400, 'FILE_REQUIRED', 'Selecione uma imagem.');
  let content: Buffer;
  try {
    // Inspect dimensions before decoding; small compressed phone files may be 48/108MP.
    const info = await sharp(file.buffer, { limitInputPixels: false }).metadata();
    if (!['jpeg', 'png', 'webp'].includes(info.format ?? ''))
      throw new AppError(
        400,
        'UNSUPPORTED_IMAGE_FORMAT',
        'Este formato de imagem não é aceito. Exporte ou selecione a foto como JPG, PNG ou WebP.',
      );
    if ((info.width ?? 0) * (info.height ?? 0) > 128_000_000)
      throw new AppError(
        400,
        'IMAGE_RESOLUTION_TOO_LARGE',
        'Esta foto excede 128 megapixels de resolução. Reduza a resolução ou exporte uma cópia menor antes de enviar.',
      );
    const image = sharp(file.buffer, { limitInputPixels: 128_000_000 });
    content = await image
      .rotate()
      .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#FFFFFF' })
      .jpeg({ quality: 88 })
      .toBuffer();
  } catch (cause) {
    if (cause instanceof AppError) throw cause;
    throw new AppError(
      400,
      'INVALID_IMAGE',
      'Não foi possível ler este arquivo de imagem. Abra a foto na galeria e exporte ou selecione novamente como JPG, PNG ou WebP.',
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
      .object({
        reportId: z.uuid().optional(),
        reportPointId: z.uuid().optional(),
        projectId: z.uuid().optional(),
      })
      .strict()
      .parse(req.body);
    if (target.reportPointId && !target.reportId)
      throw new AppError(400, 'INVALID_POINT', 'Selecione o relatório deste ponto.');
    let projectId: string | undefined;
    if (target.reportId) {
      const report = await prisma.report.findFirst({
        where: { id: target.reportId, deletedAt: null, ...reportScope(req.user!) },
      });
      if (!report)
        throw new AppError(404, 'NOT_FOUND', 'Relatório não encontrado ou não liberado para você.');
      assertEditable(report.status, req.user!);
      projectId = report.projectId;
      if (
        target.reportPointId &&
        !(await prisma.reportPoint.findFirst({
          where: { id: target.reportPointId, reportId: target.reportId },
        }))
      )
        throw new AppError(400, 'INVALID_POINT', 'Selecione um ponto deste relatório.');
    } else if (target.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: target.projectId, ...projectScope(req.user!) },
        select: { id: true },
      });
      if (!project)
        throw new AppError(404, 'NOT_FOUND', 'Obra não encontrada ou não liberada para você.');
      projectId = project.id;
    }
    const { sha256 } = await prepareImage(req.file);
    await assertPhotoPoint(prisma, sha256, { ...target, projectId });
    send(res, { sha256, projectId });
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
        const report = await tx.report.findFirst({
          where: { id: reportId, deletedAt: null },
          include: { reportType: { select: { code: true } } },
        });
        if (!report) throw new AppError(404, 'NOT_FOUND', 'Relatório não encontrado.');
        assertEditable(report.status, req.user!);
        if (
          input.sectionKey === 'test-photos' &&
          !['LP', 'TH', 'ME'].includes(report.reportType?.code ?? '')
        )
          throw new AppError(
            400,
            'INVALID_MEDIA_SECTION',
            'Fotos do ensaio está disponível nos relatórios de Líquido Penetrante, Teste Hidrostático e Medição de Espessura.',
          );
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
            // A retry may contain newer paint edits after an earlier upload
            // reached the server but its response was lost.
            if (
              (input.annotations !== undefined &&
                !isDeepStrictEqual(previous.annotations, input.annotations)) ||
              (input.caption !== undefined && previous.caption !== input.caption)
            ) {
              const changed = await tx.report.updateMany({
                where: { id: reportId, version: input.version, status: report.status },
                data: { version: { increment: 1 } },
              });
              if (changed.count !== 1)
                throw new AppError(
                  409,
                  'VERSION_CONFLICT',
                  'O relatório foi alterado. Atualize a tela.',
                );
              await tx.reportMedia.update({
                where: { id: previous.id },
                data: {
                  ...(input.annotations !== undefined ? { annotations: input.annotations } : {}),
                  ...(input.caption !== undefined ? { caption: input.caption } : {}),
                },
              });
              await tx.auditLog.create({
                data: {
                  userId: req.user!.id,
                  action: 'UPDATE_MEDIA',
                  entity: 'Report',
                  entityId: reportId,
                  metadata: { mediaId: previous.id },
                },
              });
            }
            return { id: previous.id, reused: true };
          }
        }
        await assertPhotoPoint(tx, sha256, {
          projectId: report.projectId,
          reportId,
          reportPointId: input.reportPointId,
        });
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
            ...(input.annotations ? { annotations: input.annotations } : {}),
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
      sectionKey: z.enum(['photos', 'drawing', 'test-photos']),
      annotations: photoAnnotationsSchema.nullable().optional(),
    })
    .strict()
    .parse(req.body);
  await prisma.$transaction(async (tx) => {
    const report = await tx.report.findFirst({
      where: { id: reportId, deletedAt: null },
      include: { reportType: { select: { code: true } } },
    });
    if (!report) throw new AppError(404, 'NOT_FOUND', 'Relatório não encontrado.');
    assertEditable(report.status, req.user!);
    if (
      input.sectionKey === 'test-photos' &&
      !['LP', 'TH', 'ME'].includes(report.reportType?.code ?? '')
    )
      throw new AppError(
        400,
        'INVALID_MEDIA_SECTION',
        'Fotos do ensaio está disponível nos relatórios de Líquido Penetrante, Teste Hidrostático e Medição de Espessura.',
      );
    const item = await tx.reportMedia.findFirst({ where: { id: mediaId, reportId } });
    if (!item) throw new AppError(404, 'NOT_FOUND', 'Imagem não encontrada.');
    if (
      input.reportPointId &&
      !(await tx.reportPoint.findFirst({ where: { id: input.reportPointId, reportId } }))
    )
      throw new AppError(400, 'INVALID_POINT', 'Selecione um ponto deste relatório.');
    const targetPointId = ['drawing', 'test-photos'].includes(input.sectionKey)
      ? null
      : input.reportPointId;
    await lockPhotoHash(tx, item.sha256);
    await assertPhotoPoint(
      tx,
      item.sha256,
      { projectId: report.projectId, reportId, reportPointId: targetPointId },
      item.id,
    );
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
        ...(input.annotations !== undefined
          ? { annotations: input.annotations ?? Prisma.JsonNull }
          : {}),
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
