import { describe, expect, it, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '../../src/generated/prisma/client';
import { errorHandler } from '../../src/middlewares/error-handler';
import { isTransactionConflict } from '../../src/errors/transaction-conflict';

const driverError = (originalCode: string, kind = 'TransactionWriteConflict') => {
  const error = new Error('database details', { cause: { originalCode, kind } });
  error.name = 'DriverAdapterError';
  return error;
};

describe('concurrent database writes', () => {
  it.each([
    new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2034', clientVersion: '7' }),
    driverError('40001'),
    driverError('40P01'),
  ])('returns a recoverable conflict without exposing database details', (error) => {
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    errorHandler(error, {} as Request, response as unknown as Response, vi.fn() as NextFunction);
    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'VERSION_CONFLICT',
        message: expect.stringContaining('Atualize os dados'),
      },
    });
    expect(JSON.stringify(response.json.mock.calls)).not.toContain('database details');
  });

  it('does not disguise unrelated database errors as concurrent edits', () => {
    for (const error of [
      null,
      new Error('network'),
      driverError('23505'),
      driverError('40001', 'Other'),
    ])
      expect(isTransactionConflict(error)).toBe(false);
  });
});
