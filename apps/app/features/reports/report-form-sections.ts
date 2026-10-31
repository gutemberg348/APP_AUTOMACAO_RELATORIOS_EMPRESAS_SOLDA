import { reportSections, reportTypeCodes, type ReportSection } from '@weldcosta/shared';

export type ReportFormSection = ReportSection & {
  content?: 'points' | 'discontinuities' | 'inspectionRecords' | 'signatures' | 'drawings';
};

// The model defines the complete form. Company/project defaults only supply values.
export function reportFormSections(code: string, base: ReportSection[]): ReportFormSection[] {
  const sections: ReportFormSection[] = [...base];
  const conclusion = sections.findIndex((section) =>
    ['Laudo', 'Observação'].includes(section.title),
  );
  sections.splice(
    conclusion < 0 ? sections.length : conclusion,
    0,
    ...(code === 'LP'
      ? [{ title: 'Descontinuidades', fields: [], content: 'discontinuities' as const }]
      : []),
    ...(code === 'EVD'
      ? [{ title: 'Registros de inspeção', fields: [], content: 'inspectionRecords' as const }]
      : []),
    { title: 'Desenho técnico', fields: [], content: 'drawings' },
    ...(reportTypeCodes.some((registered) => registered === code)
      ? [
          {
            title: code === 'ME' ? 'Pontos de medição' : 'Pontos de solda',
            fields: [],
            content: 'points' as const,
          },
        ]
      : []),
  );
  sections.push({ title: 'Responsáveis', fields: [], content: 'signatures' });
  return sections;
}

export function hasReportForm(code: string, customFields?: Record<string, unknown>) {
  return !!reportSections[code]?.length || !!Object.keys(customFields ?? {}).length;
}
