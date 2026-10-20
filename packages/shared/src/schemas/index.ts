import { z } from 'zod';
import { recordStatuses, reportStatuses } from '../enums';
import { pointInputSchema, reportSignerSchema } from './reports/common';
import { reportSections } from '../report-fields';
import { reportDrawingSchema } from '../drawings';
z.config(z.locales.pt());
const text = z.string().trim().max(500).optional();
const email = z.union([z.email(), z.literal('')]).optional();
const reportPointsSchema = z.array(pointInputSchema).superRefine((points, ctx) => {
  const used = new Set<string>();
  for (const [index, point] of points.entries()) {
    const number = point.number.trim().toLocaleUpperCase();
    if (!number)
      ctx.addIssue({
        code: 'custom',
        path: [index, 'number'],
        message: 'Informe o número do ponto / solda.',
      });
    else if (used.has(number))
      ctx.addIssue({
        code: 'custom',
        path: [index, 'number'],
        message: 'Este número já está em uso no relatório.',
      });
    used.add(number);
  }
});
export const loginSchema = z
  .object({
    email: z.email().transform((value) => value.toLowerCase()),
    password: z.string().min(1).max(200),
  })
  .strict();
export const refreshSchema = z.object({ refreshToken: z.string().min(1).max(4096) }).strict();
export const companySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    corporateName: text,
    cnpj: text,
    phone: text,
    email,
    contactName: text,
    notes: z.string().max(10000).optional(),
  })
  .strict();
export const projectSchema = z
  .object({
    companyId: z.uuid(),
    name: z.string().trim().min(1).max(200),
    code: text,
    location: text,
    description: z.string().max(10000).optional(),
    responsible: text,
    reportDefaults: z
      .object({
        common: z.record(z.string(), z.string().max(10000)).optional(),
        byType: z.record(z.string(), z.record(z.string(), z.string().max(10000))).optional(),
      })
      .strict()
      .superRefine((value, ctx) => {
        for (const [code, values] of Object.entries(value.byType ?? {}))
          for (const field of reportSections[code]?.flatMap((section) => section.fields) ?? [])
            if (
              field.kind === 'date' &&
              values[field.path] &&
              !z.iso.date().safeParse(values[field.path]).success
            )
              ctx.addIssue({
                code: 'custom',
                path: ['byType', code, field.path],
                message: 'Informe uma data válida nos dados-base dos relatórios.',
              });
      })
      .optional(),
    startDate: z.iso.date().nullable().optional(),
    endDate: z.iso.date().nullable().optional(),
  })
  .strict()
  .refine((value) => !value.startDate || !value.endDate || value.endDate >= value.startDate, {
    message: 'A data final deve ser igual ou posterior à inicial.',
    path: ['endDate'],
  });
export const statusSchema = z.object({ status: z.enum(recordStatuses) }).strict();
export const reportNumberSchema = z
  .string({ error: 'Informe o número do relatório.' })
  .trim()
  .min(1, 'Informe o número do relatório.')
  .max(100);
export const reportCreateSchema = z
  .object({
    reportTypeId: z.uuid(),
    prefillFromProject: z.boolean().default(true),
    companyId: z.uuid(),
    projectId: z.uuid(),
    number: reportNumberSchema,
    title: z.string().max(300).default(''),
    reportDate: z.iso.date().nullable().optional(),
    specificData: z.record(z.string(), z.unknown()).default({}),
    points: reportPointsSchema.optional(),
    signatures: z.array(reportSignerSchema).optional(),
    drawings: z.array(reportDrawingSchema).max(12).optional(),
  })
  .strict();
export const reportUpdateSchema = z
  .object({
    removePointMediaIds: z.array(z.uuid()).max(2000).optional(),
    number: reportNumberSchema.optional(),
    title: z.string().max(300).optional(),
    reportDate: z.iso.date().nullable().optional(),
    specificData: z.record(z.string(), z.unknown()).optional(),
    points: reportPointsSchema.optional(),
    signatures: z.array(reportSignerSchema).optional(),
    drawings: z.array(reportDrawingSchema).max(12).optional(),
    version: z.number().int().min(1),
  })
  .strict();
export const reportSubmissionSchema = z.object({
  number: reportNumberSchema,
  title: z.string().trim().min(1, 'Informe o título do relatório.'),
  reportDate: z.date({ error: 'Informe uma data válida para o relatório.' }),
});
export const transitionSchema = z
  .object({
    status: z.enum(reportStatuses),
    version: z.number().int().min(1),
    revisionNotes: z.string().trim().min(1).max(10000).optional(),
    quick: z.boolean().optional(),
    acknowledgeIncomplete: z.boolean().optional(),
  })
  .strict();
export const listQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z
      .enum(['createdAt', 'updatedAt', 'name', 'number', 'title', 'reportDate'])
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    search: z.string().max(200).optional(),
    companyId: z.uuid().optional(),
    projectId: z.uuid().optional(),
    reportTypeId: z.uuid().optional(),
    createdById: z.uuid().optional(),
    status: z.enum([...recordStatuses, ...reportStatuses]).optional(),
    dateFrom: z.iso.date().optional(),
    dateTo: z.iso.date().optional(),
  })
  .strict()
  .refine((value) => !value.dateFrom || !value.dateTo || value.dateTo >= value.dateFrom, {
    message: 'Intervalo de datas inválido.',
    path: ['dateTo'],
  });
export * from './reports';
