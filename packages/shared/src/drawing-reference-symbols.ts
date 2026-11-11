import type { DrawingSymbolDefinition } from './drawing-symbols';

// Reference library paths use absolute M/L/C commands so every orientation has
// its own geometry. Rendering, hit testing and PDF export share the same bounds.
function orient(path: string, angle: number, mirror = false) {
  const a = (angle * Math.PI) / 180;
  return path.replace(/([MLCZ])([^MLCZ]*)/g, (_, command: string, coordinates: string) => {
    const values = coordinates.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    return (
      command +
      values
        .map((_, i) => {
          if (i % 2) return '';
          const x = values[i]! * (mirror ? -1 : 1),
            y = values[i + 1]!;
          const n = (value: number) => Number(value.toFixed(3));
          return `${n(x * Math.cos(a) - y * Math.sin(a))} ${n(x * Math.sin(a) + y * Math.cos(a))}`;
        })
        .filter(Boolean)
        .join(' ')
    );
  });
}

function variants<const Code extends string>(
  code: Code,
  name: string,
  path: string,
  count: 4 | 6 | 8,
  fillPath = '',
) {
  return Array.from({ length: count }, (_, index) => {
    let angle =
      count === 6 ? index * 60 : count === 4 ? Math.floor(index / 2) * 90 : (index % 4) * 90;
    let mirror = count === 4 ? index % 2 === 1 : count === 8 && index >= 4;
    if (code === 'iso-cap' || code === 'iso-flow') {
      angle = [0, 180, 0, 180, 60, 240, 120, 300][index]!;
      mirror = [false, false, true, true, false, false, true, true][index]!;
    }
    const geometry = orient(path, angle, mirror);
    const filled = orient(fillPath, angle, mirror);
    const pairs = (geometry + ' ' + filled).match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    const xs = pairs.filter((_, i) => i % 2 === 0),
      ys = pairs.filter((_, i) => i % 2 === 1);
    const x = Math.min(...xs),
      y = Math.min(...ys);
    return {
      code: `${code}-${index + 1}` as const,
      name: `${name} · ${index + 1}`,
      family: name,
      path: geometry,
      fillPath: filled || undefined,
      bounds: {
        x: x - 2,
        y: y - 2,
        width: Math.max(...xs) - x + 4,
        height: Math.max(...ys) - y + 4,
      },
      defaultRotation: 0,
      defaultScale: 1,
      defaultStrokeWidth: 1.2,
    } satisfies DrawingSymbolDefinition;
  });
}

const oval = 'M-5-7C2-13 10-3 5 7C-2 13-10 3-5-7Z';
const flange = 'M-24-48L24-20L24-25L-24-53Z';
const lowerFlange = 'M-24 20L24 48L24 53L-24 25Z';
const body = 'M-24-40L24-12L-24 12L24 40Z';

export const referenceDrawingSymbols = [
  ...variants(
    'iso-reducer',
    'Redução isométrica',
    'M-28-14L28-30L28-4L-28 44Z M-38 22L-28 16 M28-17L38-23',
    8,
  ),
  ...variants(
    'iso-cap',
    'Cap isométrico',
    'M10-40C-32-64-36 4 10 48Z',
    8,
    'M10-8C21-5 21 9 10 10Z',
  ),
  ...variants('blind-flange', 'Flange cego', 'M-3-28L-3 28 M3-28L3 28', 6, 'M3-5C12-3 12 7 3 8Z'),
  ...variants(
    'iso-flow',
    'Sentido de fluxo isométrico',
    'M-28-20L30-24L-28 40Z M-28-8L30-24 M-28 4L30-24 M-28 16L30-24 M-28 28L30-24',
    8,
  ),
  ...variants(
    'globe-valve',
    'Válvula globo',
    `${flange} ${lowerFlange} M-70-40L-24-40L24-12L-24 12L24 40Z M-70-40L24-12 M-24-40L24 40 M-70-50L-70-30`,
    4,
    oval,
  ),
  ...variants(
    'flow-meter',
    'Medidor de vazão',
    `${flange} ${lowerFlange} M-25-24L-25 18 M25 24L25-18 M-25 0L-48-13L-48-39L-28-27L-28-1 M0-15L0-42 M0 15L0 42`,
    4,
    'M-4-33C-9-45 4-43 4-35C4-29-1-28-4-33Z M-4 33C-9 21 4 23 4 31C4 37-1 38-4 33Z',
  ),
  ...variants(
    'iso-ball-valve',
    'Válvula esfera isométrica',
    `${body} ${oval} M-8-4L-48-27L-48 0`,
    4,
  ),
  ...variants(
    'check-valve',
    'Válvula retenção',
    `${flange} ${lowerFlange} M-30-21L30 21 M0-15L0-32 M0 15L0 32`,
    4,
    'M-30-21L-13-11L-22-5Z M-4-26C-9-38 4-36 4-28C4-22-1-21-4-26Z M-4 29C-9 17 4 19 4 27C4 33-1 34-4 29Z',
  ),
  ...variants(
    'butterfly-valve',
    'Válvula borboleta',
    `${flange} ${lowerFlange} M-30-21L30 21 M0-15L0-32 M0 15L0 32 ${oval}`,
    4,
    'M-4-26C-9-38 4-36 4-28C4-22-1-21-4-26Z M-4 29C-9 17 4 19 4 27C4 33-1 34-4 29Z',
  ),
  ...variants(
    'weld-mark',
    'Marca de solda',
    'M0-36L0 36',
    6,
    'M-5-9C-14-16 14-16 5-9C14 16-14 16-5-9Z',
  ),
  ...variants(
    'flanged-end',
    'Junta flangeada isométrica',
    'M0 36L0 0 M-20-12L-20 12L20-12L20-36 M-13-13L13-28',
    6,
  ),
  ...variants(
    'loop-end',
    'Terminação em laço',
    'M0 36L0 0C0-12 22-12 16-3C12 3-4 0-5-8C-5-18-18-18-20-12',
    6,
  ),
];
