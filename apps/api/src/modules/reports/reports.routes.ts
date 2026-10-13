import { Router } from 'express';
import { requirePermission } from '../../middlewares/auth';
import { reportsController as c } from './reports.controller';
import { PdfService } from '../pdf/pdf.service';
import { idParam } from '../../utils/http';
import { reportMediaRoutes, reportMediaCheckRoutes } from './reports.media';
const pdf = new PdfService();
export const reportsRoutes = Router();
reportsRoutes.use(reportMediaCheckRoutes);
reportsRoutes.use('/:id/media', reportMediaRoutes);
reportsRoutes.get('/', requirePermission('reports.view'), c.list);
reportsRoutes.get('/:id', requirePermission('reports.view'), c.get);
reportsRoutes.get('/:id/pdf/preview', requirePermission('pdf.download'), async (req, res) => {
  const id = idParam(req);
  res
    .type('application/pdf')
    .set('Cache-Control', 'no-store')
    .set('Content-Disposition', `attachment; filename="weldcosta-${id}-previa.pdf"`)
    .send(await pdf.preview(id));
});
reportsRoutes.get('/:id/pdf', requirePermission('pdf.download'), async (req, res) => {
  const id = idParam(req);
  res
    .type('application/pdf')
    .set('Cache-Control', 'private, no-store')
    .set('Content-Disposition', `attachment; filename="weldcosta-${id}.pdf"`)
    .send(await pdf.download(id));
});
reportsRoutes.post('/:id/pdf', requirePermission('pdf.download'), c.generatePdf);
reportsRoutes.post('/', requirePermission('reports.create'), c.create);
reportsRoutes.put('/:id', requirePermission('reports.edit'), c.update);
reportsRoutes.patch('/:id/status', c.transition);
reportsRoutes.delete('/:id', requirePermission('reports.delete'), c.remove);
