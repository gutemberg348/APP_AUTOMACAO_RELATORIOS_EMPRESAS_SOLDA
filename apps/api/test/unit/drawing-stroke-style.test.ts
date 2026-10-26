import { describe, expect, it } from 'vitest';
import {
  drawingDataSchema,
  drawingSvg,
  drawingStrokeColor,
  drawingStrokeStyle,
  moveElement,
  transformDrawingSelection,
  newDrawingData,
  type DrawingElement,
} from '@weldcosta/shared';
describe('Persistent drawing stroke appearance', () => {
  it('preserves appearance through serialization, movement, rotation and selected preview', () => {
    const line: DrawingElement = {
      id: 'a',
      type: 'line',
      x1: 200,
      y1: 200,
      x2: 400,
      y2: 200,
      strokeWidth: 5,
      strokeColor: '#DC2626',
      strokeStyle: 'dotted',
    };
    const data = drawingDataSchema.parse(
      JSON.parse(JSON.stringify({ ...newDrawingData(), elements: [line] })),
    );
    expect(moveElement(data.elements[0]!, 20, 30)).toMatchObject({
      strokeColor: '#DC2626',
      strokeStyle: 'dotted',
      strokeWidth: 5,
    });
    expect(transformDrawingSelection(data.elements, 90)[0]).toMatchObject({
      strokeColor: '#DC2626',
      strokeStyle: 'dotted',
      strokeWidth: 5,
    });
    for (const selectedId of [undefined, 'a']) {
      const svg = drawingSvg(data, [], { selectedId, selectionFrame: true });
      expect(svg).toContain('stroke="#DC2626" stroke-width="5"');
      expect(svg).toContain('stroke-dasharray="0.1 12.5"');
    }
  });
  it('rejects unsafe colors and invalid line styles while retaining compatibility with old drawings', () => {
    const line = { id: 'a', type: 'line', x1: 200, y1: 200, x2: 400, y2: 200 };
    expect(drawingDataSchema.safeParse({ ...newDrawingData(), elements: [line] }).success).toBe(
      true,
    );
    for (const strokeColor of ['red', 'url(http://example.com)', '#12', '#123456" onload="x'])
      expect(
        drawingDataSchema.safeParse({ ...newDrawingData(), elements: [{ ...line, strokeColor }] })
          .success,
      ).toBe(false);
    expect(
      drawingDataSchema.safeParse({
        ...newDrawingData(),
        elements: [{ ...line, strokeStyle: 'unknown' }],
      }).success,
    ).toBe(false);
  });
  it('renders continuous, dotted and dashed lines and lets a dotted tank explicitly become continuous', () => {
    const line: DrawingElement = {
      id: 'a',
      type: 'line',
      x1: 200,
      y1: 200,
      x2: 400,
      y2: 200,
      strokeColor: '#1764C0',
      strokeWidth: 2,
    };
    for (const [strokeStyle, dash] of [
      ['solid', undefined],
      ['dotted', '0.1 5'],
      ['dashed', '8 4'],
    ] as const) {
      const svg = drawingSvg({ ...newDrawingData(), elements: [{ ...line, strokeStyle }] }, []);
      if (dash) expect(svg).toContain(`stroke-dasharray="${dash}"`);
      else expect(svg).not.toContain('stroke-dasharray');
    }
    const tank: DrawingElement = {
      id: 'tank',
      type: 'symbol',
      symbolCode: 'isometric-tank',
      x: 400,
      y: 400,
      rotation: 0,
    };
    expect(drawingStrokeStyle(tank)).toBe('dotted');
    expect(drawingStrokeColor(tank)).toBe('#285580');
    expect(
      drawingSvg(
        {
          ...newDrawingData(),
          elements: [{ ...tank, strokeStyle: 'solid', strokeColor: '#16725B' }],
        },
        [],
      ),
    ).not.toContain('stroke-dasharray');
    expect(
      drawingSvg(
        {
          ...newDrawingData(),
          elements: [{ ...tank, strokeStyle: 'solid', strokeColor: '#16725B' }],
        },
        [],
      ),
    ).toContain('stroke="#16725B"');
  });
});
