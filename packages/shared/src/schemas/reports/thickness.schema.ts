import { z } from 'zod';
import { optionalText, finalResult } from './common';
import { thicknessCalculationFields } from '../../thickness-calculation';
const calculationText = z
  .string()
  .max(100, 'Use até 100 caracteres neste campo do memorial.')
  .optional();
const calculationShape = Object.fromEntries(
  thicknessCalculationFields.map((field) => [field.path, calculationText]),
) as Record<(typeof thicknessCalculationFields)[number]['path'], typeof calculationText>;
export const thicknessDraftSchema = z
  .object({
    ...calculationShape,
    client: optionalText,
    factory: optionalText,
    owner: optionalText,
    work: optionalText,
    project: optionalText,
    drawing: optionalText,
    inspectionType: optionalText,
    projectThickness: optionalText,
    baseMetal: optionalText,
    referenceStandard: optionalText,
    equipment: optionalText,
    finalReport: optionalText,
    finalResult,
  })
  .strict();
export const thicknessSubmissionSchema = thicknessDraftSchema;
export const measurementPointDataSchema = z.object({ notes: optionalText }).strict();
