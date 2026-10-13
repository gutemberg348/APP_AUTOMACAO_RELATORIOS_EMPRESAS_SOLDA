import { describe, expect, it } from 'vitest';
import {
  fitSignatureStrokes,
  signatureStrokePath,
  signatureDrawingSchema,
} from '@weldcosta/shared';
import { shouldApplyReportSnapshot } from '../../../app/features/reports/report-snapshot';

describe('Signature canvas and report editing', () => {
  it('fits tall phone strokes into the stored image without stretching or cutting them', () => {
    const input = [
      [
        { x: 100, y: 400 },
        { x: 300, y: 1200 },
        { x: 700, y: 600 },
      ],
    ];
    const fitted = fitSignatureStrokes(input);
    expect(signatureDrawingSchema.safeParse({ strokes: fitted }).success).toBe(true);
    const scaleX = (fitted[0]![2]!.x - fitted[0]![0]!.x) / 600;
    const scaleY = (fitted[0]![1]!.y - fitted[0]![0]!.y) / 800;
    expect(scaleX).toBeCloseTo(scaleY);
    expect(fitted[0]![1]!.y).toBeLessThan(500);
    expect(input[0]![1]!.y).toBe(1200);
    expect(fitSignatureStrokes([])).toEqual([]);
  });
  it('keeps endpoints and smooths middle samples with numeric paths', () => {
    expect(
      signatureStrokePath([
        { x: 10, y: 20 },
        { x: 30, y: 40 },
        { x: 50, y: 10 },
      ]),
    ).toBe('M10 20 Q30 40 40 25 L50 10');
    expect(signatureStrokePath([{ x: 10, y: 20 }])).toBe('');
  });
  it('preserves unsaved markers on background refresh and accepts the explicit save response', () => {
    expect(shouldApplyReportSnapshot(undefined, 'report:1', false)).toBe(true);
    expect(shouldApplyReportSnapshot('report:1', 'report:1', true)).toBe(false);
    expect(shouldApplyReportSnapshot('report:1', 'report:2', true)).toBe(false);
    expect(shouldApplyReportSnapshot('report:1', 'report:2', true, 'report:2')).toBe(true);
    expect(shouldApplyReportSnapshot('report:1', 'report:2', false)).toBe(true);
  });
});
