import type { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../errors/app-error';

type MediaReader = Pick<Prisma.TransactionClient, 'reportMedia'>;
export async function assertPhotoPoint(
  db: MediaReader,
  sha256: string,
  target: { projectId?: string; reportId?: string; reportPointId?: string | null },
  excludeId?: string,
) {
  // Old clients may check before selecting a report. Defer that check until
  // upload rather than guessing a project and blocking photos from other works.
  if (!target.projectId) return;
  // An unlinked attachment is not a point and cannot grant a reuse exception.
  const samePoint = target.reportId && target.reportPointId;
  const conflict = await db.reportMedia.findFirst({
    where: {
      sha256,
      report: { projectId: target.projectId, deletedAt: null },
      ...(excludeId ? { id: { not: excludeId } } : {}),
      ...(samePoint
        ? {
            OR: [
              { reportId: { not: target.reportId } },
              { reportPointId: null },
              { reportPointId: { not: target.reportPointId! } },
            ],
          }
        : {}),
    },
    select: { id: true },
  });
  if (conflict)
    throw new AppError(
      409,
      'DUPLICATE_MEDIA',
      'Esta foto já está vinculada a outro ponto ou relatório desta obra. Você pode repetir ao lado no mesmo ponto ou usar em outra obra. Para outro ponto desta obra, escolha uma foto diferente.',
    );
}

export async function lockPhotoHash(tx: Prisma.TransactionClient, sha256: string) {
  // Serialize identical uploads even when they target different reports.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${sha256}, 0))`;
}
