import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { Person } from '@weldcosta/shared';
import { Page, Button, Choice, Empty } from '../../../components/ui';
import { PeopleList, PersonForm } from '../../../features/people/people';
import { usePermission } from '../../../hooks/use-permission';
import { useNavigationGuard } from '../../../stores/navigation';
export default function PeopleScreen() {
  const [editing, setEditing] = useState<Person | 'new' | null>(null),
    [active, setActive] = useState(true);
  const canEdit = usePermission('people.manage'),
    canView = usePermission('people.view');
  useEffect(() => {
    useNavigationGuard.getState().setDirty(!!editing);
    return () => useNavigationGuard.getState().setDirty(false);
  }, [editing]);
  return (
    <Page
      title="Pessoas e assinaturas"
      back={{ label: 'Voltar para início', href: '/dashboard' }}
      subtitle="Cadastre uma vez e selecione nos relatórios. Os dados continuam editáveis em cada documento."
      action={
        canEdit && !editing ? (
          <Button title="Cadastrar pessoa" icon="plus" onPress={() => setEditing('new')} />
        ) : undefined
      }
    >
      {!canView ? (
        <Empty
          title="Acesso restrito"
          text="Preencha os responsáveis diretamente no relatório. O cadastro geral de pessoas é reservado à administração e ao gerente."
          icon="lock"
        />
      ) : editing ? (
        <PersonForm
          key={editing === 'new' ? 'new' : editing.id}
          person={editing === 'new' ? undefined : editing}
          onSaved={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Choice label="Ativos" selected={active} onPress={() => setActive(true)} />
            <Choice label="Inativos" selected={!active} onPress={() => setActive(false)} />
          </View>
          <PeopleList
            key={String(active)}
            active={active}
            onSelect={canEdit ? setEditing : undefined}
          />
        </>
      )}
    </Page>
  );
}
