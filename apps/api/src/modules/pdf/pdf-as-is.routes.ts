import { Router } from 'express';
import multer from 'multer';
import { tmpdir } from 'node:os';
import { readFile, unlink } from 'node:fs/promises';
import { z } from 'zod';
import { requirePermission } from '../../middlewares/auth';
import { AppError } from '../../errors/app-error';
import { idParam, send } from '../../utils/http';
import { PdfService } from './pdf.service';
import { pdfAsIsSchema } from './pdf-as-is';
import { pdfExportDownloads } from './pdf-export-downloads';

const upload = multer({
  dest: tmpdir(),
  limits: { files: 100, fileSize: 10 * 1024 * 1024, fields: 1, fieldSize: 4 * 1024 * 1024 },
});
export const pdfAsIsRoutes = Router({ mergeParams: true });
const pdf = new PdfService();
pdfAsIsRoutes.post(
  '/prepare',
  requirePermission('pdf.download'),
  upload.array('files', 100),
  async (req, res) => {
    const files = (req.files ?? []) as Express.Multer.File[];
    try {
      let raw: unknown;
      try {
        raw = JSON.parse(String(req.body.data));
      } catch {
        throw new AppError(
          400,
          'INVALID_PDF_INPUT',
          'Não foi possível ler o preenchimento atual. Volte ao relatório e tente baixar novamente.',
        );
      }
      const input = pdfAsIsSchema.parse(raw);
      if (files.reduce((total, file) => total + file.size, 0) > 100 * 1024 * 1024)
        throw new AppError(
          413,
          'PDF_PHOTOS_TOO_LARGE',
          'As fotos deste PDF excedem 100 MB no total. Reduza o tamanho de algumas fotos e tente novamente. Seu preenchimento continua guardado.',
        );
      const result = await pdf.exportCurrent(
        idParam(req),
        input,
        await Promise.all(files.map((file) => readFile(file.path))),
        req.user!,
      );
      res.set('Cache-Control', 'private, no-store');
      send(res, {
        token: pdfExportDownloads.create(req.user!.id, idParam(req), result.bytes),
        warnings: result.warnings,
      });
    } finally {
      await Promise.all(files.map((file) => unlink(file.path).catch(() => {})));
    }
  },
);
pdfAsIsRoutes.get('/:token', requirePermission('pdf.download'), (req, res) => {
  const id = idParam(req),
    token = z.uuid().parse(req.params.token);
  res
    .type('application/pdf')
    .set('Cache-Control', 'private, no-store')
    .set('Content-Disposition', `attachment; filename="weldcosta-${id}.pdf"`)
    .send(pdfExportDownloads.get(req.user!.id, id, token));
});
