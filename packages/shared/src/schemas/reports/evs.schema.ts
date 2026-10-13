import { z } from 'zod';
import { optionalText, finalResult } from './common';
export const evsDraftSchema = z
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
    bevel: optionalText,
    purgeGas: optionalText,
    acceptanceCriteria: optionalText,
    referenceStandard: optionalText,
    finalReport: optionalText,
    finalResult,
  })
  .strict();
export const evsSubmissionSchema = evsDraftSchema;
