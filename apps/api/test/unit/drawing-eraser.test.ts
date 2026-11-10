import { describe, expect, it } from 'vitest';
import {
  eraseDrawingStrokes,
  drawingDataSchema,
  newDrawingData,
  drawingSvg,
  sketchElement,
  photoAnnotationsSchema,
  type DrawingElement,
} from '@weldcosta/shared';
const line: DrawingElement = {
  id: 'line',
  type: 'line',
  x1: 100,
  y1: 200,
  x2: 900,
  y2: 200,
  strokeWidth: 2,
  strokeColor: '#FF0000',
};
const pencil: DrawingElement = {
  id: 'pencil',
  type: 'polyline',
  freehand: true,
  points: [
    { x: 100, y: 200 },
    { x: 900, y: 200 },
  ],
  strokeWidth: 2,
  strokeColor: '#FF0000',
};
let id = 0;
const erase = (elements: DrawingElement[], x: number, y: number, to = { x, y }, radius = 10) =>
  eraseDrawingStrokes(elements, { x, y }, to, radius, () => `part-${++id}`);
describe('Partial eraser', () => {
  it('trims a pencil endpoint without deleting the whole stroke', () => {
    expect(erase([pencil], 100, 200)).toEqual([
      {
        ...pencil,
        points: [
          { x: 111, y: 200 },
          { x: 900, y: 200 },
        ],
      },
    ]);
  });
  it('cuts the middle into two styled, independently selectable pieces', () => {
    const result = erase([pencil], 500, 200);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      ...pencil,
      points: [
        { x: 100, y: 200 },
        { x: 489, y: 200 },
      ],
    });
    expect(result[1]).toMatchObject({
      type: 'polyline',
      freehand: true,
      points: [
        { x: expect.closeTo(511), y: 200 },
        { x: 900, y: 200 },
      ],
      strokeColor: '#FF0000',
    });
    expect(result[1]!.type === 'polyline' && result[1]!.points[0]!.x).toBeCloseTo(511);
    expect(result[0]!.id).not.toBe(result[1]!.id);
    expect(drawingDataSchema.safeParse({ ...newDrawingData(), elements: result }).success).toBe(
      true,
    );
  });
  it('cuts along fast movement even when neither pointer event touches the line', () => {
    expect(erase([pencil], 500, 100, { x: 500, y: 300 })).toHaveLength(2);
    const result = erase([pencil], 250, 200, { x: 750, y: 200 }, 20);
    expect(result[0]).toMatchObject({
      points: [
        { x: 100, y: 200 },
        { x: 229, y: 200 },
      ],
    });
    expect(result[1]).toMatchObject({
      points: [
        { x: 771, y: 200 },
        { x: 900, y: 200 },
      ],
    });
    expect(erase([pencil], 50, 200, { x: 950, y: 200 })).toHaveLength(0);
  });
  it('preserves unrelated objects and leaves an immutable undo snapshot', () => {
    const image: DrawingElement = {
      id: 'photo',
      type: 'image',
      mediaKey: 'original',
      x: 500,
      y: 200,
      width: 600,
      height: 400,
      rotation: 0,
    };
    const text: DrawingElement = { id: 'text', type: 'text', text: 'ABC', x: 500, y: 200 };
    const point: DrawingElement = {
      id: 'point',
      type: 'point',
      reportPointId: 'p',
      x: 500,
      y: 200,
    };
    const source = [image, line, pencil, text, point],
      before = JSON.stringify(source);
    const result = erase(source, 500, 200);
    expect(JSON.stringify(source)).toBe(before);
    expect(result).toContain(image);
    expect(result).toContain(line);
    expect(result).toContain(text);
    expect(result).toContain(point);
    expect(erase(source, 10, 10)).toBe(source);
  });
  it('preserves freehand curves away from the erased section, including brush transparency', () => {
    const source: DrawingElement = {
      id: 'curve',
      type: 'polyline',
      freehand: true,
      brush: 'marker',
      strokeWidth: 8,
      strokeColor: '#00AA00',
      points: [
        { x: 100, y: 100 },
        { x: 400, y: 500 },
        { x: 700, y: 100 },
        { x: 900, y: 200 },
      ],
    };
    const result = erase([source], 500, 300, { x: 500, y: 450 }, 25);
    expect(result.length).toBeGreaterThan(1);
    expect(result.every((e) => e.type === 'polyline' && e.freehand && e.brush === 'marker')).toBe(
      true,
    );
    expect(drawingDataSchema.safeParse({ ...newDrawingData(), elements: result }).success).toBe(
      true,
    );
    const svg = drawingSvg({ ...newDrawingData(), grid: 'none', elements: result }, []);
    expect(svg).toContain('stroke-opacity="0.28"');
    expect(svg).not.toContain('stroke="white"');
  });
  it('keeps fragments inside the polyline point limit after flattening long strokes', () => {
    const source: DrawingElement = {
      id: 'long',
      type: 'polyline',
      freehand: true,
      points: Array.from({ length: 1198 }, (_, i) => ({
        x: 100 + i * 0.6,
        y: 300 + Math.sin(i / 2) * 80,
      })),
    };
    const result = erase([source], 450, 100, { x: 450, y: 500 }, 5);
    expect(drawingDataSchema.safeParse({ ...newDrawingData(), elements: result }).success).toBe(
      true,
    );
    expect(result.every((e) => e.type === 'polyline' && e.points.length <= 1200)).toBe(true);
  });
  it('preserves fixed lines, Endireitar, geometric contours and hatch even with a pencil brush', () => {
    const protectedElements: DrawingElement[] = [
      line,
      { ...line, id: 'brush-line', brush: 'pencil' },
      sketchElement('straighten', { x: 100, y: 200 }, { x: 900, y: 200 }, [], 'straighten')!,
      sketchElement('circle', { x: 500, y: 200 }, { x: 700, y: 200 }, [], 'circle')!,
      sketchElement('rectangle', { x: 100, y: 200 }, { x: 900, y: 400 }, [], 'rectangle')!,
      {
        id: 'pipe',
        type: 'polyline',
        points: [
          { x: 100, y: 200 },
          { x: 900, y: 200 },
        ],
      },
      {
        id: 'hatch',
        type: 'polyline',
        freehand: true,
        hatch: { spacing: 4, angle: 90 },
        points: [
          { x: 100, y: 200 },
          { x: 500, y: 400 },
          { x: 900, y: 200 },
        ],
      },
    ];
    expect(erase(protectedElements, 0, 200, { x: 1000, y: 200 }, 80)).toBe(protectedElements);
  });
  it('keeps cut pencil fragments erasable after schema validation and repeated passes', () => {
    let result = erase([pencil], 500, 200);
    result = drawingDataSchema.parse({ ...newDrawingData(), elements: result }).elements;
    result = erase(result, 100, 200);
    expect(result[0]).toMatchObject({
      points: [
        { x: 111, y: 200 },
        { x: 489, y: 200 },
      ],
      freehand: true,
    });
    for (let i = 0; i < 10; i++) result = erase(result, 300 + i * 3, 200);
    expect(
      result.every((e) => e.type === 'polyline' && e.freehand && e.points.length <= 1200),
    ).toBe(true);
    expect(drawingDataSchema.safeParse({ ...newDrawingData(), elements: result }).success).toBe(
      true,
    );
    expect(erase(result, 0, 200, { x: 1000, y: 200 }, 80)).toHaveLength(0);
  });
  it('preserves photo measurement markers and fixed lines when saving erased pencil annotations', () => {
    const original = photoAnnotationsSchema.parse({
      measurements: [{ id: 'm1', number: '1', x: 0.5, y: 0.25, value: 5.9 }],
      elements: [line, pencil],
    });
    const saved = photoAnnotationsSchema.parse({
      ...original,
      elements: erase(original.elements, 500, 200),
    });
    expect(saved.measurements).toEqual(original.measurements);
    expect(saved.elements[0]).toEqual(line);
    expect(saved.elements).toHaveLength(3);
    expect(erase(saved.elements, 0, 200, { x: 1000, y: 200 }, 80)).toEqual([line]);
  });
});
