import { describe, expect, it } from 'vitest';
import {
  pointBatch,
  reusableReportFields,
  recentReportDefaults,
} from '../../../app/features/reports/report-autofill';
import type { ReportPoint } from '@weldcosta/shared';

describe('report filling shortcuts', () => {
  const previous: ReportPoint = {
    id: 'old',
    number: 'S-009',
    type: 'MEASUREMENT',
    label: 'Lado A',
    unit: 'mm',
    value: 5.9,
    data: {
      dimension: '4"',
      projectThickness: '6 mm',
      acceptable: true,
      discontinuity: 'Sem indicação',
      notes: 'Observação antiga',
    },
  };
  it('reuses only the point setup and creates independent sequential IDs', () => {
    const batch = pointBatch([previous], true, 3, true);
    expect(batch.map((p) => p.number)).toEqual(['S-010', 'S-011', 'S-012']);
    expect(new Set(batch.map((p) => p.clientId)).size).toBe(3);
    for (const p of batch) {
      expect(p.id).toBeUndefined();
      expect(p.value).toBeNull();
      expect(p.label).toBe('Lado A');
      expect(p.data).toEqual({ discontinuity: '-', dimension: '4"', projectThickness: '6 mm' });
    }
    batch[0]!.data!.dimension = '2"';
    expect(batch[1]!.data!.dimension).toBe('4"');
    expect(previous.data!.dimension).toBe('4"');
  });
  it('supports blank points, project thickness, manual starting numbers and limits', () => {
    expect(pointBatch([previous], true, 1, false, '20', '8 mm')[0]).toMatchObject({
      number: '20',
      label: '',
      value: null,
      unit: 'mm',
      data: { discontinuity: '-', projectThickness: '8 mm' },
    });
    expect(() => pointBatch([previous], true, 2, true, 'S-009')).toThrow('único');
    for (const n of [0, -1, 51, 1.5, NaN])
      expect(() => pointBatch([], false, n, true)).toThrow('1 a 50');
  });
  it('fills only empty fields supported by the type, preserving edits and excluding results', () => {
    const source = {
      factory: 'Fábrica anterior',
      weldingProcess: 'TIG',
      baseMetal: 'Inox',
      finalResult: 'APPROVED',
      finalReport: 'Antigo laudo',
      unknown: 'não copiar',
    };
    expect(reusableReportFields('EVS', source, { factory: 'Atual', weldingProcess: '' })).toEqual([
      { path: 'weldingProcess', value: 'TIG' },
      { path: 'baseMetal', value: 'Inox' },
    ]);
    expect(
      reusableReportFields(
        'RDO',
        {
          date: '2025-01-01',
          inspector: 'Antigo',
          visa: 'Assinado',
          observation: 'Antiga',
          material: 'Inox',
        },
        {},
      ),
    ).toEqual([{ path: 'material', value: 'Inox' }]);
  });
  it('reuses nested instrument metadata without sharing object references', () => {
    expect(
      reusableReportFields(
        'TH',
        { manometer: { manufacturer: 'Marca', calibrationDate: '2026-01-01' } },
        { manometer: { manufacturer: 'Atual' } },
      ),
    ).toEqual([{ path: 'manometer.calibrationDate', value: '2026-01-01' }]);
  });
  it('keeps the latest saved setup and fills gaps from older reports without carrying verdicts', () => {
    const old = {
      factory: 'Fábrica antiga',
      weldingProcess: 'TIG',
      finalReport: 'Laudo anterior',
      finalResult: 'APPROVED',
    };
    const recent = { factory: 'Fábrica atual', weldingProcess: '', baseMetal: 'Inox' };
    expect(recentReportDefaults('EVS', [recent, old])).toEqual({
      factory: 'Fábrica atual',
      weldingProcess: 'TIG',
      baseMetal: 'Inox',
    });
    const instrument = {
      manometer: { manufacturer: 'Marca antiga', calibrationDate: '2026-10-01' },
    };
    const result = recentReportDefaults('TH', [
      { manometer: { manufacturer: 'Marca atual' } },
      instrument,
    ]);
    expect(result).toEqual({
      manometer: { manufacturer: 'Marca atual', calibrationDate: '2026-10-01' },
    });
    (result.manometer as Record<string, string>).calibrationDate = '2026-11-01';
    expect(instrument.manometer.calibrationDate).toBe('2026-10-01');
  });
});
