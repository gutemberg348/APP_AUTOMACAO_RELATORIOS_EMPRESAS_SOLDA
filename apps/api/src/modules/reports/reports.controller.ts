import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  reportCreateSchema,
  reportUpdateSchema,
  transitionSchema,
  reportStatuses,
} from '@weldcosta/shared';
import { send, idParam, listQuery } from '../../utils/http';
import { reportsService } from './reports.service';
export const reportsController = {
  async list(req: Request, res: Response) {
    send(
      res,
      await reportsService.list(
        listQuery(req, ['createdAt', 'updatedAt', 'number', 'title', 'reportDate'], reportStatuses),
        req.user!,
      ),
    );
  },
  async get(req: Request, res: Response) {
    send(res, await reportsService.get(idParam(req)));
  },
  async create(req: Request, res: Response) {
    send(res, await reportsService.create(reportCreateSchema.parse(req.body), req.user!), 201);
  },
  async update(req: Request, res: Response) {
    send(
      res,
      await reportsService.update(idParam(req), reportUpdateSchema.parse(req.body), req.user!),
    );
  },
  async transition(req: Request, res: Response) {
    send(
      res,
      await reportsService.transition(idParam(req), transitionSchema.parse(req.body), req.user!),
    );
  },
  async remove(req: Request, res: Response) {
    const { version } = z.object({ version: z.number().int().positive() }).strict().parse(req.body);
    send(res, await reportsService.remove(idParam(req), version, req.user!));
  },
  async generatePdf(req: Request, res: Response) {
    const { version } = z.object({ version: z.number().int().positive() }).strict().parse(req.body);
    send(res, await reportsService.generatePdf(idParam(req), version, req.user!));
  },
};
