import { useTheme } from '../../../utils/theme';
import { requestNavigation } from '../../../stores/navigation';
import { useState } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { Company, Paginated } from '@weldcosta/shared';
import { api } from '../../../services/api';
import { usePermission } from '../../../hooks/use-permission';
import {
  Button,
  Page,
  SearchField,
  Loading,
  Notice,
  Empty,
  Pager,
  Choice,
} from '../../../components/ui';
import { RecordList } from '../../../components/record-list';
export default function CompaniesScreen() {
  const { styles } = useTheme();
  const [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [archived, setArchived] = useState(false);
  const canCreate = usePermission('companies.create');
  const query = useQuery({
    queryKey: ['companies', search, page, archived],
    queryFn: () =>
      api<Paginated<Company>>(
        '/companies?page=' +
          page +
          '&search=' +
          encodeURIComponent(search) +
          '&status=' +
          (archived ? 'ARCHIVED' : 'ACTIVE') +
          '&sortBy=name&sortOrder=asc',
      ),
  });
  return (
    <Page
      title="Empresas"
      back={{ label: 'Voltar para início', href: '/dashboard' }}
      subtitle="Organize seus clientes e acesse as obras de cada empresa."
      eyebrow="Clientes"
      action={
        canCreate ? (
          <Button
            title="Nova empresa"
            icon="plus"
            onPress={() => requestNavigation(() => router.push('/companies/new'))}
          />
        ) : undefined
      }
    >
      <View style={[styles.row, { justifyContent: 'space-between', gap: 16 }]}>
        <View style={[styles.row, { gap: 8 }]}>
          <Choice
            label="Ativas"
            selected={!archived}
            onPress={() => {
              setArchived(false);
              setPage(1);
            }}
          />
          <Choice
            label="Arquivadas"
            selected={archived}
            onPress={() => {
              setArchived(true);
              setPage(1);
            }}
          />
        </View>
        <View style={{ flex: 1, maxWidth: 380, minWidth: 220 }}>
          <SearchField
            label="Buscar empresa"
            placeholder="Buscar nome ou razão social…"
            value={search}
            onChangeText={(text) => {
              setSearch(text);
              setPage(1);
            }}
          />
        </View>
      </View>
      <Notice error={query.error} />
      {query.isPending && <Loading />}
      {query.data && (
        <>
          {query.data.total > 0 ? (
            <>
              <Text style={[styles.caption, { letterSpacing: 0 }]}>
                {query.data.total} empresa{query.data.total === 1 ? '' : 's'}{' '}
                {archived ? 'arquivada' : 'ativa'}
                {query.data.total === 1 ? '' : 's'}
              </Text>
              <RecordList kind="company" items={query.data.items} />
              <Pager
                page={page}
                pages={query.data.pages}
                total={query.data.total}
                onChange={setPage}
              />
            </>
          ) : (
            <Empty
              title={
                search
                  ? 'Nenhuma empresa encontrada'
                  : archived
                    ? 'Nenhuma empresa arquivada'
                    : 'Organize sua carteira de clientes'
              }
              text={
                search
                  ? 'Tente buscar por outro nome ou razão social.'
                  : archived
                    ? 'As empresas arquivadas aparecerão aqui.'
                    : 'Cadastre a primeira empresa para organizar suas obras e relatórios.'
              }
              icon="building"
              action={
                canCreate && !archived && !search ? (
                  <Button
                    title="Cadastrar empresa"
                    icon="plus"
                    onPress={() => requestNavigation(() => router.push('/companies/new'))}
                  />
                ) : undefined
              }
            />
          )}
        </>
      )}
    </Page>
  );
}
