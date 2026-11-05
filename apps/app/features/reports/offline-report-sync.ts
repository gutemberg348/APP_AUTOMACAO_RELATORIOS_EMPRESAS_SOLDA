import {
  reportCreateSchema,
  reportUpdateSchema,
  validateSpecificData,
  type Report,
} from '@weldcosta/shared';
import { randomUUID } from 'expo-crypto';
import { ZodError } from 'zod';
import { api, ApiError, jsonBody } from '../../services/api';
import { useAuth } from '../../stores/auth';
import { useConnectivity } from '../../stores/connectivity';
import { offlineDisk, offlineHash } from '../../services/offline-disk';
import { cacheApiData } from '../../services/offline-cache';
import { cleanReportDraft } from './report-draft-clean';
import {
  remapReportPhotos,
  saveReportPhotos,
  useReportPhotoDrafts,
  emptyPhotoDrafts,
} from './report-photo-drafts';
import {
  activeOfflineReports,
  mountedOfflineReports,
  flushPhotoQueue,
  photoQueuePending,
  putLocalReport,
  removeLocalReport,
  reportValues,
  useOfflineReports,
} from './offline-report-store';
import type { TransferState } from '../../components/transfer-progress';
import { syncLocalSignatures } from '../people/offline-signatures';

const locks = new Map<string, Promise<Report>>();
export function syncLocalReport(
  id: string,
  progress?: (state: TransferState) => void,
): Promise<Report> {
  const lockKey = useOfflineReports.getState().scope + ':' + id;
  const running = locks.get(lockKey);
  if (running) return running;
  const operation = sync(id, progress);
  locks.set(lockKey, operation);
  void operation.finally(() => locks.delete(lockKey)).catch(() => {});
  return operation;
}
async function sync(id: string, progress?: (state: TransferState) => void) {
  let draft = useOfflineReports.getState().drafts[id];
  const user = useAuth.getState().session?.user;
  if (!draft || !user || draft.userId !== user.id)
    throw new Error('Entre na conta que criou este rascunho para sincronizar.');
  if (!useConnectivity.getState().online)
    throw new ApiError(0, 'NETWORK_ERROR', 'Sem internet. O rascunho continua salvo no telefone.');
  const scope = useOfflineReports.getState().scope!;
  useOfflineReports.setState((state) => ({ syncing: [...state.syncing, id] }));
  try {
    const values = draft.values;
    const signatures = await syncLocalSignatures(values.signatures);
    const photos = useReportPhotoDrafts.getState().reports[draft.photoKey] ?? emptyPhotoDrafts;
    const removePointMediaIds = (draft.baseReport?.media ?? [])
      .filter(
        (media) =>
          media.reportPointId &&
          photos.removedIds.includes(media.id) &&
          !values.points.some((p) => p.id === media.reportPointId),
      )
      .map((m) => m.id);
    const allFields = user.permissions.includes('reports.edit.allFields');
    const editable =
      (draft.type.config.editableFieldsByRoleCode as Record<string, string[]> | undefined)?.[
        user.role.code
      ] ?? [];
    const existing = !!draft.baseReport;
    const canEdit = (key: string) => !existing || allFields || editable.includes(key);
    const body = {
      ...values,
      clientMutationId: draft.mutationId,
      reportDate: values.reportDate || null,
      specificData: cleanReportDraft(values.specificData, ['specificData']),
      points: canEdit('points') ? cleanReportDraft(values.points, ['points']) : undefined,
      signatures: canEdit('signatures') ? cleanReportDraft(signatures, ['signatures']) : undefined,
      drawings: user.permissions.includes('drawing.edit') ? values.drawings : undefined,
    };
    try {
      validateSpecificData(draft.type.code, body.specificData, 'draft', draft.type.config);
    } catch (cause) {
      if (cause instanceof ZodError)
        throw new ZodError(
          cause.issues.map((issue) => ({ ...issue, path: ['specificData', ...issue.path] })),
        );
      throw cause;
    }
    const payload = draft.baseReport
      ? reportUpdateSchema.parse({
          ...body,
          version: draft.baseReport.version,
          ...(removePointMediaIds.length ? { removePointMediaIds } : {}),
        })
      : reportCreateSchema.parse({
          ...body,
          clientDraftId: draft.id,
          reportTypeId: draft.type.id,
          companyId: draft.companyId,
          projectId: draft.projectId,
          prefillFromProject: false,
        });
    progress?.({
      message: 'Sincronizando dados do relatório…',
      completed: 0,
      total: photos.photos.length,
    });
    let saved = await api<Report>(
      draft.baseReport ? '/reports/' + draft.baseReport.id : '/reports',
      { ...jsonBody(draft.baseReport ? 'PUT' : 'POST', payload), accountId: user.id },
    );
    // A lost create response can be retried safely. Apply later local edits with
    // the original version, never overwrite a server version changed elsewhere.
    if (!draft.baseReport && saved.lastClientMutationId !== draft.mutationId) {
      saved = await api<Report>('/reports/' + saved.id, {
        ...jsonBody('PUT', reportUpdateSchema.parse({ ...body, version: 1 })),
        accountId: user.id,
      });
    }
    const nextKey = remapReportPhotos(draft.photoKey, saved, values.points);
    if (removePointMediaIds.length)
      useReportPhotoDrafts.getState().update(nextKey, (queue) => ({
        ...queue,
        removedIds: queue.removedIds.filter((mediaId) => !removePointMediaIds.includes(mediaId)),
      }));
    await flushPhotoQueue();
    await offlineDisk.flush();
    draft = {
      ...draft,
      baseReport: saved,
      photoKey: nextKey,
      values: reportValues(saved),
      error: undefined,
    };
    await putLocalReport(draft);
    saved = await saveReportPhotos(nextKey, saved, saved.points ?? [], progress);
    draft = { ...draft, baseReport: saved, values: reportValues(saved) };
    await putLocalReport(draft);
    await flushPhotoQueue();
    await offlineDisk.flush();
    const pending = useReportPhotoDrafts.getState().reports[nextKey];
    if (photoQueuePending(pending))
      throw (
        pending?.error ??
        new Error(
          'Há fotos aguardando envio. Abra o rascunho para conferir e sincronizar novamente.',
        )
      );
    if (
      useAuth.getState().session?.user.id !== user.id ||
      useOfflineReports.getState().scope !== scope
    )
      throw new Error('A conta mudou durante o envio. Confira o rascunho na conta original.');
    await cacheApiData(scope, '/reports/' + saved.id, saved);
    for (const media of saved.media ?? []) {
      if (!media.clientUploadId) continue;
      const file = draft.files.find((name) =>
        name.startsWith('photo-' + media.clientUploadId + '.'),
      );
      if (!file) continue;
      const blob = await offlineDisk.getBlob(scope, file);
      if (blob)
        await offlineDisk.putBlob(
          scope,
          'remote-' + offlineHash('/reports/' + saved.id + '/media/' + media.id),
          blob,
        );
    }
    if (
      useOfflineReports.getState().scope !== scope ||
      useAuth.getState().session?.user.id !== user.id
    )
      throw new ApiError(
        409,
        'ACCOUNT_CHANGED',
        'A conta mudou. Entre na conta original para continuar.',
      );
    useReportPhotoDrafts.setState((state) => {
      const reports = { ...state.reports };
      delete reports[nextKey];
      return { reports };
    });
    await flushPhotoQueue();
    if (mountedOfflineReports.has(id))
      useOfflineReports.setState((state) => ({
        syncResults: { ...state.syncResults, [id]: saved },
      }));
    await removeLocalReport(id);
    // Originals in the camera/gallery are never touched.
    for (const file of draft.files) await offlineDisk.removeBlob(scope, file).catch(() => {});
    return saved;
  } catch (cause) {
    if (useOfflineReports.getState().scope === scope) {
      const message =
        cause instanceof ZodError
          ? cause.issues
              .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
              .slice(0, 4)
              .join('\n')
          : cause instanceof Error
            ? cause.message
            : 'Não foi possível sincronizar.';
      await putLocalReport({
        ...draft,
        error: {
          message,
          ...((cause as { code?: string })?.code ? { code: (cause as { code: string }).code } : {}),
          ...(cause instanceof ApiError ? { details: cause.details } : {}),
          ...(cause instanceof ZodError ? { code: 'VALIDATION_ERROR', details: cause.issues } : {}),
        },
      });
    }
    throw cause;
  } finally {
    if (useOfflineReports.getState().scope === scope)
      useOfflineReports.setState((state) => ({
        syncing: state.syncing.filter((item) => item !== id),
      }));
  }
}
export async function syncWaitingReports() {
  const drafts = Object.values(useOfflineReports.getState().drafts);
  for (const draft of drafts) {
    if (!useConnectivity.getState().online) break;
    if (activeOfflineReports.has(draft.id) || (draft.error && draft.error.code !== 'NETWORK_ERROR'))
      continue;
    await syncLocalReport(draft.id).catch(() => {});
  }
}
export const newOfflineMutationId = () => randomUUID();
