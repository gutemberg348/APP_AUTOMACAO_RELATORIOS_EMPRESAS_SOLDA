import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/client';
import { AppError } from '../errors/app-error';
import { MulterError } from 'multer';
import { isTransactionConflict } from '../errors/transaction-conflict';
export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof MulterError) {
    const limitMb = _req.originalUrl?.startsWith('/people/') ? 5 : 10;
    const [code, message] =
      error.code === 'LIMIT_FILE_SIZE'
        ? [
            'IMAGE_TOO_LARGE',
            `Esta imagem excede ${limitMb} MB. Reduza o tamanho do arquivo e envie novamente.`,
          ]
        : error.code === 'LIMIT_FIELD_VALUE'
          ? [
              'UPLOAD_FIELD_TOO_LARGE',
              error.field === 'annotations'
                ? 'As marcações desta foto excederam o limite de envio. Reduza os traços ou textos da foto e salve novamente.'
                : 'Um campo de texto deste envio excedeu o limite. Reduza a legenda ou os dados da foto e tente novamente.',
            ]
          : error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE'
            ? [
                'INVALID_UPLOAD_FILE',
                'Envie uma imagem por arquivo no campo correto. Selecione novamente a foto indicada.',
              ]
            : [
                'INVALID_UPLOAD_FIELDS',
                'O envio contém campos demais ou dados de formulário inválidos. Selecione novamente a foto e atualize o aplicativo se o problema continuar.',
              ];
    res.status(400).json({
      success: false,
      error: { code, message },
    });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.status).json({
      success: false,
      error: { code: error.code, message: error.message, details: error.details },
    });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Confira os campos informados.',
        details: error.issues,
      },
    });
    return;
  }
  if (isTransactionConflict(error)) {
    res.status(409).json({
      success: false,
      error: {
        code: 'VERSION_CONFLICT',
        message: 'Outra alteração aconteceu ao mesmo tempo. Atualize os dados e tente novamente.',
      },
    });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const status =
      error.code === 'P2025' ? 404 : error.code === 'P2002' || error.code === 'P2003' ? 409 : 500;
    res.status(status).json({
      success: false,
      error: {
        code: status === 404 ? 'NOT_FOUND' : status === 409 ? 'CONFLICT' : 'INTERNAL_ERROR',
        message:
          status === 404
            ? 'Registro não encontrado.'
            : status === 409
              ? 'O registro possui conflito ou vínculos existentes.'
              : 'Não foi possível concluir a operação.',
      },
    });
    return;
  }
  const parseError = error as { status?: number; type?: string };
  if (parseError.status === 400 || parseError.status === 413) {
    res.status(parseError.status).json({
      success: false,
      error: {
        code: 'INVALID_BODY',
        message: 'Conteúdo inválido ou maior que o limite permitido.',
      },
    });
    return;
  }
  console.error(error);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Não foi possível concluir a operação.' },
  });
};
