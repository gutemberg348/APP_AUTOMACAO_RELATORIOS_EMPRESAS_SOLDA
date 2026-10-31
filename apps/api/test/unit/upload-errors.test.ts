import { expect, it, vi } from 'vitest';
import { MulterError } from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../../src/middlewares/error-handler';

it('keeps the signature file limit distinct from report photo limits', () => {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  errorHandler(
    new MulterError('LIMIT_FILE_SIZE'),
    { originalUrl: '/people/signatures' } as Request,
    res as unknown as Response,
    vi.fn() as NextFunction,
  );
  expect(res.json.mock.calls[0]![0].error.message).toContain('5 MB');
});

it.each([
  ['LIMIT_FILE_SIZE', 'file', 'IMAGE_TOO_LARGE', true],
  ['LIMIT_FIELD_VALUE', 'annotations', 'UPLOAD_FIELD_TOO_LARGE', false],
  ['LIMIT_FIELD_VALUE', 'caption', 'UPLOAD_FIELD_TOO_LARGE', false],
  ['LIMIT_FILE_COUNT', 'file', 'INVALID_UPLOAD_FILE', false],
  ['LIMIT_UNEXPECTED_FILE', 'photo', 'INVALID_UPLOAD_FILE', false],
  ['LIMIT_FIELD_COUNT', undefined, 'INVALID_UPLOAD_FIELDS', false],
] as const)('distinguishes %s from image file size', (kind, field, code, mentionsSize) => {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  errorHandler(
    new MulterError(kind, field),
    {} as Request,
    res as unknown as Response,
    vi.fn() as NextFunction,
  );
  expect(res.status).toHaveBeenCalledWith(400);
  const result = res.json.mock.calls[0]![0];
  expect(result.error.code).toBe(code);
  expect(result.error.message.includes('10 MB')).toBe(mentionsSize);
});
