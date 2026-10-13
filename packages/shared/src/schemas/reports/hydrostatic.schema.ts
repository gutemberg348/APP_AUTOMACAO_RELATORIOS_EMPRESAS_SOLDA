import { z } from 'zod';
import { optionalText, dateText, finalResult, imageReferences } from './common';
export const hydrostaticDraftSchema = z
  .object({
    client: optionalText,
    location: optionalText,
    owner: optionalText,
    work: optionalText,
    project: optionalText,
    referenceDrawing: optionalText,
    materialStandard: optionalText,
    procedureRevision: optionalText,
    artNumber: optionalText,
    referenceStandard: optionalText,
    testFluid: optionalText,
    manometer: z
      .object({
        manufacturer: optionalText,
        certificateNumber: optionalText,
        calibrationDate: dateText,
        serialNumber: optionalText,
      })
      .strict()
      .optional(),
    generalData: z
      .object({
        workingTemperature: optionalText,
        manufacturer: optionalText,
        workingPressure: optionalText,
        testDuration: optionalText,
        equipment: optionalText,
        material: optionalText,
        thickness: optionalText,
        dimension: optionalText,
      })
      .strict()
      .optional(),
    testImages: imageReferences,
    observation: optionalText,
    finalResult,
  })
  .strict();
export const hydrostaticSubmissionSchema = hydrostaticDraftSchema;
