import { describe, it, expect } from 'vitest';
import { render as renderEvs } from '../../src/modules/pdf/templates/reports/evs';
import { drawings as renderReferenceDrawings } from '../../src/modules/pdf/templates/reports/reference-layout';
import type { PdfReport } from '../../src/modules/pdf/templates/reports/layout';
import {
  drawingDataSchema,
  drawingSvg,
  drawingPointLabel,
  newDrawingData,
  nextPointNumber,
  snapPosition,
  constrainPosition,
  hitElement,
  moveElement,
  transformDrawingElement,
  moveHatchCorner,
  transformHatch,
  triangleHatchSegments,
  type DrawingElement,
  removePointFromDrawings,
} from '@weldcosta/shared';
describe('Technical drawing geometry and safe rendering', () => {
  it('resizes selections proportionally, enforces size limits and preserves inspection data', () => {
    const symbol: DrawingElement = {
      id: 'valve',
      type: 'symbol',
      x: 400,
      y: 300,
      symbolCode: 'valve',
      scale: 2,
      rotation: 30,
    };
    expect(transformDrawingElement(symbol, 60, 10, 20, 0.5)).toMatchObject({
      id: 'valve',
      x: 410,
      y: 320,
      rotation: 90,
      scale: 1,
    });
    expect(transformDrawingElement(symbol, 0, 0, 0, 0.01)).toMatchObject({ scale: 0.5 });
    expect(transformDrawingElement(symbol, 0, 0, 0, 100)).toMatchObject({ scale: 3 });
    const text: DrawingElement = {
      id: 'text',
      type: 'text',
      text: 'ÁGUA',
      x: 300,
      y: 300,
      size: 20,
    };
    expect(transformDrawingElement(text, 0, 0, 0, 0.5)).toMatchObject({ text: 'ÁGUA', size: 10 });
    expect(transformDrawingElement(text, 0, 0, 0, 10)).toMatchObject({ size: 40 });
    const dimension: DrawingElement = {
      id: 'dim',
      type: 'dimension',
      x1: 100,
      y1: 100,
      x2: 300,
      y2: 100,
      text: '200 mm',
      offset: 35,
      strokeWidth: 4,
    };
    expect(transformDrawingElement(dimension, 0, 0, 0, 0.5)).toEqual({
      ...dimension,
      x1: 150,
      x2: 250,
    });
    const point: DrawingElement = {
      id: 'point',
      type: 'point',
      x: 200,
      y: 300,
      reportPointId: 'weld-7',
    };
    expect(transformDrawingElement(point, 90, 0, 0, 0.1)).toEqual(point);
    for (const factor of [NaN, Infinity, 0, -1]) {
      expect(transformDrawingElement(symbol, 0, 0, 0, factor)).toBe(symbol);
    }
    expect(symbol.scale).toBe(2);
  });
  it('keeps resized closed shapes valid at page and minimum size limits', () => {
    const shape: DrawingElement = {
      id: 'shape',
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 0 },
      ],
      hatch: { spacing: 12, angle: 0 },
    };
    for (const factor of [0.001, 0.5, 2, 100]) {
      const result = transformDrawingElement(shape, 30, -100, -100, factor);
      expect(result.type).toBe('polyline');
      if (result.type !== 'polyline') continue;
      expect(result.points[0]).toEqual(result.points.at(-1));
      expect(drawingDataSchema.safeParse({ ...newDrawingData(), elements: [result] }).success).toBe(
        true,
      );
    }
  });
  it('rotates and moves selected elements without changing their identity or size', () => {
    const line: DrawingElement = {
      id: 'line',
      type: 'line',
      x1: 100,
      y1: 100,
      x2: 300,
      y2: 100,
      strokeWidth: 4,
    };
    expect(transformDrawingElement(line, 90, 20, 50)).toMatchObject({
      id: 'line',
      x1: 220,
      y1: 50,
      x2: 220,
      y2: 250,
      strokeWidth: 4,
    });
    const text: DrawingElement = {
      id: 'text',
      type: 'text',
      text: 'TQ',
      x: 400,
      y: 300,
      rotation: 170,
      size: 24,
    };
    expect(transformDrawingElement(text, 40, 15, -20)).toMatchObject({
      x: 415,
      y: 280,
      rotation: -150,
      text: 'TQ',
      size: 24,
    });
    const point: DrawingElement = {
      id: 'point',
      type: 'point',
      reportPointId: 'weld-7',
      x: 990,
      y: 790,
    };
    expect(transformDrawingElement(point, 90, 500, 500)).toMatchObject({
      reportPointId: 'weld-7',
      x: 1000,
      y: 800,
    });
    expect(line.x1).toBe(100);
  });
  it('keeps rotated hatches closed and in bounds, and rejects rotations too large for the page', () => {
    const hatch: DrawingElement = {
      id: 'triangle',
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 0, y: 100 },
        { x: 0, y: 0 },
      ],
      hatch: { spacing: 12, angle: 170 },
    };
    const rotated = transformDrawingElement(hatch, 45, -100, -100);
    expect(rotated.type).toBe('polyline');
    if (rotated.type !== 'polyline') return;
    expect(rotated.points[0]).toEqual(rotated.points.at(-1));
    expect(rotated.hatch).toEqual({ spacing: 12, angle: -145 });
    expect(drawingDataSchema.safeParse({ ...newDrawingData(), elements: [rotated] }).success).toBe(
      true,
    );
    const wide: DrawingElement = { id: 'wide', type: 'line', x1: 0, y1: 400, x2: 1000, y2: 400 };
    expect(transformDrawingElement(wide, 90)).toEqual(wide);
  });
  it('keeps selection transparency and moving outlines out of saved drawings and PDFs', () => {
    const elements: DrawingElement[] = [
      { id: 'line', type: 'line', x1: 100, y1: 100, x2: 250, y2: 150 },
      { id: 'text', type: 'text', x: 300, y: 200, text: 'TQ\nÁGUA', size: 24, rotation: 30 },
      { id: 'symbol', type: 'symbol', x: 400, y: 300, symbolCode: 'valve', scale: 2, rotation: 90 },
      { id: 'point', type: 'point', reportPointId: 'p1', x: 950, y: 400 },
      { id: 'marker', type: 'marker', number: '99', x: 300, y: 450 },
      {
        id: 'dim',
        type: 'dimension',
        x1: 200,
        y1: 500,
        x2: 400,
        y2: 500,
        text: '200 mm',
        offset: 35,
      },
      {
        id: 'shape',
        type: 'polyline',
        points: [
          { x: 500, y: 100 },
          { x: 650, y: 100 },
          { x: 600, y: 300 },
          { x: 500, y: 100 },
        ],
        hatch: { spacing: 18, angle: 90 },
      },
    ];
    for (const element of elements) {
      const data = { ...newDrawingData(), elements: [element] };
      const original = JSON.stringify(data);
      const points = [{ id: 'p1', number: '12345' }];
      const normal = drawingSvg(data, points);
      const selected = drawingSvg(data, points, {
        selectedId: element.id,
        selectionFrame: true,
        selectionOpacity: 0.25,
      });
      expect(selected).toContain('<g opacity="0.25">');
      expect(selected).toContain('data-selection-frame="true"');
      expect(selected).not.toContain('NaN');
      expect(selected).not.toContain('Infinity');
      const moved = drawingSvg({ ...data, elements: [moveElement(element, -20, 10)] }, points, {
        selectedId: element.id,
        selectionFrame: true,
      });
      expect(moved).not.toEqual(selected);
      expect(JSON.stringify(data)).toBe(original);
      expect(drawingSvg(data, points)).toBe(normal);
      expect(normal).not.toContain('data-selection-frame');
      expect(normal).not.toContain('<g opacity=');
    }
  });
  it('clips triangular hatching, resizes and rotates it while preserving closure and PDF data', () => {
    const triangle: DrawingElement = {
      id: 'h',
      type: 'polyline',
      points: [
        { x: 100, y: 100 },
        { x: 400, y: 100 },
        { x: 100, y: 400 },
        { x: 100, y: 100 },
      ],
      hatch: { spacing: 20, angle: 90 },
      strokeWidth: 4,
    };
    const segments = triangleHatchSegments(triangle.points, 20, 90);
    expect(segments.length).toBeGreaterThan(5);
    for (const { a, b } of segments)
      for (const p of [a, b]) {
        expect(p.x).toBeGreaterThanOrEqual(99.999);
        expect(p.y).toBeGreaterThanOrEqual(99.999);
        expect(p.x + p.y).toBeLessThanOrEqual(500.001);
      }
    const changed = moveHatchCorner(triangle, 0, -50, 20);
    expect(changed).toMatchObject({
      points: [
        { x: 50, y: 120 },
        { x: 400, y: 100 },
        { x: 100, y: 400 },
        { x: 50, y: 120 },
      ],
    });
    expect(moveHatchCorner(triangle, 0, 150, 150)).toEqual(triangle); // Collapsed triangle rejected.
    for (const e of [
      changed,
      transformHatch(triangle, 1.5, 0.7, 30),
      transformHatch(triangle, -1, 1),
    ]) {
      const data = drawingDataSchema.parse(
        JSON.parse(JSON.stringify({ ...newDrawingData(), grid: 'none', elements: [e] })),
      );
      const shape = data.elements[0];
      expect(shape?.type).toBe('polyline');
      if (shape?.type === 'polyline') expect(shape.points[0]).toEqual(shape.points[3]);
      const svg = drawingSvg(data, []);
      expect(svg).toContain('<polyline');
      expect(svg).toContain('<line');
      expect(svg).not.toContain('NaN');
      expect(svg).not.toContain('<pattern');
      expect(hitElement([triangle], { x: 160, y: 160 })?.id).toBe('h');
    }
    expect(
      drawingDataSchema.safeParse({
        ...newDrawingData(),
        elements: [{ ...triangle, points: triangle.points.slice(0, 3) }],
      }).success,
    ).toBe(false);
    expect(
      drawingDataSchema.safeParse({
        ...newDrawingData(),
        elements: [{ ...triangle, hatch: { spacing: 0, angle: 90 } }],
      }).success,
    ).toBe(false);
  });
  it('prints each annotation below its own drawing in the report, escaping user text', () => {
    const report = {
      number: 'QA-01',
      reportDate: new Date('2026-10-18'),
      title: 'Inspection',
      specificData: {},
      project: { name: 'Test' },
      reportType: { name: 'EVS' },
      points: [],
      signatures: [],
      media: [],
      drawings: [
        { data: { ...newDrawingData(), title: 'Drawing A', notes: 'NOTE_A <script> & test' } },
        { data: { ...newDrawingData(), title: 'Drawing B', notes: 'NOTE_B' } },
      ],
    } as unknown as PdfReport;
    for (const render of [renderEvs, renderReferenceDrawings]) {
      const html = render(report, new Map());
      const sheets = html.split('<article').filter((part) => part.includes('class="evs-drawing"'));
      expect(sheets).toHaveLength(2);
      expect(sheets[0]).toContain('NOTE_A &lt;script&gt; &amp; test');
      expect(sheets[0]).not.toContain('NOTE_B');
      expect(sheets[1]).toContain('NOTE_B');
      expect(sheets[1]).not.toContain('NOTE_A');
      expect(sheets[0]!.indexOf('NOTE_A')).toBeGreaterThan(sheets[0]!.indexOf('</svg>'));
    }
  });
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
    expect(hitElement(data.elements, { x: 220, y: 250 })?.id).toBe('mark');
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
  it('renders both linked and independent points as only a dot and adjacent number, including legacy labels', () => {
    const data = drawingDataSchema.parse({
      ...newDrawingData(),
      grid: 'none',
      elements: [
        { id: 'p', type: 'point', reportPointId: 'key', x: 100, y: 200, labelX: 800, labelY: 600 },
        { id: 'm', type: 'marker', number: '42', x: 995, y: 795 },
      ],
    });
    const svg = drawingSvg(data, [{ id: 'key', number: '01' }]);
    expect(svg).not.toContain('<path');
    expect(svg.match(/<rect/g)).toHaveLength(1); // Only the white sheet, no label boxes.
    expect(svg).toContain('<text x="112" y="206" text-anchor="start"');
    expect(svg).toContain('<text x="983" y="796" text-anchor="end"');
    expect(svg).toContain('>01</text>');
    expect(svg).toContain('>42</text>');
    expect(drawingPointLabel({ x: 5, y: 0 }, '01').y).toBe(18);
    expect(hitElement(data.elements, { x: 800, y: 600 })).toBeUndefined();
    expect(hitElement(data.elements, { x: 970, y: 790 })?.id).toBe('m');
  });
  it('persists stroke widths through parsing and moving, without changing the preview thickness on selection', () => {
    const data = drawingDataSchema.parse({
      ...newDrawingData(),
      grid: 'none',
      elements: [
        { id: 'l', type: 'line', x1: 50, y1: 50, x2: 200, y2: 200, strokeWidth: 8 },
        {
          id: 'p',
          type: 'polyline',
          points: [
            { x: 20, y: 40 },
            { x: 80, y: 90 },
          ],
          strokeWidth: 0.5,
        },
        {
          id: 's',
          type: 'symbol',
          symbolCode: 'valve',
          x: 400,
          y: 400,
          rotation: 0,
          strokeWidth: 6,
        },
        {
          id: 'd',
          type: 'dimension',
          x1: 50,
          y1: 500,
          x2: 200,
          y2: 500,
          text: '100 mm',
          strokeWidth: 3,
        },
        { id: 'old', type: 'line', x1: 50, y1: 600, x2: 200, y2: 600 },
      ],
    });
    const restored = drawingDataSchema.parse(JSON.parse(JSON.stringify(data)));
    expect(moveElement(restored.elements[0]!, 10, 20)).toMatchObject({ strokeWidth: 8 });
    for (const selectedId of [undefined, 'l']) {
      const svg = drawingSvg(restored, [], { selectedId });
      for (const width of [8, 0.5, 6, 3, 2.6]) expect(svg).toContain(`stroke-width="${width}"`);
    }
    for (const width of [0, -1, 13, Infinity]) {
      expect(
        drawingDataSchema.safeParse({
          ...data,
          elements: [{ ...data.elements[0], strokeWidth: width }],
        }).success,
      ).toBe(false);
    }
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
