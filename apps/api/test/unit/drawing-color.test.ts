import { expect, it } from 'vitest';
import { colorHSV, hsvColor } from '../../../app/features/reports/drawing-color';
it('converts visual picker colors back to the saved color without changing existing colors', () => {
  for (const color of [
    '#1764C0',
    '#FF0000',
    '#00FF00',
    '#0000FF',
    '#FFFFFF',
    '#000000',
    '#64748B',
    '#123456',
  ])
    expect(hsvColor(colorHSV(color))).toBe(color);
  expect(hsvColor({ h: 180, s: 1, v: 1 })).toBe('#00FFFF');
  expect(hsvColor({ h: 180, s: 0, v: 1 })).toBe('#FFFFFF');
  expect(hsvColor({ h: 90, s: 1, v: 0 })).toBe('#000000');
});
