import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  validateSpecificData,
  reportCreateSchema,
  reportUpdateSchema,
  reportSubmissionSchema,
  rolePermissions,
  type CurrentUser,
  canSetReportStatus,
} from '@weldcosta/shared';
import {
  assertTransition,
  assertEditable,
  assertFieldAccess,
} from '../../src/modules/reports/reports.policy';
const user = (code: string): CurrentUser => ({
  id: randomUUID(),
  email: 'test@example.invalid',
  name: 'Test',
  phone: null,
  role: { id: randomUUID(), code, name: code },
  permissions: [...rolePermissions[code]!],
});
describe('specific schemas', () => {
  it('allows immediate status changes only with the corresponding permissions', () => {
    expect(canSetReportStatus('DRAFT', 'APPROVED', rolePermissions.ADMIN!)).toBe(true);
    expect(canSetReportStatus('APPROVED', 'DRAFT', rolePermissions.REVIEWER!)).toBe(true);
    expect(canSetReportStatus('DRAFT', 'APPROVED', rolePermissions.INSPECTOR!)).toBe(true);
    expect(canSetReportStatus('DRAFT', 'APPROVED', rolePermissions.OPERATOR!)).toBe(false);
    expect(canSetReportStatus('APPROVED', 'DRAFT', rolePermissions.VIEWER!)).toBe(false);
    expect(canSetReportStatus('FINISHED', 'DRAFT', rolePermissions.ADMIN!)).toBe(true);
    expect(canSetReportStatus('DRAFT', 'FINISHED', rolePermissions.ADMIN!)).toBe(false);
    expect(canSetReportStatus('APPROVED', 'FINISHED', rolePermissions.ADMIN!)).toBe(true);
  });
  it('rejects empty or repeated point numbers before images can be linked', () => {
    const point = { number: 'S-01', type: 'WELD' };
    const input = { version: 1, points: [point, { ...point, number: ' s-01 ' }] };
    const result = reportUpdateSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(['points', 1, 'number']);
    expect(
      reportUpdateSchema.safeParse({ version: 1, points: [{ ...point, number: ' ' }] }).success,
    ).toBe(false);
    expect(
      reportUpdateSchema.safeParse({ version: 1, points: [point, { ...point, number: 'S-02' }] })
        .success,
    ).toBe(true);
  });
  it.each(['EVS', 'LP', 'TH', 'ME', 'RDO'])('accepts incomplete %s drafts', (code) => {
    expect(validateSpecificData(code, {}, 'draft')).toEqual({});
  });
  it('rejects wrong report fields and unknown types', () => {
    expect(() => validateSpecificData('RDO', { manometer: {} }, 'draft')).toThrow();
    expect(() => validateSpecificData('unknown', {}, 'draft')).toThrow(
      'REPORT_TYPE_SCHEMA_MISSING',
    );
  });
  it('validates nested dates and configurable submission requirements', () => {
    expect(() =>
      validateSpecificData('TH', { manometer: { calibrationDate: 'invalid' } }, 'draft'),
    ).toThrow();
    expect(() =>
      validateSpecificData('TH', {}, 'submission', { submissionRequiredKeys: ['testFluid'] }),
    ).toThrow();
    expect(
      validateSpecificData('TH', { testFluid: 'Água' }, 'submission', {
        submissionRequiredKeys: ['testFluid'],
      }),
    ).toEqual({ testFluid: 'Água' });
  });
  it('supports a configured future report without backend changes', () => {
    expect(
      validateSpecificData('CUSTOM', { reading: 4.2 }, 'draft', {
        customFields: { reading: 'number' },
      }),
    ).toEqual({ reading: 4.2 });
    expect(() =>
      validateSpecificData('CUSTOM', { reading: 'text' }, 'draft', {
        customFields: { reading: 'number' },
      }),
    ).toThrow();
  });
  it('requires a report number even for drafts, while other incomplete fields remain allowed', () => {
    const input = {
      companyId: randomUUID(),
      projectId: randomUUID(),
      reportTypeId: randomUUID(),
    };
    for (const number of [undefined, '', '   ']) {
      const result = reportCreateSchema.safeParse({ ...input, number });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues[0]).toMatchObject({
          path: ['number'],
          message: 'Informe o número do relatório.',
        });
    }
    expect(reportUpdateSchema.safeParse({ version: 1, number: '   ' }).success).toBe(false);
    const draft = reportCreateSchema.parse({ ...input, number: '  REL-001  ' });
    expect(draft.number).toBe('REL-001');
    expect(reportSubmissionSchema.safeParse(draft).success).toBe(false);
  });
});
describe('RBAC and workflow', () => {
  it('allows the expected transitions and rejects jumps', () => {
    expect(() =>
      assertTransition('DRAFT', 'IN_REVIEW', [...rolePermissions.INSPECTOR!]),
    ).not.toThrow();
    expect(() => assertTransition('DRAFT', 'APPROVED', [...rolePermissions.ADMIN!])).toThrow();
    expect(() =>
      assertTransition('IN_REVIEW', 'APPROVED', [...rolePermissions.OPERATOR!]),
    ).toThrow();
    expect(() => assertTransition('FINISHED', 'DRAFT', [...rolePermissions.ADMIN!])).toThrow();
  });
  it('locks approved and finished reports even for administrators', () => {
    expect(() => assertEditable('FINISHED', user('ADMIN'))).toThrow();
    expect(() => assertEditable('APPROVED', user('ADMIN'))).toThrow();
    expect(() => assertEditable('IN_REVIEW', user('INSPECTOR'))).not.toThrow();
    expect(() => assertEditable('IN_REVIEW', user('OPERATOR'))).toThrow();
  });
  it('lets operators fill reports and still supports restricting configured field paths', () => {
    const previous = { title: 'A', specificData: { observation: 'old', material: 'steel' } };
    const next = { ...previous, specificData: { observation: 'new', material: 'steel' } };
    expect(() => assertFieldAccess(previous, next, {}, user('OPERATOR'))).not.toThrow();
    const restricted = {
      ...user('OPERATOR'),
      permissions: rolePermissions.OPERATOR!.filter((code) => code !== 'reports.edit.allFields'),
    };
    expect(() => assertFieldAccess(previous, next, {}, restricted)).toThrow();
    expect(() =>
      assertFieldAccess(
        previous,
        next,
        { editableFieldsByRoleCode: { OPERATOR: ['specificData.observation'] } },
        restricted,
      ),
    ).not.toThrow();
    expect(() =>
      assertFieldAccess(
        previous,
        { ...next, title: 'B' },
        { editableFieldsByRoleCode: { OPERATOR: ['specificData.observation'] } },
        restricted,
      ),
    ).toThrow();
  });
});
