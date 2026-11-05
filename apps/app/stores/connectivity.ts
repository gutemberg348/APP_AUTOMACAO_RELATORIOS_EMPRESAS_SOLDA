import { create } from 'zustand';
export const useConnectivity = create<{ online: boolean; storageError?: string }>(() => ({
  online: true,
}));
export function offlineStorageFailure(cause: unknown) {
  console.error('Falha no armazenamento offline', cause);
  useConnectivity.setState({
    storageError:
      cause instanceof TypeError
        ? 'Não foi possível guardar os dados neste aparelho. Atualize o aplicativo e toque em Sincronizar para tentar novamente.'
        : 'Não foi possível guardar os dados no telefone. Confira o espaço livre e toque em Sincronizar para tentar novamente.',
  });
}
