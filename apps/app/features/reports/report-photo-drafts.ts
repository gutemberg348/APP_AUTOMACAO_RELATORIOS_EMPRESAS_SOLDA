import { create } from 'zustand';
import type { DocumentPickerAsset } from 'expo-document-picker';
import type { Report, ReportPoint } from '@weldcosta/shared';
import { pointKey } from '@weldcosta/shared';
import { api, jsonBody } from '../../services/api';
import { appendUploadFile } from '../../services/upload-file';
import type { TransferState } from '../../components/transfer-progress';

export interface ReportPhotoDraft {
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
  const progress = (message: string, detail?: string) =>
    onProgress?.({ message, detail, total, completed });
  try {
    const draft = useReportPhotoDrafts.getState().reports[nextKey]!;
    for (const id of draft.removedIds) {
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
    for (const [id, caption] of Object.entries(draft.captionEdits ?? {})) {
      progress('Salvando legendas das fotos…');
      const media = current.media?.find((item) => item.id === id);
      if (media)
        await api(
          '/reports/' + saved.id + '/media/' + id,
          jsonBody('PATCH', {
            version: current.version,
            caption,
            sectionKey: media.sectionKey ?? 'photos',
            reportPointId: media.reportPointId,
          }),
        );
      store.update(nextKey, (remaining) => {
        const captionEdits = { ...remaining.captionEdits };
        delete captionEdits[id];
        return { ...remaining, captionEdits };
      });
      if (media) current = await api<Report>('/reports/' + saved.id);
    }
    for (const photo of draft.photos) {
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
      form.append('sectionKey', 'photos');
      if (photo.pointKey) form.append('reportPointId', photo.pointKey);
      form.append('caption', photo.caption);
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
    if (total || draft.removedIds.length || Object.keys(draft.captionEdits ?? {}).length)
      progress('Concluindo o salvamento…');
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
      return {
        ...draft,
        error: pending
          ? new Error(
              'Os dados do relatório foram salvos. Há fotos ou legendas pendentes: ' +
                reason +
                ' Use Salvar rascunho para tentar novamente.',
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
