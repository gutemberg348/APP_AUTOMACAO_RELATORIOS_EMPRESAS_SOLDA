import { Router } from 'express';
import { requirePermission } from '../../middlewares/auth';
import { companiesController as c } from './companies.controller';
import { projectsController } from '../projects/projects.controller';
export const companiesRoutes = Router();
companiesRoutes.get('/', requirePermission('companies.view'), c.list);
companiesRoutes.get(
  '/:companyId/projects',
  requirePermission('projects.view'),
  projectsController.byCompany,
);
companiesRoutes.get('/:id', requirePermission('companies.view'), c.get);
companiesRoutes.post('/', requirePermission('companies.create'), c.create);
companiesRoutes.put('/:id', requirePermission('companies.edit'), c.update);
companiesRoutes.patch('/:id/status', requirePermission('companies.archive'), c.status);
