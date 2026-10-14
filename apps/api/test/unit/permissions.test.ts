import { describe, expect, it } from 'vitest';
import { hasUserPermission, permissions, rolePermissions } from '@weldcosta/shared';

describe('Administrator-only actions shared by the UI and API', () => {
  it.each(['MANAGER', 'REVIEWER', 'INSPECTOR', 'OPERATOR', 'VIEWER'])(
    'blocks %s from publishing tutorials or registering users even with all permission codes',
    (code) => {
      const user = { role: { code }, permissions };
      expect(hasUserPermission(user, 'training.manage')).toBe(false);
      expect(hasUserPermission(user, 'users.create')).toBe(false);
      expect(hasUserPermission(user, 'training.view')).toBe(true);
    },
  );
  it('permits the administrator and still requires the permission to be granted', () => {
    const user = { role: { code: 'ADMIN' }, permissions };
    expect(hasUserPermission(user, 'training.manage')).toBe(true);
    expect(hasUserPermission(user, 'users.create')).toBe(true);
    expect(hasUserPermission({ ...user, permissions: [] }, 'users.create')).toBe(false);
  });
  it('preserves ordinary editing and viewing for other roles', () => {
    const user = { role: { code: 'INSPECTOR' }, permissions: rolePermissions.INSPECTOR! };
    expect(hasUserPermission(user, 'reports.edit')).toBe(true);
    expect(hasUserPermission(user, 'training.view')).toBe(true);
    expect(hasUserPermission(user, 'reports.approve')).toBe(true);
    expect(hasUserPermission(user, 'people.manage')).toBe(false);
    expect(hasUserPermission(user, 'users.view')).toBe(false);
  });
});
