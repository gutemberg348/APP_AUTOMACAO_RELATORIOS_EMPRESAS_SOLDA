import { ReportPhotoSaveError } from './report-photo-error';
import { cleanReportDraft } from './report-draft-clean';
import { useTheme } from '../../utils/theme';
import { reportPanelStyle } from './report-panel-style';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Keyboard, AppState, type ViewInstance } from 'react-native';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ZodError } from 'zod';
import {
  reportConfigSchema,
  reportCreateSchema,
  reportUpdateSchema,
  validateSpecificData,
  buildReportDefaults,
  isVisualWeldReport,
  type VisualInspectionRecord,
  pointKey,
  type Report,
  type ReportType,
  type Paginated,
  type Project,
} from '@weldcosta/shared';
import { api, ApiError } from '../../services/api';
import { useUnsavedChanges } from '../../hooks/use-unsaved-changes';
import {
  Card,
  Field,
  Button,
  Notice,
  PanelHeader,
  FormGrid,
  FormCell,
  Badge,
  selectionState,
} from '../../components/ui';
import { Icon } from '../../components/icon';
import { reportSections, type ReportSection } from './report-fields';
import { useAuth } from '../../stores/auth';

import { DateField } from '../../components/date-field';
import { SelectField, type SelectOption } from '../../components/select-field';
import {
  Discontinuities,
  ReportPoints,
  ReportSigners,
  type ReportFormValues,
} from './report-collections';
import { todayISO } from '../../utils/dates';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { DrawingEditor } from './drawing-editor';
import { usePageScroll } from '../../components/page-scroll';
import { prepareCurrentReportPdf } from './report-current-pdf';
import { ReportActions } from './report-actions';
import { emptyPhotoDrafts, useReportPhotoDrafts } from './report-photo-drafts';
import { reusableReportFields, recentReportDefaults } from './report-autofill';
import { shouldApplyReportSnapshot } from './report-snapshot';
import { TransferOverlay, type TransferState } from '../../components/transfer-progress';
import {
  apiValidationIssues,
  formErrorGuidance,
  type ValidationIssue,
} from '../../utils/form-feedback';
import {
  reportCorrections,
  reportBusinessCorrection,
  reportFormIssues,
  type ReportCorrection,
  type CorrectionRequest,
} from './report-save-feedback';
import { PickerSheet } from '../../components/picker-sheet';
import { ReportSaveIssues } from './report-save-issues';
import { VisualInspectionRecords } from './visual-inspection-records';
import { LpTechniqueField } from './lp-technique-field';
import { hasReportForm, reportFormSections, type ReportFormSection } from './report-form-sections';
import {
  activeOfflineReports,
  mountedOfflineReports,
  flushPhotoQueue,
  putLocalReport,
  removeLocalReport,
  useOfflineReports,
  reportValues,
  offlineValuesFingerprint,
  type LocalReportDraft,
} from './offline-report-store';
import { newOfflineMutationId, syncLocalReport, syncWaitingReports } from './offline-report-sync';
import { useConnectivity, offlineStorageFailure } from '../../stores/connectivity';
import { offlineDisk } from '../../services/offline-disk';
import { ReportSummary } from './report-summary';
const resultOptions: SelectOption[] = [
  { value: '', label: 'Não informado', description: 'Definir o resultado depois.', icon: 'clock' },
  {
    value: 'APPROVED',
    label: 'Aprovado',
    description: 'Atende aos critérios de aceitação.',
    icon: 'check-circle',
    tone: 'green',
  },
  {
    value: 'REJECTED',
    label: 'Reprovado',
    description: 'Não atende aos critérios de aceitação.',
    icon: 'alert',
    tone: 'danger',
  },
  {
    value: 'COMPLEMENTARY_EXAM',
    label: 'Exame complementar',
    description: 'Requer avaliação complementar.',
    icon: 'search',
    tone: 'amber',
  },
];
type Values = ReportFormValues;
// Registering a previously absent field must not make a saved report dirty.
function withFieldDefaults(data: Record<string, unknown>, sections: ReportSection[]) {
  const result = { ...data };
  for (const field of sections.flatMap((section) => section.fields)) {
    const path = field.path.split('.');
    let target = result;
    for (const key of path.slice(0, -1)) {
      target[key] = { ...((target[key] as Record<string, unknown>) ?? {}) };
      target = target[key] as Record<string, unknown>;
    }
    const key = path.at(-1)!;
    if (target[key] === undefined) target[key] = '';
  }
  return result;
}
export function ReportForm(props: Parameters<typeof ReportFormContent>[0]) {
  const local = useOfflineReports(
    (state) =>
      props.offlineDraft ??
      Object.values(state.drafts).find(
        (draft) => !!props.report && draft.baseReport?.id === props.report.id,
      ),
  );
  const config = reportConfigSchema.safeParse(props.type.config);
  if (!config.success || !hasReportForm(props.type.code, config.data.customFields))
    return (
      <Card>
        <PanelHeader title="Modelo de relatório indisponível" icon="alert" />
        <Notice
          error={
            new Error(
              `${props.type.name} (${props.type.code}) não possui um formulário compatível neste aplicativo.`,
            )
          }
          guidance="Atualize o aplicativo e carregue os modelos novamente. Se continuar, informe ao administrador o nome e o código acima para conferir o cadastro do modelo. Seus relatórios salvos continuam preservados."
        />
      </Card>
    );
  return <ReportFormContent {...props} offlineDraft={local} />;
}

function ReportFormContent({
  type,
  report: initialReport,
  companyId,
  projectId,
  onDirtyChange,
  initialData = {},
  initialTitle = '',
  project,
  offlineDraft,
}: {
  type: ReportType;
  report?: Report;
  companyId: string;
  projectId: string;
  onDirtyChange?(dirty: boolean): void;
  initialData?: Record<string, unknown>;
  initialTitle?: string;
  project?: Project;
  offlineDraft?: LocalReportDraft;
}) {
  const localId = useRef(offlineDraft?.id ?? newOfflineMutationId()).current;
  const localEntry = useOfflineReports((state) => state.drafts[localId]);
  const syncingLocally = useOfflineReports((state) => state.syncing.includes(localId));
  const online = useConnectivity((state) => state.online);
  const storageError = useConnectivity((state) => state.storageError);
  const [locallySaved, setLocallySaved] = useState(!!offlineDraft);
  const [localMessage, setLocalMessage] = useState('');
  const [downloadAsIsRequest, setDownloadAsIsRequest] = useState(0);
  const [serverConflict, setServerConflict] = useState<Report>();
  const localTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [createdReport, setCreatedReport] = useState<Report>();
  const report =
    localEntry?.baseReport ??
    (createdReport && createdReport.version > (initialReport?.version ?? 0)
      ? createdReport
      : (initialReport ?? createdReport));
  const { tokens: t, styles } = useTheme();
  const { etapa } = useLocalSearchParams<{ etapa?: string }>();
  const [step, setStep] = useState(etapa === 'conclusao' || etapa === '2' ? 1 : 0),
    [error, setError] = useState<unknown>(),
    client = useQueryClient(),
    user = useAuth((state) => state.session!.user);
  const photoDraftKey = user.id + ':' + (report?.id ?? 'local-' + localId);
  const photoDrafts = useReportPhotoDrafts(
    (state) => state.reports[photoDraftKey] ?? emptyPhotoDrafts,
  );
  const hasPhotoDrafts = !!(
    photoDrafts.photos.length ||
    photoDrafts.removedIds.length ||
    Object.keys(photoDrafts.captionEdits ?? {}).length ||
    Object.keys(photoDrafts.annotationEdits ?? {}).length
  );
  const photoCount =
    (report?.media ?? []).filter((photo) => !photoDrafts.removedIds.includes(photo.id)).length +
    photoDrafts.photos.length;
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [transferProgress, setTransferProgress] = useState<TransferState>();
  const [autofillMessage, setAutofillMessage] = useState('');
  const autoFilled = useRef(!!offlineDraft);
  const editedSetupPaths = useRef(new Set<string>());
  const loadedReportVersion = useRef<string | undefined>(
    offlineDraft?.baseReport
      ? offlineDraft.baseReport.id + ':' + offlineDraft.baseReport.version
      : undefined,
  );
  const acceptedSaveVersion = useRef<string | undefined>(undefined);
  const previousReport = useQuery({
    queryKey: ['report-autofill', user.id, projectId, type.id, report?.id],
    enabled: user.permissions.includes('reports.view') && !!projectId,
    queryFn: async () => {
      const list = await api<Paginated<Report>>(
        '/reports?projectId=' +
          projectId +
          '&reportTypeId=' +
          type.id +
          '&sortBy=createdAt&sortOrder=desc&limit=100',
      );
      const matching = list.items.filter(
        (item) =>
          item.id !== report?.id && item.projectId === projectId && item.reportTypeId === type.id,
      );
      const previous = matching[0];
      if (!previous) return null;
      const full = await api<Report>('/reports/' + previous.id);
      return {
        ...full,
        reusableData: recentReportDefaults(
          type.code,
          matching.map((item) => (item.id === previous.id ? full.specificData : item.specificData)),
        ),
      };
    },
    staleTime: 60000,
  });
  const [reapply, setReapply] = useState(false);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(!report?.number.trim());
  const [saveIssues, setSaveIssues] = useState<ReportCorrection[]>([]);
  const [failureOpen, setFailureOpen] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [sectionPickerOpen, setSectionPickerOpen] = useState(false);
  const [correction, setCorrection] = useState<CorrectionRequest>();
  const fieldViews = useRef<Record<string, ViewInstance | null>>({});
  const reveal = usePageScroll();
  const formTop = useRef<ViewInstance>(null);
  const conclusionActions = useRef<ViewInstance>(null);
  const [sectionNavigation, setSectionNavigation] = useState(0);
  const previousReveal = useRef({ step, error, sectionNavigation });
  const sectionViews = useRef<Record<string, ViewInstance | null>>({});
  const errorSection = useRef<string | undefined>(undefined);
  const [openSectionTitle, setOpenSectionTitle] = useState<string | null>();
  const editingBusy = pickingPhoto || saving || acting || syncingLocally;
  const config = reportConfigSchema.parse(type.config);
  const baseSections: ReportSection[] = reportSections[type.code] ?? [
    {
      title: 'Dados específicos',
      fields: Object.entries(config.customFields ?? {}).map(([path, kind]) => ({
        path,
        label: path,
        kind: kind === 'date' ? ('date' as const) : undefined,
      })),
    },
  ];
  type Section = ReportFormSection;
  const sections = reportFormSections(type.code, baseSections);
  const stages = [{ title: 'Inspeção' }, { title: 'Concluir' }];
  const sectionStage = (section: Section) =>
    section.content === 'signatures' || ['Laudo', 'Observação'].includes(section.title) ? 1 : 0;
  const defaultSection =
    sections.find(
      (section) =>
        sectionStage(section) === step &&
        (section.content === 'points' || ['Laudo', 'Observação'].includes(section.title)),
    ) ?? sections.find((section) => sectionStage(section) === step);
  const isSectionOpen = (section: Section) =>
    !identityOpen &&
    section.title === (openSectionTitle === undefined ? defaultSection?.title : openSectionTitle);
  const goToStep = (next: number) => {
    Keyboard.dismiss();
    setIdentityOpen(false);
    setOpenSectionTitle(undefined);
    setStep(next);
  };
  const openSection = (index: number) => {
    const section = sections[index];
    if (!section) return;
    errorSection.current = section.title;
    setStep(sectionStage(section));
    setIdentityOpen(false);
    setOpenSectionTitle(section.title);
  };
  const orderedSections = [
    ...sections.filter((s) => sectionStage(s) === 0),
    ...sections.filter((s) => sectionStage(s) === 1),
  ];
  const nextSection = (section: Section) =>
    orderedSections[orderedSections.findIndex((s) => s.title === section.title) + 1];
  const advanceSection = (section?: Section) => {
    Keyboard.dismiss();
    const next = section ? nextSection(section) : orderedSections[0];
    setIdentityOpen(false);
    setOpenSectionTitle(next?.title ?? null);
    if (next) setStep(sectionStage(next));
    errorSection.current = next?.title ?? '__save';
    setSectionNavigation((n) => n + 1);
  };
  const allFields = user.permissions.includes('reports.edit.allFields'),
    editable = config.editableFieldsByRoleCode[user.role.code] ?? [];
  const canEditPath = (path: string) => !report || allFields || editable.includes(path);
  const canEdit = (path: string) => !editingBusy && canEditPath(path);
  const {
    control,
    handleSubmit,
    reset,
    clearErrors,
    setError: setFieldError,
    getFieldState,
    getValues,
    watch,
    setValue,
    formState: { isDirty, errors },
  } = useForm<Values>({
    defaultValues: offlineDraft?.values ?? {
      number: '',
      title: initialTitle,
      reportDate: todayISO(),
      specificData: withFieldDefaults(
        {
          ...(type.code === 'LP' ? { discontinuities: [] } : {}),
          ...(type.code === 'EVD' ? { inspectionType: 'EVS DIRETO', inspectionRecords: [] } : {}),
          ...initialData,
          ...(type.code === 'RDO' ? { date: todayISO(), inspector: user.name } : {}),
        },
        baseSections,
      ),
      points: [],
      signatures: [],
      drawings: [],
    },
  });
  const hasChanges = isDirty || hasPhotoDrafts || !!localEntry;
  const localContext = useRef({ report, project, photoDraftKey, saving: saving || syncingLocally });
  localContext.current = { report, project, photoDraftKey, saving: saving || syncingLocally };
  const saveOnPhone = useCallback(
    async (data: Values) => {
      clearTimeout(localTimer.current);
      localTimer.current = undefined;
      const context = localContext.current;
      const previous = useOfflineReports.getState().drafts[localId];
      const photos =
        useReportPhotoDrafts.getState().reports[context.photoDraftKey] ?? emptyPhotoDrafts;
      const draft: LocalReportDraft = {
        id: localId,
        userId: user.id,
        companyId,
        projectId,
        type,
        project: context.project ?? context.report?.project ?? previous?.project,
        baseReport: previous?.baseReport ?? context.report,
        photoKey: context.photoDraftKey,
        values: JSON.parse(JSON.stringify(data)),
        mutationId:
          previous && offlineValuesFingerprint(previous.values) === offlineValuesFingerprint(data)
            ? previous.mutationId
            : newOfflineMutationId(),
        updatedAt: new Date().toISOString(),
        files: [
          ...new Set([
            ...(previous?.files ?? []),
            ...photos.photos.flatMap((p) => (p.asset.offlineFileId ? [p.asset.offlineFileId] : [])),
          ]),
        ],
      };
      await putLocalReport(draft);
      await flushPhotoQueue();
      await offlineDisk.flush();
      useConnectivity.setState({ storageError: undefined });
      setLocallySaved(true);
      setLocalMessage(
        'Salvo neste telefone às ' +
          new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) +
          '. ' +
          (useConnectivity.getState().online
            ? 'Pronto para sincronizar.'
            : 'Será enviado quando houver internet.'),
      );
      return draft;
    },
    [localId, user.id, companyId, projectId, type],
  );
  const saveOnPhoneRef = useRef(saveOnPhone);
  saveOnPhoneRef.current = saveOnPhone;
  const wasSyncing = useRef(false);
  useEffect(() => {
    if (syncingLocally) {
      clearTimeout(localTimer.current);
      localTimer.current = undefined;
      wasSyncing.current = true;
      return;
    }
    if (!wasSyncing.current) return;
    wasSyncing.current = false;
    const state = useOfflineReports.getState(),
      checkpoint = state.drafts[localId];
    const snapshot = checkpoint?.baseReport ?? state.syncResults[localId];
    if (
      snapshot &&
      (state.syncResults[localId] ||
        loadedReportVersion.current !== snapshot.id + ':' + snapshot.version)
    ) {
      loadedReportVersion.current = snapshot.id + ':' + snapshot.version;
      setCreatedReport(snapshot);
      const values = checkpoint?.values ?? reportValues(snapshot);
      reset({ ...values, specificData: withFieldDefaults(values.specificData, baseSections) });
      setLocallySaved(true);
    }
    if (state.syncResults[localId]) {
      const syncResults = { ...state.syncResults };
      delete syncResults[localId];
      useOfflineReports.setState({ syncResults });
    }
  }, [syncingLocally, localId, reset]);
  useFocusEffect(
    useCallback(() => {
      activeOfflineReports.add(localId);
      return () => {
        activeOfflineReports.delete(localId);
        const flush = localTimer.current
          ? saveOnPhoneRef.current(getValues()).catch(() => {})
          : Promise.resolve();
        void flush.then(() => syncWaitingReports());
      };
    }, [localId, getValues]),
  );
  useEffect(() => {
    mountedOfflineReports.add(localId);
    const subscription = watch((_values, info) => {
      if (!info.name || localContext.current.saving) return;
      setLocallySaved(false);
      clearTimeout(localTimer.current);
      localTimer.current = setTimeout(
        () => void saveOnPhoneRef.current(getValues()).catch(showLocalError),
        700,
      );
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && !localContext.current.saving && localTimer.current)
        void saveOnPhoneRef.current(getValues()).catch(showLocalError);
    });
    function showLocalError(cause: unknown) {
      offlineStorageFailure(cause);
      setLocallySaved(false);
      setLocalMessage(
        'Não foi possível guardar as últimas alterações. Confira o aviso e salve novamente.',
      );
      setError(new Error(useConnectivity.getState().storageError));
    }
    return () => {
      mountedOfflineReports.delete(localId);
      subscription.unsubscribe();
      appState.remove();
      if (localTimer.current) {
        clearTimeout(localTimer.current);
        void saveOnPhoneRef.current(getValues()).catch(() => {});
      }
    };
  }, [localId, watch, getValues]);
  const lastPhotoDrafts = useRef(photoDrafts);
  useEffect(() => {
    const changed = lastPhotoDrafts.current !== photoDrafts;
    lastPhotoDrafts.current = photoDrafts;
    if (!changed || !hasPhotoDrafts || saving || syncingLocally) return;
    setLocallySaved(false);
    clearTimeout(localTimer.current);
    void saveOnPhoneRef.current(getValues()).catch((cause) => {
      offlineStorageFailure(cause);
      setLocallySaved(false);
      setLocalMessage(
        'Não foi possível guardar as últimas alterações. Confira o aviso e salve novamente.',
      );
      setError(new Error(useConnectivity.getState().storageError));
    });
  }, [photoDrafts, hasPhotoDrafts, saving, syncingLocally, getValues]);
  const watchedPoints = useWatch({ control, name: 'points' });
  const watchedDrawings = useWatch({ control, name: 'drawings' });
  const watchedData = useWatch({ control, name: 'specificData' });
  const watchedSignatures = useWatch({ control, name: 'signatures' });
  const watchedTitle = useWatch({ control, name: 'title' });
  const reusable = previousReport.data
    ? reusableReportFields(type.code, previousReport.data.reusableData, watchedData).filter(
        (field) => canEditPath('specificData.' + field.path),
      )
    : [];
  const fillFromPrevious = () => {
    if (editingBusy || !previousReport.data) return;
    const fields = reusableReportFields(
      type.code,
      previousReport.data.reusableData,
      getValues('specificData'),
    );
    let count = 0;
    for (const field of fields) {
      if (!canEditPath('specificData.' + field.path)) continue;
      setValue(('specificData.' + field.path) as `specificData.${string}`, field.value, {
        shouldDirty: true,
      });
      count++;
    }
    setAutofillMessage(
      `${count} campos preenchidos. Confira os dados técnicos, lotes e datas antes de concluir; tudo continua editável.`,
    );
  };
  useEffect(() => {
    if (report || autoFilled.current || !previousReport.data || editingBusy) return;
    autoFilled.current = true;
    let count = 0;
    for (const field of reusableReportFields(
      type.code,
      previousReport.data.reusableData,
      getValues('specificData'),
    )) {
      const path = ('specificData.' + field.path) as `specificData.${string}`;
      if (
        editedSetupPaths.current.has(field.path) ||
        getFieldState(path).isDirty ||
        getFieldState(path).isTouched
      )
        continue;
      setValue(path, field.value, { shouldDirty: true });
      count++;
    }
    if (count)
      setAutofillMessage(
        `${count} campos preenchidos automaticamente com os dados já salvos nesta obra. Confira os dados técnicos, lotes e datas; tudo continua editável.`,
      );
  }, [report, previousReport.data, editingBusy, type.code, getValues, getFieldState, setValue]);
  useEffect(() => {
    const previous = previousReveal.current;
    previousReveal.current = { step, error, sectionNavigation };
    if (
      previous.step === step &&
      previous.error === error &&
      previous.sectionNavigation === sectionNavigation
    )
      return;
    const frame = requestAnimationFrame(() => {
      reveal(
        (errorSection.current === '__save'
          ? conclusionActions.current
          : errorSection.current && sectionViews.current[errorSection.current]) || formTop.current,
      );
      errorSection.current = undefined;
    });
    return () => cancelAnimationFrame(frame);
  }, [step, error, reveal, sectionNavigation]);
  const sectionSummary = (section: Section) => {
    if (section.content === 'points')
      return `${watchedPoints.length} ${watchedPoints.length === 1 ? 'ponto' : 'pontos'} · dados, resultados e fotos`;
    if (section.content === 'drawings')
      return `${watchedDrawings.length} desenhos · isométrico ou croqui`;
    if (section.content === 'signatures') return `${watchedSignatures.length} responsáveis`;
    if (section.content === 'discontinuities')
      return 'Códigos e descrições das indicações encontradas';
    if (section.content === 'inspectionRecords')
      return `${Array.isArray(watchedData.inspectionRecords) ? watchedData.inspectionRecords.length : 0} registros · juntas, sinetes e laudos`;
    const filled = section.fields.filter((field) => {
      const value = field.path
        .split('.')
        .reduce<unknown>(
          (data, key) =>
            data && typeof data === 'object' ? (data as Record<string, unknown>)[key] : undefined,
          watchedData,
        );
      return value !== undefined && value !== null && value !== '';
    }).length;
    return `${filled} de ${section.fields.length} campos preenchidos · toque para conferir ou ajustar`;
  };
  const drawingEditable = !editingBusy && user.permissions.includes('drawing.edit');
  const reapplyDefaults = () => {
    const source = report
      ? buildReportDefaults(type.code, report.project, report.company)
      : initialData;
    const apply = (data: Record<string, unknown>, prefix = 'specificData') => {
      for (const [key, value] of Object.entries(data)) {
        const path = prefix + '.' + key;
        if (value && typeof value === 'object' && !Array.isArray(value))
          apply(value as Record<string, unknown>, path);
        else if (canEdit(path))
          setValue(path as `specificData.${string}`, value, { shouldDirty: true });
      }
    };
    apply(source);
    setReapply(false);
  };
  const discardPhotos = useCallback(() => {
    clearTimeout(localTimer.current);
    localTimer.current = undefined;
    void removeLocalReport(localId);
    useReportPhotoDrafts.getState().update(photoDraftKey, () => emptyPhotoDrafts);
  }, [photoDraftKey, localId]);
  useUnsavedChanges((hasChanges && !locallySaved) || editingBusy, discardPhotos);
  useEffect(() => {
    onDirtyChange?.(hasChanges || editingBusy);
  }, [hasChanges, editingBusy, onDirtyChange]);
  useEffect(() => {
    if (report) {
      const version = report.id + ':' + report.version;
      // A background refresh must never replace a drawing or point being edited.
      if (
        !shouldApplyReportSnapshot(
          loadedReportVersion.current,
          version,
          hasChanges,
          acceptedSaveVersion.current,
        )
      )
        return;
      loadedReportVersion.current = version;
      acceptedSaveVersion.current = undefined;
      reset({
        number: report.number,
        title: report.title,
        reportDate: report.reportDate?.slice(0, 10) ?? '',
        specificData: withFieldDefaults(
          {
            ...(type.code === 'LP' ? { discontinuities: [] } : {}),
            ...report.specificData,
          },
          baseSections,
        ),
        points: (report.points ?? []).map((point) => ({
          id: point.id,
          number: point.number,
          type: point.type,
          label: point.label ?? '',
          value: point.value ?? null,
          unit: point.unit ?? '',
          data: {
            dimension: '',
            projectThickness: '',
            discontinuity: '',
            notes: '',
            acceptable: undefined,
            ...point.data,
          },
        })),
        signatures: (report.signatures ?? []).map((signer) => ({
          role: signer.role,
          name: signer.name,
          registrationNumber: signer.registrationNumber ?? '',
          signedAt: signer.signedAt?.slice(0, 10) ?? '',
          signatureAssetId: signer.signatureAssetId ?? null,
        })),
        drawings: report.drawings ?? [],
      });
    }
  }, [report, reset, hasChanges]);
  const correctIssue = (issue: ReportCorrection) => {
    Keyboard.dismiss();
    setIssuesOpen(false);
    const first = issue.path;
    const target = sections.findIndex((section) =>
      section.content
        ? section.content === first[0] ||
          (['discontinuities', 'inspectionRecords'].includes(section.content) &&
            first[1] === section.content)
        : section.fields.some(
            (field) =>
              first[0] === 'specificData' &&
              (first.slice(1).join('.') === field.path ||
                first
                  .slice(1)
                  .join('.')
                  .startsWith(field.path + '.')),
          ),
    );
    if (target >= 0) openSection(target);
    else {
      setIdentityOpen(true);
      setOpenSectionTitle(null);
      setStep(0);
    }
    setCorrection({ ...issue, request: Date.now() });
    setSectionNavigation((n) => n + 1);
  };
  useEffect(() => {
    if (!correction) return;
    const timer = setTimeout(() => {
      const view = fieldViews.current[correction.path.join('.')];
      if (view) reveal(view);
    }, 350);
    return () => clearTimeout(timer);
  }, [correction, reveal]);
  const showIssues = (issues: ValidationIssue[], specificData = false) => {
    const resolved = reportCorrections(issues, sections, getValues('points'), specificData);
    for (const issue of resolved)
      setFieldError(issue.path.join('.') as 'number', {
        type: 'validation',
        message: issue.message,
      });
    setError(undefined);
    setSaveIssues(resolved);
    setIssuesOpen(true);
  };
  const showSaveError = (cause: unknown) => {
    if (cause instanceof ReportPhotoSaveError) {
      const pointIndex = getValues('points').findIndex(
        (point) => point.number === cause.location.pointNumber,
      );
      setSaveIssues([
        {
          path: cause.location.drawing
            ? ['drawings']
            : pointIndex >= 0
              ? ['points', String(pointIndex)]
              : ['points'],
          label: cause.location.label,
          message: cause.message,
          guidance:
            (cause.code && reportBusinessCorrection(cause.code, cause.message)?.guidance) ||
            'Abra o ponto e a foto indicados. As fotos pendentes continuam no telefone; confira o motivo acima e toque em Salvar para tentar o envio novamente.',
        },
      ]);
      setError(undefined);
      setFailureOpen(false);
      setIssuesOpen(true);
      return;
    }
    if (cause instanceof ZodError) return showIssues(cause.issues);
    const issues = apiValidationIssues(cause);
    if (issues.length) return showIssues(issues);
    const known =
      cause instanceof ApiError ? reportBusinessCorrection(cause.code, cause.message) : undefined;
    if (known) {
      setSaveIssues([known]);
      setIssuesOpen(true);
      setError(undefined);
    } else {
      setSaveIssues([]);
      setError(cause);
      setFailureOpen(true);
    }
  };
  useEffect(() => {
    const cause = photoDrafts.error;
    if (!cause) return;
    showSaveError(cause);
  }, [photoDrafts.error, getValues]);
  const removeDrawingPoints = (keys: string[], clearDrawingIndex?: number) => {
    const removedKeys = new Set(keys);
    const mediaIds = (report?.media ?? [])
      .filter((photo) => !!photo.reportPointId && removedKeys.has(photo.reportPointId))
      .map((photo) => photo.id);
    if (
      !canEdit('points') ||
      !drawingEditable ||
      (mediaIds.length && !user.permissions.includes('media.delete'))
    ) {
      setError(
        new Error('Você precisa de permissão para excluir o ponto, suas fotos e marcações.'),
      );
      return false;
    }
    setValue(
      'drawings',
      getValues('drawings').map((drawing, drawingIndex) => ({
        ...drawing,
        data: {
          ...drawing.data,
          elements: drawing.data.elements.filter(
            (element) =>
              (element.type !== 'point' || !removedKeys.has(element.reportPointId)) &&
              (drawingIndex !== clearDrawingIndex || element.type !== 'marker'),
          ),
        },
      })),
      { shouldDirty: true },
    );
    setValue(
      'points',
      getValues('points').filter((point) => !removedKeys.has(pointKey(point))),
      { shouldDirty: true },
    );
    useReportPhotoDrafts.getState().update(photoDraftKey, (draft) => ({
      ...draft,
      photos: draft.photos.filter((photo) => !photo.pointKey || !removedKeys.has(photo.pointKey)),
      removedIds: [...new Set([...draft.removedIds, ...mediaIds])],
      annotationEdits: Object.fromEntries(
        Object.entries(draft.annotationEdits ?? {}).filter(([id]) => !mediaIds.includes(id)),
      ),
      captionEdits: Object.fromEntries(
        Object.entries(draft.captionEdits ?? {}).filter(([id]) => !mediaIds.includes(id)),
      ),
    }));
    return true;
  };
  const mutation = useMutation({
    onMutate: () => {
      Keyboard.dismiss();
      setSaving(true);
      setLocalMessage('Salvando neste telefone…');
      if (hasPhotoDrafts)
        setTransferProgress({
          message: 'Salvando dados do relatório…',
          completed: 0,
          total: photoDrafts.photos.length,
        });
    },
    mutationFn: async (data: Values) => {
      await saveOnPhone(data);
      return syncLocalReport(localId, setTransferProgress);
    },
    onSuccess: async (saved) => {
      setLocalMessage('Relatório e fotos sincronizados com o servidor.');
      setLocallySaved(true);
      acceptedSaveVersion.current = saved.id + ':' + saved.version;
      if (!initialReport) setCreatedReport(saved);
      client.setQueryData(['report', saved.id], saved);
      await client.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'report' });
    },
    onError: (cause) => {
      const checkpoint = useOfflineReports.getState().drafts[localId];
      if (checkpoint?.baseReport) {
        loadedReportVersion.current =
          checkpoint.baseReport.id + ':' + checkpoint.baseReport.version;
        setCreatedReport(checkpoint.baseReport);
        reset({
          ...checkpoint.values,
          specificData: withFieldDefaults(checkpoint.values.specificData, baseSections),
        });
      }
      if ((cause as { code?: string })?.code === 'NETWORK_ERROR') {
        setLocalMessage(
          'Sem internet. Seu preenchimento e suas fotos continuam salvos no telefone.',
        );
        return;
      }
      showSaveError(cause);
    },
    onSettled: () => {
      setSaving(false);
      setTransferProgress(undefined);
    },
  });
  const save = async (): Promise<Report | 'local' | undefined> => {
    if (!useConnectivity.getState().online) {
      if (localContext.current.saving) return;
      Keyboard.dismiss();
      setSaving(true);
      try {
        await saveOnPhone(getValues());
        setError(undefined);
        setSaveIssues([]);
        setIssuesOpen(false);
        setFailureOpen(false);
        return 'local';
      } catch (cause) {
        offlineStorageFailure(cause);
        setLocallySaved(false);
        setLocalMessage(
          'Não foi possível guardar as últimas alterações. Confira o aviso e salve novamente.',
        );
        showSaveError(new Error(useConnectivity.getState().storageError));
      } finally {
        setSaving(false);
      }
      return;
    }
    let saved: Report | 'local' | undefined;
    clearErrors();
    await handleSubmit(
      async (data) => {
        setError(undefined);
        setSaveIssues([]);
        setCorrection(undefined);
        clearErrors();
        const body = {
          ...data,
          reportDate: data.reportDate || null,
          specificData: cleanReportDraft(data.specificData, ['specificData']),
          points: cleanReportDraft(data.points, ['points']),
          signatures: cleanReportDraft(data.signatures, ['signatures']),
        };
        const common = report
          ? reportUpdateSchema.safeParse({ ...body, version: report.version })
          : reportCreateSchema.safeParse({ ...body, reportTypeId: type.id, companyId, projectId });
        const validationIssues: ValidationIssue[] = common.success ? [] : [...common.error.issues];
        try {
          validateSpecificData(type.code, body.specificData, 'draft', type.config);
        } catch (cause) {
          if (cause instanceof ZodError)
            validationIssues.push(
              ...cause.issues.map((issue) => ({ ...issue, path: ['specificData', ...issue.path] })),
            );
          else {
            showSaveError(cause);
            return;
          }
        }
        if (validationIssues.length) {
          showIssues(validationIssues);
          return;
        }
        saved = await mutation
          .mutateAsync(data)
          .catch((cause) =>
            (cause as { code?: string })?.code === 'NETWORK_ERROR' ? ('local' as const) : undefined,
          );
      },
      (fieldErrors) => {
        const issues = reportFormIssues(fieldErrors);
        if (issues.length) return showIssues(issues);
        showSaveError(
          new Error(
            'Não foi possível validar o preenchimento. Confira os campos destacados e tente salvar novamente.',
          ),
        );
      },
    )();
    return saved;
  };
  const requestDownloadAsIs = () => {
    setFailureOpen(false);
    setIssuesOpen(false);
    setStep(1);
    setDownloadAsIsRequest(Date.now());
    setTimeout(() => reveal(conclusionActions.current), 200);
  };
  const canDownloadAsIs = !!report && online && user.permissions.includes('pdf.download');
  return (
    <View ref={formTop} style={{ gap: 20 }}>
      <TransferOverlay progress={transferProgress} />
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <View style={{ gap: 4, flex: 1 }}>
          <Text style={[styles.text, { fontFamily: t.fonts.bold }]}>Inspecione e conclua</Text>
          <Text style={styles.muted}>
            Os dados da obra já estão preenchidos. Registre os pontos e depois o resultado.
          </Text>
        </View>
        <Badge label={type.code} tone="blue" dot={false} />
      </View>
      <Notice error={photoDrafts.error} />
      {(!online || localEntry || storageError || localMessage) && (
        <Card style={{ padding: 14, gap: 8 }}>
          <Text style={styles.label}>
            {online ? 'Preenchimento no telefone' : 'Sem internet · modo offline'}
          </Text>
          <Text style={styles.muted} accessibilityLiveRegion="polite">
            {localMessage ||
              (localEntry
                ? 'Há um rascunho salvo neste telefone aguardando sincronização.'
                : 'As alterações e fotos serão guardadas neste telefone enquanto você preenche.')}
          </Text>
          {!!localEntry?.error && localEntry.error.code !== 'NETWORK_ERROR' && (
            <View style={{ gap: 8 }}>
              <Notice
                error={new Error(localEntry.error.message)}
                guidance="Seu rascunho continua salvo no telefone."
              />
              <Button
                title="Corrigir pendência"
                small
                secondary
                onPress={() =>
                  showSaveError(
                    new ApiError(
                      422,
                      localEntry.error!.code ?? 'OFFLINE_SYNC_ERROR',
                      localEntry.error!.message,
                      localEntry.error!.details,
                    ),
                  )
                }
              />
              {localEntry.error.code === 'VERSION_CONFLICT' && localEntry.baseReport && (
                <Button
                  title="Conferir versão do servidor"
                  small
                  secondary
                  disabled={!online || editingBusy}
                  onPress={() =>
                    void api<Report>('/reports/' + localEntry.baseReport!.id)
                      .then(setServerConflict)
                      .catch(showSaveError)
                  }
                />
              )}
            </View>
          )}
          <Notice error={storageError ? new Error(storageError) : undefined} />
          <Button
            title={online ? 'Sincronizar agora' : 'Salvar no telefone'}
            small
            secondary
            icon="save"
            disabled={editingBusy}
            busy={saving || syncingLocally}
            onPress={() => void save()}
          />
          {!online && (
            <Text style={styles.muted}>
              PDF, análise e aprovação ficam disponíveis após a sincronização.
            </Text>
          )}
        </Card>
      )}
      <PickerSheet
        visible={!!serverConflict}
        title="Relatório alterado em outro local"
        subtitle="Confira o que está no servidor antes de continuar."
        icon="alert"
        onClose={() => setServerConflict(undefined)}
        maxWidth={900}
      >
        <Text style={styles.muted}>
          Seu preenchimento está guardado no telefone. Se escolher usar esses dados, eles
          substituirão os campos do servidor no próximo envio. A sincronização ainda verifica se
          houve outra alteração depois desta conferência.
        </Text>
        {serverConflict && (
          <>
            <Text style={styles.label}>{serverConflict.title || 'Relatório sem título'}</Text>
            <Text style={styles.muted}>
              Versão {serverConflict.version} · {(serverConflict.points ?? []).length} pontos ·{' '}
              {(serverConflict.media ?? []).length} fotos
            </Text>
            <ReportSummary report={serverConflict} />
          </>
        )}
        <Button
          title="Usar meu preenchimento sobre esta versão"
          secondary
          disabled={
            editingBusy ||
            !localEntry ||
            !serverConflict ||
            !['DRAFT', 'IN_REVIEW'].includes(serverConflict.status)
          }
          onPress={() => {
            if (!localEntry || !serverConflict) return;
            const snapshot = serverConflict;
            void putLocalReport({
              ...localEntry,
              baseReport: snapshot,
              mutationId: newOfflineMutationId(),
              error: undefined,
            })
              .then(() => {
                loadedReportVersion.current = snapshot.id + ':' + snapshot.version;
                setServerConflict(undefined);
                setLocalMessage(
                  'Versão do servidor conferida. Revise seu preenchimento e toque em Sincronizar agora.',
                );
              })
              .catch(showSaveError);
          }}
        />
      </PickerSheet>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <View
          style={{
            flexDirection: 'row',
            gap: 4,
            padding: 8,
          }}
        >
          {stages.map((item, index) => (
            <Pressable
              key={item.title}
              accessibilityRole="button"
              accessibilityLabel={'Etapa ' + (index + 1) + ': ' + item.title}
              accessibilityState={selectionState(step === index, editingBusy)}
              aria-pressed={step === index}
              disabled={editingBusy}
              onPress={() => goToStep(index)}
              style={{
                flexDirection: 'row',
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                minHeight: 44,
                paddingHorizontal: 6,
                borderRadius: 8,
                backgroundColor: step === index ? t.colors.blueSoft : 'transparent',
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 7,
                  backgroundColor: step === index ? t.colors.primary : t.colors.soft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: t.fonts.bold,
                    fontSize: 10,
                    color: step === index ? 'white' : t.colors.muted,
                  }}
                >
                  {index + 1}
                </Text>
              </View>
              <Text
                style={{
                  color: step === index ? t.colors.blue : t.colors.muted,
                  fontFamily: step === index ? t.fonts.bold : t.fonts.medium,
                  fontSize: 11,
                }}
              >
                {item.title}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>
      <View style={[styles.row, { flexWrap: 'wrap', gap: 8 }]}>
        {sections.some((section) => section.content === 'points') && (
          <Button
            title="Pontos e fotos"
            icon="pin"
            small
            secondary
            disabled={editingBusy}
            onPress={() => {
              Keyboard.dismiss();
              openSection(sections.findIndex((section) => section.content === 'points'));
              setSectionNavigation((value) => value + 1);
            }}
          />
        )}
        <Button
          title="Todas as seções"
          icon="layers"
          small
          secondary
          disabled={editingBusy}
          onPress={() => setSectionPickerOpen(true)}
        />
      </View>
      <PickerSheet
        visible={sectionPickerOpen}
        title="Seções do relatório"
        subtitle={type.name + ' · ' + type.code}
        icon="report"
        onClose={() => setSectionPickerOpen(false)}
      >
        {orderedSections.map((section, index) => (
          <Button
            key={section.title}
            title={`${index + 1}. ${section.content === 'points' ? section.title + ' e fotos' : section.title}`}
            secondary
            onPress={() => {
              setSectionPickerOpen(false);
              openSection(sections.indexOf(section));
              setSectionNavigation((value) => value + 1);
            }}
          />
        ))}
      </PickerSheet>
      <Notice error={error} guidance={formErrorGuidance(error)} />
      <ReportSaveIssues
        issues={saveIssues}
        visible={issuesOpen}
        onClose={() => setIssuesOpen(false)}
        onOpen={() => setIssuesOpen(true)}
        onCorrect={correctIssue}
        onDownloadAsIs={canDownloadAsIs ? requestDownloadAsIs : undefined}
      />
      <PickerSheet
        visible={failureOpen}
        title="Não foi possível concluir"
        icon="alert"
        onClose={() => setFailureOpen(false)}
      >
        <Notice error={error} guidance={formErrorGuidance(error)} />
        <Text style={styles.muted}>
          Seu preenchimento continua nesta tela. Depois de resolver o aviso, tente a ação novamente.
        </Text>
        {canDownloadAsIs && (
          <>
            <Text style={styles.muted}>
              Você pode baixar o PDF com o preenchimento atual e as fotos do telefone. Antes de
              baixar, mostraremos qual ponto, campo ou foto apresentou problema e o que será
              incluído.
            </Text>
            <Button
              title="Baixar como está"
              icon="download"
              secondary
              onPress={requestDownloadAsIs}
            />
          </>
        )}
        <Button title="Voltar ao relatório" secondary onPress={() => setFailureOpen(false)} />
      </PickerSheet>
      {step === 0 && (reusable.length > 0 || autofillMessage) && (
        <Card>
          <PanelHeader
            title="Preenchimento rápido"
            subtitle={
              previousReport.data
                ? 'Últimos dados informados nesta obra para ' + type.name + '.'
                : undefined
            }
            icon="report"
          />
          {reusable.length > 0 && (
            <Button
              title={`Preencher ${reusable.length} campos vazios`}
              secondary
              icon="layers"
              disabled={editingBusy}
              onPress={fillFromPrevious}
            />
          )}
          <Text style={styles.muted} accessibilityLiveRegion="polite">
            {autofillMessage ||
              'Reaproveite os dados técnicos já salvos nos relatórios deste tipo e desta obra. Os campos já preenchidos serão mantidos.'}
          </Text>
        </Card>
      )}
      {step === 0 && (
        <Card style={reportPanelStyle(t, identityOpen)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Editar identificação do relatório"
            accessibilityState={{ expanded: identityOpen, disabled: editingBusy }}
            aria-expanded={identityOpen}
            disabled={editingBusy}
            onPress={() => {
              Keyboard.dismiss();
              setIdentityOpen(!identityOpen);
              setOpenSectionTitle(null);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}
          >
            <Icon name="report" color={t.colors.blue} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.text, { fontFamily: t.fonts.bold }]}>
                {watchedTitle || 'Identificação do relatório'}
              </Text>
              <Text style={styles.muted}>
                Título e data preenchidos · toque para editar ou informar o número
              </Text>
            </View>
            <Icon name={identityOpen ? 'minus' : 'plus'} />
          </Pressable>
          {identityOpen && (
            <>
              <View style={{ alignSelf: 'flex-start' }}>
                <Button
                  title="Preencher com dados da obra"
                  small
                  secondary
                  icon="folder"
                  disabled={editingBusy}
                  onPress={() => setReapply(true)}
                />
              </View>
              <FormGrid>
                <FormCell>
                  <View
                    ref={(view) => {
                      fieldViews.current['number'] = view;
                    }}
                  >
                    <Controller
                      name="number"
                      control={control}
                      render={({ field }) => (
                        <Field
                          label="Número do relatório"
                          required
                          placeholder="Identificação do relatório"
                          value={field.value}
                          onChangeText={field.onChange}
                          onBlur={field.onBlur}
                          error={errors.number?.message}
                          editable={canEdit('number')}
                        />
                      )}
                    />
                  </View>
                </FormCell>
                <FormCell>
                  <View
                    ref={(view) => {
                      fieldViews.current['reportDate'] = view;
                    }}
                  >
                    <Controller
                      name="reportDate"
                      control={control}
                      render={({ field }) => (
                        <DateField
                          label="Data do relatório"
                          value={field.value}
                          onChangeText={field.onChange}
                          onBlur={field.onBlur}
                          error={errors.reportDate?.message}
                          editable={canEdit('reportDate')}
                        />
                      )}
                    />
                  </View>
                </FormCell>
                <FormCell full>
                  <View
                    ref={(view) => {
                      fieldViews.current['title'] = view;
                    }}
                  >
                    <Controller
                      name="title"
                      control={control}
                      render={({ field }) => (
                        <Field
                          label={
                            isVisualWeldReport(type.code)
                              ? 'Título da linha / equipamento'
                              : 'Título'
                          }
                          placeholder={
                            isVisualWeldReport(type.code)
                              ? 'Ex.: LINHA RETORNO DE CIP'
                              : 'Identifique a inspeção de forma clara'
                          }
                          hint={
                            isVisualWeldReport(type.code)
                              ? 'Este nome aparece no centro da segunda página do PDF.'
                              : undefined
                          }
                          value={field.value}
                          onChangeText={field.onChange}
                          onBlur={field.onBlur}
                          error={errors.title?.message}
                          editable={canEdit('title')}
                        />
                      )}
                    />
                  </View>
                </FormCell>
              </FormGrid>
              <Button
                title="Pular identificação e ir para próxima seção"
                iconRight="arrow-right"
                secondary
                disabled={editingBusy}
                onPress={() => advanceSection()}
              />
            </>
          )}
        </Card>
      )}
      {step === 1 && (
        <Card>
          <PanelHeader
            title="Confira e salve"
            subtitle={watchedTitle || type.name}
            icon="check-circle"
          />
          <Text style={styles.muted}>
            {watchedPoints.length} pontos · {watchedDrawings.length} desenhos · {photoCount}{' '}
            {photoCount === 1 ? 'foto' : 'fotos'}
          </Text>
          <Text style={styles.muted}>
            Informe o resultado observado. Após salvar, a prévia em PDF fica disponível; o PDF final
            é liberado após a aprovação.
          </Text>
        </Card>
      )}
      <View style={{ gap: 14 }}>
        {sections
          .filter((section) => sectionStage(section) === step)
          .map((section) => (
            <View
              key={section.title}
              ref={(view) => {
                sectionViews.current[section.title] = view;
              }}
              style={[reportPanelStyle(t, isSectionOpen(section)), { overflow: 'hidden' }]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={'Abrir seção ' + section.title}
                accessibilityState={{ expanded: isSectionOpen(section), disabled: editingBusy }}
                aria-expanded={isSectionOpen(section)}
                disabled={editingBusy}
                onPress={() => {
                  Keyboard.dismiss();
                  const opening = !isSectionOpen(section);
                  setIdentityOpen(false);
                  setOpenSectionTitle(opening ? section.title : null);
                  if (opening) {
                    errorSection.current = section.title;
                    setSectionNavigation((n) => n + 1);
                  }
                }}
                style={{
                  padding: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: isSectionOpen(section) ? t.colors.blueSoft : t.colors.surface,
                }}
              >
                <Icon
                  name={
                    section.content === 'drawings'
                      ? 'pipe'
                      : section.content === 'points'
                        ? 'pin'
                        : 'report'
                  }
                  size={20}
                  color={t.colors.blue}
                />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text
                    style={{
                      color: t.colors.blue,
                      fontFamily: t.fonts.bold,
                      fontSize: 10,
                      letterSpacing: 1,
                    }}
                  >
                    ETAPA{' '}
                    {String(
                      orderedSections.findIndex((item) => item.title === section.title) + 1,
                    ).padStart(2, '0')}
                  </Text>
                  <Text style={[styles.text, { fontFamily: t.fonts.bold }]}>{section.title}</Text>
                  <Text style={[styles.muted, { fontSize: 12 }]}>{sectionSummary(section)}</Text>
                </View>
                <Icon
                  name={isSectionOpen(section) ? 'minus' : 'plus'}
                  size={18}
                  color={t.colors.blue}
                />
              </Pressable>
              {isSectionOpen(section) && (
                <View style={{ padding: 20, gap: 22 }}>
                  {correction &&
                    section.content === correction.path[0] &&
                    section.content !== 'points' && (
                      <Notice
                        error={new Error(correction.label + ': ' + correction.message)}
                        guidance={correction.guidance}
                      />
                    )}
                  {section.content === 'points' ? (
                    <ReportPoints
                      control={control}
                      code={type.code}
                      editable={canEdit('points')}
                      errors={errors}
                      correction={correction}
                      photoDraftKey={photoDraftKey}
                      projectId={projectId}
                      report={report}
                      canUploadPhotos={!editingBusy && user.permissions.includes('media.upload')}
                      canRemovePhotos={!editingBusy && user.permissions.includes('media.delete')}
                      onPickingChange={setPickingPhoto}
                      drawings={watchedDrawings}
                      canEditDrawings={drawingEditable}
                      onDrawingsChange={(drawings) =>
                        setValue('drawings', drawings, { shouldDirty: true })
                      }
                    />
                  ) : section.content === 'signatures' ? (
                    <ReportSigners
                      control={control}
                      editable={canEdit('signatures')}
                      errors={errors}
                      correction={correction}
                      reportDate={getValues('reportDate')}
                      setValue={setValue}
                      previousSignatures={previousReport.data?.signatures}
                    />
                  ) : section.content === 'inspectionRecords' ? (
                    <Controller
                      control={control}
                      name="specificData.inspectionRecords"
                      render={({ field }) => (
                        <VisualInspectionRecords
                          value={(field.value ?? []) as VisualInspectionRecord[]}
                          onChange={field.onChange}
                          editable={canEdit('specificData.inspectionRecords')}
                          correction={correction}
                        />
                      )}
                    />
                  ) : section.content === 'discontinuities' ? (
                    <Controller
                      control={control}
                      name="specificData.discontinuities"
                      render={({ field }) => (
                        <Discontinuities
                          correction={correction}
                          value={(field.value ?? []) as { code: string; description?: string }[]}
                          onChange={field.onChange}
                          editable={canEdit('specificData.discontinuities')}
                        />
                      )}
                    />
                  ) : section.content === 'drawings' ? (
                    <Controller
                      control={control}
                      name="drawings"
                      render={({ field }) => (
                        <DrawingEditor
                          reportId={report?.id}
                          media={report?.media}
                          photoDraftKey={photoDraftKey}
                          canUploadImages={
                            !editingBusy && user.permissions.includes('media.upload')
                          }
                          savedVersion={report?.version}
                          correction={correction}
                          value={field.value}
                          points={watchedPoints}
                          onChange={field.onChange}
                          onPointsChange={(points) =>
                            setValue('points', points, { shouldDirty: true })
                          }
                          editable={drawingEditable}
                          canEditPoints={canEdit('points')}
                          pointPhotoCount={(key) =>
                            (report?.media ?? []).filter(
                              (photo) =>
                                photo.reportPointId === key &&
                                !photoDrafts.removedIds.includes(photo.id),
                            ).length +
                            photoDrafts.photos.filter((photo) => photo.pointKey === key).length
                          }
                          onRemovePoint={(key) => removeDrawingPoints([key])}
                          onRemovePoints={removeDrawingPoints}
                          measurement={type.code === 'ME'}
                        />
                      )}
                    />
                  ) : null}
                  <FormGrid>
                    {section.fields.map((item) => (
                      <FormCell
                        key={item.path}
                        full={item.kind === 'long' || item.kind === 'result'}
                      >
                        <View
                          ref={(view) => {
                            fieldViews.current['specificData.' + item.path] = view;
                          }}
                        >
                          <Controller
                            control={control}
                            name={('specificData.' + item.path) as `specificData.${string}`}
                            render={({ field }) =>
                              type.code === 'LP' &&
                              ['penetrantType', 'removalTechnique'].includes(item.path) ? (
                                <LpTechniqueField
                                  kind={item.path === 'penetrantType' ? 'penetrant' : 'removal'}
                                  value={String(field.value ?? '')}
                                  editable={canEdit('specificData.' + item.path)}
                                  error={
                                    getFieldState(
                                      ('specificData.' + item.path) as `specificData.${string}`,
                                    ).error?.message
                                  }
                                  onChange={(value) => {
                                    editedSetupPaths.current.add(item.path);
                                    field.onChange(value);
                                  }}
                                />
                              ) : item.kind === 'result' ? (
                                <SelectField
                                  label={item.label}
                                  value={String(field.value ?? '')}
                                  options={resultOptions}
                                  onChange={(value) => {
                                    editedSetupPaths.current.add(item.path);
                                    field.onChange(value);
                                  }}
                                  disabled={!canEdit('specificData.' + item.path)}
                                  icon="check-circle"
                                  error={
                                    getFieldState(
                                      ('specificData.' + item.path) as `specificData.${string}`,
                                    ).error?.message
                                  }
                                />
                              ) : item.kind === 'date' ? (
                                <DateField
                                  label={item.label}
                                  value={String(field.value ?? '')}
                                  onChangeText={(value) => {
                                    editedSetupPaths.current.add(item.path);
                                    field.onChange(value);
                                  }}
                                  onBlur={field.onBlur}
                                  error={
                                    getFieldState(
                                      ('specificData.' + item.path) as `specificData.${string}`,
                                    ).error?.message
                                  }
                                  editable={canEdit('specificData.' + item.path)}
                                />
                              ) : (
                                <Field
                                  label={item.label}
                                  value={
                                    typeof field.value === 'string'
                                      ? field.value
                                      : field.value === undefined
                                        ? ''
                                        : String(field.value)
                                  }
                                  onChangeText={(value) => {
                                    editedSetupPaths.current.add(item.path);
                                    const kind = config.customFields?.[item.path];
                                    field.onChange(
                                      kind === 'number' && value
                                        ? Number(value)
                                        : kind === 'boolean'
                                          ? value === 'true'
                                          : value,
                                    );
                                  }}
                                  onBlur={field.onBlur}
                                  error={
                                    getFieldState(
                                      ('specificData.' + item.path) as `specificData.${string}`,
                                    ).error?.message
                                  }
                                  multiline={item.kind === 'long'}
                                  placeholder={
                                    item.kind === 'long'
                                      ? 'Registre as informações da inspeção…'
                                      : undefined
                                  }
                                  editable={canEdit('specificData.' + item.path)}
                                />
                              )
                            }
                          />
                        </View>
                      </FormCell>
                    ))}
                  </FormGrid>
                  <View style={{ gap: 8 }}>
                    {nextSection(section) && (
                      <Text style={styles.muted}>Próxima: {nextSection(section)!.title}</Text>
                    )}
                    <Button
                      title={
                        nextSection(section) ? 'Pular para próxima seção' : 'Fechar seção e revisar'
                      }
                      iconRight={nextSection(section) ? 'arrow-right' : 'check'}
                      secondary
                      disabled={editingBusy}
                      onPress={() => advanceSection(section)}
                    />
                  </View>
                </View>
              )}
            </View>
          ))}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
            padding: 18,
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: t.colors.soft,
            borderTopWidth: 1,
            borderColor: t.colors.line,
          }}
        >
          <Text style={[styles.muted, { fontSize: 11 }]}>Etapa {step + 1} de 2</Text>
          <View style={[styles.row, { gap: 8, flexWrap: 'wrap', flexShrink: 1, maxWidth: '100%' }]}>
            {step > 0 && (
              <Button
                title="Voltar à inspeção"
                secondary
                small
                icon="arrow-left"
                disabled={editingBusy || step === 0}
                onPress={() => goToStep(step - 1)}
              />
            )}
            {step === 0 ? (
              <Button
                title="Ir para conclusão"
                small
                iconRight="arrow-right"
                disabled={editingBusy || step >= stages.length - 1}
                onPress={() => goToStep(step + 1)}
              />
            ) : null}
          </View>
        </View>
      </View>
      {step === 1 && (
        <View ref={conclusionActions}>
          <ReportActions
            report={report}
            save={save}
            prepareCurrentPdf={async (options) => {
              const values = getValues();
              await saveOnPhone(values).catch(offlineStorageFailure);
              return prepareCurrentReportPdf(report!.id, values, photoDraftKey, options);
            }}
            hasChanges={hasChanges}
            busy={pickingPhoto || saving}
            creating={!initialReport}
            onBusyChange={setActing}
            onError={showSaveError}
            allowDownloadAsIs={
              !!error || saveIssues.length > 0 || !!photoDrafts.error || !!localEntry?.error
            }
            downloadAsIsRequest={downloadAsIsRequest}
            onDownloadAsIsHandled={() => setDownloadAsIsRequest(0)}
          />
        </View>
      )}
      <ConfirmDialog
        visible={reapply}
        title="Preencher com dados da obra?"
        description="Os campos com dados-base cadastrados serão atualizados neste formulário. Laudos, resultados, pontos e imagens serão preservados. Você poderá editar tudo novamente antes de salvar."
        confirmLabel="Preencher campos"
        onClose={() => setReapply(false)}
        onConfirm={reapplyDefaults}
      />
    </View>
  );
}
