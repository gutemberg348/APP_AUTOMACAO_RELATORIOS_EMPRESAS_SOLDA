import { useState } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import type { ManagedUser } from '@weldcosta/shared';
import { api, ApiError, jsonBody } from '../../services/api';
import { useAuth } from '../../stores/auth';
import { usePermission } from '../../hooks/use-permission';
import { useTheme } from '../../utils/theme';
import { userErrorGuidance } from './user-feedback';
import { Button, Notice } from '../../components/ui';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { PickerSheet } from '../../components/picker-sheet';
import { UserPasswordForm } from './user-form';
const dismissDelay = () => new Promise<void>((resolve) => setTimeout(resolve, 300));

export function UserActions({
  user,
  onUpdated,
  detail = false,
}: {
  user: ManagedUser;
  onUpdated?(user?: ManagedUser): void;
  detail?: boolean;
}) {
  const client = useQueryClient(),
    { styles, tokens: t } = useTheme();
  const self = useAuth((s) => s.session?.user.id) === user.id;
  const canEdit = usePermission('users.edit'),
    canDisable = usePermission('users.disable'),
    canDelete = usePermission('users.delete');
  const [confirm, setConfirm] = useState<'status' | 'delete' | 'restore' | null>(null),
    [password, setPassword] = useState(false),
    [busy, setBusy] = useState(false),
    [passwordBusy, setPasswordBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState<unknown>();
  const refresh = async (saved?: ManagedUser) => {
    if (saved) client.setQueryData(['users', 'detail', user.id], saved);
    await client.invalidateQueries({ queryKey: ['users'] });
    onUpdated?.(saved);
  };
  const reload = async () => {
    setBusy(true);
    try {
      await refresh(await api<ManagedUser>('/users/' + user.id));
      setError(undefined);
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };
  const action = async () => {
    if (!confirm) return;
    setBusy(true);
    setError(undefined);
    setMessage('');
    try {
      const suffix = confirm === 'status' ? '/status' : confirm === 'restore' ? '/restore' : '';
      const saved = await api<ManagedUser | { deleted: true }>(
        '/users/' + user.id + suffix,
        jsonBody(confirm === 'delete' ? 'DELETE' : 'PATCH', {
          updatedAt: user.updatedAt,
          ...(confirm === 'status'
            ? { status: user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' }
            : {}),
        }),
      );
      setConfirm(null);
      await dismissDelay();
      await refresh('id' in saved ? saved : undefined);
      setMessage(
        confirm === 'restore'
          ? 'Usuário restaurado.'
          : confirm === 'status'
            ? user.status === 'ACTIVE'
              ? 'Usuário inativado.'
              : 'Usuário ativado.'
            : 'Usuário excluído.',
      );
      if (detail && confirm === 'delete') router.replace('/users');
    } catch (cause) {
      setConfirm(null);
      await dismissDelay();
      setError(cause);
    } finally {
      setBusy(false);
    }
  };
  const closePassword = async () => {
    if (passwordBusy) return;
    setBusy(true);
    setPassword(false);
    await dismissDelay();
    setBusy(false);
  };
  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        {!detail && (
          <Button
            title={user.deletedAt ? 'Ver cadastro' : 'Abrir cadastro'}
            icon="edit"
            secondary
            small
            disabled={busy}
            onPress={() => router.push('/users/' + user.id)}
          />
        )}
        {!user.deletedAt && canEdit && (
          <Button
            title="Alterar senha"
            icon="lock"
            secondary
            small
            disabled={busy}
            onPress={() => {
              setError(undefined);
              setMessage('');
              setPassword(true);
            }}
          />
        )}
        {!user.deletedAt && canDisable && !self && (
          <Button
            title={user.status === 'ACTIVE' ? 'Inativar' : 'Ativar'}
            icon={user.status === 'ACTIVE' ? 'archive' : 'check-circle'}
            secondary
            small
            disabled={busy}
            onPress={() => setConfirm('status')}
          />
        )}
        {canDelete && !self && (
          <Button
            title={user.deletedAt ? 'Restaurar usuário' : 'Excluir usuário'}
            icon={user.deletedAt ? 'undo' : 'trash'}
            variant={user.deletedAt ? 'secondary' : 'danger'}
            small
            disabled={busy}
            onPress={() => setConfirm(user.deletedAt ? 'restore' : 'delete')}
          />
        )}
      </View>
      {self && (
        <Text style={[styles.muted, { fontSize: 12 }]}>
          Sua conta: use outro administrador para inativar ou excluir seu acesso.
        </Text>
      )}
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={[styles.text, { color: t.colors.blue }]}>
          {message}
        </Text>
      )}
      <Notice error={error} guidance={userErrorGuidance(error)} />
      {error instanceof ApiError && error.code === 'VERSION_CONFLICT' && (
        <Button
          title="Atualizar cadastro"
          secondary
          small
          busy={busy}
          onPress={() => void reload()}
        />
      )}
      <ConfirmDialog
        visible={!!confirm}
        title={
          confirm === 'delete'
            ? 'Excluir usuário?'
            : confirm === 'restore'
              ? 'Restaurar usuário?'
              : user.status === 'ACTIVE'
                ? 'Inativar usuário?'
                : 'Ativar usuário?'
        }
        description={
          confirm === 'delete'
            ? `${user.name} perderá o acesso e irá para Excluídos. O histórico dos relatórios será preservado.`
            : confirm === 'restore'
              ? `${user.name} voltará à lista com acesso ativo. A senha anterior continua válida.`
              : user.status === 'ACTIVE'
                ? `${user.name} não poderá mais entrar no sistema e suas sessões serão encerradas.`
                : `${user.name} poderá entrar novamente com a senha cadastrada.`
        }
        confirmLabel={
          confirm === 'delete'
            ? 'Excluir usuário'
            : confirm === 'restore'
              ? 'Restaurar usuário'
              : user.status === 'ACTIVE'
                ? 'Inativar'
                : 'Ativar'
        }
        busy={busy}
        danger={confirm === 'delete' || (confirm === 'status' && user.status === 'ACTIVE')}
        onClose={() => {
          if (!busy) {
            setBusy(true);
            setConfirm(null);
            void dismissDelay().then(() => setBusy(false));
          }
        }}
        onConfirm={() => void action()}
      />
      <PickerSheet
        visible={password}
        title="Alterar senha"
        subtitle={user.name + ' · ' + user.email}
        icon="lock"
        onClose={() => {
          void closePassword();
        }}
      >
        {password && (
          <UserPasswordForm
            user={user}
            onBusyChange={setPasswordBusy}
            onReload={() => {
              void closePassword().then(() => reload());
            }}
            onCancel={() => void closePassword()}
            onSaved={(saved) => {
              setPassword(false);
              setBusy(true);
              void dismissDelay()
                .then(async () => {
                  if (self) {
                    await useAuth.getState().clear();
                    client.clear();
                    router.replace('/login');
                  } else {
                    await refresh(saved);
                    setMessage('Senha atualizada. A pessoa já pode entrar com a nova senha.');
                  }
                })
                .catch(setError)
                .finally(() => setBusy(false));
            }}
          />
        )}
      </PickerSheet>
    </View>
  );
}
