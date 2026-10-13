import { useState } from 'react';
import { Platform, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { PickerSheet } from './picker-sheet';
import { Button, Notice } from './ui';
import { tutorialFileTypes } from '@weldcosta/shared';
import { TransferProgress } from './transfer-progress';

export function MediaSourcePicker({
  visible,
  onClose,
  onSelect,
  includeDocuments = false,
}: {
  visible: boolean;
  onClose(): void;
  onSelect(
    asset: DocumentPicker.DocumentPickerAsset,
    onProgress: (message: string) => void,
  ): void | Promise<void>;
  includeDocuments?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [message, setMessage] = useState('Preparando imagem…');
  const [fileName, setFileName] = useState('');
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
      let asset: DocumentPicker.DocumentPickerAsset;
      if (source === 'files') {
        const result = await DocumentPicker.getDocumentAsync({
          type: includeDocuments
            ? [...new Set(Object.values(tutorialFileTypes))]
            : ['image/jpeg', 'image/png', 'image/webp'],
          copyToCacheDirectory: true,
          multiple: false,
        });
        if (result.canceled) return;
        asset = result.assets[0]!;
        setFileName(asset.name);
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
          allowsMultipleSelection: false,
        };
        const result = await (source === 'camera'
          ? ImagePicker.launchCameraAsync(options)
          : ImagePicker.launchImageLibraryAsync(options));
        if (result.canceled) return;
        const picked = result.assets[0]!;
        setMessage('Preparando imagem…');
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
          const converted = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
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
            size: file?.size ?? (Platform.OS !== 'web' ? new File(converted.uri).size : undefined),
          };
        }
      }
      setMessage('Conferindo arquivo…');
      setFileName(asset.name);
      await onSelect(asset, setMessage);
      onClose();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };
  return (
    <PickerSheet
      visible={visible}
      title="De onde vem o material?"
      subtitle="Escolha a origem. Você poderá conferir o arquivo antes de enviar."
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
        {busy && <TransferProgress message={message} detail={fileName || 'Aguarde um instante.'} />}
        {!busy && (
          <>
            <Button
              title={includeDocuments ? 'Galeria de fotos e vídeos' : 'Galeria de fotos'}
              icon="image"
              disabled={busy}
              onPress={() => void choose('gallery')}
            />
            <Button
              title="Tirar foto"
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
              title="Cancelar"
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
