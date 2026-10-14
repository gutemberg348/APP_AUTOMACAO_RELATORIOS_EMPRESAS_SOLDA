import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  userProfileSchema,
  userCreateSchema,
  userPassword,
  userRoleLabels,
  userRoleDescriptions,
  type ManagedUser,
  type UserRole,
} from '@weldcosta/shared';
import { api, ApiError, jsonBody } from '../../services/api';
import { useAuth } from '../../stores/auth';
import { useTheme } from '../../utils/theme';
import { useUnsavedChanges } from '../../hooks/use-unsaved-changes';
import { usePageScroll } from '../../components/page-scroll';
import { apiValidationIssues } from '../../utils/form-feedback';
import { userErrorGuidance } from './user-feedback';
import {
  Button,
  Card,
  Field,
  FormGrid,
  FormCell,
  PanelHeader,
  Notice,
  IconButton,
} from '../../components/ui';
import { SelectField } from '../../components/select-field';

export function UserForm({
  user,
  onSaved,
  onCancel,
}: {
  user?: ManagedUser;
  onSaved(user: ManagedUser): void;
  onCancel(): void;
}) {
  const { styles } = useTheme(),
    client = useQueryClient();
  const self = useAuth((s) => s.session?.user.id) === user?.id;
  const initial = {
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    roleId: user?.role.id ?? '',
    password: '',
    confirm: '',
  };
  const [values, setValues] = useState(initial),
    [busy, setBusy] = useState(false),
    [show, setShow] = useState(false),
    [error, setError] = useState<unknown>(),
    [invalid, setInvalid] = useState<Record<string, string>>({});
  const dirty = Object.entries(values).some(
    ([key, value]) => value !== initial[key as keyof typeof initial],
  );
  useUnsavedChanges(dirty);
  const reveal = usePageScroll(),
    nodes = useRef<Record<string, View | null>>({});
  const [feedback, setFeedback] = useState({ field: '', attempt: 0 });
  useEffect(() => {
    if (feedback.attempt) {
      const frame = requestAnimationFrame(() => reveal(nodes.current[feedback.field]));
      return () => cancelAnimationFrame(frame);
    }
  }, [feedback, reveal]);
  const roles = useQuery({
    queryKey: ['user-roles'],
    queryFn: () => api<UserRole[]>('/users/roles'),
  });
  const field = (key: keyof typeof values, value: string) => {
    setValues((old) => ({ ...old, [key]: value }));
    setInvalid((old) => ({ ...old, [key]: '' }));
  };
  const problem = (issues: { path: readonly PropertyKey[]; message: string }[]) => {
    setInvalid(Object.fromEntries(issues.map((issue) => [String(issue.path[0]), issue.message])));
    setError(new Error('Confira os campos destacados para continuar.'));
    setFeedback((old) => ({
      field: String(issues[0]?.path[0] ?? 'feedback'),
      attempt: old.attempt + 1,
    }));
  };
  const save = async () => {
    setError(undefined);
    setInvalid({});
    const profile = {
      name: values.name,
      email: values.email,
      phone: values.phone,
      roleId: values.roleId,
    };
    const parsed = user
      ? userProfileSchema.safeParse(profile)
      : userCreateSchema.safeParse({ ...profile, password: values.password });
    if (!parsed.success) {
      problem(parsed.error.issues);
      return;
    }
    if (!user && values.password !== values.confirm) {
      problem([{ path: ['confirm'], message: 'As senhas devem ser iguais.' }]);
      return;
    }
    setBusy(true);
    try {
      const saved = await api<ManagedUser>(
        user ? '/users/' + user.id : '/users',
        jsonBody(user ? 'PUT' : 'POST', {
          ...parsed.data,
          ...(user ? { updatedAt: user.updatedAt } : {}),
        }),
      );
      await client.invalidateQueries({ queryKey: ['users'] });
      if (self) await client.invalidateQueries({ queryKey: ['me'] });
      onSaved(saved);
    } catch (cause) {
      const issues = apiValidationIssues(cause);
      if (issues.length) problem(issues);
      else {
        setError(cause);
        if (cause instanceof ApiError && cause.code === 'EMAIL_IN_USE')
          setInvalid({ email: cause.message });
        setFeedback((old) => ({ field: 'feedback', attempt: old.attempt + 1 }));
      }
    } finally {
      setBusy(false);
    }
  };
  const render = (key: 'name' | 'email' | 'phone' | 'password' | 'confirm', label: string) => (
    <FormCell key={key}>
      <View
        ref={(node) => {
          nodes.current[key] = node;
        }}
      >
        <Field
          label={label}
          required={key !== 'phone'}
          value={values[key]}
          onChangeText={(value) => field(key, value)}
          editable={!busy}
          mask={key === 'phone' ? 'phone' : undefined}
          keyboardType={key === 'email' ? 'email-address' : 'default'}
          autoCapitalize={key === 'name' ? 'words' : 'none'}
          autoCorrect={key === 'name'}
          secureTextEntry={(key === 'password' || key === 'confirm') && !show}
          autoComplete={
            key === 'password' || key === 'confirm'
              ? 'new-password'
              : key === 'email'
                ? 'email'
                : 'off'
          }
          error={invalid[key]}
          hint={
            key === 'password'
              ? 'Pelo menos 12 caracteres. A senha pode ser alterada depois.'
              : undefined
          }
          trailing={
            key === 'password' || key === 'confirm' ? (
              <IconButton
                icon={show ? 'eye-off' : 'eye'}
                label={show ? 'Ocultar senhas' : 'Mostrar senhas'}
                onPress={() => setShow(!show)}
                disabled={busy}
              />
            ) : undefined
          }
        />
      </View>
    </FormCell>
  );
  return (
    <Card>
      <PanelHeader
        title={user ? 'Dados do usuário' : 'Cadastrar usuário'}
        subtitle="Defina o acesso ao sistema e o perfil de trabalho."
        icon="user"
      />
      <FormGrid>
        {render('name', 'Nome completo')}
        {render('email', 'E-mail de acesso')}
        {render('phone', 'Telefone (opcional)')}
        <FormCell>
          <View
            ref={(node) => {
              nodes.current.roleId = node;
            }}
          >
            <SelectField
              label="Perfil de acesso"
              required
              clearable={false}
              value={values.roleId}
              options={(roles.data ?? []).map((role) => ({
                value: role.id,
                label: userRoleLabels[role.code] ?? role.name,
                description: userRoleDescriptions[role.code],
                icon: 'shield',
              }))}
              onChange={(value) => field('roleId', value)}
              error={invalid.roleId}
              disabled={busy || self || roles.isPending}
            />
          </View>
        </FormCell>
      </FormGrid>
      <Text style={styles.muted}>
        {self
          ? 'Seu perfil de administrador está protegido para manter seu acesso.'
          : (userRoleDescriptions[
              roles.data?.find((role) => role.id === values.roleId)?.code ?? ''
            ] ?? 'Selecione o perfil conforme as tarefas dessa pessoa.')}
      </Text>
      <Notice error={roles.error} />
      {roles.isError && (
        <Button title="Carregar perfis novamente" secondary onPress={() => void roles.refetch()} />
      )}
      {!user && (
        <>
          <PanelHeader
            title="Senha de acesso"
            subtitle="Informe uma senha para a pessoa entrar no sistema."
            icon="lock"
          />
          <FormGrid>
            {render('password', 'Senha inicial')}
            {render('confirm', 'Confirmar senha')}
          </FormGrid>
        </>
      )}
      <View
        ref={(node) => {
          nodes.current.feedback = node;
        }}
      >
        <Notice error={error} guidance={userErrorGuidance(error)} />
        {error instanceof ApiError && error.code === 'VERSION_CONFLICT' && (
          <Button title="Atualizar cadastro" secondary disabled={busy} onPress={onCancel} />
        )}
      </View>
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <Button
          title={busy ? 'Salvando usuário…' : user ? 'Salvar alterações' : 'Cadastrar usuário'}
          icon="save"
          busy={busy}
          onPress={() => void save()}
        />
        <Button title="Cancelar" secondary disabled={busy} onPress={onCancel} />
      </View>
    </Card>
  );
}

export function UserPasswordForm({
  user,
  onSaved,
  onCancel,
  onBusyChange,
  onReload,
}: {
  user: ManagedUser;
  onSaved(user: ManagedUser): void;
  onCancel(): void;
  onBusyChange?(busy: boolean): void;
  onReload?(): void;
}) {
  const { styles } = useTheme();
  const [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(),
    [invalid, setInvalid] = useState<Record<string, string>>({});
  useEffect(() => {
    onBusyChange?.(busy);
    return () => {
      onBusyChange?.(false);
    };
  }, [busy, onBusyChange]);
  const save = async () => {
    setError(undefined);
    setInvalid({});
    const parsed = userPassword.safeParse(password);
    if (!parsed.success) {
      setInvalid({ password: parsed.error.issues[0]?.message ?? 'Confira a nova senha.' });
      setError(new Error('Confira a nova senha.'));
      return;
    }
    if (password !== confirm) {
      setInvalid({ confirm: 'As senhas devem ser iguais.' });
      setError(new Error('Confirme a mesma senha nos dois campos.'));
      return;
    }
    setBusy(true);
    try {
      onSaved(
        await api<ManagedUser>(
          '/users/' + user.id + '/password',
          jsonBody('PATCH', { password, updatedAt: user.updatedAt }),
        ),
      );
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 18 }}>
      <Text style={styles.muted}>
        Ao salvar, a pessoa precisará entrar novamente com a nova senha.
      </Text>
      <Field
        label="Nova senha"
        required
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        secureTextEntry={!show}
        editable={!busy}
        error={invalid.password}
        hint="Use pelo menos 12 caracteres."
        trailing={
          <IconButton
            icon={show ? 'eye-off' : 'eye'}
            label={show ? 'Ocultar senha' : 'Mostrar senha'}
            onPress={() => setShow(!show)}
            disabled={busy}
          />
        }
      />
      <Field
        label="Confirmar nova senha"
        required
        value={confirm}
        onChangeText={setConfirm}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        secureTextEntry={!show}
        editable={!busy}
        error={invalid.confirm}
      />
      <Notice error={error} guidance={userErrorGuidance(error)} />
      {error instanceof ApiError && error.code === 'VERSION_CONFLICT' && onReload && (
        <Button title="Atualizar cadastro" secondary disabled={busy} onPress={onReload} />
      )}
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <Button title="Salvar nova senha" icon="lock" busy={busy} onPress={() => void save()} />
        <Button title="Cancelar" secondary disabled={busy} onPress={onCancel} />
      </View>
    </View>
  );
}
