import { router } from 'expo-router';
import { Page, Button, Empty } from '../../../components/ui';
import { TutorialForm } from '../../../features/tutorials/tutorial-form';
import { usePermission } from '../../../hooks/use-permission';
import { requestNavigation } from '../../../stores/navigation';
export default function NewTutorial() {
  const allowed = usePermission('training.manage');
  return (
    <Page
      title="Novo tutorial"
      subtitle="O material ficará disponível para os usuários do sistema."
      action={
        <Button
          title="Voltar aos tutoriais"
          variant="ghost"
          icon="arrow-left"
          onPress={() => requestNavigation(() => router.push('/tutorials'))}
        />
      }
    >
      {allowed ? (
        <TutorialForm
          onSaved={(item) => router.replace('/tutorials/' + item.id)}
          onCancel={() => router.push('/tutorials')}
        />
      ) : (
        <Empty
          title="Acesso restrito"
          text="Somente a administração pode publicar materiais."
          icon="lock"
        />
      )}
    </Page>
  );
}
