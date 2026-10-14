import type { RequestHandler } from 'express';
import { hasGlobalCompanyAccess, type CurrentUser } from '@weldcosta/shared';
import type { Prisma } from '../generated/prisma/client';
import { prisma } from '../prisma/client';
import { AppError } from '../errors/app-error';
import { idParam } from '../utils/http';

export function companyScope(user: CurrentUser): Prisma.CompanyWhereInput {
  return hasGlobalCompanyAccess(user.role.code) ? {} : { id: { in: user.companyIds ?? [] } };
}
export function projectScope(user: CurrentUser): Prisma.ProjectWhereInput {
  return hasGlobalCompanyAccess(user.role.code) ? {} : { companyId: { in: user.companyIds ?? [] } };
}
export function reportScope(user: CurrentUser): Prisma.ReportWhereInput {
  return {
    ...(hasGlobalCompanyAccess(user.role.code) ? {} : { companyId: { in: user.companyIds ?? [] } }),
    ...(user.role.code === 'OPERATOR' ? { createdById: user.id } : {}),
  };
}
export function signatureScope(user: CurrentUser): Prisma.SignatureAssetWhereInput {
  return hasGlobalCompanyAccess(user.role.code)
    ? {}
    : {
        OR: [
          { createdById: user.id },
          { signatures: { some: { report: { deletedAt: null, ...reportScope(user) } } } },
        ],
      };
}
export function assertCompanyAccess(user: CurrentUser, companyId: string) {
  if (!hasGlobalCompanyAccess(user.role.code) && !(user.companyIds ?? []).includes(companyId))
    throw new AppError(
      403,
      'COMPANY_ACCESS_DENIED',
      'Esta empresa não foi liberada para você. Peça ao administrador para liberar o acesso.',
    );
}
export const requireCompanyAccess: RequestHandler = async (req, _res, next) => {
  assertCompanyAccess(req.user!, idParam(req));
  next();
};
export const requireProjectAccess: RequestHandler = async (req, _res, next) => {
  if (
    !hasGlobalCompanyAccess(req.user!.role.code) &&
    !(await prisma.project.findFirst({
      where: { id: idParam(req), ...projectScope(req.user!) },
      select: { id: true },
    }))
  )
    throw new AppError(404, 'NOT_FOUND', 'Obra não encontrada ou não liberada para você.');
  next();
};
export const requireReportAccess: RequestHandler = async (req, _res, next) => {
  if (
    !hasGlobalCompanyAccess(req.user!.role.code) &&
    !(await prisma.report.findFirst({
      where: { id: idParam(req), deletedAt: null, ...reportScope(req.user!) },
      select: { id: true },
    }))
  )
    throw new AppError(404, 'NOT_FOUND', 'Relatório não encontrado ou não liberado para você.');
  next();
};
