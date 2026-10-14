import { ApiError } from '../../services/api';
import { formErrorGuidance } from '../../utils/form-feedback';
export function userErrorGuidance(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'SELF_ACCESS_CHANGE' || error.code === 'LAST_ADMIN') return undefined;
    if (error.code === 'EMAIL_IN_USE')
      return 'Busque esse e-mail na lista. Se estiver em Excluídos, restaure o cadastro.';
    if (error.code === 'VERSION_CONFLICT')
      return 'Atualize o cadastro para conferir as alterações antes de tentar novamente.';
    if (error.status === 404)
      return 'Volte à lista de usuários e confira se o cadastro ainda está disponível.';
  }
  return formErrorGuidance(error);
}
