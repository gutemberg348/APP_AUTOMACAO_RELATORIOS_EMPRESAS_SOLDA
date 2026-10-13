import { useTheme } from '../../../utils/theme';
import { requestNavigation } from '../../../stores/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, router } from 'expo-router';
import { View, Text, Pressable } from 'react-native';
import {
  buildReportDefaults,
  type ReportType,
  type Paginated,
  type Project,
} from '@weldcosta/shared';
import { api } from '../../../services/api';
import { usePermission } from '../../../hooks/use-permission';
import {
  Card,
  Page,
  Notice,
  Loading,
  Empty,
  PanelHeader,
  FormGrid,
  FormCell,
  Button,
  Info,
  IconTile,
  Badge,
  selectionState,
} from '../../../components/ui';
import { Icon, type IconName } from '../../../components/icon';
import { EntityPicker } from '../../../components/entity-picker';
import { SelectTrigger } from '../../../components/select-field';
import { ReportForm } from '../../../features/reports/report-form';
import { ReportProgress } from '../../../features/reports/report-progress';

const descriptions: Record<string, { icon: IconName; text: string }> = {
  EVS: { icon: 'eye', text: 'Identificação, processo e critérios de inspeção.' },
  LP: { icon: 'layers', text: 'Dados do ensaio e materiais utilizados.' },
  TH: { icon: 'tool', text: 'Dados do teste, equipamento e manômetro.' },
  ME: { icon: 'edit', text: 'Espessura de projeto e identificação do equipamento.' },
  RDO: { icon: 'calendar', text: 'Registro diário e observações de campo.' },
};
export default function NewReport() {
  const { tokens: t, styles } = useTheme();
  const params = useLocalSearchParams<{ companyId?: string; projectId?: string }>();
  const [companyId, setCompanyId] = useState(params.companyId ?? ''),
    [projectId, setProjectId] = useState(params.projectId ?? ''),
    [typeId, setTypeId] = useState(''),
    [formRevision, setFormRevision] = useState(0);
  const [stage, setStage] = useState<'context' | 'type' | 'form'>('context');
  const changeContext = (action: () => void) =>
    requestNavigation(() => {
      setFormRevision((value) => value + 1);
      action();
    });
  const allowed = usePermission('reports.create');
  const query = useQuery({
    queryKey: ['report-types'],
    queryFn: () => api<Paginated<ReportType>>('/report-types?limit=100&sortBy=name&sortOrder=asc'),
  });
  const type = query.data?.items.find((item) => item.id === typeId);
  const context = useQuery({
    queryKey: ['report-context', projectId],
    queryFn: () => api<Project>('/projects/' + projectId),
    enabled: !!projectId,
  });
  const resolvedCompany = companyId || (projectId ? context.data?.companyId : '') || '';
  const contextReady =
    !!projectId && !!context.data?.company && context.data.companyId === resolvedCompany;
  return (
    <Page
      key={stage}
      title={stage === 'form' ? (type?.name ?? 'Novo relatório') : 'Novo relatório'}
      subtitle={
        stage === 'context'
          ? 'Selecione a empresa e depois a obra para continuar.'
          : stage === 'type'
            ? 'Escolha o modelo para abrir o preenchimento.'
            : 'Preencha a inspeção e salve o rascunho.'
      }
      eyebrow={
        stage === 'context'
          ? 'Passo 1 de 2 / Empresa e obra'
          : stage === 'type'
            ? 'Passo 2 de 2 / Tipo de relatório'
            : 'Novo relatório / Preenchimento'
      }
      action={
        stage !== 'form' ? (
          <Button
            title="Voltar aos relatórios"
            variant="ghost"
            icon="arrow-left"
            onPress={() => requestNavigation(() => router.push('/reports'))}
          />
        ) : undefined
      }
    >
      {stage === 'type' && <Notice error={query.error} />}
      {stage === 'type' && query.isError && (
        <Button
          title="Tentar carregar tipos novamente"
          secondary
          busy={query.isFetching}
          onPress={() => void query.refetch()}
        />
      )}
      <Notice error={context.error} />
      {context.isError && (
        <Button
          title="Tentar carregar obra novamente"
          secondary
          busy={context.isFetching}
          onPress={() => void context.refetch()}
        />
      )}
      {!allowed ? (
        <Empty
          title="Acesso restrito"
          text="Você não possui permissão para criar relatórios."
          icon="lock"
        />
      ) : (
        <>
          {stage === 'type' && context.data && (
            <Card style={{ padding: 18 }}>
              <PanelHeader
                title={context.data.name}
                subtitle={context.data.company?.name}
                icon="folder"
                action={
                  <Button
                    title="Alterar obra"
                    small
                    secondary
                    onPress={() => changeContext(() => setStage('context'))}
                  />
                }
              />
            </Card>
          )}
          {stage === 'context' && (
            <Card>
              <PanelHeader
                title="Vincule o relatório à obra"
                subtitle="Cada relatório pertence a um cliente e a um projeto."
                icon="folder"
              />
              <FormGrid>
                <FormCell>
                  <EntityPicker
                    label="Empresa"
                    required
                    endpoint="/companies?status=ACTIVE"
                    value={resolvedCompany}
                    onChange={(id) =>
                      changeContext(() => {
                        setCompanyId(id);
                        setProjectId('');
                      })
                    }
                  />
                </FormCell>
                <FormCell>
                  {resolvedCompany ? (
                    <EntityPicker
                      key={resolvedCompany}
                      label="Obra"
                      required
                      endpoint={'/projects?status=ACTIVE&companyId=' + resolvedCompany}
                      value={projectId}
                      onChange={(id) => changeContext(() => setProjectId(id))}
                    />
                  ) : (
                    <SelectTrigger
                      label="Obra"
                      required
                      disabled
                      expanded={false}
                      icon="folder"
                      placeholder="Selecione uma empresa primeiro"
                      onPress={() => {}}
                    />
                  )}
                </FormCell>
              </FormGrid>
              <Button
                title="Continuar para tipo de relatório"
                iconRight="arrow-right"
                disabled={!contextReady || context.isFetching}
                busy={!!projectId && context.isFetching}
                onPress={() => {
                  if (contextReady) setStage('type');
                }}
              />
              {!resolvedCompany || !projectId ? (
                <Text style={styles.muted}>
                  Escolha a empresa e a obra para liberar o próximo passo.
                </Text>
              ) : null}
            </Card>
          )}
          {stage === 'type' && (
            <View style={{ gap: 16 }}>
              <PanelHeader
                title="Qual relatório você vai preencher?"
                subtitle="Toque em um modelo para continuar."
              />
              {query.isPending && <Loading />}
              {query.isError && (
                <Button
                  title="Tentar carregar modelos novamente"
                  secondary
                  onPress={() => void query.refetch()}
                />
              )}
              {query.data?.items.length === 0 && (
                <Empty
                  title="Nenhum modelo disponível"
                  text="Cadastre um tipo de relatório para continuar."
                  icon="report"
                />
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                {query.data?.items.map((item) => {
                  const meta = descriptions[item.code] ?? {
                    icon: 'report' as const,
                    text: 'Campos específicos para este tipo de inspeção.',
                  };
                  const selected = typeId === item.id;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={item.name}
                      accessibilityState={selectionState(selected)}
                      aria-pressed={selected}
                      key={item.id}
                      onPress={() => {
                        changeContext(() => {
                          setTypeId(item.id);
                          setStage('form');
                        });
                      }}
                      style={({ pressed }) => ({
                        flexGrow: 1,
                        flexBasis: '28%',
                        minWidth: 220,
                        borderWidth: 1,
                        borderColor: selected ? t.colors.selectionBorder : t.colors.line,
                        backgroundColor: selected
                          ? t.colors.blueSoft
                          : pressed
                            ? t.colors.soft
                            : t.colors.surface,
                        borderRadius: 13,
                        padding: 20,
                        gap: 14,
                      })}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <IconTile
                          name={meta.icon}
                          background={selected ? t.colors.blueSoft : t.colors.soft}
                          color={selected ? t.colors.blue : t.colors.muted}
                        />
                        <Badge label={item.code} tone={selected ? 'blue' : 'neutral'} dot={false} />
                      </View>
                      <Text
                        style={{ fontFamily: t.fonts.bold, fontSize: 14, color: t.colors.text }}
                      >
                        {item.name}
                      </Text>
                      <Text style={[styles.muted, { fontSize: 11, lineHeight: 18 }]}>
                        {meta.text}
                      </Text>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Icon
                          name={selected ? 'check-circle' : 'arrow-right'}
                          size={18}
                          color={selected ? t.colors.blue : t.colors.subtle}
                        />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
          {stage === 'form' && <ReportProgress />}
          {stage === 'form' &&
            (type && resolvedCompany && projectId && context.isPending ? (
              <Loading />
            ) : type && resolvedCompany && projectId && context.data?.company ? (
              <ReportForm
                key={type.id + ':' + formRevision}
                type={type}
                companyId={resolvedCompany}
                projectId={projectId}
                initialData={buildReportDefaults(type.code, context.data, context.data.company)}
                initialTitle={
                  type.code === 'EVS' ? context.data.name : context.data.name + ' · ' + type.name
                }
              />
            ) : type ? (
              <Info
                text="Selecione a empresa e a obra para abrir o formulário de inspeção."
                icon="folder"
              />
            ) : null)}
          {stage === 'form' && (
            <View style={styles.row}>
              <Button
                title="Alterar obra"
                variant="ghost"
                icon="folder"
                onPress={() => changeContext(() => setStage('context'))}
              />
              <Button
                title="Trocar tipo de relatório"
                variant="ghost"
                icon="arrow-left"
                onPress={() => changeContext(() => setStage('type'))}
              />
            </View>
          )}
        </>
      )}
    </Page>
  );
}
