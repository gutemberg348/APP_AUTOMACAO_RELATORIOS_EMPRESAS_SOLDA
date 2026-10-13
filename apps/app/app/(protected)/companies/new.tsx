import { requestNavigation } from '../../../stores/navigation';
import { router } from 'expo-router';
import { Page, Empty, Button } from '../../../components/ui';
import { CompanyForm } from '../../../features/companies/company-form';
import { usePermission } from '../../../hooks/use-permission';
export default function NewCompany() {
  const allowed = usePermission('companies.create');
  return (
    <Page
      title="Nova empresa"
      subtitle="Cadastre um cliente para organizar suas obras e relatórios."
      eyebrow="Empresas / Novo cadastro"
      action={
        <Button
          title="Voltar às empresas"
          variant="ghost"
          icon="arrow-left"
          onPress={() => requestNavigation(() => router.push('/companies'))}
        />
      }
    >
      {allowed ? (
        <CompanyForm />
      ) : (
        <Empty
          title="Acesso restrito"
          text="Você não possui permissão para cadastrar empresas."
          icon="lock"
        />
      )}
    </Page>
  );
}
