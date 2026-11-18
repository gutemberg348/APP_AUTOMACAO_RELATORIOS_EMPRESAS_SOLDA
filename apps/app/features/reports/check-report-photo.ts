import type { DocumentPickerAsset } from 'expo-document-picker';
import { api, ApiError } from '../../services/api';
import { localPhotoHash } from '../../services/offline-files';
import { useConnectivity } from '../../stores/connectivity';
import { appendUploadFile } from '../../services/upload-file';
import { useReportPhotoDrafts } from './report-photo-drafts';

export async function checkReportPhoto(
  asset: DocumentPickerAsset,
  draftKey: string,
  target: {
    reportId?: string;
    persistedPointId?: string;
    projectId?: string;
  },
  onProgress?: (message: string) => void,
) {
  onProgress?.('Preparando imagem…');
  const form = new FormData();
  await appendUploadFile(form, asset, 10 * 1024 * 1024);
  if (target.reportId) form.append('reportId', target.reportId);
  if (target.projectId) form.append('projectId', target.projectId);
  if (target.reportId && target.persistedPointId)
    form.append('reportPointId', target.persistedPointId);
  form.append('warnOnSamePoint', 'true');
  onProgress?.('Enviando imagem para verificação…');
  let checked: { sha256: string; projectId?: string };
  let serverDuplicate = false;
  try {
    if (!useConnectivity.getState().online) throw new ApiError(0, 'NETWORK_ERROR', 'Sem internet');
    checked = await api<{ sha256: string; projectId?: string }>('/reports/media/check', {
      method: 'POST',
      body: form,
      accountId: draftKey.slice(0, draftKey.indexOf(':')),
    });
  } catch (cause) {
    if (!(cause instanceof ApiError)) throw cause;
    if (cause.code === 'DUPLICATE_MEDIA') {
      serverDuplicate = true;
      const hash = (cause.details as { sha256?: unknown } | undefined)?.sha256;
      checked = { sha256: typeof hash === 'string' ? hash : await localPhotoHash(asset) };
    } else if (cause.code === 'NETWORK_ERROR') {
      onProgress?.(
        'Conferindo a foto no telefone. A verificação da obra será concluída ao sincronizar.',
      );
      checked = { sha256: await localPhotoHash(asset), projectId: target.projectId };
    } else throw cause;
  }
  const { sha256, projectId: checkedProjectId } = checked;
  const userPrefix = draftKey.slice(0, draftKey.indexOf(':') + 1);
  const projectId = checkedProjectId ?? target.projectId;
  onProgress?.('Conferindo se a foto é repetida…');
  const repeated = Object.entries(useReportPhotoDrafts.getState().reports).some(
    ([key, draft]) =>
      key.startsWith(userPrefix) &&
      (key === draftKey || (!!projectId && draft.projectId === projectId)) &&
      draft.photos.some((photo) => photo.sha256 === sha256),
  );
  return { sha256, duplicate: serverDuplicate || repeated };
}
