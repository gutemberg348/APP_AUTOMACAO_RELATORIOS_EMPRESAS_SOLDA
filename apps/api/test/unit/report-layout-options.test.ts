import { expect, it } from 'vitest';
import {
  reportTypeCodes,
  reportSections,
  reportSectionId,
  reportSectionIds,
  validateSpecificData,
  customReportPageSchema,
  newDrawingData,
  withoutReportLayout,
  buildReportDefaults,
} from '@weldcosta/shared';
import { reportFormSections } from '../../../app/features/reports/report-form-sections';
import { recentReportDefaults } from '../../../app/features/reports/report-autofill';
import { renderWithCustomPages } from '../../src/modules/pdf/templates/reports/custom-pages';
import { reportForPdf } from '../../src/modules/pdf/pdf-snapshot';
import { render as evs } from '../../src/modules/pdf/templates/reports/evs';
import { render as lp } from '../../src/modules/pdf/templates/reports/lp';
import { render as th } from '../../src/modules/pdf/templates/reports/hydrostatic';
import { render as me } from '../../src/modules/pdf/templates/reports/thickness';
import { render as rdo } from '../../src/modules/pdf/templates/reports/rdo';
import type { PdfReport } from '../../src/modules/pdf/templates/reports/layout';
const renderers = { EVS: evs, EVD: evs, LP: lp, TH: th, ME: me, RDO: rdo };

it.each(reportTypeCodes)(
  'keeps layout local to %s and restores the complete template for new reports',
  (code) => {
    const blank = customReportPageSchema.parse({
      id: 'blank',
      kind: 'blank',
      title: 'MEU TÍTULO',
      position: 'afterSignatures',
      drawings: [{ data: { ...newDrawingData(), grid: 'none' } }],
    });
    const custom = {
      customPages: [blank],
      omittedSections: ['signatures', 'drawings'],
      owner: 'CLIENTE',
    };
    const saved = validateSpecificData(
      code,
      withoutReportLayout({ customPages: [blank], omittedSections: custom.omittedSections }),
      'draft',
    );
    expect(saved).not.toHaveProperty('omittedSections');
    expect(saved).not.toHaveProperty('customPages');
    const reportData = validateSpecificData(
      code,
      { customPages: [blank], omittedSections: custom.omittedSections },
      'draft',
    );
    expect(reportData).toHaveProperty('customPages', [blank]);
    expect(reportData).toHaveProperty('omittedSections', custom.omittedSections);
    expect(recentReportDefaults(code, [custom])).not.toHaveProperty('customPages');
    expect(recentReportDefaults(code, [custom])).not.toHaveProperty('omittedSections');
    expect(buildReportDefaults(code, { name: 'OBRA' }, { name: 'CLIENTE' })).not.toHaveProperty(
      'customPages',
    );
    const sections = reportFormSections(code, reportSections[code]!);
    expect(new Set(sections.map(reportSectionId)).size).toBe(sections.length);
  },
);

it.each(reportTypeCodes)(
  'omits every selected step in %s without deleting source data or losing the report header',
  (code) => {
    const report = {
      number: '001',
      title: 'QA',
      reportType: { code },
      project: { name: 'OBRA' },
      company: { name: 'CLIENTE' },
      specificData: {
        omittedSections: [...reportSectionIds],
        finalReport: 'PRIVATE VERDICT',
        observation: 'PRIVATE OBS',
        equipment: 'PRIVATE EQUIPMENT',
      },
      points: [{ id: 'p', number: '123', label: 'PRIVATE POINT', type: 'WELD', data: {} }],
      media: [],
      drawings: [
        {
          data: {
            ...newDrawingData(),
            elements: [{ id: 'text', type: 'text', x: 200, y: 200, text: 'PRIVATE DRAWING' }],
          },
        },
      ],
      signatures: [{ id: 's', role: 'INSPECTOR', name: 'PRIVATE SIGNER' }],
    } as unknown as PdfReport;
    const original = structuredClone(report);
    const html = renderWithCustomPages(reportForPdf(report), new Map(), renderers[code]);
    expect(html).not.toContain('PRIVATE');
    expect(html).not.toContain('class="evs-signers"');
    expect(html).not.toContain('MEMORIAL TUBULAÇÃO');
    expect(html).toContain('RELAT. Nº');
    expect(report).toEqual(original);
    const restored = structuredClone(report);
    (restored.specificData as Record<string, unknown>).omittedSections = [];
    expect(renderWithCustomPages(reportForPdf(restored), new Map(), renderers[code])).toContain(
      'PRIVATE',
    );
  },
);

it.each([
  { code: 'TH', omitted: 'manometer', missing: 'MANÔMETRO', remaining: 'DADOS GERAIS' },
  {
    code: 'LP',
    omitted: 'materials',
    missing: 'MATERIAIS UTILIZADOS',
    remaining: 'DESCONTINUIDADES',
  },
  { code: 'ME', omitted: 'calculation', missing: 'MEMORIAL TUBULAÇÃO', remaining: 'LAUDO FINAL' },
  { code: 'EVS', omitted: 'conclusion', missing: 'LAUDO FINAL', remaining: 'RESPONSÁVEIS' },
  { code: 'EVD', omitted: 'signatures', missing: 'class="evs-signers"', remaining: 'LAUDO FINAL' },
  {
    code: 'RDO',
    omitted: 'conclusion',
    missing: 'PRIVATE OBSERVATION',
    remaining: 'RELATÓRIO DIÁRIO DE INSPEÇÃO',
  },
] as const)('removes only $omitted in $code', ({ code, omitted, missing, remaining }) => {
  const report = {
    number: '001',
    title: 'QA',
    reportType: { code },
    company: { name: 'CLIENTE' },
    project: { name: 'OBRA' },
    specificData: { omittedSections: [omitted], observation: 'PRIVATE OBSERVATION' },
    points: [],
    media: [],
    drawings: [],
    signatures: [],
  } as unknown as PdfReport;
  const html = renderWithCustomPages(reportForPdf(report), new Map(), renderers[code]);
  expect(html).not.toContain(missing);
  expect(html).toContain(remaining);
});

it('does not demand technical fields from a step removed from this report', () => {
  expect(() =>
    validateSpecificData('TH', { omittedSections: ['manometer'] }, 'submission', {
      submissionRequiredKeys: ['manometer.manufacturer'],
    }),
  ).not.toThrow();
  expect(() =>
    validateSpecificData('TH', {}, 'submission', {
      submissionRequiredKeys: ['manometer.manufacturer'],
    }),
  ).toThrow();
});
