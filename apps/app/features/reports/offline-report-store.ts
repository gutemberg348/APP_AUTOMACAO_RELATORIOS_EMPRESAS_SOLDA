import { create } from 'zustand';
import type { Project, Report, ReportType } from '@weldcosta/shared';
import type { ReportFormValues } from './report-collections';
import { offlineDisk, offlineHash } from '../../services/offline-disk';
import { restoreReportAsset } from '../../services/offline-files';
import { emptyPhotoDrafts, useReportPhotoDrafts, type PhotoDrafts } from './report-photo-drafts';
import { offlineStorageFailure } from '../../stores/connectivity';
import { cleanReportDraft } from './report-draft-clean';

export function offlineValuesFingerprint(values: ReportFormValues) {
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, child]) => [key, canonical(child)]),
          )
        : value;
  return JSON.stringify(canonical(cleanReportDraft(values)));
}

export interface LocalReportDraft {
  id: string;
  userId: string;
  companyId: string;
  projectId: string;
  project?: Project;
  type: ReportType;
  photoKey: string;
  baseReport?: Report;
  values: ReportFormValues;
  mutationId: string;
  updatedAt: string;
  files: string[];
  error?: { message: string; code?: string; details?: unknown };
}
export const useOfflineReports = create<{
  scope?: string;
  userId?: string;
  ready: boolean;
  drafts: Record<string, LocalReportDraft>;
  syncing: string[];
  syncResults: Record<string, Report>;
}>(() => ({ ready: false, drafts: {}, syncing: [], syncResults: {} }));
export const activeOfflineReports = new Set<string>();
export const mountedOfflineReports = new Set<string>();
export async function putLocalReport(draft: LocalReportDraft) {
  const scope = useOfflineReports.getState().scope;
  if (!scope || useOfflineReports.getState().userId !== draft.userId)
    throw new Error('A conta mudou. Entre na conta original para continuar este rascunho.');
  useOfflineReports.setState((state) => ({ drafts: { ...state.drafts, [draft.id]: draft } }));
  try {
    await offlineDisk.put(scope, 'draft-' + draft.id, draft);
  } catch (cause) {
    offlineStorageFailure(cause);
    throw cause;
  }
}
export async function removeLocalReport(id: string) {
  const scope = useOfflineReports.getState().scope;
  if (!scope) return;
  await offlineDisk.remove(scope, 'draft-' + id);
  useOfflineReports.setState((state) => {
    const drafts = { ...state.drafts };
    delete drafts[id];
    return { drafts };
  });
}
export async function discardLocalReport(id: string) {
  const state = useOfflineReports.getState(),
    draft = state.drafts[id];
  if (!draft || !state.scope || state.syncing.includes(id)) return;
  await removeLocalReport(id);
  useReportPhotoDrafts.setState((current) => {
    const reports = { ...current.reports };
    delete reports[draft.photoKey];
    return { reports };
  });
  await flushPhotoQueue();
  for (const file of draft.files) await offlineDisk.removeBlob(state.scope, file).catch(() => {});
}
export function reportValues(report: Report): ReportFormValues {
  return {
    number: report.number,
    title: report.title,
    reportDate: report.reportDate?.slice(0, 10) ?? '',
    specificData: report.specificData,
    points: (report.points ?? []).map((p) => ({
      id: p.id,
      number: p.number,
      type: p.type,
      label: p.label ?? '',
      value: p.value ?? null,
      unit: p.unit ?? '',
      data: p.data ?? {},
    })),
    drawings: (report.drawings ?? []).map((d) => ({ id: d.id, data: d.data })),
    signatures: (report.signatures ?? []).map((s) => ({
      role: s.role,
      name: s.name,
      registrationNumber: s.registrationNumber ?? '',
      signedAt: s.signedAt?.slice(0, 10),
      signatureAssetId: s.signatureAssetId ?? null,
    })),
  };
}
export async function hydrateOfflineReports(scope: string, userId: string) {
  useOfflineReports.setState({
    scope,
    userId,
    ready: false,
    drafts: {},
    syncing: [],
    syncResults: {},
  });
  const drafts: Record<string, LocalReportDraft> = {};
  const keys = await offlineDisk.keys(scope, 'draft-');
  for (const key of keys) {
    const draft = await offlineDisk.get<LocalReportDraft>(scope, key);
    if (draft?.userId === userId) drafts[draft.id] = draft;
  }
  const photos: Record<string, PhotoDrafts> = {};
  for (const key of await offlineDisk.keys(scope, 'photos-')) {
    const entry = await offlineDisk.get<{ key: string; draft: PhotoDrafts }>(scope, key);
    if (!entry?.key.startsWith(userId + ':')) continue;
    const draft = entry.draft;
    for (const photo of draft.photos) {
      try {
        photo.asset = await restoreReportAsset(scope, photo.asset);
      } catch (cause) {
        draft.error = new Error(
          cause instanceof Error ? cause.message : 'Foto local indisponível.',
        );
      }
    }
    photos[entry.key] = draft;
  }
  if (useOfflineReports.getState().scope !== scope) return;
  useReportPhotoDrafts.setState({ reports: photos });
  useOfflineReports.setState({ drafts, ready: true });
}
let photoWrites: Promise<unknown> = Promise.resolve();
export async function flushPhotoQueue() {
  await photoWrites;
}
export function persistPhotoQueue(scope: string, userId: string) {
  return useReportPhotoDrafts.subscribe((state, previous) => {
    const changed = [
      ...new Set([...Object.keys(state.reports), ...Object.keys(previous.reports)]),
    ].filter((key) => key.startsWith(userId + ':') && state.reports[key] !== previous.reports[key]);
    const snapshots = changed.flatMap((key) => {
      const draft = state.reports[key];
      return draft
        ? [
            {
              key,
              draft: JSON.parse(
                JSON.stringify({
                  ...draft,
                  error: undefined,
                  photos: draft.photos.map((p) => ({
                    ...p,
                    asset: { ...p.asset, file: undefined },
                  })),
                }),
              ) as PhotoDrafts,
            },
          ]
        : [];
    });
    const removed = changed.filter((key) => !state.reports[key]);
    photoWrites = photoWrites
      .catch(() => {})
      .then(async () => {
        for (const entry of snapshots)
          await offlineDisk.put(scope, 'photos-' + offlineHash(entry.key), entry);
        // Persist the destination before removing the old key during create -> edit.
        for (const key of removed) await offlineDisk.remove(scope, 'photos-' + offlineHash(key));
      });
    void photoWrites.catch(offlineStorageFailure);
  });
}
export const photoQueuePending = (draft: PhotoDrafts = emptyPhotoDrafts) =>
  !!(
    draft.photos.length ||
    draft.removedIds.length ||
    Object.keys(draft.captionEdits ?? {}).length ||
    Object.keys(draft.annotationEdits ?? {}).length
  );
