import { useState } from 'react';
import { View, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Tutorial } from '@weldcosta/shared';
import { api, jsonBody } from '../../../services/api';
import { Page, Card, Button, Loading, Notice, Empty } from '../../../components/ui';
import { ConfirmDialog } from '../../../components/confirm-dialog';
import { TutorialForm } from '../../../features/tutorials/tutorial-form';
import { TutorialMedia } from '../../../features/tutorials/tutorial-media';
import { usePermission } from '../../../hooks/use-permission';
import { useTheme } from '../../../utils/theme';
import { requestNavigation } from '../../../stores/navigation';

export default function TutorialDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { styles } = useTheme();
  const canView = usePermission('training.view'),
    canManage = usePermission('training.manage');
  const [editing, setEditing] = useState(false),
    [removing, setRemoving] = useState(false);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['tutorial', id],
    queryFn: () => api<Tutorial>('/tutorials/' + id),
    enabled: canView,
    refetchOnWindowFocus: false,
  });
  const remove = useMutation({
    mutationFn: () => api('/tutorials/' + id, jsonBody('DELETE', { version: query.data!.version })),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['tutorials'] });
      client.removeQueries({ queryKey: ['tutorial', id] });
      router.replace('/tutorials');
    },
    onError: () => setRemoving(false),
  });
  const item = query.data;
  return (
    <Page
      title={item?.title ?? 'Tutorial'}
      eyebrow="Tutoriais da equipe"
      action={
        <Button
          title="Voltar aos tutoriais"
          variant="ghost"
          icon="arrow-left"
          onPress={() => requestNavigation(() => router.push('/tutorials'))}
        />
      }
    >
      {!canView ? (
        <Empty title="Acesso restrito" text="Você não possui acesso aos tutoriais." icon="lock" />
      ) : (
        <>
          <Notice error={query.error} />
          {query.isPending && <Loading />}
          {query.isError && (
            <Button title="Tentar novamente" secondary onPress={() => void query.refetch()} />
          )}
          {item &&
            (editing && canManage ? (
              <TutorialForm
                key={item.id}
                tutorial={item}
                onSaved={() => setEditing(false)}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <>
                <Card>
                  {!!item.description && <Text style={styles.text}>{item.description}</Text>}
                  {!!item.content && <Text style={styles.text}>{item.content}</Text>}
                  {item.originalName && <Text style={styles.muted}>{item.originalName}</Text>}
                  {item.mimeType && (
                    <TutorialMedia key={item.id + ':' + item.version} item={item} />
                  )}
                </Card>
                {canManage && (
                  <View style={styles.row}>
                    <Button
                      title="Editar tutorial"
                      secondary
                      icon="edit"
                      onPress={() => setEditing(true)}
                    />
                    <Button
                      title="Remover tutorial"
                      variant="ghost"
                      icon="trash"
                      onPress={() => {
                        remove.reset();
                        setRemoving(true);
                      }}
                    />
                  </View>
                )}
              </>
            ))}
        </>
      )}
      <ConfirmDialog
        visible={removing}
        title="Remover tutorial?"
        description="O material deixará de estar disponível para toda a equipe."
        confirmLabel="Remover tutorial"
        danger
        busy={remove.isPending}
        onClose={() => setRemoving(false)}
        onConfirm={() => remove.mutate()}
      />
      <Notice error={remove.error} />
    </Page>
  );
}
