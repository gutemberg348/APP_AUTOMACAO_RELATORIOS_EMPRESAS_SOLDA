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
import { photoWithAnnotations, photoForPdf } from '../../src/modules/pdf/photo-annotations';

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
  it.each([
    [150, 400],
    [400, 150],
    [300, 300],
    [400, 300],
  ])(
    'fills every export pixel for %sx%s photos, with and without paint, without cropping',
    async (width, height) => {
      const source = await sharp(
        Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#16725B"/><rect width="${width / 2}" height="${height / 2}" fill="#DC2626"/><rect x="${width / 2}" width="${width / 2}" height="${height / 2}" fill="#1764C0"/><rect x="${width / 2}" y="${height / 2}" width="${width / 2}" height="${height / 2}" fill="#EAB308"/></svg>`,
        ),
      )
        .png()
        .toBuffer();
      const original = Buffer.from(source);
      for (const annotations of [null, marks]) {
        const result = await photoForPdf(source, 'image/png', annotations);
        const { data, info } = await sharp(Buffer.from(result.split(',')[1]!, 'base64'))
          .raw()
          .toBuffer({ resolveWithObject: true });
        expect([info.width, info.height]).toEqual([1200, 900]);
        const pixel = (x: number, y: number) => [
          ...data.subarray(
            (y * info.width + x) * info.channels,
            (y * info.width + x) * info.channels + 3,
          ),
        ];
        for (const [x, y, color] of [
          [5, 5, [220, 38, 38]],
          [1194, 5, [23, 100, 192]],
          [5, 894, [22, 114, 91]],
          [1194, 894, [234, 179, 8]],
        ] as [number, number, number[]][]) {
          expect(pixel(x, y).every((value, i) => Math.abs(value - color[i]!) < 12)).toBe(true);
        }
      }
      expect(source.equals(original)).toBe(true);
    },
  );
  it('renders numbered photo circles even without brush strokes and preserves measurement values', async () => {
    const annotations = {
      elements: [],
      measurements: [{ id: 'one', number: '01', x: 0.5, y: 0.5, value: 5.9 }],
    };
    expect(photoAnnotationsSchema.parse(annotations)).toEqual(annotations);
    const source = await sharp({
      create: { width: 400, height: 300, channels: 3, background: '#FF0000' },
    })
      .png()
      .toBuffer();
    const original = Buffer.from(source);
    const result = await photoWithAnnotations(source, 'image/png', annotations);
    expect(result).not.toBe('data:image/png;base64,' + source.toString('base64'));
    expect(source.equals(original)).toBe(true);
    const info = await sharp(Buffer.from(result.split(',')[1]!, 'base64')).metadata();
    expect([info.width, info.height]).toEqual([400, 300]);
    expect(photoAnnotationsSvg('image', 400, 300, annotations)).toContain('>01</text>');
    expect(
      photoAnnotationsSchema.safeParse({
        ...annotations,
        measurements: [
          ...annotations.measurements,
          { ...annotations.measurements[0], id: 'two', number: '1' },
        ],
      }).success,
    ).toBe(false);
    expect(
      photoAnnotationsSchema.safeParse({
        ...annotations,
        measurements: [{ ...annotations.measurements[0], x: 1.1 }],
      }).success,
    ).toBe(false);
  });
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
      if (brush.id === 'airbrush') {
        expect(svg.match(/<path /g)).toHaveLength(6);
        expect(svg).toContain('stroke-opacity="0.025"');
        expect(svg).toContain('stroke-opacity="0.12"');
      } else if (brush.opacity < 1) expect(svg).toContain('stroke-opacity="' + brush.opacity + '"');
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
