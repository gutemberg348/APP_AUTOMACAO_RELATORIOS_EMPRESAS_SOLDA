import type { DocumentPickerAsset } from 'expo-document-picker';
import { api, ApiError } from '../../services/api';
import { localPhotoHash } from '../../services/offline-files';
import { useConnectivity } from '../../stores/connectivity';
import { appendUploadFile } from '../../services/upload-file';
import { useReportPhotoDrafts } from './report-photo-drafts';

// Same-point reuse is allowed; the report and point together identify that exception.
export async function checkReportPhoto(
  asset: DocumentPickerAsset,
  draftKey: string,
  target: {
    pointId: string | null;
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
  onProgress?.('Enviando imagem para verificação…');
  let checked: { sha256: string; projectId?: string };
  try {
    if (!useConnectivity.getState().online) throw new ApiError(0, 'NETWORK_ERROR', 'Sem internet');
    checked = await api<{ sha256: string; projectId?: string }>('/reports/media/check', {
      method: 'POST',
      body: form,
    });
  } catch (cause) {
    if (!(cause instanceof ApiError) || cause.code !== 'NETWORK_ERROR') throw cause;
    onProgress?.(
      'Conferindo a foto no telefone. A verificação da obra será concluída ao sincronizar.',
    );
    checked = { sha256: await localPhotoHash(asset), projectId: target.projectId };
  }
  const { sha256, projectId: checkedProjectId } = checked;
  const userPrefix = draftKey.slice(0, draftKey.indexOf(':') + 1);
  const projectId = checkedProjectId ?? target.projectId;
  onProgress?.('Conferindo se a foto é repetida…');
  const repeated = Object.entries(useReportPhotoDrafts.getState().reports).some(
    ([key, draft]) =>
      key.startsWith(userPrefix) &&
      (key === draftKey || (!!projectId && draft.projectId === projectId)) &&
      draft.photos.some(
        (photo) =>
          photo.sha256 === sha256 &&
          !(key === draftKey && target.pointId && photo.pointKey === target.pointId),
      ),
  );
  if (repeated)
    throw new Error(
      'Esta imagem já foi selecionada em outro ponto ou relatório desta obra. Você pode repetir ao lado no mesmo ponto ou usar em outra obra. Para este ponto, escolha outra foto.',
    );
  return sha256;
}
