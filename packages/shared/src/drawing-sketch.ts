import { clampPosition, type DrawingElement, type DrawingPosition } from './drawings';

export type SketchTool = 'pencil' | 'straighten' | 'circle' | 'rectangle';

// Keep long gestures within the existing polyline contract without losing either end.
export function appendStrokePoint(samples: DrawingPosition[], point: DrawingPosition) {
  const p = clampPosition(point),
    last = samples.at(-1);
  if (last && Math.hypot(p.x - last.x, p.y - last.y) < 1) return samples;
  const compact =
    samples.length >= 298 ? samples.filter((_, index) => index === 0 || index % 2 === 1) : samples;
  return [...compact, p];
}

export function sketchElement(
  tool: SketchTool,
  origin: DrawingPosition,
  end: DrawingPosition,
  samples: DrawingPosition[],
  id: string,
): DrawingElement | undefined {
  const a = clampPosition(origin),
    b = clampPosition(end);
  if (tool === 'pencil') {
    const points = appendStrokePoint(samples.length ? samples : [a], b);
    return points.length >= 2 ? { id, type: 'polyline', points } : undefined;
  }
  if (Math.hypot(b.x - a.x, b.y - a.y) < 2) return undefined;
  if (tool === 'straighten') return { id, type: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  if (tool === 'rectangle') {
    if (Math.abs(b.x - a.x) < 2 || Math.abs(b.y - a.y) < 2) return undefined;
    return { id, type: 'polyline', points: [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }, a] };
  }
  const radius = Math.min(Math.hypot(b.x - a.x, b.y - a.y), a.x, 1000 - a.x, a.y, 800 - a.y);
  if (radius < 2) return undefined;
  // Closed vector contour, compatible with existing reports and the PDF renderer.
  const points = Array.from({ length: 96 }, (_, i) => ({
    x: a.x + radius * Math.cos((i * Math.PI) / 48),
    y: a.y + radius * Math.sin((i * Math.PI) / 48),
  }));
  points.push({ ...points[0]! });
  return { id, type: 'polyline', points };
}

export function drawingViewport(
  view: { x: number; y: number; w: number; h: number },
  width: number,
  height: number,
) {
  const h = (view.w * Math.max(1, height)) / Math.max(1, width);
  return { ...view, y: view.y + (view.h - h) / 2, h };
}

export function zoomDrawingAt(
  view: { x: number; y: number; w: number; h: number },
  width: number,
  height: number,
  anchor: DrawingPosition,
  scale: number,
  translation = { x: 0, y: 0 },
) {
  const viewport = drawingViewport(view, width, height);
  const w = Math.max(
    150,
    Math.min(Math.max(2000, (1200 * width) / Math.max(1, height)), view.w / Math.max(0.01, scale)),
  );
  const ratio = w / Math.max(1, width),
    h = w * 0.8;
  const world = {
    x: viewport.x + (anchor.x * view.w) / Math.max(1, width),
    y: viewport.y + (anchor.y * view.w) / Math.max(1, width),
  };
  return {
    x: world.x - (anchor.x + translation.x) * ratio,
    y: world.y - (anchor.y + translation.y) * ratio - (h - height * ratio) / 2,
    w,
    h,
  };
}
