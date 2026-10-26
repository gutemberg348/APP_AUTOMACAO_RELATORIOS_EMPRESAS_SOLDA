import { describe, it, expect } from 'vitest';
import {
  drawingDataSchema,
  drawingSvg,
  newDrawingData,
  hitElement,
  transformDrawingElement,
  transformDrawingSelection,
  selectDrawingLasso,
  type DrawingElement,
} from '@weldcosta/shared';
import { drawings } from '../../src/modules/pdf/templates/reports/reference-layout';
import type { PdfReport } from '../../src/modules/pdf/templates/reports/layout';

const image: DrawingElement = {
  id: 'image',
  type: 'image',
  mediaKey: 'drawing-image-upload',
  x: 500,
  y: 400,
  width: 400,
  height: 200,
  rotation: 0,
};
const point: DrawingElement = {
  id: 'point',
  type: 'point',
  reportPointId: 'weld-1',
  x: 500,
  y: 400,
};
describe('Images embedded in technical drawings', () => {
  it('persists a media reference only and renders an uncropped image behind annotations', () => {
    const data = drawingDataSchema.parse({ ...newDrawingData(), elements: [point, image] });
    expect(
      drawingDataSchema.safeParse({
        ...data,
        elements: [{ ...image, uri: 'https://external.invalid/a.png' }],
      }).success,
    ).toBe(false);
    const svg = drawingSvg(data, [{ id: 'weld-1', number: '01' }], {
      images: { 'drawing-image-upload': 'data:image/png;base64,AA==' },
    });
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(svg.indexOf('<image ')).toBeLessThan(svg.indexOf('<circle '));
    expect(hitElement([point, image], { x: 500, y: 400 })?.id).toBe('point');
    expect(hitElement([image], { x: 330, y: 320 })?.id).toBe('image');
    expect(drawingSvg(data, [])).not.toContain('<image ');
  });
  it('selects, moves, resizes and rotates an image together with its point', () => {
    const elements = [image, point];
    expect(
      selectDrawingLasso(elements, [
        { x: 250, y: 250 },
        { x: 750, y: 250 },
        { x: 750, y: 550 },
        { x: 250, y: 550 },
      ]),
    ).toEqual(['image', 'point']);
    const result = transformDrawingSelection(elements, 90, 10, 20, 0.5);
    expect(result[0]).toMatchObject({
      width: 200,
      height: 100,
      rotation: 90,
      x: 510,
      y: 420,
      mediaKey: image.mediaKey,
    });
    expect(result[1]).toMatchObject({ x: 510, y: 420, reportPointId: 'weld-1' });
    expect(drawingDataSchema.safeParse({ ...newDrawingData(), elements: result }).success).toBe(
      true,
    );
    expect(transformDrawingElement(image, 0, 2000, 0)).toMatchObject({ x: 800 });
  });
  it('embeds the photo on its drawing page only, preserving standalone legacy images', () => {
    const report = {
      number: '01',
      reportDate: new Date('2026-10-26'),
      reportType: { code: 'EVS' },
      points: [{ id: 'weld-1', number: '01', data: {} }],
      drawings: [{ data: { ...newDrawingData(), elements: [image, point] } }],
      media: [
        {
          id: 'm',
          sectionKey: 'drawing',
          clientUploadId: 'drawing-image-upload',
          reportPointId: null,
        },
        { id: 'legacy', sectionKey: 'drawing', reportPointId: null },
      ],
    } as unknown as PdfReport;
    const html = drawings(
      report,
      new Map([
        ['m', 'data:image/png;base64,AA=='],
        ['legacy', 'data:image/png;base64,BB=='],
      ]),
    );
    expect(html.match(/data:image\/png;base64,AA==/g)).toHaveLength(1);
    expect(html).toContain('data:image/png;base64,BB==');
    expect(html).toContain('<image ');
  });
});
