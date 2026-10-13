import { useTheme } from '../../../utils/theme';
import { requestNavigation } from '../../../stores/navigation';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Project } from '@weldcosta/shared';
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
import { ProjectForm } from '../../../features/projects/project-form';

import { formatDate } from '../../../utils/format';
export default function ProjectDetail() {
  const { tokens: t, styles } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>(),
    [editing, setEditing] = useState(false),
    [confirm, setConfirm] = useState(false);
  const canEdit = usePermission('projects.edit'),
    canArchive = usePermission('projects.archive'),
    client = useQueryClient();
  const query = useQuery({
    queryKey: ['project', id],
    queryFn: () => api<Project>('/projects/' + id),
  });
  const mutation = useMutation({
    mutationFn: () =>
      api(
        '/projects/' + id + '/status',
        jsonBody('PATCH', { status: query.data?.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE' }),
      ),
    onSuccess: async () => {
      await client.invalidateQueries();
      setConfirm(false);
    },
  });
  const project = query.data;
  return (
    <Page
      title={project?.name ?? 'Obra'}
      subtitle={project?.company?.name ?? 'Informações do projeto e suas inspeções.'}
      eyebrow="Obras / Detalhes"
      back={{
        label: 'Voltar para obras',
        href: {
          pathname: '/projects',
          params: project?.companyId ? { companyId: project.companyId } : {},
        },
      }}
      action={
        <Button
          title="Ver relatórios"
          icon="report"
          iconRight="arrow-right"
          onPress={() => requestNavigation(() => router.push('/reports?projectId=' + id))}
        />
      }
    >
      <Notice error={query.error || mutation.error} />
      {query.isPending && <Loading />}
      {project && (
        <>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Badge
              label={project.status === 'ACTIVE' ? 'Obra ativa' : 'Obra arquivada'}
              tone={project.status === 'ACTIVE' ? 'green' : 'neutral'}
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
            <ProjectForm project={project} onSaved={() => setEditing(false)} />
          ) : (
            <Card>
              <PanelHeader title="Informações do projeto" icon="folder" />
              <FormGrid>
                {[
                  ['Empresa', project.company?.name],
                  ['Código', project.code],
                  ['Localização', project.location],
                  ['Responsável', project.responsible],
                  ['Data inicial', formatDate(project.startDate)],
                  ['Data final', formatDate(project.endDate)],
                ].map(([label, value]) => (
                  <FormCell key={label}>
                    <Text style={styles.label}>{label}</Text>
                    <Text style={styles.text}>{value || 'Não informado'}</Text>
                  </FormCell>
                ))}
                {!!project.description && (
                  <FormCell full>
                    <Text style={styles.label}>Descrição</Text>
                    <Text style={styles.muted}>{project.description}</Text>
                  </FormCell>
                )}
              </FormGrid>
            </Card>
          )}
          {canArchive && !editing && (
            <Card style={{ backgroundColor: t.colors.soft }}>
              <PanelHeader
                title={
                  project.status === 'ACTIVE' ? 'Arquivamento da obra' : 'Restaurar obra ativa'
                }
                subtitle={
                  project.status === 'ACTIVE'
                    ? 'Organize os projetos encerrados preservando os relatórios existentes.'
                    : 'Retome o registro de novas inspeções para esta obra.'
                }
                action={
                  <Button
                    title={project.status === 'ACTIVE' ? 'Arquivar obra' : 'Ativar obra'}
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
            title={project.status === 'ACTIVE' ? 'Arquivar esta obra?' : 'Ativar esta obra?'}
            description={
              project.status === 'ACTIVE'
                ? 'A obra passará para a lista de arquivadas. Todos os relatórios existentes serão preservados.'
                : 'A obra voltará à lista de projetos ativos.'
            }
            confirmLabel={project.status === 'ACTIVE' ? 'Arquivar obra' : 'Ativar obra'}
            busy={mutation.isPending}
            onClose={() => setConfirm(false)}
            onConfirm={() => mutation.mutate()}
          />
        </>
      )}
    </Page>
  );
}
