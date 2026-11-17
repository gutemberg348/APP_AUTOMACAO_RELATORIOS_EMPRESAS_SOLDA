import { customReportPages, type CurrentUser } from '@weldcosta/shared';
import { isDeepStrictEqual } from 'node:util';
import { AppError } from '../../errors/app-error';

export function assertCustomDrawingAccess(
  user: CurrentUser,
  next: unknown,
  previous: unknown = {},
) {
  if (user.permissions.includes('drawing.edit')) return;
  const drawings = (data: unknown) =>
    customReportPages(data)
      .filter((p) => p.kind === 'drawing' || p.kind === 'blank')
      .map((p) => ({ id: p.id, drawings: p.drawings, points: p.points }));
  if (!isDeepStrictEqual(drawings(next), drawings(previous)))
    throw new AppError(
      403,
      'FORBIDDEN',
      'Você não possui permissão para editar desenhos nas páginas personalizadas.',
    );
}
