import { expect, it } from 'vitest';
import {
  thicknessCalculationFields,
  thicknessDraftSchema,
  reportSections,
} from '@weldcosta/shared';
import { reportFormSections } from '../../../app/features/reports/report-form-sections';
import { render } from '../../src/modules/pdf/templates/reports/thickness';
import type { PdfReport } from '../../src/modules/pdf/templates/reports/layout';

export const calculationSample = Object.fromEntries(
  thicknessCalculationFields.map((f, i) => [
    f.path,
    ['3,33', '0,58836', '88,9', '114', '0,7', '3', '77,9', '1,0', '0,4', '6,0', '3,50'][i],
  ]),
);

it('persists every editable calculation value and places the section between photos and the final report', () => {
  expect(thicknessDraftSchema.parse(JSON.parse(JSON.stringify(calculationSample)))).toEqual(
    calculationSample,
  );
  expect(thicknessDraftSchema.parse({})).toEqual({});
  const sections = reportFormSections('ME', reportSections.ME!);
  const index = sections.findIndex((s) => s.title === 'Cálculo · memorial de tubulação');
  expect(sections[index - 1]?.content).toBe('testPhotos');
  expect(sections[index + 1]?.title).toBe('Laudo');
  expect(sections[index]!.fields.map((f) => f.path)).toEqual(
    thicknessCalculationFields.map((f) => f.path),
  );
});

it('adds the calculation sheet to existing reports, preserves zero values and escapes entered text', () => {
  const report = {
    reportType: { code: 'ME' },
    project: { name: 'QA' },
    company: { name: 'QA' },
    specificData: {},
    points: [],
    media: [],
    drawings: [],
    signatures: [],
  } as unknown as PdfReport;
  const empty = render(report, new Map());
  expect(empty).toContain('MEMORIAL TUBULAÇÃO');
  expect(empty.indexOf('MEMORIAL TUBULAÇÃO')).toBeLessThan(empty.indexOf('LAUDO FINAL'));
  report.specificData = {
    ...calculationSample,
    calculationAllowance: '0',
    calculationPressure: '<script>',
  };
  const html = render(report, new Map());
  expect(html).toContain('>0</td>');
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>');
  for (const f of thicknessCalculationFields) expect(html).toContain(f.label);
});
