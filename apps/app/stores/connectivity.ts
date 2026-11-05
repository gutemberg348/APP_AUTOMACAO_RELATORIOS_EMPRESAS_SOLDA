import { create } from 'zustand';
export const useConnectivity = create<{ online: boolean; storageError?: string }>(() => ({
  online: true,
}));
export function offlineStorageFailure(cause: unknown) {
  useConnectivity.setState({
    storageError:
      'Não foi possível salvar no telefone. Confira o espaço livre e tente novamente. ' +
      (cause instanceof Error ? cause.message : ''),
  });
}
