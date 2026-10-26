import { useTheme } from '../../utils/theme';
import { reportPanelStyle } from './report-panel-style';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Keyboard } from 'react-native';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ZodError } from 'zod';
import {
  reportConfigSchema,
  reportCreateSchema,
  reportUpdateSchema,
  validateSpecificData,
  buildReportDefaults,
  pointKey,
  type Report,
  type ReportType,
  type Paginated,
} from '@weldcosta/shared';
import { api, jsonBody } from '../../services/api';
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
import { ReportActions } from './report-actions';
import { emptyPhotoDrafts, saveReportPhotos, useReportPhotoDrafts } from './report-photo-drafts';
import { reusableReportFields, recentReportDefaults } from './report-autofill';
import { shouldApplyReportSnapshot } from './report-snapshot';
import { TransferOverlay, type TransferState } from '../../components/transfer-progress';
import {
  apiValidationIssues,
  formErrorGuidance,
  type ValidationIssue,
} from '../../utils/form-feedback';
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
function clean(value: unknown): unknown {
  if (value === '') return undefined;
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, child]) => [key, clean(child)])
        .filter(([, child]) => child !== undefined),
    );
  return value;
}
export function ReportForm({
  type,
  report: initialReport,
  companyId,
  projectId,
  onDirtyChange,
  initialData = {},
  initialTitle = '',
}: {
  type: ReportType;
  report?: Report;
  companyId: string;
  projectId: string;
  onDirtyChange?(dirty: boolean): void;
  initialData?: Record<string, unknown>;
  initialTitle?: string;
}) {
  const [createdReport, setCreatedReport] = useState<Report>();
  const report = initialReport ?? createdReport;
  const { tokens: t, styles } = useTheme();
  const { etapa } = useLocalSearchParams<{ etapa?: string }>();
  const [step, setStep] = useState(etapa === 'conclusao' || etapa === '2' ? 1 : 0),
    [error, setError] = useState<unknown>(),
    client = useQueryClient(),
    user = useAuth((state) => state.session!.user);
  const photoDraftKey = user.id + ':' + (report?.id ?? 'new-' + projectId + '-' + type.id);
  const photoDrafts = useReportPhotoDrafts(
    (state) => state.reports[photoDraftKey] ?? emptyPhotoDrafts,
  );
  const hasPhotoDrafts = !!(
    photoDrafts.photos.length ||
    photoDrafts.removedIds.length ||
    Object.keys(photoDrafts.captionEdits ?? {}).length
  );
  const photoCount =
    (report?.media ?? []).filter((photo) => !photoDrafts.removedIds.includes(photo.id)).length +
    photoDrafts.photos.length;
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [transferProgress, setTransferProgress] = useState<TransferState>();
  const [autofillMessage, setAutofillMessage] = useState('');
  const autoFilled = useRef(false);
  const editedSetupPaths = useRef(new Set<string>());
  const loadedReportVersion = useRef<string | undefined>(undefined);
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
  const reveal = usePageScroll();
  const formTop = useRef<View>(null);
  const conclusionActions = useRef<View>(null);
  const [sectionNavigation, setSectionNavigation] = useState(0);
  const previousReveal = useRef({ step, error, sectionNavigation });
  const sectionViews = useRef<Record<string, View | null>>({});
  const errorSection = useRef<string | undefined>(undefined);
  const [openSectionTitle, setOpenSectionTitle] = useState<string | null>();
  const editingBusy = pickingPhoto || saving || acting;
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
  type Section = ReportSection & {
    content?: 'points' | 'discontinuities' | 'signatures' | 'drawings';
  };
  const sections: Section[] = [...baseSections];
  const beforeConclusion = sections.findIndex(
    (section) => section.title === 'Laudo' || section.title === 'Observação',
  );
  sections.splice(
    beforeConclusion < 0 ? sections.length : beforeConclusion,
    0,
    ...(type.code === 'LP'
      ? [{ title: 'Descontinuidades', fields: [], content: 'discontinuities' as const }]
      : []),
    { title: 'Desenho técnico', fields: [], content: 'drawings' },
    ...(['EVS', 'LP', 'TH', 'ME', 'RDO'].includes(type.code)
      ? [
          {
            title: type.code === 'ME' ? 'Pontos de medição' : 'Pontos de solda',
            fields: [],
            content: 'points' as const,
          },
        ]
      : []),
  );
  sections.push({ title: 'Responsáveis', fields: [], content: 'signatures' });
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
    setValue,
    formState: { isDirty, errors },
  } = useForm<Values>({
    defaultValues: {
      number: '',
      title: initialTitle,
      reportDate: todayISO(),
      specificData: withFieldDefaults(
        {
          ...(type.code === 'LP' ? { discontinuities: [] } : {}),
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
  const hasChanges = isDirty || hasPhotoDrafts;
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
    useReportPhotoDrafts.getState().update(photoDraftKey, () => emptyPhotoDrafts);
  }, [photoDraftKey]);
  useUnsavedChanges(hasChanges || editingBusy, discardPhotos);
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
  const showIssues = (issues: ValidationIssue[], specificData = false) => {
    const technicalFields = sections.flatMap((section) => section.fields);
    const normalized = issues.map((issue) => {
      const path = issue.path.map(String);
      if (specificData || technicalFields.some((field) => field.path === path.join('.')))
        path.unshift('specificData');
      return { ...issue, path };
    });
    const labels: Record<string, string> = {
      number: 'Número',
      title: 'Título',
      reportDate: 'Data do relatório',
      name: 'Nome',
      value: 'Leitura',
      unit: 'Unidade',
      dimension: 'Dimensão',
      signedAt: 'Data da assinatura',
      label: 'Identificação',
      discontinuity: 'Descontinuidade',
      acceptable: 'Aceitável',
      points: 'Pontos',
      drawings: 'Desenhos',
      signatures: 'Responsáveis',
    };
    const messages = normalized.map(({ path, message }) => {
      const key = path.join('.');
      const technical = technicalFields.find((field) => 'specificData.' + field.path === key);
      const date =
        path[0] === 'reportDate' || path.at(-1) === 'signedAt' || technical?.kind === 'date';
      const detail = date ? 'Informe uma data válida em DD/MM/AAAA.' : message;
      const label = technical?.label ?? labels[path.at(-1) ?? ''] ?? 'Dados do relatório';
      const prefix =
        path.length < 2
          ? ''
          : path[0] === 'points'
            ? 'Ponto ' +
              (getValues('points')[Number(path[1])]?.number || Number(path[1]) + 1) +
              ' · '
            : path[0] === 'signatures'
              ? 'Responsável ' + (Number(path[1]) + 1) + ' · '
              : path[0] === 'drawings'
                ? 'Desenho ' + (Number(path[1]) + 1) + ' · '
                : '';
      setFieldError(key as 'number' | 'title' | 'reportDate', {
        type: 'validation',
        message: detail,
      });
      return prefix + label + ': ' + detail;
    });
    setError(new Error(messages.join('\n')));
    const first = normalized[0]?.path ?? [];
    const target = sections.findIndex((section) =>
      section.content
        ? section.content === first[0]
        : section.fields.some(
            (field) => first[0] === 'specificData' && field.path === first.slice(1).join('.'),
          ),
    );
    if (target >= 0) openSection(target);
    else {
      setIdentityOpen(true);
      setOpenSectionTitle(null);
      setStep(0);
    }
  };
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
      if (hasPhotoDrafts)
        setTransferProgress({
          message: 'Salvando dados do relatório…',
          completed: 0,
          total: photoDrafts.photos.length,
        });
    },
    mutationFn: async (data: Values) => {
      const pendingPhotos =
        useReportPhotoDrafts.getState().reports[photoDraftKey] ?? emptyPhotoDrafts;
      const removePointMediaIds = (report?.media ?? [])
        .filter(
          (photo) =>
            photo.reportPointId &&
            pendingPhotos.removedIds.includes(photo.id) &&
            !data.points.some((point) => point.id === photo.reportPointId),
        )
        .map((photo) => photo.id);
      const saved = await api<Report>(
        report ? '/reports/' + report.id : '/reports',
        jsonBody(report ? 'PUT' : 'POST', {
          ...data,
          reportDate: data.reportDate || null,
          specificData: clean(data.specificData),
          points: canEditPath('points') ? clean(data.points) : undefined,
          signatures: canEditPath('signatures') ? clean(data.signatures) : undefined,
          drawings: user.permissions.includes('drawing.edit') ? data.drawings : undefined,
          ...(report
            ? {
                version: Number(loadedReportVersion.current?.split(':').at(-1) ?? report.version),
                ...(removePointMediaIds.length ? { removePointMediaIds } : {}),
              }
            : { reportTypeId: type.id, companyId, projectId, prefillFromProject: false }),
        }),
      );
      if (removePointMediaIds.length)
        useReportPhotoDrafts.getState().update(photoDraftKey, (draft) => ({
          ...draft,
          removedIds: draft.removedIds.filter((id) => !removePointMediaIds.includes(id)),
          captionEdits: Object.fromEntries(
            Object.entries(draft.captionEdits ?? {}).filter(
              ([id]) => !removePointMediaIds.includes(id),
            ),
          ),
        }));
      return saveReportPhotos(
        photoDraftKey,
        saved,
        data.points,
        hasPhotoDrafts ? setTransferProgress : undefined,
      );
    },
    onSuccess: async (saved) => {
      acceptedSaveVersion.current = saved.id + ':' + saved.version;
      if (!initialReport) setCreatedReport(saved);
      client.setQueryData(['report', saved.id], saved);
      await client.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'report' });
    },
    onError: (cause) => {
      const issues = apiValidationIssues(cause);
      if (issues.length) showIssues(issues);
      else setError(cause);
    },
    onSettled: () => {
      setSaving(false);
      setTransferProgress(undefined);
    },
  });
  const save = async () => {
    let saved: Report | undefined;
    await handleSubmit(async (data) => {
      setError(undefined);
      clearErrors();
      const body = {
        ...data,
        reportDate: data.reportDate || null,
        specificData: clean(data.specificData),
        points: clean(data.points),
        signatures: clean(data.signatures),
      };
      const common = report
        ? reportUpdateSchema.safeParse({ ...body, version: report.version })
        : reportCreateSchema.safeParse({ ...body, reportTypeId: type.id, companyId, projectId });
      if (!common.success) {
        showIssues(common.error.issues);
        return;
      }
      try {
        validateSpecificData(type.code, body.specificData, 'draft', type.config);
      } catch (cause) {
        if (cause instanceof ZodError) showIssues(cause.issues, true);
        else setError(cause);
        return;
      }
      saved = await mutation.mutateAsync(data).catch(() => undefined);
    })();
    return saved;
  };
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
      <Notice error={error} guidance={formErrorGuidance(error)} />
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
                </FormCell>
                <FormCell>
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
                </FormCell>
                <FormCell full>
                  <Controller
                    name="title"
                    control={control}
                    render={({ field }) => (
                      <Field
                        label={type.code === 'EVS' ? 'Título da linha / equipamento' : 'Título'}
                        placeholder={
                          type.code === 'EVS'
                            ? 'Ex.: LINHA RETORNO DE CIP'
                            : 'Identifique a inspeção de forma clara'
                        }
                        hint={
                          type.code === 'EVS'
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
                  {section.content === 'points' ? (
                    <ReportPoints
                      control={control}
                      code={type.code}
                      editable={canEdit('points')}
                      errors={errors}
                      photoDraftKey={photoDraftKey}
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
                      reportDate={getValues('reportDate')}
                      setValue={setValue}
                      previousSignatures={previousReport.data?.signatures}
                    />
                  ) : section.content === 'discontinuities' ? (
                    <Controller
                      control={control}
                      name="specificData.discontinuities"
                      render={({ field }) => (
                        <Discontinuities
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
                        <Controller
                          control={control}
                          name={('specificData.' + item.path) as `specificData.${string}`}
                          render={({ field }) =>
                            item.kind === 'result' ? (
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
            hasChanges={hasChanges}
            busy={pickingPhoto || saving}
            creating={!initialReport}
            onBusyChange={setActing}
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
