export const drawingBrushes = [
  { id: 'pen', name: 'Caneta', width: 2.6, opacity: 1, cap: 'round' },
  { id: 'fountain', name: 'Caneta tinteiro', width: 3.5, opacity: 1, cap: 'square' },
  { id: 'pencil', name: 'Lápis', width: 1.2, opacity: 0.7, cap: 'round' },
  { id: 'brush', name: 'Pincel', width: 6, opacity: 0.9, cap: 'round' },
  { id: 'marker', name: 'Marca-texto', width: 18, opacity: 0.28, cap: 'butt' },
] as const;
export type DrawingBrush = (typeof drawingBrushes)[number]['id'];
export const drawingBrush = (id?: DrawingBrush) =>
  drawingBrushes.find((brush) => brush.id === id) ?? drawingBrushes[0];
