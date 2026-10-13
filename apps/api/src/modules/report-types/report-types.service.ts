import { prisma } from '../../prisma/client';
import { AppError } from '../../errors/app-error';
import { pagination, pageResult, type ListQuery } from '../../utils/http';
export const reportTypesService = {
  async list(query: ListQuery) {
    const where = { active: true };
    const [items, total] = await prisma.$transaction([
      prisma.reportType.findMany({ where, ...pagination(query) }),
      prisma.reportType.count({ where }),
    ]);
    return pageResult(items, total, query);
  },
  async get(id: string) {
    const type = await prisma.reportType.findUnique({ where: { id } });
    if (!type) throw new AppError(404, 'NOT_FOUND', 'Tipo de relatório não encontrado.');
    return type;
  },
};
