import {
  hasPermission,
  reportConfigSchema,
  type CurrentUser,
  type ReportStatus,
  type PermissionCode,
} from '@weldcosta/shared';
import { AppError } from '../../errors/app-error';
const transitions: Partial<Record<ReportStatus, Partial<Record<ReportStatus, PermissionCode>>>> = {
  DRAFT: { IN_REVIEW: 'reports.submit' },
  IN_REVIEW: { APPROVED: 'reports.approve', DRAFT: 'reports.review' },
  APPROVED: { FINISHED: 'reports.finish' },
};
export function assertTransition(from: ReportStatus, to: ReportStatus, permissions: string[]) {
  const permission = transitions[from]?.[to];
  if (!permission)
    throw new AppError(409, 'INVALID_TRANSITION', 'Transição de status não permitida.');
  if (!hasPermission(permissions, permission))
    throw new AppError(403, 'FORBIDDEN', 'Você não possui permissão para esta ação.');
}
export function assertEditable(status: ReportStatus, user: CurrentUser) {
  if (status === 'APPROVED' || status === 'FINISHED')
    throw new AppError(
      409,
      'REPORT_LOCKED',
      'O relatório aprovado ou finalizado está bloqueado para edição.',
    );
  if (status === 'IN_REVIEW' && !hasPermission(user.permissions, 'reports.review'))
    throw new AppError(403, 'FORBIDDEN', 'O relatório está em revisão.');
}
function changedPaths(previous: unknown, next: unknown, prefix = ''): string[] {
  if (JSON.stringify(previous) === JSON.stringify(next)) return [];
  if (
    previous &&
    next &&
    typeof previous === 'object' &&
    typeof next === 'object' &&
    !Array.isArray(previous) &&
    !Array.isArray(next)
  ) {
    const a = previous as Record<string, unknown>,
      b = next as Record<string, unknown>;
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((key) =>
      changedPaths(a[key], b[key], prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}
export function assertFieldAccess(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
  config: unknown,
  user: CurrentUser,
) {
  if (hasPermission(user.permissions, 'reports.edit.allFields')) return;
  const allowed = reportConfigSchema.parse(config).editableFieldsByRoleCode[user.role.code] ?? [];
  const denied = changedPaths(previous, next).filter((field) => !allowed.includes(field));
  if (denied.length)
    throw new AppError(
      403,
      'FIELD_FORBIDDEN',
      'Um ou mais campos não estão liberados para seu cargo.',
      { fields: denied },
    );
}
