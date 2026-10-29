export const drawingBrushes = [
  { id: 'pen', name: 'Caneta', width: 2.6, opacity: 1, cap: 'round' },
  { id: 'fountain', name: 'Caneta tinteiro', width: 3.5, opacity: 1, cap: 'square' },
  { id: 'pencil', name: 'Lápis', width: 1.2, opacity: 0.7, cap: 'round' },
  { id: 'brush', name: 'Pincel', width: 6, opacity: 0.9, cap: 'round' },
  { id: 'marker', name: 'Marca-texto', width: 18, opacity: 0.28, cap: 'butt' },
  { id: 'airbrush', name: 'Esfumaçado', width: 30, opacity: 0.35, cap: 'round' },
] as const;
export type DrawingBrush = (typeof drawingBrushes)[number]['id'];
export const drawingBrush = (id?: DrawingBrush) =>
  drawingBrushes.find((brush) => brush.id === id) ?? drawingBrushes[0];

// Concentric translucent strokes give a soft edge on native SVG and in the PDF,
// without platform-specific blur filters or random particles that change on redraw.
export function drawingBrushLayers(id: DrawingBrush | undefined, width: number) {
  const brush = drawingBrush(id);
  return id === 'airbrush'
    ? [1, 0.85, 0.7, 0.55, 0.4, 0.25].map((scale, i) => ({
        width: width * scale,
        opacity: [0.025, 0.04, 0.06, 0.08, 0.1, 0.12][i]!,
        cap: brush.cap,
      }))
    : [{ width, opacity: brush.opacity, cap: brush.cap }];
}
