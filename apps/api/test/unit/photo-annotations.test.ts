import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import {
  drawingBrushes,
  photoAnnotationsSchema,
  photoAnnotationsSvg,
  drawingDataSchema,
  newDrawingData,
  type PhotoAnnotations,
} from '@weldcosta/shared';
import { photoWithAnnotations } from '../../src/modules/pdf/photo-annotations';

const marks: PhotoAnnotations = {
  elements: [
    {
      id: 'mark',
      type: 'polyline',
      freehand: true,
      brush: 'marker',
      strokeColor: '#DC2626',
      strokeWidth: 30,
      points: [
        { x: 200, y: 400 },
        { x: 500, y: 400 },
        { x: 800, y: 400 },
      ],
    },
  ],
};
describe('Non-destructive photo annotation and brushes', () => {
  it('retains brush appearance in drawing data and transparent SVG', () => {
    for (const brush of drawingBrushes) {
      const element = { ...marks.elements[0]!, brush: brush.id, strokeWidth: brush.width };
      expect(
        drawingDataSchema.parse({ ...newDrawingData(), elements: [element] }).elements[0],
      ).toMatchObject(element);
      const svg = photoAnnotationsSvg('data:image/png;base64,AA==', 300, 200, {
        elements: [element],
      });
      expect(svg).toContain('stroke-linecap="' + brush.cap + '"');
      if (brush.opacity < 1) expect(svg).toContain('stroke-opacity="' + brush.opacity + '"');
    }
  });
  it('paints PDF evidence while preserving the original bytes and photo aspect ratio', async () => {
    const source = await sharp({
      create: { width: 160, height: 100, channels: 3, background: '#FFFFFF' },
    })
      .png()
      .toBuffer();
    const original = Buffer.from(source);
    const uri = await photoWithAnnotations(source, 'image/png', marks);
    const painted = Buffer.from(uri.split(',')[1]!, 'base64');
    const info = await sharp(painted).metadata();
    expect([info.width, info.height]).toEqual([160, 100]);
    const { data, info: raw } = await sharp(painted)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const index = (50 * raw.width + 80) * raw.channels;
    expect(data[index]).toBeGreaterThanOrEqual(240);
    expect(data[index + 1]).toBeGreaterThan(150);
    expect(data[index + 1]).toBeLessThan(245);
    expect(source.equals(original)).toBe(true);
    expect(await photoWithAnnotations(source, 'image/png', null)).toBe(
      'data:image/png;base64,' + source.toString('base64'),
    );
  });
  it('rejects injected colors, extra fields and foreign media in annotation data', () => {
    expect(photoAnnotationsSchema.safeParse(marks).success).toBe(true);
    expect(
      photoAnnotationsSchema.safeParse({
        elements: [{ ...marks.elements[0], strokeColor: 'url(https://invalid)' }],
      }).success,
    ).toBe(false);
    expect(
      photoAnnotationsSchema.safeParse({
        elements: [
          {
            id: 'fake',
            type: 'image',
            mediaKey: 'other',
            x: 500,
            y: 400,
            width: 100,
            height: 100,
            rotation: 0,
          },
        ],
      }).success,
    ).toBe(false);
    expect(photoAnnotationsSchema.safeParse({ ...marks, reportPointId: 'another' }).success).toBe(
      false,
    );
    expect(
      photoAnnotationsSchema.safeParse({ elements: [...marks.elements, ...marks.elements] })
        .success,
    ).toBe(false);
  });
});
