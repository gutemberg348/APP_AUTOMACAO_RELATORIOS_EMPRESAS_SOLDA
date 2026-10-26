import { z } from 'zod';
import { drawingSymbols, drawingSymbolDefinition } from './drawing-symbols';
export { drawingSymbols, drawingSymbolDefinition, drawingSymbolPreview } from './drawing-symbols';
import { drawingOrderedElements } from './drawing-professional';
import { drawingSelectionBounds, transformDrawingSelection } from './drawing-selection';

export const drawingWidth = 1000;
export const drawingHeight = 800;
const coord = z.number().finite().min(0).max(1000);
const xy = { x: coord, y: z.number().finite().min(0).max(drawingHeight) };
const id = z.string().min(1).max(100);
const xml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

const elementMeta = {
  groupId: id.optional(),
  layer: z.number().int().min(-10000).max(10000).optional(),
};
const line = { x1: coord, y1: xy.y, x2: coord, y2: xy.y };
const strokeWidth = z.number().finite().min(0.5).max(12).optional();
const strokeAppearance = {
  strokeColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  strokeStyle: z.enum(['solid', 'dotted', 'dashed']).optional(),
};
export const drawingElementSchema = z.discriminatedUnion('type', [
  z
    .object({
      id,
      ...elementMeta,
      type: z.literal('image'),
      locked: z.boolean().optional(),
      mediaKey: id,
      ...xy,
      // Local axes can exceed a page axis after rotation; the transformed
      // footprint determines whether the image fits on the page.
      width: z.number().finite().min(10).max(1281),
      height: z.number().finite().min(10).max(1281),
      rotation: z.number().finite().min(-360).max(360).default(0),
    })
    .strict(),
  z
    .object({
      id,
      ...elementMeta,
      type: z.literal('line'),
      ...line,
      strokeWidth,
      ...strokeAppearance,
    })
    .strict(),
  z
    .object({
      id,
      ...elementMeta,
      type: z.literal('polyline'),
      strokeWidth,
      ...strokeAppearance,
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
      ...elementMeta,
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
      ...elementMeta,
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
      ...elementMeta,
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
      ...elementMeta,
      type: z.literal('symbol'),
      strokeWidth,
      ...strokeAppearance,
      symbolCode: z.enum(drawingSymbols.map((symbol) => symbol.code)),
      ...xy,
      rotation: z.number().finite().min(-360).max(360),
      scale: z.number().finite().min(0.5).max(3).optional(),
    })
    .strict(),
  z
    .object({
      id,
      ...elementMeta,
      type: z.literal('dimension'),
      strokeWidth,
      ...strokeAppearance,
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
export function drawingStrokeColor(element: DrawingElement) {
  return hasDrawingStroke(element)
    ? (element.strokeColor ??
        (element.type === 'symbol'
          ? drawingSymbolDefinition(element.symbolCode).color
          : undefined) ??
        '#263D52')
    : '#263D52';
}
export function drawingStrokeStyle(element: DrawingElement): 'solid' | 'dotted' | 'dashed' {
  return hasDrawingStroke(element)
    ? (element.strokeStyle ??
        (element.type === 'symbol' && drawingSymbolDefinition(element.symbolCode).dash
          ? 'dotted'
          : 'solid'))
    : 'solid';
}
export function drawingStrokeDash(style: 'solid' | 'dotted' | 'dashed', width: number) {
  return style === 'dotted'
    ? `0.1 ${Math.max(3, width * 2.5)}`
    : style === 'dashed'
      ? `${Math.max(8, width * 4)} ${Math.max(4, width * 2)}`
      : '';
}

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
  return drawingOrderedElements(elements)
    .filter((e) => e.type !== 'image' || !e.locked)
    .reverse()
    .find((e) => {
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
      if (e.type === 'symbol' || e.type === 'image') {
        const bounds =
            e.type === 'image'
              ? { x: -e.width / 2, y: -e.height / 2, width: e.width, height: e.height }
              : drawingSymbolDefinition(e.symbolCode).bounds,
          scale = e.type === 'image' ? 1 : (e.scale ?? 1);
        const angle = (e.rotation * Math.PI) / 180,
          dx = p.x - e.x,
          dy = p.y - e.y;
        const x = dx * Math.cos(angle) + dy * Math.sin(angle),
          y = -dx * Math.sin(angle) + dy * Math.cos(angle);
        return (
          x >= bounds.x * scale - tolerance &&
          x <= (bounds.x + bounds.width) * scale + tolerance &&
          y >= bounds.y * scale - tolerance &&
          y <= (bounds.y + bounds.height) * scale + tolerance
        );
      }
      return Math.hypot(e.x - p.x, e.y - p.y) < tolerance + 10;
    });
}
export function moveElement(e: DrawingElement, dx: number, dy: number): DrawingElement {
  if (e.type === 'image') return transformDrawingSelection([e], 0, dx, dy)[0]!;
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
/** Resize and rotate around the element's center, then translate, preserving point links. */
export function transformDrawingElement(
  e: DrawingElement,
  angle: number,
  dx = 0,
  dy = 0,
  scale = 1,
): DrawingElement {
  if (![angle, dx, dy, scale].every(Number.isFinite) || scale <= 0) return e;
  if (e.type === 'image') return transformDrawingSelection([e], angle, dx, dy, scale)[0]!;
  const normalize = (value: number) => ((((value + 180) % 360) + 360) % 360) - 180;
  if (e.type === 'symbol' || e.type === 'text')
    return moveElement(
      {
        ...e,
        rotation: normalize((e.rotation ?? 0) + angle),
        ...(e.type === 'symbol'
          ? { scale: Math.max(0.5, Math.min(3, (e.scale ?? 1) * scale)) }
          : { size: Math.max(10, Math.min(40, (e.size ?? 20) * scale)) }),
      },
      dx,
      dy,
    );
  if (e.type === 'point' || e.type === 'marker') return moveElement(e, dx, dy);
  const positions =
    e.type === 'polyline'
      ? e.points
      : [
          { x: e.x1, y: e.y1 },
          { x: e.x2, y: e.y2 },
        ];
  const cx = (Math.min(...positions.map((p) => p.x)) + Math.max(...positions.map((p) => p.x))) / 2;
  const cy = (Math.min(...positions.map((p) => p.y)) + Math.max(...positions.map((p) => p.y))) / 2;
  const radians = (angle * Math.PI) / 180;
  const span = Math.max(
    Math.max(...positions.map((p) => p.x)) - Math.min(...positions.map((p) => p.x)),
    Math.max(...positions.map((p) => p.y)) - Math.min(...positions.map((p) => p.y)),
  );
  if (span > 0) scale = Math.max(2 / span, scale);
  const rotated = positions.map((p) => ({
    x: cx + scale * ((p.x - cx) * Math.cos(radians) - (p.y - cy) * Math.sin(radians)),
    y: cy + scale * ((p.x - cx) * Math.sin(radians) + (p.y - cy) * Math.cos(radians)),
  }));
  if (
    Math.max(...rotated.map((p) => p.x)) - Math.min(...rotated.map((p) => p.x)) > drawingWidth ||
    Math.max(...rotated.map((p) => p.y)) - Math.min(...rotated.map((p) => p.y)) > drawingHeight
  )
    return moveElement(e, dx, dy);
  const next: DrawingElement =
    e.type === 'polyline'
      ? {
          ...e,
          points: rotated,
          ...(e.hatch ? { hatch: { ...e.hatch, angle: normalize(e.hatch.angle + angle) } } : {}),
        }
      : { ...e, x1: rotated[0]!.x, y1: rotated[0]!.y, x2: rotated[1]!.x, y2: rotated[1]!.y };
  return moveElement(next, dx, dy);
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
    images?: Record<string, string>;
    selectedId?: string;
    viewBox?: string;
    showGrid?: boolean;
    selectionOpacity?: number;
    selectionFrame?: boolean;
    constructionCorners?: DrawingPosition[];
    selectedIds?: string[];
    lasso?: DrawingPosition[];
    rotationControl?: { center: DrawingPosition; handle: DrawingPosition; radius: number };
    endpointRadius?: number;
    resizeHandleRadius?: number;
    anchor?: DrawingPosition;
    anchorRadius?: number;
    snapGuide?: { x?: number; y?: number; anchor?: DrawingPosition };
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
  for (const e of drawingOrderedElements(data.elements)) {
    const selected = options.selectedId === e.id || options.selectedIds?.includes(e.id),
      color =
        hasDrawingStroke(e) && e.strokeColor ? e.strokeColor : selected ? '#1764C0' : '#263D52';
    if (selected && options.selectionFrame && !options.selectedIds?.length) {
      const opacity = Number.isFinite(options.selectionOpacity)
        ? Math.max(0.2, Math.min(1, options.selectionOpacity!))
        : 0.5;
      body += `<g opacity="${opacity}">`;
      let positions: DrawingPosition[];
      let rotation = 0;
      let origin: DrawingPosition = { x: 0, y: 0 };
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
        rotation = e.rotation ?? 0;
        origin = e;
      } else if (e.type === 'symbol' || e.type === 'image') {
        const b =
            e.type === 'image'
              ? { x: -e.width / 2, y: -e.height / 2, width: e.width, height: e.height }
              : drawingSymbolDefinition(e.symbolCode).bounds,
          scale = e.type === 'image' ? 1 : (e.scale ?? 1);
        positions = [
          { x: e.x + b.x * scale, y: e.y + b.y * scale },
          { x: e.x + (b.x + b.width) * scale, y: e.y + (b.y + b.height) * scale },
        ];
        rotation = e.rotation;
        origin = e;
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
      // Use page coordinates for every corner, like the drawing geometry.
      // Avoid combining Rect x/y and a pivot transform: native SVG renderers
      // can position that outline differently from the symbol's path.
      const radians = (rotation * Math.PI) / 180;
      const corners = [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
      ].map((p) => ({
        x: origin.x + (p.x - origin.x) * Math.cos(radians) - (p.y - origin.y) * Math.sin(radians),
        y: origin.y + (p.x - origin.x) * Math.sin(radians) + (p.y - origin.y) * Math.cos(radians),
      }));
      const outline =
        corners.map((p, i) => `${i ? 'L' : 'M'}${num(p.x)} ${num(p.y)}`).join(' ') + 'Z';
      selectionOverlay = `<path data-selection-frame="true" d="${outline}" fill="#1764C0" fill-opacity="0.06" stroke="#1764C0" stroke-width="1.5" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
    }
    const dash =
      hasDrawingStroke(e) && e.strokeStyle
        ? drawingStrokeDash(e.strokeStyle, drawingStrokeWidth(e))
        : '';
    const dashAttribute = dash ? ` stroke-dasharray="${dash}"` : '';
    const stroke = `stroke="${color}" stroke-width="${drawingStrokeWidth(e)}" fill="none" stroke-linecap="round" stroke-linejoin="round"${dashAttribute}`;
    if (e.type === 'image') {
      const uri = options.images?.[e.mediaKey];
      const transform = `transform="rotate(${e.rotation} ${e.x} ${e.y})"`;
      body += uri
        ? `<image x="${e.x - e.width / 2}" y="${e.y - e.height / 2}" width="${e.width}" height="${e.height}" ${transform} preserveAspectRatio="xMidYMid meet" href="${xml(uri)}"/>`
        : `<rect x="${e.x - e.width / 2}" y="${e.y - e.height / 2}" width="${e.width}" height="${e.height}" ${transform} fill="#E9EDF2" stroke="#64748B" stroke-dasharray="8 4"/>`;
    }
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
            `<circle cx="${p.x}" cy="${p.y}" r="4" fill="white" stroke="#1764C0" stroke-width="1.5"/>`,
        )
        .join('');
    if (e.type === 'symbol') {
      const definition = drawingSymbolDefinition(e.symbolCode);
      const transform = `transform="translate(${e.x} ${e.y}) rotate(${e.rotation}) scale(${e.scale ?? 1})"`;
      const symbolStroke = `stroke="${e.strokeColor ?? (selected ? '#1764C0' : (definition.color ?? color))}" stroke-width="${drawingStrokeWidth(e)}" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
      body += `<path d="${definition.path}" ${transform} ${symbolStroke}${e.strokeStyle ? dashAttribute : definition.dash ? ` stroke-dasharray="${definition.dash}"` : ''}/>`;
      if (definition.accentPath)
        body += `<path d="${definition.accentPath}" ${transform} stroke="${e.strokeColor ?? (selected ? '#1764C0' : '#285580')}" stroke-width="${drawingStrokeWidth(e)}" fill="none" stroke-linecap="round" stroke-linejoin="round"${dashAttribute}/>`;
    }
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
    if (selected && options.selectionFrame && !options.selectedIds?.length) body += '</g>';
    if (selected && !options.selectedIds?.length && (e.type === 'line' || e.type === 'dimension'))
      for (const p of [
        { x: e.x1, y: e.y1 },
        { x: e.x2, y: e.y2 },
      ])
        body += `<circle cx="${p.x}" cy="${p.y}" r="${options.endpointRadius ?? 5}" fill="white" stroke="#1764C0" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
  }
  const grouped = data.elements.filter((e) => options.selectedIds?.includes(e.id));
  if (grouped.length) {
    const b = drawingSelectionBounds(grouped),
      x = num(b.x - 8),
      y = num(b.y - 8),
      right = num(b.x + b.width + 8),
      bottom = num(b.y + b.height + 8);
    selectionOverlay = `<path data-selection-frame="true" d="M${x} ${y}L${right} ${y}L${right} ${bottom}L${x} ${bottom}Z" fill="#1764C0" fill-opacity="0.06" stroke="#1764C0" stroke-width="1.5" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
    if (options.resizeHandleRadius)
      selectionOverlay += [
        [x, y],
        [right, y],
        [right, bottom],
        [x, bottom],
      ]
        .map(
          ([cx, cy]) =>
            `<circle data-resize-handle="true" cx="${cx}" cy="${cy}" r="${num(options.resizeHandleRadius!)}" fill="white" stroke="#1764C0" stroke-width="2" vector-effect="non-scaling-stroke" pointer-events="none"/>`,
        )
        .join('');
  }
  const lasso = options.lasso?.length
    ? `<path data-lasso="true" d="${options.lasso.map((p, i) => `${i ? 'L' : 'M'}${num(p.x)} ${num(p.y)}`).join(' ')}Z" fill="#1764C0" fill-opacity="0.08" stroke="#1764C0" stroke-width="1.5" stroke-dasharray="5 4" vector-effect="non-scaling-stroke" pointer-events="none"/>`
    : '';
  const control = options.rotationControl;
  const rotationControl = control
    ? `<g pointer-events="none"><path d="M${num(control.center.x)} ${num(control.center.y)}L${num(control.handle.x)} ${num(control.handle.y)}" fill="none" stroke="#1764C0" stroke-opacity="0.45" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/><circle data-rotation-handle="true" cx="${num(control.handle.x)}" cy="${num(control.handle.y)}" r="${num(control.radius)}" fill="white" stroke="#1764C0" stroke-width="2" vector-effect="non-scaling-stroke"/><path d="M${num(control.handle.x - control.radius * 0.45)} ${num(control.handle.y)}A${num(control.radius * 0.45)} ${num(control.radius * 0.45)} 0 1 1 ${num(control.handle.x)} ${num(control.handle.y + control.radius * 0.45)}M${num(control.handle.x - control.radius * 0.45)} ${num(control.handle.y)}l${num(-control.radius * 0.2)} ${num(-control.radius * 0.3)}M${num(control.handle.x - control.radius * 0.45)} ${num(control.handle.y)}l${num(control.radius * 0.3)} ${num(-control.radius * 0.1)}" fill="none" stroke="#1764C0" stroke-width="1.5" vector-effect="non-scaling-stroke"/><circle cx="${num(control.center.x)}" cy="${num(control.center.y)}" r="${num(control.radius * 0.15)}" fill="#1764C0"/></g>`
    : '';
  const construction = (options.constructionCorners ?? [])
    .slice(0, 3)
    .map(
      (p) =>
        `<circle data-construction-corner="true" cx="${num(p.x)}" cy="${num(p.y)}" r="3" fill="#1764C0" stroke="white" stroke-width="1" pointer-events="none"/>`,
    )
    .join('');
  const guide = options.snapGuide;
  const guideSvg = guide
    ? (guide.x !== undefined
        ? '<path d="M' +
          num(guide.x) +
          ' 0V800" stroke="#D97706" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>'
        : '') +
      (guide.y !== undefined
        ? '<path d="M0 ' +
          num(guide.y) +
          'H1000" stroke="#D97706" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>'
        : '')
    : '';
  const anchor = options.anchor
    ? `<circle cx="${num(options.anchor.x)}" cy="${num(options.anchor.y)}" r="${num(options.anchorRadius ?? 3)}" fill="#1764C0" pointer-events="none"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${options.viewBox ?? '0 0 1000 800'}" width="100%" height="100%">${body}${selectionOverlay}${construction}${lasso}${rotationControl}${guideSvg}${anchor}</svg>`;
}
