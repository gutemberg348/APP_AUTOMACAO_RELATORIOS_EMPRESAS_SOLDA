import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { rolePermissions, type CurrentUser } from '@weldcosta/shared';
import {
  companyScope,
  projectScope,
  reportScope,
  signatureScope,
  assertCompanyAccess,
} from '../../src/middlewares/access-scope';
vi.mock('../../src/prisma/client', () => ({ prisma: {} }));
const companyId = randomUUID(),
  otherId = randomUUID();
const user = (code: string, companyIds?: string[]): CurrentUser => ({
  id: randomUUID(),
  name: code,
  email: 'scope@qa.invalid',
  phone: null,
  role: { id: randomUUID(), code, name: code },
  permissions: [...rolePermissions[code]!],
  companyIds,
});

describe('Company and report access scopes', () => {
  it.each(['ADMIN', 'MANAGER'])('%s sees all companies, projects and reports', (code) => {
    const actor = user(code);
    expect(companyScope(actor)).toEqual({});
    expect(projectScope(actor)).toEqual({});
    expect(reportScope(actor)).toEqual({});
    expect(signatureScope(actor)).toEqual({});
    expect(() => assertCompanyAccess(actor, otherId)).not.toThrow();
  });
  it('limits inspectors to assigned companies but all reports within those companies', () => {
    const actor = user('INSPECTOR', [companyId]);
    expect(companyScope(actor)).toEqual({ id: { in: [companyId] } });
    expect(projectScope(actor)).toEqual({ companyId: { in: [companyId] } });
    expect(reportScope(actor)).toEqual({ companyId: { in: [companyId] } });
    expect(() => assertCompanyAccess(actor, companyId)).not.toThrow();
    expect(() => assertCompanyAccess(actor, otherId)).toThrow('não foi liberada');
  });
  it('limits operators to assigned companies and their own reports', () => {
    const actor = user('OPERATOR', [companyId]);
    expect(reportScope(actor)).toEqual({ companyId: { in: [companyId] }, createdById: actor.id });
    expect(signatureScope(actor)).toMatchObject({
      OR: [
        { createdById: actor.id },
        {
          signatures: {
            some: {
              report: { deletedAt: null, companyId: { in: [companyId] }, createdById: actor.id },
            },
          },
        },
      ],
    });
  });
  it.each(['INSPECTOR', 'OPERATOR', 'VIEWER', 'REVIEWER'])(
    'defaults %s to no company access when assignments are absent',
    (code) => {
      const actor = user(code);
      expect(companyScope(actor)).toEqual({ id: { in: [] } });
      expect(() => assertCompanyAccess(actor, companyId)).toThrow();
    },
  );
});
