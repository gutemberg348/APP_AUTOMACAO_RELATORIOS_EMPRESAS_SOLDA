import { describe, expect, it } from 'vitest';
import {
  drawingDataSchema,
  newDrawingData,
  drawingSvg,
  drawingPageBounds,
  drawingPageViewBox,
  fitDrawingPageView,
  drawingViewport,
  clampDrawingCrop,
  croppedDrawingImageSize,
} from '@weldcosta/shared';

const image = {
  id: 'image',
  type: 'image' as const,
  mediaKey: 'photo',
  x: 500,
  y: 400,
  width: 600,
  height: 400,
  rotation: 0,
  sourceAspectRatio: 1.5,
};
describe('drawing image crop and printed page', () => {
  it('keeps legacy pages and serializes a bounded non-destructive crop', () => {
    expect(drawingPageViewBox(newDrawingData())).toBe('0 0 1000 800');
    const data = {
      ...newDrawingData(),
      page: 'portrait' as const,
      elements: [
        { ...image, crop: { x: 0.25, y: 0.2, width: 0.5, height: 0.6 }, fit: 'cover' as const },
      ],
    };
    const parsed = drawingDataSchema.parse(JSON.parse(JSON.stringify(data)));
    expect(parsed).toEqual(data);
    const svg = drawingSvg(parsed, [], { images: { photo: 'data:image/png;base64,AAAA' } });
    expect(svg).toContain('viewBox="0.375 0.2 0.75 0.6"');
    expect(svg).toContain('xMidYMid slice');
    expect(svg).toContain('drawing-portrait-page');
    expect(svg).toContain('data:image/png;base64,AAAA');
    expect(
      drawingDataSchema.safeParse({
        ...data,
        elements: [{ ...image, crop: { x: 0.8, y: 0, width: 0.5, height: 1 } }],
      }).success,
    ).toBe(false);
  });
  it('matches the print aspect and fits the same page on narrow and wide screens', () => {
    const data = { page: 'portrait' as const },
      p = drawingPageBounds(data);
    expect(p.width / p.height).toBeCloseTo(196 / 239, 10);
    for (const [width, height] of [
      [320, 640],
      [800, 400],
      [390, 700],
    ]) {
      const view = drawingViewport(fitDrawingPageView(data, width!, height!), width!, height!);
      expect(view.x).toBeLessThanOrEqual(p.x + 1e-8);
      expect(view.y).toBeLessThanOrEqual(p.y + 1e-8);
      expect(view.x + view.w).toBeGreaterThanOrEqual(p.x + p.width - 1e-8);
      expect(view.y + view.h).toBeGreaterThanOrEqual(p.height - 1e-8);
    }
  });
  it('bounds drag crops and changes a normal photo frame without distorting its source', () => {
    expect(clampDrawingCrop({ x: -1, y: 2, width: 0.5, height: 0.4 })).toEqual({
      x: 0,
      y: 0.6,
      width: 0.5,
      height: 0.4,
    });
    const crop = { x: 0, y: 0, width: 0.5, height: 1 };
    expect(croppedDrawingImageSize(image, crop, 1.5)).toEqual({ width: 300, height: 400 });
    expect(croppedDrawingImageSize({ ...image, fit: 'cover' }, crop, 1.5)).toEqual({
      width: 600,
      height: 400,
    });
  });
});
