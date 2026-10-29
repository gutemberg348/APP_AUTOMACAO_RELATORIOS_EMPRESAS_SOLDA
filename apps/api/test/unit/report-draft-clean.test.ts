import { describe, expect, it } from 'vitest';
import { reportSections, reportUpdateSchema, validateSpecificData } from '@weldcosta/shared';
import { cleanReportDraft } from '../../../app/features/reports/report-draft-clean';
import { reportCorrections } from '../../../app/features/reports/report-save-feedback';

describe('Incomplete report drafts', () => {
  it.each(Object.keys(reportSections))('saves optional blank fields and signers in %s', (code) => {
    const specificData: Record<string, unknown> = {};
    for (const field of reportSections[code]!.flatMap((section) => section.fields)) {
      const parts = field.path.split('.');
      let target = specificData;
      for (const part of parts.slice(0, -1))
        target = (target[part] ??= {}) as Record<string, unknown>;
      target[parts.at(-1)!] = '';
    }
    if (code === 'LP') specificData.discontinuities = [{ code: '', description: '' }];
    const original = {
      version: 1,
      number: '001',
      specificData,
      signatures: [{ role: 'CLIENT', name: '', registrationNumber: '', signedAt: '' }],
      points: [
        {
          number: '1',
          type: code === 'ME' ? 'MEASUREMENT' : 'WELD',
          value: null,
          data: { acceptable: false, notes: '' },
        },
      ],
    };
    const body = reportUpdateSchema.parse(cleanReportDraft(original));
    expect(() => validateSpecificData(code, body.specificData, 'draft')).not.toThrow();
    expect(body.signatures?.[0]?.name).toBe('');
    expect(body.points?.[0]?.data?.acceptable).toBe(false);
    expect(original.signatures[0]?.signedAt).toBe('');
  });
  it('keeps invalid dates and duplicate numbers visible for correction instead of discarding them', () => {
    const input = cleanReportDraft({
      version: 1,
      number: '001',
      points: [
        { number: '1', type: 'WELD' },
        { number: '1', type: 'WELD' },
      ],
      signatures: [{ role: 'CLIENT', name: '', signedAt: '2026-02-30' }],
    });
    const result = reportUpdateSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.map((i) => i.path.join('.'))).toEqual(
        expect.arrayContaining(['points.1.number', 'signatures.0.signedAt']),
      );
  });
  it('locates LP discontinuity and PDF photo errors', () => {
    const corrections = reportCorrections(
      [
        {
          path: ['specificData', 'discontinuities', 2, 'code'],
          code: 'too_big',
          message: 'Código longo',
        },
        { path: ['points', 1, 'photos'], code: 'custom', message: 'Foto ausente' },
      ],
      reportSections.LP!,
      [{ number: '1' }, { number: '20' }],
    );
    expect(corrections[0]?.label).toBe('Descontinuidade 3 · Código');
    expect(corrections[1]?.label).toBe('Ponto 20 · Fotos');
  });
});
