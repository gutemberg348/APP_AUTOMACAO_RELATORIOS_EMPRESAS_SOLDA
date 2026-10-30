import { ZodError } from 'zod';
import { reportSections } from './report-fields';
import { isVisualWeldReport } from './enums';
import { validateSpecificData } from './schemas/reports';
import { drawingDataSchema } from './drawings';
import type { ReportStatus } from './enums';

export const reportDisplayStatuses = ['DRAFT', 'IN_REVIEW', 'APPROVED'] as const;
export const reportStatusLabels: Record<ReportStatus, string> = {
  DRAFT: 'Rascunho',
  IN_REVIEW: 'Análise',
  APPROVED: 'Aprovado',
  FINISHED: 'Aprovado',
};
export const displayReportStatus = (status: ReportStatus) =>
  status === 'FINISHED' ? 'APPROVED' : status;

type ReviewReport = {
  title: string;
  reportDate: string | Date | null;
  specificData: unknown;
  reportType: { code: string; config: unknown };
  points?: { id?: string; number: string; type: string; value?: number | null; data?: unknown }[];
  drawings?: { data: unknown }[];
  media?: { reportPointId: string | null }[];
  signatures?: {
    name: string;
    signatureAssetId?: string | null;
    signatureImagePath?: string | null;
  }[];
};
export function reportReviewWarnings(report: ReviewReport): string[] {
  const warnings: string[] = [];
  if (!report.title.trim()) warnings.push('Título do relatório não preenchido.');
  if (!report.reportDate) warnings.push('Data do relatório não preenchida.');
  try {
    validateSpecificData(
      report.reportType.code,
      report.specificData,
      'submission',
      report.reportType.config,
    );
  } catch (error) {
    if (!(error instanceof ZodError)) throw error;
    const fields =
      reportSections[report.reportType.code]?.flatMap((section) => section.fields) ?? [];
    for (const issue of error.issues) {
      const path = issue.path.join('.');
      const label = fields.find((field) => field.path === path)?.label ?? path;
      warnings.push(`${label}: ${issue.message}`);
    }
  }
  const points = report.points ?? [];
  if (report.points && !points.length && report.reportType.code !== 'RDO')
    warnings.push('Nenhum ponto foi registrado nesta inspeção.');
  const numbered = (items: typeof points) => items.map((point) => point.number).join(', ');
  const unchecked = points.filter(
    (point) =>
      !point.data ||
      typeof point.data !== 'object' ||
      !('acceptable' in point.data) ||
      typeof point.data.acceptable !== 'boolean',
  );
  if (unchecked.length) warnings.push('Pontos sem resultado: ' + numbered(unchecked) + '.');
  const measurements = points.filter(
    (point) => point.type === 'MEASUREMENT' && point.value == null,
  );
  if (measurements.length) warnings.push('Pontos sem leitura: ' + numbered(measurements) + '.');
  if (isVisualWeldReport(report.reportType.code)) {
    const withoutPhotos = points.filter(
      (point) => !(report.media ?? []).some((photo) => photo.reportPointId === point.id),
    );
    if (withoutPhotos.length) warnings.push('Pontos sem fotos: ' + numbered(withoutPhotos) + '.');
  }
  if (report.drawings?.length) {
    const marked = new Set(
      report.drawings.flatMap((drawing, index) => {
        const parsed = drawingDataSchema.safeParse(drawing.data);
        if (!parsed.success)
          throw new ZodError(
            parsed.error.issues.map((issue) => ({
              ...issue,
              path: ['drawings', index, 'data', ...issue.path],
            })),
          );
        return parsed.data.elements.flatMap((element) =>
          element.type === 'point' ? [element.reportPointId] : [],
        );
      }),
    );
    const missing = points.filter((point) => !marked.has(point.id!));
    if (missing.length) warnings.push('Pontos sem marcação no desenho: ' + numbered(missing) + '.');
  }
  if (
    report.signatures?.some(
      (signer) => !signer.name.trim() || (!signer.signatureAssetId && !signer.signatureImagePath),
    )
  )
    warnings.push('Há responsáveis sem nome ou assinatura.');
  return [...new Set(warnings)];
}
