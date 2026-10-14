import type { Request, Response } from 'express';
import { companySchema, statusSchema, recordStatuses } from '@weldcosta/shared';
import { send, idParam, listQuery } from '../../utils/http';
import { companiesService } from './companies.service';
export const companiesController = {
  async list(req: Request, res: Response) {
    send(
      res,
      await companiesService.list(
        listQuery(req, ['createdAt', 'updatedAt', 'name'], recordStatuses),
        req.user!,
      ),
    );
  },
  async get(req: Request, res: Response) {
    send(res, await companiesService.get(idParam(req)));
  },
  async create(req: Request, res: Response) {
    send(res, await companiesService.create(companySchema.parse(req.body), req.user!), 201);
  },
  async update(req: Request, res: Response) {
    send(
      res,
      await companiesService.update(idParam(req), companySchema.parse(req.body), req.user!.id),
    );
  },
  async status(req: Request, res: Response) {
    send(
      res,
      await companiesService.status(
        idParam(req),
        statusSchema.parse(req.body).status,
        req.user!.id,
      ),
    );
  },
};
