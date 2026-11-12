import type { DrawingElement, DrawingPosition } from './drawings';
import { drawingSymbolDefinition } from './drawing-symbols';

export type DrawingSymbol = Extract<DrawingElement, { type: 'symbol' }>;
export const isDrawingReduction = (element: DrawingElement): element is DrawingSymbol =>
  element.type === 'symbol' &&
  (element.symbolCode === 'reducer' || element.symbolCode.startsWith('iso-reducer-'));

export function drawingReductionLabel(element: DrawingSymbol) {
  if (!isDrawingReduction(element)) return undefined;
  const data = element.reduction;
  if (!data?.inlet.trim() || !data.outlet.trim()) return undefined;
  const bounds = drawingSymbolDefinition(element.symbolCode).bounds;
  const scale = element.scale ?? 1,
    angle = (element.rotation * Math.PI) / 180;
  const size = (data.labelSize ?? 18) * scale;
  const dx = data.labelX ?? bounds.x + bounds.width / 2;
  const dy = data.labelY ?? bounds.y + bounds.height + (data.labelSize ?? 18) / 2 + 10;
  const x = element.x + (dx * Math.cos(angle) - dy * Math.sin(angle)) * scale;
  const y = element.y + (dx * Math.sin(angle) + dy * Math.cos(angle)) * scale;
  const text = `${data.inlet.trim()} × ${data.outlet.trim()}`;
  const width = text.length * size * 0.65;
  return { text, x, y, size, width, left: x - width / 2, top: y - size / 2, height: size * 1.2 };
}

/** Label offsets belong to the symbol, so moving/scaling/rotating keeps them linked. */
export function positionDrawingReductionLabel(
  element: DrawingSymbol,
  position: DrawingPosition,
): DrawingSymbol {
  if (!element.reduction) return element;
  const scale = element.scale ?? 1,
    angle = (-element.rotation * Math.PI) / 180;
  const dx = (position.x - element.x) / scale,
    dy = (position.y - element.y) / scale;
  const ratio = Math.min(1, 160 / (Math.hypot(dx, dy) || 1));
  return {
    ...element,
    reduction: {
      ...element.reduction,
      labelX: (dx * Math.cos(angle) - dy * Math.sin(angle)) * ratio,
      labelY: (dx * Math.sin(angle) + dy * Math.cos(angle)) * ratio,
    },
  };
}
