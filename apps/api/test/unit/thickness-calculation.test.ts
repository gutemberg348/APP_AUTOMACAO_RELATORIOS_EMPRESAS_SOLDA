import { expect, it } from 'vitest';
import {
  thicknessCalculationFields,
  thicknessDraftSchema,
  reportSections,
  newCustomReportPage,
  validateSpecificData,
  withoutReportLayout,
} from '@weldcosta/shared';
import { reportFormSections } from '../../../app/features/reports/report-form-sections';
import { render } from '../../src/modules/pdf/templates/reports/thickness';
import { renderWithCustomPages } from '../../src/modules/pdf/templates/reports/custom-pages';
import type { PdfReport } from '../../src/modules/pdf/templates/reports/layout';

const legacy = Object.fromEntries(thicknessCalculationFields.map((f) => [f.path, '3,33']));
const base = () =>
  ({
    number: '001',
    reportType: { code: 'ME' },
    project: { name: 'QA' },
    company: { name: 'QA' },
    specificData: legacy,
    points: [],
    media: [],
    drawings: [],
    signatures: [],
  }) as unknown as PdfReport;
it('keeps older calculation values readable by the API but never adds a calculation sheet automatically', () => {
  expect(thicknessDraftSchema.parse(legacy)).toEqual(legacy);
  const html = render(base(), new Map());
  expect(html).not.toContain('MEMORIAL TUBULAÇÃO');
  expect(html).not.toContain('3,33');
  const sections = reportFormSections('ME', reportSections.ME!);
  expect(sections.flatMap((s) => s.fields).some((f) => f.path.startsWith('calculation'))).toBe(
    false,
  );
  expect(sections.find((s) => s.content === 'testPhotos')).toBeDefined();
});
it('creates an optional blank calculation page with editable title, without copying it to the next report', () => {
  const calculation = newCustomReportPage('calculation');
  expect(calculation.title).toBe('CÁLCULOS');
  expect(calculation.drawings[0]!.data).toMatchObject({
    grid: 'none',
    page: 'portrait',
    elements: [],
  });
  const report = base();
  report.specificData = validateSpecificData(
    'ME',
    { customPages: [calculation] },
    'draft',
  ) as PdfReport['specificData'];
  expect(renderWithCustomPages(report, new Map(), render)).toContain('CÁLCULOS');
  expect(withoutReportLayout(report.specificData as Record<string, unknown>)).not.toHaveProperty(
    'customPages',
  );
  calculation.title = 'MEU MEMORIAL <EDITADO>';
  expect(renderWithCustomPages(report, new Map(), render)).not.toContain('MEMORIAL TUBULAÇÃO');
  report.specificData = { customPages: [calculation] };
  expect(renderWithCustomPages(report, new Map(), render)).toContain(
    'MEU MEMORIAL &lt;EDITADO&gt;',
  );
});
