import type { CorrectionRequest } from './report-save-feedback';
import { useTheme } from '../../utils/theme';
import { reportPanelStyle } from './report-panel-style';
import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Switch, Keyboard, type ViewInstance } from 'react-native';
import {
  Controller,
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormSetValue,
} from 'react-hook-form';
import type { Report, ReportPoint, ReportSigner } from '@weldcosta/shared';
import {
  nextPointNumber,
  pointKey,
  removePointFromDrawings,
  type ReportDrawing,
} from '@weldcosta/shared';
import { pointBatch } from './report-autofill';
import { useAuth } from '../../stores/auth';
import {
  Field,
  Button,
  FormGrid,
  FormCell,
  PanelHeader,
  Card,
  Badge,
  Notice,
} from '../../components/ui';
import { SelectField } from '../../components/select-field';
import { DateField } from '../../components/date-field';
import { PickerSheet } from '../../components/picker-sheet';
import { Icon } from '../../components/icon';
import { PointPhotos } from './point-photos';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { usePageScroll } from '../../components/page-scroll';
import { emptyPhotoDrafts, useReportPhotoDrafts } from './report-photo-drafts';
import { PersonForm, PersonPicker, personSigner } from '../people/people';
import { usePermission } from '../../hooks/use-permission';
import { SignatureField } from '../people/signature-field';
export interface ReportFormValues {
  number: string;
  title: string;
  reportDate: string;
  specificData: Record<string, unknown>;
  points: ReportPoint[];
  signatures: ReportSigner[];
  drawings: ReportDrawing[];
}
const acceptableOptions = [
  { value: '', label: 'Não informado' },
  { value: 'true', label: 'Sim', icon: 'check-circle' as const, tone: 'green' as const },
  { value: 'false', label: 'Não', icon: 'alert' as const, tone: 'danger' as const },
];
function MeasurementInput({
  value,
  onChange,
  editable,
  error,
}: {
  value: number | null | undefined;
  onChange(value: unknown): void;
  editable: boolean;
  error?: string;
}) {
  const [draft, setDraft] = useState(value == null ? '' : String(value)),
    [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(value == null ? '' : String(value));
  }, [value, focused]);
  return (
    <Field
      label="Leitura"
      keyboardType="decimal-pad"
      value={draft}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      editable={editable}
      error={error}
      onChangeText={(text) => {
        setDraft(text);
        const normalized = text.replace(',', '.');
        onChange(
          text === ''
            ? null
            : /^\d+(\.\d*)?$/.test(normalized) && Number.isFinite(Number(normalized))
              ? Number(normalized)
              : text,
        );
      }}
    />
  );
}
export function ReportPoints({
  control,
  code,
  editable,
  errors,
  correction,
  photoDraftKey,
  report,
  canUploadPhotos,
  canRemovePhotos,
  onPickingChange,
  drawings,
  canEditDrawings,
  onDrawingsChange,
}: {
  control: Control<ReportFormValues>;
  code: string;
  editable: boolean;
  errors: FieldErrors<ReportFormValues>;
  correction?: CorrectionRequest;
  photoDraftKey: string;
  report?: Report;
  canUploadPhotos: boolean;
  canRemovePhotos: boolean;
  onPickingChange(busy: boolean): void;
  drawings: ReportDrawing[];
  canEditDrawings: boolean;
  onDrawingsChange(drawings: ReportDrawing[]): void;
}) {
  const { tokens: t, styles } = useTheme();
  const [expandedPoint, setExpandedPoint] = useState<number | null>(0);
  const [details, setDetails] = useState<Record<string, boolean>>({});
  const [firstNumberOpen, setFirstNumberOpen] = useState(false);
  const [firstNumber, setFirstNumber] = useState('1');
  const [repeatPrevious, setRepeatPrevious] = useState(true);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchCount, setBatchCount] = useState('5');
  const [batchError, setBatchError] = useState<unknown>();
  const [error, setError] = useState<unknown>();
  const [removingKey, setRemovingKey] = useState<string>();
  const [finishing, setFinishing] = useState<{ key: string; add: boolean }>();
  const headers = useRef<Record<string, ViewInstance | null>>({});
  const revealPending = useRef(false);
  const reveal = usePageScroll();
  const values = useWatch({ control, name: 'points' });
  const specificData = useWatch({ control, name: 'specificData' });
  const draft = useReportPhotoDrafts((state) => state.reports[photoDraftKey] ?? emptyPhotoDrafts);
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'points',
    keyName: '_formKey',
  });
  const measurement = code === 'ME';
  const invalidPointIndexes = Object.keys(errors.points ?? {})
    .filter((key) => /^\d+$/.test(key))
    .join(',');
  const previousInvalidPoints = useRef<string[]>([]);
  useEffect(() => {
    const indexes = invalidPointIndexes ? invalidPointIndexes.split(',') : [];
    const hasNewErrors = indexes.some((index) => !previousInvalidPoints.current.includes(index));
    previousInvalidPoints.current = indexes;
    if (!hasNewErrors) return;
    // Reveal one invalid point; the remaining errors stay signalled in their headers.
    revealPending.current = true;
    setExpandedPoint(Number(indexes[0]));
  }, [invalidPointIndexes]);
  useEffect(() => {
    if (!revealPending.current) return;
    const timer = setTimeout(() => {
      const field = fields[expandedPoint ?? fields.length - 1];
      if (field) reveal(headers.current[field._formKey]);
      revealPending.current = false;
    }, 160);
    return () => clearTimeout(timer);
  }, [expandedPoint, fields, reveal]);
  useEffect(() => {
    if (correction?.path[0] !== 'points') return;
    const index = Number(correction.path[1]);
    if (!Number.isInteger(index) || !fields[index]) return;
    revealPending.current = true;
    setExpandedPoint(index);
    const timer = setTimeout(() => reveal(headers.current[fields[index]!._formKey]), 300);
    return () => clearTimeout(timer);
  }, [correction, fields, reveal]);
  const photoCount = (key: string) =>
    (report?.media ?? []).filter(
      (photo) => photo.reportPointId === key && !draft.removedIds.includes(photo.id),
    ).length + draft.photos.filter((photo) => photo.pointKey === key).length;
  const advance = (key: string, add: boolean) => {
    if (!editable) return;
    const index = values.findIndex((point) => pointKey(point) === key);
    if (index < 0) return;
    Keyboard.dismiss();
    revealPending.current = true;
    if (index < values.length - 1) setExpandedPoint(index + 1);
    else if (add) appendPoint(nextPointNumber(values));
    else setExpandedPoint(null);
  };
  const finish = (key: string, add = false) => {
    if (photoCount(key) < 2) {
      Keyboard.dismiss();
      setFinishing({ key, add });
    } else advance(key, add);
  };
  const removingIndex = values.findIndex((point) => pointKey(point) === removingKey);
  const removingPoint = values[removingIndex];
  const linkedMarks = drawings.reduce(
    (count, drawing) =>
      count +
      drawing.data.elements.filter((e) => e.type === 'point' && e.reportPointId === removingKey)
        .length,
    0,
  );
  const confirmPointRemoval = (keepInDrawing: boolean) => {
    if (!editable || !removingPoint || !removingKey) return;
    const mediaIds = (report?.media ?? [])
      .filter((photo) => photo.reportPointId === removingKey)
      .map((photo) => photo.id);
    if ((linkedMarks && !canEditDrawings) || (mediaIds.length && !canRemovePhotos)) {
      setError(
        new Error(
          'Você precisa de permissão para remover as fotos e editar as marcações vinculadas.',
        ),
      );
      setRemovingKey(undefined);
      return;
    }
    if (linkedMarks)
      onDrawingsChange(removePointFromDrawings(drawings, removingPoint, keepInDrawing));
    useReportPhotoDrafts.getState().update(photoDraftKey, (draft) => ({
      ...draft,
      photos: draft.photos.filter((photo) => photo.pointKey !== removingKey),
      removedIds: [...new Set([...draft.removedIds, ...mediaIds])],
      annotationEdits: Object.fromEntries(
        Object.entries(draft.annotationEdits ?? {}).filter(([id]) => !mediaIds.includes(id)),
      ),
      captionEdits: Object.fromEntries(
        Object.entries(draft.captionEdits ?? {}).filter(([id]) => !mediaIds.includes(id)),
      ),
    }));
    remove(removingIndex);
    revealPending.current = true;
    setExpandedPoint(Math.max(0, Math.min(removingIndex, fields.length - 2)));
    setRemovingKey(undefined);
  };
  const appendPoint = (number: string) => {
    try {
      const point = pointBatch(
        values,
        measurement,
        1,
        repeatPrevious,
        number,
        String(specificData.projectThickness || ''),
      )[0]!;
      setError(undefined);
      revealPending.current = true;
      setExpandedPoint(fields.length);
      append(point);
      return true;
    } catch (cause) {
      setError(cause);
      return false;
    }
  };
  const addPoint = () => {
    if (!fields.length) {
      setFirstNumber('1');
      setFirstNumberOpen(true);
    } else appendPoint(nextPointNumber(values));
  };
  return (
    <View style={{ gap: 16 }}>
      <PanelHeader
        title={measurement ? 'Pontos de medição' : 'Pontos de solda'}
        subtitle="Preencha os dados e adicione as fotos no mesmo ponto. Ao criar o próximo, o anterior fica recolhido."
        action={
          editable ? (
            <Button small secondary icon="plus" title="Adicionar ponto" onPress={addPoint} />
          ) : undefined
        }
      />
      <Notice error={error} />
      {editable && (
        <View style={{ gap: 10 }}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Text style={[styles.muted, { flex: 1 }]}>
              Repetir identificação, dimensão e unidade do ponto anterior
            </Text>
            <Switch
              accessibilityLabel="Repetir dados do ponto anterior"
              value={repeatPrevious}
              onValueChange={setRepeatPrevious}
            />
          </View>
          <Button
            title="Criar vários pontos"
            small
            secondary
            icon="plus"
            onPress={() => {
              setFirstNumber(nextPointNumber(values));
              setBatchError(undefined);
              setBatchOpen(true);
            }}
          />
        </View>
      )}
      {!fields.length && (
        <Text style={styles.muted}>Comece informando o número da primeira solda ou medição.</Text>
      )}
      {fields.map((point, index) => {
        const value = values[index],
          key = pointKey(value ?? point);
        const open = expandedPoint === index;
        const hasError = !!errors.points?.[index];
        const photos =
          (report?.media ?? []).filter(
            (photo) => photo.reportPointId === key && !draft.removedIds.includes(photo.id),
          ).length + draft.photos.filter((photo) => photo.pointKey === key).length;
        return (
          <Card
            key={point._formKey}
            style={[reportPanelStyle(t, open), { padding: 0, overflow: 'hidden' }]}
          >
            <Pressable
              ref={(node) => {
                headers.current[point._formKey] = node;
              }}
              accessibilityRole="button"
              accessibilityLabel={
                open ? 'Recolher ponto' : 'Abrir ponto ' + (value?.number || index + 1)
              }
              accessibilityState={{ expanded: open }}
              aria-expanded={open}
              onPress={() => {
                Keyboard.dismiss();
                if (!open) revealPending.current = true;
                setExpandedPoint(open ? null : index);
              }}
              style={{
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: open ? t.colors.blueSoft : t.colors.surface,
              }}
            >
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={[styles.text, { fontFamily: t.fonts.bold }]}>
                  {(measurement ? 'Medição ' : 'Ponto / solda ') + (value?.number || index + 1)}
                </Text>
                <Text style={[styles.muted, { fontSize: 11 }]}>
                  {[
                    value?.label,
                    measurement && value?.value != null
                      ? String(value.value) + ' ' + (value.unit ?? '')
                      : value?.data?.dimension,
                    photos + (photos === 1 ? ' foto' : ' fotos'),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Badge
                label={
                  hasError
                    ? 'Revisar campos'
                    : value?.data?.acceptable === true
                      ? 'Aceitável'
                      : value?.data?.acceptable === false
                        ? 'Não aceitável'
                        : 'Pendente'
                }
                tone={
                  hasError
                    ? 'danger'
                    : value?.data?.acceptable === true
                      ? 'green'
                      : value?.data?.acceptable === false
                        ? 'danger'
                        : 'blue'
                }
                dot={false}
              />
              <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
                <Icon name="chevron-down" size={18} color={t.colors.blue} />
              </View>
            </Pressable>
            {open && (
              <View style={{ padding: 18, paddingTop: 4, gap: 16 }}>
                {correction?.path[0] === 'points' && Number(correction.path[1]) === index && (
                  <Notice
                    error={new Error(correction.label + ': ' + correction.message)}
                    guidance={correction.guidance}
                  />
                )}
                <FormGrid>
                  <FormCell>
                    <Controller
                      control={control}
                      name={`points.${index}.number`}
                      render={({ field, fieldState }) => (
                        <Field
                          error={fieldState.error?.message}
                          label="Número do ponto / solda"
                          value={field.value}
                          onChangeText={field.onChange}
                          editable={editable}
                          maxLength={100}
                        />
                      )}
                    />
                  </FormCell>
                  <FormCell>
                    <Controller
                      control={control}
                      name={`points.${index}.label`}
                      render={({ field, fieldState }) => (
                        <Field
                          error={fieldState.error?.message}
                          label={measurement ? 'Lado / parte do equipamento' : 'Identificação'}
                          value={field.value ?? ''}
                          onChangeText={field.onChange}
                          editable={editable}
                          maxLength={500}
                        />
                      )}
                    />
                  </FormCell>
                  <FormCell>
                    {measurement ? (
                      <Controller
                        control={control}
                        name={`points.${index}.value`}
                        render={({ field, fieldState }) => (
                          <MeasurementInput
                            error={fieldState.error?.message}
                            value={field.value}
                            onChange={field.onChange}
                            editable={editable}
                          />
                        )}
                      />
                    ) : (
                      <Controller
                        control={control}
                        name={`points.${index}.data.dimension`}
                        render={({ field, fieldState }) => (
                          <Field
                            error={fieldState.error?.message}
                            label="Dimensão"
                            value={field.value ?? ''}
                            onChangeText={field.onChange}
                            editable={editable}
                            placeholder={'Ex.: 4"'}
                          />
                        )}
                      />
                    )}
                  </FormCell>
                  <FormCell>
                    <Controller
                      control={control}
                      name={`points.${index}.data.discontinuity`}
                      render={({ field, fieldState }) => (
                        <Field
                          error={fieldState.error?.message}
                          label="Descontinuidade"
                          value={field.value ?? ''}
                          onChangeText={field.onChange}
                          editable={editable}
                          placeholder="Ex.: Sem indicação"
                        />
                      )}
                    />
                  </FormCell>
                  <FormCell>
                    <Controller
                      control={control}
                      name={`points.${index}.data.acceptable`}
                      render={({ field, fieldState }) => (
                        <SelectField
                          error={fieldState.error?.message}
                          label="Aceitável"
                          value={field.value === undefined ? '' : String(field.value)}
                          options={acceptableOptions}
                          onChange={(value) =>
                            field.onChange(value === '' ? undefined : value === 'true')
                          }
                          disabled={!editable}
                        />
                      )}
                    />
                  </FormCell>
                </FormGrid>
                <PointPhotos
                  draftKey={photoDraftKey}
                  pointId={key}
                  persistedPointId={value?.id}
                  number={value?.number || String(index + 1)}
                  reportId={report?.id}
                  media={report?.media ?? []}
                  editable={canUploadPhotos}
                  canRemove={canRemovePhotos}
                  onPickingChange={onPickingChange}
                />
                <Button
                  title={
                    details[point._formKey] ? 'Ocultar detalhes do ponto' : 'Mais detalhes do ponto'
                  }
                  variant="ghost"
                  small
                  icon={details[point._formKey] ? 'minus' : 'plus'}
                  onPress={() =>
                    setDetails((old) => ({ ...old, [point._formKey]: !old[point._formKey] }))
                  }
                />
                {(details[point._formKey] || !!errors.points?.[index]) && (
                  <FormGrid>
                    {measurement && (
                      <>
                        <FormCell>
                          <Controller
                            control={control}
                            name={`points.${index}.unit`}
                            render={({ field, fieldState }) => (
                              <Field
                                error={fieldState.error?.message}
                                label="Unidade"
                                value={field.value ?? ''}
                                onChangeText={field.onChange}
                                editable={editable}
                              />
                            )}
                          />
                        </FormCell>
                        <FormCell>
                          <Controller
                            control={control}
                            name={`points.${index}.data.projectThickness`}
                            render={({ field, fieldState }) => (
                              <Field
                                error={fieldState.error?.message}
                                label="Espessura de projeto"
                                value={field.value ?? ''}
                                onChangeText={field.onChange}
                                editable={editable}
                              />
                            )}
                          />
                        </FormCell>
                      </>
                    )}
                    <FormCell full>
                      <Controller
                        control={control}
                        name={`points.${index}.data.notes`}
                        render={({ field, fieldState }) => (
                          <Field
                            error={fieldState.error?.message}
                            label="Observações do ponto"
                            value={field.value ?? ''}
                            onChangeText={field.onChange}
                            multiline
                            editable={editable}
                          />
                        )}
                      />
                    </FormCell>
                  </FormGrid>
                )}
                {editable && (
                  <>
                    <Text style={[styles.muted, { fontSize: 11 }]}>
                      Finalize para recolher este ponto. Os dados e as fotos serão gravados ao
                      salvar o relatório.
                    </Text>
                    <Button
                      title={
                        index < fields.length - 1 ? 'Finalizar e ir ao próximo' : 'Finalizar ponto'
                      }
                      small
                      icon="check"
                      style={{ minHeight: 44 }}
                      onPress={() => finish(key)}
                    />
                    {index === fields.length - 1 && (
                      <Button
                        title="Finalizar e adicionar próximo"
                        small
                        secondary
                        icon="plus"
                        style={{ minHeight: 44 }}
                        onPress={() => finish(key, true)}
                      />
                    )}
                    <Button
                      title="Remover ponto"
                      variant="ghost"
                      small
                      icon="trash"
                      onPress={() => {
                        setError(undefined);
                        Keyboard.dismiss();
                        setRemovingKey(key);
                      }}
                    />
                  </>
                )}
              </View>
            )}
          </Card>
        );
      })}
      <ConfirmDialog
        visible={!!finishing}
        title="Continuar com fotos faltando?"
        description={
          finishing && photoCount(finishing.key) === 1
            ? 'Este ponto tem 1 das 2 fotos sugeridas. Você pode continuar e adicionar a segunda depois.'
            : 'Este ponto ainda não tem fotos. Você pode continuar e adicioná-las depois.'
        }
        confirmLabel={
          finishing && photoCount(finishing.key) === 1
            ? 'Prosseguir com 1 foto'
            : 'Prosseguir sem fotos'
        }
        onClose={() => setFinishing(undefined)}
        onConfirm={() => {
          if (finishing) advance(finishing.key, finishing.add);
          setFinishing(undefined);
        }}
      />
      <ConfirmDialog
        visible={!!removingPoint}
        title={'Remover ponto ' + (removingPoint?.number ?? '') + '?'}
        description={`Os dados e ${removingKey ? photoCount(removingKey) : 0} foto(s) deste ponto serão removidos ao salvar. ${linkedMarks ? 'Você pode manter o número e a marcação no desenho, ou remover também do desenho.' : 'Os demais pontos e desenhos serão mantidos.'}`}
        confirmLabel={linkedMarks ? 'Remover também do desenho' : 'Remover ponto'}
        danger
        onClose={() => setRemovingKey(undefined)}
        alternativeLabel={linkedMarks ? 'Manter no desenho' : undefined}
        onAlternative={() => confirmPointRemoval(true)}
        onConfirm={() => confirmPointRemoval(false)}
      />
      <PickerSheet
        visible={batchOpen}
        title="Criar pontos em sequência"
        subtitle="A numeração é automática. Depois, preencha os resultados e as fotos de cada ponto."
        icon="pin"
        onClose={() => setBatchOpen(false)}
      >
        <Notice error={batchError} />
        <Field
          label="Número inicial"
          value={firstNumber}
          onChangeText={setFirstNumber}
          maxLength={100}
        />
        <Field
          label="Quantidade de pontos"
          value={batchCount}
          onChangeText={setBatchCount}
          keyboardType="number-pad"
          maxLength={2}
          hint="De 1 a 50 pontos por vez."
        />
        <Button
          title="Criar pontos"
          icon="plus"
          onPress={() => {
            try {
              const created = pointBatch(
                values,
                measurement,
                Number(batchCount),
                repeatPrevious,
                firstNumber,
                String(specificData.projectThickness || ''),
              );
              setExpandedPoint(fields.length);
              append(created);
              setBatchOpen(false);
            } catch (cause) {
              setBatchError(cause);
            }
          }}
        />
      </PickerSheet>
      <PickerSheet
        visible={firstNumberOpen}
        title={measurement ? 'Primeiro ponto de medição' : 'Primeiro ponto de solda'}
        subtitle="Informe o número inicial. Os próximos serão sugeridos em sequência e continuam editáveis."
        icon="pin"
        onClose={() => setFirstNumberOpen(false)}
      >
        <Notice error={error} />
        <Field
          label="Número do primeiro ponto / solda"
          value={firstNumber}
          onChangeText={setFirstNumber}
          maxLength={100}
          autoFocus
          placeholder="Ex.: 1, 01 ou S-01"
        />
        <Button
          title="Criar primeiro ponto"
          icon="plus"
          disabled={!firstNumber.trim()}
          onPress={() => {
            if (appendPoint(firstNumber.trim())) setFirstNumberOpen(false);
          }}
        />
      </PickerSheet>
    </View>
  );
}
const roles: { value: ReportSigner['role']; label: string }[] = [
  { value: 'INSPECTOR', label: 'Inspetor' },
  { value: 'TECHNICAL_RESPONSIBLE', label: 'Responsável técnico' },
  { value: 'CLIENT', label: 'Representante do cliente' },
  { value: 'REVIEWER', label: 'Revisor' },
  { value: 'OTHER', label: 'Outro' },
];
export function ReportSigners({
  control,
  editable,
  errors,
  correction,
  previousSignatures = [],
  reportDate,
  setValue,
}: {
  control: Control<ReportFormValues>;
  editable: boolean;
  errors: FieldErrors<ReportFormValues>;
  correction?: CorrectionRequest;
  previousSignatures?: ReportSigner[];
  reportDate: string;
  setValue: UseFormSetValue<ReportFormValues>;
}) {
  const { tokens: t, styles } = useTheme();
  const currentUser = useAuth((state) => state.session!.user);
  const canViewPeople = usePermission('people.view');
  const canManagePeople = usePermission('people.manage');
  const signers = useWatch({ control, name: 'signatures' });
  const [selecting, setSelecting] = useState<number | null>(null);
  const [registering, setRegistering] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const signerViews = useRef<Record<number, ViewInstance | null>>({});
  const [revealIndex, setRevealIndex] = useState<number | null>(null);
  const registrationView = useRef<ViewInstance>(null);
  const revealSigner = usePageScroll();
  useEffect(() => {
    if (correction?.path[0] !== 'signatures') return;
    const index = Number(correction.path[1]);
    const timer = setTimeout(() => revealSigner(signerViews.current[index]), 300);
    return () => clearTimeout(timer);
  }, [correction, revealSigner]);
  useEffect(() => {
    if (registering === null) return;
    const timer = setTimeout(() => revealSigner?.(registrationView.current), 160);
    return () => clearTimeout(timer);
  }, [registering, revealSigner]);
  const { fields, append, remove, update } = useFieldArray({
    control,
    name: 'signatures',
    keyName: '_formKey',
  });
  useEffect(() => {
    if (revealIndex === null) return;
    const timer = setTimeout(() => {
      revealSigner(signerViews.current[revealIndex]);
      setRevealIndex(null);
    }, 160);
    return () => clearTimeout(timer);
  }, [revealIndex, revealSigner]);
  const addRole = (role: ReportSigner['role']) => {
    // Reuse an empty slot instead of creating another unfilled responsibility.
    const emptyIndex = signers.findIndex(
      (s) =>
        s.role === role &&
        !s.name.trim() &&
        !s.signatureAssetId &&
        !s.registrationNumber?.trim() &&
        !s.signedAt,
    );
    if (emptyIndex !== -1) {
      setAdding(false);
      setRevealIndex(emptyIndex);
      return;
    }
    append({ role, name: '', registrationNumber: '' });
    setAdding(false);
    setRevealIndex(fields.length);
  };
  const roleLabel = (role?: string) =>
    roles.find((item) => item.value === role)?.label ?? 'Responsável';
  return (
    <View style={{ gap: 16 }}>
      <PanelHeader
        title="Responsáveis"
        subtitle="Preencha aqui o inspetor, o responsável técnico e o representante do cliente. A mesma pessoa pode ocupar mais de uma função."
      />
      {editable && (
        <View style={{ gap: 12 }}>
          {roles
            .slice(0, 3)
            .filter((role) => !signers.some((s) => s.role === role.value))
            .map((role) => (
              <Button
                key={role.value}
                title={`Preencher ${role.label.toLowerCase()}`}
                secondary
                icon="plus"
                onPress={() => addRole(role.value)}
              />
            ))}
          {!fields.length && !!previousSignatures.length && (
            <Button
              title="Repetir responsáveis do último relatório"
              icon="layers"
              secondary
              onPress={() =>
                append(
                  previousSignatures.map((s) => ({
                    role: s.role,
                    name: s.name,
                    registrationNumber: s.registrationNumber ?? '',
                    signatureAssetId: s.signatureAssetId ?? null,
                    signedAt: s.signatureAssetId ? reportDate : '',
                  })),
                )
              }
            />
          )}
          <Button
            title="Adicionar responsável"
            secondary
            icon="plus"
            onPress={() => setAdding(true)}
          />
        </View>
      )}
      <PickerSheet
        visible={adding}
        title="Qual função deseja preencher?"
        subtitle="Escolha a função que esta pessoa terá no relatório."
        icon="user"
        onClose={() => setAdding(false)}
      >
        <View style={{ padding: 20, gap: 12 }}>
          {roles.map((role) => (
            <Button
              key={role.value}
              title={role.label}
              secondary
              onPress={() => addRole(role.value)}
            />
          ))}
        </View>
      </PickerSheet>
      {registering !== null && (
        <View ref={registrationView}>
          <PersonForm
            key={String(registering)}
            initial={signers[registering]}
            reportRole={signers[registering]?.role}
            onCancel={() => setRegistering(null)}
            onSaved={(person) => {
              const target = signers[registering];
              if (!target) return;
              const value = {
                ...personSigner(person),
                signedAt: person.signatureAssetId ? reportDate : '',
              };
              update(registering, {
                ...value,
                role: target.role,
                signedAt: signers[registering]?.signedAt || value.signedAt,
              });
              setRevealIndex(registering);
              setRegistering(null);
            }}
          />
        </View>
      )}
      <PersonPicker
        visible={selecting !== null}
        roleLabel={selecting !== null ? roleLabel(signers[selecting]?.role) : undefined}
        onClose={() => setSelecting(null)}
        onNew={() => {
          setRegistering(selecting);
          setSelecting(null);
        }}
        onSelect={(person) => {
          const value = {
            ...personSigner(person),
            signedAt: person.signatureAssetId ? reportDate : '',
          };
          const target = selecting !== null ? signers[selecting] : undefined;
          if (selecting !== null && target) {
            update(selecting, { ...value, role: target.role });
            setRevealIndex(selecting);
          }
          setSelecting(null);
        }}
      />
      {!fields.length && <Text style={styles.muted}>Nenhum responsável informado.</Text>}
      {fields.map((signer, index) => (
        <View
          key={signer._formKey}
          ref={(node) => {
            signerViews.current[index] = node;
          }}
          collapsable={false}
        >
          <Card style={{ backgroundColor: t.colors.soft, padding: 18 }}>
            <PanelHeader
              title={roleLabel(signers[index]?.role)}
              subtitle="Nome, registro, data e assinatura desta função no relatório."
              icon="user"
            />
            {editable && signers[index]?.role === 'INSPECTOR' && !signers[index]?.name.trim() && (
              <Button
                title="Usar meu nome como inspetor"
                small
                secondary
                icon="user"
                onPress={() =>
                  setValue(`signatures.${index}.name`, currentUser.name, { shouldDirty: true })
                }
              />
            )}
            {editable && signers.some((s, i) => i !== index && s.name.trim()) && (
              <SelectField
                label="Reutilizar responsável deste relatório"
                value=""
                options={signers.flatMap((s, i) =>
                  i !== index && s.name.trim()
                    ? [{ value: String(i), label: `${s.name} · ${roleLabel(s.role)}` }]
                    : [],
                )}
                clearable={false}
                onChange={(value) => {
                  const source = signers[Number(value)];
                  const target = signers[index];
                  if (source && target) update(index, { ...source, role: target.role });
                }}
              />
            )}
            {editable && canViewPeople && (
              <Button
                title="Preencher com pessoa cadastrada"
                small
                secondary
                icon="user"
                onPress={() => {
                  setRegistering(null);
                  setSelecting(index);
                }}
              />
            )}
            <FormGrid>
              <FormCell>
                <Controller
                  control={control}
                  name={`signatures.${index}.role`}
                  render={({ field }) => (
                    <SelectField
                      label="Função neste relatório"
                      value={field.value}
                      options={roles}
                      clearable={false}
                      disabled={!editable}
                      onChange={field.onChange}
                    />
                  )}
                />
              </FormCell>
              <FormCell>
                <Controller
                  control={control}
                  name={`signatures.${index}.name`}
                  render={({ field }) => (
                    <Field
                      label="Nome do responsável"
                      value={field.value}
                      onChangeText={field.onChange}
                      editable={editable}
                      error={errors.signatures?.[index]?.name?.message}
                    />
                  )}
                />
              </FormCell>
              <FormCell>
                <Controller
                  control={control}
                  name={`signatures.${index}.registrationNumber`}
                  render={({ field }) => (
                    <Field
                      label="Registro profissional"
                      value={field.value ?? ''}
                      onChangeText={field.onChange}
                      editable={editable}
                      error={errors.signatures?.[index]?.registrationNumber?.message}
                    />
                  )}
                />
              </FormCell>
              <FormCell>
                <Controller
                  control={control}
                  name={`signatures.${index}.signedAt`}
                  render={({ field }) => (
                    <DateField
                      label="Data do responsável"
                      value={field.value ?? ''}
                      onChangeText={field.onChange}
                      editable={editable}
                      error={errors.signatures?.[index]?.signedAt?.message}
                    />
                  )}
                />
              </FormCell>
            </FormGrid>
            <Controller
              control={control}
              name={`signatures.${index}.signatureAssetId`}
              render={({ field }) => (
                <SignatureField
                  value={field.value}
                  onChange={(id) => {
                    field.onChange(id);
                    if (id && !signers[index]?.signedAt)
                      setValue(`signatures.${index}.signedAt`, reportDate, { shouldDirty: true });
                  }}
                  editable={editable}
                />
              )}
            />
            {editable && canManagePeople && (
              <Button
                title="Guardar pessoa para próximos relatórios"
                small
                secondary
                icon="save"
                onPress={() => {
                  setRegistering(index);
                  setSelecting(null);
                }}
              />
            )}
            {editable && (
              <Button
                small
                variant="ghost"
                icon="trash"
                title="Remover responsável"
                onPress={() => {
                  setRegistering(null);
                  setSelecting(null);
                  remove(index);
                }}
              />
            )}
          </Card>
        </View>
      ))}
    </View>
  );
}
export function Discontinuities({
  value,
  onChange,
  editable,
  correction,
}: {
  value: { code: string; description?: string }[];
  onChange(value: { code: string; description?: string }[]): void;
  editable: boolean;
  correction?: CorrectionRequest;
}) {
  const reveal = usePageScroll();
  const rows = useRef<Record<number, ViewInstance | null>>({});
  const target = correction?.path[1] === 'discontinuities' ? Number(correction.path[2]) : -1;
  useEffect(() => {
    if (target < 0 || !Number.isInteger(target)) return;
    const timer = setTimeout(() => reveal(rows.current[target]), 200);
    return () => clearTimeout(timer);
  }, [correction?.request, target, reveal]);
  return (
    <View style={{ gap: 16 }}>
      <PanelHeader
        title="Descontinuidades"
        subtitle="Informe os códigos e suas descrições conforme o ensaio realizado."
        action={
          editable ? (
            <Button
              small
              secondary
              icon="plus"
              title="Adicionar descontinuidade"
              onPress={() => onChange([...value, { code: '', description: '' }])}
            />
          ) : undefined
        }
      />
      {value.map((item, index) => (
        <View
          key={index}
          ref={(node) => {
            rows.current[index] = node;
          }}
          style={{ gap: 12 }}
        >
          <FormGrid>
            <FormCell>
              <Field
                label="Código da descontinuidade"
                value={item.code}
                error={
                  target === index && correction?.path[3] === 'code'
                    ? correction.message
                    : undefined
                }
                editable={editable}
                onChangeText={(code) =>
                  onChange(value.map((row, i) => (i === index ? { ...row, code } : row)))
                }
              />
            </FormCell>
            <FormCell>
              <Field
                label="Descrição da descontinuidade"
                value={item.description ?? ''}
                error={
                  target === index && correction?.path[3] === 'description'
                    ? correction.message
                    : undefined
                }
                editable={editable}
                onChangeText={(description) =>
                  onChange(value.map((row, i) => (i === index ? { ...row, description } : row)))
                }
              />
            </FormCell>
          </FormGrid>
          {editable && (
            <Button
              small
              variant="ghost"
              title="Remover descontinuidade"
              onPress={() => onChange(value.filter((_, i) => i !== index))}
            />
          )}
        </View>
      ))}
    </View>
  );
}
