import type { PermissionCode } from '@weldcosta/shared';
import { useAuth } from '../stores/auth';
export function usePermission(permission: PermissionCode) {
  return useAuth((state) => state.session?.user.permissions.includes(permission) ?? false);
}
