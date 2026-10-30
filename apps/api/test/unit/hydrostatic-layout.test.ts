import { expect, it } from 'vitest';
import { hydrostaticDraftSchema } from '@weldcosta/shared';
import { render } from '../../src/modules/pdf/templates/reports/hydrostatic';
import type { PdfReport } from '../../src/modules/pdf/templates/reports/layout';

it('keeps working/test pressure distinct and retains existing manufacturer and long technical fields', () => {
  const data = hydrostaticDraftSchema.parse({
    generalData: {
      workingPressure: '10 kgf/cm²',
      testPressure: '15 kgf/cm²',
      manufacturer: 'Fabricante existente',
      equipment: 'Equipamento '.repeat(100) + 'FINAL-REAL',
    },
  });
  const report = {
    number: '007',
    title: 'TH',
    reportDate: '2026-10-30',
    reportType: { code: 'TH' },
    project: { name: 'Obra' },
    company: { name: 'Cliente' },
    specificData: data,
    points: [],
    drawings: [],
    signatures: [],
    media: [],
  } as unknown as PdfReport;
  const html = render(report, new Map());
  expect(html).toContain('PRESSÃO DO TESTE:');
  expect(html).toContain('15 kgf/cm²');
  expect(html).toContain('10 kgf/cm²');
  expect(html).toContain('Fabricante existente');
  expect(html).toContain('FINAL-REAL');
  expect(html).toContain('class="th-field"');
  expect(html).not.toContain('<thead>');
});
