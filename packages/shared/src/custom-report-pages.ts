import { z } from 'zod';
import { drawingDataSchema, drawingId, newDrawingData } from './drawings';
import { reportSectionIds } from './report-layout';

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
    kind: z.enum(['blank', 'drawing', 'calculation', 'photos', 'points']),
    title: z.string().max(150).default(''),
    position: z
      .enum([
        'afterIdentification',
        'beforeConclusion',
        'afterPage',
        'start',
        'end',
        'afterSignatures',
        'afterSection',
      ])
      .default('beforeConclusion'),
    afterPage: z.number().int().min(1).max(10000).optional(),
    afterSection: z.enum(reportSectionIds).optional(),
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
  .strict()
  .refine((page) => page.position !== 'afterSection' || page.afterSection !== undefined, {
    path: ['afterSection'],
    message: 'Escolha abaixo de qual etapa esta página deve aparecer.',
  });
export const customReportPagesSchema = z
  .array(customReportPageSchema)
  .max(20, 'Use até 20 páginas personalizadas.')
  .refine(
    (pages) => new Set(pages.map((p) => p.id)).size === pages.length,
    'As páginas devem ter identificações diferentes.',
  );
export type CustomReportPage = z.infer<typeof customReportPageSchema>;
export type CustomPagePoint = z.infer<typeof customPagePointSchema>;
export const isCustomDrawingPage = (page: { kind: CustomReportPage['kind'] }) =>
  ['blank', 'drawing', 'calculation'].includes(page.kind);
export function newCustomReportPage(
  kind: CustomReportPage['kind'],
  title = '',
  photosPerPage: CustomReportPage['photosPerPage'] = 6,
): CustomReportPage {
  const titles = {
    blank: 'Página em branco',
    drawing: 'Página de desenho',
    calculation: 'CÁLCULOS',
    photos: 'Fotos do ensaio',
    points: 'Pontos e fotos',
  };
  return customReportPageSchema.parse({
    id: drawingId(),
    kind,
    title: title.trim() || titles[kind],
    position: 'end',
    photosPerPage,
    drawings: isCustomDrawingPage({ kind })
      ? [
          {
            data: {
              ...newDrawingData(),
              page: 'portrait',
              ...(kind !== 'drawing' ? { grid: 'none' as const } : {}),
            },
          },
        ]
      : [],
  });
}
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
