import type { DocumentPickerAsset } from 'expo-document-picker';
import { api } from '../../services/api';
import { appendUploadFile } from '../../services/upload-file';
import { useReportPhotoDrafts } from './report-photo-drafts';

// Same-point reuse is allowed; the report and point together identify that exception.
export async function checkReportPhoto(
  asset: DocumentPickerAsset,
  draftKey: string,
  target: { pointId: string | null; reportId?: string; persistedPointId?: string },
  onProgress?: (message: string) => void,
) {
  onProgress?.('Preparando imagem…');
  const form = new FormData();
  await appendUploadFile(form, asset, 10 * 1024 * 1024);
  if (target.reportId) form.append('reportId', target.reportId);
  if (target.reportId && target.persistedPointId)
    form.append('reportPointId', target.persistedPointId);
  onProgress?.('Enviando imagem para verificação…');
  const { sha256 } = await api<{ sha256: string }>('/reports/media/check', {
    method: 'POST',
    body: form,
  });
  const userPrefix = draftKey.slice(0, draftKey.indexOf(':') + 1);
  onProgress?.('Conferindo se a foto é repetida…');
  const repeated = Object.entries(useReportPhotoDrafts.getState().reports).some(
    ([key, draft]) =>
      key.startsWith(userPrefix) &&
      draft.photos.some(
        (photo) =>
          photo.sha256 === sha256 &&
          !(key === draftKey && target.pointId && photo.pointKey === target.pointId),
      ),
  );
  if (repeated)
    throw new Error(
      'Esta imagem já foi selecionada em outro ponto ou relatório. Você pode repetir ao lado no mesmo ponto. Para este ponto, escolha outra foto.',
    );
  return sha256;
}
