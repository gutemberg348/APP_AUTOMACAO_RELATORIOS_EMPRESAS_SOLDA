import type { z } from 'zod';
import { projectSchema } from '@weldcosta/shared';
import type { Prisma, RecordStatus } from '../../generated/prisma/client';
import { prisma } from '../../prisma/client';
import { AppError } from '../../errors/app-error';
import { pagination, pageResult, type ListQuery } from '../../utils/http';
type Input = z.infer<typeof projectSchema>;
const dates = (data: Input) => ({
  ...data,
  startDate: data.startDate ? new Date(data.startDate) : null,
  endDate: data.endDate ? new Date(data.endDate) : null,
});
export const projectsService = {
  async list(query: ListQuery) {
    const where: Prisma.ProjectWhereInput = {
      companyId: query.companyId,
      status: query.status as RecordStatus | undefined,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.project.findMany({ where, ...pagination(query), include: { company: true } }),
      prisma.project.count({ where }),
    ]);
    return pageResult(items, total, query);
  },
  async get(id: string) {
    const project = await prisma.project.findUnique({ where: { id }, include: { company: true } });
    if (!project) throw new AppError(404, 'NOT_FOUND', 'Obra não encontrada.');
    return project;
  },
  create(data: Input, userId: string) {
    return prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({ where: { id: data.companyId } });
      if (!company || company.status !== 'ACTIVE')
        throw new AppError(409, 'INACTIVE_COMPANY', 'Selecione uma empresa ativa.');
      const project = await tx.project.create({ data: dates(data) });
      await tx.auditLog.create({
        data: { userId, action: 'CREATE_PROJECT', entity: 'Project', entityId: project.id },
      });
      return project;
    });
  },
  update(id: string, data: Input, userId: string) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.project.findUniqueOrThrow({ where: { id } });
      // Reports retain their original company/project association.
      if (current.companyId !== data.companyId)
        throw new AppError(
          409,
          'PROJECT_COMPANY_LOCKED',
          'A empresa da obra não pode ser alterada.',
        );
      const project = await tx.project.update({ where: { id }, data: dates(data) });
      await tx.auditLog.create({
        data: { userId, action: 'UPDATE_PROJECT', entity: 'Project', entityId: id },
      });
      return project;
    });
  },
  status(id: string, status: RecordStatus, userId: string) {
    return prisma.$transaction(async (tx) => {
      const project = await tx.project.update({ where: { id }, data: { status } });
      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE_PROJECT',
          entity: 'Project',
          entityId: id,
          metadata: { status },
        },
      });
      return project;
    });
  },
};
