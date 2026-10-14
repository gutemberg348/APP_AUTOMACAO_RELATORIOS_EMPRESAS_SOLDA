import type { Request, Response } from 'express';
import { projectSchema, statusSchema, recordStatuses } from '@weldcosta/shared';
import { send, idParam, listQuery } from '../../utils/http';
import { projectsService } from './projects.service';
export const projectsController = {
  async list(req: Request, res: Response) {
    send(
      res,
      await projectsService.list(
        listQuery(req, ['createdAt', 'updatedAt', 'name'], recordStatuses),
        req.user!,
      ),
    );
  },
  async byCompany(req: Request, res: Response) {
    const query = listQuery(req, ['createdAt', 'updatedAt', 'name'], recordStatuses);
    send(
      res,
      await projectsService.list({ ...query, companyId: idParam(req, 'companyId') }, req.user!),
    );
  },
  async get(req: Request, res: Response) {
    send(res, await projectsService.get(idParam(req)));
  },
  async create(req: Request, res: Response) {
    send(res, await projectsService.create(projectSchema.parse(req.body), req.user!), 201);
  },
  async update(req: Request, res: Response) {
    send(
      res,
      await projectsService.update(idParam(req), projectSchema.parse(req.body), req.user!.id),
    );
  },
  async status(req: Request, res: Response) {
    send(
      res,
      await projectsService.status(idParam(req), statusSchema.parse(req.body).status, req.user!.id),
    );
  },
};
