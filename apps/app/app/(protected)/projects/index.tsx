import { useTheme } from '../../../utils/theme';
import { requestNavigation } from '../../../stores/navigation';
import { useState } from 'react';
import { View, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { Project, Paginated, Company } from '@weldcosta/shared';
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
export default function ProjectsScreen() {
  const { styles } = useTheme();
  const { companyId = '' } = useLocalSearchParams<{ companyId?: string }>();
  const [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [archived, setArchived] = useState(false);
  const canCreate = usePermission('projects.create');
  const company = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => api<Company>('/companies/' + companyId),
    enabled: !!companyId,
  });
  const query = useQuery({
    queryKey: ['projects', search, page, companyId, archived],
    queryFn: () =>
      api<Paginated<Project>>(
        '/projects?page=' +
          page +
          '&search=' +
          encodeURIComponent(search) +
          '&status=' +
          (archived ? 'ARCHIVED' : 'ACTIVE') +
          '&sortBy=name&sortOrder=asc' +
          (companyId ? '&companyId=' + companyId : ''),
      ),
  });
  return (
    <Page
      title="Obras"
      subtitle={
        company.data
          ? 'Projetos de ' + company.data.name
          : 'Acompanhe os projetos e frentes de inspeção dos seus clientes.'
      }
      eyebrow="Projetos de inspeção"
      back={{ label: 'Voltar para empresas', href: '/companies' }}
      action={
        canCreate ? (
          <Button
            title="Nova obra"
            icon="plus"
            onPress={() =>
              requestNavigation(() => router.push('/projects/new?companyId=' + companyId))
            }
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
            label="Buscar obra"
            placeholder="Buscar nome ou código…"
            value={search}
            onChangeText={(text) => {
              setSearch(text);
              setPage(1);
            }}
          />
        </View>
      </View>
      <Notice error={query.error || company.error} />
      {query.isPending && <Loading />}
      {query.data && (
        <>
          {query.data.total > 0 ? (
            <>
              <Text style={[styles.caption, { letterSpacing: 0 }]}>
                {query.data.total} obra{query.data.total === 1 ? '' : 's'} encontrada
                {query.data.total === 1 ? '' : 's'}
              </Text>
              <RecordList kind="project" items={query.data.items} />
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
                  ? 'Nenhuma obra encontrada'
                  : archived
                    ? 'Nenhuma obra arquivada'
                    : 'Tudo começa com uma obra'
              }
              text={
                search
                  ? 'Tente buscar por outro nome ou código de projeto.'
                  : archived
                    ? 'As obras arquivadas aparecerão aqui.'
                    : 'Cadastre uma obra e mantenha todas as inspeções do projeto reunidas.'
              }
              icon="folder"
              action={
                canCreate && !archived && !search ? (
                  <Button
                    title="Cadastrar obra"
                    icon="plus"
                    onPress={() =>
                      requestNavigation(() => router.push('/projects/new?companyId=' + companyId))
                    }
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
