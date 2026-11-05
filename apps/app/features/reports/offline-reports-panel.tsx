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
import { syncLocalReport } from './offline-report-sync';
import { prepareOfflineCatalog } from './offline-prepare';
import { requestNavigation } from '../../stores/navigation';
import { useTheme } from '../../utils/theme';
import { ConfirmDialog } from '../../components/confirm-dialog';

export function OfflineReportsPanel() {
  const { styles } = useTheme();
  const { drafts, syncing } = useOfflineReports();
  const online = useConnectivity((state) => state.online);
  const storageError = useConnectivity((state) => state.storageError);
  const [preparing, setPreparing] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState<unknown>();
  const client = useQueryClient();
  const [discarding, setDiscarding] = useState<LocalReportDraft>();
  const entries = Object.values(drafts).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <Card>
      <PanelHeader
        title="Relatórios neste telefone"
        subtitle={
          online
            ? 'Preencha sem internet e sincronize quando voltar.'
            : 'Sem internet · os rascunhos continuam disponíveis aqui.'
        }
        icon="save"
      />
      <Notice error={storageError ? new Error(storageError) : error} />
      {!!message && (
        <Text style={styles.muted} accessibilityLiveRegion="polite">
          {message}
        </Text>
      )}
      <Button
        title="Preparar empresas e obras para uso offline"
        secondary
        small
        disabled={!online || preparing}
        busy={preparing}
        onPress={() => {
          setPreparing(true);
          setError(undefined);
          void prepareOfflineCatalog(setMessage)
            .then(setMessage)
            .catch(setError)
            .finally(() => setPreparing(false));
        }}
      />
      <Text style={styles.muted}>
        Prepare com internet antes de sair. Para continuar um relatório existente, abra-o e toque em
        “Guardar relatório e fotos para uso offline”.
      </Text>
      {!entries.length && (
        <Text style={styles.muted}>Nenhum rascunho aguardando envio neste telefone.</Text>
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
              title="Sincronizar"
              small
              disabled={!online || syncing.includes(draft.id)}
              busy={syncing.includes(draft.id)}
              onPress={() => {
                void syncLocalReport(draft.id)
                  .then((report) => {
                    client.setQueryData(['report', report.id], report);
                    void client.invalidateQueries({ queryKey: ['reports'] });
                  })
                  .catch(setError);
              }}
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
