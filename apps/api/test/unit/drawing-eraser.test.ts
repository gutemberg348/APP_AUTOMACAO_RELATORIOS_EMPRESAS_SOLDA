import { describe, expect, it } from 'vitest';
import {
  eraseDrawingStrokes,
  drawingDataSchema,
  newDrawingData,
  drawingSvg,
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
let id = 0;
const erase = (elements: DrawingElement[], x: number, y: number, to = { x, y }, radius = 10) =>
  eraseDrawingStrokes(elements, { x, y }, to, radius, () => `part-${++id}`);
describe('Partial eraser', () => {
  it('trims an endpoint without deleting the whole line', () => {
    expect(erase([line], 100, 200)).toEqual([{ ...line, x1: 111 }]);
  });
  it('cuts the middle into two styled, independently selectable pieces', () => {
    const result = erase([line], 500, 200);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ ...line, x2: 489 });
    expect(result[1]).toMatchObject({
      type: 'line',
      x2: 900,
      y1: 200,
      y2: 200,
      strokeColor: '#FF0000',
    });
    expect(result[1]!.type === 'line' && result[1]!.x1).toBeCloseTo(511);
    expect(result[0]!.id).not.toBe(result[1]!.id);
    expect(drawingDataSchema.safeParse({ ...newDrawingData(), elements: result }).success).toBe(
      true,
    );
  });
  it('cuts along fast movement even when neither pointer event touches the line', () => {
    expect(erase([line], 500, 100, { x: 500, y: 300 })).toHaveLength(2);
    const result = erase([line], 250, 200, { x: 750, y: 200 }, 20);
    expect(result[0]).toMatchObject({ x2: 229 });
    expect(result[1]).toMatchObject({ x1: 771 });
    expect(erase([line], 50, 200, { x: 950, y: 200 })).toHaveLength(0);
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
    const source = [image, line, text, point],
      before = JSON.stringify(source);
    const result = erase(source, 500, 200);
    expect(JSON.stringify(source)).toBe(before);
    expect(result).toContain(image);
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
    expect(result.every((e) => e.type === 'polyline' && !e.freehand && e.brush === 'marker')).toBe(
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
});
