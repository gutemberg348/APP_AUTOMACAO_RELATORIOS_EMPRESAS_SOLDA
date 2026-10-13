import { useTheme } from '../../../utils/theme';
import { requestNavigation } from '../../../stores/navigation';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Company } from '@weldcosta/shared';
import { api, jsonBody } from '../../../services/api';
import { usePermission } from '../../../hooks/use-permission';
import {
  Button,
  Card,
  Loading,
  Notice,
  Page,
  PanelHeader,
  FormGrid,
  FormCell,
  Badge,
} from '../../../components/ui';
import { ConfirmDialog } from '../../../components/confirm-dialog';
import { CompanyForm } from '../../../features/companies/company-form';

import { formatInputMask } from '../../../utils/input-masks';
export default function CompanyDetail() {
  const { tokens: t, styles } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [editing, setEditing] = useState(false),
    [confirm, setConfirm] = useState(false);
  const canEdit = usePermission('companies.edit'),
    canArchive = usePermission('companies.archive'),
    client = useQueryClient();
  const query = useQuery({
    queryKey: ['company', id],
    queryFn: () => api<Company>('/companies/' + id),
  });
  const mutation = useMutation({
    mutationFn: () =>
      api(
        '/companies/' + id + '/status',
        jsonBody('PATCH', { status: query.data?.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE' }),
      ),
    onSuccess: async () => {
      await client.invalidateQueries();
      setConfirm(false);
    },
  });
  const company = query.data;
  return (
    <Page
      title={company?.name ?? 'Empresa'}
      subtitle="Dados do cliente e acesso às obras de inspeção."
      eyebrow="Empresas / Detalhes"
      back={{ label: 'Voltar para empresas', href: '/companies' }}
      action={
        <Button
          title="Ver obras"
          icon="folder"
          iconRight="arrow-right"
          onPress={() => requestNavigation(() => router.push('/projects?companyId=' + id))}
        />
      }
    >
      <Notice error={query.error || mutation.error} />
      {query.isPending && <Loading />}
      {company && (
        <>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Badge
              label={company.status === 'ACTIVE' ? 'Empresa ativa' : 'Empresa arquivada'}
              tone={company.status === 'ACTIVE' ? 'green' : 'neutral'}
            />
            {canEdit && (
              <Button
                title={editing ? 'Fechar edição' : 'Editar dados'}
                secondary
                icon={editing ? 'close' : 'edit'}
                onPress={() => requestNavigation(() => setEditing(!editing))}
              />
            )}
          </View>
          {editing && canEdit ? (
            <CompanyForm company={company} onSaved={() => setEditing(false)} />
          ) : (
            <Card>
              <PanelHeader title="Informações da empresa" icon="building" />
              <FormGrid>
                {[
                  ['Razão social', company.corporateName],
                  ['CNPJ', formatInputMask('cnpj', company.cnpj ?? '')],
                  ['Contato', company.contactName],
                  ['Telefone', formatInputMask('phone', company.phone ?? '')],
                  ['E-mail', company.email],
                ].map(([label, value]) => (
                  <FormCell key={label}>
                    <Text style={styles.label}>{label}</Text>
                    <Text style={styles.text}>{value || 'Não informado'}</Text>
                  </FormCell>
                ))}
                {!!company.notes && (
                  <FormCell full>
                    <Text style={styles.label}>Observações</Text>
                    <Text style={styles.muted}>{company.notes}</Text>
                  </FormCell>
                )}
              </FormGrid>
            </Card>
          )}
          {canArchive && !editing && (
            <Card style={{ backgroundColor: t.colors.soft }}>
              <PanelHeader
                title={
                  company.status === 'ACTIVE'
                    ? 'Arquivamento da empresa'
                    : 'Restaurar empresa ativa'
                }
                subtitle={
                  company.status === 'ACTIVE'
                    ? 'Mantenha os registros e retire o cliente da lista de empresas ativas.'
                    : 'Volte a cadastrar obras e relatórios para este cliente.'
                }
                action={
                  <Button
                    title={company.status === 'ACTIVE' ? 'Arquivar empresa' : 'Ativar empresa'}
                    secondary
                    icon="archive"
                    busy={mutation.isPending}
                    onPress={() => setConfirm(true)}
                  />
                }
              />
            </Card>
          )}
          <ConfirmDialog
            visible={confirm}
            title={company.status === 'ACTIVE' ? 'Arquivar esta empresa?' : 'Ativar esta empresa?'}
            description={
              company.status === 'ACTIVE'
                ? 'A empresa continuará acessível no filtro de arquivadas. Os registros e relatórios existentes serão preservados.'
                : 'A empresa voltará à lista de clientes ativos.'
            }
            confirmLabel={company.status === 'ACTIVE' ? 'Arquivar empresa' : 'Ativar empresa'}
            busy={mutation.isPending}
            onClose={() => setConfirm(false)}
            onConfirm={() => mutation.mutate()}
          />
        </>
      )}
    </Page>
  );
}
