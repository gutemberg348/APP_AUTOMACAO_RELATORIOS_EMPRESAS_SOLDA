import { useTheme } from '../../../utils/theme';
import { requestNavigation } from '../../../stores/navigation';
import { useEffect, useState } from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  reportDisplayStatuses,
  displayReportStatus,
  type Report,
  type Paginated,
  type ReportType,
} from '@weldcosta/shared';
import { api, jsonBody, ApiError } from '../../../services/api';
import { usePermission } from '../../../hooks/use-permission';
import {
  Button,
  Page,
  SearchField,
  Loading,
  Notice,
  Empty,
  Pager,
  Card,
  PanelHeader,
  FormGrid,
  FormCell,
} from '../../../components/ui';
import { EntityPicker } from '../../../components/entity-picker';
import { DateField } from '../../../components/date-field';
import { SelectField } from '../../../components/select-field';
import { isISODate } from '../../../utils/dates';
import { ReportList, statusLabels } from '../../../features/reports/report-card';
import { ConfirmDialog } from '../../../components/confirm-dialog';
export default function ReportsScreen() {
  const { styles } = useTheme();
  const client = useQueryClient();
  const [deleting, setDeleting] = useState<Report>();
  const canDelete = usePermission('reports.delete');
  const remove = useMutation({
    mutationFn: (report: Report) =>
      api('/reports/' + report.id, jsonBody('DELETE', { version: report.version })),
    onSuccess: async (_, removed) => {
      setDeleting(undefined);
      client.removeQueries({ queryKey: ['report', removed.id] });
      if (page > 1 && query.data?.items.length === 1) setPage((value) => value - 1);
      await client.invalidateQueries({ queryKey: ['reports'] });
      await client.invalidateQueries({ queryKey: ['dashboard'] });
      await client.invalidateQueries({ queryKey: ['report-autofill'] });
    },
    onError: (error) => {
      setDeleting(undefined);
      if (error instanceof ApiError && (error.status === 409 || error.status === 404))
        void client.invalidateQueries({ queryKey: ['reports'] });
    },
  });
  const params = useLocalSearchParams<{
    projectId?: string;
    companyId?: string;
    status?: string;
    typeCode?: string;
  }>();
  const [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [status, setStatus] = useState(
      reportDisplayStatuses.find(
        (value) =>
          value ===
          (params.status === 'FINISHED' ? displayReportStatus('FINISHED') : params.status),
      ) ?? '',
    ),
    [type, setType] = useState(''),
    [initialType, setInitialType] = useState(params.typeCode ?? '');
  const [company, setCompany] = useState(params.companyId ?? ''),
    [project, setProject] = useState(params.projectId ?? ''),
    [filters, setFilters] = useState(false),
    [dateFrom, setDateFrom] = useState(''),
    [dateTo, setDateTo] = useState('');
  const canCreate = usePermission('reports.create'),
    mobile = useWindowDimensions().width < 640;
  useEffect(() => {
    setStatus(
      reportDisplayStatuses.find(
        (value) =>
          value ===
          (params.status === 'FINISHED' ? displayReportStatus('FINISHED') : params.status),
      ) ?? '',
    );
    setPage(1);
  }, [params.status]);
  useEffect(() => {
    setInitialType(params.typeCode ?? '');
    setType('');
    setPage(1);
  }, [params.typeCode]);
  useEffect(() => {
    setCompany(params.companyId ?? '');
    setProject(params.projectId ?? '');
    setPage(1);
  }, [params.companyId, params.projectId]);
  const types = useQuery({
    queryKey: ['report-types'],
    queryFn: () => api<Paginated<ReportType>>('/report-types?limit=100&sortBy=name&sortOrder=asc'),
  });
  const resolvedType =
    type || types.data?.items.find((item) => item.code === initialType)?.id || '';
  const validFrom = isISODate(dateFrom),
    validTo = isISODate(dateTo);
  const invalidRange = validFrom && validTo && dateTo < dateFrom;
  const queryString =
    'page=' +
    page +
    '&search=' +
    encodeURIComponent(search) +
    (status ? '&status=' + status : '') +
    (resolvedType ? '&reportTypeId=' + resolvedType : '') +
    (company ? '&companyId=' + company : '') +
    (project ? '&projectId=' + project : '') +
    (validFrom ? '&dateFrom=' + encodeURIComponent(dateFrom) : '') +
    (validTo ? '&dateTo=' + encodeURIComponent(dateTo) : '');
  const query = useQuery({
    queryKey: ['reports', queryString],
    queryFn: () => api<Paginated<Report>>('/reports?' + queryString),
    enabled: !invalidRange,
  });
  useEffect(() => {
    if (query.data && page > Math.max(1, query.data.pages)) setPage(Math.max(1, query.data.pages));
  }, [query.data, page]);
  const count = [resolvedType, company, project, dateFrom, dateTo].filter(Boolean).length;
  const clear = () => {
    setType('');
    setInitialType('');
    setCompany('');
    setProject('');
    setDateFrom('');
    setDateTo('');
    setStatus('');
    setSearch('');
    setPage(1);
  };
  return (
    <Page
      title="Relatórios"
      subtitle="Organize os registros e acompanhe cada etapa da inspeção."
      eyebrow="Documentação técnica"
      back={
        params.projectId
          ? { label: 'Voltar para obra', href: '/projects/' + params.projectId }
          : params.companyId
            ? { label: 'Voltar para empresa', href: '/companies/' + params.companyId }
            : { label: 'Voltar para início', href: '/dashboard' }
      }
      action={
        canCreate ? (
          <Button
            title="Novo relatório"
            icon="plus"
            onPress={() =>
              requestNavigation(() =>
                router.push('/reports/new?companyId=' + company + '&projectId=' + project),
              )
            }
          />
        ) : undefined
      }
    >
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <SearchField
            label="Buscar por número ou título"
            placeholder="Buscar número ou título do relatório…"
            value={search}
            onChangeText={(text) => {
              setSearch(text);
              setPage(1);
            }}
          />
        </View>
        <Button
          title={'Filtros' + (count ? ' (' + count + ')' : '')}
          secondary
          icon="filter"
          onPress={() => setFilters(!filters)}
        />
        {count > 0 && <Button title="Limpar" variant="ghost" onPress={clear} />}
      </View>
      <View style={{ maxWidth: 420, width: '100%' }}>
        <SelectField
          label="Status do relatório"
          icon="filter"
          value={status}
          clearable={false}
          options={[
            { value: '', label: 'Todos os status', icon: 'layers' },
            ...reportDisplayStatuses.map((value) => ({ value, label: statusLabels[value] })),
          ]}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />
      </View>
      {filters && (
        <Card>
          <PanelHeader
            title="Refinar resultados"
            subtitle="Combine os filtros para encontrar a documentação desejada."
            action={<Button title="Limpar filtros" small variant="ghost" onPress={clear} />}
          />
          <FormGrid>
            <FormCell>
              <SelectField
                label="Tipo de inspeção"
                value={resolvedType}
                icon="report"
                options={[
                  { value: '', label: 'Todos os tipos', icon: 'layers' },
                  ...(types.data?.items.map((item) => ({
                    value: item.id,
                    label: item.name,
                    badge: item.code,
                    icon: 'report' as const,
                  })) ?? []),
                ]}
                onChange={(id) => {
                  setType(id);
                  setInitialType('');
                  setPage(1);
                }}
              />
            </FormCell>
            <FormCell>
              <EntityPicker
                label="Empresa"
                endpoint="/companies"
                value={company}
                onChange={(id) => {
                  setCompany(id);
                  setProject('');
                  setPage(1);
                }}
              />
            </FormCell>
            {!!company && (
              <FormCell>
                <EntityPicker
                  label="Obra"
                  endpoint={'/projects?companyId=' + company}
                  value={project}
                  onChange={(id) => {
                    setProject(id);
                    setPage(1);
                  }}
                />
              </FormCell>
            )}
            <FormCell>
              <DateField
                label="Data inicial"
                value={dateFrom}
                onChangeText={(text) => {
                  setDateFrom(text);
                  setPage(1);
                }}
              />
            </FormCell>
            <FormCell>
              <DateField
                label="Data final"
                minDate={dateFrom}
                value={dateTo}
                onChangeText={(text) => {
                  setDateTo(text);
                  setPage(1);
                }}
              />
            </FormCell>
          </FormGrid>
        </Card>
      )}
      <Notice error={query.error || types.error || remove.error} />
      {invalidRange && <Notice error="A data final deve ser igual ou posterior à data inicial." />}
      {query.isPending && !invalidRange && <Loading />}
      {query.data && !invalidRange && (
        <>
          {query.data.total > 0 ? (
            <>
              <Text style={[styles.caption, { letterSpacing: 0 }]}>
                {query.data.total} relatório{query.data.total === 1 ? '' : 's'} encontrado
                {query.data.total === 1 ? '' : 's'}
                {mobile ? '' : ' · Selecione um registro para abrir'}
              </Text>
              <ReportList
                reports={query.data.items}
                onDelete={
                  canDelete
                    ? (report) => {
                        remove.reset();
                        setDeleting(report);
                      }
                    : undefined
                }
              />
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
                search || status || count
                  ? 'Nenhum relatório encontrado'
                  : 'Registre sua próxima inspeção'
              }
              text={
                search || status || count
                  ? 'Ajuste a busca ou os filtros para encontrar outros registros.'
                  : 'Escolha o tipo de ensaio e salve o primeiro relatório da sua operação.'
              }
              icon="report"
              action={
                search || status || count ? (
                  <Button title="Limpar filtros" secondary onPress={clear} />
                ) : canCreate ? (
                  <Button
                    title="Criar relatório"
                    icon="plus"
                    onPress={() => requestNavigation(() => router.push('/reports/new'))}
                  />
                ) : undefined
              }
            />
          )}
        </>
      )}
      <ConfirmDialog
        visible={!!deleting}
        title="Excluir este relatório?"
        description={`O relatório ${deleting?.number || deleting?.title || 'sem número'} (${deleting ? statusLabels[deleting.status] : ''}) deixará de aparecer nas listas. Dados, fotos, desenhos e PDFs serão preservados no histórico.`}
        confirmLabel="Excluir relatório"
        danger
        busy={remove.isPending}
        onClose={() => {
          if (!remove.isPending) setDeleting(undefined);
        }}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting);
        }}
      />
    </Page>
  );
}
