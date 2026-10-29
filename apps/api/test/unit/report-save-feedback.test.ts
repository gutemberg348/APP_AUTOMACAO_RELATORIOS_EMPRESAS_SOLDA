import { describe, expect, it } from 'vitest';
import { reportSections, reportCreateSchema, validateSpecificData } from '@weldcosta/shared';
import {
  reportCorrections,
  reportBusinessCorrection,
} from '../../../app/features/reports/report-save-feedback';

describe('Report save corrections', () => {
  it.each(Object.keys(reportSections))(
    'names every configured field of %s and keeps its navigation path',
    (code) => {
      for (const section of reportSections[code]!)
        for (const field of section.fields) {
          const result = reportCorrections(
            [{ path: field.path.split('.'), code: 'invalid_type', message: 'Confira o valor.' }],
            reportSections[code]!,
            [],
          );
          expect(result[0]?.label).toBe(field.label);
          expect(result[0]?.path.join('.')).toBe('specificData.' + field.path);
          expect(result[0]?.guidance.length).toBeGreaterThan(15);
        }
    },
  );
  it('locates duplicate point numbers, missing report number and invalid signer date together', () => {
    const result = reportCreateSchema.safeParse({
      reportTypeId: '00000000-0000-4000-8000-000000000001',
      companyId: '00000000-0000-4000-8000-000000000002',
      projectId: '00000000-0000-4000-8000-000000000003',
      number: '',
      points: [
        { number: 'S-9', type: 'WELD' },
        { number: 's-9', type: 'WELD' },
      ],
      signatures: [{ role: 'CLIENT', name: 'Cliente', signedAt: '2026-02-30' }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const corrections = reportCorrections(result.error.issues, reportSections.EVS!, [
      { number: 'S-9' },
      { number: 's-9' },
    ]);
    expect(corrections.find((i) => i.path.join('.') === 'points.1.number')?.label).toBe(
      'Ponto s-9 · Número',
    );
    expect(
      corrections.find((i) => i.path.join('.') === 'signatures.0.signedAt')?.guidance,
    ).toContain('Confira se a data existe');
    expect(corrections.find((i) => i.path.join('.') === 'number')?.guidance).toContain('001');
  });
  it('resolves nested technical dates and custom types without duplicating specificData', () => {
    const sections = [
      {
        title: 'Equipamento',
        fields: [{ path: 'equipment.date', label: 'Validade', kind: 'date' as const }],
      },
    ];
    const result = reportCorrections(
      [
        {
          path: ['specificData', 'equipment', 'date'],
          code: 'invalid_format',
          message: 'Data inválida',
        },
      ],
      sections,
      [],
      true,
    );
    expect(result[0]?.path).toEqual(['specificData', 'equipment', 'date']);
    expect(result[0]?.label).toBe('Validade');
    expect(result[0]?.message).toContain('DD/MM/AAAA');
    expect(() => validateSpecificData('EVS', {}, 'draft', {})).not.toThrow();
  });
  it('labels drawing errors and only offers field corrections for known business errors', () => {
    const result = reportCorrections(
      [
        {
          path: ['drawings', 2, 'data', 'elements', 4, 'strokeWidth'],
          code: 'too_big',
          message: 'Máximo 60',
        },
      ],
      [],
      [],
    );
    expect(result[0]?.label).toContain('Desenho 3');
    expect(reportBusinessCorrection('INVALID_SIGNATURE', 'Assinatura indisponível')?.path).toEqual([
      'signatures',
    ]);
    expect(reportBusinessCorrection('POINT_IN_DRAWING', 'Ponto em uso')?.path).toEqual([
      'drawings',
    ]);
    expect(reportBusinessCorrection('VERSION_CONFLICT', 'Conflito')).toBeUndefined();
    expect(reportBusinessCorrection('NETWORK_ERROR', 'Sem conexão')).toBeUndefined();
  });
});
