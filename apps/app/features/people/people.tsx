import { useState } from 'react';
import { ScrollView, Text, View, Switch } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  personSchema,
  type Person,
  type PersonInput,
  type Paginated,
  type ReportSigner,
} from '@weldcosta/shared';
import { api, jsonBody } from '../../services/api';
import { useTheme } from '../../utils/theme';
import {
  Button,
  Card,
  Field,
  FormGrid,
  FormCell,
  Notice,
  Loading,
  Pager,
  SearchField,
  PanelHeader,
} from '../../components/ui';
import { SelectField } from '../../components/select-field';
import { PickerSheet } from '../../components/picker-sheet';
import { SignatureField } from './signature-field';

export const personRoles = [
  { value: 'INSPECTOR', label: 'Inspetor' },
  { value: 'TECHNICAL_RESPONSIBLE', label: 'Responsável técnico' },
  { value: 'CLIENT', label: 'Cliente' },
  { value: 'REVIEWER', label: 'Revisor' },
  { value: 'OTHER', label: 'Outro' },
];
export function personSigner(person: Person): ReportSigner {
  return {
    name: person.name,
    role: person.role,
    registrationNumber: person.registrationNumber ?? '',
    signatureAssetId: person.signatureAssetId ?? null,
  };
}
export function PersonForm({
  person,
  initial,
  onSaved,
  onCancel,
}: {
  person?: Person;
  initial?: Partial<PersonInput>;
  onSaved(person: Person): void;
  onCancel(): void;
}) {
  const { styles } = useTheme(),
    client = useQueryClient();
  const [data, setData] = useState<PersonInput>(() => ({
    name: person?.name ?? initial?.name ?? '',
    role: person?.role ?? initial?.role ?? 'INSPECTOR',
    registrationNumber: person?.registrationNumber ?? initial?.registrationNumber ?? '',
    company: person?.company ?? '',
    email: person?.email ?? '',
    phone: person?.phone ?? '',
    signatureAssetId: person?.signatureAssetId ?? initial?.signatureAssetId ?? null,
  }));
  const [active, setActive] = useState(person?.active ?? true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  const [invalid, setInvalid] = useState<Record<string, string>>({});
  const field = (key: keyof PersonInput, value: string | null) =>
    setData((old) => ({ ...old, [key]: value }));
  return (
    <Card>
      <PanelHeader
        title={person ? 'Editar pessoa' : 'Cadastrar pessoa'}
        subtitle="Salve os dados e a assinatura para usar nos próximos relatórios."
        icon="user"
      />
      <Notice error={error} />
      <FormGrid>
        <FormCell>
          <Field
            label="Nome completo"
            required
            value={data.name}
            onChangeText={(v) => field('name', v)}
            error={invalid.name}
            editable={!busy}
          />
        </FormCell>
        <FormCell>
          <SelectField
            label="Função padrão"
            value={data.role}
            options={personRoles}
            clearable={false}
            onChange={(v) => field('role', v)}
            disabled={busy}
          />
        </FormCell>
        <FormCell>
          <Field
            label="Registro profissional"
            value={data.registrationNumber}
            onChangeText={(v) => field('registrationNumber', v)}
            error={invalid.registrationNumber}
            editable={!busy}
          />
        </FormCell>
        <FormCell>
          <Field
            label="Empresa / organização (opcional)"
            value={data.company}
            onChangeText={(v) => field('company', v)}
            error={invalid.company}
            editable={!busy}
          />
        </FormCell>
        <FormCell>
          <Field
            label="E-mail (opcional)"
            value={data.email}
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={(v) => field('email', v)}
            error={invalid.email}
            editable={!busy}
          />
        </FormCell>
        <FormCell>
          <Field
            label="Telefone (opcional)"
            mask="phone"
            value={data.phone}
            onChangeText={(v) => field('phone', v)}
            editable={!busy}
          />
        </FormCell>
      </FormGrid>
      <SignatureField
        value={data.signatureAssetId}
        onChange={(id) => field('signatureAssetId', id)}
        editable={!busy}
      />
      {person && (
        <View style={styles.row}>
          <Switch value={active} onValueChange={setActive} disabled={busy} />
          <Text style={styles.text}>Disponível para novos relatórios</Text>
        </View>
      )}
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <Button
          title="Salvar cadastro"
          icon="save"
          busy={busy}
          onPress={async () => {
            setError(undefined);
            const parsed = personSchema.safeParse(data);
            if (!parsed.success) {
              setInvalid(
                Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])),
              );
              setError(new Error('Confira os campos destacados.'));
              return;
            }
            setInvalid({});
            setBusy(true);
            try {
              const saved = await api<Person>(
                '/people' + (person ? '/' + person.id : ''),
                jsonBody(person ? 'PUT' : 'POST', {
                  ...parsed.data,
                  ...(person ? { version: person.version, active } : {}),
                }),
              );
              void client.invalidateQueries({ queryKey: ['people'] });
              onSaved(saved);
            } catch (e) {
              setError(e);
            } finally {
              setBusy(false);
            }
          }}
        />
        <Button title="Cancelar" secondary disabled={busy} onPress={onCancel} />
      </View>
    </Card>
  );
}

export function PeopleList({
  onSelect,
  active = true,
}: {
  onSelect?(person: Person): void;
  active?: boolean;
}) {
  const { styles } = useTheme();
  const [search, setSearch] = useState(''),
    [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['people', search, page, active],
    queryFn: () =>
      api<Paginated<Person>>(
        `/people?search=${encodeURIComponent(search)}&page=${page}&active=${active}`,
      ),
  });
  return (
    <View style={{ gap: 14 }}>
      <SearchField
        label="Buscar pessoa"
        placeholder="Nome, registro ou empresa"
        value={search}
        onChangeText={(v) => {
          setSearch(v);
          setPage(1);
        }}
      />
      <Notice error={query.error} />
      {query.isPending && <Loading />}
      {query.data?.items.map((person) => (
        <View key={person.id} style={{ gap: 4 }}>
          {onSelect ? (
            <Button title={person.name} icon="user" secondary onPress={() => onSelect(person)} />
          ) : (
            <Text style={styles.label}>{person.name}</Text>
          )}
          <Text style={styles.muted}>
            {[
              personRoles.find((r) => r.value === person.role)?.label,
              person.registrationNumber,
              person.company,
              person.signatureAssetId ? 'Assinatura salva' : 'Sem assinatura',
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      ))}
      {query.data?.total === 0 && <Text style={styles.muted}>Nenhuma pessoa encontrada.</Text>}
      {!!query.data && query.data.pages > 1 && (
        <Pager page={page} pages={query.data.pages} onChange={setPage} />
      )}
    </View>
  );
}
export function PersonPicker({
  visible,
  onClose,
  onSelect,
  onNew,
}: {
  visible: boolean;
  onClose(): void;
  onSelect(person: Person): void;
  onNew(): void;
}) {
  return (
    <PickerSheet
      visible={visible}
      title="Escolher pessoa cadastrada"
      subtitle="Nome, registro e assinatura serão preenchidos no relatório."
      icon="user"
      onClose={onClose}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, gap: 18 }}
      >
        {visible && <PeopleList onSelect={onSelect} />}
        <Button title="Cadastrar nova pessoa" icon="plus" onPress={onNew} />
      </ScrollView>
    </PickerSheet>
  );
}
