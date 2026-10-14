import { useState } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { userRoleLabels, type ManagedUser, type Paginated, type UserRole } from '@weldcosta/shared';
import { api } from '../../../services/api';
import { usePermission } from '../../../hooks/use-permission';
import { useTheme } from '../../../utils/theme';
import {
  Page,
  Button,
  SearchField,
  Loading,
  Notice,
  Empty,
  Pager,
  Card,
  Badge,
  FormGrid,
  FormCell,
  IconTile,
} from '../../../components/ui';
import { SelectField } from '../../../components/select-field';
import { UserActions } from '../../../features/users/user-actions';
export default function UsersScreen() {
  const { styles } = useTheme();
  const canView = usePermission('users.view'),
    canCreate = usePermission('users.create');
  const [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [status, setStatus] = useState(''),
    [role, setRole] = useState('');
  const roles = useQuery({
    queryKey: ['user-roles'],
    queryFn: () => api<UserRole[]>('/users/roles'),
    enabled: canView,
  });
  const query = useQuery({
    queryKey: ['users', 'list', search, page, status, role],
    queryFn: () =>
      api<Paginated<ManagedUser>>(
        `/users?search=${encodeURIComponent(search)}&page=${page}${status ? '&status=' + status : ''}${role ? '&roleId=' + role : ''}`,
      ),
    enabled: canView,
  });
  return (
    <Page
      title="Usuários"
      eyebrow="Administração"
      subtitle="Gerencie quem entra no sistema e o que cada pessoa pode fazer."
      back={{ label: 'Voltar para início', href: '/dashboard' }}
      action={
        canCreate ? (
          <Button title="Novo usuário" icon="plus" onPress={() => router.push('/users/new')} />
        ) : undefined
      }
    >
      {!canView ? (
        <Empty
          title="Acesso restrito"
          text="Seu perfil não permite gerenciar usuários."
          icon="shield"
        />
      ) : (
        <>
          <Card>
            <FormGrid>
              <FormCell full>
                <SearchField
                  label="Buscar usuário"
                  placeholder="Buscar por nome ou e-mail"
                  value={search}
                  onChangeText={(value) => {
                    setSearch(value);
                    setPage(1);
                  }}
                />
              </FormCell>
              <FormCell>
                <SelectField
                  label="Situação do usuário"
                  value={status}
                  clearable={false}
                  options={[
                    { value: '', label: 'Todos os usuários' },
                    { value: 'ACTIVE', label: 'Ativos' },
                    { value: 'DISABLED', label: 'Inativos' },
                    { value: 'DELETED', label: 'Excluídos' },
                  ]}
                  onChange={(value) => {
                    setStatus(value);
                    setPage(1);
                  }}
                />
              </FormCell>
              <FormCell>
                <SelectField
                  label="Perfil de acesso"
                  value={role}
                  placeholder="Todos os perfis"
                  options={(roles.data ?? []).map((item) => ({
                    value: item.id,
                    label: userRoleLabels[item.code] ?? item.name,
                  }))}
                  onChange={(value) => {
                    setRole(value);
                    setPage(1);
                  }}
                />
              </FormCell>
            </FormGrid>
          </Card>
          <Notice error={query.error ?? roles.error} />
          {query.isError && (
            <Button
              title="Tentar carregar usuários novamente"
              secondary
              onPress={() => void query.refetch()}
            />
          )}
          {query.isPending && <Loading />}
          {query.data && (
            <>
              <Text style={styles.muted}>
                {query.data.total} usuário{query.data.total === 1 ? '' : 's'} encontrado
                {query.data.total === 1 ? '' : 's'}
              </Text>
              {query.data.items.map((user) => (
                <Card key={user.id}>
                  <View
                    style={[
                      styles.row,
                      {
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
                      },
                    ]}
                  >
                    <View style={[styles.row, { flex: 1, minWidth: 160 }]}>
                      <IconTile name="user" />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.text, { fontWeight: '600', fontSize: 16 }]}>
                          {user.name}
                        </Text>
                        <Text style={styles.muted}>{user.email}</Text>
                      </View>
                    </View>
                    <Badge
                      label={
                        user.deletedAt ? 'Excluído' : user.status === 'ACTIVE' ? 'Ativo' : 'Inativo'
                      }
                      tone={
                        user.deletedAt ? 'danger' : user.status === 'ACTIVE' ? 'green' : 'neutral'
                      }
                    />
                  </View>
                  <Text style={styles.muted}>
                    {userRoleLabels[user.role.code] ?? user.role.name}
                    {user.phone ? ' · ' + user.phone : ''}
                  </Text>
                  <UserActions user={user} />
                </Card>
              ))}
              {!query.data.items.length && (
                <Empty
                  title="Nenhum usuário encontrado"
                  text={
                    search
                      ? 'Tente outro nome ou e-mail.'
                      : 'Os cadastros dessa situação aparecerão aqui.'
                  }
                  icon="user"
                />
              )}
              <Pager
                page={page}
                pages={query.data.pages}
                total={query.data.total}
                onChange={setPage}
              />
            </>
          )}
        </>
      )}
    </Page>
  );
}
