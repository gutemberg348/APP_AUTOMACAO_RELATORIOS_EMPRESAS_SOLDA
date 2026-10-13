import { useTheme } from '../../utils/theme';
import { useState, useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { companySchema, type Company } from '@weldcosta/shared';
import { api, jsonBody } from '../../services/api';
import { useUnsavedChanges } from '../../hooks/use-unsaved-changes';
import { usePageScroll } from '../../components/page-scroll';
import {
  apiValidationIssues,
  formErrorGuidance,
  type ValidationIssue,
} from '../../utils/form-feedback';
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
const fields = [
  ['name', 'Nome da empresa'],
  ['corporateName', 'Razão social'],
  ['cnpj', 'CNPJ'],
  ['phone', 'Telefone'],
  ['email', 'E-mail'],
  ['contactName', 'Contato'],
  ['notes', 'Observações'],
] as const;
type Values = Record<(typeof fields)[number][0], string>;
export function CompanyForm({ company, onSaved }: { company?: Company; onSaved?(): void }) {
  const { tokens: t, styles } = useTheme();
  const [error, setError] = useState<unknown>(),
    client = useQueryClient();
  const nodes = useRef<Record<string, View | null>>({});
  const reveal = usePageScroll();
  const [feedback, setFeedback] = useState({ field: '', attempt: 0 });
  useEffect(() => {
    if (!feedback.attempt) return;
    const frame = requestAnimationFrame(() => reveal(nodes.current[feedback.field] ?? null));
    return () => cancelAnimationFrame(frame);
  }, [feedback, reveal]);
  const {
    control,
    handleSubmit,
    reset,
    setError: setFieldError,
    clearErrors,
    formState: { errors, isDirty },
  } = useForm<Values>({ defaultValues: Object.fromEntries(fields.map(([key]) => [key, ''])) });
  useUnsavedChanges(isDirty);
  useEffect(() => {
    if (company) reset(Object.fromEntries(fields.map(([key]) => [key, company[key] ?? ''])));
  }, [company, reset]);
  const showIssues = (issues: ValidationIssue[]) => {
    const messages = issues.map((issue) => {
      const key = issue.path[0] as keyof Values;
      const message =
        key === 'name' && ['too_small', 'invalid_type'].includes(issue.code)
          ? 'Informe o nome da empresa.'
          : key === 'email'
            ? 'Informe um e-mail válido, como nome@empresa.com.'
            : issue.message;
      if (fields.some(([name]) => name === key))
        setFieldError(key, { type: 'validation', message });
      return (fields.find(([name]) => name === key)?.[1] ?? 'Cadastro') + ': ' + message;
    });
    setError(new Error(messages.join('\n')));
    setFeedback((old) => ({
      field: String(issues[0]?.path[0] ?? 'feedback'),
      attempt: old.attempt + 1,
    }));
  };
  const mutation = useMutation({
    mutationFn: (data: Values) =>
      api<Company>(
        company ? '/companies/' + company.id : '/companies',
        jsonBody(company ? 'PUT' : 'POST', data),
      ),
    onSuccess: async (saved) => {
      await client.invalidateQueries();
      onSaved?.();
      router.replace('/companies/' + saved.id);
    },
    onError: (cause) => {
      const issues = apiValidationIssues(cause);
      if (issues.length) showIssues(issues);
      else {
        setError(cause);
        setFeedback((old) => ({ field: 'feedback', attempt: old.attempt + 1 }));
      }
    },
  });
  const submit = handleSubmit((data) => {
    clearErrors();
    setError(undefined);
    const result = companySchema.safeParse(data);
    if (!result.success) {
      showIssues(result.error.issues);
      return;
    }
    mutation.mutate(data);
  });
  const renderField = (key: keyof Values, full = false) => (
    <FormCell key={key} full={full}>
      <View
        ref={(node) => {
          nodes.current[key] = node;
        }}
      >
        <Controller
          control={control}
          name={key}
          render={({ field }) => (
            <Field
              label={fields.find((item) => item[0] === key)![1]}
              mask={key === 'cnpj' || key === 'phone' ? key : undefined}
              placeholder={
                key === 'name'
                  ? 'Nome usado para identificar o cliente'
                  : key === 'notes'
                    ? 'Informações relevantes sobre este cliente…'
                    : undefined
              }
              required={key === 'name'}
              editable={!mutation.isPending}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors[key]?.message}
              multiline={key === 'notes'}
              autoCapitalize={
                key === 'cnpj' ? 'characters' : key === 'email' ? 'none' : 'sentences'
              }
              keyboardType={
                key === 'email' ? 'email-address' : key === 'phone' ? 'phone-pad' : 'default'
              }
              icon={key === 'email' ? 'mail' : key === 'phone' ? 'phone' : undefined}
            />
          )}
        />
      </View>
    </FormCell>
  );
  return (
    <Card>
      <PanelHeader
        title="Identificação da empresa"
        subtitle="Dados do cliente para organizar suas inspeções."
        icon="building"
      />
      <FormGrid>
        {renderField('name')}
        {renderField('corporateName')}
        {renderField('cnpj')}
      </FormGrid>
      <Divider />
      <PanelHeader
        title="Informações de contato"
        subtitle="Mantenha os responsáveis e canais de contato atualizados."
      />
      <FormGrid>
        {renderField('contactName')}
        {renderField('phone')}
        {renderField('email')}
      </FormGrid>
      <Divider />
      <FormGrid>{renderField('notes', true)}</FormGrid>
      <View
        ref={(node) => {
          nodes.current.feedback = node;
        }}
      >
        <Notice error={error} guidance={formErrorGuidance(error)} />
      </View>
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
            ? 'Salvando empresa… aguarde.'
            : isDirty
              ? 'Você tem alterações para salvar.'
              : '* Campo obrigatório'}
        </Text>
        <Button
          title={company ? 'Salvar empresa' : 'Cadastrar empresa'}
          icon="save"
          busy={mutation.isPending}
          onPress={() => void submit()}
        />
      </View>
    </Card>
  );
}
