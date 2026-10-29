import { z } from 'zod';
import {
  reportCreateSchema,
  reportUpdateSchema,
  reportSubmissionSchema,
  transitionSchema,
  validateSpecificData,
  buildReportDefaults,
  type ReportDefaults,
  type ReportPoint,
  type ReportSigner,
  type ReportDrawing,
  drawingDataSchema,
  canSetReportStatus,
  reportReviewWarnings,
  type CurrentUser,
} from '@weldcosta/shared';
import { prisma } from '../../prisma/client';
import type { Prisma, ReportStatus } from '../../generated/prisma/client';
import { AppError } from '../../errors/app-error';
import { pagination, pageResult, type ListQuery } from '../../utils/http';
import { assertEditable, assertFieldAccess, assertTransition } from './reports.policy';
import { PdfService, type PdfProvider } from '../pdf/pdf.service';
import { LocalStorageProvider } from '../../services/storage/local-storage-provider';
import { env } from '../../config/env';
import { reportScope, assertCompanyAccess, signatureScope } from '../../middlewares/access-scope';
const reportListInclude = { company: true, project: true, reportType: true } as const;
const reportNumberRequired = reportCreateSchema.pick({ number: true });
export const reportInclude = {
  ...reportListInclude,
  points: { orderBy: { sortOrder: 'asc' as const } },
  signatures: true,
  drawings: {
    orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
    select: { id: true, data: true },
  },
  media: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true,
      reportPointId: true,
      sectionKey: true,
      caption: true,
      annotations: true,
      originalName: true,
      clientUploadId: true,
      mimeType: true,
    },
  },
  pdfs: {
    select: { id: true, version: true, createdAt: true },
    orderBy: { version: 'desc' as const },
  },
} satisfies Prisma.ReportInclude;
const json = (value: Record<string, unknown>) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
const date = (value: string | null | undefined) => (value ? new Date(value) : null);
function specific(code: string, data: unknown, mode: 'draft' | 'submission', config: unknown) {
  try {
    return json(validateSpecificData(code, data, mode, config));
  } catch (error) {
    if (error instanceof z.ZodError)
      throw new z.ZodError(
        error.issues.map((issue) => ({ ...issue, path: ['specificData', ...issue.path] })),
      );
    if (error instanceof Error && error.message.startsWith('REPORT_TYPE_SCHEMA_MISSING:'))
      throw new AppError(
        422,
        'REPORT_TYPE_SCHEMA_MISSING',
        'Este tipo ainda não possui schema configurado.',
      );
    throw error;
  }
}
async function getReport(tx: Prisma.TransactionClient, id: string) {
  const report = await tx.report.findFirst({
    where: { id, deletedAt: null },
    include: reportInclude,
  });
  if (!report) throw new AppError(404, 'NOT_FOUND', 'Relatório não encontrado.');
  return report;
}
const conflict = () =>
  new AppError(
    409,
    'VERSION_CONFLICT',
    'O relatório foi alterado. Atualize a tela antes de continuar.',
  );
async function saveCollections(
  tx: Prisma.TransactionClient,
  reportId: string,
  points?: ReportPoint[],
  signatures?: ReportSigner[],
  drawings?: ReportDrawing[],
  user?: CurrentUser,
) {
  const currentDrawings = await tx.reportDrawing.findMany({ where: { reportId } });
  const effectiveDrawings =
    drawings ?? currentDrawings.map((d) => ({ id: d.id, data: drawingDataSchema.parse(d.data) }));
  const clientIds = new Map<string, string>();
  if (points) {
    const existing = await tx.reportPoint.findMany({ where: { reportId }, select: { id: true } });
    const ids = new Set(existing.map((point) => point.id));
    const provided = points.flatMap((point) => (point.id ? [point.id] : []));
    if (provided.some((id) => !ids.has(id)) || new Set(provided).size !== provided.length)
      throw new AppError(
        400,
        'INVALID_POINT',
        'Ponto não pertence a este relatório ou está repetido.',
      );
    const localIds = points.flatMap((p) => (p.clientId ? [p.clientId] : []));
    if (new Set(localIds).size !== localIds.length)
      throw new AppError(400, 'INVALID_POINT', 'Identificação local do ponto repetida.');
    const removed = existing.filter((p) => !provided.includes(p.id)).map((p) => p.id);
    if (
      effectiveDrawings.some((d) =>
        d.data.elements.some((e) => e.type === 'point' && removed.includes(e.reportPointId)),
      )
    )
      throw new AppError(
        409,
        'POINT_IN_DRAWING',
        'Remova a marcação do desenho antes de excluir este ponto.',
      );
    if (
      removed.length &&
      (await tx.reportMedia.count({ where: { reportId, reportPointId: { in: removed } } }))
    )
      throw new AppError(
        409,
        'POINT_HAS_PHOTOS',
        'Remova ou desvincule as fotos antes de excluir este ponto.',
      );
    await tx.reportPoint.deleteMany({ where: { reportId, id: { notIn: provided } } });
    for (const [sortOrder, point] of points.entries()) {
      const { id, clientId, data, ...fields } = point;
      const values = { ...fields, data: json(data ?? {}), sortOrder };
      if (id) await tx.reportPoint.update({ where: { id }, data: values });
      else {
        const saved = await tx.reportPoint.create({ data: { ...values, reportId } });
        if (clientId) clientIds.set(clientId, saved.id);
      }
    }
  }
  if (drawings) {
    const existing = new Set(currentDrawings.map((d) => d.id));
    const provided = drawings.flatMap((d) => (d.id ? [d.id] : []));
    if (provided.some((id) => !existing.has(id)) || new Set(provided).size !== provided.length)
      throw new AppError(
        400,
        'INVALID_DRAWING',
        'Desenho não pertence ao relatório ou está repetido.',
      );
    const reportPoints = await tx.reportPoint.findMany({
      where: { reportId },
      select: { id: true, number: true },
    });
    const pointIds = new Set(reportPoints.map((p) => p.id));
    const linked = new Set<string>();
    const normalized = drawings.map((d) => ({
      ...d,
      data: {
        ...d.data,
        elements: d.data.elements.map((e) => {
          if (e.type !== 'point') return e;
          const reportPointId = clientIds.get(e.reportPointId) ?? e.reportPointId;
          if (!pointIds.has(reportPointId))
            throw new AppError(
              400,
              'INVALID_DRAWING_POINT',
              'O desenho referencia um ponto que não pertence ao relatório.',
            );
          linked.add(reportPointId);
          return { ...e, reportPointId };
        }),
      },
    }));
    const numbers = reportPoints
      .filter((p) => linked.has(p.id))
      .map((p) => p.number.trim().toLocaleUpperCase());
    if (
      numbers.some((n) => !n) ||
      numbers.some(
        (n) => reportPoints.filter((p) => p.number.trim().toLocaleUpperCase() === n).length > 1,
      )
    )
      throw new AppError(
        400,
        'AMBIGUOUS_POINT_NUMBER',
        'Informe um número único para cada ponto do desenho.',
      );
    await tx.reportDrawing.deleteMany({ where: { reportId, id: { notIn: provided } } });
    for (const [sortOrder, d] of normalized.entries()) {
      if (d.id)
        await tx.reportDrawing.update({
          where: { id: d.id },
          data: { data: json(d.data), sortOrder },
        });
      else await tx.reportDrawing.create({ data: { reportId, data: json(d.data), sortOrder } });
    }
  } else if (points) {
    const linked = new Set(
      effectiveDrawings.flatMap((d) =>
        d.data.elements.flatMap((e) => (e.type === 'point' ? [e.reportPointId] : [])),
      ),
    );
    const all = await tx.reportPoint.findMany({
      where: { reportId },
      select: { id: true, number: true },
    });
    for (const p of all.filter((p) => linked.has(p.id)))
      if (
        !p.number.trim() ||
        all.filter(
          (other) =>
            other.number.trim().toLocaleUpperCase() === p.number.trim().toLocaleUpperCase(),
        ).length > 1
      )
        throw new AppError(
          400,
          'AMBIGUOUS_POINT_NUMBER',
          'Informe um número único para cada ponto do desenho.',
        );
  }
  if (signatures) {
    const assets = await tx.signatureAsset.findMany({
      where: {
        ...(user ? signatureScope(user) : {}),
        id: { in: signatures.flatMap((s) => (s.signatureAssetId ? [s.signatureAssetId] : [])) },
      },
    });
    if (
      signatures.some((s) => s.signatureAssetId && !assets.some((a) => a.id === s.signatureAssetId))
    )
      throw new AppError(
        400,
        'INVALID_SIGNATURE',
        'Uma assinatura não foi encontrada. Selecione ou envie novamente.',
      );
    await tx.reportSignature.deleteMany({ where: { reportId } });
    await tx.reportSignature.createMany({
      data: signatures.map((signer) => ({
        ...signer,
        reportId,
        signedAt: date(signer.signedAt),
        signatureImagePath: assets.find((a) => a.id === signer.signatureAssetId)?.filePath ?? null,
      })),
    });
  }
}
export class ReportsService {
  constructor(private pdf: PdfProvider = new PdfService()) {}
  async list(query: ListQuery, user: CurrentUser) {
    const where: Prisma.ReportWhereInput = {
      deletedAt: null,
      AND: [reportScope(user)],
      companyId: query.companyId,
      projectId: query.projectId,
      reportTypeId: query.reportTypeId,
      createdById: query.createdById,
      status:
        query.status === 'APPROVED'
          ? { in: ['APPROVED', 'FINISHED'] }
          : (query.status as ReportStatus | undefined),
      ...(query.dateFrom || query.dateTo
        ? {
            reportDate: {
              gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
              lte: query.dateTo ? new Date(query.dateTo) : undefined,
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { number: { contains: query.search, mode: 'insensitive' } },
              { title: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.report.findMany({ where, ...pagination(query), include: reportListInclude }),
      prisma.report.count({ where }),
    ]);
    return pageResult(items, total, query);
  }
  async get(id: string) {
    return getReport(prisma, id);
  }
  async create(data: z.infer<typeof reportCreateSchema>, user: CurrentUser) {
    assertCompanyAccess(user, data.companyId);
    return prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({ where: { id: data.projectId } });
      const company = await tx.company.findUnique({ where: { id: data.companyId } });
      const type = await tx.reportType.findUnique({ where: { id: data.reportTypeId } });
      if (
        !company ||
        company.status !== 'ACTIVE' ||
        !project ||
        project.status !== 'ACTIVE' ||
        project.companyId !== company.id
      )
        throw new AppError(
          409,
          'INVALID_PROJECT_COMPANY',
          'Selecione uma obra ativa pertencente à empresa informada.',
        );
      if (!type?.active)
        throw new AppError(422, 'INVALID_REPORT_TYPE', 'Selecione um tipo de relatório ativo.');
      const { points, signatures, drawings, prefillFromProject, ...fields } = data;
      if (drawings?.length && !user.permissions.includes('drawing.edit'))
        throw new AppError(403, 'FORBIDDEN', 'Você não possui permissão para editar desenhos.');
      const defaultData = buildReportDefaults(
        type.code,
        { ...project, reportDefaults: project.reportDefaults as ReportDefaults },
        company,
      );
      const report = await tx.report.create({
        data: {
          ...fields,
          reportDate: date(data.reportDate),
          specificData: specific(
            type.code,
            prefillFromProject ? { ...defaultData, ...data.specificData } : data.specificData,
            'draft',
            type.config,
          ),
          createdById: user.id,
        },
        include: reportInclude,
      });
      await saveCollections(tx, report.id, points, signatures, drawings, user);
      await tx.auditLog.create({
        data: { userId: user.id, action: 'CREATE_REPORT', entity: 'Report', entityId: report.id },
      });
      return getReport(tx, report.id);
    });
  }
  async update(id: string, input: z.infer<typeof reportUpdateSchema>, user: CurrentUser) {
    const deletedFiles: string[] = [];
    const saved = await prisma.$transaction(async (tx) => {
      const report = await getReport(tx, id);
      assertEditable(report.status, user);
      if (report.version !== input.version) throw conflict();
      const { version, points, signatures, drawings, removePointMediaIds = [], ...fields } = input;
      reportNumberRequired.parse({ number: input.number ?? report.number });
      if (drawings && !user.permissions.includes('drawing.edit'))
        throw new AppError(403, 'FORBIDDEN', 'Você não possui permissão para editar desenhos.');
      const previous = {
        number: report.number,
        title: report.title,
        reportDate: report.reportDate?.toISOString().slice(0, 10) ?? null,
        specificData: report.specificData,
        ...(points
          ? {
              points: report.points.map(({ id, number, type, label, value, unit, data }) => ({
                id,
                number,
                type,
                label: label ?? '',
                value,
                unit: unit ?? '',
                data,
              })),
            }
          : {}),
        ...(signatures
          ? {
              signatures: report.signatures.map(
                ({ role, name, registrationNumber, signedAt, signatureAssetId }) => ({
                  role,
                  name,
                  registrationNumber: registrationNumber ?? '',
                  signedAt: signedAt?.toISOString().slice(0, 10),
                  ...(signatureAssetId ? { signatureAssetId } : {}),
                }),
              ),
            }
          : {}),
      };
      assertFieldAccess(
        previous,
        {
          ...previous,
          ...fields,
          ...(points ? { points } : {}),
          ...(signatures
            ? {
                signatures: signatures.map((s) => ({
                  ...s,
                  signatureAssetId: s.signatureAssetId || undefined,
                })),
              }
            : {}),
        },
        report.reportType.config,
        user,
      );
      const data: Prisma.ReportUpdateManyMutationInput = {
        number: input.number,
        title: input.title,
        ...(input.reportDate !== undefined ? { reportDate: date(input.reportDate) } : {}),
        ...(input.specificData !== undefined
          ? {
              specificData: specific(
                report.reportType.code,
                input.specificData,
                'draft',
                report.reportType.config,
              ),
            }
          : {}),
        version: { increment: 1 },
      };
      const changed = await tx.report.updateMany({
        where: { id, version, status: report.status, deletedAt: null },
        data,
      });
      if (changed.count !== 1) throw conflict();
      if (removePointMediaIds.length) {
        if (!user.permissions.includes('media.delete'))
          throw new AppError(403, 'FORBIDDEN', 'Você não possui permissão para remover fotos.');
        const removedPoints = points
          ? report.points.filter((p) => !points.some((next) => next.id === p.id)).map((p) => p.id)
          : [];
        const media = await tx.reportMedia.findMany({
          where: {
            id: { in: removePointMediaIds },
            reportId: id,
            reportPointId: { in: removedPoints },
          },
        });
        if (media.length !== new Set(removePointMediaIds).size)
          throw new AppError(
            400,
            'INVALID_POINT_MEDIA',
            'Confirme apenas fotos dos pontos removidos deste relatório.',
          );
        await tx.reportMedia.deleteMany({
          where: { id: { in: media.map((m) => m.id) }, reportId: id },
        });
        await tx.auditLog.createMany({
          data: media.map((m) => ({
            userId: user.id,
            action: 'DELETE_MEDIA',
            entity: 'Report',
            entityId: id,
            metadata: { mediaId: m.id, reportPointId: m.reportPointId, reason: 'REMOVE_POINT' },
          })),
        });
        deletedFiles.push(...media.map((m) => m.filePath));
      }
      await saveCollections(tx, id, points, signatures, drawings, user);
      await tx.auditLog.create({
        data: { userId: user.id, action: 'UPDATE_REPORT', entity: 'Report', entityId: id },
      });
      return getReport(tx, id);
    });
    const storage = new LocalStorageProvider(env.STORAGE_PATH);
    await Promise.all(
      deletedFiles.map((file) =>
        storage.delete(file).catch((error) => console.error('Media cleanup failed', error)),
      ),
    );
    return saved;
  }
  async transition(id: string, input: z.infer<typeof transitionSchema>, user: CurrentUser) {
    if (input.status === 'FINISHED') return this.finish(id, input.version, user);
    if (input.quick) return this.quickTransition(id, input, user);
    return prisma.$transaction(async (tx) => {
      const report = await getReport(tx, id);
      if (report.version !== input.version) throw conflict();
      assertTransition(report.status, input.status, user.permissions);
      let data: Prisma.ReportUncheckedUpdateManyInput = {
        status: input.status,
        version: { increment: 1 },
      };
      let action = '';
      if (input.status === 'IN_REVIEW') {
        reportSubmissionSchema.parse(report);
        specific(
          report.reportType.code,
          report.specificData,
          'submission',
          report.reportType.config,
        );
        data = {
          ...data,
          submittedAt: new Date(),
          revisionNotes: null,
          reviewedById: null,
          approvedById: null,
          approvedAt: null,
        };
        action = 'SUBMIT_REPORT';
      } else if (input.status === 'APPROVED') {
        data = { ...data, reviewedById: user.id, approvedById: user.id, approvedAt: new Date() };
        action = 'APPROVE_REPORT';
      } else if (input.status === 'DRAFT') {
        if (!input.revisionNotes)
          throw new AppError(400, 'REVISION_NOTES_REQUIRED', 'Informe a correção solicitada.');
        data = { ...data, revisionNotes: input.revisionNotes, reviewedById: user.id };
        action = 'REQUEST_CHANGES';
      }
      const changed = await tx.report.updateMany({
        where: { id, version: input.version, status: report.status, deletedAt: null },
        data,
      });
      if (changed.count !== 1) throw conflict();
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action,
          entity: 'Report',
          entityId: id,
          metadata: { from: report.status, to: input.status },
        },
      });
      return getReport(tx, id);
    });
  }
  private async quickTransition(
    id: string,
    input: z.infer<typeof transitionSchema>,
    user: CurrentUser,
  ) {
    return prisma.$transaction(async (tx) => {
      const report = await getReport(tx, id);
      if (report.version !== input.version) throw conflict();
      if (!canSetReportStatus(report.status, input.status, user.permissions))
        throw new AppError(
          403,
          'FORBIDDEN',
          'Você não possui permissão para alterar para este status.',
        );
      if (input.status === 'IN_REVIEW' || input.status === 'APPROVED') {
        reportNumberRequired.parse({ number: report.number });
        if (!input.acknowledgeIncomplete) reportSubmissionSchema.parse(report);
        specific(
          report.reportType.code,
          report.specificData,
          input.acknowledgeIncomplete ? 'draft' : 'submission',
          report.reportType.config,
        );
      }
      const changed = await tx.report.updateMany({
        where: { id, version: input.version, status: report.status, deletedAt: null },
        data: {
          status: input.status,
          version: { increment: 1 },
          ...(input.status === 'DRAFT'
            ? {
                submittedAt: null,
                approvedAt: null,
                approvedById: null,
                reviewedById: user.id,
                finishedAt: null,
                revisionNotes: input.revisionNotes ?? 'Reaberto pelo seletor de status.',
              }
            : input.status === 'APPROVED'
              ? {
                  submittedAt: report.submittedAt ?? new Date(),
                  approvedAt: new Date(),
                  approvedById: user.id,
                  reviewedById: user.id,
                  finishedAt: null,
                  revisionNotes: null,
                }
              : {
                  submittedAt: new Date(),
                  approvedAt: null,
                  approvedById: null,
                  reviewedById: null,
                  finishedAt: null,
                  revisionNotes: null,
                }),
        },
      });
      if (changed.count !== 1) throw conflict();
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action:
            input.status === 'DRAFT'
              ? 'REOPEN_REPORT'
              : input.status === 'APPROVED'
                ? 'APPROVE_REPORT'
                : 'SUBMIT_REPORT',
          entity: 'Report',
          entityId: id,
          metadata: {
            from: report.status,
            to: input.status,
            source: 'STATUS_SELECT',
            ...(input.acknowledgeIncomplete
              ? { acknowledgeIncomplete: true, warnings: reportReviewWarnings(report) }
              : {}),
          },
        },
      });
      return getReport(tx, id);
    });
  }
  async generatePdf(id: string, version: number, user: CurrentUser) {
    if (!user.permissions.includes('pdf.download'))
      throw new AppError(403, 'FORBIDDEN', 'Você não possui permissão para baixar o PDF.');
    return this.finish(id, version, user, true);
  }
  private async finish(id: string, version: number, user: CurrentUser, preserveApproval = false) {
    const report = await getReport(prisma, id);
    if (report.version !== version) throw conflict();
    if (preserveApproval) {
      if (report.status !== 'APPROVED')
        throw new AppError(
          409,
          'INVALID_TRANSITION',
          'Aprove o relatório antes de gerar o PDF final.',
        );
    } else assertTransition(report.status, 'FINISHED', user.permissions);
    const artifact = await this.pdf.generate(report, user.id);
    try {
      return await prisma.$transaction(async (tx) => {
        const changed = await tx.report.updateMany({
          where: { id, version, status: 'APPROVED', deletedAt: null },
          data: {
            status: preserveApproval ? 'APPROVED' : 'FINISHED',
            ...(preserveApproval ? {} : { finishedAt: new Date() }),
            version: { increment: 1 },
          },
        });
        if (changed.count !== 1) throw conflict();
        await tx.reportPdf.create({ data: { ...artifact, reportId: id, generatedById: user.id } });
        await tx.auditLog.createMany({
          data: (preserveApproval ? ['GENERATE_PDF'] : ['GENERATE_PDF', 'FINISH_REPORT']).map(
            (action) => ({
              userId: user.id,
              action,
              entity: 'Report',
              entityId: id,
              metadata: { pdfId: artifact.id, version: artifact.version },
            }),
          ),
        });
        return getReport(tx, id);
      });
    } catch (error) {
      await this.pdf.discard(artifact.filePath).catch(() => {});
      throw error;
    }
  }
  async remove(id: string, version: number, user: CurrentUser) {
    return prisma.$transaction(async (tx) => {
      const report = await getReport(tx, id);
      const changed = await tx.report.updateMany({
        where: { id, version, status: report.status, deletedAt: null },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
      if (changed.count !== 1) throw conflict();
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'DELETE_REPORT',
          entity: 'Report',
          entityId: id,
          metadata: { previousStatus: report.status },
        },
      });
      return { deleted: true };
    });
  }
}
export const reportsService = new ReportsService();
