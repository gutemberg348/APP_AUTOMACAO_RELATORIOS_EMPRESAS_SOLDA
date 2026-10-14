import { z } from 'zod';
import { reportSignerSchema } from './schemas/reports/common';
import { userPassword, type UserRole } from './users';

export const personSchema = reportSignerSchema
  .omit({ signedAt: true })
  .extend({
    name: z.string().trim().min(1, 'Informe o nome.').max(200),
    registrationNumber: z.string().trim().max(200).optional(),
    company: z.string().trim().max(200).optional(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.union([z.email(), z.literal('')]))
      .optional(),
    phone: z.string().max(50).optional(),
  })
  .strict();
export type PersonInput = z.infer<typeof personSchema>;
export const personLoginSchema = z
  .object({
    password: userPassword,
    roleCode: z.enum(['ADMIN', 'MANAGER', 'INSPECTOR', 'OPERATOR']).default('INSPECTOR'),
    companyIds: z.array(z.uuid()).max(1000).optional(),
  })
  .strict();
export const personSaveSchema = personSchema
  .extend({ login: personLoginSchema.optional() })
  .superRefine((data, ctx) => {
    if (!data.login) return;
    if (!data.email)
      ctx.addIssue({
        code: 'custom',
        path: ['email'],
        message: 'Informe o e-mail para criar o login.',
      });
    if (data.name.length < 2)
      ctx.addIssue({ code: 'custom', path: ['name'], message: 'Informe o nome completo.' });
    if ((data.phone?.length ?? 0) > 40)
      ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Confira o telefone informado.' });
  });
export type Person = PersonInput & {
  id: string;
  version: number;
  active: boolean;
  userId?: string | null;
  user?: {
    id: string;
    email: string;
    status: 'ACTIVE' | 'DISABLED';
    deletedAt: string | null;
    role: UserRole;
  } | null;
};
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
