import { describe, it, expect } from 'vitest';
import {
  drawingDataSchema,
  newDrawingData,
  drawingGroupMembers,
  drawingLayerChange,
  drawingOrderedElements,
  drawingLineEndpoint,
  drawingSnap,
  drawingPreciseTransform,
  drawingSelectionBounds,
  hitElement,
  selectDrawingLasso,
  transformDrawingSelection,
  drawingSvg,
  type DrawingElement,
} from '@weldcosta/shared';
const line: DrawingElement = { id: 'line', type: 'line', x1: 300, y1: 300, x2: 500, y2: 300 };
const image: DrawingElement = {
  id: 'image',
  type: 'image',
  mediaKey: 'photo',
  x: 400,
  y: 350,
  width: 400,
  height: 300,
  rotation: 0,
};
describe('Professional drawing editing', () => {
  it('centers asymmetric rotated shapes exactly and rejects a clamped scale during rotation', () => {
    const triangle: DrawingElement = {
      id: 'triangle',
      type: 'polyline',
      points: [
        { x: 300, y: 300 },
        { x: 500, y: 300 },
        { x: 300, y: 400 },
      ],
    };
    const transformed = drawingPreciseTransform([triangle], {
      x: 500,
      y: 400,
      scale: 1.2,
      angle: 35,
    });
    const bounds = drawingSelectionBounds(transformed);
    expect(bounds.center.x).toBeCloseTo(500);
    expect(bounds.center.y).toBeCloseTo(400);
    const label: DrawingElement = {
      id: 'text',
      type: 'text',
      text: 'Teste',
      x: 400,
      y: 400,
      size: 40,
    };
    expect(() =>
      drawingPreciseTransform([label], { x: 500, y: 400, scale: 2, angle: 15 }),
    ).toThrow();
  });
  it('persists group and stacking metadata and expands any member to its group', () => {
    const data = drawingDataSchema.parse({
      ...newDrawingData(),
      elements: [
        { ...line, groupId: 'g', layer: 2 },
        { ...image, groupId: 'g', layer: 1 },
      ],
    });
    expect(drawingGroupMembers(data.elements, ['line']).map((e) => e.id)).toEqual([
      'line',
      'image',
    ]);
    const transformed = transformDrawingSelection(data.elements, 15, 0, 0, 0.8);
    expect(transformed.every((e) => e.groupId === 'g')).toBe(true);
    expect(drawingDataSchema.safeParse({ ...data, elements: transformed }).success).toBe(true);
  });
  it('locked background is rendered but is not hit, selected by lasso or transformed', () => {
    const locked = { ...image, locked: true };
    expect(hitElement([locked], { x: 400, y: 350 })).toBeUndefined();
    expect(
      selectDrawingLasso(
        [locked],
        [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
          { x: 1000, y: 800 },
          { x: 0, y: 800 },
        ],
      ),
    ).toEqual([]);
    const elements = [locked];
    expect(transformDrawingSelection(elements, 0, 40, 30)).toBe(elements);
    expect(
      drawingSvg({ ...newDrawingData(), elements }, [], {
        images: { photo: 'data:image/png;base64,AA==' },
      }),
    ).toContain('<image');
  });
  it('moves only one endpoint and refuses zero length/outside page', () => {
    expect(drawingLineEndpoint(line, 1, { x: 600, y: 400 })).toMatchObject({
      x1: 300,
      y1: 300,
      x2: 600,
      y2: 400,
    });
    expect(drawingLineEndpoint(line, 0, { x: 500, y: 300 })).toBe(line);
    expect(drawingLineEndpoint(line, 1, { x: 1100, y: 300 })).toBe(line);
  });
  it('snaps to endpoints, centers and alignment with guides confined to preview', () => {
    expect(drawingSnap({ x: 497, y: 304 }, [line], 10)).toMatchObject({
      position: { x: 500, y: 300 },
      anchor: { x: 500, y: 300 },
    });
    expect(drawingSnap({ x: 397, y: 299 }, [line], 10).position).toEqual({ x: 400, y: 300 });
    expect(drawingSnap({ x: 298, y: 500 }, [line], 10)).toMatchObject({
      position: { x: 300, y: 500 },
      x: 300,
    });
    expect(drawingSnap({ x: 100, y: 100 }, [line], 10).position).toEqual({ x: 100, y: 100 });
    const data = { ...newDrawingData(), elements: [line] };
    expect(drawingSvg(data, [], { snapGuide: { x: 300 } })).toContain('#D97706');
    expect(drawingSvg(data, [])).not.toContain('#D97706');
  });
  it('stacking order and hit target match, while legacy images remain below lines', () => {
    expect(drawingOrderedElements([line, image]).map((e) => e.id)).toEqual(['image', 'line']);
    const front = drawingLayerChange([line, image], ['image'], true);
    expect(hitElement(front, { x: 400, y: 300 })?.id).toBe('image');
    const svg = drawingSvg({ ...newDrawingData(), elements: front }, [], {
      images: { photo: 'data:image/png;base64,AA==' },
    });
    expect(svg.indexOf('<image')).toBeGreaterThan(svg.indexOf('<line'));
    expect(hitElement(drawingLayerChange(front, ['image'], false), { x: 400, y: 300 })?.id).toBe(
      'line',
    );
  });
  it('applies exact length, angle and position or reports impossible inputs', () => {
    expect(
      drawingPreciseTransform([line], { x: 400, y: 400, scale: 1, angle: 90, length: 200 })[0],
    ).toMatchObject({ x1: 400, y1: 300, x2: 400, y2: 500 });
    expect(
      drawingPreciseTransform([image], { x: 500, y: 400, scale: 0.5, angle: 0 })[0],
    ).toMatchObject({ x: 500, y: 400, width: 200, height: 150 });
    expect(() => drawingPreciseTransform([image], { x: 20, y: 20, scale: 1, angle: 0 })).toThrow();
    expect(() => drawingPreciseTransform([line], { x: NaN, y: 400, scale: 1, angle: 0 })).toThrow();
  });
});
