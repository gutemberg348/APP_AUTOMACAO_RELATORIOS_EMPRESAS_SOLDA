import { expect, it } from 'vitest';
import {
  newCustomReportPage,
  customReportPageSchema,
  reportSections,
  reportSectionId,
  reportTypeCodes,
  validateSpecificData,
} from '@weldcosta/shared';
import { reportFormSections } from '../../../app/features/reports/report-form-sections';
import {
  customPagePositionOptions,
  customPagePositionValue,
  customPagePositionLabel,
} from '../../../app/features/reports/custom-page-positions';

it.each(reportTypeCodes)('offers each visible stage of %s, and a single report end', (code) => {
  const sections = reportFormSections(code, reportSections[code]!);
  const page = newCustomReportPage('calculation');
  const options = customPagePositionOptions(sections, page);
  expect(options.map((o) => o.value)).toEqual([
    'start',
    ...sections
      .filter((s) => reportSectionId(s) !== 'signatures')
      .map((s) => 'section:' + reportSectionId(s)),
    'end',
  ]);
  expect(options.filter((o) => o.label === 'Final do relatório')).toHaveLength(1);
  expect(options.some((o) => /assinatura/i.test(o.label))).toBe(false);
  for (const section of sections.filter((s) => reportSectionId(s) !== 'signatures')) {
    const chosen = {
      ...page,
      position: 'afterSection' as const,
      afterSection: reportSectionId(section),
    };
    const data = validateSpecificData(code, { customPages: [chosen] }, 'draft') as {
      customPages: unknown[];
    };
    expect(data.customPages[0]).toEqual(chosen);
    expect(customPagePositionValue(chosen)).toBe('section:' + reportSectionId(section));
    expect(customPagePositionLabel(sections, chosen)).toContain('Abaixo de:');
  }
  const reduced = sections.filter((s) => reportSectionId(s) !== 'identification');
  expect(
    customPagePositionOptions(reduced, page).some((o) => o.value === 'section:identification'),
  ).toBe(false);
});

it('keeps saved positions readable, including legacy pages, without duplicating the end', () => {
  const sections = reportFormSections('EVS', reportSections.EVS!);
  const page = newCustomReportPage('blank');
  expect(customPagePositionValue({ ...page, position: 'afterSignatures' })).toBe('end');
  expect(customPagePositionValue({ ...page, position: 'afterIdentification' })).toBe(
    'section:identification',
  );
  expect(
    customPagePositionOptions(sections, { ...page, position: 'afterSignatures' }),
  ).toHaveLength(sections.length + 1);
  expect(
    customPagePositionLabel(sections, { ...page, position: 'afterPage', afterPage: 2 }),
  ).toContain('folha 2');
  expect(() =>
    customReportPageSchema.parse({
      ...page,
      position: 'afterSection',
      afterSection: 'not-a-stage',
    }),
  ).toThrow();
  expect(() => customReportPageSchema.parse({ ...page, position: 'afterSection' })).toThrow(
    'Escolha abaixo',
  );
});
