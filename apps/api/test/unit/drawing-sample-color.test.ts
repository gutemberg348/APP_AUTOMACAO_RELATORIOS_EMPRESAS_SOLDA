import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { sampleDrawingPng } from '../../../app/features/reports/drawing-sample-color';

describe('Drawing eyedropper pixels', () => {
  it.each([1, 2, 3])('reads the same displayed position at pixel density %s', async (scale) => {
    const png = await sharp(
      Buffer.from(`<svg width="${350 * scale}" height="${280 * scale}" viewBox="0 0 350 280" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 0H175V140H0Z" fill="#123456"/>
      <path d="M175 0H350V140H175Z" fill="#DC2626"/>
      <path d="M0 140H175V280H0Z" fill="#21AC84"/>
      <path d="M175 140H350V280H175Z" fill="#EAB308"/>
    </svg>`),
    )
      .png()
      .toBuffer();
    expect(sampleDrawingPng(png, 0.2, 0.2)).toBe('#123456');
    expect(sampleDrawingPng(png, 0.8, 0.2)).toBe('#DC2626');
    expect(sampleDrawingPng(png, 0.2, 0.8)).toBe('#21AC84');
    expect(sampleDrawingPng(png, 0.8, 0.8)).toBe('#EAB308');
    expect(sampleDrawingPng(png, 1, 1)).toBe('#EAB308');
  });
  it('composites transparency against the white preview and rejects invalid coordinates', async () => {
    const png = await sharp({
      create: { width: 5, height: 5, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.5 } },
    })
      .png()
      .toBuffer();
    expect(sampleDrawingPng(png, 0.5, 0.5)).toBe('#7F7F7F');
    expect(() => sampleDrawingPng(png, NaN, 0.5)).toThrow('Posição inválida');
  });
});
