import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  displayReportStatus,
  reportReviewWarnings,
  type Report,
  type ReportStatus,
} from '@weldcosta/shared';
import { api, ApiError, jsonBody } from '../../services/api';
import { downloadReportPdf } from '../../services/report-pdf';
import { requestNavigation } from '../../stores/navigation';
import { useAuth } from '../../stores/auth';
import { useTheme } from '../../utils/theme';
import { Button, Card, Field, Notice } from '../../components/ui';
import { emptyPhotoDrafts, useReportPhotoDrafts } from './report-photo-drafts';
import { ReportWarningsDialog } from './report-warnings-dialog';
import { PickerSheet } from '../../components/picker-sheet';
import { SelectOptionRow } from '../../components/select-field';
import { formErrorGuidance } from '../../utils/form-feedback';

export interface ReportActionControls {
  report?: Report;
  save?(): Promise<Report | undefined>;
  hasChanges?: boolean;
  busy?: boolean;
  creating?: boolean;
  onBusyChange?(busy: boolean): void;
}
type Action = 'save' | 'download' | 'share' | 'send' | 'approve' | 'reopen';
type Pending = { action: Action; report: Report; warnings: string[] };
export function ReportActions({
  report,
  save,
  hasChanges = false,
  busy = false,
  creating = false,
  onBusyChange,
}: ReportActionControls) {
  const { tokens: t, styles } = useTheme();
  const user = useAuth((state) => state.session!.user),
    client = useQueryClient();
  const [pending, setPending] = useState<Pending>();
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [sendOptions, setSendOptions] = useState(false);
  const [preparedShare, setPreparedShare] = useState<{ file: globalThis.File; reportId: string }>();
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<unknown>();
  const [scheduled, setScheduled] = useState(false);
  const actionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      if (actionTimer.current) clearTimeout(actionTimer.current);
    },
    [],
  );
  const can = (permission: string) => user.permissions.includes(permission);
  const update = async (saved: Report) => {
    client.setQueryData(['report', saved.id], saved);
    await Promise.all(
      ['reports', 'dashboard', 'report-autofill'].map((key) =>
        client.invalidateQueries({ queryKey: [key] }),
      ),
    );
  };
  const operation = useMutation({
    onMutate: () => onBusyChange?.(true),
    onSettled: () => onBusyChange?.(false),
    onError: (error) => {
      setPending(undefined);
      if (error instanceof ApiError && error.status === 409 && report) {
        void client.invalidateQueries({ queryKey: ['report', report.id] });
        void client.invalidateQueries({ queryKey: ['reports'] });
        void client.invalidateQueries({ queryKey: ['dashboard'] });
      }
    },
    mutationFn: async ({ action, confirmed }: { action: Action; confirmed?: Report }) => {
      setMessage('');
      let saved = confirmed ?? (save && (hasChanges || !report) ? await save() : report);
      if (!saved) return;
      if (!confirmed && ['download', 'share', 'send', 'approve'].includes(action)) {
        const warnings = reportReviewWarnings(saved);
        const draft =
          useReportPhotoDrafts.getState().reports[user.id + ':' + saved.id] ?? emptyPhotoDrafts;
        if (
          draft.photos.length ||
          draft.removedIds.length ||
          Object.keys(draft.captionEdits ?? {}).length
        )
          warnings.push(
            'Há fotos ou legendas aguardando envio. Elas continuam na fila para tentar novamente.',
          );
        if (warnings.length) {
          setPending({ action, report: saved, warnings });
          return;
        }
      }
      if (action === 'send' || action === 'approve' || action === 'reopen') {
        const status: ReportStatus =
          action === 'send' ? 'IN_REVIEW' : action === 'approve' ? 'APPROVED' : 'DRAFT';
        saved = await api<Report>(
          '/reports/' + saved.id + '/status',
          jsonBody('PATCH', {
            status,
            version: saved.version,
            quick: true,
            ...(confirmed ? { acknowledgeIncomplete: true } : {}),
            ...(action === 'reopen' && notes.trim() ? { revisionNotes: notes.trim() } : {}),
          }),
        );
        await update(saved);
      }
      if (action === 'download' || action === 'share') {
        if (saved.status === 'APPROVED') {
          saved = await api<Report>(
            '/reports/' + saved.id + '/pdf',
            jsonBody('POST', { version: saved.version }),
          );
          await update(saved);
        }
        const file = await downloadReportPdf(
          saved.id,
          saved.status !== 'APPROVED' && saved.status !== 'FINISHED',
          action === 'share',
        );
        if (file) {
          setPending(undefined);
          setPreparedShare({ file, reportId: saved.id });
          setShareError(undefined);
          return;
        }
      }
      setPending(undefined);
      setMessage(
        action === 'save'
          ? 'Relatório salvo.'
          : action === 'send'
            ? 'Relatório enviado para análise.'
            : action === 'approve'
              ? 'Relatório aprovado.'
              : action === 'reopen'
                ? 'Relatório reaberto para edição.'
                : action === 'share'
                  ? 'PDF preparado para compartilhar. Se o navegador não oferecer compartilhamento, o arquivo é baixado.'
                  : 'PDF preparado com os dados registrados.',
      );
      if (creating) router.replace('/reports/' + saved.id + '?etapa=conclusao');
    },
  });
  const queue = (action: Action, confirmed?: Report) => {
    setSendOptions(false);
    setPending(undefined);
    setScheduled(true);
    onBusyChange?.(true);
    if (actionTimer.current) clearTimeout(actionTimer.current);
    actionTimer.current = setTimeout(() => {
      actionTimer.current = undefined;
      setScheduled(false);
      operation.mutate({ action, confirmed });
    }, 300);
  };
  const working = busy || operation.isPending || sharing || scheduled;
  const status = report ? displayReportStatus(report.status) : 'DRAFT';
  return (
    <Card style={{ padding: 18, gap: 14 }}>
      <Text style={[styles.muted, { fontSize: 12 }]}>
        {hasChanges
          ? 'Ao baixar ou enviar, as alterações são salvas primeiro.'
          : 'Salve, baixe o PDF ou envie para análise.'}
      </Text>
      <Notice error={operation.error} guidance={formErrorGuidance(operation.error)} />
      {!!message && (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: t.colors.green, fontFamily: t.fonts.medium }}
        >
          {message}
        </Text>
      )}
      <View style={[styles.row, { gap: 10 }]}>
        {!!save && (
          <Button
            title="Salvar"
            icon="save"
            secondary
            disabled={working || (!!report && !hasChanges)}
            busy={operation.isPending && operation.variables?.action === 'save'}
            onPress={() => operation.mutate({ action: 'save' })}
          />
        )}
        {can('pdf.download') && (
          <Button
            title="Baixar PDF"
            icon="download"
            secondary
            disabled={working}
            busy={operation.isPending && operation.variables?.action === 'download'}
            onPress={() => operation.mutate({ action: 'download' })}
          />
        )}
        {(can('pdf.download') ||
          (status === 'DRAFT' && (can('reports.submit') || can('reports.review')))) && (
          <Button
            title="Enviar"
            icon="send"
            disabled={working}
            busy={operation.isPending && operation.variables?.action === 'send'}
            onPress={() => setSendOptions(true)}
          />
        )}
        {status === 'IN_REVIEW' && can('reports.approve') && (
          <Button
            title="Aprovar relatório"
            icon="check-circle"
            disabled={working}
            busy={operation.isPending && operation.variables?.action === 'approve'}
            onPress={() => operation.mutate({ action: 'approve' })}
          />
        )}
      </View>
      {status !== 'DRAFT' && can('reports.review') && (
        <View style={{ gap: 10 }}>
          {status === 'IN_REVIEW' && (
            <Field
              label="Correções ou observações (opcional)"
              multiline
              value={notes}
              onChangeText={setNotes}
            />
          )}
          <Button
            title={status === 'IN_REVIEW' ? 'Voltar para rascunho' : 'Reabrir para edição'}
            icon="edit"
            variant="ghost"
            disabled={working}
            onPress={() => operation.mutate({ action: 'reopen' })}
          />
        </View>
      )}
      <Button
        title="Voltar aos relatórios"
        icon="arrow-left"
        variant="ghost"
        disabled={working}
        onPress={() => requestNavigation(() => router.push('/reports'))}
      />
      <ReportWarningsDialog
        visible={!!pending}
        warnings={pending?.warnings ?? []}
        title={
          pending?.action === 'download'
            ? 'Baixar com pendências?'
            : pending?.action === 'share'
              ? 'Compartilhar com pendências?'
              : pending?.action === 'approve'
                ? 'Aprovar com pendências?'
                : 'Enviar com pendências?'
        }
        confirmLabel={
          pending?.action === 'download'
            ? 'Baixar assim mesmo'
            : pending?.action === 'share'
              ? 'Compartilhar assim mesmo'
              : pending?.action === 'approve'
                ? 'Aprovar assim mesmo'
                : 'Enviar assim mesmo'
        }
        busy={operation.isPending}
        onClose={() => setPending(undefined)}
        onConfirm={() => {
          if (pending) queue(pending.action, pending.report);
        }}
      />
      <PickerSheet
        visible={sendOptions}
        title="Como deseja enviar?"
        icon="send"
        onClose={() => setSendOptions(false)}
      >
        {status === 'DRAFT' && (can('reports.submit') || can('reports.review')) && (
          <SelectOptionRow
            option={{
              value: 'analysis',
              label: 'Enviar para análise',
              description: 'Encaminhar o relatório para avaliação técnica.',
              icon: 'eye',
            }}
            selected={false}
            onPress={() => {
              queue('send');
            }}
          />
        )}
        {can('pdf.download') && (
          <SelectOptionRow
            option={{
              value: 'share',
              label: 'Compartilhar PDF',
              description: 'Escolher WhatsApp, e-mail ou outro aplicativo no dispositivo.',
              icon: 'send',
            }}
            selected={false}
            onPress={() => {
              queue('share');
            }}
          />
        )}
      </PickerSheet>
      <PickerSheet
        visible={!!preparedShare}
        title="PDF pronto para compartilhar"
        icon="send"
        onClose={() => {
          if (sharing) return;
          const reportId = preparedShare?.reportId;
          setPreparedShare(undefined);
          if (creating && reportId) router.replace('/reports/' + reportId + '?etapa=conclusao');
        }}
      >
        <Text style={styles.muted}>Escolha o aplicativo de envio na próxima tela.</Text>
        <Notice error={shareError} />
        <Button
          title="Compartilhar PDF agora"
          icon="send"
          busy={sharing}
          onPress={async () => {
            if (!preparedShare) return;
            setSharing(true);
            try {
              await navigator.share({ files: [preparedShare.file], title: 'Relatório Weldcosta' });
              setPreparedShare(undefined);
              if (creating)
                router.replace('/reports/' + preparedShare.reportId + '?etapa=conclusao');
            } catch (error) {
              if (error instanceof Error && error.name === 'AbortError')
                setPreparedShare(undefined);
              else setShareError(error);
            } finally {
              setSharing(false);
            }
          }}
        />
      </PickerSheet>
    </Card>
  );
}
