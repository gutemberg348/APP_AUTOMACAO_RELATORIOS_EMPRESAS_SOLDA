import { router } from 'expo-router';
import { Page, Empty } from '../../../components/ui';
import { UserForm } from '../../../features/users/user-form';
import { usePermission } from '../../../hooks/use-permission';
import { requestNavigation } from '../../../stores/navigation';
export default function NewUserScreen() {
  const canCreate = usePermission('users.create');
  return (
    <Page
      title="Novo usuário"
      subtitle="Cadastre os dados e escolha o perfil de acesso."
      eyebrow="Administração / Usuários"
      back={{ label: 'Voltar para usuários', href: '/users' }}
    >
      {canCreate ? (
        <UserForm
          onSaved={(user) => router.replace('/users/' + user.id)}
          onCancel={() => requestNavigation(() => router.replace('/users'))}
        />
      ) : (
        <Empty
          title="Acesso restrito"
          text="Seu perfil não permite cadastrar usuários."
          icon="shield"
        />
      )}
    </Page>
  );
}
