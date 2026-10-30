import { z } from 'zod';
import { drawingElementSchema, drawingSvg, newDrawingData } from './drawings';

export const photoAnnotationsSchema = z
  .object({
    measurements: z
      .array(
        z
          .object({
            id: z.string().min(1).max(100),
            number: z
              .string()
              .trim()
              .regex(/^\d{1,4}$/, 'Informe um número de 1 a 9999.')
              .refine((n) => Number(n) > 0),
            x: z.number().finite().min(0).max(1),
            y: z.number().finite().min(0).max(1),
            value: z.number().finite().min(0).max(100000).nullable().optional(),
          })
          .strict(),
      )
      .max(100)
      .refine(
        (items) =>
          new Set(items.map((m) => m.id)).size === items.length &&
          new Set(items.map((m) => Number(m.number))).size === items.length,
        'Use números diferentes para os pontos desta foto.',
      )
      .optional(),
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
export type PhotoMeasurement = NonNullable<PhotoAnnotations['measurements']>[number];
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
  const svg = drawingSvg(
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
  const radius = Math.min(frame.width, frame.height) * 0.026;
  const marks = (annotations.measurements ?? [])
    .map((m) => {
      const x = 500 - frame.width / 2 + frame.width * m.x;
      const y = 400 - frame.height / 2 + frame.height * m.y;
      const number = m.number.replace(/[^0-9]/g, '');
      return `<g><circle cx="${x}" cy="${y}" r="${radius}" fill="white" fill-opacity="0.88" stroke="#111827" stroke-width="${radius * 0.12}"/><text x="${x}" y="${y + radius * 0.34}" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="${radius * (number.length > 2 ? 0.72 : 1.1)}" fill="#111827">${number}</text></g>`;
    })
    .join('');
  return svg.replace('</svg>', `${marks}</svg>`);
}
