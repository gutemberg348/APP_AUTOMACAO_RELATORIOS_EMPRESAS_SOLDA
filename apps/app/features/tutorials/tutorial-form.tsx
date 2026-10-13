import { useState } from 'react';
import { View, Text } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type * as DocumentPicker from 'expo-document-picker';
import { MediaSourcePicker } from '../../components/media-source-picker';
import {
  tutorialFileTypes,
  tutorialMaxBytes,
  tutorialMetadataSchema,
  type Tutorial,
} from '@weldcosta/shared';
import { api } from '../../services/api';
import { appendUploadFile } from '../../services/upload-file';
import { Button, Card, Field, Notice, PanelHeader } from '../../components/ui';
import { useTheme } from '../../utils/theme';
import { useUnsavedChanges } from '../../hooks/use-unsaved-changes';
import { requestNavigation } from '../../stores/navigation';

export function TutorialForm({
  tutorial,
  onSaved,
  onCancel,
}: {
  tutorial?: Tutorial;
  onSaved(item: Tutorial): void;
  onCancel(): void;
}) {
  const { styles } = useTheme();
  const client = useQueryClient();
  const [title, setTitle] = useState(tutorial?.title ?? '');
  const [description, setDescription] = useState(tutorial?.description ?? '');
  const [asset, setAsset] = useState<DocumentPicker.DocumentPickerAsset>();
  const [error, setError] = useState<unknown>();
  const [titleError, setTitleError] = useState('');
  const [sourceOpen, setSourceOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty =
    !!asset || title !== (tutorial?.title ?? '') || description !== (tutorial?.description ?? '');
  const pick = useMutation({
    mutationFn: async (selected: DocumentPicker.DocumentPickerAsset) => {
      const extension = selected.name.split('.').at(-1)?.toLowerCase();
      const mime = tutorialFileTypes[extension as keyof typeof tutorialFileTypes];
      if (!mime)
        throw new Error(
          'Escolha uma foto, PDF, documento Office ou vídeo em um dos formatos indicados.',
        );
      if (selected.size && selected.size > tutorialMaxBytes(mime))
        throw new Error(
          'O arquivo excede o limite: fotos 10 MB, documentos 20 MB e vídeos 100 MB.',
        );
      setAsset({ ...selected, mimeType: mime });
      setError(undefined);
      if (!title.trim()) setTitle(selected.name.replace(/\.[^.]+$/, '').slice(0, 180));
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      setError(undefined);
      const parsed = tutorialMetadataSchema.safeParse({ title, description });
      setTitleError(
        parsed.success
          ? ''
          : (parsed.error.issues.find((issue) => issue.path[0] === 'title')?.message ?? ''),
      );
      if (!parsed.success) throw new Error('Confira o título e a descrição do tutorial.');
      if (!tutorial && !asset) throw new Error('Selecione o material antes de publicar.');
      const form = new FormData();
      form.append('title', parsed.data.title);
      form.append('description', parsed.data.description);
      if (tutorial) form.append('version', String(tutorial.version));
      if (asset) await appendUploadFile(form, asset, tutorialMaxBytes(asset.mimeType ?? ''));
      return api<Tutorial>(tutorial ? '/tutorials/' + tutorial.id : '/tutorials', {
        method: tutorial ? 'PUT' : 'POST',
        body: form,
      });
    },
    onSuccess: async (item) => {
      setSaved(true);
      client.setQueryData(['tutorial', item.id], item);
      await client.invalidateQueries({ queryKey: ['tutorials'] });
      onSaved(item);
    },
    onError: setError,
  });
  const busy = save.isPending || pick.isPending;
  useUnsavedChanges(!saved && (dirty || busy));
  return (
    <Card>
      <MediaSourcePicker
        visible={sourceOpen}
        includeDocuments
        onClose={() => setSourceOpen(false)}
        onSelect={(asset) => pick.mutate(asset)}
      />
      <PanelHeader
        title={tutorial ? 'Editar tutorial' : 'Compartilhe um material com a equipe'}
        subtitle="Adicione um título, o arquivo e as orientações que ajudam no trabalho."
        icon="book"
      />
      <Notice error={error || pick.error} />
      <Field
        label="Título do tutorial"
        required
        value={title}
        onChangeText={setTitle}
        editable={!busy}
        error={titleError}
        maxLength={180}
        placeholder="Ex.: Como identificar os pontos de solda"
      />
      <Field
        label="Orientações (opcional)"
        value={description}
        onChangeText={setDescription}
        editable={!busy}
        multiline
        maxLength={6000}
        placeholder="Explique quando usar este material ou o que observar."
      />
      <View style={{ gap: 12 }}>
        <Text style={styles.label}>Material do tutorial</Text>
        {(asset || tutorial?.originalName) && (
          <Text style={styles.text}>{asset?.name ?? tutorial?.originalName}</Text>
        )}
        <Button
          title={
            asset || tutorial?.originalName
              ? 'Trocar arquivo'
              : 'Selecionar foto, documento ou vídeo'
          }
          secondary
          icon="plus"
          busy={pick.isPending}
          disabled={save.isPending}
          onPress={() => setSourceOpen(true)}
        />
        <Text style={styles.muted}>
          Fotos JPG, PNG e WebP até 10 MB. PDF, DOCX, XLSX e PPTX até 20 MB. Vídeos MP4, MOV e WebM
          até 100 MB; prefira MP4 para assistir em qualquer dispositivo.
        </Text>
      </View>
      <View style={styles.row}>
        <Button
          title={tutorial ? 'Salvar tutorial' : 'Publicar tutorial'}
          icon="send"
          busy={save.isPending}
          disabled={pick.isPending || (!!tutorial && !dirty)}
          onPress={() => save.mutate()}
        />
        <Button
          title="Cancelar"
          secondary
          disabled={busy}
          onPress={() => requestNavigation(onCancel)}
        />
      </View>
      {save.isPending && (
        <Text accessibilityLiveRegion="polite" style={styles.muted}>
          Enviando o material… Mantenha esta tela aberta até concluir.
        </Text>
      )}
    </Card>
  );
}
