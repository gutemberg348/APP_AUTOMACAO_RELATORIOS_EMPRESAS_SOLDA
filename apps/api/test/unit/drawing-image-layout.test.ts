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
  drawingImageFrame,
  drawingImageClip,
  fitDrawingImageToPage,
  transformDrawingElement,
  drawingSelectionBounds,
  moveElement,
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
    expect(svg).toContain('clip-path="url(#drawing-image-image)"');
    expect(svg).toContain('transform="translate(500 400) rotate(0)"');
    expect(svg.match(/<svg\s/g)).toHaveLength(1);
    expect(svg).toContain('drawing-portrait-page');
    expect(svg).toContain('data:image/png;base64,AAAA');
    expect(
      drawingDataSchema.safeParse({
        ...data,
        elements: [{ ...image, crop: { x: 0.8, y: 0, width: 0.5, height: 1 } }],
      }).success,
    ).toBe(false);
  });
  it('moves the cropped pixels and their frame together, preserving the source and crop', () => {
    const cropped = {
      ...image,
      crop: { x: 0.25, y: 0.2, width: 0.5, height: 0.6 },
      fit: 'cover' as const,
    };
    const moved = moveElement(cropped, 50, 60);
    expect(moved).toMatchObject({ ...cropped, x: 550, y: 460 });
    if (moved.type !== 'image') throw new Error('Expected image');
    expect(drawingImageFrame(moved)).toEqual(drawingImageFrame(cropped));
    const svg = drawingSvg({ ...newDrawingData(), elements: [moved] }, [], {
      images: { photo: 'data:image/png;base64,AAAA' },
      selectedId: moved.id,
      selectionFrame: true,
    });
    expect(svg).toContain('translate(550 460) rotate(0)');
    expect(svg).toContain('data-selection-frame="true"');
    expect(drawingImageFrame(cropped)).toEqual({ x: -600, y: -400, width: 1200, height: 800 });
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

  it('keeps an enlarged and slightly rotated image fully inside the portrait print area', () => {
    const data = { ...newDrawingData(), page: 'portrait' as const };
    const page = drawingPageBounds(data);
    const selected = { ...image, x: 430, width: 420, height: 500, sourceAspectRatio: 0.84 };
    const enlarged = transformDrawingElement(selected, 6, 0, 0, 2, page);
    if (enlarged.type !== 'image') throw new Error('Expected image');
    expect(enlarged.width).toBeGreaterThan(selected.width);
    expect(enlarged.width / enlarged.height).toBeCloseTo(0.84);
    expect(enlarged.rotation).toBe(6);
    const dragged = moveElement(enlarged, 2000, -2000, page);
    const bounds = drawingSelectionBounds([dragged]);
    expect(bounds.x).toBeGreaterThanOrEqual(page.x - 1e-6);
    expect(bounds.x + bounds.width).toBeCloseTo(page.x + page.width);
    expect(bounds.y).toBeCloseTo(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(page.height + 1e-6);
    expect(drawingDataSchema.safeParse({ ...data, elements: [dragged] }).success).toBe(true);
  });

  it('fits the whole photo or its explicit crop instead of silently trimming either frame', () => {
    const data = { page: 'portrait' as const };
    const page = drawingPageBounds(data);
    const photo = fitDrawingImageToPage({ ...image, fit: 'cover' }, data, 'contain');
    expect(photo.width).toBeCloseTo(page.width);
    expect(photo.height).toBeCloseTo(page.width / 1.5);
    expect(drawingImageClip(photo, drawingImageFrame(photo))).toBeUndefined();
    const crop = { x: 0.25, y: 0, width: 0.5, height: 1 };
    const resized = fitDrawingImageToPage({ ...image, crop }, data, 'contain');
    expect(resized).toMatchObject({ width: 600, height: 800, crop, mediaKey: image.mediaKey });
    const legacy = { ...image, crop };
    expect(drawingImageClip(legacy, drawingImageFrame(legacy))).toEqual({
      x: -150,
      y: -200,
      width: 300,
      height: 400,
    });
  });
});
