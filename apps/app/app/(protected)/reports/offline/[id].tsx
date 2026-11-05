import { useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { Page, Empty } from '../../../../components/ui';
import { ReportForm } from '../../../../features/reports/report-form';
import { useOfflineReports } from '../../../../features/reports/offline-report-store';

export default function OfflineReport() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pending = useOfflineReports((state) => state.drafts[id]);
  const last = useRef(pending);
  if (pending) last.current = pending;
  const draft = pending ?? last.current;
  return (
    <Page
      title={draft?.values.title || 'Rascunho no telefone'}
      subtitle={draft?.project?.name || draft?.type.name}
      back={{ label: 'Voltar aos relatórios', href: '/reports' }}
    >
      {draft ? (
        <ReportForm
          key={draft.id}
          type={draft.type}
          report={draft.baseReport}
          project={draft.project}
          companyId={draft.companyId}
          projectId={draft.projectId}
          offlineDraft={draft}
        />
      ) : (
        <Empty
          title="Rascunho sincronizado"
          text="Abra o relatório na lista para continuar."
          icon="check-circle"
        />
      )}
    </Page>
  );
}
