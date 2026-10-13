import { discardAndNavigate, useNavigationGuard } from '../stores/navigation';
import { ConfirmDialog } from './confirm-dialog';
export function NavigationConfirmation() {
  const pending = useNavigationGuard((state) => state.pending);
  return (
    <ConfirmDialog
      visible={!!pending}
      title="Descartar alterações?"
      description="Há informações ainda não salvas neste formulário. Salve o progresso ou descarte as alterações para continuar."
      confirmLabel="Descartar e continuar"
      onClose={() => useNavigationGuard.setState({ pending: null })}
      onConfirm={discardAndNavigate}
    />
  );
}
