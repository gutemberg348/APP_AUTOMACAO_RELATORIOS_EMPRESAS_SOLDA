import { reportForPdf } from '../../src/modules/pdf/pdf-snapshot';
import { expect, it } from 'vitest';
import { isHydrostaticTestPhoto, reportReviewWarnings, reportSections } from '@weldcosta/shared';
import {
  render,
  hydrostaticPhotoSheets,
} from '../../src/modules/pdf/templates/reports/hydrostatic';
import type { PdfReport } from '../../src/modules/pdf/templates/reports/layout';
import { reportFormSections } from '../../../app/features/reports/report-form-sections';

export const fixture = (count: number) =>
  ({
    number: 'TH-005',
    title: 'TANQUE PULMÃO',
    reportDate: '2026-11-13',
    reportType: { code: 'TH', config: {} },
    company: { name: 'Cliente' },
    project: { name: 'Obra' },
    specificData: {},
    signatures: [],
    points: [
      { id: 'old-point', number: '1', type: 'WELD', data: {} },
      { id: 'empty-point', number: '2', data: {} },
    ],
    drawings: [{ data: { legacy: true } }],
    media: [
      ...Array.from({ length: count }, (_, i) => ({
        id: 'photo-' + i,
        sectionKey: i % 2 ? 'test-photos' : 'photos',
        reportPointId: i % 2 ? null : 'old-point',
        caption: i === 0 ? 'Detalhe <1>' : '',
      })),
      { id: 'drawing', sectionKey: 'drawing' },
      { id: 'embedded', sectionKey: 'photos', clientUploadId: 'drawing-image-legacy' },
    ],
  }) as unknown as PdfReport;

it.each([0, 1, 2, 3, 5, 6, 7, 12, 13])(
  'packs %i actual photos in pairs, six per sheet, retaining legacy photos',
  (count) => {
    const report = fixture(count),
      before = structuredClone(report);
    const images = new Map(report.media.map((m) => [m.id, 'image-' + m.id]));
    const html = hydrostaticPhotoSheets(report, images);
    expect((html.match(/<article/g) ?? []).length).toBe(Math.ceil(count / 6));
    expect((html.match(/class="th-test-photo-image"/g) ?? []).length).toBe(count);
    expect((html.match(/class="th-test-photo-row"/g) ?? []).length).toBe(Math.ceil(count / 2));
    expect(html).not.toContain('image-drawing');
    expect(html).not.toContain('image-embedded');
    expect(html).not.toContain('PONTO');
    expect(html).not.toContain('Sem foto');
    if (count) expect(html).toContain('Detalhe &lt;1&gt;');
    for (let i = 0; i < count; i++)
      expect(html.split('src="image-photo-' + i + '"')).toHaveLength(2);
    const complete = render(report, images);
    expect(complete).not.toContain('>DESENHO<');
    expect(complete).toContain('LAUDO FINAL');
    expect(report).toEqual(before);
  },
);

it('shows the gallery instead of points/drawings and no longer demands legacy point results', () => {
  const sections = reportFormSections('TH', reportSections.TH!);
  expect(sections.filter((s) => s.content === 'testPhotos')).toHaveLength(1);
  expect(sections.some((s) => s.content === 'points' || s.content === 'drawings')).toBe(false);
  expect(reportReviewWarnings(fixture(1))).toEqual([]);
  expect(reportReviewWarnings({ ...fixture(0), points: [], drawings: [] })).toEqual([]);
  expect(isHydrostaticTestPhoto({ sectionKey: 'drawing' })).toBe(false);
  expect(isHydrostaticTestPhoto({ sectionKey: 'photos', clientUploadId: 'drawing-image-x' })).toBe(
    false,
  );
  expect(isHydrostaticTestPhoto({ sectionKey: 'photos' })).toBe(true);
});

it('removes old drawing assets only from the printable snapshot, so hidden assets cannot block PDF download', () => {
  const report = fixture(2),
    before = structuredClone(report);
  const snapshot = reportForPdf(report);
  expect(snapshot.drawings).toEqual([]);
  expect(snapshot.points).toEqual([]);
  expect(snapshot.media.map((m) => m.id)).toEqual(['photo-0', 'photo-1']);
  expect(report).toEqual(before);
});
