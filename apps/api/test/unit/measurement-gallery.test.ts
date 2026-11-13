import { expect, it } from 'vitest';
import {
  measurementPhotoDefaults,
  photoAnnotationsSchema,
  reportSections,
} from '@weldcosta/shared';
import { reportFormSections } from '../../../app/features/reports/report-form-sections';
import { reportForPdf } from '../../src/modules/pdf/pdf-snapshot';
import { render } from '../../src/modules/pdf/templates/reports/thickness';
import type { PdfReport } from '../../src/modules/pdf/templates/reports/layout';

it('ME exposes one editable photo/measurement gallery and no drawing/point cards', () => {
  const sections = reportFormSections('ME', reportSections.ME!);
  expect(sections.filter((s) => s.content === 'testPhotos')).toHaveLength(1);
  expect(sections.some((s) => s.content === 'drawings' || s.content === 'points')).toBe(false);
  expect(sections.flatMap((s) => s.fields).map((f) => f.path)).toEqual(
    reportSections.ME!.flatMap((s) => s.fields).map((f) => f.path),
  );
});

it('keeps per-photo metadata, null acceptance and zero values across local JSON serialization', () => {
  const annotations = {
    elements: [],
    measurementDetails: {
      side: 'LATERAL',
      discontinuity: '-',
      acceptable: false,
      projectThickness: '6 mm',
    },
    measurements: [{ id: 'm1', number: '01', x: 0.25, y: 0.75, value: 0 }],
  };
  expect(photoAnnotationsSchema.parse(JSON.parse(JSON.stringify(annotations)))).toEqual(
    annotations,
  );
  expect(
    measurementPhotoDefaults({ label: 'LATERAL', data: { acceptable: false } }, '6 mm'),
  ).toMatchObject({ side: 'LATERAL', acceptable: false, projectThickness: '6 mm' });
  expect(measurementPhotoDefaults(undefined)).toMatchObject({ side: '', acceptable: null });
});

it('renders per-photo details without drawings, phantom points or empty support details', () => {
  const report = {
    number: '001',
    title: 'ME',
    reportType: { code: 'ME' },
    company: { name: 'CLIENTE' },
    project: { name: 'OBRA' },
    specificData: {},
    signatures: [],
    drawings: [{ data: { notes: 'PRIVATE' } }],
    points: [{ id: 'old-empty', number: '99', data: {} }],
    media: [
      { id: 'drawing', sectionKey: 'drawing' },
      { id: 'embedded', sectionKey: 'photos', clientUploadId: 'drawing-image-old' },
      {
        id: 'a',
        sectionKey: 'test-photos',
        annotations: {
          elements: [],
          measurementDetails: {
            side: 'FRENTE',
            discontinuity: '-',
            acceptable: false,
            projectThickness: '5 mm',
          },
          measurements: [{ id: 'one', number: '1', x: 0.5, y: 0.5, value: 0 }],
        },
      },
      { id: 'b', sectionKey: 'test-photos', annotations: { elements: [] } },
    ],
  } as unknown as PdfReport;
  const before = structuredClone(report),
    printable = reportForPdf(report);
  expect(printable.drawings).toEqual([]);
  expect(printable.media.map((m) => m.id)).toEqual(['a', 'b']);
  const html = render(
    printable,
    new Map([
      ['a', 'main'],
      ['b', 'support'],
    ]),
  );
  expect(html).toContain('FRENTE');
  expect(html).toContain('5 mm');
  expect(html).toContain('0 mm');
  expect(html).toContain('NÃO');
  expect(html).not.toContain('PONTO 99');
  expect(html).not.toContain('PRIVATE');
  expect(html.match(/class="measurement-reading"/g)).toHaveLength(1);
  expect(html.match(/>LADO:/g)).toHaveLength(1);
  expect(report).toEqual(before);
});
