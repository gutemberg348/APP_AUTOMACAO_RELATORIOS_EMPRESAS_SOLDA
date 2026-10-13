import { useEffect, useState } from 'react';
import { Image, Platform, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { tutorialKind, type Tutorial } from '@weldcosta/shared';
import { api, apiBlob, apiUrl } from '../../services/api';
import { useAuth } from '../../stores/auth';
import { Button, Loading, Notice } from '../../components/ui';
import { TutorialVideo } from './tutorial-video';

export function TutorialMedia({ item }: { item: Tutorial }) {
  const [opened, setOpened] = useState(tutorialKind(item.mimeType) === 'image');
  const [uri, setUri] = useState('');
  const [error, setError] = useState<unknown>();
  const token = useAuth((state) => state.session?.accessToken);
  const endpoint = '/tutorials/' + item.id + '/file';
  const kind = tutorialKind(item.mimeType);
  useEffect(() => {
    if (!opened || Platform.OS !== 'web') return;
    let active = true,
      url = '';
    void apiBlob(endpoint)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        if (active) setUri(url);
        else URL.revokeObjectURL(url);
      })
      .catch((cause) => {
        if (active) setError(cause);
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [opened, endpoint]);
  const download = useMutation({
    mutationFn: async () => {
      if (Platform.OS === 'web') {
        const url = uri || URL.createObjectURL(await apiBlob(endpoint));
        const link = document.createElement('a');
        link.href = url;
        link.download = item.originalName ?? 'tutorial';
        document.body.appendChild(link);
        link.click();
        link.remove();
        if (!uri) setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        if (!(await Sharing.isAvailableAsync()))
          throw new Error('O compartilhamento não está disponível neste dispositivo.');
        await api('/auth/me');
        const file = new File(
          Paths.cache,
          item.id + '-' + (item.originalName ?? 'tutorial').replace(/[^\p{L}\p{N}._-]/gu, '_'),
        );
        try {
          await File.downloadFileAsync(apiUrl + endpoint, file, {
            headers: { Authorization: 'Bearer ' + useAuth.getState().session!.accessToken },
            idempotent: true,
          });
          await Sharing.shareAsync(file.uri, {
            mimeType: item.mimeType ?? undefined,
            dialogTitle: item.title,
          });
        } catch (cause) {
          if (file.exists) file.delete();
          throw cause;
        }
      }
    },
  });
  const ready = Platform.OS !== 'web' || !!uri;
  const source =
    Platform.OS === 'web'
      ? { uri }
      : { uri: apiUrl + endpoint, headers: { Authorization: 'Bearer ' + token } };
  return (
    <View style={{ gap: 16 }}>
      <Notice error={error || download.error} />
      {opened && !ready && !error && <Loading />}
      {opened && ready && kind === 'image' && (
        <Image
          accessibilityLabel={item.title}
          source={source}
          resizeMode="contain"
          onError={() =>
            setError(new Error('Não foi possível carregar a foto. Tente baixar o material.'))
          }
          style={{ width: '100%', height: 360, borderRadius: 12 }}
        />
      )}
      {opened && ready && kind === 'video' && <TutorialVideo {...source} />}
      {opened && ready && Platform.OS === 'web' && item.mimeType === 'application/pdf' && (
        <iframe
          title={item.title}
          src={uri}
          style={{ width: '100%', height: 580, border: 0, borderRadius: 12 }}
        />
      )}
      {!opened &&
        (kind === 'video' || (Platform.OS === 'web' && item.mimeType === 'application/pdf')) && (
          <Button
            title={kind === 'video' ? 'Assistir vídeo' : 'Visualizar PDF'}
            icon={kind === 'video' ? 'play' : 'eye'}
            onPress={() => setOpened(true)}
          />
        )}
      <Button
        title={Platform.OS === 'web' ? 'Baixar material' : 'Abrir / compartilhar material'}
        secondary
        icon="download"
        busy={download.isPending}
        onPress={() => download.mutate()}
      />
    </View>
  );
}
