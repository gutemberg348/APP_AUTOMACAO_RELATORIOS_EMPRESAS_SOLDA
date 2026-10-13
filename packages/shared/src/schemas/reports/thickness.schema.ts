import { z } from 'zod';
import { optionalText, finalResult } from './common';
export const thicknessDraftSchema = z
  .object({
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
