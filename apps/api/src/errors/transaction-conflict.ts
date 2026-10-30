import { Prisma } from '../generated/prisma/client';

// Interactive transactions can expose a driver error at COMMIT instead of P2034.
export function isTransactionConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code === 'P2034';
  if (!(error instanceof Error) || error.name !== 'DriverAdapterError') return false;
  const cause = error.cause as { kind?: string; originalCode?: string } | undefined;
  return (
    cause?.kind === 'TransactionWriteConflict' &&
    (cause.originalCode === '40001' || cause.originalCode === '40P01')
  );
}
