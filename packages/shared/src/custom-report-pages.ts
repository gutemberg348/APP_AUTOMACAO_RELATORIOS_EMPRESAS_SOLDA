import { z } from 'zod';
import { drawingDataSchema } from './drawings';

const key = z.string().regex(/^[a-zA-Z0-9_-]{1,30}$/, 'Identificação da página inválida.');
export const customPagePointSchema = z
  .object({
    key,
    number: z.string().max(100).default(''),
    label: z.string().max(500).optional(),
    reading: z.string().max(100).optional(),
    discontinuity: z.string().max(500).optional(),
    acceptable: z.boolean().nullable().optional(),
  })
  .strict();
export const customReportPageSchema = z
  .object({
    id: key,
    kind: z.enum(['blank', 'drawing', 'photos', 'points']),
    title: z.string().max(150).default(''),
    position: z
      .enum([
        'afterIdentification',
        'beforeConclusion',
        'afterPage',
        'start',
        'end',
        'afterSignatures',
      ])
      .default('beforeConclusion'),
    afterPage: z.number().int().min(1).max(10000).optional(),
    photosPerPage: z
      .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(6)])
      .default(6),
    drawings: z
      .array(z.object({ data: drawingDataSchema }).strict())
      .max(12)
      .default([]),
    points: z
      .array(customPagePointSchema)
      .max(200)
      .default([])
      .refine(
        (points) => new Set(points.map((p) => p.key)).size === points.length,
        'Os pontos desta página devem ter identificações diferentes.',
      ),
  })
  .strict();
export const customReportPagesSchema = z
  .array(customReportPageSchema)
  .max(20, 'Use até 20 páginas personalizadas.')
  .refine(
    (pages) => new Set(pages.map((p) => p.id)).size === pages.length,
    'As páginas devem ter identificações diferentes.',
  );
export type CustomReportPage = z.infer<typeof customReportPageSchema>;
export type CustomPagePoint = z.infer<typeof customPagePointSchema>;
export function customReportPages(data: unknown): CustomReportPage[] {
  const raw =
    data && typeof data === 'object' ? (data as Record<string, unknown>).customPages : undefined;
  if (raw === undefined) return [];
  return customReportPagesSchema.parse(raw);
}
export const customPhotoPrefix = (pageId: string, pointKey = 'photos') =>
  `custom-page:${pageId}:${pointKey}:`;
export const isCustomPagePhoto = (media: { clientUploadId?: string | null; id?: string }) =>
  (media.clientUploadId ?? media.id ?? '').startsWith('custom-page:');
