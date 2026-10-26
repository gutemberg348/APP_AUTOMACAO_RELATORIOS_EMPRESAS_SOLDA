import { describe, it, expect } from 'vitest';
import {
  drawingSelectionBounds,
  selectDrawingLasso,
  transformDrawingSelection,
  drawingDataSchema,
  newDrawingData,
  drawingSvg,
  type DrawingElement,
} from '@weldcosta/shared';

const lines: DrawingElement[] = [
  { id: 'a', type: 'line', x1: 300, y1: 200, x2: 300, y2: 400 },
  { id: 'b', type: 'line', x1: 450, y1: 200, x2: 450, y2: 400 },
  { id: 'outside', type: 'line', x1: 100, y1: 200, x2: 100, y2: 400 },
];
describe('Lasso selection and rigid block transforms', () => {
  it('resizes an entire mixed drawing together and restores it without losing weld links or appearance', () => {
    const elements: DrawingElement[] = [
      {
        id: 'line',
        type: 'line',
        x1: 300,
        y1: 250,
        x2: 650,
        y2: 500,
        strokeColor: '#1764C0',
        strokeStyle: 'dashed',
      },
      { id: 'text', type: 'text', x: 400, y: 400, text: 'TANQUE', size: 20 },
      {
        id: 'tank',
        type: 'symbol',
        symbolCode: 'isometric-tank',
        x: 400,
        y: 300,
        rotation: 0,
        scale: 1,
      },
      {
        id: 'point',
        type: 'point',
        reportPointId: 'weld-1',
        x: 600,
        y: 450,
        labelX: 620,
        labelY: 440,
      },
      {
        id: 'hatch',
        type: 'polyline',
        points: [
          { x: 400, y: 450 },
          { x: 450, y: 450 },
          { x: 450, y: 500 },
          { x: 400, y: 450 },
        ],
        hatch: { spacing: 8, angle: 90 },
      },
    ];
    const before = drawingSelectionBounds(elements);
    const small = transformDrawingSelection(elements, 0, 0, 0, 1 / 1.15);
    const after = drawingSelectionBounds(small);
    expect(after.center.x).toBeCloseTo(before.center.x);
    expect(after.center.y).toBeCloseTo(before.center.y);
    expect(after.width).toBeCloseTo(before.width / 1.15);
    expect(after.height).toBeCloseTo(before.height / 1.15);
    expect(small.find((e) => e.id === 'point')).toMatchObject({ reportPointId: 'weld-1' });
    expect(small.find((e) => e.id === 'line')).toMatchObject({
      strokeColor: '#1764C0',
      strokeStyle: 'dashed',
    });
    expect(drawingDataSchema.safeParse({ ...newDrawingData(), elements: small }).success).toBe(
      true,
    );
    const restored = drawingSelectionBounds(transformDrawingSelection(small, 0, 0, 0, 1.15));
    expect(restored.width).toBeCloseTo(before.width);
    expect(restored.height).toBeCloseTo(before.height);
  });
  it('refuses a rotation that would leave the page instead of shifting the pivot', () => {
    const edge: DrawingElement[] = [{ id: 'edge', type: 'line', x1: 0, y1: 10, x2: 100, y2: 10 }];
    expect(transformDrawingSelection(edge, 90)).toBe(edge);
  });
  it('selects whole elements, excludes crossing strokes and rejects empty/tiny lassos', () => {
    const polygon = [
      { x: 250, y: 150 },
      { x: 500, y: 150 },
      { x: 500, y: 450 },
      { x: 250, y: 450 },
    ];
    expect(
      selectDrawingLasso(
        [...lines, { id: 'cross', type: 'line', x1: 200, y1: 250, x2: 350, y2: 250 }],
        polygon,
      ),
    ).toEqual(['a', 'b']);
    expect(selectDrawingLasso(lines, [])).toEqual([]);
    expect(
      selectDrawingLasso(lines, [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ]),
    ).toEqual([]);
    const concave = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 70, y: 100 },
      { x: 70, y: 30 },
      { x: 30, y: 30 },
      { x: 30, y: 100 },
      { x: 0, y: 100 },
    ];
    expect(
      selectDrawingLasso([{ id: 'bridge', type: 'line', x1: 10, y1: 80, x2: 90, y2: 80 }], concave),
    ).toEqual([]);
  });
  it('moves every member by the same offset even against the page boundary', () => {
    const moved = transformDrawingSelection(lines.slice(0, 2), 0, 900, 900);
    expect(moved).toMatchObject([
      { x1: 850, y1: 600, x2: 850, y2: 800 },
      { x1: 1000, y1: 600, x2: 1000, y2: 800 },
    ]);
    expect(lines[0]).toMatchObject({ x1: 300, y1: 200 });
    expect(drawingDataSchema.safeParse({ ...newDrawingData(), elements: moved }).success).toBe(
      true,
    );
  });
  it('rotates a block around a shared center without shifting it or changing lengths', () => {
    const selected = lines.slice(0, 2),
      before = drawingSelectionBounds(selected);
    const rotated = transformDrawingSelection(selected, 90),
      after = drawingSelectionBounds(rotated);
    expect(after.center.x).toBeCloseTo(before.center.x);
    expect(after.center.y).toBeCloseTo(before.center.y);
    expect(rotated).toMatchObject([
      { x1: 475, y1: 225, x2: 275, y2: 225 },
      { x1: 475, y1: 375, x2: 275, y2: 375 },
    ]);
    const restored = transformDrawingSelection(rotated, -90);
    expect(restored).toEqual(selected);
  });
  it('preserves point links and keeps rotation and lasso previews out of ordinary SVG', () => {
    const selected: DrawingElement[] = [
      ...lines.slice(0, 2),
      { id: 'p', type: 'point', reportPointId: 'weld-1', x: 375, y: 300, labelX: 390, labelY: 280 },
      { id: 's', type: 'symbol', symbolCode: 'valve', x: 375, y: 300, rotation: 30, scale: 1 },
    ];
    const result = transformDrawingSelection(selected, 45, 10, 20);
    expect(result.find((e) => e.id === 'p')).toMatchObject({
      reportPointId: 'weld-1',
      x: 385,
      y: 320,
    });
    expect(result.find((e) => e.id === 's')).toMatchObject({ rotation: 75, scale: 1 });
    expect(drawingDataSchema.safeParse({ ...newDrawingData(), elements: result }).success).toBe(
      true,
    );
    const data = { ...newDrawingData(), elements: result };
    const options = {
      selectedIds: ['a', 'b'],
      lasso: [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
        { x: 100, y: 200 },
      ],
      rotationControl: { center: { x: 300, y: 300 }, handle: { x: 300, y: 150 }, radius: 14 },
    };
    const preview = drawingSvg(data, [], options);
    expect(preview).toContain('data-lasso');
    expect(preview).toContain('data-rotation-handle');
    expect(preview.match(/data-selection-frame/g)).toHaveLength(1);
    const normal = drawingSvg(data, []);
    expect(normal).not.toContain('data-lasso');
    expect(normal).not.toContain('data-rotation-handle');
    expect(normal).not.toContain('data-selection-frame');
  });
  it('uses a common scale for mixed elements and preserves valid size and offset limits', () => {
    const mixed: DrawingElement[] = [
      { id: 's', type: 'symbol', symbolCode: 'valve', x: 400, y: 300, scale: 1, rotation: 0 },
      { id: 't', type: 'text', x: 500, y: 300, size: 20, text: 'AB' },
      {
        id: 'd',
        type: 'dimension',
        x1: 400,
        y1: 400,
        x2: 500,
        y2: 400,
        offset: 100,
        text: '100 mm',
      },
    ];
    const scaled = transformDrawingSelection(mixed, 0, 0, 0, 10);
    expect(scaled.find((e) => e.id === 's')).toMatchObject({ scale: 1.5 });
    expect(scaled.find((e) => e.id === 't')).toMatchObject({ size: 30, text: 'AB' });
    expect(scaled.find((e) => e.id === 'd')).toMatchObject({ offset: 150, text: '100 mm' });
    expect(drawingDataSchema.safeParse({ ...newDrawingData(), elements: scaled }).success).toBe(
      true,
    );
    expect(transformDrawingSelection(mixed, NaN)).toBe(mixed);
  });
});
