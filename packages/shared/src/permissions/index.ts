export const permissions = [
  'companies.view',
  'companies.create',
  'companies.edit',
  'companies.archive',
  'projects.view',
  'projects.create',
  'projects.edit',
  'projects.archive',
  'reports.view',
  'reports.create',
  'reports.edit',
  'reports.edit.allFields',
  'reports.submit',
  'reports.review',
  'reports.approve',
  'reports.finish',
  'reports.delete',
  'media.upload',
  'media.delete',
  'drawing.edit',
  'users.view',
  'users.create',
  'users.edit',
  'users.disable',
  'users.delete',
  'roles.view',
  'roles.edit',
  'training.view',
  'training.manage',
  'people.view',
  'people.manage',
  'pdf.generate',
  'pdf.download',
] as const;
export type PermissionCode = (typeof permissions)[number];
const view = [
  'companies.view',
  'projects.view',
  'reports.view',
  'training.view',
  'pdf.download',
] satisfies PermissionCode[];
export const rolePermissions: Record<string, readonly PermissionCode[]> = {
  ADMIN: permissions,
  MANAGER: permissions.filter(
    (code) =>
      !code.startsWith('users.') && !code.startsWith('roles.') && code !== 'training.manage',
  ),
  REVIEWER: [
    ...view,
    'reports.edit',
    'reports.review',
    'reports.approve',
    'reports.finish',
    'pdf.generate',
  ],
  INSPECTOR: permissions.filter(
    (code) =>
      !code.startsWith('users.') &&
      !code.startsWith('roles.') &&
      !code.startsWith('people.') &&
      code !== 'training.manage',
  ),
  OPERATOR: [
    ...view,
    'reports.create',
    'reports.edit',
    'reports.edit.allFields',
    'reports.submit',
    'reports.delete',
    'media.upload',
    'media.delete',
    'drawing.edit',
    'pdf.generate',
  ],
  VIEWER: view,
};
export function hasPermission(granted: readonly string[], permission: PermissionCode) {
  return granted.includes(permission);
}

// Publishing tutorials and creating accounts always require the administrator role,
// including when a different role has been granted those permissions in the database.
export function hasUserPermission(
  user: { role: { code: string }; permissions: readonly string[] },
  permission: PermissionCode,
) {
  if (
    (permission === 'training.manage' || permission === 'users.create') &&
    user.role.code !== 'ADMIN'
  )
    return false;
  return (
    (rolePermissions[user.role.code]?.includes(permission) ?? false) &&
    hasPermission(user.permissions, permission)
  );
}

export function hasGlobalCompanyAccess(roleCode: string) {
  return roleCode === 'ADMIN' || roleCode === 'MANAGER';
}
