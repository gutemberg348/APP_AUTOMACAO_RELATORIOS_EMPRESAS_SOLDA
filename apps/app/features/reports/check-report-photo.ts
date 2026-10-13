import type { DocumentPickerAsset } from 'expo-document-picker';
import { api } from '../../services/api';
import { appendUploadFile } from '../../services/upload-file';
import { useReportPhotoDrafts } from './report-photo-drafts';

// Validate before adding the image, including photos saved in other reports.
export async function checkReportPhoto(
  asset: DocumentPickerAsset,
  draftKey: string,
  onProgress?: (message: string) => void,
) {
  onProgress?.('Preparando imagem…');
  const form = new FormData();
  await appendUploadFile(form, asset, 10 * 1024 * 1024);
  onProgress?.('Enviando imagem para verificação…');
  const { sha256 } = await api<{ sha256: string }>('/reports/media/check', {
    method: 'POST',
    body: form,
  });
  const userPrefix = draftKey.slice(0, draftKey.indexOf(':') + 1);
  onProgress?.('Conferindo se a foto é repetida…');
  const repeated = Object.entries(useReportPhotoDrafts.getState().reports).some(
    ([key, draft]) =>
      key.startsWith(userPrefix) && draft.photos.some((photo) => photo.sha256 === sha256),
  );
  if (repeated)
    throw new Error(
      'Esta imagem já foi selecionada. Não é permitido repetir a mesma foto, mesmo em outro ponto. Escolha outra imagem.',
    );
  return sha256;
}
