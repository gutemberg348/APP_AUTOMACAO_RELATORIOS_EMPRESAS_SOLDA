import { describe, expect, it } from 'vitest';
import {
  drawingDataSchema,
  drawingSvg,
  newDrawingData,
  drawingReductionLabel,
  positionDrawingReductionLabel,
  isDrawingReduction,
  moveElement,
  transformDrawingElement,
  drawingSelectionBounds,
  selectDrawingLasso,
  hitElement,
  type DrawingSymbol,
} from '@weldcosta/shared';
import { cleanReportDraft } from '../../../app/features/reports/report-draft-clean';

const fixture = (symbolCode = 'iso-reducer-1'): DrawingSymbol => ({
  id: 'reduction',
  type: 'symbol',
  symbolCode,
  x: 500,
  y: 400,
  rotation: 0,
  scale: 1,
  reduction: { inlet: '2', outlet: '4', labelSize: 18 },
});

describe('Attached reduction dimensions', () => {
  it.each(['reducer', ...Array.from({ length: 8 }, (_, i) => 'iso-reducer-' + (i + 1))])(
    'supports %s and preserves both dimensions through saving and reopening',
    (code) => {
      const e = fixture(code);
      const data = drawingDataSchema.parse(
        JSON.parse(JSON.stringify({ ...newDrawingData(), elements: [e] })),
      );
      expect(data.elements[0]).toEqual(e);
      expect(isDrawingReduction(e)).toBe(true);
      const label = drawingReductionLabel(e)!;
      expect(label.text).toBe('2 × 4');
      expect(label.y).toBeGreaterThan(e.y);
      expect(drawingSvg(data, [])).toContain('>2 × 4</text>');
    },
  );
  it('keeps old symbols unchanged and never prints an incomplete dimension', () => {
    const old = { ...fixture(), reduction: undefined };
    expect(drawingDataSchema.safeParse({ ...newDrawingData(), elements: [old] }).success).toBe(
      true,
    );
    expect(drawingReductionLabel(old)).toBeUndefined();
    expect(
      drawingReductionLabel({ ...fixture(), reduction: { inlet: '2', outlet: '' } }),
    ).toBeUndefined();
    expect(drawingReductionLabel(fixture('valve'))).toBeUndefined();
    const pending = drawingDataSchema.parse(
      cleanReportDraft({
        ...newDrawingData(),
        elements: [{ ...fixture(), reduction: { inlet: '2', outlet: '', labelSize: 20 } }],
      }),
    );
    expect(pending.elements[0]).toMatchObject({
      reduction: { inlet: '2', outlet: '', labelSize: 20 },
    });
  });
  it('moves only the label around the symbol and retains its position across object transforms', () => {
    const original = fixture();
    const positioned = positionDrawingReductionLabel(original, { x: 560, y: 380 });
    expect(positioned).toMatchObject({ x: 500, y: 400, reduction: { labelX: 60, labelY: -20 } });
    expect(original.reduction?.labelX).toBeUndefined();
    const moved = moveElement(positioned, 20, 40) as DrawingSymbol;
    expect(drawingReductionLabel(moved)).toMatchObject({ x: 580, y: 420 });
    const rotated = transformDrawingElement(positioned, 90) as DrawingSymbol;
    expect(drawingReductionLabel(rotated)!.x).toBeCloseTo(520);
    expect(drawingReductionLabel(rotated)!.y).toBeCloseTo(460);
    const scaled = transformDrawingElement(positioned, 0, 0, 0, 2) as DrawingSymbol;
    expect(drawingReductionLabel(scaled)).toMatchObject({ x: 620, y: 360, size: 36 });
    expect(drawingDataSchema.safeParse({ ...newDrawingData(), elements: [scaled] }).success).toBe(
      true,
    );
  });
  it('converts dragging on rotated/scaled components correctly and limits distance', () => {
    const e = { ...fixture(), rotation: 90, scale: 2 };
    const placed = positionDrawingReductionLabel(e, { x: 540, y: 460 });
    expect(drawingReductionLabel(placed)!.x).toBeCloseTo(540);
    expect(drawingReductionLabel(placed)!.y).toBeCloseTo(460);
    const far = positionDrawingReductionLabel(e, { x: 9000, y: 9000 });
    expect(Math.hypot(far.reduction!.labelX!, far.reduction!.labelY!)).toBeCloseTo(160);
  });
  it('includes the label in hit testing and lasso bounds and escapes user input', () => {
    const e = positionDrawingReductionLabel(fixture(), { x: 620, y: 400 });
    const label = drawingReductionLabel(e)!;
    expect(hitElement([e], { x: label.x, y: label.y }, 1)?.id).toBe(e.id);
    const bounds = drawingSelectionBounds([e]);
    expect(bounds.x + bounds.width).toBeGreaterThanOrEqual(label.left + label.width);
    const selectionSvg = drawingSvg({ ...newDrawingData(), elements: [e] }, [], {
      selectedId: e.id,
      selectionFrame: true,
    });
    expect(selectionSvg).toContain(
      `d="M${bounds.x - 8} ${bounds.y - 8} L${bounds.x + bounds.width + 8}`,
    );
    expect(
      selectDrawingLasso(
        [e],
        [
          { x: 450, y: 330 },
          { x: 550, y: 330 },
          { x: 550, y: 470 },
          { x: 450, y: 470 },
        ],
      ),
    ).toEqual([]);
    const svg = drawingSvg(
      {
        ...newDrawingData(),
        elements: [
          {
            ...e,
            strokeColor: '#C2185B',
            reduction: { ...e.reduction!, inlet: '<2"', outlet: '4"' },
          },
        ],
      },
      [],
    );
    expect(svg).toContain('&lt;2&quot; × 4&quot;');
    expect(svg).toContain('fill="#C2185B"');
  });
});
