import { describe, expect, it } from 'vitest';
import {
  displayReportStatus,
  reportDisplayStatuses,
  reportReviewWarnings,
  newDrawingData,
} from '@weldcosta/shared';

describe('report review warnings', () => {
  it('shows three phases and maps existing finalized documents to approved', () => {
    expect(reportDisplayStatuses).toEqual(['DRAFT', 'IN_REVIEW', 'APPROVED']);
    expect(displayReportStatus('FINISHED')).toBe('APPROVED');
  });
  it('warns about incomplete points, fields and signatures without modifying the report', () => {
    const report = {
      title: '',
      reportDate: null,
      specificData: {},
      reportType: { code: 'EVS', config: { submissionRequiredKeys: ['procedureRevision'] } },
      points: [
        { id: 'first', number: '01', type: 'WELD', data: {} },
        {
          id: 'second',
          number: '02',
          type: 'MEASUREMENT',
          value: null,
          data: { acceptable: true },
        },
      ],
      drawings: [
        {
          data: {
            ...newDrawingData(),
            elements: [{ id: 'first-mark', type: 'point', reportPointId: 'first', x: 10, y: 20 }],
          },
        },
      ],
      media: [{ reportPointId: 'first' }],
      signatures: [{ name: 'Inspetor' }],
    };
    const original = structuredClone(report),
      warnings = reportReviewWarnings(report);
    expect(warnings).toEqual(
      expect.arrayContaining([
        'Título do relatório não preenchido.',
        'Data do relatório não preenchida.',
        'Pontos sem resultado: 01.',
        'Pontos sem leitura: 02.',
        'Pontos sem fotos: 02.',
        'Pontos sem marcação no desenho: 02.',
        'Há responsáveis sem nome ou assinatura.',
      ]),
    );
    expect(warnings.some((warning) => warning.includes('Procedimento / revisão'))).toBe(true);
    expect(report).toEqual(original);
  });
  it('treats zero readings and rejected results as filled and leaves numbers optional', () => {
    expect(
      reportReviewWarnings({
        title: 'Linha',
        reportDate: '2026-10-13',
        specificData: {},
        reportType: { code: 'ME', config: {} },
        points: [
          { id: 'first', number: '01', type: 'MEASUREMENT', value: 0, data: { acceptable: false } },
        ],
      }),
    ).toEqual([]);
  });
  it('warns about an empty inspection without requiring points in a daily report', () => {
    const report = {
      title: 'Linha',
      reportDate: '2026-10-13',
      specificData: {},
      points: [],
      reportType: { code: 'EVS', config: {} },
    };
    expect(reportReviewWarnings(report)).toContain('Nenhum ponto foi registrado nesta inspeção.');
    expect(reportReviewWarnings({ ...report, reportType: { code: 'RDO', config: {} } })).toEqual(
      [],
    );
  });
});
