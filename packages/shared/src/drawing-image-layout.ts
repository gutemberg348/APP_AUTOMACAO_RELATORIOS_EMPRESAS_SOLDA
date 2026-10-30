import type { DrawingData, DrawingElement } from './drawings';

export interface DrawingCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}
export const fullDrawingCrop: DrawingCrop = { x: 0, y: 0, width: 1, height: 1 };
export function drawingPageBounds(data?: Pick<DrawingData, 'page'>) {
  const width = data?.page === 'portrait' ? (800 * 196) / 239 : 1000;
  return { x: (1000 - width) / 2, y: 0, width, height: 800 };
}
export function drawingPageViewBox(data?: Pick<DrawingData, 'page'>) {
  const p = drawingPageBounds(data);
  return `${p.x} ${p.y} ${p.width} ${p.height}`;
}
export function fitDrawingPageView(data: Pick<DrawingData, 'page'>, width: number, height: number) {
  const page = drawingPageBounds(data);
  const w = Math.max(page.width, (page.height * Math.max(1, width)) / Math.max(1, height));
  return {
    x: page.x + page.width / 2 - w / 2,
    y: page.y + page.height / 2 - w * 0.4,
    w,
    h: w * 0.8,
  };
}
export function clampDrawingCrop(crop: DrawingCrop): DrawingCrop {
  const width = Math.max(0.05, Math.min(1, crop.width));
  const height = Math.max(0.05, Math.min(1, crop.height));
  return {
    x: Math.max(0, Math.min(1 - width, crop.x)),
    y: Math.max(0, Math.min(1 - height, crop.y)),
    width,
    height,
  };
}
export function croppedDrawingImageSize(
  image: Extract<DrawingElement, { type: 'image' }>,
  crop: DrawingCrop,
  aspect: number,
) {
  if (image.fit === 'cover') return { width: image.width, height: image.height };
  const ratio = (aspect * crop.width) / crop.height;
  const width = Math.min(image.width, image.height * ratio);
  return { width, height: width / ratio };
}
