import { describe, it, expect } from 'vitest';
import {
  drawingDataSchema,
  drawingSvg,
  newDrawingData,
  nextPointNumber,
  snapPosition,
  constrainPosition,
  hitElement,
  moveElement,
  type DrawingElement,
  removePointFromDrawings,
} from '@weldcosta/shared';
describe('Technical drawing geometry and safe rendering', () => {
  it('keeps an independent numbered marker when removing a point and preserves its geometry in PDF', () => {
    const point = { id: 'point-01', number: '01', data: { acceptable: true } };
    const drawings = [
      {
        data: {
          ...newDrawingData(),
          elements: [
            { id: 'line', type: 'line' as const, x1: 10, y1: 20, x2: 400, y2: 300 },
            {
              id: 'mark',
              type: 'point' as const,
              reportPointId: point.id,
              x: 200,
              y: 250,
              labelX: 240,
              labelY: 210,
            },
          ],
        },
      },
    ];
    const kept = removePointFromDrawings(drawings, point, true);
    const data = drawingDataSchema.parse(kept[0]!.data);
    expect(data.elements[1]).toMatchObject({
      type: 'marker',
      number: '01',
      x: 200,
      y: 250,
      labelX: 240,
      labelY: 210,
    });
    expect(data.elements[1]).not.toHaveProperty('reportPointId');
    const svg = drawingSvg(data, []);
    expect(svg).toContain('>01</text>');
    expect(svg).toContain('#16725B');
    expect(hitElement(data.elements, { x: 240, y: 210 })?.id).toBe('mark');
    expect(moveElement(data.elements[1]!, 10, 20)).toMatchObject({
      x: 210,
      y: 270,
      labelX: 250,
      labelY: 230,
    });
    expect(removePointFromDrawings(drawings, point, false)[0]!.data.elements).toHaveLength(1);
    expect(drawings[0]!.data.elements[1]!.type).toBe('point');
  });
  it('aligns the isometric lattice and constrains segments to the three axes', () => {
    const a = snapPosition({ x: 213, y: 311 }, 'isometric');
    expect(a.x / (20 * Math.sqrt(3))).toBeCloseTo(Math.round(a.x / (20 * Math.sqrt(3))));
    const end = constrainPosition({ x: 500, y: 470 }, a, 'isometric');
    const angle = Math.abs((Math.atan2(end.y - a.y, end.x - a.x) * 180) / Math.PI);
    expect([30, 90, 150].some((n) => Math.abs(angle - n) < 0.001)).toBe(true);
    expect(snapPosition({ x: 103, y: 196 }, 'orthogonal')).toEqual({ x: 100, y: 200 });
  });
  it('moves geometry without distorting it at the sheet boundary and selects by distance', () => {
    const line: DrawingElement = { id: 'l', type: 'line', x1: 100, y1: 100, x2: 300, y2: 200 };
    expect(moveElement(line, -500, -500)).toMatchObject({ x1: 0, y1: 0, x2: 200, y2: 100 });
    expect(hitElement([line], { x: 200, y: 155 })?.id).toBe('l');
    expect(hitElement([line], { x: 500, y: 500 })).toBeUndefined();
    const dimension: DrawingElement = {
      id: 'd',
      type: 'dimension',
      x1: 100,
      y1: 100,
      x2: 300,
      y2: 100,
      offset: 50,
      text: '200 mm',
    };
    expect(hitElement([dimension], { x: 200, y: 150 })?.id).toBe('d');
    expect(hitElement([dimension], { x: 200, y: 100 })).toBeUndefined();
    const point: DrawingElement = {
      id: 'p',
      type: 'point',
      reportPointId: 'point',
      x: 200,
      y: 200,
      labelX: 230,
      labelY: 170,
    };
    expect(moveElement(point, 10, 20)).toMatchObject({ x: 210, y: 220, labelX: 240, labelY: 190 });
  });
  it('continues from the last manual identifier and skips numbers already used', () => {
    expect(
      nextPointNumber([{ number: '01' }, { number: '2' }, { number: 'S-03' }, { number: '04' }]),
    ).toBe('05');
    expect(nextPointNumber([])).toBe('1');
    expect(nextPointNumber([{ number: '10' }])).toBe('11');
    expect(nextPointNumber([{ number: 'S-09' }])).toBe('S-10');
    expect(nextPointNumber([{ number: '03' }, { number: '1' }, { number: '02' }])).toBe('04');
    expect(nextPointNumber([{ number: 's-02' }, { number: 'S-01' }])).toBe('S-03');
  });
  it('renders and selects multiline rotated text and the isometric components', () => {
    const text: DrawingElement = {
      id: 'caption',
      type: 'text',
      text: 'TQ\nÁGUA & <IONIZADA>',
      x: 300,
      y: 300,
      rotation: 90,
      size: 20,
    };
    const symbol: DrawingElement = {
      id: 'v',
      type: 'symbol',
      symbolCode: 'ball-valve',
      x: 500,
      y: 400,
      rotation: 30,
      scale: 2,
    };
    const data = drawingDataSchema.parse({ ...newDrawingData(), elements: [text, symbol] });
    const svg = drawingSvg(data, []);
    expect(svg).toContain('rotate(90 300 300)');
    expect(svg).toContain('dy="25"');
    expect(svg).toContain('ÁGUA &amp; &lt;IONIZADA&gt;');
    expect(svg).toContain('rotate(30) scale(2)');
    expect(hitElement([text], { x: 280, y: 400 })?.id).toBe('caption');
    expect(hitElement([symbol], { x: 550, y: 400 })?.id).toBe('v');
  });
  it('rejects unsupported shapes, invalid coordinates, repeated ids and repeated markers', () => {
    const d = newDrawingData();
    expect(
      drawingDataSchema.safeParse({
        ...d,
        elements: [{ id: 'x', type: 'html', html: '<script/>' }],
      }).success,
    ).toBe(false);
    const e = { id: 'p', type: 'point', reportPointId: 'p1', x: 200, y: 200 };
    expect(drawingDataSchema.safeParse({ ...d, elements: [{ ...e, y: 900 }] }).success).toBe(false);
    expect(drawingDataSchema.safeParse({ ...d, elements: [e, e] }).success).toBe(false);
    expect(drawingDataSchema.safeParse({ ...d, elements: [e, { ...e, id: 'q' }] }).success).toBe(
      false,
    );
  });
  it('escapes labels and resolves the current point number in the same SVG used for PDF', () => {
    const data = drawingDataSchema.parse({
      ...newDrawingData(),
      elements: [
        { id: 't', type: 'text', text: '<script> & "caption"', x: 10, y: 20 },
        { id: 'p', type: 'point', reportPointId: 'key', x: 100, y: 100 },
      ],
    });
    const svg = drawingSvg(data, [{ id: 'key', number: 'S-42', data: { acceptable: false } }]);
    expect(svg).toContain('S-42');
    expect(svg).toContain('#AF302B');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).not.toContain('<script>');
    expect(drawingSvg(data, [{ id: 'key', number: 'S-43' }])).toContain('S-43');
  });
});
