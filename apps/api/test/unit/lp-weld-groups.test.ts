import { describe, expect, it } from 'vitest';
import {
  lpWeldGroups,
  lpWeldNumbers,
  reportUpdateSchema,
  reportReviewWarnings,
  newDrawingData,
  drawingSvg,
} from '@weldcosta/shared';
import { drawings, photoRows } from '../../src/modules/pdf/templates/reports/reference-layout';
import type { PdfReport } from '../../src/modules/pdf/templates/reports/layout';
import { nextLpWeldNumber } from '../../../app/features/reports/report-autofill';

const points = () =>
  Array.from({ length: 6 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    number: String(i + 1),
    type: 'WELD' as const,
    label: 'Identificação ' + (i + 1),
    data: i === 0 ? { weldNumbers: '01 - 02 - 03 - 04', acceptable: true } : { acceptable: true },
  }));
const fixture = () =>
  ({
    points: points(),
    media: [0, 4, 4].map((pointIndex, i) => ({
      id: 'photo-' + i,
      reportPointId: points()[pointIndex]!.id,
      sectionKey: 'photos',
    })),
  }) as unknown as PdfReport;
const sources = new Map([0, 1, 2].map((i) => ['photo-' + i, 'IMAGE-' + i]));

describe('Automatic LP weld coverage', () => {
  it('uses the first sheet, folds 2/3/4 into it and preserves independent sheets without photos', () => {
    const original = points(),
      before = structuredClone(original);
    expect(lpWeldGroups(original)).toEqual([
      { index: 0, number: '01 - 02 - 03 - 04', memberIndexes: [0, 1, 2, 3] },
      { index: 4, number: '5', memberIndexes: [4] },
      { index: 5, number: '6', memberIndexes: [5] },
    ]);
    expect(original).toEqual(before);
    expect(reportUpdateSchema.parse({ version: 1, points: original }).points).toEqual(original);
    expect(lpWeldGroups(JSON.parse(JSON.stringify(original)))).toEqual(lpWeldGroups(original));
  });
  it('recognizes zero padding, mixed separators and deduplicates within a sheet, not numeric ranges', () => {
    expect(lpWeldNumbers('01 - 1, 02; 03 / 04 5')).toEqual(['01', '02', '03', '04', '5']);
    expect(lpWeldNumbers('01-04')).toEqual(['01', '04']);
    expect(lpWeldNumbers('J-01')).toEqual(['J-01']);
    expect(lpWeldGroups([{ number: '01-02' }, { number: '2-03-04' }, { number: '04' }])).toEqual([
      { index: 0, number: '01 - 02', memberIndexes: [0] },
      { index: 1, number: '03 - 04', memberIndexes: [1, 2] },
    ]);
  });
  it('releases a weld when removed from the first sheet without losing its previous information', () => {
    const original = points();
    original[0]!.data.weldNumbers = '01 - 02';
    expect(lpWeldGroups(original).map((g) => g.index)).toEqual([0, 2, 3, 4, 5]);
    expect(original[2]!.label).toBe('Identificação 3');
    expect(original[2]!.number).toBe('3');
    original[0]!.data.weldNumbers = '01 - 10 - 11';
    expect(nextLpWeldNumber(original)).toBe('7');
    original[0]!.data.weldNumbers = '01 - 07 - 08 - 09';
    expect(nextLpWeldNumber(original)).toBe('10');
  });
  it('does not warn about results of covered drawing-generated sheets', () => {
    const original = points();
    original[1]!.data = {};
    original[2]!.data = {};
    const warnings = reportReviewWarnings({
      title: 'LP',
      reportDate: '2026-11-11',
      specificData: {},
      reportType: { code: 'LP', config: {} },
      points: original,
    });
    expect(warnings.filter((w) => w.startsWith('Pontos sem resultado'))).toEqual([]);
  });
});

describe('LP consecutive photo cells', () => {
  it('keeps the original drawing numbers and positions when grouping photo sheets', () => {
    const report = fixture();
    report.drawings = [
      {
        data: {
          ...newDrawingData(),
          elements: report.points.map((point, index) => ({
            id: 'mark-' + index,
            type: 'point',
            reportPointId: point.id,
            x: 100 + index * 60,
            y: 200 + index * 30,
            labelPosition: 'custom',
            labelX: 90 + index * 60,
            labelY: 180 + index * 30,
          })),
        },
      },
    ] as PdfReport['drawings'];
    const before = structuredClone(report.drawings);
    const originalPoints = report.points.map((point) => ({ ...point, data: { acceptable: true } }));
    const svg = drawingSvg(report.drawings[0]!.data, originalPoints);
    const photoHtml = photoRows(report, sources, 'LP');
    const drawingHtml = drawings(report, sources);
    expect(photoHtml).toContain('01 - 02 - 03 - 04');
    expect(drawingSvg(report.drawings[0]!.data, report.points)).toBe(svg);
    expect(drawingHtml).toContain(svg);
    expect(drawingHtml).not.toContain('01 - 02 - 03 - 04');
    for (let number = 1; number <= 6; number++) expect(svg).toContain('>' + number + '</text>');
    expect(report.drawings).toEqual(before);
  });
  it('places welds 1–4 next to 5, with one real placeholder for independent weld 6', () => {
    const report = fixture();
    const html = photoRows(report, sources, 'LP');
    const rows = html.split('<div class="reference-photo-row">').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('01 - 02 - 03 - 04');
    expect(rows[0]).toContain('IMAGE-0');
    expect(rows[0]).toContain('IMAGE-1');
    expect(rows[1]).toContain('IMAGE-2');
    expect(rows[1]).toContain('>6</span>');
    expect(html.match(/Sem foto anexada/g)).toHaveLength(1);
    expect(html).not.toMatch(/SOLDA Nº: <span>[234]<\/span>/);
  });
  it('retains photos already attached to covered sheets and prints each exactly once', () => {
    const report = fixture();
    report.media[1]!.reportPointId = report.points[2]!.id;
    const before = structuredClone(report);
    const html = photoRows(report, sources, 'LP');
    expect(html.indexOf('IMAGE-0')).toBeLessThan(html.indexOf('IMAGE-1'));
    expect(html.indexOf('IMAGE-1')).toBeLessThan(html.indexOf('IMAGE-2'));
    expect(html.match(/01 - 02 - 03 - 04/g)).toHaveLength(2);
    for (let i = 0; i < 3; i++) expect(html.split('IMAGE-' + i)).toHaveLength(2);
    expect(report).toEqual(before);
  });
  it.each(['TH', 'RDO'] as const)('does not group another report type: %s', (mode) => {
    const html = photoRows(fixture(), sources, mode);
    expect(html).toContain('>2</span>');
    expect(html).toContain('>3</span>');
    expect(html).not.toContain('01 - 02 - 03 - 04');
  });
});
