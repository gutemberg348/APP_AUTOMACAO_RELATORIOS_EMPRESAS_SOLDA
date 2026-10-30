import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View, type ViewInstance } from 'react-native';
import { visualInspectionRecordFields, type VisualInspectionRecord } from '@weldcosta/shared';
import { Button, Field, FormCell, FormGrid, Notice } from '../../components/ui';
import { Icon } from '../../components/icon';
import { SelectField } from '../../components/select-field';
import { usePageScroll } from '../../components/page-scroll';
import { useTheme } from '../../utils/theme';
import type { CorrectionRequest } from './report-save-feedback';

export function VisualInspectionRecords({
  value,
  onChange,
  editable,
  correction,
}: {
  value: VisualInspectionRecord[];
  onChange(value: VisualInspectionRecord[]): void;
  editable: boolean;
  correction?: CorrectionRequest;
}) {
  const { styles, tokens: t } = useTheme();
  const [expanded, setExpanded] = useState<number | null>(0);
  const rows = useRef<Record<number, ViewInstance | null>>({});
  const reveal = usePageScroll();
  const relevant =
    correction?.path[0] === 'specificData' && correction.path[1] === 'inspectionRecords'
      ? correction
      : undefined;
  useEffect(() => {
    if (!relevant) return;
    const index = Number(relevant.path[2] ?? 0);
    setExpanded(index);
    const timer = setTimeout(() => reveal(rows.current[index]), 200);
    return () => clearTimeout(timer);
  }, [relevant, reveal]);
  const update = (index: number, patch: Partial<VisualInspectionRecord>) =>
    onChange(value.map((record, i) => (i === index ? { ...record, ...patch } : record)));
  return (
    <View style={{ gap: 16 }}>
      <Text style={styles.muted}>
        Registre as juntas ou intervalos, os sinetes dos soldadores e o laudo de cada item. Estes
        dados aparecem na tabela do PDF.
      </Text>
      {relevant && (
        <Notice
          error={new Error(relevant.label + ': ' + relevant.message)}
          guidance={relevant.guidance}
        />
      )}
      {!value.length && (
        <Text style={styles.muted}>
          Nenhum registro incluído. Você pode preencher esta tabela depois.
        </Text>
      )}
      {value.map((record, index) => (
        <View
          key={index}
          ref={(node) => {
            rows.current[index] = node;
          }}
          style={{
            borderWidth: 1,
            borderColor: expanded === index ? t.colors.blue : t.colors.line,
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={'Registro de inspeção ' + (index + 1)}
            accessibilityState={{ expanded: expanded === index }}
              aria-expanded={expanded === index}
            onPress={() => setExpanded(expanded === index ? null : index)}
            style={{
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: t.colors.soft,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>
                Item {record.item || String(index + 1).padStart(2, '0')}
              </Text>
              <Text style={styles.muted} numberOfLines={1}>
                {record.drawingReference || 'Desenho não informado'}
                {record.joint ? ' · Junta ' + record.joint : ''}
              </Text>
            </View>
            <Icon
              name={expanded === index ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={t.colors.blue}
            />
          </Pressable>
          {expanded === index && (
            <View style={{ padding: 16, gap: 16 }}>
              <FormGrid>
                {visualInspectionRecordFields.map((field) => (
                  <FormCell key={field.path} full={field.path === 'drawingReference'}>
                    <Field
                      label={field.label}
                      value={record[field.path] ?? ''}
                      placeholder={
                        field.path === 'item'
                          ? String(index + 1).padStart(2, '0')
                          : field.path === 'joint'
                            ? 'Ex.: 01/20 ou J-01'
                            : undefined
                      }
                      editable={editable}
                      onChangeText={(text) => update(index, { [field.path]: text })}
                      error={
                        Number(relevant?.path[2]) === index && relevant?.path[3] === field.path
                          ? relevant.message
                          : undefined
                      }
                    />
                  </FormCell>
                ))}
              </FormGrid>
              <SelectField
                label="Laudo do registro"
                value={record.result ?? ''}
                disabled={!editable}
                options={[
                  { value: '', label: 'Não informado' },
                  { value: 'APPROVED', label: 'A · Aprovado' },
                  { value: 'REJECTED', label: 'R · Reprovado' },
                  { value: 'COMPLEMENTARY_EXAM', label: 'EC · Exame complementar' },
                ]}
                onChange={(result) =>
                  update(index, { result: result as VisualInspectionRecord['result'] })
                }
              />
              {editable && (
                <Button
                  title="Excluir registro"
                  icon="trash"
                  secondary
                  small
                  onPress={() => {
                    onChange(value.filter((_, i) => i !== index));
                    setExpanded(null);
                  }}
                />
              )}
            </View>
          )}
        </View>
      ))}
      {editable && (
        <Button
          title="Adicionar registro de inspeção"
          icon="plus"
          secondary
          disabled={value.length >= 200}
          onPress={() => {
            onChange([...value, {}]);
            setExpanded(value.length);
          }}
        />
      )}
    </View>
  );
}
