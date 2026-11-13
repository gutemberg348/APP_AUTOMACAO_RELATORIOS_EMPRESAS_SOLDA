import { describe, expect, it } from 'vitest';
import { newDrawingData, reportSections, reportTypeCodes } from '@weldcosta/shared';
import { render } from '../../src/modules/pdf/templates/reports/lp';
import { photoRows } from '../../src/modules/pdf/templates/reports/reference-layout';
import type { PdfReport } from '../../src/modules/pdf/templates/reports/layout';
import { reportFormSections } from '../../../app/features/reports/report-form-sections';

const fixture = (count: number) =>
  ({
    number: 'LP-101',
    title: 'Ensaio',
    reportDate: null,
    company: { name: 'Cliente' },
    project: { name: 'Obra' },
    reportType: { code: 'LP', name: 'Líquido Penetrante' },
    specificData: {},
    drawings: [{ data: newDrawingData() }],
    signatures: [],
    points: [{ id: 'weld', number: '01', data: { acceptable: true } }],
    media: [
      { id: 'point-photo', reportPointId: 'weld', sectionKey: 'photos' },
      ...Array.from({ length: count }, (_, i) => ({
        id: 'test-' + i,
        reportPointId: null,
        sectionKey: 'test-photos',
        caption: i === 0 ? '<Detalhe>' : '',
      })),
    ],
  }) as unknown as PdfReport;

describe('Optional LP test photo sheets', () => {
  it.each([0, 1, 2, 3, 4, 6, 7, 10])(
    'prints %i photos in groups of three, only when present',
    (count) => {
      const report = fixture(count),
        before = structuredClone(report);
      const images = new Map(
        report.media.map((m) => [m.id, `data:image/jpeg;base64,PHOTO-${m.id}`]),
      );
      const html = render(report, images);
      const pages = html.match(/<article[^>]*lp-test-photos[\s\S]*?<\/article>/g) ?? [];
      expect(pages).toHaveLength(Math.ceil(count / 3));
      expect(pages.map((page) => (page.match(/class="lp-test-photo"/g) ?? []).length)).toEqual(
        Array.from({ length: Math.ceil(count / 3) }, (_, i) => Math.min(3, count - i * 3)),
      );
      for (let i = 0; i < count; i++)
        expect(html.split(`src="${images.get('test-' + i)}"`)).toHaveLength(2);
      const regularPhotos = photoRows(report, images, 'LP');
      expect(regularPhotos).toContain('PHOTO-point-photo');
      expect(regularPhotos).not.toContain('PHOTO-test-');
      if (count) {
        expect(html.indexOf('FOTOS DO ENSAIO')).toBeGreaterThan(html.indexOf('>DESENHO<'));
        expect(html.indexOf('FOTOS DO ENSAIO')).toBeLessThan(html.indexOf('>SOLDA<'));
        expect(html).toContain('&lt;Detalhe&gt;');
      } else expect(html).not.toContain('FOTOS DO ENSAIO');
      expect(report).toEqual(before);
    },
  );

  it.each(reportTypeCodes)(
    'adds the optional section after drawings only in LP, checking %s',
    (code) => {
      const sections = reportFormSections(code, reportSections[code]!);
      const index = sections.findIndex((s) => s.content === 'testPhotos');
      if (code === 'LP') {
        expect(index).toBe(sections.findIndex((s) => s.content === 'drawings') + 1);
        expect(sections[index]?.title).toBe('Fotos do ensaio');
      } else if (code === 'TH' || code === 'ME') {
        expect(index).toBeGreaterThan(-1);
        expect(sections.some((s) => s.content === 'drawings')).toBe(false);
      } else expect(index).toBe(-1);
    },
  );
});
