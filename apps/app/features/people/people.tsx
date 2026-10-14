import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View, Switch } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  personSaveSchema,
  userRoleLabels,
  userRoleDescriptions,
  type Person,
  type PersonInput,
  type Paginated,
  type ReportSigner,
} from '@weldcosta/shared';
import { api, ApiError, jsonBody } from '../../services/api';
import { useTheme } from '../../utils/theme';
import { usePermission } from '../../hooks/use-permission';
import { usePageScroll } from '../../components/page-scroll';
import { apiValidationIssues, formErrorGuidance } from '../../utils/form-feedback';
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
  IconButton,
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
  const canCreateLogin = usePermission('users.create'),
    canManageLogin = usePermission('users.view');
  const [withLogin, setWithLogin] = useState(false),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [showPassword, setShowPassword] = useState(false),
    [roleCode, setRoleCode] = useState('INSPECTOR');
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
  const nodes = useRef<Record<string, View | null>>({}),
    reveal = usePageScroll();
  const [feedback, setFeedback] = useState({ field: '', attempt: 0 });
  useEffect(() => {
    if (!feedback.attempt) return;
    const frame = requestAnimationFrame(() => reveal(nodes.current[feedback.field]));
    return () => cancelAnimationFrame(frame);
  }, [feedback, reveal]);
  const node = (key: string) => (value: View | null) => {
    nodes.current[key] = value;
  };
  const problem = (issues: { path: readonly PropertyKey[]; message: string }[]) => {
    setInvalid(Object.fromEntries(issues.map((issue) => [issue.path.join('.'), issue.message])));
    setError(
      new Error('Confira os campos destacados para continuar. Seu preenchimento foi mantido.'),
    );
    setFeedback((old) => ({
      field: issues[0]?.path.join('.') ?? 'feedback',
      attempt: old.attempt + 1,
    }));
  };
  const field = (key: keyof PersonInput, value: string | null) => {
    setData((old) => ({ ...old, [key]: value }));
    setInvalid((old) => ({ ...old, [key]: '' }));
  };
  return (
    <Card>
      <PanelHeader
        title={person ? 'Editar pessoa' : 'Cadastrar pessoa'}
        subtitle="Salve os dados e a assinatura para usar nos próximos relatórios."
        icon="user"
      />
      <View ref={node('feedback')}>
        <Notice error={error} guidance={formErrorGuidance(error)} />
      </View>
      <FormGrid>
        <FormCell>
          <View ref={node('name')}>
            <Field
              label="Nome completo"
              required
              value={data.name}
              onChangeText={(v) => field('name', v)}
              error={invalid.name}
              editable={!busy}
            />
          </View>
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
          <View ref={node('email')}>
            <Field
              label={withLogin ? 'E-mail de acesso' : 'E-mail (opcional)'}
              required={withLogin}
              value={data.email}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              autoComplete="email"
              hint={withLogin ? 'Este e-mail será usado para entrar no sistema.' : undefined}
              onChangeText={(v) => field('email', v)}
              error={invalid.email}
              editable={!busy}
            />
          </View>
        </FormCell>
        <FormCell>
          <Field
            label="Telefone (opcional)"
            mask="phone"
            value={data.phone}
            onChangeText={(v) => field('phone', v)}
            error={invalid.phone}
            editable={!busy}
          />
        </FormCell>
      </FormGrid>
      {(canCreateLogin || person?.user) && (
        <Card>
          <PanelHeader
            title="Acesso ao sistema"
            subtitle="O cadastro da pessoa e da assinatura pode existir sem login."
            icon="lock"
          />
          {person?.user ? (
            <>
              <Text style={styles.label}>Login: {person.user.email}</Text>
              <Text style={styles.muted}>
                {userRoleLabels[person.user.role.code] ?? person.user.role.name} ·{' '}
                {person.user.deletedAt
                  ? 'Excluído'
                  : person.user.status === 'ACTIVE'
                    ? 'Ativo'
                    : 'Inativo'}
              </Text>
              <Text style={styles.muted}>
                A senha e o acesso são gerenciados em Usuários. Editar os dados desta pessoa não
                altera seu login.
              </Text>
              {canManageLogin && (
                <Button
                  title="Gerenciar login"
                  icon="user"
                  secondary
                  disabled={busy}
                  onPress={() => router.push('/users/' + person.user!.id)}
                />
              )}
            </>
          ) : (
            <>
              <View style={[styles.row, { alignItems: 'center' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Esta pessoa terá login?</Text>
                  <Text style={styles.muted}>
                    {withLogin
                      ? 'Será criado junto com o cadastro usando o e-mail acima.'
                      : 'Cadastre somente os dados e a assinatura.'}
                  </Text>
                </View>
                <Switch
                  accessibilityLabel="Esta pessoa terá login?"
                  value={withLogin}
                  disabled={busy}
                  onValueChange={(value) => {
                    setWithLogin(value);
                    setInvalid({});
                    setError(undefined);
                    if (!value) {
                      setPassword('');
                      setConfirm('');
                    }
                  }}
                />
              </View>
              {withLogin && (
                <>
                  <View ref={node('login.roleCode')}>
                    <SelectField
                      label="Perfil de acesso"
                      value={roleCode}
                      clearable={false}
                      required
                      disabled={busy}
                      options={Object.entries(userRoleLabels).map(([value, label]) => ({
                        value,
                        label,
                        description: userRoleDescriptions[value],
                        icon: 'shield',
                      }))}
                      onChange={(value) => setRoleCode(value)}
                      error={invalid['login.roleCode']}
                    />
                  </View>
                  <Text style={styles.muted}>{userRoleDescriptions[roleCode]}</Text>
                  <FormGrid>
                    <FormCell>
                      <View ref={node('login.password')}>
                        <Field
                          label="Senha de acesso"
                          required
                          value={password}
                          editable={!busy}
                          secureTextEntry={!showPassword}
                          autoCapitalize="none"
                          autoCorrect={false}
                          autoComplete="new-password"
                          onChangeText={(value) => {
                            setPassword(value);
                            setInvalid((old) => ({ ...old, 'login.password': '' }));
                          }}
                          error={invalid['login.password']}
                          hint="Pelo menos 12 caracteres."
                          trailing={
                            <IconButton
                              icon={showPassword ? 'eye-off' : 'eye'}
                              label={showPassword ? 'Ocultar senhas' : 'Mostrar senhas'}
                              disabled={busy}
                              onPress={() => setShowPassword(!showPassword)}
                            />
                          }
                        />
                      </View>
                    </FormCell>
                    <FormCell>
                      <View ref={node('confirm')}>
                        <Field
                          label="Confirmar senha"
                          required
                          value={confirm}
                          editable={!busy}
                          secureTextEntry={!showPassword}
                          autoCapitalize="none"
                          autoCorrect={false}
                          autoComplete="new-password"
                          onChangeText={(value) => {
                            setConfirm(value);
                            setInvalid((old) => ({ ...old, confirm: '' }));
                          }}
                          error={invalid.confirm}
                        />
                      </View>
                    </FormCell>
                  </FormGrid>
                </>
              )}
            </>
          )}
        </Card>
      )}
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
      {person?.user && (
        <Text style={styles.muted}>
          A disponibilidade nos relatórios não altera o acesso dessa pessoa ao sistema.
        </Text>
      )}
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <Button
          title={withLogin ? 'Salvar pessoa e criar login' : 'Salvar cadastro'}
          icon="save"
          busy={busy}
          onPress={async () => {
            setError(undefined);
            if (busy) return;
            const parsed = personSaveSchema.safeParse({
              ...data,
              ...(withLogin && !person?.userId ? { login: { password, roleCode } } : {}),
            });
            if (!parsed.success) {
              problem(parsed.error.issues);
              return;
            }
            if (withLogin && password !== confirm) {
              problem([{ path: ['confirm'], message: 'As senhas devem ser iguais.' }]);
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
              if (parsed.data.login) void client.invalidateQueries({ queryKey: ['users'] });
              setPassword('');
              setConfirm('');
              onSaved(saved);
            } catch (e) {
              const issues = apiValidationIssues(e);
              if (issues.length) problem(issues);
              else {
                setError(e);
                if (e instanceof ApiError && e.code === 'EMAIL_IN_USE')
                  setInvalid({ email: e.message });
                setFeedback((old) => ({ field: 'feedback', attempt: old.attempt + 1 }));
              }
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
              person.user
                ? person.user.deletedAt
                  ? 'Login excluído'
                  : person.user.status === 'ACTIVE'
                    ? 'Com login'
                    : 'Login inativo'
                : null,
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
