import { type DrawingElement, type DrawingPosition } from './drawings';
import { drawingSymbolDefinition } from './drawing-symbols';

const rotate = (p: DrawingPosition, center: DrawingPosition, angle: number, scale = 1) => {
  const r = (angle * Math.PI) / 180,
    x = (p.x - center.x) * scale,
    y = (p.y - center.y) * scale;
  return {
    x: center.x + x * Math.cos(r) - y * Math.sin(r),
    y: center.y + x * Math.sin(r) + y * Math.cos(r),
  };
};
export const normalizeDrawingAngle = (angle: number) => ((((angle + 180) % 360) + 360) % 360) - 180;

/** Page-coordinate footprint, shared by the lasso and block transforms. */
export function drawingElementFootprint(e: DrawingElement): DrawingPosition[] {
  if (e.type === 'polyline') return e.points;
  if (e.type === 'line' || e.type === 'dimension') {
    const points = [
      { x: e.x1, y: e.y1 },
      { x: e.x2, y: e.y2 },
    ];
    if (e.type === 'dimension') {
      const length = Math.hypot(e.x2 - e.x1, e.y2 - e.y1) || 1;
      const dx = (-(e.y2 - e.y1) * e.offset) / length,
        dy = ((e.x2 - e.x1) * e.offset) / length;
      return [...points, ...points.map((p) => ({ x: p.x + dx, y: p.y + dy }))];
    }
    return points;
  }
  if (e.type === 'point' || e.type === 'marker') return [{ x: e.x, y: e.y }];
  if (e.type === 'symbol' || e.type === 'image') {
    const b =
        e.type === 'image'
          ? { x: -e.width / 2, y: -e.height / 2, width: e.width, height: e.height }
          : drawingSymbolDefinition(e.symbolCode).bounds,
      s = e.type === 'image' ? 1 : (e.scale ?? 1);
    return [
      { x: b.x, y: b.y },
      { x: b.x + b.width, y: b.y },
      { x: b.x + b.width, y: b.y + b.height },
      { x: b.x, y: b.y + b.height },
      { x: b.x, y: b.y },
    ].map((p) => rotate({ x: e.x + p.x * s, y: e.y + p.y * s }, e, e.rotation));
  }
  const size = e.type === 'text' ? (e.size ?? 20) : 20;
  const lines = e.type === 'text' ? e.text.split(/\r?\n/) : [];
  const x = e.x;
  const y = e.y - size;
  const w = Math.max(...lines.map((l) => l.length)) * size * 0.65;
  const h = size * 1.2 + (lines.length - 1) * size * 1.25;
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
    { x, y },
  ].map((p) => rotate(p, e, e.rotation ?? 0));
}
export function drawingSelectionBounds(elements: DrawingElement[]) {
  const points = elements.flatMap(drawingElementFootprint);
  const x = Math.min(...points.map((p) => p.x)),
    y = Math.min(...points.map((p) => p.y));
  const right = Math.max(...points.map((p) => p.x)),
    bottom = Math.max(...points.map((p) => p.y));
  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
    center: { x: (x + right) / 2, y: (y + bottom) / 2 },
  };
}
export function drawingPolygonContains(p: DrawingPosition, polygon: DrawingPosition[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j]!,
      b = polygon[i]!;
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (
      Math.abs(cross) < 1e-6 &&
      p.x >= Math.min(a.x, b.x) - 1e-6 &&
      p.x <= Math.max(a.x, b.x) + 1e-6 &&
      p.y >= Math.min(a.y, b.y) - 1e-6 &&
      p.y <= Math.max(a.y, b.y) + 1e-6
    )
      return true;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}
export function selectDrawingLasso(elements: DrawingElement[], polygon: DrawingPosition[]) {
  if (polygon.length < 3) return [];
  const area =
    Math.abs(
      polygon.reduce((sum, p, i) => {
        const q = polygon[(i + 1) % polygon.length]!;
        return sum + p.x * q.y - q.x * p.y;
      }, 0),
    ) / 2;
  if (area < 16) return [];
  const cross = (a: DrawingPosition, b: DrawingPosition, c: DrawingPosition) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return elements
    .filter((e) => {
      if (e.type === 'image' && e.locked) return false;
      const points = drawingElementFootprint(e);
      if (!points.every((p) => drawingPolygonContains(p, polygon))) return false;
      // Endpoints alone are not sufficient for a concave lasso.
      return points.slice(1).every((b, i) => {
        const a = points[i]!;
        if (!drawingPolygonContains({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, polygon))
          return false;
        return polygon.every((c, j) => {
          const d = polygon[(j + 1) % polygon.length]!;
          return !(
            cross(a, b, c) * cross(a, b, d) < -1e-8 && cross(c, d, a) * cross(c, d, b) < -1e-8
          );
        });
      });
    })
    .map((e) => e.id);
}

/** One rigid transform for the entire selection, never clamping members independently. */
export function transformDrawingSelection(
  elements: DrawingElement[],
  angle = 0,
  dx = 0,
  dy = 0,
  scale = 1,
  pivot?: DrawingPosition,
): DrawingElement[] {
  if (!elements.length || ![angle, dx, dy, scale].every(Number.isFinite) || scale <= 0)
    return elements;
  if (elements.some((e) => e.type === 'image' && e.locked)) return elements;
  const bounds = drawingSelectionBounds(elements),
    center = pivot ?? bounds.center;
  const minScale = Math.max(
    0.01,
    ...elements.map((e) =>
      e.type === 'image'
        ? Math.max(10 / e.width, 10 / e.height)
        : e.type === 'symbol'
          ? 0.5 / (e.scale ?? 1)
          : e.type === 'text'
            ? 10 / (e.size ?? 20)
            : 0.01,
    ),
  );
  const maxScale = Math.min(
    100,
    ...elements.map((e) =>
      e.type === 'image'
        ? Math.min(1000 / e.width, 800 / e.height)
        : e.type === 'symbol'
          ? 3 / (e.scale ?? 1)
          : e.type === 'text'
            ? 40 / (e.size ?? 20)
            : e.type === 'dimension' && e.offset
              ? 150 / Math.abs(e.offset)
              : 100,
    ),
  );
  scale = Math.max(minScale, Math.min(maxScale, scale));
  const map = (p: DrawingPosition) => rotate(p, center, angle, scale);
  const next: DrawingElement[] = elements.map((e) => {
    if (e.type === 'polyline')
      return {
        ...e,
        points: e.points.map(map),
        ...(e.hatch
          ? { hatch: { ...e.hatch, angle: normalizeDrawingAngle(e.hatch.angle + angle) } }
          : {}),
      };
    if (e.type === 'line' || e.type === 'dimension') {
      const a = map({ x: e.x1, y: e.y1 }),
        b = map({ x: e.x2, y: e.y2 });
      return {
        ...e,
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        ...(e.type === 'dimension' ? { offset: e.offset * scale } : {}),
      };
    }
    const p = map(e);
    if (e.type === 'image')
      return {
        ...e,
        ...p,
        rotation: normalizeDrawingAngle(e.rotation + angle),
        width: e.width * scale,
        height: e.height * scale,
      };
    if (e.type === 'symbol')
      return {
        ...e,
        ...p,
        rotation: normalizeDrawingAngle(e.rotation + angle),
        scale: (e.scale ?? 1) * scale,
      };
    if (e.type === 'text')
      return {
        ...e,
        ...p,
        rotation: normalizeDrawingAngle((e.rotation ?? 0) + angle),
        size: (e.size ?? 20) * scale,
      };
    const label =
      e.labelX !== undefined && e.labelY !== undefined
        ? map({ x: e.labelX, y: e.labelY })
        : undefined;
    return { ...e, ...p, ...(label ? { labelX: label.x, labelY: label.y } : {}) };
  });
  const nextBounds = drawingSelectionBounds(next);
  if (nextBounds.width > 1000 || nextBounds.height > 800) return elements;
  // Rotation in place must not silently translate the selection away from its pivot.
  if (
    angle !== 0 &&
    dx === 0 &&
    dy === 0 &&
    (nextBounds.x < -1e-6 ||
      nextBounds.y < -1e-6 ||
      nextBounds.x + nextBounds.width > 1000 + 1e-6 ||
      nextBounds.y + nextBounds.height > 800 + 1e-6)
  )
    return elements;
  dx = Math.max(-nextBounds.x, Math.min(1000 - nextBounds.x - nextBounds.width, dx));
  dy = Math.max(-nextBounds.y, Math.min(800 - nextBounds.y - nextBounds.height, dy));
  return next.map((e) => {
    if (e.type === 'polyline')
      return { ...e, points: e.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
    if (e.type === 'line' || e.type === 'dimension')
      return { ...e, x1: e.x1 + dx, y1: e.y1 + dy, x2: e.x2 + dx, y2: e.y2 + dy };
    return {
      ...e,
      x: e.x + dx,
      y: e.y + dy,
      ...((e.type === 'point' || e.type === 'marker') &&
      e.labelX !== undefined &&
      e.labelY !== undefined
        ? {
            labelX: Math.max(0, Math.min(1000, e.labelX + dx)),
            labelY: Math.max(0, Math.min(800, e.labelY + dy)),
          }
        : {}),
    };
  });
}
