import { z } from 'zod';

export const drawingWidth = 1000;
export const drawingHeight = 800;
const coord = z.number().finite().min(0).max(1000);
const xy = { x: coord, y: z.number().finite().min(0).max(drawingHeight) };
const id = z.string().min(1).max(100);
export const drawingSymbols = [
  { code: 'valve', name: 'Válvula', path: 'M-22-13 22 13V-13L-22 13Z M0 0V-28 M-10-28H10' },
  { code: 'flange', name: 'Flange', path: 'M-6-20V20 M6-20V20 M-24 0H-6 M6 0H24' },
  { code: 'reducer', name: 'Redução', path: 'M-24-15 24-7V7L-24 15Z' },
  {
    code: 'support',
    name: 'Suporte',
    path: 'M0-18V12 M-20 12H20 M-15 12-23 22 M0 12-8 22 M15 12 7 22',
  },
  {
    code: 'pump',
    name: 'Bomba',
    path: 'M0-22A22 22 0 1 0 0 22A22 22 0 1 0 0-22 M-12-12 15 0-12 12Z M-30 0H-22 M22 0H35',
  },
  {
    code: 'tank',
    name: 'Tanque',
    path: 'M-30-30Q0-45 30-30V30Q0 45-30 30Z M-30-30Q0-15 30-30 M-30 30Q0 15 30 30',
  },
  { code: 'flow', name: 'Sentido de fluxo', path: 'M-25 0H25 M12-12 25 0 12 12' },
  {
    code: 'ball-valve',
    name: 'Válvula de esfera',
    path: 'M-22-14 22 14V-14L-22 14Z M-27-18V18 M27-18V18 M-7 0A7 7 0 1 0 7 0A7 7 0 1 0-7 0 M0-14V-32H20',
  },
  { code: 'tee', name: 'Conexão em T', path: 'M-30 0H30 M0 0V-30 M-30-7V7 M30-7V7 M-7-30H7' },
  { code: 'elbow', name: 'Curva / cotovelo', path: 'M-30 0H-10Q0 0 0-10V-30 M-30-7V7 M-7-30H7' },
  { code: 'cap', name: 'Tampão', path: 'M-30 0H0 M0-20V20 M7-15Q25 0 7 15' },
  {
    code: 'union',
    name: 'União',
    path: 'M-30 0H-13 M13 0H30 M-13-14H13V14H-13Z M-6-14V14 M6-14V14',
  },
] as const;
const line = { x1: coord, y1: xy.y, x2: coord, y2: xy.y };
const strokeWidth = z.number().finite().min(0.5).max(12).optional();
export const drawingElementSchema = z.discriminatedUnion('type', [
  z.object({ id, type: z.literal('line'), ...line, strokeWidth }).strict(),
  z
    .object({
      id,
      type: z.literal('polyline'),
      strokeWidth,
      points: z.array(z.object(xy).strict()).min(2).max(300),
      hatch: z
        .object({
          spacing: z.number().finite().min(6).max(80),
          angle: z.number().finite().min(-180).max(180),
        })
        .strict()
        .optional(),
    })
    .strict(),
  z
    .object({
      id,
      type: z.literal('point'),
      reportPointId: id,
      ...xy,
      labelX: coord.optional(),
      labelY: xy.y.optional(),
    })
    .strict(),
  z
    .object({
      id,
      type: z.literal('marker'),
      number: z.string().trim().min(1).max(100),
      ...xy,
      labelX: coord.optional(),
      labelY: xy.y.optional(),
      acceptable: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      id,
      type: z.literal('text'),
      text: z.string().min(1).max(300),
      ...xy,
      size: z.number().min(10).max(40).optional(),
      rotation: z.number().finite().min(-360).max(360).optional(),
    })
    .strict(),
  z
    .object({
      id,
      type: z.literal('symbol'),
      strokeWidth,
      symbolCode: z.enum(drawingSymbols.map((symbol) => symbol.code)),
      ...xy,
      rotation: z.number().finite().min(-360).max(360),
      scale: z.number().finite().min(0.5).max(3).optional(),
    })
    .strict(),
  z
    .object({
      id,
      type: z.literal('dimension'),
      strokeWidth,
      ...line,
      text: z.string().min(1).max(100),
      offset: z.number().min(-150).max(150).default(35),
    })
    .strict(),
]);
export const drawingDataSchema = z
  .object({
    schemaVersion: z.literal(1),
    title: z.string().max(150).default('Croqui de inspeção'),
    revision: z.string().max(30).default('00'),
    grid: z.enum(['isometric', 'orthogonal', 'none']).default('isometric'),
    notes: z.string().max(2000).default(''),
    elements: z.array(drawingElementSchema).max(600),
  })
  .strict()
  .superRefine((data, ctx) => {
    for (const [index, e] of data.elements.entries()) {
      if (
        e.type === 'polyline' &&
        e.hatch &&
        (e.points.length !== 4 ||
          e.points[0]!.x !== e.points[3]!.x ||
          e.points[0]!.y !== e.points[3]!.y)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['elements', index, 'hatch'],
          message: 'Feche os três cantos da hachura triangular.',
        });
    }
    if (new Set(data.elements.map((e) => e.id)).size !== data.elements.length)
      ctx.addIssue({
        code: 'custom',
        path: ['elements'],
        message: 'Há elementos com identificação repetida no desenho.',
      });
    const points = data.elements.flatMap((e) => (e.type === 'point' ? [e.reportPointId] : []));
    if (new Set(points).size !== points.length)
      ctx.addIssue({
        code: 'custom',
        path: ['elements'],
        message: 'Cada ponto pode aparecer uma vez por prancha.',
      });
  });
export const reportDrawingSchema = z
  .object({ id: z.uuid().optional(), data: drawingDataSchema })
  .strict();
export type DrawingElement = z.infer<typeof drawingElementSchema>;
export function hasDrawingStroke(
  element: DrawingElement,
): element is Extract<DrawingElement, { type: 'line' | 'polyline' | 'symbol' | 'dimension' }> {
  return ['line', 'polyline', 'symbol', 'dimension'].includes(element.type);
}
export const drawingStrokeWidth = (element: DrawingElement) =>
  hasDrawingStroke(element)
    ? (element.strokeWidth ?? (element.type === 'dimension' ? 1.2 : 2.6))
    : 2.6;

// Old label coordinates remain readable, but all point numbers now sit next to their dot.
export function drawingPointLabel(position: DrawingPosition, number = '000') {
  const width = Math.max(12, number.length * 11);
  const onLeft = position.x + 12 + width > drawingWidth - 4;
  return {
    x: position.x + (onLeft ? -12 : 12),
    y: Math.max(18, Math.min(drawingHeight - 4, position.y + 6)),
    anchor: onLeft ? 'end' : 'start',
    width,
  };
}
export type DrawingData = z.infer<typeof drawingDataSchema>;
export type ReportDrawing = z.infer<typeof reportDrawingSchema>;
export type DrawingPosition = { x: number; y: number };
export type DrawingPoint = {
  id?: string;
  clientId?: string;
  number: string;
  data?: { acceptable?: boolean };
};
export const newDrawingData = (): DrawingData => ({
  schemaVersion: 1,
  title: 'Croqui de inspeção',
  revision: '00',
  grid: 'isometric',
  notes: '',
  elements: [],
});
export const drawingId = () =>
  'local-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
export const pointKey = (point: DrawingPoint) => point.id ?? point.clientId ?? '';
export function removePointFromDrawings(
  drawings: ReportDrawing[],
  point: DrawingPoint,
  keepInDrawing: boolean,
) {
  return drawings.map((drawing) => ({
    ...drawing,
    data: {
      ...drawing.data,
      elements: drawing.data.elements.flatMap((element): DrawingElement[] => {
        if (element.type !== 'point' || element.reportPointId !== pointKey(point)) return [element];
        return keepInDrawing
          ? [
              {
                id: element.id,
                type: 'marker',
                number: point.number.trim() || '?',
                x: element.x,
                y: element.y,
                labelX: element.labelX,
                labelY: element.labelY,
                ...(typeof point.data?.acceptable === 'boolean'
                  ? { acceptable: point.data.acceptable }
                  : {}),
              },
            ]
          : [];
      }),
    },
  }));
}
export function nextPointNumber(points: { number: string }[]) {
  const last = points
    .at(-1)
    ?.number.trim()
    .match(/^(.*?)(\d+)$/);
  const prefix = last?.[1] ?? '';
  const width = last?.[2]?.length ?? 1;
  let n = last ? BigInt(last[2]!) + 1n : 1n;
  const used = new Set(points.map((p) => p.number.trim().toLocaleUpperCase()));
  const equivalent = new Set(
    points.flatMap((p) => {
      const match = p.number.trim().match(/^(.*?)(\d+)$/);
      return match ? [match[1]!.toLocaleUpperCase() + BigInt(match[2]!).toString()] : [];
    }),
  );
  while (
    used.has((prefix + n.toString().padStart(width, '0')).toLocaleUpperCase()) ||
    equivalent.has(prefix.toLocaleUpperCase() + n.toString())
  )
    n++;
  return prefix + n.toString().padStart(width, '0');
}
export function clampPosition(p: DrawingPosition): DrawingPosition {
  return {
    x: Math.max(0, Math.min(drawingWidth, p.x)),
    y: Math.max(0, Math.min(drawingHeight, p.y)),
  };
}
export function snapPosition(p: DrawingPosition, grid: DrawingData['grid']): DrawingPosition {
  if (grid === 'none') return clampPosition(p);
  if (grid === 'orthogonal')
    return clampPosition({ x: Math.round(p.x / 20) * 20, y: Math.round(p.y / 20) * 20 });
  const dx = 20 * Math.sqrt(3),
    col = Math.round(p.x / dx);
  return clampPosition({ x: col * dx, y: Math.round((p.y - col * 20) / 40) * 40 + col * 20 });
}
export function constrainPosition(
  p: DrawingPosition,
  start: DrawingPosition,
  grid: DrawingData['grid'],
): DrawingPosition {
  if (grid === 'none') return clampPosition(p);
  const angles =
    grid === 'isometric' ? [Math.PI / 6, Math.PI / 2, (5 * Math.PI) / 6] : [0, Math.PI / 2];
  const dx = p.x - start.x,
    dy = p.y - start.y;
  const candidates = angles.map((a) => {
    const len = dx * Math.cos(a) + dy * Math.sin(a);
    return { x: start.x + Math.cos(a) * len, y: start.y + Math.sin(a) * len };
  });
  candidates.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
  const best = candidates[0]!,
    vx = best.x - start.x,
    vy = best.y - start.y;
  const scale = Math.min(
    1,
    vx > 0 ? (drawingWidth - start.x) / vx : vx < 0 ? -start.x / vx : 1,
    vy > 0 ? (drawingHeight - start.y) / vy : vy < 0 ? -start.y / vy : 1,
  );
  return { x: start.x + vx * scale, y: start.y + vy * scale };
}
const distance = (p: DrawingPosition, a: DrawingPosition, b: DrawingPosition) => {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
export function hitElement(
  elements: DrawingElement[],
  p: DrawingPosition,
  tolerance = 18,
  points: DrawingPoint[] = [],
) {
  return [...elements].reverse().find((e) => {
    if (e.type === 'dimension') {
      const length = Math.hypot(e.x2 - e.x1, e.y2 - e.y1) || 1;
      const dx = (-(e.y2 - e.y1) / length) * e.offset,
        dy = ((e.x2 - e.x1) / length) * e.offset;
      return (
        distance(p, { x: e.x1 + dx, y: e.y1 + dy }, { x: e.x2 + dx, y: e.y2 + dy }) < tolerance
      );
    }
    if (e.type === 'line')
      return distance(p, { x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }) < tolerance;
    if (e.type === 'polyline') {
      if (e.points.slice(1).some((b, i) => distance(p, e.points[i]!, b) < tolerance)) return true;
      const first = e.points[0]!,
        last = e.points.at(-1)!;
      if (e.points.length < 4 || first.x !== last.x || first.y !== last.y) return false;
      let inside = false;
      for (let i = 0, j = e.points.length - 1; i < e.points.length; j = i++) {
        const a = e.points[i]!,
          b = e.points[j]!;
        if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
          inside = !inside;
      }
      return inside;
    }
    if (e.type === 'point' || e.type === 'marker') {
      const number =
        e.type === 'marker'
          ? e.number
          : points.find((point) => pointKey(point) === e.reportPointId)?.number;
      const label = drawingPointLabel(e, number);
      const left = label.anchor === 'end' ? label.x - label.width : label.x;
      if (
        p.x >= left - tolerance &&
        p.x <= left + label.width + tolerance &&
        p.y >= label.y - 18 - tolerance &&
        p.y <= label.y + tolerance
      )
        return true;
    }
    if (e.type === 'text') {
      const angle = ((e.rotation ?? 0) * Math.PI) / 180;
      const dx = p.x - e.x,
        dy = p.y - e.y;
      const x = dx * Math.cos(angle) + dy * Math.sin(angle),
        y = -dx * Math.sin(angle) + dy * Math.cos(angle);
      const lines = e.text.split(/\r?\n/),
        size = e.size ?? 20;
      return (
        x >= -tolerance &&
        x <= Math.max(...lines.map((line) => line.length)) * size * 0.55 + tolerance &&
        y >= -size - tolerance &&
        y <= (lines.length - 1) * size * 1.25 + tolerance
      );
    }
    if (e.type === 'symbol')
      return Math.hypot(e.x - p.x, e.y - p.y) < 35 * (e.scale ?? 1) + tolerance;
    return Math.hypot(e.x - p.x, e.y - p.y) < tolerance + 10;
  });
}
export function moveElement(e: DrawingElement, dx: number, dy: number): DrawingElement {
  const coords =
    e.type === 'line' || e.type === 'dimension'
      ? [
          { x: e.x1, y: e.y1 },
          { x: e.x2, y: e.y2 },
        ]
      : e.type === 'polyline'
        ? e.points
        : [{ x: e.x, y: e.y }];
  dx = Math.max(
    -Math.min(...coords.map((p) => p.x)),
    Math.min(drawingWidth - Math.max(...coords.map((p) => p.x)), dx),
  );
  dy = Math.max(
    -Math.min(...coords.map((p) => p.y)),
    Math.min(drawingHeight - Math.max(...coords.map((p) => p.y)), dy),
  );
  if (e.type === 'line' || e.type === 'dimension')
    return { ...e, x1: e.x1 + dx, y1: e.y1 + dy, x2: e.x2 + dx, y2: e.y2 + dy };
  if (e.type === 'polyline')
    return { ...e, points: e.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
  return {
    ...e,
    x: e.x + dx,
    y: e.y + dy,
    ...((e.type === 'point' || e.type === 'marker') &&
    e.labelX !== undefined &&
    e.labelY !== undefined
      ? {
          labelX: clampPosition({ x: e.labelX + dx, y: e.labelY + dy }).x,
          labelY: clampPosition({ x: e.labelX + dx, y: e.labelY + dy }).y,
        }
      : {}),
  };
}
export function moveHatchCorner(
  e: DrawingElement,
  index: number,
  dx: number,
  dy: number,
): DrawingElement {
  if (e.type !== 'polyline' || !e.hatch || index < 0 || index > 2) return e;
  const corners = e.points
    .slice(0, 3)
    .map((p, i) => (i === index ? clampPosition({ x: p.x + dx, y: p.y + dy }) : p));
  const [a, b, c] = corners as [DrawingPosition, DrawingPosition, DrawingPosition];
  if (Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) < 20) return e;
  return { ...e, points: [...corners, corners[0]!] };
}
export function transformHatch(
  e: DrawingElement,
  scaleX = 1,
  scaleY = 1,
  angle = 0,
): DrawingElement {
  if (e.type !== 'polyline' || !e.hatch) return e;
  const corners = e.points.slice(0, 3),
    cx = corners.reduce((sum, p) => sum + p.x, 0) / 3,
    cy = corners.reduce((sum, p) => sum + p.y, 0) / 3;
  const radians = (angle * Math.PI) / 180;
  const next = corners.map((p) => {
    const x = (p.x - cx) * scaleX,
      y = (p.y - cy) * scaleY;
    return {
      x: cx + x * Math.cos(radians) - y * Math.sin(radians),
      y: cy + x * Math.sin(radians) + y * Math.cos(radians),
    };
  });
  const minX = Math.min(...next.map((p) => p.x)),
    maxX = Math.max(...next.map((p) => p.x));
  const minY = Math.min(...next.map((p) => p.y)),
    maxY = Math.max(...next.map((p) => p.y));
  if (
    maxX - minX > drawingWidth ||
    maxY - minY > drawingHeight ||
    maxX - minX < 2 ||
    maxY - minY < 2
  )
    return e;
  const dx = Math.max(0, -minX) - Math.max(0, maxX - drawingWidth),
    dy = Math.max(0, -minY) - Math.max(0, maxY - drawingHeight);
  const shifted = next.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  return {
    ...e,
    points: [...shifted, shifted[0]!],
    hatch: { ...e.hatch, angle: ((e.hatch.angle + angle + 540) % 360) - 180 },
  };
}
const esc = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const num = (v: number) => Number(v.toFixed(3));
// Explicit clipped segments work identically in native SVG and PDF rendering.
export function triangleHatchSegments(points: DrawingPosition[], spacing: number, angle: number) {
  const radians = (angle * Math.PI) / 180,
    ux = Math.cos(radians),
    uy = Math.sin(radians);
  const normal = (p: DrawingPosition) => -uy * p.x + ux * p.y;
  const vertices = points.slice(0, 3),
    levels = vertices.map(normal);
  const result: { a: DrawingPosition; b: DrawingPosition }[] = [];
  for (
    let level = Math.ceil(Math.min(...levels) / spacing) * spacing;
    level < Math.max(...levels);
    level += Math.max(6, spacing)
  ) {
    const hits: DrawingPosition[] = [];
    for (let i = 0; i < 3; i++) {
      const a = vertices[i]!,
        b = vertices[(i + 1) % 3]!,
        na = normal(a),
        nb = normal(b);
      if (Math.abs(nb - na) < 0.00001) continue;
      const t = (level - na) / (nb - na);
      if (t >= 0 && t < 1) hits.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
    if (hits.length === 2) result.push({ a: hits[0]!, b: hits[1]! });
  }
  return result;
}
export function drawingSvg(
  data: DrawingData,
  points: DrawingPoint[],
  options: {
    selectedId?: string;
    viewBox?: string;
    showGrid?: boolean;
    selectionOpacity?: number;
    selectionFrame?: boolean;
  } = {},
) {
  const grid = data.grid ?? 'isometric';
  let body = '<rect width="1000" height="800" fill="#fff"/>';
  if (options.showGrid !== false && grid !== 'none') {
    let d = '';
    if (grid === 'orthogonal') {
      for (let x = 0; x <= 1000; x += 20) d += `M${x} 0V800 `;
      for (let y = 0; y <= 800; y += 20) d += `M0 ${y}H1000 `;
    } else {
      const dx = 20 * Math.sqrt(3);
      for (let x = 0; x <= 1000; x += dx) d += `M${num(x)} 0V800 `;
      for (let y = -600; y <= 1400; y += 40)
        d += `M0 ${y}l1000 ${num(1000 / Math.sqrt(3))} M0 ${y}l1000 ${num(-1000 / Math.sqrt(3))} `;
    }
    body += `<path d="${d}" stroke="#E4EAF2" stroke-width=".7" fill="none"/>`;
  }
  let selectionOverlay = '';
  for (const e of data.elements) {
    const selected = options.selectedId === e.id,
      color = selected ? '#1764C0' : '#263D52';
    if (selected && options.selectionFrame) {
      const opacity = Number.isFinite(options.selectionOpacity)
        ? Math.max(0.2, Math.min(1, options.selectionOpacity!))
        : 0.5;
      body += `<g opacity="${opacity}">`;
      let positions: DrawingPosition[];
      let transform = '';
      if (e.type === 'polyline') positions = e.points;
      else if (e.type === 'line' || e.type === 'dimension') {
        positions = [
          { x: e.x1, y: e.y1 },
          { x: e.x2, y: e.y2 },
        ];
        if (e.type === 'dimension') {
          const length = Math.hypot(e.x2 - e.x1, e.y2 - e.y1) || 1;
          const dx = (-(e.y2 - e.y1) / length) * e.offset,
            dy = ((e.x2 - e.x1) / length) * e.offset;
          positions.push(
            { x: e.x1 + dx, y: e.y1 + dy },
            { x: e.x2 + dx, y: e.y2 + dy },
            { x: (e.x1 + e.x2) / 2 + dx - e.text.length * 5, y: (e.y1 + e.y2) / 2 + dy - 26 },
            { x: (e.x1 + e.x2) / 2 + dx + e.text.length * 5, y: (e.y1 + e.y2) / 2 + dy },
          );
        }
      } else if (e.type === 'text') {
        const lines = e.text.split(/\r?\n/),
          size = e.size ?? 20;
        positions = [
          { x: e.x, y: e.y - size },
          {
            x: e.x + Math.max(...lines.map((line) => line.length)) * size * 0.65,
            y: e.y + (lines.length - 1) * size * 1.25 + size * 0.2,
          },
        ];
        transform = ` transform="rotate(${e.rotation ?? 0} ${e.x} ${e.y})"`;
      } else if (e.type === 'symbol') {
        const radius = 35 * (e.scale ?? 1);
        positions = [
          { x: e.x - radius, y: e.y - radius },
          { x: e.x + radius, y: e.y + radius },
        ];
        transform = ` transform="rotate(${e.rotation} ${e.x} ${e.y})"`;
      } else {
        const number =
          e.type === 'marker'
            ? e.number
            : points.find((point) => pointKey(point) === e.reportPointId)?.number;
        const label = drawingPointLabel(e, number);
        positions = [
          { x: e.x - 5, y: e.y - 5 },
          { x: e.x + 5, y: e.y + 5 },
          { x: label.anchor === 'end' ? label.x - label.width : label.x, y: label.y - 18 },
          { x: label.anchor === 'end' ? label.x : label.x + label.width, y: label.y + 3 },
        ];
      }
      const x = Math.min(...positions.map((p) => p.x)) - 8,
        y = Math.min(...positions.map((p) => p.y)) - 8;
      const width = Math.max(...positions.map((p) => p.x)) - x + 8,
        height = Math.max(...positions.map((p) => p.y)) - y + 8;
      selectionOverlay = `<rect data-selection-frame="true" x="${num(x)}" y="${num(y)}" width="${num(width)}" height="${num(height)}" rx="4"${transform} fill="#1764C0" fill-opacity="0.06" stroke="#1764C0" stroke-width="1.5" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
    }
    const stroke = `stroke="${color}" stroke-width="${drawingStrokeWidth(e)}" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
    if (e.type === 'line')
      body += `<line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" ${stroke}/>`;
    if (e.type === 'polyline')
      body += `<polyline points="${e.points.map((p) => p.x + ',' + p.y).join(' ')}" ${stroke}/>`;
    if (e.type === 'polyline' && e.hatch)
      body += triangleHatchSegments(e.points, e.hatch.spacing, e.hatch.angle)
        .map(
          ({ a, b }) =>
            `<line x1="${num(a.x)}" y1="${num(a.y)}" x2="${num(b.x)}" y2="${num(b.y)}" stroke="${color}" stroke-width="${Math.max(0.5, drawingStrokeWidth(e) * 0.45)}"/>`,
        )
        .join('');
    if (selected && e.type === 'polyline' && e.hatch)
      body += e.points
        .slice(0, 3)
        .map(
          (p) =>
            `<circle cx="${p.x}" cy="${p.y}" r="8" fill="white" stroke="#1764C0" stroke-width="2"/>`,
        )
        .join('');
    if (e.type === 'symbol')
      body += `<path d="${drawingSymbols.find((s) => s.code === e.symbolCode)?.path ?? ''}" transform="translate(${e.x} ${e.y}) rotate(${e.rotation}) scale(${e.scale ?? 1})" ${stroke}/>`;
    if (e.type === 'text')
      body += `<text x="${e.x}" y="${e.y}" transform="rotate(${e.rotation ?? 0} ${e.x} ${e.y})" font-family="Arial" font-size="${e.size ?? 20}" fill="${selected ? '#1764C0' : '#285580'}">${e.text
        .split(/\r?\n/)
        .map(
          (line, i) =>
            `<tspan x="${e.x}" dy="${i ? (e.size ?? 20) * 1.25 : 0}">${esc(line)}</tspan>`,
        )
        .join('')}</text>`;
    if (e.type === 'dimension') {
      const len = Math.hypot(e.x2 - e.x1, e.y2 - e.y1) || 1,
        nx = -(e.y2 - e.y1) / len,
        ny = (e.x2 - e.x1) / len,
        ox = nx * e.offset,
        oy = ny * e.offset;
      const a = { x: e.x1 + ox, y: e.y1 + oy },
        b = { x: e.x2 + ox, y: e.y2 + oy };
      body += `<path d="M${e.x1} ${e.y1}L${a.x + nx * 8} ${a.y + ny * 8} M${e.x2} ${e.y2}L${b.x + nx * 8} ${b.y + ny * 8} M${a.x} ${a.y}L${b.x} ${b.y} M${a.x - 6} ${a.y - 6}l12 12 M${b.x - 6} ${b.y - 6}l12 12" ${stroke}/>`;
      body += `<text x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2 - 8}" text-anchor="middle" font-family="Arial" font-size="18" fill="${color}" stroke="white" stroke-width="4" paint-order="stroke">${esc(e.text)}</text>`;
    }
    if (e.type === 'point' || e.type === 'marker') {
      const point =
          e.type === 'point' ? points.find((p) => pointKey(p) === e.reportPointId) : undefined,
        number = e.type === 'marker' ? e.number : point?.number || '?',
        status = e.type === 'marker' ? e.acceptable : point?.data?.acceptable;
      const { x, y, anchor } = drawingPointLabel(e, number);
      const tone = selected
        ? '#1764C0'
        : status === false
          ? '#AF302B'
          : status === true
            ? '#16725B'
            : '#1764C0';
      body += `<circle cx="${e.x}" cy="${e.y}" r="5" fill="${tone}"/><text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Arial" font-size="18" font-weight="bold" fill="${tone}">${esc(number)}</text>`;
    }
    if (selected && options.selectionFrame) body += '</g>';
    if (selected && (e.type === 'line' || e.type === 'dimension'))
      for (const p of [
        { x: e.x1, y: e.y1 },
        { x: e.x2, y: e.y2 },
      ])
        body += `<circle cx="${p.x}" cy="${p.y}" r="5" fill="white" stroke="#1764C0" stroke-width="2"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${options.viewBox ?? '0 0 1000 800'}" width="100%" height="100%">${body}${selectionOverlay}</svg>`;
}
