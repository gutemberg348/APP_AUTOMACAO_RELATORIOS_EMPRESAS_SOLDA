import {
  type DrawingElement,
  type DrawingPosition,
  drawingDataSchema,
  newDrawingData,
} from './drawings';
import {
  drawingSelectionBounds,
  drawingElementFootprint,
  transformDrawingSelection,
} from './drawing-selection';

export const drawingOrderedElements = (elements: DrawingElement[]) =>
  [...elements].sort(
    (a, b) =>
      (a.layer ?? (a.type === 'image' ? -1 : 0)) - (b.layer ?? (b.type === 'image' ? -1 : 0)),
  );
export const drawingUnlocked = (e: DrawingElement) => e.type !== 'image' || !e.locked;
export function drawingGroupMembers(elements: DrawingElement[], ids: string[]) {
  const groups = new Set(
    elements.filter((e) => ids.includes(e.id) && e.groupId).map((e) => e.groupId),
  );
  return elements.filter(
    (e) => drawingUnlocked(e) && (ids.includes(e.id) || (e.groupId && groups.has(e.groupId))),
  );
}
export function drawingLayerChange(elements: DrawingElement[], ids: string[], front: boolean) {
  const ordered = drawingOrderedElements(elements),
    selected = ordered.filter((e) => ids.includes(e.id)),
    other = ordered.filter((e) => !ids.includes(e.id));
  return (front ? [...other, ...selected] : [...selected, ...other]).map((e, layer) => ({
    ...e,
    layer,
  }));
}
// Elements are immutable editor snapshots: unchanged geometry can reuse its targets.
const snapTargets = new WeakMap<DrawingElement, DrawingPosition[]>();
export function drawingSnap(p: DrawingPosition, elements: DrawingElement[], tolerance: number) {
  let closest: DrawingPosition | undefined,
    vertical: DrawingPosition | undefined,
    horizontal: DrawingPosition | undefined;
  let distance = Infinity,
    xDistance = Infinity,
    yDistance = Infinity;
  for (const element of elements) {
    let targets = snapTargets.get(element);
    if (!targets) {
      targets = [...drawingElementFootprint(element), drawingSelectionBounds([element]).center];
      snapTargets.set(element, targets);
    }
    for (const target of targets) {
      const dx = Math.abs(target.x - p.x),
        dy = Math.abs(target.y - p.y);
      if (dx <= tolerance && dx < xDistance) {
        vertical = target;
        xDistance = dx;
      }
      if (dy <= tolerance && dy < yDistance) {
        horizontal = target;
        yDistance = dy;
      }
      if (dx <= tolerance && dy <= tolerance) {
        const d = dx * dx + dy * dy;
        if (d <= tolerance * tolerance && d < distance) {
          closest = target;
          distance = d;
        }
      }
    }
  }
  vertical = closest ?? vertical;
  horizontal = closest ?? horizontal;
  return {
    position: { x: vertical?.x ?? p.x, y: horizontal?.y ?? p.y },
    x: vertical?.x,
    y: horizontal?.y,
    anchor: closest,
  };
}
export function drawingLineEndpoint(
  e: DrawingElement,
  end: 0 | 1,
  p: DrawingPosition,
): DrawingElement {
  if (e.type !== 'line' && e.type !== 'dimension') return e;
  const other = end === 0 ? { x: e.x2, y: e.y2 } : { x: e.x1, y: e.y1 };
  if (p.x < 0 || p.x > 1000 || p.y < 0 || p.y > 800 || Math.hypot(p.x - other.x, p.y - other.y) < 2)
    return e;
  return end === 0 ? { ...e, x1: p.x, y1: p.y } : { ...e, x2: p.x, y2: p.y };
}
/** Exact edit: rejects a boundary/size limit instead of silently clamping the requested values. */
export function drawingPreciseTransform(
  elements: DrawingElement[],
  values: { x: number; y: number; scale: number; angle: number; length?: number },
) {
  if (!elements.length || !Object.values(values).every(Number.isFinite) || values.scale <= 0)
    throw new Error('Informe valores numéricos válidos e tamanho maior que zero.');
  let source = elements;
  if (values.length !== undefined) {
    const e = source[0]!;
    if (source.length !== 1 || (e.type !== 'line' && e.type !== 'dimension') || values.length < 2)
      throw new Error('O comprimento mínimo da linha é 2 unidades.');
    const a = (values.angle * Math.PI) / 180;
    source = [
      { ...e, x2: e.x1 + Math.cos(a) * values.length, y2: e.y1 + Math.sin(a) * values.length },
    ];
  }
  const before = drawingSelectionBounds(source);
  const radians = ((values.length !== undefined ? 0 : values.angle) * Math.PI) / 180;
  const expectedPoints = source.flatMap(drawingElementFootprint).map((p) => {
    const x = (p.x - before.center.x) * values.scale,
      y = (p.y - before.center.y) * values.scale;
    return {
      x: before.center.x + x * Math.cos(radians) - y * Math.sin(radians),
      y: before.center.y + x * Math.sin(radians) + y * Math.cos(radians),
    };
  });
  const left = Math.min(...expectedPoints.map((p) => p.x)),
    right = Math.max(...expectedPoints.map((p) => p.x)),
    top = Math.min(...expectedPoints.map((p) => p.y)),
    bottom = Math.max(...expectedPoints.map((p) => p.y));
  const result = transformDrawingSelection(
    source,
    values.length !== undefined ? 0 : values.angle,
    values.x - (left + right) / 2,
    values.y - (top + bottom) / 2,
    values.scale,
  );
  const after = drawingSelectionBounds(result);
  if (
    Math.abs(after.center.x - values.x) > 0.01 ||
    Math.abs(after.center.y - values.y) > 0.01 ||
    Math.abs(after.width - (right - left)) > 0.01 ||
    Math.abs(after.height - (bottom - top)) > 0.01 ||
    (result === source &&
      (values.scale !== 1 || (values.length === undefined && values.angle !== 0)))
  )
    throw new Error(
      'Essas medidas ultrapassam a folha ou os limites do elemento. Diminua o tamanho ou ajuste a posição.',
    );
  if (!drawingDataSchema.safeParse({ ...newDrawingData(), elements: result }).success)
    throw new Error('Essas medidas excedem os limites do elemento. Confira o tamanho e a posição.');
  return result;
}
