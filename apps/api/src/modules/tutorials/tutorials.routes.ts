import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { tutorialMetadataSchema } from '@weldcosta/shared';
import { prisma } from '../../prisma/client';
import { env } from '../../config/env';
import { requirePermission } from '../../middlewares/auth';
import { AppError } from '../../errors/app-error';
import { idParam, send, pageResult } from '../../utils/http';
import { LocalStorageProvider } from '../../services/storage/local-storage-provider';
import { validateTutorialFile } from './tutorials.files';

const storage = new LocalStorageProvider(env.STORAGE_PATH);
const fields = {
  id: true,
  title: true,
  description: true,
  content: true,
  originalName: true,
  mimeType: true,
  fileSize: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} as const;
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      void storage
        .getPath('tutorials/upload')
        .then(async (target) => {
          await mkdir(path.dirname(target), { recursive: true });
          callback(null, path.dirname(target));
        })
        .catch((error) => callback(error, ''));
    },
    filename: (_req, _file, callback) => callback(null, randomUUID()),
  }),
  limits: { fileSize: 100 * 1024 * 1024, files: 1, fields: 3, fieldSize: 30_000 },
}).single('file');
const receive: RequestHandler = (req, res, next) =>
  upload(req, res, (error) => {
    next(
      error
        ? new AppError(
            400,
            'INVALID_UPLOAD',
            'Envie um arquivo por tutorial. Fotos até 10 MB, documentos até 20 MB e vídeos até 100 MB.',
          )
        : undefined,
    );
  });
const categoryId = 'b0943e06-e2e8-4cda-8f44-704ba26f2be3';
export const tutorialsRoutes = Router();
tutorialsRoutes.get('/', requirePermission('training.view'), async (req, res) => {
  const query = z
    .object({
      search: z.string().max(180).default(''),
      kind: z.enum(['all', 'image', 'document', 'video']).default('all'),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(12),
    })
    .parse(req.query);
  const where = {
    active: true,
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' as const } },
            { description: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(query.kind === 'all'
      ? {}
      : {
          mimeType: { startsWith: query.kind === 'document' ? 'application/' : query.kind + '/' },
        }),
  };
  const [items, total] = await prisma.$transaction([
    prisma.trainingContent.findMany({
      where,
      select: fields,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit,
      skip: (query.page - 1) * query.limit,
    }),
    prisma.trainingContent.count({ where }),
  ]);
  send(res, pageResult(items, total, { ...query, sortBy: 'createdAt', sortOrder: 'desc' }));
});
tutorialsRoutes.get('/:id', requirePermission('training.view'), async (req, res) => {
  const item = await prisma.trainingContent.findFirst({
    where: { id: idParam(req), active: true },
    select: fields,
  });
  if (!item) throw new AppError(404, 'NOT_FOUND', 'Tutorial não encontrado.');
  send(res, item);
});
tutorialsRoutes.get('/:id/file', requirePermission('training.view'), async (req, res, next) => {
  const item = await prisma.trainingContent.findFirst({
    where: { id: idParam(req), active: true },
  });
  if (!item?.mediaPath || !item.mimeType)
    throw new AppError(404, 'NOT_FOUND', 'Arquivo não encontrado.');
  const file = await storage.getPath(item.mediaPath);
  const inline =
    req.query.download !== '1' &&
    (item.mimeType.startsWith('image/') ||
      item.mimeType.startsWith('video/') ||
      item.mimeType === 'application/pdf');
  res
    .set('Cache-Control', 'private, no-store')
    .set('Content-Type', item.mimeType)
    .set('X-Content-Type-Options', 'nosniff');
  res.attachment(item.originalName || 'tutorial');
  if (inline)
    res.set(
      'Content-Disposition',
      res
        .getHeader('Content-Disposition')!
        .toString()
        .replace(/^attachment/, 'inline'),
    );
  // sendFile supports byte ranges, needed for seeking in mobile video players.
  res.sendFile(file, { cacheControl: false, acceptRanges: true }, (error) => {
    if (error && !res.headersSent && (error as { status?: number }).status === 416) {
      res
        .status(416)
        .set('Content-Range', 'bytes */' + item.fileSize)
        .end();
      return;
    }
    if (error && !res.headersSent)
      next(
        (error as NodeJS.ErrnoException).code === 'ENOENT'
          ? new AppError(404, 'NOT_FOUND', 'Arquivo não encontrado.')
          : error,
      );
  });
});
const save: RequestHandler = async (req, res) => {
  let persisted = false;
  try {
    const editing = req.method === 'PUT';
    const input = tutorialMetadataSchema.parse(req.body);
    const version = editing ? z.coerce.number().int().positive().parse(req.body.version) : 1;
    const id = editing ? idParam(req) : randomUUID();
    if (!editing && !req.file)
      throw new AppError(400, 'FILE_REQUIRED', 'Selecione o material do tutorial.');
    const file = req.file
      ? { ...(await validateTutorialFile(req.file)), mediaPath: 'tutorials/' + req.file.filename }
      : {};
    const result = await prisma.$transaction(async (tx) => {
      let oldPath: string | null = null;
      if (editing) {
        const previous = await tx.trainingContent.findFirst({ where: { id, active: true } });
        if (!previous) throw new AppError(404, 'NOT_FOUND', 'Tutorial não encontrado.');
        const changed = await tx.trainingContent.updateMany({
          where: { id, version, active: true },
          data: { ...input, ...file, version: { increment: 1 } },
        });
        if (!changed.count)
          throw new AppError(
            409,
            'VERSION_CONFLICT',
            'O tutorial foi atualizado. Reabra para editar a versão mais recente.',
          );
        if (req.file) oldPath = previous.mediaPath;
      } else {
        await tx.trainingCategory.upsert({
          where: { id: categoryId },
          create: { id: categoryId, name: 'Tutoriais' },
          update: {},
        });
        await tx.trainingContent.create({
          data: { id, categoryId, content: '', ...input, ...file },
        });
      }
      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: editing ? 'UPDATE_TUTORIAL' : 'CREATE_TUTORIAL',
          entity: 'TrainingContent',
          entityId: id,
        },
      });
      return {
        item: await tx.trainingContent.findUniqueOrThrow({ where: { id }, select: fields }),
        oldPath,
      };
    });
    persisted = true;
    if (result.oldPath)
      await storage
        .delete(result.oldPath)
        .catch((error) => console.error('Tutorial file cleanup failed', error));
    send(res, result.item, editing ? 200 : 201);
  } finally {
    if (req.file && !persisted) await unlink(req.file.path).catch(() => {});
  }
};
tutorialsRoutes.post('/', requirePermission('training.manage'), receive, save);
tutorialsRoutes.put('/:id', requirePermission('training.manage'), receive, save);
tutorialsRoutes.delete('/:id', requirePermission('training.manage'), async (req, res) => {
  const id = idParam(req);
  const { version } = z.object({ version: z.number().int().positive() }).parse(req.body);
  const removed = await prisma.$transaction(async (tx) => {
    const item = await tx.trainingContent.findFirst({ where: { id, active: true } });
    if (!item) throw new AppError(404, 'NOT_FOUND', 'Tutorial não encontrado.');
    const changed = await tx.trainingContent.deleteMany({ where: { id, version } });
    if (!changed.count)
      throw new AppError(
        409,
        'VERSION_CONFLICT',
        'O tutorial foi atualizado. Reabra antes de remover.',
      );
    await tx.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'DELETE_TUTORIAL',
        entity: 'TrainingContent',
        entityId: id,
      },
    });
    return item;
  });
  if (removed.mediaPath)
    await storage
      .delete(removed.mediaPath)
      .catch((error) => console.error('Tutorial file cleanup failed', error));
  send(res, { deleted: true });
});
