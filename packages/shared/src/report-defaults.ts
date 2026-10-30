import { reportSections } from './report-fields';

export interface ReportDefaults {
  common?: Record<string, string>;
  byType?: Record<string, Record<string, string>>;
}
export function buildReportDefaults(
  code: string,
  project: {
    name: string;
    code?: string | null;
    location?: string | null;
    reportDefaults?: ReportDefaults;
  },
  company: { name: string; corporateName?: string | null },
) {
  const defaults = project.reportDefaults ?? {};
  const values: Record<string, string> = {
    client: company.corporateName || company.name,
    work: project.name,
    project: project.code || project.name,
    location: project.location || '',
    ...(code === 'EVD' ? { inspectionType: 'EVS DIRETO' } : {}),
    ...defaults.common,
    ...defaults.byType?.[code],
  };
  const data: Record<string, unknown> = {};
  for (const field of reportSections[code]?.flatMap((section) => section.fields) ?? []) {
    if (!values[field.path] || field.kind === 'result' || field.kind === 'long') continue;
    const parts = field.path.split('.');
    let target = data;
    for (const part of parts.slice(0, -1))
      target = (target[part] ??= {}) as Record<string, unknown>;
    target[parts.at(-1)!] = values[field.path];
  }
  return data;
}
