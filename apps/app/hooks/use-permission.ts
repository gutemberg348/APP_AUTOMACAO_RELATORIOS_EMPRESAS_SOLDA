import { hasUserPermission, type PermissionCode } from '@weldcosta/shared';
import { useAuth } from '../stores/auth';
export function usePermission(permission: PermissionCode) {
  return useAuth((state) =>
    state.session ? hasUserPermission(state.session.user, permission) : false,
  );
}
