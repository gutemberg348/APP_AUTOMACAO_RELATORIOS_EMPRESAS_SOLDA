import { z } from 'zod';
import { optionalText, dateText, imageReferences } from './common';
export const rdoDraftSchema = z
  .object({
    date: dateText,
    inspector: optionalText,
    client: optionalText,
    work: optionalText,
    factory: optionalText,
    material: optionalText,
    purgeGas: optionalText,
    diameter: optionalText,
    weldType: optionalText,
    inspectionType: optionalText,
    observation: optionalText,
    images: imageReferences,
    visa: optionalText,
  })
  .strict();
export const rdoSubmissionSchema = rdoDraftSchema;
