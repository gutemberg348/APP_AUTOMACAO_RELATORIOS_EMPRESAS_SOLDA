import { decode } from 'fast-png';

export const rgbHex = (rgb: number[]) =>
  '#' +
  rgb
    .map((n) => Math.round(n).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();

// Coordinates are fractions of the displayed preview. The native PNG can have
// more pixels on Retina screens; its actual dimensions are the source of truth.
export function sampleDrawingPng(bytes: Uint8Array, x: number, y: number) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Posição inválida');
  const png = decode(bytes);
  if (png.depth !== 8 || png.channels < 3 || png.palette)
    throw new Error('Formato de prévia inválido');
  const px = Math.max(0, Math.min(png.width - 1, Math.floor(x * png.width)));
  const py = Math.max(0, Math.min(png.height - 1, Math.floor(y * png.height)));
  const offset = (py * png.width + px) * png.channels;
  const alpha = png.channels === 4 ? png.data[offset + 3]! / 255 : 1;
  return rgbHex([0, 1, 2].map((c) => png.data[offset + c]! * alpha + 255 * (1 - alpha)));
}
