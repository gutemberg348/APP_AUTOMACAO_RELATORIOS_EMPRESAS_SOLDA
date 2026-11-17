import { z } from 'zod';
import { reportSections, type ReportSection } from './report-fields';

export const reportSectionIds = [
  'identification',
  'technical',
  'generalData',
  'materials',
  'manometer',
  'equipment',
  'calculation',
  'conclusion',
  'signatures',
  'drawings',
  'points',
  'testPhotos',
  'discontinuities',
  'inspectionRecords',
  'data',
] as const;
export type ReportSectionId = (typeof reportSectionIds)[number];
export const omittedReportSectionsSchema = z
  .array(z.enum(reportSectionIds))
  .max(reportSectionIds.length)
  .refine((v) => new Set(v).size === v.length, 'Não repita as etapas removidas.');
export function reportSectionId(section: ReportSection & { content?: string }): ReportSectionId {
  if (section.content && reportSectionIds.includes(section.content as ReportSectionId))
    return section.content as ReportSectionId;
  return (
    (
      {
        Identificação: 'identification',
        'Dados do ensaio': 'technical',
        'Dados gerais': 'generalData',
        'Materiais utilizados': 'materials',
        'Dados do teste': 'technical',
        Manômetro: 'manometer',
        Equipamento: 'equipment',
        'Cálculo · memorial de tubulação': 'calculation',
        Laudo: 'conclusion',
        Observação: 'conclusion',
        Dados: 'data',
      } as Record<string, ReportSectionId>
    )[section.title] ?? 'technical'
  );
}
export function omittedReportSections(data: unknown): ReportSectionId[] {
  const raw =
    data && typeof data === 'object'
      ? (data as Record<string, unknown>).omittedSections
      : undefined;
  return raw === undefined ? [] : omittedReportSectionsSchema.parse(raw);
}
type LayoutReport = { reportType: { code: string }; specificData: unknown };
export const reportSectionVisible = (report: LayoutReport, id: ReportSectionId) =>
  !omittedReportSections(report.specificData).includes(id);
export function reportFieldVisible(report: LayoutReport, path: string) {
  const section = reportSections[report.reportType.code]?.find((s) =>
    s.fields.some((f) => f.path === path),
  );
  return !section || reportSectionVisible(report, reportSectionId(section));
}
export function reportFieldSection(report: LayoutReport, path: string) {
  const section = reportSections[report.reportType.code]?.find((s) =>
    s.fields.some((f) => f.path === path),
  );
  return section ? reportSectionId(section) : 'technical';
}
/** Layout choices belong only to their report, never to defaults for a new inspection. */
export function withoutReportLayout(data: Record<string, unknown>) {
  const result = { ...data };
  delete result.customPages;
  delete result.omittedSections;
  return result;
}

export function visibleReportData(report: LayoutReport): Record<string, unknown> {
  const data = JSON.parse(JSON.stringify(report.specificData ?? {})) as Record<string, unknown>;
  for (const section of reportSections[report.reportType.code] ?? []) {
    if (reportSectionVisible(report, reportSectionId(section))) continue;
    for (const field of section.fields) {
      const parts = field.path.split('.');
      let target: Record<string, unknown> | undefined = data;
      for (const part of parts.slice(0, -1)) {
        const next: unknown = target?.[part];
        target =
          next && typeof next === 'object' && !Array.isArray(next)
            ? (next as Record<string, unknown>)
            : undefined;
      }
      if (target) delete target[parts.at(-1)!];
    }
  }
  return data;
}
