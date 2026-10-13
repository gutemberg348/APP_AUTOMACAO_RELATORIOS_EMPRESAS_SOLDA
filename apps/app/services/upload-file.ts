import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import type { DocumentPickerAsset } from 'expo-document-picker';

// Expo SDK 57's fetch serializes Blob/bytes(), not RN's legacy { uri, name, type } parts.
export async function appendUploadFile(
  form: FormData,
  asset: DocumentPickerAsset,
  maxBytes: number,
) {
  if (asset.size && asset.size > maxBytes) throw new Error('O arquivo excede o tamanho permitido.');
  if (Platform.OS === 'web') {
    const file = asset.file ?? (await (await fetch(asset.uri)).blob());
    if (!file.size) throw new Error('O arquivo está vazio. Selecione a imagem novamente.');
    if (file.size > maxBytes) throw new Error('O arquivo excede o tamanho permitido.');
    form.append('file', file, asset.name);
    return;
  }
  try {
    const file = new File(asset.uri);
    if (!file.exists || !file.size) throw new Error('FILE_UNAVAILABLE');
    if (file.size > maxBytes) throw new Error('FILE_TOO_LARGE');
    // Preserve the selected filename/MIME while delegating binary reads to the native File.
    const part: Blob & { name: string } = {
      name: asset.name,
      type: asset.mimeType || file.type || 'application/octet-stream',
      size: file.size,
      arrayBuffer: () => file.arrayBuffer(),
      bytes: () => file.bytes(),
      text: () => file.text(),
      slice: (start, end, type) => file.slice(start, end, type),
      stream: () => file.stream(),
    };
    form.append('file', part);
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'FILE_TOO_LARGE')
      throw new Error('O arquivo excede o tamanho permitido.');
    throw new Error(
      'Não foi possível abrir o arquivo da foto. Cancele essa foto e escolha novamente na galeria ou nos arquivos.',
    );
  }
}
