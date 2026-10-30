import { z } from 'zod';
import { evsDraftSchema } from './evs.schema';
import { optionalText, finalResult } from './common';

export const visualInspectionRecordFields = [
  { path: 'item', label: 'Item' },
  { path: 'drawingReference', label: 'Desenho nº / revisão' },
  { path: 'diameter', label: 'Diâmetro' },
  { path: 'joint', label: 'Junta / intervalo de juntas' },
  { path: 'rootStamp', label: 'Sinete da solda de raiz' },
  { path: 'finishStamp', label: 'Sinete da solda de acabamento' },
] as const;
export const visualInspectionRecordSchema = z
  .object({
    item: optionalText,
    drawingReference: optionalText,
    diameter: optionalText,
    joint: optionalText,
    rootStamp: optionalText,
    finishStamp: optionalText,
    result: finalResult,
  })
  .strict();
export type VisualInspectionRecord = z.infer<typeof visualInspectionRecordSchema>;
export const evdDraftSchema = evsDraftSchema.extend({
  drawingReference: optionalText,
  fillerMetal: optionalText,
  weldingSpecification: optionalText,
  inspectionRecords: z.array(visualInspectionRecordSchema).max(200).optional(),
});
export const evdSubmissionSchema = evdDraftSchema;
