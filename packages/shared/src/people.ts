import { z } from 'zod';
import { reportSignerSchema } from './schemas/reports/common';

export const personSchema = reportSignerSchema
  .omit({ signedAt: true })
  .extend({
    name: z.string().trim().min(1, 'Informe o nome.').max(200),
    registrationNumber: z.string().trim().max(200).optional(),
    company: z.string().trim().max(200).optional(),
    email: z.union([z.email(), z.literal('')]).optional(),
    phone: z.string().max(50).optional(),
  })
  .strict();
export type PersonInput = z.infer<typeof personSchema>;
export type Person = PersonInput & { id: string; version: number; active: boolean };
export const signatureDrawingSchema = z
  .object({
    strokes: z
      .array(
        z
          .array(
            z
              .object({
                x: z.number().min(0).max(1000),
                y: z.number().min(0).max(500),
              })
              .strict(),
          )
          .min(2)
          .max(3000),
      )
      .min(1)
      .max(100)
      .refine(
        (strokes) => strokes.reduce((total, stroke) => total + stroke.length, 0) <= 10000,
        'Assinatura muito extensa. Limpe e assine novamente.',
      ),
  })
  .strict();
