import { useTheme } from '../../utils/theme';
import { useEffect, useState } from 'react';
import { View, Text, Pressable, type ViewInstance } from 'react-native';
import { reportSections, type ReportDefaults } from '@weldcosta/shared';
import { Field, FormGrid, FormCell, PanelHeader } from '../../components/ui';
import { DateField } from '../../components/date-field';
import { SelectField } from '../../components/select-field';
import { Icon } from '../../components/icon';

const types = [
  { value: 'EVS', label: 'Ensaio Visual / Endoscopia', badge: 'EVS' },
  { value: 'EVD', label: 'Ensaio Visual Direto', badge: 'EVD' },
  { value: 'LP', label: 'Líquido Penetrante', badge: 'LP' },
  { value: 'TH', label: 'Teste Hidrostático', badge: 'TH' },
  { value: 'ME', label: 'Medição de Espessura', badge: 'ME' },
  { value: 'RDO', label: 'Relatório Diário de Inspeção', badge: 'RDO' },
];
export const projectCommonFields = [
  { path: 'factory', label: 'Fábrica / unidade' },
  { path: 'owner', label: 'Proprietário' },
];
export type ProjectDefaultFeedback = {
  errors?: Record<string, string>;
  validationCode?: string;
  validationAttempt?: number;
  registerField?(key: string, node: ViewInstance | null): void;
  onFieldLayout?(key: string): void;
};
export function ProjectReportCommon({
  value,
  onChange,
  errors,
  registerField,
  onFieldLayout,
}: {
  value: ReportDefaults;
  onChange(value: ReportDefaults): void;
} & ProjectDefaultFeedback) {
  return (
    <FormGrid>
      {projectCommonFields.map((field) => {
        const key = 'reportDefaults.common.' + field.path;
        return (
          <FormCell key={key}>
            <View ref={(node) => registerField?.(key, node)} onLayout={() => onFieldLayout?.(key)}>
              <Field
                label={field.label}
                hint="Opcional"
                value={value.common?.[field.path] ?? ''}
                error={errors?.[key]}
                onChangeText={(text) =>
                  onChange({ ...value, common: { ...value.common, [field.path]: text } })
                }
              />
            </View>
          </FormCell>
        );
      })}
    </FormGrid>
  );
}
export function ProjectReportDefaults({
  value,
  onChange,
  errors,
  validationCode,
  validationAttempt,
  registerField,
  onFieldLayout,
}: {
  value: ReportDefaults;
  onChange(value: ReportDefaults): void;
} & ProjectDefaultFeedback) {
  const { tokens: t, styles } = useTheme();
  const [code, setCode] = useState('EVS');
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (
      validationAttempt &&
      Object.keys(errors ?? {}).some(
        (key) =>
          key.startsWith('reportDefaults.byType.') || key === 'reportDefaults.common.project',
      )
    ) {
      setExpanded(true);
      if (validationCode && types.some((type) => type.value === validationCode))
        setCode(validationCode);
    }
  }, [validationAttempt, validationCode, errors]);
  const fields = reportSections[code]!.flatMap((section) => section.fields).filter(
    (field) =>
      !['client', 'work', 'project', 'factory', 'owner', 'location', 'date', 'inspector'].includes(
        field.path,
      ) &&
      field.kind !== 'long' &&
      field.kind !== 'result',
  );
  const filled =
    Object.values(value.byType ?? {})
      .flatMap((data) => Object.values(data))
      .filter((text) => text.trim()).length + (value.common?.project?.trim() ? 1 : 0);
  return (
    <View style={{ gap: 20 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dados técnicos e referência do projeto"
        accessibilityState={{ expanded }}
        aria-expanded={expanded}
        onPress={() => setExpanded(!expanded)}
        style={{
          padding: 16,
          borderWidth: 1,
          borderColor: t.colors.line,
          borderRadius: 12,
          backgroundColor: t.colors.soft,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Icon name="tool" size={22} color={t.colors.blue} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.text, { fontFamily: t.fonts.bold }]}>
            Dados técnicos e referência do projeto
          </Text>
          <Text style={[styles.muted, { fontSize: 12 }]}>
            Opcional ·{' '}
            {filled
              ? filled + ' campos preenchidos'
              : 'Abra se quiser antecipar os dados dos relatórios'}
          </Text>
        </View>
        <Icon name={expanded ? 'minus' : 'chevron-down'} size={18} color={t.colors.blue} />
      </Pressable>
      {expanded && (
        <>
          <PanelHeader
            title="Dados-base dos relatórios"
            subtitle="Preencha só o que já souber. Os dados continuam editáveis em cada relatório."
          />
          <FormGrid>
            <FormCell full>
              <View
                ref={(node) => registerField?.('reportDefaults.common.project', node)}
                onLayout={() => onFieldLayout?.('reportDefaults.common.project')}
              >
                <Field
                  label="Referência do projeto no relatório"
                  value={value.common?.project ?? ''}
                  error={errors?.['reportDefaults.common.project']}
                  onChangeText={(text) =>
                    onChange({ ...value, common: { ...value.common, project: text } })
                  }
                  placeholder="Se vazio, usa o código ou nome da obra"
                />
              </View>
            </FormCell>
          </FormGrid>
          <SelectField
            label="Dados técnicos por tipo"
            value={code}
            options={types}
            clearable={false}
            onChange={setCode}
            icon="tool"
          />
          <FormGrid>
            {fields.map((field) => {
              const key = 'reportDefaults.byType.' + code + '.' + field.path;
              const input = {
                label: field.label,
                value: value.byType?.[code]?.[field.path] ?? '',
                error: errors?.[key],
                onChangeText: (text: string) =>
                  onChange({
                    ...value,
                    byType: {
                      ...value.byType,
                      [code]: { ...value.byType?.[code], [field.path]: text },
                    },
                  }),
              };
              return (
                <FormCell key={code + field.path}>
                  <View
                    ref={(node) => registerField?.(key, node)}
                    onLayout={() => onFieldLayout?.(key)}
                  >
                    {field.kind === 'date' ? <DateField {...input} /> : <Field {...input} />}
                  </View>
                </FormCell>
              );
            })}
          </FormGrid>
          <Text style={[styles.muted, { fontSize: 11 }]}>
            Laudos, resultados, leituras e evidências são preenchidos em cada inspeção. Alterações
            nestes dados-base valem para novos relatórios.
          </Text>
        </>
      )}
    </View>
  );
}
