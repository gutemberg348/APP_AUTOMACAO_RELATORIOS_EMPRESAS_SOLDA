import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  canSetReportStatus,
  reportDisplayStatuses,
  displayReportStatus,
  reportStatusLabels,
  type Report,
  type ReportStatus,
} from '@weldcosta/shared';
import { api, ApiError, jsonBody } from '../../services/api';
import { useAuth } from '../../stores/auth';
import { requestNavigation } from '../../stores/navigation';
import { useTheme } from '../../utils/theme';
import { PickerSheet } from '../../components/picker-sheet';
import { SelectOptionRow } from '../../components/select-field';
import { Badge, Button, Notice } from '../../components/ui';
import { Icon } from '../../components/icon';
import { ReportWarningsDialog } from './report-warnings-dialog';

const labels = reportStatusLabels;
const tones = {
  DRAFT: 'neutral',
  IN_REVIEW: 'amber',
  APPROVED: 'green',
  FINISHED: 'green',
} as const;
const emptyPermissions: string[] = [];
function statusErrorMessage(error: Error | null): string | undefined {
  if (!error) return undefined;
  if (
    error instanceof ApiError &&
    error.code === 'VALIDATION_ERROR' &&
    Array.isArray(error.details)
  ) {
    const fields: Record<string, string> = {
      number: 'Informe o número do relatório.',
      title: 'Informe o título do relatório.',
      reportDate: 'Informe uma data válida para o relatório.',
    };
    const messages = error.details.flatMap((issue: unknown) => {
      if (!issue || typeof issue !== 'object' || !('path' in issue) || !Array.isArray(issue.path))
        return [];
      const message = fields[String(issue.path[0])];
      return message ? [message] : [];
    });
    if (messages.length) return [...new Set(messages)].join(' ');
  }
  return error.message;
}
export function ReportStatusSelect({
  report,
  compact = false,
}: {
  report: Report;
  compact?: boolean;
}) {
  const { tokens: t } = useTheme();
  const permissions = useAuth((state) => state.session?.user.permissions ?? emptyPermissions);
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(report.status);
  const [incomplete, setIncomplete] = useState<ReportStatus>();
  const [scheduled, setScheduled] = useState(false);
  const actionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      if (actionTimer.current) clearTimeout(actionTimer.current);
    },
    [],
  );
  const palette = {
    DRAFT: { foreground: t.colors.muted, background: t.colors.neutralSoft },
    IN_REVIEW: { foreground: t.colors.amber, background: t.colors.amberSoft },
    APPROVED: { foreground: t.colors.green, background: t.colors.greenSoft },
    FINISHED: { foreground: t.colors.green, background: t.colors.greenSoft },
  }[status];
  useEffect(() => setStatus(report.status), [report.status, report.version]);
  const choices = reportDisplayStatuses.filter(
    (target) =>
      target === displayReportStatus(report.status) ||
      canSetReportStatus(report.status, target, permissions),
  );
  const change = useMutation({
    mutationFn: ({
      target,
      acknowledgeIncomplete,
    }: {
      target: ReportStatus;
      acknowledgeIncomplete?: boolean;
    }) =>
      api<Report>(
        '/reports/' + report.id + '/status',
        jsonBody('PATCH', {
          version: report.version,
          status: target,
          quick: true,
          ...(acknowledgeIncomplete ? { acknowledgeIncomplete } : {}),
        }),
      ),
    onSuccess: async (saved) => {
      setStatus(saved.status);
      setIncomplete(undefined);
      client.setQueryData(['report', report.id], saved);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['reports'] }),
        client.invalidateQueries({ queryKey: ['dashboard'] }),
        client.invalidateQueries({ queryKey: ['report-autofill'] }),
      ]);
    },
    onError: (error, variables) => {
      setStatus(report.status);
      if (
        error instanceof ApiError &&
        error.code === 'VALIDATION_ERROR' &&
        !(
          Array.isArray(error.details) &&
          error.details.some((issue: { path?: string[] }) => issue.path?.[0] === 'number')
        ) &&
        !variables.acknowledgeIncomplete
      ) {
        setOpen(false);
        setIncomplete(variables.target);
        return;
      }
      setIncomplete(undefined);
      setOpen(true);
      if (error instanceof ApiError && (error.status === 409 || error.status === 404))
        void client.invalidateQueries({ queryKey: ['reports'] });
    },
  });
  const changing = scheduled || change.isPending;
  const queueChange = (target: ReportStatus, acknowledgeIncomplete = false) => {
    setOpen(false);
    setIncomplete(undefined);
    setScheduled(true);
    if (actionTimer.current) clearTimeout(actionTimer.current);
    // Allow the native sheet to close before presenting a validation warning.
    actionTimer.current = setTimeout(() => {
      actionTimer.current = undefined;
      setScheduled(false);
      change.mutate({ target, acknowledgeIncomplete });
    }, 300);
  };
  return (
    <View style={{ width: compact ? 126 : 150, maxWidth: '100%', flexShrink: 0, gap: 6 }}>
      {choices.length > 1 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            'Alterar status do relatório ' + (report.number || report.title || 'rascunho')
          }
          accessibilityHint={'Status atual: ' + labels[status]}
          accessibilityState={{
            expanded: open,
            disabled: changing,
            busy: changing,
          }}
          disabled={changing}
          onPress={() => {
            change.reset();
            setOpen(true);
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            minHeight: 44,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: t.colors.line,
            backgroundColor: palette.background,
          }}
        >
          <View
            style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: palette.foreground }}
          />
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontFamily: t.fonts.semibold,
              fontSize: compact ? 11 : 12,
              lineHeight: 18,
              includeFontPadding: false,
              textAlignVertical: 'center',
              color: palette.foreground,
            }}
          >
            {labels[status]}
          </Text>
          <View style={{ width: 16, height: 18, alignItems: 'center', justifyContent: 'center' }}>
            {changing ? (
              <ActivityIndicator size="small" color={palette.foreground} />
            ) : (
              <Icon name="chevron-down" size={16} color={palette.foreground} />
            )}
          </View>
        </Pressable>
      ) : (
        <Badge label={labels[status]} tone={tones[status]} />
      )}
      {changing && !compact && (
        <Text accessibilityLiveRegion="polite" style={{ fontSize: 10, color: t.colors.muted }}>
          Salvando status…
        </Text>
      )}
      <PickerSheet
        visible={open}
        title="Alterar status do relatório"
        subtitle={(report.number || 'Sem número') + ' · ' + (report.title || 'Rascunho')}
        icon="report"
        onClose={() => setOpen(false)}
      >
        <ScrollView
          style={{ flexShrink: 1 }}
          contentContainerStyle={{ gap: 4 }}
          keyboardShouldPersistTaps="handled"
        >
          <Notice error={statusErrorMessage(change.error)} />
          {change.error instanceof ApiError && change.error.code === 'VALIDATION_ERROR' && (
            <Button
              title="Abrir relatório para corrigir"
              icon="edit"
              variant="secondary"
              onPress={() => {
                setOpen(false);
                requestNavigation(() => router.push('/reports/' + report.id));
              }}
            />
          )}
          {choices.map((target) => (
            <SelectOptionRow
              key={target}
              option={{
                value: target,
                label: labels[target],
                icon: target === 'APPROVED' ? 'check-circle' : target === 'DRAFT' ? 'edit' : 'eye',
                tone:
                  target === 'APPROVED' ? 'green' : target === 'IN_REVIEW' ? 'amber' : undefined,
              }}
              selected={target === displayReportStatus(status)}
              onPress={() => {
                setOpen(false);
                if (target !== displayReportStatus(report.status)) {
                  change.reset();
                  queueChange(target);
                }
              }}
            />
          ))}
        </ScrollView>
      </PickerSheet>
      <ReportWarningsDialog
        visible={!!incomplete}
        warnings={[statusErrorMessage(change.error) ?? 'Há campos não preenchidos.']}
        title={incomplete === 'APPROVED' ? 'Aprovar com pendências?' : 'Enviar com pendências?'}
        confirmLabel={incomplete === 'APPROVED' ? 'Aprovar assim mesmo' : 'Enviar assim mesmo'}
        busy={changing}
        onClose={() => setIncomplete(undefined)}
        onConfirm={() => {
          if (incomplete) queueChange(incomplete, true);
        }}
      />
    </View>
  );
}
