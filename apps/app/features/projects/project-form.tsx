import { useTheme } from '../../utils/theme';
import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, type ViewInstance } from 'react-native';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  projectSchema,
  reportSections,
  type Project,
  type ReportDefaults,
} from '@weldcosta/shared';
import { api, ApiError, jsonBody } from '../../services/api';
import { useUnsavedChanges } from '../../hooks/use-unsaved-changes';
import {
  Button,
  Field,
  Notice,
  Card,
  PanelHeader,
  FormGrid,
  FormCell,
  Divider,
} from '../../components/ui';
import { EntityPicker } from '../../components/entity-picker';
import { DateField } from '../../components/date-field';
import {
  ProjectReportDefaults,
  ProjectReportCommon,
  projectCommonFields,
} from './project-report-defaults';
import { usePageScroll } from '../../components/page-scroll';
import { formErrorGuidance } from '../../utils/form-feedback';
const fields = [
  ['name', 'Nome da obra'],
  ['code', 'Código'],
  ['location', 'Localização'],
  ['responsible', 'Responsável'],
  ['startDate', 'Data inicial'],
  ['endDate', 'Data final'],
  ['description', 'Descrição'],
] as const;
type Values = Record<(typeof fields)[number][0] | 'companyId', string> & {
  reportDefaults: ReportDefaults;
};
export function ProjectForm({
  project,
  companyId = '',
  onSaved,
}: {
  project?: Project;
  companyId?: string;
  onSaved?(): void;
}) {
  const { tokens: t, styles } = useTheme();
  const [error, setError] = useState<unknown>(),
    client = useQueryClient();
  const [feedback, setFeedback] = useState<{
    target: string;
    code?: string;
    attempt: number;
    errors: Record<string, string>;
  }>({ target: '', attempt: 0, errors: {} });
  const fieldNodes = useRef<Record<string, ViewInstance | null>>({});
  const reveal = usePageScroll();
  const registerField = useCallback((key: string, node: ViewInstance | null) => {
    fieldNodes.current[key] = node;
  }, []);
  const revealError = useCallback(
    (key: string) => {
      if (key === feedback.target)
        requestAnimationFrame(() => {
          const node = fieldNodes.current[key];
          if (node) reveal(node);
        });
    },
    [feedback.target, reveal],
  );
  useEffect(() => {
    if (feedback.attempt) revealError(feedback.target);
  }, [feedback, revealError]);
  const {
    control,
    handleSubmit,
    reset,
    clearErrors,
    setError: setFieldError,
    formState: { errors, isDirty },
  } = useForm<Values>({
    defaultValues: {
      ...Object.fromEntries(fields.map(([key]) => [key, ''])),
      companyId,
      reportDefaults: {},
    },
  });
  useUnsavedChanges(isDirty);
  const startDate = useWatch({ control, name: 'startDate' });
  useEffect(() => {
    if (project)
      reset({
        ...Object.fromEntries(
          fields.map(([key]) => [
            key,
            key === 'startDate' || key === 'endDate'
              ? (project[key]?.slice(0, 10) ?? '')
              : (project[key] ?? ''),
          ]),
        ),
        companyId: project.companyId,
        reportDefaults: project.reportDefaults ?? {},
      });
  }, [project, reset]);
  const showIssues = (
    issues: { path: readonly PropertyKey[]; code: string; message: string }[],
  ) => {
    const details: Record<string, string> = {};
    const labels: Record<string, string> = {};
    for (const issue of issues) {
      const path = issue.path.map(String);
      const key = path.join('.');
      const basic = path[0] as keyof Values;
      const message =
        basic === 'companyId'
          ? 'Selecione a empresa da obra.'
          : basic === 'name' && ['too_small', 'invalid_type'].includes(issue.code)
            ? 'Informe o nome da obra.'
            : ((basic === 'startDate' || basic === 'endDate') && issue.code === 'invalid_format') ||
                (basic === 'reportDefaults' &&
                  path[1] === 'byType' &&
                  reportSections[path[2] ?? '']?.some((section) =>
                    section.fields.some((field) => field.path === path[3] && field.kind === 'date'),
                  ))
              ? 'Informe uma data válida em DD/MM/AAAA.'
              : issue.message;
      details[key] = message;
      labels[key] =
        basic === 'companyId'
          ? 'Empresa'
          : basic !== 'reportDefaults'
            ? (fields.find(([name]) => name === basic)?.[1] ?? key)
            : path[1] === 'common'
              ? (projectCommonFields.find((field) => field.path === path[2])?.label ??
                'Referência do projeto')
              : path[2] +
                ' · ' +
                (reportSections[path[2] ?? '']
                  ?.flatMap((section) => section.fields)
                  .find((field) => field.path === path[3])?.label ?? 'Dados técnicos');
      if (basic !== 'reportDefaults') setFieldError(basic, { type: 'validation', message });
    }
    const first = issues[0]?.path.map(String) ?? [];
    setError(
      new Error(
        Object.entries(details)
          .map(([key, message]) => labels[key] + ': ' + message)
          .join('\n'),
      ),
    );
    setFeedback((old) => ({
      target: first.join('.') || 'feedback',
      code: first[0] === 'reportDefaults' && first[1] === 'byType' ? first[2] : undefined,
      attempt: old.attempt + 1,
      errors: details,
    }));
  };
  const mutation = useMutation({
    mutationFn: (data: Values) =>
      api<Project>(
        project ? '/projects/' + project.id : '/projects',
        jsonBody(project ? 'PUT' : 'POST', {
          ...data,
          startDate: data.startDate || null,
          endDate: data.endDate || null,
        }),
      ),
    onSuccess: async (saved) => {
      await client.invalidateQueries();
      onSaved?.();
      router.replace('/projects/' + saved.id);
    },
    onError: (cause) => {
      if (
        cause instanceof ApiError &&
        cause.code === 'VALIDATION_ERROR' &&
        Array.isArray(cause.details)
      ) {
        showIssues(cause.details);
      } else {
        setError(cause);
        setFeedback((old) => ({ target: 'feedback', attempt: old.attempt + 1, errors: {} }));
      }
    },
  });
  const submit = handleSubmit((data) => {
    clearErrors();
    setError(undefined);
    setFeedback((old) => ({ ...old, target: '', errors: {} }));
    const result = projectSchema.safeParse({
      ...data,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
    });
    if (!result.success) {
      showIssues(result.error.issues);
      return;
    }
    mutation.mutate(data);
  });
  const renderField = (key: (typeof fields)[number][0], full = false) => (
    <FormCell key={key} full={full}>
      <View ref={(node) => registerField(key, node)} onLayout={() => revealError(key)}>
        <Controller
          control={control}
          name={key}
          render={({ field }) =>
            key === 'startDate' || key === 'endDate' ? (
              <DateField
                label={fields.find((item) => item[0] === key)![1]}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors[key]?.message}
                minDate={key === 'endDate' ? startDate : undefined}
              />
            ) : (
              <Field
                label={fields.find((item) => item[0] === key)![1]}
                required={key === 'name'}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors[key]?.message}
                multiline={key === 'description'}
                placeholder={
                  key === 'description' ? 'Informações sobre o projeto e a inspeção…' : undefined
                }
                icon={key === 'location' ? 'pin' : undefined}
              />
            )
          }
        />
      </View>
    </FormCell>
  );
  return (
    <Card>
      {!!error && (
        <View
          ref={(node) => registerField('feedback', node)}
          onLayout={() => revealError('feedback')}
        >
          <Notice error={error} guidance={formErrorGuidance(error)} />
        </View>
      )}
      <PanelHeader
        title="Identificação da obra"
        subtitle="Relacione o projeto ao cliente responsável."
        icon="folder"
      />
      {!project && (
        <View
          ref={(node) => registerField('companyId', node)}
          onLayout={() => revealError('companyId')}
        >
          <Controller
            control={control}
            name="companyId"
            render={({ field }) => (
              <EntityPicker
                label="Empresa"
                required
                endpoint="/companies?status=ACTIVE"
                value={field.value}
                onChange={field.onChange}
                error={errors.companyId?.message}
              />
            )}
          />
        </View>
      )}
      <FormGrid>
        {renderField('name')}
        {renderField('code')}
        {renderField('location')}
        {renderField('responsible')}
      </FormGrid>
      <Controller
        control={control}
        name="reportDefaults"
        render={({ field }) => (
          <ProjectReportCommon
            value={field.value}
            onChange={field.onChange}
            errors={feedback.errors}
            registerField={registerField}
            onFieldLayout={revealError}
          />
        )}
      />
      <Divider />
      <PanelHeader title="Período e informações do projeto" />
      <FormGrid>
        {renderField('startDate')}
        {renderField('endDate')}
        {renderField('description', true)}
      </FormGrid>
      <Divider />
      <Controller
        control={control}
        name="reportDefaults"
        render={({ field }) => (
          <ProjectReportDefaults
            value={field.value}
            onChange={field.onChange}
            errors={feedback.errors}
            validationCode={feedback.code}
            validationAttempt={feedback.attempt}
            registerField={registerField}
            onFieldLayout={revealError}
          />
        )}
      />
      <View
        style={{
          borderTopWidth: 1,
          borderColor: t.colors.line,
          paddingTop: 20,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={[styles.muted, { fontSize: 11 }]}>
          {mutation.isPending
            ? 'Salvando obra… aguarde.'
            : isDirty
              ? 'Você tem alterações para salvar.'
              : '* Campo obrigatório'}
        </Text>
        <Button
          title={project ? 'Salvar obra' : 'Cadastrar obra'}
          icon="save"
          busy={mutation.isPending}
          onPress={() => void submit()}
        />
      </View>
    </Card>
  );
}
