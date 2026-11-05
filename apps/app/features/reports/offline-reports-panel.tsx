import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, Notice, PanelHeader } from '../../components/ui';
import {
  discardLocalReport,
  useOfflineReports,
  type LocalReportDraft,
} from './offline-report-store';
import { useConnectivity } from '../../stores/connectivity';
import { synchronizeOffline, useOfflineSynchronization } from './offline-synchronization';
import { useAuth } from '../../stores/auth';
import { requestNavigation } from '../../stores/navigation';
import { useTheme } from '../../utils/theme';
import { ConfirmDialog } from '../../components/confirm-dialog';

export function OfflineReportsPanel() {
  const { styles } = useTheme();
  const { drafts, syncing } = useOfflineReports();
  const online = useConnectivity((state) => state.online);
  const storageError = useConnectivity((state) => state.storageError);
  const [error, setError] = useState<unknown>();
  const userId = useAuth((state) => state.session?.user.id);
  const sync = useOfflineSynchronization();
  const preparing = sync.accountId === userId && sync.busy;
  const message = sync.accountId === userId ? sync.message : '';
  const syncError = sync.accountId === userId ? sync.error : undefined;
  const client = useQueryClient();
  const [discarding, setDiscarding] = useState<LocalReportDraft>();
  const entries = Object.values(drafts).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <Card>
      <PanelHeader
        title="Sincronização"
        subtitle={
          online
            ? 'Automática com internet. Preencha offline quando precisar.'
            : 'Sem internet · os rascunhos continuam disponíveis aqui.'
        }
        icon="save"
      />
      <Notice error={storageError || syncError ? new Error(storageError || syncError) : error} />
      {!!message && (
        <Text style={styles.muted} accessibilityLiveRegion="polite">
          {message}
        </Text>
      )}
      <Button
        title="Sincronizar"
        secondary
        small
        disabled={!online || preparing}
        busy={preparing}
        onPress={() => {
          setError(undefined);
          void synchronizeOffline(true).then(() =>
            client.invalidateQueries({ queryKey: ['reports'] }),
          );
        }}
      />
      {!online && (
        <Text style={styles.muted}>
          As pendências serão enviadas quando a internet voltar, com o aplicativo aberto.
        </Text>
      )}
      {entries.map((draft) => (
        <View key={draft.id} style={{ gap: 8, paddingVertical: 12 }}>
          <Text style={styles.label}>
            {draft.values.number || 'Sem número'} · {draft.values.title || draft.type.name}
          </Text>
          <Text style={styles.muted}>
            {draft.type.code} · {draft.baseReport?.company.name || draft.project?.company?.name} ·{' '}
            {draft.project?.name || draft.baseReport?.project.name}
          </Text>
          <Text style={styles.muted}>
            {syncing.includes(draft.id)
              ? 'Sincronizando…'
              : draft.error
                ? 'Precisa de atenção · salvo no telefone'
                : 'Aguardando sincronização · salvo no telefone'}
          </Text>
          {draft.error && <Notice error={new Error(draft.error.message)} />}
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            <Button
              title={draft.error ? 'Abrir e corrigir' : 'Continuar preenchimento'}
              small
              secondary
              disabled={syncing.includes(draft.id)}
              onPress={() => requestNavigation(() => router.push('/reports/offline/' + draft.id))}
            />
            <Button
              title="Excluir do telefone"
              small
              variant="ghost"
              icon="trash"
              disabled={syncing.includes(draft.id)}
              onPress={() => setDiscarding(draft)}
            />
          </View>
        </View>
      ))}
      <ConfirmDialog
        visible={!!discarding}
        title="Descartar este rascunho do telefone?"
        description="O preenchimento e as fotos ainda não enviados serão descartados deste aparelho. O relatório que já está no servidor será preservado."
        confirmLabel="Descartar do telefone"
        danger
        onClose={() => setDiscarding(undefined)}
        onConfirm={() => {
          if (!discarding) return;
          void discardLocalReport(discarding.id)
            .then(() => setDiscarding(undefined))
            .catch(setError);
        }}
      />
    </Card>
  );
}
