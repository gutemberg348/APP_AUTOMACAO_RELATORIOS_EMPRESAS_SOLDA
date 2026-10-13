import { Router } from 'express';
import { requirePermission } from '../../middlewares/auth';
import { send } from '../../utils/http';
import { dashboardService } from './dashboard.service';
export const dashboardRoutes = Router();
dashboardRoutes.get('/', requirePermission('reports.view'), async (req, res) =>
  send(res, await dashboardService.get(req.user!.permissions)),
);
