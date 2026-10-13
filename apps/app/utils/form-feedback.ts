import { ApiError } from '../services/api';

export type ValidationIssue = { path: readonly PropertyKey[]; code: string; message: string };

export function apiValidationIssues(error: unknown): ValidationIssue[] {
  if (
    !(error instanceof ApiError) ||
    error.code !== 'VALIDATION_ERROR' ||
    !Array.isArray(error.details)
  )
    return [];
  return error.details.filter(
    (issue): issue is ValidationIssue =>
      !!issue &&
      Array.isArray(issue.path) &&
      typeof issue.message === 'string' &&
      typeof issue.code === 'string',
  );
}

export function formErrorGuidance(error: unknown): string | undefined {
  if (!error) return undefined;
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Entre novamente para continuar.';
    if (error.status === 403) return 'Peça ao administrador acesso para realizar esta ação.';
    if (error.status === 404)
      return 'Confira se a empresa, a obra ou o relatório ainda está disponível antes de continuar.';
    if (error.status === 409)
      return 'Confira o cadastro e possíveis alterações feitas por outra pessoa. Guarde suas edições antes de reabrir o registro.';
    if (error.status === 0 || error.status >= 500 || error.code === 'INVALID_RESPONSE')
      return 'Confira a conexão e tente novamente. Se a falha ocorreu ao salvar um cadastro novo, confira a lista antes de repetir para evitar duplicação.';
    if (error.status === 429) return 'Aguarde alguns instantes e tente novamente.';
  }
  return 'Corrija os campos indicados e tente salvar novamente. O preenchimento continua nesta tela.';
}
