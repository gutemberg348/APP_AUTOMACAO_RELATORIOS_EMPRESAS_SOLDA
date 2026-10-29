import { describe, expect, it } from 'vitest';
import {
  appendStrokePoint,
  freehandPath,
  createFreehandPathBuilder,
  sketchElement,
  drawingViewport,
  zoomDrawingAt,
  drawingDataSchema,
  drawingSvg,
  newDrawingData,
  hitElement,
  moveElement,
  type DrawingPosition,
} from '@weldcosta/shared';

describe('Hand-drawn tools and responsive canvas', () => {
  it('incrementally previews the exact saved curve across frames, compaction and new strokes', () => {
    const preview = createFreehandPathBuilder();
    let points: DrawingPosition[] = [];
    for (let i = 0; i < 2500; i++) {
      points = appendStrokePoint(points, { x: 100 + (i % 800), y: 200 + Math.sin(i / 12) * 80 });
      if (i % 25 === 0) expect(preview(points)).toBe(freehandPath(points));
    }
    expect(preview(points)).toBe(freehandPath(points));
    expect(preview([])).toBe('');
    const next = [
      { x: 40, y: 50 },
      { x: 41, y: 53 },
      { x: 45, y: 57 },
    ];
    expect(preview(next)).toBe(freehandPath(next));
    // Undo / same-length replacement must invalidate the cached prefix too.
    const replacement = next.map((p) => ({ x: p.x + 10, y: p.y }));
    expect(preview(replacement)).toBe(freehandPath(replacement));
  });
  it('samples freehand movement at the same screen distance across zoom levels', () => {
    for (const worldPerPixel of [0.2, 1, 3, 5]) {
      const origin = { x: 100, y: 100 };
      const samples = [origin];
      expect(
        appendStrokePoint(samples, { x: 100 + 0.1 * worldPerPixel, y: 100 }, 0.25 * worldPerPixel),
      ).toBe(samples);
      const points = appendStrokePoint(
        samples,
        { x: 100 + 0.4 * worldPerPixel, y: 100 },
        0.25 * worldPerPixel,
      );
      expect(points).toHaveLength(2);
      expect(samples).toEqual([origin]);
      expect(points[1]!.x).toBeCloseTo(100 + 0.4 * worldPerPixel);
    }
  });
  it('anchors pinch zoom under the fingers while allowing simultaneous panning', () => {
    for (const [width, height] of [
      [390, 620],
      [1200, 650],
    ]) {
      const initial = { x: -100, y: 70, w: 1000, h: 800 };
      const anchor = { x: 180, y: 200 },
        translation = { x: 35, y: -40 };
      const before = drawingViewport(initial, width!, height!);
      const after = drawingViewport(
        zoomDrawingAt(initial, width!, height!, anchor, 2, translation),
        width!,
        height!,
      );
      expect(after.w).toBe(500);
      expect(after.x + ((anchor.x + translation.x) * after.w) / width!).toBeCloseTo(
        before.x + (anchor.x * before.w) / width!,
      );
      expect(after.y + ((anchor.y + translation.y) * after.w) / width!).toBeCloseTo(
        before.y + (anchor.y * before.w) / width!,
      );
      expect(zoomDrawingAt(initial, width!, height!, anchor, 10000).w).toBe(150);
    }
  });
  it('selects inside closed shapes without filling an open freehand stroke', () => {
    const rect = sketchElement('rectangle', { x: 100, y: 100 }, { x: 400, y: 400 }, [], 'r')!;
    const circle = sketchElement('circle', { x: 600, y: 300 }, { x: 720, y: 300 }, [], 'c')!;
    expect(hitElement([rect], { x: 250, y: 250 })?.id).toBe('r');
    expect(hitElement([circle], { x: 600, y: 300 })?.id).toBe('c');
    expect(hitElement([circle], { x: 760, y: 300 })).toBeUndefined();
    if (rect.type !== 'polyline') throw new Error('Expected contour');
    expect(
      hitElement([{ ...rect, points: rect.points.slice(0, -1) }], { x: 250, y: 250 }),
    ).toBeUndefined();
  });
  it('keeps long freehand strokes bounded and preserves both endpoints', () => {
    let samples: DrawingPosition[] = [{ x: 10, y: 10 }];
    for (let i = 0; i < 4000; i++)
      samples = appendStrokePoint(samples, { x: 20 + (i % 970), y: 100 + Math.sin(i / 30) * 80 });
    const e = sketchElement('pencil', samples[0]!, { x: 990, y: 790 }, samples, 'free')!;
    expect(e.type).toBe('polyline');
    if (e.type !== 'polyline') return;
    expect(e.points.length).toBeLessThanOrEqual(1200);
    expect(e.points[0]).toEqual({ x: 10, y: 10 });
    expect(e.points.at(-1)).toEqual({ x: 990, y: 790 });
    expect(drawingDataSchema.safeParse({ ...newDrawingData(), elements: [e] }).success).toBe(true);
  });
  it('keeps small pen movements and renders a smooth path through the original endpoints', () => {
    const samples = [{ x: 100, y: 100 }];
    const points = appendStrokePoint(samples, { x: 100.4, y: 100.3 });
    expect(points).toHaveLength(2);
    const stroke = sketchElement('pencil', samples[0]!, { x: 101, y: 100.8 }, points, 'ink')!;
    expect(stroke).toMatchObject({ type: 'polyline', freehand: true });
    if (stroke.type !== 'polyline') throw new Error('Expected freehand');
    expect(freehandPath(stroke.points)).toMatch(/^M100 100Q/);
    expect(freehandPath(stroke.points)).toMatch(/L101 100.8$/);
    expect(drawingSvg({ ...newDrawingData(), grid: 'none', elements: [stroke] }, [])).toContain(
      '<path d="M100 100Q',
    );
  });
  it('straightens only the selected tool, retaining the direction drawn by the user', () => {
    const samples = [
      { x: 100, y: 100 },
      { x: 150, y: 240 },
      { x: 200, y: 110 },
    ];
    expect(sketchElement('straighten', samples[0]!, samples[2]!, samples, 'l')).toEqual({
      id: 'l',
      type: 'line',
      x1: 100,
      y1: 100,
      x2: 200,
      y2: 110,
    });
    expect(sketchElement('pencil', samples[0]!, samples[2]!, samples, 'p')).toMatchObject({
      points: samples,
    });
    expect(sketchElement('pencil', samples[0]!, samples[0]!, [samples[0]!], 'p')).toBeUndefined();
  });
  it('closes circles and rectangles, respects boundaries and keeps SVG/PDF compatibility', () => {
    const circle = sketchElement('circle', { x: 100, y: 200 }, { x: 400, y: 200 }, [], 'c')!;
    const rect = sketchElement('rectangle', { x: 400, y: 400 }, { x: 200, y: 200 }, [], 'r')!;
    for (const e of [circle, rect]) {
      if (e.type !== 'polyline') throw new Error('Expected contour');
      expect(e.points[0]).toEqual(e.points.at(-1));
      expect(drawingDataSchema.safeParse({ ...newDrawingData(), elements: [e] }).success).toBe(
        true,
      );
      expect(
        drawingDataSchema.safeParse({
          ...newDrawingData(),
          elements: [moveElement(e, -1000, 1000)],
        }).success,
      ).toBe(true);
      expect(drawingSvg({ ...newDrawingData(), elements: [e] }, [])).toContain('<polyline');
    }
    expect(hitElement([circle], { x: 200, y: 200 })?.id).toBe('c');
    expect(hitElement([rect], { x: 300, y: 200 })?.id).toBe('r');
  });
  it('centers the same sheet without stretching geometry in portrait or landscape', () => {
    for (const [width, height] of [
      [390, 620],
      [1200, 650],
    ]) {
      const view = drawingViewport({ x: 0, y: 0, w: 1000, h: 800 }, width!, height!);
      expect(view.w / view.h).toBeCloseTo(width! / height!);
      expect(view.y + view.h / 2).toBeCloseTo(400);
      const worldX = view.x + (width! / 2 / width!) * view.w;
      const worldY = view.y + (height! / 2 / width!) * view.w;
      expect(worldX).toBeCloseTo(500);
      expect(worldY).toBeCloseTo(400);
    }
  });
});
