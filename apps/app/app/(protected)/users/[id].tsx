import { useState } from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { userRoleLabels, userRoleDescriptions, type ManagedUser } from '@weldcosta/shared';
import { api } from '../../../services/api';
import { usePermission } from '../../../hooks/use-permission';
import { useTheme } from '../../../utils/theme';
import { requestNavigation } from '../../../stores/navigation';
import {
  Page,
  Loading,
  Notice,
  Empty,
  Button,
  Card,
  PanelHeader,
  Badge,
} from '../../../components/ui';
import { UserForm } from '../../../features/users/user-form';
import { UserActions } from '../../../features/users/user-actions';
export default function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { styles } = useTheme(),
    client = useQueryClient();
  const canView = usePermission('users.view'),
    canEdit = usePermission('users.edit');
  const [editing, setEditing] = useState(false);
  const query = useQuery({
    queryKey: ['users', 'detail', id],
    queryFn: () => api<ManagedUser>('/users/' + id),
    enabled: canView && !!id,
    refetchOnWindowFocus: false,
  });
  const user = query.data;
  return (
    <Page
      title={user?.name ?? 'Usuário'}
      subtitle={user?.email}
      eyebrow="Administração / Usuários"
      back={{ label: 'Voltar para usuários', href: '/users' }}
    >
      {!canView ? (
        <Empty
          title="Acesso restrito"
          text="Seu perfil não permite gerenciar usuários."
          icon="shield"
        />
      ) : (
        <>
          <Notice error={query.error} />
          {query.isError && (
            <Button title="Tentar novamente" secondary onPress={() => void query.refetch()} />
          )}
          {query.isPending && <Loading />}
          {user &&
            (editing ? (
              <UserForm
                user={user}
                onSaved={(saved) => {
                  setEditing(false);
                  client.setQueryData(['users', 'detail', id], saved);
                }}
                onCancel={() =>
                  requestNavigation(() => {
                    setEditing(false);
                    void query.refetch();
                  })
                }
              />
            ) : (
              <>
                <Card>
                  <PanelHeader
                    title="Dados e acesso"
                    subtitle="Informações cadastradas para entrar no sistema."
                    icon="user"
                  />
                  <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
                    <Badge
                      label={
                        user.deletedAt ? 'Excluído' : user.status === 'ACTIVE' ? 'Ativo' : 'Inativo'
                      }
                      tone={
                        user.deletedAt ? 'danger' : user.status === 'ACTIVE' ? 'green' : 'neutral'
                      }
                    />
                    {canEdit && !user.deletedAt && (
                      <Button
                        title="Editar dados"
                        icon="edit"
                        secondary
                        onPress={() => setEditing(true)}
                      />
                    )}
                  </View>
                  <Text style={styles.label}>Perfil de acesso</Text>
                  <Text style={styles.text}>
                    {userRoleLabels[user.role.code] ?? user.role.name}
                  </Text>
                  <Text style={styles.muted}>{userRoleDescriptions[user.role.code]}</Text>
                  <Text style={styles.label}>E-mail</Text>
                  <Text style={styles.text}>{user.email}</Text>
                  <Text style={styles.label}>Telefone</Text>
                  <Text style={styles.text}>{user.phone || 'Não informado'}</Text>
                </Card>
                <Card>
                  <PanelHeader
                    title="Gerenciar acesso"
                    subtitle={
                      user.deletedAt
                        ? 'Restaure o cadastro para liberar o acesso novamente.'
                        : 'Altere a senha e controle o acesso ao sistema.'
                    }
                    icon="shield"
                  />
                  <UserActions
                    user={user}
                    detail
                    onUpdated={(saved) => {
                      if (saved) client.setQueryData(['users', 'detail', id], saved);
                    }}
                  />
                </Card>
              </>
            ))}
        </>
      )}
    </Page>
  );
}
