import { ReportPhotoSaveError } from './report-photo-error';
import { create } from 'zustand';
import type { DocumentPickerAsset } from 'expo-document-picker';
import type { Report, ReportPoint, PhotoAnnotations } from '@weldcosta/shared';
import { pointKey } from '@weldcosta/shared';
import { api, jsonBody } from '../../services/api';
import { appendUploadFile } from '../../services/upload-file';
import type { TransferState } from '../../components/transfer-progress';

export interface ReportPhotoDraft {
  annotations?: PhotoAnnotations;
  sectionKey?: 'photos' | 'drawing';
  id: string;
  pointKey: string | null;
  asset: DocumentPickerAsset;
  caption: string;
  sha256?: string;
}
export interface PhotoDrafts {
  photos: ReportPhotoDraft[];
  removedIds: string[];
  captionEdits?: Record<string, string>;
  annotationEdits?: Record<string, PhotoAnnotations | null>;
  error?: unknown;
}
export const emptyPhotoDrafts: PhotoDrafts = { photos: [], removedIds: [] };
export const useReportPhotoDrafts = create<{
  reports: Record<string, PhotoDrafts>;
  update(key: string, change: (draft: PhotoDrafts) => PhotoDrafts): void;
  move(from: string, to: string, pointIds: Map<string, string>): void;
}>((set) => ({
  reports: {},
  update: (key, change) =>
    set((state) => ({
      reports: { ...state.reports, [key]: change(state.reports[key] ?? emptyPhotoDrafts) },
    })),
  move: (from, to, pointIds) =>
    set((state) => {
      const draft = state.reports[from] ?? emptyPhotoDrafts;
      const reports = { ...state.reports };
      delete reports[from];
      reports[to] = {
        ...draft,
        photos: draft.photos.map((photo) => ({
          ...photo,
          pointKey: photo.pointKey ? (pointIds.get(photo.pointKey) ?? photo.pointKey) : null,
        })),
      };
      return { reports };
    }),
}));

// Store drafts across the creation -> edit route so a failed upload remains retryable.
export async function saveReportPhotos(
  key: string,
  saved: Report,
  inputPoints: ReportPoint[],
  onProgress?: (progress: TransferState) => void,
) {
  const ids = new Map(
    inputPoints.flatMap((point) => {
      const persisted = point.id
        ? saved.points?.find((p) => p.id === point.id)
        : saved.points?.find((p) => p.number === point.number);
      return persisted?.id ? [[pointKey(point), persisted.id] as const] : [];
    }),
  );
  const nextKey = key.slice(0, key.indexOf(':') + 1) + saved.id;
  const store = useReportPhotoDrafts.getState();
  store.move(key, nextKey, ids);
  store.update(nextKey, (draft) => ({ ...draft, error: undefined }));
  let current = saved;
  const initial = useReportPhotoDrafts.getState().reports[nextKey]!;
  const total = initial.photos.length;
  let completed = 0;
  let location: { pointNumber?: string; drawing?: boolean; label: string } = {
    label: 'Fotos do relatório',
  };
  const locateMedia = (id: string, action: string) => {
    const media = current.media?.find((item) => item.id === id);
    const number = current.points?.find((point) => point.id === media?.reportPointId)?.number;
    location = {
      pointNumber: number,
      drawing: media?.sectionKey === 'drawing',
      label:
        action +
        (number ? ' · Ponto ' + number : '') +
        (media?.originalName ? ' · ' + media.originalName : ''),
    };
  };
  const progress = (message: string, detail?: string) =>
    onProgress?.({ message, detail, total, completed });
  try {
    const draft = useReportPhotoDrafts.getState().reports[nextKey]!;
    for (const id of draft.removedIds) {
      locateMedia(id, 'Excluir foto');
      progress('Atualizando fotos do relatório…');
      await api(
        '/reports/' + saved.id + '/media/' + id,
        jsonBody('DELETE', { version: current.version }),
      );
      store.update(nextKey, (remaining) => ({
        ...remaining,
        removedIds: remaining.removedIds.filter((item) => item !== id),
      }));
      current = await api<Report>('/reports/' + saved.id);
    }
    const editedIds = new Set([
      ...Object.keys(draft.captionEdits ?? {}),
      ...Object.keys(draft.annotationEdits ?? {}),
    ]);
    for (const id of editedIds) {
      locateMedia(id, 'Legenda / marcações da foto');
      progress('Salvando legendas e marcações das fotos…');
      const media = current.media?.find((item) => item.id === id);
      const caption = draft.captionEdits?.[id] ?? media?.caption ?? '';
      if (media)
        await api(
          '/reports/' + saved.id + '/media/' + id,
          jsonBody('PATCH', {
            version: current.version,
            caption,
            sectionKey: media.sectionKey ?? 'photos',
            reportPointId: media.reportPointId,
            ...(draft.annotationEdits?.[id] !== undefined
              ? { annotations: draft.annotationEdits[id] }
              : {}),
          }),
        );
      store.update(nextKey, (remaining) => {
        const captionEdits = { ...remaining.captionEdits };
        delete captionEdits[id];
        const annotationEdits = { ...remaining.annotationEdits };
        delete annotationEdits[id];
        return { ...remaining, captionEdits, annotationEdits };
      });
      if (media) current = await api<Report>('/reports/' + saved.id);
    }
    for (const photo of draft.photos) {
      const pointNumber = current.points?.find((point) => point.id === photo.pointKey)?.number;
      location = {
        pointNumber,
        drawing: photo.sectionKey === 'drawing',
        label:
          'Enviar foto' + (pointNumber ? ' · Ponto ' + pointNumber : '') + ' · ' + photo.asset.name,
      };
      if (
        photo.sectionKey === 'drawing' &&
        !current.drawings?.some((d) =>
          d.data.elements.some((e) => e.type === 'image' && e.mediaKey === photo.id),
        )
      ) {
        store.update(nextKey, (remaining) => ({
          ...remaining,
          photos: remaining.photos.filter((item) => item.id !== photo.id),
        }));
        continue;
      }
      if (photo.pointKey && !current.points?.some((p) => p.id === photo.pointKey))
        throw new Error(
          'A foto não pôde ser vinculada ao ponto. Confira o cadastro e tente salvar novamente.',
        );
      const form = new FormData();
      const number = current.points?.find((point) => point.id === photo.pointKey)?.number;
      const detail = (number ? 'Ponto ' + number + ' · ' : '') + photo.asset.name;
      progress('Preparando foto ' + (completed + 1) + ' de ' + total + '…', detail);
      await appendUploadFile(form, photo.asset, 10 * 1024 * 1024);
      form.append('version', String(current.version));
      form.append('clientUploadId', photo.id);
      form.append('sectionKey', photo.sectionKey ?? 'photos');
      if (photo.pointKey) form.append('reportPointId', photo.pointKey);
      form.append('caption', photo.caption);
      if (photo.annotations) form.append('annotations', JSON.stringify(photo.annotations));
      progress('Enviando foto ' + (completed + 1) + ' de ' + total + '…', detail);
      await api('/reports/' + saved.id + '/media', { method: 'POST', body: form });
      completed++;
      store.update(nextKey, (remaining) => ({
        ...remaining,
        photos: remaining.photos.filter((item) => item.id !== photo.id),
      }));
      progress('Foto enviada. Atualizando relatório…', detail);
      current = await api<Report>('/reports/' + saved.id);
    }
    if (total || draft.removedIds.length || editedIds.size) progress('Concluindo o salvamento…');
  } catch (cause) {
    progress('Conferindo o envio e recuperando as fotos pendentes…');
    const reason = cause instanceof Error ? cause.message : 'Confira sua conexão.';
    const refreshed = await api<Report>('/reports/' + saved.id).catch(() => undefined);
    if (refreshed) current = refreshed;
    store.update(nextKey, (draft) => {
      const pending =
        draft.photos.length ||
        draft.removedIds.length ||
        Object.keys(draft.captionEdits ?? {}).length;
      const hasAnnotationEdits = Object.keys(draft.annotationEdits ?? {}).length;
      return {
        ...draft,
        error:
          pending || hasAnnotationEdits
            ? new ReportPhotoSaveError(
                location.label +
                  ': Os dados do relatório foram salvos. Há fotos, legendas ou marcações pendentes: ' +
                  reason +
                  ' Confira a foto e toque em Salvar para tentar novamente.',
                location,
              )
            : refreshed
              ? undefined
              : new Error(
                  'As alterações foram enviadas. Não foi possível atualizar a visualização; reabra o relatório.',
                ),
      };
    });
  }
  return current;
}
