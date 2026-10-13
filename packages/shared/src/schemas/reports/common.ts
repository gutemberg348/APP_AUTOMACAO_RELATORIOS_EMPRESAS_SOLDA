import { z } from 'zod';
export const optionalText = z.string().max(10000).optional();
export const dateText = z.iso.date().optional();
export const finalResult = z.enum(['APPROVED', 'REJECTED', 'COMPLEMENTARY_EXAM']).optional();
export const imageReferences = z.array(z.uuid()).optional();
export const signatureReference = z
  .object({
    role: z.enum(['INSPECTOR', 'TECHNICAL_RESPONSIBLE', 'CLIENT', 'REVIEWER', 'OTHER']),
    name: z.string().min(1),
    registrationNumber: optionalText,
    signedAt: z.iso.datetime().optional(),
  })
  .strict();
export const weldPointDataSchema = z
  .object({
    dimension: optionalText,
    discontinuity: optionalText,
    acceptable: z.boolean().optional(),
    notes: optionalText,
  })
  .strict();
export const pointInputSchema = z
  .object({
    id: z.uuid().optional(),
    clientId: z.string().min(1).max(100).optional(),
    number: z.string().max(100),
    type: z.enum(['WELD', 'MEASUREMENT', 'INSPECTION_POINT', 'CUSTOM']),
    label: z.string().max(500).optional(),
    value: z.number().finite().nullable().optional(),
    unit: z.string().max(30).optional(),
    data: weldPointDataSchema.extend({ projectThickness: optionalText }).optional(),
  })
  .strict();
export const reportSignerSchema = z
  .object({
    role: z.enum(['INSPECTOR', 'TECHNICAL_RESPONSIBLE', 'CLIENT', 'REVIEWER', 'OTHER']),
    name: z.string().max(500),
    registrationNumber: z.string().max(200).optional(),
    signedAt: z.iso.date().optional(),
    signatureAssetId: z.uuid().nullable().optional(),
  })
  .strict();
