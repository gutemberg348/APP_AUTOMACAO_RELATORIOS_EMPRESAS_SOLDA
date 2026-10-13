import { useTheme } from '../../utils/theme';
import { requestNavigation } from '../../stores/navigation';
import { Text, View, Pressable, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Svg, { Circle } from 'react-native-svg';
import type { Dashboard, ReportStatus } from '@weldcosta/shared';
import { api } from '../../services/api';
import { usePermission } from '../../hooks/use-permission';
import {
  Page,
  Card,
  Button,
  Notice,
  Loading,
  Empty,
  PanelHeader,
  IconTile,
} from '../../components/ui';
import { Icon, type IconName } from '../../components/icon';
import { ReportList, statusLabels } from '../../features/reports/report-card';

const statusColors = {
  DRAFT: '#97A5B7',
  IN_REVIEW: '#D0A04C',
  APPROVED: '#42A37B',
  FINISHED: '#1764C0',
};
export default function DashboardScreen() {
  const { tokens: t, styles } = useTheme();
  const canCreate = usePermission('reports.create'),
    wide = useWindowDimensions().width >= 1200;
  const query = useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dashboard>('/dashboard') }),
    data = query.data;
  const stats: { label: string; value: number; icon: IconName; description: string }[] = data
    ? [
        {
          label: 'Empresas',
          value: data.totalCompanies,
          icon: 'building',
          description: 'Clientes cadastrados',
        },
        {
          label: 'Obras',
          value: data.totalProjects,
          icon: 'folder',
          description: 'Projetos de inspeção',
        },
        {
          label: 'Relatórios',
          value: data.totalReports,
          icon: 'report',
          description: 'Todos os tipos de ensaio',
        },
        {
          label: 'Em análise',
          value: data.reportsInReview,
          icon: 'clock',
          description: 'Aguardando análise técnica',
        },
      ]
    : [];
  return (
    <Page
      title="Visão geral"
      subtitle="Acompanhe suas inspeções e relatórios."
      eyebrow="Gestão de inspeções"
      action={
        canCreate ? (
          <Button
            title="Novo relatório"
            icon="plus"
            onPress={() => requestNavigation(() => router.push('/reports/new'))}
          />
        ) : undefined
      }
    >
      <Notice error={query.error} />
      {query.isPending && <Loading />}
      {data && (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
            {stats.map((stat) => (
              <View
                key={stat.label}
                style={{ flexGrow: 1, flexBasis: wide ? '22%' : '44%', minWidth: 130 }}
              >
                <Card style={{ padding: 20, gap: 10 }}>
                  <View style={[styles.row, { justifyContent: 'space-between' }]}>
                    <Text style={[styles.muted, { fontFamily: t.fonts.semibold, fontSize: 12 }]}>
                      {stat.label}
                    </Text>
                    <IconTile name={stat.icon} size={34} />
                  </View>
                  <Text
                    style={{
                      color: t.colors.text,
                      fontFamily: t.fonts.extra,
                      fontSize: 33,
                      letterSpacing: -1,
                    }}
                  >
                    {stat.value.toLocaleString('pt-BR')}
                  </Text>
                  <Text style={[styles.muted, { fontSize: 10 }]}>{stat.description}</Text>
                </Card>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: 24, alignItems: 'stretch' }}>
            <View style={{ flex: wide ? 1.65 : undefined, minWidth: 0, gap: 24 }}>
              <Card>
                <PanelHeader
                  title="Relatórios recentes"
                  subtitle="Últimos registros da sua operação"
                  action={
                    <Button
                      title="Ver todos"
                      variant="ghost"
                      small
                      iconRight="arrow-right"
                      onPress={() => requestNavigation(() => router.push('/reports'))}
                    />
                  }
                />
                {data.latestReports.length ? (
                  <ReportList compact reports={data.latestReports} />
                ) : (
                  <Empty
                    title="Seu próximo relatório começa aqui"
                    text="Os relatórios cadastrados aparecerão nesta visão geral."
                    icon="report"
                    action={
                      canCreate ? (
                        <Button
                          title="Criar primeiro relatório"
                          secondary
                          icon="plus"
                          onPress={() => requestNavigation(() => router.push('/reports/new'))}
                        />
                      ) : undefined
                    }
                  />
                )}
              </Card>
              <Card>
                <PanelHeader
                  title="Tipos de inspeção"
                  subtitle="Distribuição dos relatórios por ensaio"
                />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {data.byType.map((type) => (
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel={'Ver relatórios de ' + type.name}
                      key={type.code}
                      onPress={() =>
                        requestNavigation(() => router.push('/reports?typeCode=' + type.code))
                      }
                      style={({ pressed }) => ({
                        flexGrow: 1,
                        flexBasis: '44%',
                        borderWidth: 1,
                        borderColor: t.colors.line,
                        backgroundColor: pressed ? t.colors.blueSoft : t.colors.soft,
                        borderRadius: 10,
                        padding: 16,
                        gap: 11,
                      })}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: t.fonts.extra,
                            fontSize: 11,
                            letterSpacing: 0.5,
                            color: t.colors.blue,
                          }}
                        >
                          {type.code}
                        </Text>
                        <Icon name="arrow-right" size={14} color={t.colors.subtle} />
                      </View>
                      <Text
                        style={{ fontFamily: t.fonts.bold, fontSize: 22, color: t.colors.text }}
                      >
                        {type.count}
                      </Text>
                      <Text style={[styles.muted, { fontSize: 10, lineHeight: 16 }]}>
                        {type.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </Card>
            </View>
            <View style={{ flex: wide ? 1 : undefined, minWidth: 0, gap: 24 }}>
              <Card>
                <PanelHeader title="Fluxo de aprovação" subtitle="Situação atual dos relatórios" />
                <ApprovalChart data={data} />
              </Card>
              <Card>
                <PanelHeader
                  title="Aguardando revisão"
                  subtitle="Relatórios enviados para análise"
                  icon="clock"
                />
                {data.awaitingReview.length ? (
                  <ReportList compact reports={data.awaitingReview.slice(0, 3)} />
                ) : (
                  <View style={{ paddingVertical: 26, gap: 10, alignItems: 'center' }}>
                    <Icon name="check-circle" color={t.colors.green} size={30} />
                    <Text style={{ fontFamily: t.fonts.bold, color: t.colors.text, fontSize: 13 }}>
                      Revisões em dia
                    </Text>
                    <Text style={[styles.muted, { fontSize: 11, textAlign: 'center' }]}>
                      Nenhum relatório aguardando revisão.
                    </Text>
                  </View>
                )}
                {data.awaitingReview.length > 0 && (
                  <Button
                    title="Abrir fila de revisão"
                    secondary
                    small
                    iconRight="arrow-right"
                    onPress={() =>
                      requestNavigation(() => router.push('/reports?status=IN_REVIEW'))
                    }
                  />
                )}
              </Card>
            </View>
          </View>
        </>
      )}
    </Page>
  );
}
function ApprovalChart({ data }: { data: Dashboard }) {
  const { tokens: t, styles } = useTheme();
  const statuses: { status: ReportStatus; value: number }[] = [
    { status: 'DRAFT', value: data.reportsDraft },
    { status: 'IN_REVIEW', value: data.reportsInReview },
    { status: 'APPROVED', value: data.reportsApproved + data.reportsFinished },
  ];
  const circumference = 2 * Math.PI * 60;
  let offset = 0;
  return (
    <View style={{ gap: 24 }}>
      <View
        accessible
        accessibilityLabel={
          data.totalReports +
          ' relatórios. ' +
          statuses.map((item) => statusLabels[item.status] + ': ' + item.value).join('. ')
        }
        style={{
          alignSelf: 'center',
          width: 164,
          height: 164,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 4,
        }}
      >
        <View style={{ position: 'absolute' }}>
          <Svg width={164} height={164} viewBox="0 0 164 164">
            <Circle cx={82} cy={82} r={60} fill="none" stroke={t.colors.line} strokeWidth={13} />
            {statuses.map((item) => {
              const length = data.totalReports
                  ? (item.value / data.totalReports) * circumference
                  : 0,
                start = offset;
              offset += length;
              return length ? (
                <Circle
                  key={item.status}
                  cx={82}
                  cy={82}
                  r={60}
                  fill="none"
                  stroke={statusColors[item.status]}
                  strokeWidth={13}
                  strokeDasharray={length + ' ' + circumference}
                  strokeDashoffset={-start}
                  transform="rotate(-90 82 82)"
                />
              ) : null;
            })}
          </Svg>
        </View>
        <Text style={{ fontFamily: t.fonts.extra, fontSize: 32, color: t.colors.text }}>
          {data.totalReports}
        </Text>
        <Text style={[styles.muted, { fontSize: 10 }]}>relatórios</Text>
      </View>
      <View style={{ gap: 13 }}>
        {statuses.map((item) => (
          <Pressable
            key={item.status}
            accessibilityRole="link"
            accessibilityLabel={'Ver relatórios: ' + statusLabels[item.status]}
            onPress={() => requestNavigation(() => router.push('/reports?status=' + item.status))}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}
          >
            <View
              style={{
                height: 7,
                width: 7,
                borderRadius: 3.5,
                backgroundColor: statusColors[item.status],
              }}
            />
            <Text style={[styles.muted, { flex: 1, fontSize: 12 }]}>
              {statusLabels[item.status]}
            </Text>
            <Text style={{ color: t.colors.text, fontFamily: t.fonts.bold, fontSize: 12 }}>
              {item.value}
            </Text>
            <Icon name="chevron-right" size={13} color={t.colors.subtle} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
