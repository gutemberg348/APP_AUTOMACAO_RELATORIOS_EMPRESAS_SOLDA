import { prisma } from '../../prisma/client';
import { reportInclude } from '../reports/reports.service';
export const dashboardService = {
  async get(granted: string[]) {
    const where = { deletedAt: null };
    const [
      totalCompanies,
      totalProjects,
      reportsDraft,
      reportsInReview,
      reportsApproved,
      reportsFinished,
      types,
      latestReports,
      awaitingReview,
    ] = await prisma.$transaction([
      granted.includes('companies.view')
        ? prisma.company.count()
        : prisma.company.count({ where: { id: '00000000-0000-0000-0000-000000000000' } }),
      granted.includes('projects.view')
        ? prisma.project.count()
        : prisma.project.count({ where: { id: '00000000-0000-0000-0000-000000000000' } }),
      prisma.report.count({ where: { ...where, status: 'DRAFT' } }),
      prisma.report.count({ where: { ...where, status: 'IN_REVIEW' } }),
      prisma.report.count({ where: { ...where, status: 'APPROVED' } }),
      prisma.report.count({ where: { ...where, status: 'FINISHED' } }),
      prisma.reportType.findMany({
        where: { active: true },
        orderBy: { code: 'asc' },
        include: { _count: { select: { reports: { where } } } },
      }),
      prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: reportInclude,
      }),
      prisma.report.findMany({
        where: { ...where, status: 'IN_REVIEW' },
        orderBy: { submittedAt: 'asc' },
        take: 6,
        include: reportInclude,
      }),
    ]);
    return {
      totalCompanies,
      totalProjects,
      totalReports: reportsDraft + reportsInReview + reportsApproved + reportsFinished,
      reportsDraft,
      reportsInReview,
      reportsApproved,
      reportsFinished,
      byType: types.map((type) => ({
        code: type.code,
        name: type.name,
        count: type._count.reports,
      })),
      latestReports,
      awaitingReview,
    };
  },
};
