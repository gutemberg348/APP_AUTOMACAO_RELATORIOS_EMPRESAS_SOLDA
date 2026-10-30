import { expect, it } from 'vitest';
import { render } from '../../src/modules/pdf/templates/reports/thickness';
import type { PdfReport } from '../../src/modules/pdf/templates/reports/layout';
const base = {
  number: '001',
  title: 'QA',
  reportDate: '2026-10-30',
  reportType: { code: 'ME', name: 'Medição' },
  project: { name: 'QA' },
  company: { name: 'QA' },
  specificData: {},
  signatures: [],
  drawings: [],
  media: [{ id: 'm', reportPointId: 'p', sectionKey: 'photos' }],
  points: [
    { id: 'p', number: '01', label: 'SUPERIOR', type: 'MEASUREMENT', value: null, data: {} },
  ],
} as unknown as PdfReport;
it('prints complete photos and actual point rows without empty readings, thickness or second-photo boxes', () => {
  const html = render(base, new Map([['m', 'photo']]));
  expect(html.match(/class="measurement-reading"/g)).toBeNull();
  expect(html.match(/class="measurement-photo report-photo-frame"/g)).toHaveLength(1);
  expect(html).not.toContain('PONTOS · ESPESSURA DE PROJETO:');
  expect(html).not.toContain('&nbsp;');
  expect(html).not.toContain('PONTO 01');
});
it('retains zero readings, rejected results and all supplied notes without duplicating the first thickness', () => {
  const report = structuredClone(base);
  report.points[0]!.value = 0;
  report.points[0]!.data = { acceptable: false, projectThickness: '5 mm', notes: 'Nota real' };
  const html = render(report, new Map([['m', 'photo']]));
  expect(html).toContain('0 mm');
  expect(html).toContain('ACEITÁVEL: NÃO');
  expect(html).toContain('Nota real');
  expect(html.match(/5 mm/g)).toHaveLength(1);
});
it('retains different discontinuities and thicknesses on later points in the same side', () => {
  const report = structuredClone(base);
  report.points[0]!.data = { projectThickness: '5 mm', discontinuity: 'Primeiro' };
  report.points.push({
    ...report.points[0]!,
    id: 'p2',
    number: '02',
    data: {
      projectThickness: '7 mm',
      discontinuity: 'Segundo',
    },
  });
  const html = render(report, new Map([['m', 'photo']]));
  expect(html).toContain('Primeiro');
  expect(html).toContain('Descontinuidade: Segundo');
  expect(html).toContain('Espessura de projeto: 7 mm');
  expect(html.match(/class="measurement-reading"/g)).toBeNull();
});

it('keeps readings with their own photo and omits unfilled values and support-photo rows', () => {
  const report = structuredClone(base);
  report.media[0]!.annotations = {
    elements: [],
    measurements: [
      { id: 'm1', number: '01', x: 0.2, y: 0.3, value: 5.9 },
      { id: 'm2', number: '02', x: 0.5, y: 0.3, value: 0 },
      { id: 'm3', number: '03', x: 0.8, y: 0.3, value: null },
    ],
  };
  report.media.push({ ...report.media[0]!, id: 'support', annotations: { elements: [] } });
  const html = render(
    report,
    new Map([
      ['m', 'main-photo'],
      ['support', 'support-photo'],
    ]),
  );
  expect(html.match(/class="measurement-reading"/g)).toHaveLength(2);
  expect(html).toContain('5,9 mm');
  expect(html).toContain('0 mm');
  expect(html).not.toContain('PONTO 03');
  expect(html.slice(html.indexOf('src="support-photo"'))).not.toContain('measurement-reading');
});
it('paginates long photo measurement lists without discarding readings', () => {
  const report = structuredClone(base);
  report.media[0]!.annotations = {
    elements: [],
    measurements: Array.from({ length: 30 }, (_, i) => ({
      id: 'm' + i,
      number: String(i + 1),
      x: 0.5,
      y: 0.5,
      value: 5.9,
    })),
  };
  const html = render(report, new Map([['m', 'main-photo']]));
  expect(html.match(/class="measurement-reading"/g)).toHaveLength(30);
  expect(html.match(/class="measurement-photo report-photo-frame"/g)).toHaveLength(5);
  expect(html).toContain('PONTO 30:');
});

it('preserves existing point readings when the first photo gains its own measurement list', () => {
  const report = structuredClone(base);
  report.points[0]!.value = 4.7;
  report.points[0]!.data = { projectThickness: '6 mm', acceptable: false };
  report.media[0]!.annotations = {
    elements: [],
    measurements: [{ id: 'photo-point', number: '02', x: 0.5, y: 0.5, value: 5.9 }],
  };
  const html = render(report, new Map([['m', 'photo']]));
  expect(html).toContain('5,9 mm');
  expect(html).toContain('4,7 mm');
  expect(html).toContain('Leituras do cadastro');
  expect(html).toContain('ACEITÁVEL: NÃO');
  expect(html).toContain('6 mm');
  report.media[0]!.annotations = { elements: [], measurements: [] };
  const empty = render(report, new Map([['m', 'photo']]));
  expect(empty).toContain('4,7 mm');
  expect(empty).toContain('6 mm');
});
