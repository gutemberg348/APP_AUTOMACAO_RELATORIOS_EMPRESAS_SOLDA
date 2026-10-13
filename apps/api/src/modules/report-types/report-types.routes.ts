import { Router } from 'express';
import { requirePermission } from '../../middlewares/auth';
import { idParam, listQuery, send } from '../../utils/http';
import { reportTypesService } from './report-types.service';
export const reportTypesRoutes = Router();
reportTypesRoutes.get('/', requirePermission('reports.view'), async (req, res) =>
  send(res, await reportTypesService.list(listQuery(req, ['createdAt', 'updatedAt', 'name']))),
);
reportTypesRoutes.get('/:id', requirePermission('reports.view'), async (req, res) =>
  send(res, await reportTypesService.get(idParam(req))),
);
