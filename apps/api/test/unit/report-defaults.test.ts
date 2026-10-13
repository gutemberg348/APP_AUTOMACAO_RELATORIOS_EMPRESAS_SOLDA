import { describe, it, expect } from 'vitest';
import { buildReportDefaults, projectSchema } from '@weldcosta/shared';
import { randomUUID } from 'node:crypto';
describe('report defaults', () => {
  const company = { name: 'Client name', corporateName: 'Legal client' };
  const project = {
    name: 'Work name',
    code: 'P-12',
    location: 'Local',
    reportDefaults: {
      common: { factory: 'Unit', owner: 'Owner', project: 'Design reference' },
      byType: {
        EVS: { weldingProcess: 'Process', finalResult: 'APPROVED' },
        TH: { 'manometer.calibrationDate': '2024-02-29' },
      },
    },
  };
  it('copies only fields from the selected type and never supplies a result', () => {
    expect(buildReportDefaults('EVS', project, company)).toEqual({
      client: 'Legal client',
      factory: 'Unit',
      owner: 'Owner',
      work: 'Work name',
      project: 'Design reference',
      weldingProcess: 'Process',
    });
    expect(buildReportDefaults('TH', project, company)).toMatchObject({
      location: 'Local',
      manometer: { calibrationDate: '2024-02-29' },
    });
    expect(buildReportDefaults('RDO', project, company)).not.toHaveProperty('owner');
  });
  it('creates independent snapshots with project fallback', () => {
    const first = buildReportDefaults('EVS', project, company);
    first.factory = 'Changed';
    expect(buildReportDefaults('EVS', project, company).factory).toBe('Unit');
    expect(buildReportDefaults('ME', { name: 'Work name', code: 'P-12' }, company).project).toBe(
      'P-12',
    );
  });
  it('rejects invalid dates in project defaults', () => {
    expect(
      projectSchema.safeParse({
        companyId: randomUUID(),
        name: 'Work',
        reportDefaults: { byType: { TH: { 'manometer.calibrationDate': '2025-02-29' } } },
      }).success,
    ).toBe(false);
  });
});
