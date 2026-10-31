export function photoSaveReason(cause: unknown) {
  const error = cause as { code?: string; message?: string; details?: unknown } | null;
  if (error?.code === 'VALIDATION_ERROR' && Array.isArray(error.details)) {
    const messages = error.details.flatMap((issue: { path?: unknown; message?: unknown }) => {
      if (!issue || typeof issue.message !== 'string') return [];
      const field = Array.isArray(issue.path) ? issue.path[0] : undefined;
      const label =
        field === 'annotations'
          ? 'Marcações da foto'
          : field === 'caption'
            ? 'Legenda'
            : field === 'reportPointId'
              ? 'Vínculo com o ponto'
              : 'Dados da foto';
      return [label + ': ' + issue.message];
    });
    if (messages.length) return [...new Set(messages)].slice(0, 3).join(' ');
  }
  return cause instanceof Error ? cause.message : 'Confira sua conexão.';
}

export class ReportPhotoSaveError extends Error {
  constructor(
    message: string,
    public location: { pointNumber?: string; drawing?: boolean; label: string },
    public code?: string,
  ) {
    super(message);
  }
}
