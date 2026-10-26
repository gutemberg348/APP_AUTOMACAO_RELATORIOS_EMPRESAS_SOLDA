import { describe, expect, it } from 'vitest';
import {
  drawingDataSchema,
  drawingSvg,
  drawingSymbols,
  drawingSymbolPreview,
  drawingSelectionBounds,
  hitElement,
  newDrawingData,
  selectDrawingLasso,
  transformDrawingSelection,
  type DrawingElement,
} from '@weldcosta/shared';

describe('Isometric tank and valve actuator symbols', () => {
  it('accepts the new symbols and renders complete geometry with the reference line styles', () => {
    for (const code of ['isometric-tank', 'actuated-valve', 'valve-actuator'] as const) {
      const data = drawingDataSchema.parse({
        ...newDrawingData(),
        elements: [
          {
            id: code,
            type: 'symbol',
            symbolCode: code,
            x: 500,
            y: 400,
            rotation: 0,
            scale: 2,
            strokeWidth: 1.2,
          },
        ],
      });
      const svg = drawingSvg(data, []);
      expect(svg).toContain(drawingSymbols.find((s) => s.code === code)!.path);
      expect(svg).toContain('scale(2)');
      expect(drawingSymbolPreview(code, '#112233')).toContain('viewBox=');
      if (code === 'isometric-tank') expect(svg).toContain('stroke-dasharray="1 3"');
      if (code === 'actuated-valve') {
        expect(svg).toContain('M0-7V-45');
        expect(svg).toContain('stroke="#285580"');
      }
    }
  });
  it('selects the top of tall components and uses their full footprint for lasso and rotation', () => {
    const tank: DrawingElement = {
      id: 'tank',
      type: 'symbol',
      symbolCode: 'isometric-tank',
      x: 500,
      y: 400,
      rotation: 0,
      scale: 2,
    };
    expect(hitElement([tank], { x: 500, y: 235 })?.id).toBe('tank');
    expect(hitElement([tank], { x: 600, y: 400 })).toBeUndefined();
    expect(drawingSelectionBounds([tank])).toMatchObject({
      x: 436,
      y: 220,
      width: 128,
      height: 360,
    });
    expect(
      selectDrawingLasso(
        [tank],
        [
          { x: 400, y: 300 },
          { x: 600, y: 300 },
          { x: 600, y: 500 },
          { x: 400, y: 500 },
        ],
      ),
    ).toEqual([]);
    expect(
      selectDrawingLasso(
        [tank],
        [
          { x: 400, y: 200 },
          { x: 600, y: 200 },
          { x: 600, y: 600 },
          { x: 400, y: 600 },
        ],
      ),
    ).toEqual(['tank']);
    const rotated = transformDrawingSelection([tank], 90);
    expect(drawingSelectionBounds(rotated)).toMatchObject({ center: { x: 500, y: 400 } });
    expect(drawingSelectionBounds(rotated).width).toBeCloseTo(360);
    expect(hitElement(rotated, { x: 665, y: 400 })?.id).toBe('tank');
    expect(drawingDataSchema.safeParse({ ...newDrawingData(), elements: rotated }).success).toBe(
      true,
    );
  });
});
