import { describe, expect, it } from 'vitest';
import { inputScrollOffset } from '../../../app/utils/input-scroll';

describe('Input visibility when the drawing inspector shrinks', () => {
  it.each([160, 300, 560])(
    'reveals a field below the %spx viewport without scrolling visible fields',
    (height) => {
      const viewport = { top: 110, height },
        input = { top: 900, height: 50 },
        offset = 700;
      const next = inputScrollOffset(offset, viewport, input);
      const after = input.top - (next - offset);
      expect(after).toBeGreaterThanOrEqual(viewport.top);
      expect(after + input.height).toBeLessThanOrEqual(viewport.top + height);
      expect(inputScrollOffset(100, viewport, { top: 130, height: 50 })).toBe(100);
    },
  );
  it('scrolls upward for a field hidden above the panel and clamps at the beginning', () => {
    expect(inputScrollOffset(300, { top: 120, height: 240 }, { top: 80, height: 50 })).toBe(248);
    expect(inputScrollOffset(0, { top: 120, height: 240 }, { top: 80, height: 50 })).toBe(0);
  });
  it('fits the input in a short landscape viewport with a keyboard', () => {
    const viewport = { top: 70, height: 54 },
      input = { top: 200, height: 50 },
      offset = 200;
    const next = inputScrollOffset(offset, viewport, input);
    const after = input.top - (next - offset);
    expect(after).toBe(72);
    expect(after + input.height).toBe(122);
    expect(inputScrollOffset(200, { top: 70, height: 0 }, input)).toBe(200);
  });
});
