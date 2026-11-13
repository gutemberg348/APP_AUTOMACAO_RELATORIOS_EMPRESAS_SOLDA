import { reportSections, reportTypeCodes, type ReportSection } from '@weldcosta/shared';

export type ReportFormSection = ReportSection & {
  content?:
    'points' | 'discontinuities' | 'inspectionRecords' | 'signatures' | 'drawings' | 'testPhotos';
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
    ...(!['TH', 'ME'].includes(code)
      ? [{ title: 'Desenho técnico', fields: [], content: 'drawings' as const }]
      : []),
    ...(['LP', 'TH', 'ME'].includes(code)
      ? [
          {
            title:
              code === 'ME'
                ? 'Fotos e pontos de medição'
                : code === 'TH'
                  ? 'Imagens do ensaio'
                  : 'Fotos do ensaio',
            fields: [],
            content: 'testPhotos' as const,
          },
        ]
      : []),
    ...(!['TH', 'ME'].includes(code) && reportTypeCodes.some((registered) => registered === code)
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
