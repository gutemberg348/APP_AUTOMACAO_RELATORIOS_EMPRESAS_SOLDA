import { describe, expect, it } from 'vitest';
import { reportSections, reportTypeCodes } from '@weldcosta/shared';
import {
  hasReportForm,
  reportFormSections,
} from '../../../app/features/reports/report-form-sections';

describe('Complete report forms', () => {
  it('keeps every EVD inspection section and every technical field', () => {
    const sections = reportFormSections('EVD', reportSections.EVD!);
    expect(sections.map((section) => section.title)).toEqual([
      'Identificação',
      'Dados do ensaio',
      'Registros de inspeção',
      'Desenho técnico',
      'Pontos de solda',
      'Laudo',
      'Responsáveis',
    ]);
    expect(sections.flatMap((section) => section.fields).map((field) => field.path)).toEqual(
      reportSections.EVD!.flatMap((section) => section.fields).map((field) => field.path),
    );
    expect(sections.find((section) => section.title === 'Pontos de solda')?.content).toBe('points');
    expect(sections.find((section) => section.title === 'Registros de inspeção')?.content).toBe(
      'inspectionRecords',
    );
  });

  it.each(reportTypeCodes)('%s provides points/photos, drawings and signers', (code) => {
    const base = JSON.stringify(reportSections[code]);
    const sections = reportFormSections(code, reportSections[code]!);
    for (const content of ['points', 'drawings', 'signatures'])
      expect(sections.filter((section) => section.content === content)).toHaveLength(1);
    expect(hasReportForm(code)).toBe(true);
    expect(JSON.stringify(reportSections[code])).toBe(base);
  });

  it('does not silently accept an unrecognized model without any specific fields', () => {
    expect(hasReportForm('EV_DIRETO')).toBe(false);
    expect(hasReportForm('EVD ')).toBe(false);
    expect(hasReportForm('CUSTOM', {})).toBe(false);
    expect(hasReportForm('CUSTOM', { equipment: 'string' })).toBe(true);
  });
});
