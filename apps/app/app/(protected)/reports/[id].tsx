import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Report } from '@weldcosta/shared';
import { api, jsonBody } from '../../../services/api';
import { useAuth } from '../../../stores/auth';
import { ReportForm } from '../../../features/reports/report-form';
import { ReportSummary } from '../../../features/reports/report-summary';
import { ReportActions } from '../../../features/reports/report-actions';
import { ReportProgress } from '../../../features/reports/report-progress';
import { Page, Notice, Loading, Button, Info } from '../../../components/ui';
import { ConfirmDialog } from '../../../components/confirm-dialog';

export default function ReportDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [deleting, setDeleting] = useState(false);
  const user = useAuth((state) => state.session!.user),
    client = useQueryClient();
  const query = useQuery({
    queryKey: ['report', id],
    queryFn: () => api<Report>('/reports/' + id),
    refetchOnWindowFocus: false,
  });
  const remove = useMutation({
    mutationFn: () => api('/reports/' + id, jsonBody('DELETE', { version: query.data!.version })),
    onSuccess: async () => {
      await client.invalidateQueries();
      router.replace('/reports');
    },
  });
  const report = query.data,
    can = (permission: string) => user.permissions.includes(permission);
  const editable =
    report &&
    can('reports.edit') &&
    (report.status === 'DRAFT' || (report.status === 'IN_REVIEW' && can('reports.review')));
  return (
    <Page
      title={report?.title || 'Relatório de inspeção'}
      subtitle={report ? report.company.name + ' / ' + report.project.name : undefined}
      eyebrow={
        report
          ? 'Relatórios / ' + report.reportType.code + ' · ' + (report.number || 'Sem número')
          : 'Documentação técnica'
      }
    >
      <Notice error={query.error || remove.error} />
      {query.isPending && <Loading />}
      {report && (
        <>
          <ReportProgress status={report.status} />
          {!!report.revisionNotes && (
            <Info text={'Observações da análise: ' + report.revisionNotes} icon="edit" />
          )}
          {editable ? (
            <ReportForm
              type={report.reportType}
              report={report}
              companyId={report.companyId}
              projectId={report.projectId}
            />
          ) : (
            <>
              <ReportSummary report={report} />
              <ReportActions report={report} />
            </>
          )}
          {report.status === 'DRAFT' && can('reports.delete') && (
            <View style={{ alignSelf: 'flex-start' }}>
              <Button
                title="Excluir rascunho"
                variant="ghost"
                icon="trash"
                onPress={() => setDeleting(true)}
              />
            </View>
          )}
          <ConfirmDialog
            visible={deleting}
            title="Excluir este rascunho?"
            description="O relatório deixará de aparecer nas listas. Os registros existentes serão preservados no histórico."
            confirmLabel="Excluir rascunho"
            danger
            busy={remove.isPending}
            onClose={() => setDeleting(false)}
            onConfirm={() => remove.mutate()}
          />
        </>
      )}
    </Page>
  );
}
