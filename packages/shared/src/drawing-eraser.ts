import { drawingStrokeWidth, type DrawingElement, type DrawingPosition } from './drawings';
type Point = DrawingPosition;
type Interval = [number, number];
const mix = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
const same = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;

// Intersections with the entire swept disk (capsule), including fast pointer jumps.
function cuts(a: Point, b: Point, from: Point, to: Point, r: number): Interval[] {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    length2 = dx * dx + dy * dy;
  const found: Interval[] = [];
  if (length2 < 1e-12) return found;
  const add = (lo: number, hi: number) => {
    lo = Math.max(0, lo);
    hi = Math.min(1, hi);
    if (hi - lo > 1e-8) found.push([lo, hi]);
  };
  for (const p of [from, to]) {
    const x = a.x - p.x,
      y = a.y - p.y,
      B = 2 * (x * dx + y * dy),
      C = x * x + y * y - r * r,
      D = B * B - 4 * length2 * C;
    if (D >= 0) add((-B - Math.sqrt(D)) / (2 * length2), (-B + Math.sqrt(D)) / (2 * length2));
  }
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length > 1e-6) {
    const ux = (to.x - from.x) / length,
      uy = (to.y - from.y) / length;
    const x = (a.x - from.x) * ux + (a.y - from.y) * uy,
      y = -(a.x - from.x) * uy + (a.y - from.y) * ux;
    const vx = dx * ux + dy * uy,
      vy = -dx * uy + dy * ux;
    let lo = 0,
      hi = 1;
    for (const [p, v, min, max] of [
      [x, vx, 0, length],
      [y, vy, -r, r],
    ]) {
      if (Math.abs(v!) < 1e-12) {
        if (p! < min! || p! > max!) {
          hi = -1;
          break;
        }
      } else {
        const t1 = (min! - p!) / v!,
          t2 = (max! - p!) / v!;
        lo = Math.max(lo, Math.min(t1, t2));
        hi = Math.min(hi, Math.max(t1, t2));
      }
    }
    add(lo, hi);
  }
  found.sort((x, y) => x[0] - y[0]);
  const merged: Interval[] = [];
  for (const item of found) {
    const last = merged.at(-1);
    if (last && item[0] <= last[1] + 1e-8) last[1] = Math.max(last[1], item[1]);
    else merged.push([...item]);
  }
  return merged;
}

// Flatten only a touched freehand path. Midpoint quadratics match freehandPath;
// adaptive subdivision keeps the visible curve within 0.2 drawing units.
function contour(element: Extract<DrawingElement, { type: 'line' | 'polyline' }>): Point[] {
  if (element.type === 'line')
    return [
      { x: element.x1, y: element.y1 },
      { x: element.x2, y: element.y2 },
    ];
  if (!element.freehand) return element.points;
  const result: Point[] = [element.points[0]!];
  const curve = (a: Point, c: Point, b: Point, depth = 0) => {
    if (depth >= 8 || Math.hypot(a.x - 2 * c.x + b.x, a.y - 2 * c.y + b.y) / 4 <= 0.2) {
      result.push(b);
      return;
    }
    const ac = mix(a, c, 0.5),
      cb = mix(c, b, 0.5),
      mid = mix(ac, cb, 0.5);
    curve(a, ac, mid, depth + 1);
    curve(mid, cb, b, depth + 1);
  };
  for (let i = 1; i < element.points.length; i++)
    curve(
      result.at(-1)!,
      element.points[i - 1]!,
      mix(element.points[i - 1]!, element.points[i]!, 0.5),
    );
  if (!same(result.at(-1)!, element.points.at(-1)!)) result.push(element.points.at(-1)!);
  return result;
}

export function eraseDrawingStrokes(
  elements: DrawingElement[],
  from: Point,
  to: Point,
  radius: number,
  newId: () => string,
): DrawingElement[] {
  if (!Number.isFinite(radius) || radius <= 0) return elements;
  let changed = false;
  const output = elements.flatMap((element) => {
    // Text, symbols, hatch, photos and inspection markers remain independent objects.
    if (
      (element.type !== 'line' && element.type !== 'polyline') ||
      (element.type === 'polyline' && element.hatch)
    )
      return [element];
    const raw =
      element.type === 'line'
        ? [
            { x: element.x1, y: element.y1 },
            { x: element.x2, y: element.y2 },
          ]
        : element.points;
    const r = radius + drawingStrokeWidth(element) / 2;
    const xs = raw.map((p) => p.x),
      ys = raw.map((p) => p.y);
    if (
      Math.max(...xs) < Math.min(from.x, to.x) - r ||
      Math.min(...xs) > Math.max(from.x, to.x) + r ||
      Math.max(...ys) < Math.min(from.y, to.y) - r ||
      Math.min(...ys) > Math.max(from.y, to.y) + r
    )
      return [element];
    const points = contour(element),
      fragments: Point[][] = [];
    let current: Point[] = [];
    let touched = false;
    const finish = () => {
      if (current.length >= 2) fragments.push(current);
      current = [];
    };
    const keep = (a: Point, b: Point) => {
      if (same(a, b)) return;
      if (current.length && !same(current.at(-1)!, a)) finish();
      if (!current.length) current.push(a);
      current.push(b);
      if (current.length === 1200) {
        finish();
        current = [b];
      }
    };
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!,
        b = points[i]!,
        intervals = cuts(a, b, from, to, r);
      if (!intervals.length) {
        keep(a, b);
        continue;
      }
      touched = true;
      let start = 0;
      for (const [lo, hi] of intervals) {
        if (lo > start) keep(mix(a, b, start), mix(a, b, lo));
        finish();
        start = hi;
      }
      if (start < 1) keep(mix(a, b, start), b);
    }
    finish();
    if (!touched) return [element];
    changed = true;
    return fragments.map((points, i): DrawingElement =>
      element.type === 'line'
        ? {
            ...element,
            id: i ? newId() : element.id,
            x1: points[0]!.x,
            y1: points[0]!.y,
            x2: points.at(-1)!.x,
            y2: points.at(-1)!.y,
          }
        : { ...element, id: i ? newId() : element.id, freehand: false, points },
    );
  });
  return changed ? output : elements;
}
