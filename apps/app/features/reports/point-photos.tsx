import { useState } from 'react';
import { Image, Text, View, Pressable } from 'react-native';
import type { ReportMedia } from '@weldcosta/shared';
import { drawingId } from '@weldcosta/shared';
import { MediaSourcePicker } from '../../components/media-source-picker';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { Button, Field, Notice } from '../../components/ui';
import { Icon } from '../../components/icon';
import { useTheme } from '../../utils/theme';
import { MediaImage } from './report-media';
import { useReportPhotoDrafts, emptyPhotoDrafts } from './report-photo-drafts';
import { checkReportPhoto } from './check-report-photo';

export function PointPhotos({
  draftKey,
  pointId,
  number,
  reportId,
  media,
  editable,
  canRemove,
  onPickingChange,
  additional = false,
}: {
  draftKey: string;
  pointId: string | null;
  number?: string;
  reportId?: string;
  media: ReportMedia[];
  editable: boolean;
  canRemove: boolean;
  onPickingChange(busy: boolean): void;
  additional?: boolean;
}) {
  const { tokens: t, styles } = useTheme();
  const [sourceOpen, setSourceOpen] = useState(false);
  const [removing, setRemoving] = useState<ReportMedia>();
  const [error, setError] = useState<unknown>();
  const draft = useReportPhotoDrafts((state) => state.reports[draftKey] ?? emptyPhotoDrafts);
  const update = (
    change: Parameters<ReturnType<typeof useReportPhotoDrafts.getState>['update']>[1],
  ) => useReportPhotoDrafts.getState().update(draftKey, change);
  const pending = draft.photos.filter((photo) => photo.pointKey === pointId);
  const existing = media.filter(
    (photo) => photo.reportPointId === pointId && !draft.removedIds.includes(photo.id),
  );
  const closeSource = () => {
    setSourceOpen(false);
    onPickingChange(false);
  };
  const count = existing.length + pending.length;
  const openSource = () => {
    setError(undefined);
    setSourceOpen(true);
    onPickingChange(true);
  };
  return (
    <View style={{ gap: 12 }}>
      {!additional && <Text style={styles.label}>Fotos do ponto {number}</Text>}
      {!additional && (
        <Text style={[styles.muted, { fontSize: 12 }]}>
          {count}/2 fotos sugeridas · Duas imagens por linha no PDF. Você pode finalizar mesmo sem
          fotos.
        </Text>
      )}
      <Notice error={error} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {existing.map((photo, index) => (
          <View key={photo.id} style={{ flexBasis: '46%', flexGrow: 1, minWidth: 0 }}>
            <View style={{ gap: 8 }}>
              <Text style={styles.label}>Foto {index + 1}</Text>
              <MediaImage reportId={reportId!} item={photo} height={140} />
              {photo.sectionKey === 'drawing' && (
                <Text style={styles.muted}>Croqui anexado como imagem</Text>
              )}
              {editable ? (
                <Field
                  label="Legenda da foto"
                  value={draft.captionEdits?.[photo.id] ?? photo.caption ?? ''}
                  maxLength={2000}
                  onChangeText={(caption) =>
                    update((draft) => {
                      const captionEdits = { ...draft.captionEdits };
                      if (caption === (photo.caption ?? '')) delete captionEdits[photo.id];
                      else captionEdits[photo.id] = caption;
                      return { ...draft, captionEdits };
                    })
                  }
                />
              ) : (
                <Text style={styles.muted}>{photo.caption || photo.originalName}</Text>
              )}
              {canRemove && (
                <Button
                  title="Remover foto"
                  small
                  variant="ghost"
                  icon="trash"
                  onPress={() => setRemoving(photo)}
                />
              )}
            </View>
          </View>
        ))}
        {pending.map((photo, index) => (
          <View key={photo.id} style={{ flexBasis: '46%', flexGrow: 1, minWidth: 0 }}>
            <View
              style={{
                gap: 8,
                padding: 10,
                backgroundColor: t.colors.surface,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: t.colors.line,
              }}
            >
              <Text style={styles.label}>Foto {existing.length + index + 1}</Text>
              <Image
                source={{ uri: photo.asset.uri }}
                accessibilityLabel={
                  additional ? 'Foto adicional pendente' : 'Foto pendente do ponto ' + number
                }
                resizeMode="contain"
                style={{ width: '100%', height: 140 }}
              />
              <Text style={styles.muted}>Será enviada ao salvar · {photo.asset.name}</Text>
              <Field
                label="Legenda da foto (opcional)"
                value={photo.caption}
                editable={editable}
                maxLength={2000}
                onChangeText={(caption) =>
                  update((draft) => ({
                    ...draft,
                    photos: draft.photos.map((item) =>
                      item.id === photo.id ? { ...item, caption } : item,
                    ),
                  }))
                }
              />
              {editable && (
                <Button
                  title="Cancelar esta foto"
                  small
                  variant="ghost"
                  icon="close"
                  onPress={() =>
                    update((draft) => ({
                      ...draft,
                      photos: draft.photos.filter((item) => item.id !== photo.id),
                    }))
                  }
                />
              )}
            </View>
          </View>
        ))}
        {!additional &&
          Array.from({ length: Math.max(0, 2 - count) }, (_, index) => (
            <Pressable
              key={'empty-' + index}
              accessibilityRole="button"
              accessibilityLabel={'Adicionar foto ' + (count + index + 1) + ' ao ponto ' + number}
              accessibilityState={{ disabled: !editable }}
              disabled={!editable}
              onPress={openSource}
              style={{
                flexBasis: '46%',
                flexGrow: 1,
                minWidth: 0,
                minHeight: 165,
                padding: 10,
                gap: 10,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: t.colors.blue,
                borderRadius: 12,
                backgroundColor: t.colors.surface,
              }}
            >
              <Icon name="camera" size={28} color={t.colors.blue} />
              <Text style={[styles.label, { textAlign: 'center' }]}>Foto {count + index + 1}</Text>
              <Text style={[styles.muted, { textAlign: 'center', fontSize: 12 }]}>
                {editable ? 'Toque para adicionar' : 'Não adicionada'}
              </Text>
            </Pressable>
          ))}
      </View>
      {!existing.length && !pending.length && (
        <Text style={styles.muted}>
          {additional
            ? 'Opcional. Adicione imagens gerais da obra ou detalhes complementares. As fotos das soldas ficam dentro de cada ponto.'
            : 'Adicione as fotos deste ponto aqui. O vínculo acompanha o número do ponto.'}
        </Text>
      )}
      {editable && (additional || count >= 2) && (
        <View style={styles.row}>
          <Button
            title={additional ? 'Adicionar foto adicional' : 'Adicionar outra foto'}
            small
            secondary
            icon="camera"
            onPress={openSource}
          />
        </View>
      )}
      <MediaSourcePicker
        visible={sourceOpen}
        onClose={closeSource}
        onSelect={async (asset, onProgress) => {
          if (asset.size && asset.size > 10 * 1024 * 1024) {
            throw new Error('Use uma imagem de até 10 MB.');
          }
          const sha256 = await checkReportPhoto(asset, draftKey, onProgress);
          update((draft) => ({
            ...draft,
            error: undefined,
            photos: [
              ...draft.photos,
              { id: drawingId(), pointKey: pointId, asset, caption: '', sha256 },
            ],
          }));
        }}
      />
      {additional &&
        (pending.length > 0 ||
          media.some(
            (photo) =>
              !photo.reportPointId &&
              (draft.captionEdits?.[photo.id] !== undefined || draft.removedIds.includes(photo.id)),
          )) && (
          <Text style={[styles.muted, { fontSize: 11 }]}>
            As imagens e legendas serão atualizadas ao salvar o relatório.
          </Text>
        )}
      <ConfirmDialog
        visible={!!removing}
        title="Remover a foto deste ponto?"
        description="A foto será removida quando você salvar. Os resultados do ponto serão preservados."
        confirmLabel="Marcar para remover"
        danger
        onClose={() => setRemoving(undefined)}
        onConfirm={() => {
          update((draft) => ({ ...draft, removedIds: [...draft.removedIds, removing!.id] }));
          setRemoving(undefined);
        }}
      />
    </View>
  );
}
