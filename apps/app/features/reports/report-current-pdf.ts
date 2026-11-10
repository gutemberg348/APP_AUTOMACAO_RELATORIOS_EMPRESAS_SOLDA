import { api } from '../../services/api';
import { appendUploadFile } from '../../services/upload-file';
import { localSignature } from '../people/offline-signatures';
import { emptyPhotoDrafts, useReportPhotoDrafts } from './report-photo-drafts';
import { cleanReportDraft } from './report-draft-clean';
import type { ReportFormValues } from './report-collections';

export interface CurrentPdf {
  token: string;
  warnings: string[];
}
export interface CurrentPdfOptions {
  signal?: AbortSignal;
  onProgress?(message: string): void;
}
export async function prepareCurrentReportPdf(
  reportId: string,
  values: ReportFormValues,
  photoKey: string,
  options: CurrentPdfOptions = {},
): Promise<CurrentPdf> {
  // Capture this exact filling/queue before any asynchronous file preparation.
  const snapshot = JSON.parse(JSON.stringify(values)) as ReportFormValues;
  const queued = useReportPhotoDrafts.getState().reports[photoKey] ?? emptyPhotoDrafts;
  const photos = [...queued.photos];
  const form = new FormData();
  const warnings: string[] = [];
  const inputs: {
    id: string;
    pointKey: string | null;
    pointNumber?: string;
    name: string;
    sectionKey: 'photos' | 'drawing';
    caption: string;
    annotations?: unknown;
    fileIndex: number | null;
  }[] = [];
  const localSignatures: { id: string; fileIndex?: number; strokes?: unknown }[] = [];
  let fileIndex = 0;
  for (const [index, photo] of photos.entries()) {
    if (options.signal?.aborted)
      throw new Error('Download cancelado. Seu preenchimento continua no telefone.');
    options.onProgress?.(`Preparando foto ${index + 1} de ${photos.length}: ${photo.asset.name}`);
    const input = {
      id: photo.id,
      pointKey: photo.pointKey,
      pointNumber:
        photo.pointNumber ??
        snapshot.points.find((p) => (p.id ?? p.clientId) === photo.pointKey)?.number,
      name: photo.asset.name.slice(0, 500),
      sectionKey: photo.sectionKey ?? 'photos',
      caption: photo.caption,
      annotations: photo.annotations,
      fileIndex: null,
    } as (typeof inputs)[number];
    try {
      await appendUploadFile(form, photo.asset, 10 * 1024 * 1024, 'files');
      input.fileIndex = fileIndex++;
    } catch (cause) {
      warnings.push(
        `Foto “${photo.asset.name}”${input.pointNumber ? ' · Ponto ' + input.pointNumber : ''}: ${cause instanceof Error ? cause.message : 'arquivo indisponível'} Somente esta foto ficará fora do PDF. Selecione-a novamente em Fotos.`,
      );
    }
    inputs.push(input);
  }
  for (const signer of snapshot.signatures) {
    if (!signer.signatureAssetId || signer.role === 'CLIENT') continue;
    try {
      const local = await localSignature(signer.signatureAssetId);
      if (!local) continue;
      if (local.remoteId) {
        signer.signatureAssetId = local.remoteId;
        continue;
      }
      if (local.strokes)
        localSignatures.push({ id: signer.signatureAssetId, strokes: local.strokes });
      else if (local.asset) {
        await appendUploadFile(form, local.asset, 5 * 1024 * 1024, 'files');
        localSignatures.push({ id: signer.signatureAssetId, fileIndex: fileIndex++ });
      }
    } catch {
      warnings.push(
        `Responsável ${signer.name || signer.role}: não foi possível abrir a assinatura no telefone. Se ela não estiver no servidor, a linha ficará vazia; o nome será incluído.`,
      );
    }
  }
  options.onProgress?.('Enviando o preenchimento atual e as fotos para gerar o PDF…');
  form.append(
    'data',
    JSON.stringify({
      values: {
        ...snapshot,
        specificData: cleanReportDraft(snapshot.specificData, ['specificData']),
      },
      photos: inputs,
      removedIds: queued.removedIds,
      captionEdits: queued.captionEdits ?? {},
      annotationEdits: queued.annotationEdits ?? {},
      localSignatures,
      warnings,
    }),
  );
  return api<CurrentPdf>('/reports/' + reportId + '/pdf/as-is/prepare', {
    accountId: photoKey.slice(0, photoKey.indexOf(':')),
    method: 'POST',
    body: form,
    signal: options.signal,
  });
}
