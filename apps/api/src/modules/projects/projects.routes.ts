import { Router } from 'express';
import { requirePermission } from '../../middlewares/auth';
import { projectsController as c } from './projects.controller';
export const projectsRoutes = Router();
projectsRoutes.get('/', requirePermission('projects.view'), c.list);
projectsRoutes.get('/:id', requirePermission('projects.view'), c.get);
projectsRoutes.post('/', requirePermission('projects.create'), c.create);
projectsRoutes.put('/:id', requirePermission('projects.edit'), c.update);
projectsRoutes.patch('/:id/status', requirePermission('projects.archive'), c.status);
