import { requestNavigation } from '../../../stores/navigation';
import { useLocalSearchParams, router } from 'expo-router';
import { Page, Empty, Button } from '../../../components/ui';
import { ProjectForm } from '../../../features/projects/project-form';
import { usePermission } from '../../../hooks/use-permission';
export default function NewProject() {
  const { companyId } = useLocalSearchParams<{ companyId?: string }>();
  const allowed = usePermission('projects.create');
  return (
    <Page
      title="Nova obra"
      subtitle="Reúna os relatórios de inspeção do projeto em um único lugar."
      eyebrow="Obras / Novo cadastro"
      action={
        <Button
          title="Voltar às obras"
          variant="ghost"
          icon="arrow-left"
          onPress={() =>
            requestNavigation(() =>
              router.push('/projects' + (companyId ? '?companyId=' + companyId : '')),
            )
          }
        />
      }
    >
      {allowed ? (
        <ProjectForm companyId={companyId} />
      ) : (
        <Empty
          title="Acesso restrito"
          text="Você não possui permissão para cadastrar obras."
          icon="lock"
        />
      )}
    </Page>
  );
}
