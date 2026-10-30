import { describe, expect, it } from 'vitest';
import { lpChoiceValue, validateSpecificData, reportUpdateSchema } from '@weldcosta/shared';
import { render } from '../../src/modules/pdf/templates/reports/lp';
import { render as renderTh } from '../../src/modules/pdf/templates/reports/hydrostatic';
import type { PdfReport } from '../../src/modules/pdf/templates/reports/layout';
import { nextLpWeldNumber, pointBatch } from '../../../app/features/reports/report-autofill';

const report = {
  number: 'LP-001',
  title: 'LP QA',
  reportDate: '2026-10-30',
  reportType: { code: 'LP', name: 'Líquido Penetrante' },
  project: { name: 'QA' },
  company: { name: 'QA' },
  specificData: {
    generalData: {
      temperature: '32 °C',
      thickness: '2,11',
      surfaceCondition: 'Escovado',
      lightingIntensity: '1200 lux',
      baseMetal: 'Inox',
    },
    penetrantType: 'COLORIDO_TIPO_II',
    removalTechnique: 'AGUA',
    inspectionArea: 'LINHA DE AR COMPRIMIDO',
    materials: { penetrant: { manufacturer: 'Fabricante QA', expirationDate: '2028-03-31' } },
    discontinuities: [{ code: 'A', description: 'Sem indicação' }],
  },
  points: [
    {
      id: 'p1',
      number: '01 - 02 - 03',
      type: 'WELD',
      data: {
        dimension: 'OLD-DIMENSION',
        projectThickness: 'OLD-THICKNESS',
        acceptable: true,
        discontinuity: '-',
      },
    },
    { id: 'p2', number: '09 - 10 - 11', type: 'WELD', data: { acceptable: true } },
  ],
  media: [0, 1, 2, 3].map((i) => ({
    id: 'm' + i,
    reportPointId: i < 2 ? 'p1' : 'p2',
    sectionKey: 'photos',
  })),
  drawings: [],
  signatures: [],
} as unknown as PdfReport;

describe('LP grouped welds and faithful form', () => {
  it('saves groups as one inspection point and suggests the next weld after the group', () => {
    const points = pointBatch([], false, 1, false, '01 - 02 - 03');
    const body = reportUpdateSchema.parse({ version: 1, points });
    expect(body.points?.[0]?.number).toBe('01 - 02 - 03');
    expect(nextLpWeldNumber(points)).toBe('04');
    expect(nextLpWeldNumber([{ number: '01-2-03' }, { number: '04,05,06' }])).toBe('07');
    expect(nextLpWeldNumber([{ number: 'J-09' }])).toBe('J-10');
    expect(validateSpecificData('LP', report.specificData, 'draft')).toEqual(report.specificData);
  });
  it('omits old point dimensions while retaining group labels, images and general thickness', () => {
    const before = structuredClone(report);
    const html = render(
      report,
      new Map(report.media.map((m) => [m.id, 'data:image/png;base64,AA=='])),
    );
    expect(html).not.toContain('OLD-DIMENSION');
    expect(html).not.toContain('OLD-THICKNESS');
    expect(html).not.toContain('Dimensão:');
    expect(html).toContain('ESPESSURA');
    expect(html).toContain('01 - 02 - 03');
    expect(html).toContain('09 - 10 - 11');
    expect(html.match(/class="reference-photo-image report-photo-frame"/g)).toHaveLength(4);
    expect(html).toContain('(X)</span> Colorido Tipo II');
    expect(html).toContain('(X)</span> Água');
    expect(html).toContain('31/03/2028');
    expect(html).toContain('LINHA DE AR COMPRIMIDO');
    expect(html).toContain('lp-material-table');
    expect(report).toEqual(before);
    expect(
      renderTh(
        { ...report, reportType: { ...report.reportType, code: 'TH' } } as PdfReport,
        new Map(),
      ),
    ).toContain('OLD-DIMENSION');
  });
  it('preserves legacy custom values, escapes table data and continues beyond twelve indications', () => {
    const data = {
      ...report.specificData,
      penetrantType: 'Custom <penetrant>',
      removalTechnique: 'Custom <method>',
      inspectionArea: '<script>AREA</script>',
      discontinuities: Array.from({ length: 25 }, (_, i) => ({
        code: 'C' + i,
        description: 'Descrição longa '.repeat(60) + 'FIM-' + i,
      })),
    };
    const html = render({ ...report, specificData: data } as PdfReport, new Map());
    expect(html).toContain('Custom &lt;penetrant&gt;');
    expect(html).toContain('Custom &lt;method&gt;');
    expect(html).not.toContain('<script>AREA');
    expect(html).toContain('DESCONTINUIDADES · CONTINUAÇÃO');
    expect(html).toContain('FIM-24');
    expect(lpChoiceValue('penetrant', 'Colorido tipo II')).toBe('COLORIDO_TIPO_II');
    expect(lpChoiceValue('penetrant', 'fluorescente')).toBe('FLUORESCENTE_TIPO_I');
    expect(lpChoiceValue('removal', 'Água')).toBe('AGUA');
    expect(lpChoiceValue('removal', 'Custom method')).toBe('');
    expect(lpChoiceValue('removal', 'Solvente especial QA')).toBe('');
    expect(lpChoiceValue('penetrant', 'Colorido com especificação especial')).toBe('');
  });
});
