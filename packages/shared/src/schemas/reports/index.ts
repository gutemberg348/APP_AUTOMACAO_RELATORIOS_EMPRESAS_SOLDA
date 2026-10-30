import { z } from 'zod';
import { evsDraftSchema, evsSubmissionSchema } from './evs.schema';
import { evdDraftSchema, evdSubmissionSchema } from './evd.schema';
import { lpDraftSchema, lpSubmissionSchema } from './lp.schema';
import { hydrostaticDraftSchema, hydrostaticSubmissionSchema } from './hydrostatic.schema';
import { thicknessDraftSchema, thicknessSubmissionSchema } from './thickness.schema';
import { rdoDraftSchema, rdoSubmissionSchema } from './rdo.schema';
export const reportSchemaRegistry: Record<string, { draft: z.ZodType; submission: z.ZodType }> = {
  EVS: { draft: evsDraftSchema, submission: evsSubmissionSchema },
  EVD: { draft: evdDraftSchema, submission: evdSubmissionSchema },
  LP: { draft: lpDraftSchema, submission: lpSubmissionSchema },
  TH: { draft: hydrostaticDraftSchema, submission: hydrostaticSubmissionSchema },
  ME: { draft: thicknessDraftSchema, submission: thicknessSubmissionSchema },
  RDO: { draft: rdoDraftSchema, submission: rdoSubmissionSchema },
};
// Technical mandatory fields must be approved by Weldcosta, then configured per report type.
export const reportConfigSchema = z
  .object({
    submissionRequiredKeys: z.array(z.string()).default([]),
    editableFieldsByRoleCode: z.record(z.string(), z.array(z.string())).default({}),
    customFields: z.record(z.string(), z.enum(['text', 'number', 'boolean', 'date'])).optional(),
  })
  .strict();
export function validateSpecificData(
  code: string,
  data: unknown,
  mode: 'draft' | 'submission',
  config: unknown = {},
) {
  const settings = reportConfigSchema.parse(config);
  const registered = reportSchemaRegistry[code];
  const fields: Record<string, z.ZodType> = {};
  for (const [name, type] of Object.entries(settings.customFields ?? {})) {
    fields[name] = {
      text: z.string(),
      number: z.number(),
      boolean: z.boolean(),
      date: z.iso.date(),
    }[type].optional();
  }
  const schema =
    registered?.[mode] ?? (settings.customFields ? z.object(fields).strict() : undefined);
  if (!schema) throw new Error(`REPORT_TYPE_SCHEMA_MISSING:${code}`);
  const parsed = schema.parse(data) as Record<string, unknown>;
  if (mode === 'submission') {
    for (const key of settings.submissionRequiredKeys) {
      const value = key
        .split('.')
        .reduce<unknown>(
          (current, part) =>
            current && typeof current === 'object'
              ? (current as Record<string, unknown>)[part]
              : undefined,
          parsed,
        );
      if (
        value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && !value.length)
      ) {
        throw new z.ZodError([
          {
            code: 'custom',
            path: key.split('.'),
            message: 'Campo obrigatório para enviar à revisão.',
          },
        ]);
      }
    }
  }
  return parsed;
}
export * from './evs.schema';
export * from './evd.schema';
export * from './lp.schema';
export * from './hydrostatic.schema';
export * from './thickness.schema';
export * from './rdo.schema';
export * from './common';
