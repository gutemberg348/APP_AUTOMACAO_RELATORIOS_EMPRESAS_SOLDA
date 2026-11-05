import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { useAuth } from '../stores/auth';
import { apiUrl } from './api';
import { offlineScope } from './offline-cache';
import { offlineDirectory, offlineDisk } from './offline-disk';

export type LocalAsset = DocumentPickerAsset & { offlineFileId?: string };
export function currentOfflineScope() {
  const user = useAuth.getState().session?.user;
  if (!user) throw new Error('Entre na sua conta para guardar os arquivos neste telefone.');
  return offlineScope(apiUrl, user.id);
}
export async function keepReportAsset(asset: DocumentPickerAsset, id: string): Promise<LocalAsset> {
  const scope = currentOfflineScope();
  const extension = /\.(jpe?g|png|webp)$/i.exec(asset.name)?.[0].toLowerCase() || '.jpg';
  const offlineFileId = 'photo-' + id + extension;
  if (Platform.OS === 'web') {
    const blob = asset.file ?? (await (await fetch(asset.uri)).blob());
    if (!blob.size || blob.size > 10 * 1024 * 1024)
      throw new Error('Escolha uma imagem válida de até 10 MB.');
    await offlineDisk.putBlob(scope, offlineFileId, blob);
    return { ...asset, offlineFileId };
  }
  const source = new File(asset.uri);
  if (!source.exists || !source.size || source.size > 10 * 1024 * 1024)
    throw new Error('Escolha uma imagem válida de até 10 MB.');
  const target = new File(offlineDirectory(scope), offlineFileId);
  await source.copy(target);
  if (!target.exists || target.size !== source.size)
    throw new Error('Não foi possível guardar a foto. Confira o espaço do telefone.');
  return { ...asset, uri: target.uri, file: undefined, offlineFileId };
}
export async function restoreReportAsset(scope: string, asset: LocalAsset): Promise<LocalAsset> {
  if (!asset.offlineFileId) return asset;
  if (Platform.OS !== 'web')
    return { ...asset, uri: new File(offlineDirectory(scope), asset.offlineFileId).uri };
  const blob = await offlineDisk.getBlob(scope, asset.offlineFileId);
  if (!blob)
    throw new Error(
      'Uma foto salva neste dispositivo não está disponível. Abra o rascunho para escolher essa foto novamente.',
    );
  return {
    ...asset,
    uri: URL.createObjectURL(blob),
    file: new globalThis.File([blob], asset.name, { type: asset.mimeType }),
  };
}
export async function localPhotoHash(asset: DocumentPickerAsset) {
  if (Platform.OS !== 'web') return new File(asset.uri).digest('SHA-256');
  const bytes = await (asset.file ?? (await (await fetch(asset.uri)).blob())).arrayBuffer();
  const hash = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
