import type { Request, Response } from 'express';
import { z } from 'zod';
import { listQuerySchema } from '@weldcosta/shared';
import { AppError } from '../errors/app-error';
export function send<T>(res: Response, data: T, status = 200) {
  res.status(status).json({ success: true, data });
}
export function idParam(req: Request, key = 'id') {
  return z.uuid().parse(req.params[key]);
}
export function listQuery(req: Request, sorts: readonly string[], statuses?: readonly string[]) {
  const query = listQuerySchema.parse(req.query);
  if (!sorts.includes(query.sortBy))
    throw new AppError(400, 'INVALID_SORT', 'Ordenação não permitida.');
  if (query.status && statuses && !statuses.includes(query.status))
    throw new AppError(400, 'INVALID_STATUS', 'Status incompatível com esta listagem.');
  return query;
}
export type ListQuery = ReturnType<typeof listQuerySchema.parse>;
export function pagination(query: ListQuery) {
  return {
    skip: (query.page - 1) * query.limit,
    take: query.limit,
    orderBy: { [query.sortBy]: query.sortOrder },
  };
}
export function pageResult<T>(items: T[], total: number, query: ListQuery) {
  return {
    items,
    total,
    page: query.page,
    limit: query.limit,
    pages: Math.ceil(total / query.limit),
  };
}
