import type { z } from 'zod';
import { companySchema } from '@weldcosta/shared';
import type { Prisma, RecordStatus } from '../../generated/prisma/client';
import { prisma } from '../../prisma/client';
import { AppError } from '../../errors/app-error';
import { pagination, pageResult, type ListQuery } from '../../utils/http';
export const companiesService = {
  async list(query: ListQuery) {
    const where: Prisma.CompanyWhereInput = {
      status: query.status as RecordStatus | undefined,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { corporateName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.company.findMany({ where, ...pagination(query) }),
      prisma.company.count({ where }),
    ]);
    return pageResult(items, total, query);
  },
  async get(id: string) {
    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) throw new AppError(404, 'NOT_FOUND', 'Empresa não encontrada.');
    return company;
  },
  create(data: z.infer<typeof companySchema>, userId: string) {
    return prisma.$transaction(async (tx) => {
      const company = await tx.company.create({ data });
      await tx.auditLog.create({
        data: { userId, action: 'CREATE_COMPANY', entity: 'Company', entityId: company.id },
      });
      return company;
    });
  },
  update(id: string, data: z.infer<typeof companySchema>, userId: string) {
    return prisma.$transaction(async (tx) => {
      const company = await tx.company.update({ where: { id }, data });
      await tx.auditLog.create({
        data: { userId, action: 'UPDATE_COMPANY', entity: 'Company', entityId: id },
      });
      return company;
    });
  },
  status(id: string, status: RecordStatus, userId: string) {
    return prisma.$transaction(async (tx) => {
      const company = await tx.company.update({ where: { id }, data: { status } });
      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE_COMPANY',
          entity: 'Company',
          entityId: id,
          metadata: { status },
        },
      });
      return company;
    });
  },
};
