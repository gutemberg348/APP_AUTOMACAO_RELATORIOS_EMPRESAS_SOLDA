import { useTheme } from '../../utils/theme';
import { requestNavigation } from '../../stores/navigation';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import type { Report, ReportStatus } from '@weldcosta/shared';
import { reportStatusLabels } from '@weldcosta/shared';
import { Badge, IconTile, Button } from '../../components/ui';
import { Icon } from '../../components/icon';
import { ReportStatusSelect } from './report-status-select';

import { formatDate } from '../../utils/format';
export const statusLabels = reportStatusLabels;
const tones = {
  DRAFT: 'neutral',
  IN_REVIEW: 'amber',
  APPROVED: 'green',
  FINISHED: 'green',
} as const;
export function StatusBadge({ status }: { status: ReportStatus }) {
  return <Badge label={statusLabels[status]} tone={tones[status]} />;
}
export function TypeBadge({ code }: { code: string }) {
  return <Badge label={code} tone="blue" dot={false} />;
}
export function ReportCard({
  report,
  onDelete,
}: {
  report: Report;
  onDelete?(report: Report): void;
}) {
  const { tokens: t, styles } = useTheme();
  return (
    <View style={[styles.card, { padding: 0, gap: 0, overflow: 'hidden' }]}>
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <View style={styles.row}>
            <TypeBadge code={report.reportType.code} />
            <Text style={{ fontFamily: t.fonts.semibold, color: t.colors.muted, fontSize: 12 }}>
              {report.number || 'Sem número'}
            </Text>
          </View>
          <ReportStatusSelect report={report} />
        </View>
      </View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={'Abrir relatório ' + (report.number || report.title || 'rascunho')}
        onPress={() => requestNavigation(() => router.push('/reports/' + report.id))}
        style={({ pressed }) => [
          { padding: 20, gap: 14 },
          pressed && { backgroundColor: t.colors.soft },
        ]}
      >
        <Text
          style={{ fontFamily: t.fonts.bold, fontSize: 15, lineHeight: 23, color: t.colors.text }}
        >
          {report.title || 'Rascunho sem título'}
        </Text>
        <View style={{ gap: 5 }}>
          <View style={{ flexDirection: 'row', gap: 7, alignItems: 'center' }}>
            <Icon name="building" size={14} color={t.colors.subtle} />
            <Text numberOfLines={1} style={[styles.muted, { flex: 1 }]}>
              {report.company.name}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 7, alignItems: 'center' }}>
            <Icon name="folder" size={14} color={t.colors.subtle} />
            <Text numberOfLines={1} style={[styles.muted, { flex: 1 }]}>
              {report.project.name}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.row,
            {
              borderTopWidth: 1,
              borderColor: t.colors.line,
              paddingTop: 12,
              justifyContent: 'space-between',
            },
          ]}
        >
          <Text style={[styles.muted, { fontSize: 11 }]}>{formatDate(report.reportDate)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={{ fontFamily: t.fonts.semibold, fontSize: 11, color: t.colors.blue }}>
              Abrir relatório
            </Text>
            <Icon name="arrow-right" size={14} color={t.colors.blue} />
          </View>
        </View>
      </Pressable>
      {!!onDelete && (
        <View style={{ paddingHorizontal: 20, paddingBottom: 16, alignItems: 'flex-start' }}>
          <Button
            title="Excluir relatório"
            icon="trash"
            variant="danger"
            small
            style={{ minHeight: 44 }}
            onPress={() => onDelete(report)}
          />
        </View>
      )}
    </View>
  );
}
export function ReportList({
  reports,
  compact = false,
  onDelete,
}: {
  reports: Report[];
  compact?: boolean;
  onDelete?(report: Report): void;
}) {
  const { tokens: t, styles } = useTheme();
  const { width } = useWindowDimensions();
  if (compact)
    return (
      <View>
        {reports.map((report, index) => (
          <View
            key={report.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              minHeight: 82,
              paddingVertical: 14,
              borderTopWidth: index ? 1 : 0,
              borderColor: t.colors.line,
            }}
          >
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={'Abrir relatório ' + (report.number || report.title)}
              onPress={() => requestNavigation(() => router.push('/reports/' + report.id))}
              style={({ pressed }) => ({
                paddingVertical: 4,
                flex: 1,
                minWidth: 0,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: pressed ? t.colors.soft : t.colors.surface,
              })}
            >
              <IconTile
                name="report"
                size={36}
                background={t.colors.blueSoft}
                color={t.colors.blue}
              />
              <View style={{ flex: 1, minWidth: 0, gap: 4, justifyContent: 'center' }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: t.fonts.bold,
                    color: t.colors.text,
                    fontSize: 12,
                    lineHeight: 18,
                    includeFontPadding: false,
                  }}
                >
                  {report.title || 'Rascunho sem título'}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.muted,
                    { fontSize: 10, lineHeight: 16, includeFontPadding: false },
                  ]}
                >
                  {report.reportType.code} · {report.number || 'Sem número'} · {report.company.name}
                </Text>
              </View>
            </Pressable>
            <ReportStatusSelect report={report} compact />
          </View>
        ))}
      </View>
    );
  if (width < t.breakpoints.table)
    return (
      <View style={{ gap: 14 }}>
        {reports.map((report) => (
          <ReportCard key={report.id} report={report} onDelete={onDelete} />
        ))}
      </View>
    );
  return (
    <View
      style={{
        backgroundColor: t.colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: t.colors.line,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          paddingHorizontal: 20,
          paddingVertical: 13,
          backgroundColor: t.colors.soft,
        }}
      >
        {[
          ['RELATÓRIO', 2.4],
          ['CLIENTE / OBRA', 1.8],
          ['TIPO', 0.7],
          ['DATA', 0.9],
        ].map(([label, flex]) => (
          <Text key={label} style={[styles.caption, { flex: Number(flex), fontSize: 9 }]}>
            {label}
          </Text>
        ))}
        <Text style={[styles.caption, { width: 190, fontSize: 9 }]}>SITUAÇÃO</Text>
        {!!onDelete && <Text style={[styles.caption, { width: 154, fontSize: 9 }]}>AÇÕES</Text>}
      </View>
      {reports.map((report) => (
        <View
          key={report.id}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderTopWidth: 1,
            borderColor: t.colors.line,
          }}
        >
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={'Abrir relatório ' + (report.number || report.title)}
            onPress={() => requestNavigation(() => router.push('/reports/' + report.id))}
            style={({ pressed }) => ({
              flex: 1,
              flexDirection: 'row',
              gap: 16,
              alignItems: 'center',
              paddingVertical: 20,
              paddingHorizontal: 20,
              backgroundColor: pressed ? t.colors.soft : t.colors.surface,
            })}
          >
            <View style={{ flex: 2.4, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{ color: t.colors.text, fontFamily: t.fonts.bold, fontSize: 12 }}
              >
                {report.title || 'Rascunho sem título'}
              </Text>
              <Text style={[styles.muted, { marginTop: 3, fontSize: 11 }]}>
                {report.number || 'Sem número'}
              </Text>
            </View>
            <View style={{ flex: 1.8, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{ color: t.colors.text, fontFamily: t.fonts.medium, fontSize: 11 }}
              >
                {report.company.name}
              </Text>
              <Text numberOfLines={1} style={[styles.muted, { fontSize: 10, marginTop: 3 }]}>
                {report.project.name}
              </Text>
            </View>
            <View style={{ flex: 0.7 }}>
              <TypeBadge code={report.reportType.code} />
            </View>
            <Text style={[styles.muted, { flex: 0.9, fontSize: 11 }]}>
              {formatDate(report.reportDate)}
            </Text>

            <Icon name="chevron-right" size={16} color={t.colors.subtle} />
          </Pressable>
          <View style={{ width: 190, paddingHorizontal: 8 }}>
            <ReportStatusSelect report={report} />
          </View>
          {!!onDelete && (
            <View style={{ width: 154, paddingRight: 16 }}>
              <Button
                title="Excluir relatório"
                icon="trash"
                variant="danger"
                small
                style={{ minHeight: 44 }}
                onPress={() => onDelete(report)}
              />
            </View>
          )}
        </View>
      ))}
    </View>
  );
}
