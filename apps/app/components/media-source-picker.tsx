import { useEffect, useState } from 'react';
import { Image, Platform, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { PickerSheet } from './picker-sheet';
import { Button, Notice } from './ui';
import { tutorialFileTypes } from '@weldcosta/shared';
import { TransferProgress } from './transfer-progress';
import { useTheme } from '../utils/theme';

export function MediaSourcePicker({
  visible,
  onClose,
  onSelect,
  includeDocuments = false,
  maxSelections = 1,
  contextLabel,
}: {
  visible: boolean;
  onClose(): void;
  onSelect(
    asset: DocumentPicker.DocumentPickerAsset,
    onProgress: (message: string) => void,
  ): void | Promise<void>;
  includeDocuments?: boolean;
  maxSelections?: number;
  contextLabel?: string;
}) {
  const { styles } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [message, setMessage] = useState('Preparando imagem…');
  const [fileName, setFileName] = useState('');
  const [added, setAdded] = useState<{ uri: string; name: string }[]>([]);
  useEffect(() => {
    if (visible) {
      setAdded([]);
      setError(undefined);
    }
  }, [visible]);
  const choose = async (source: 'gallery' | 'camera' | 'files') => {
    setError(undefined);
    setBusy(true);
    setFileName('');
    setMessage(
      source === 'camera'
        ? 'Abrindo câmera…'
        : source === 'gallery'
          ? 'Abrindo galeria…'
          : 'Abrindo arquivos…',
    );
    try {
      let assets: (DocumentPicker.DocumentPickerAsset | ImagePicker.ImagePickerAsset)[];
      const limit = Math.max(1, Math.floor(maxSelections));
      if (source === 'files') {
        const result = await DocumentPicker.getDocumentAsync({
          type: includeDocuments
            ? [...new Set(Object.values(tutorialFileTypes))]
            : ['image/jpeg', 'image/png', 'image/webp'],
          copyToCacheDirectory: true,
          multiple: limit > 1,
        });
        if (result.canceled) return;
        assets = result.assets;
      } else {
        if (source === 'camera' && Platform.OS !== 'web') {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted)
            throw new Error(
              'Permita o uso da câmera nas configurações do dispositivo ou escolha uma foto da galeria.',
            );
        }
        const options: ImagePicker.ImagePickerOptions = {
          mediaTypes: source === 'gallery' && includeDocuments ? ['images', 'videos'] : ['images'],
          quality: 1,
          allowsEditing: false,
          allowsMultipleSelection: source === 'gallery' && limit > 1,
          selectionLimit: limit,
          orderedSelection: true,
        };
        const result = await (source === 'camera'
          ? ImagePicker.launchCameraAsync(options)
          : ImagePicker.launchImageLibraryAsync(options));
        if (result.canceled) return;
        assets = result.assets;
      }
      if (assets.length > limit)
        throw new Error(
          'Selecione até ' + limit + ' fotos por vez. Nenhuma foto deste lote foi adicionada.',
        );
      const failures: string[] = [];
      let completed = 0;
      for (let index = 0; index < assets.length; index++) {
        const progress = (text: string) =>
          setMessage(
            assets.length > 1
              ? 'Foto ' + (index + 1) + ' de ' + assets.length + ' · ' + text
              : text,
          );
        const selected = assets[index]!;
        let asset: DocumentPicker.DocumentPickerAsset;
        try {
          if (source === 'files') asset = selected as DocumentPicker.DocumentPickerAsset;
          else {
            const picked = selected as ImagePicker.ImagePickerAsset;
            progress('Preparando imagem…');
            setFileName(picked.fileName ?? 'Foto selecionada');
            const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[
              picked.mimeType ?? ''
            ];
            asset = {
              lastModified: Date.now(),
              uri: picked.uri,
              name: extension
                ? (picked.fileName?.replace(/\.[^.]+$/, '') || 'foto') + '.' + extension
                : (picked.fileName ?? (picked.type === 'video' ? 'video.mp4' : 'foto.jpg')),
              mimeType: picked.mimeType,
              size: picked.fileSize,
              file: picked.file,
            };
            // iPhone photos may be HEIC; convert to a format accepted by reports and tutorials.
            if (
              picked.type !== 'video' &&
              !['image/jpeg', 'image/png', 'image/webp'].includes(picked.mimeType ?? '')
            ) {
              const context = ImageManipulator.manipulate(picked.uri);
              const rendered = await context.renderAsync();
              const converted = await rendered.saveAsync({
                format: SaveFormat.JPEG,
                compress: 0.92,
              });
              context.release();
              rendered.release();
              const file =
                Platform.OS === 'web'
                  ? new globalThis.File([await (await fetch(converted.uri)).blob()], 'foto.jpg', {
                      type: 'image/jpeg',
                    })
                  : undefined;
              asset = {
                lastModified: Date.now(),
                uri: converted.uri,
                name: 'foto.jpg',
                mimeType: 'image/jpeg',
                file,
                size:
                  file?.size ?? (Platform.OS !== 'web' ? new File(converted.uri).size : undefined),
              };
            }
          }
          progress('Conferindo arquivo…');
          setFileName(asset.name);
          await onSelect(asset, progress);
          completed++;
          if (!includeDocuments)
            setAdded((previous) => [...previous, { uri: asset.uri, name: asset.name }]);
        } catch (cause) {
          const name =
            'name' in selected ? selected.name : selected.fileName || 'Foto ' + (index + 1);
          failures.push(
            name +
              ': ' +
              (cause instanceof Error
                ? cause.message
                : 'Não foi possível adicionar. Tente novamente.'),
          );
        }
      }
      if (failures.length)
        throw new Error(
          (completed
            ? completed + ' foto(s) adicionada(s). Escolha novamente apenas as que falharam. '
            : '') + failures.join(' '),
        );
      // Keep the camera flow open for the second photo, without another trip through the point.
      if (source !== 'camera' || limit <= 1 || includeDocuments) onClose();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };
  return (
    <PickerSheet
      visible={visible}
      title={contextLabel ?? 'De onde vem o material?'}
      subtitle={
        maxSelections > 1
          ? 'Selecione até ' +
            maxSelections +
            ' fotos de uma vez. Elas entram neste ponto na ordem escolhida.'
          : 'Escolha a origem. Você poderá conferir o arquivo antes de enviar.'
      }
      icon="image"
      onClose={() => {
        if (!busy) {
          setError(undefined);
          onClose();
        }
      }}
    >
      <View style={{ padding: 22, gap: 12 }}>
        <Notice error={error} />
        {!busy && added.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text accessibilityLiveRegion="polite" style={styles.label}>
              {added.length} foto(s) adicionada(s) nesta seleção. Serão enviadas ao salvar o ponto.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {added.map((photo, index) => (
                <Image
                  key={index}
                  source={{ uri: photo.uri }}
                  accessibilityLabel={'Foto adicionada: ' + photo.name}
                  resizeMode="contain"
                  style={{ width: 72, height: 72 }}
                />
              ))}
            </View>
            {!error && (
              <Text style={styles.muted}>
                Agora tire a segunda foto ou escolha na galeria. Você também pode concluir com uma
                só.
              </Text>
            )}
          </View>
        )}
        {busy && <TransferProgress message={message} detail={fileName || 'Aguarde um instante.'} />}
        {!busy && (
          <>
            <Button
              title={
                includeDocuments
                  ? 'Galeria de fotos e vídeos'
                  : maxSelections > 1
                    ? 'Galeria · selecionar as duas fotos'
                    : 'Galeria de fotos'
              }
              icon="image"
              disabled={busy}
              onPress={() => void choose('gallery')}
            />
            <Button
              title={added.length ? 'Tirar próxima foto' : 'Tirar foto'}
              icon="camera"
              secondary
              disabled={busy}
              onPress={() => void choose('camera')}
            />
            <Button
              title="Escolher nos arquivos"
              icon="folder"
              secondary
              disabled={busy}
              onPress={() => void choose('files')}
            />
            <Button
              title={added.length ? 'Concluir seleção' : 'Cancelar'}
              variant="ghost"
              disabled={busy}
              onPress={() => {
                setError(undefined);
                onClose();
              }}
            />
          </>
        )}
      </View>
    </PickerSheet>
  );
}
