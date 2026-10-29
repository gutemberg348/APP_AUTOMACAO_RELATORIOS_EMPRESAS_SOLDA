import { z } from 'zod';
import { drawingElementSchema, drawingSvg, newDrawingData } from './drawings';

export const photoAnnotationsSchema = z
  .object({
    elements: z
      .array(drawingElementSchema)
      .max(600)
      .refine(
        (elements) =>
          elements.every((e) => ['line', 'polyline', 'text'].includes(e.type)) &&
          new Set(elements.map((e) => e.id)).size === elements.length,
        'Use apenas traços, formas e textos sem identificações repetidas na foto.',
      ),
  })
  .strict()
  .refine(
    (value) => JSON.stringify(value).length <= 750000,
    'Há marcações demais nesta foto. Apague alguns traços antes de salvar.',
  );
export type PhotoAnnotations = z.infer<typeof photoAnnotationsSchema>;
export function photoFrame(width: number, height: number) {
  const scale = Math.min(1000 / Math.max(1, width), 800 / Math.max(1, height));
  const w = Math.max(10, width * scale),
    h = Math.max(10, height * scale);
  return { x: 500, y: 400, width: w, height: h };
}
export function photoAnnotationsSvg(
  uri: string,
  width: number,
  height: number,
  annotations: PhotoAnnotations,
) {
  const frame = photoFrame(width, height);
  return drawingSvg(
    {
      ...newDrawingData(),
      grid: 'none',
      elements: [
        {
          id: 'photo-background',
          type: 'image',
          mediaKey: 'original',
          ...frame,
          rotation: 0,
          locked: true,
        },
        ...annotations.elements,
      ],
    },
    [],
    {
      images: { original: uri },
      viewBox: `${500 - frame.width / 2} ${400 - frame.height / 2} ${frame.width} ${frame.height}`,
    },
  );
}
