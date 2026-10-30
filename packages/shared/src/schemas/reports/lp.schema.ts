import { z } from 'zod';
import { optionalText, dateText, finalResult, imageReferences } from './common';
export const lpMaterialSchema = z
  .object({
    manufacturer: optionalText,
    brand: optionalText,
    lot: optionalText,
    expirationDate: dateText,
  })
  .strict();
export const lpDraftSchema = z
  .object({
    client: optionalText,
    factory: optionalText,
    owner: optionalText,
    work: optionalText,
    project: optionalText,
    procedureRevision: optionalText,
    inspectionType: optionalText,
    weldingProcess: optionalText,
    baseMetal: optionalText,
    fillerMetal: optionalText,
    bevel: optionalText,
    purgeGas: optionalText,
    acceptanceCriteria: optionalText,
    referenceStandard: optionalText,
    generalData: z
      .object({
        temperature: optionalText,
        thickness: optionalText,
        surfaceCondition: optionalText,
        lightingIntensity: optionalText,
        baseMetal: optionalText,
      })
      .strict()
      .optional(),
    materials: z
      .object({
        cleaner: lpMaterialSchema.optional(),
        penetrant: lpMaterialSchema.optional(),
        remover: lpMaterialSchema.optional(),
        developer: lpMaterialSchema.optional(),
      })
      .strict()
      .optional(),
    penetrantType: optionalText,
    removalTechnique: optionalText,
    inspectionArea: optionalText,
    discontinuities: z
      .array(
        z
          .object({
            code: z.string().max(100),
            description: optionalText,
          })
          .strict(),
      )
      .optional(),
    testImages: imageReferences,
    finalResult,
    finalReport: optionalText,
  })
  .strict();
export const lpSubmissionSchema = lpDraftSchema;
