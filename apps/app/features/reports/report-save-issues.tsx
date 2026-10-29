import { Text, View } from 'react-native';
import { PickerSheet } from '../../components/picker-sheet';
import { Button, Card } from '../../components/ui';
import { useTheme } from '../../utils/theme';
import type { ReportCorrection } from './report-save-feedback';

export function ReportSaveIssues({
  issues,
  visible,
  onClose,
  onOpen,
  onCorrect,
}: {
  issues: ReportCorrection[];
  visible: boolean;
  onClose(): void;
  onOpen(): void;
  onCorrect(issue: ReportCorrection): void;
}) {
  const { tokens: t, styles } = useTheme();
  if (!issues.length) return null;
  return (
    <>
      <Card>
        <Text accessibilityLiveRegion="polite" style={[styles.text, { color: t.colors.danger }]}>
          {issues.length}{' '}
          {issues.length === 1 ? 'item precisa de atenção' : 'itens precisam de atenção'} para
          concluir o salvamento.
        </Text>
        <Text style={styles.muted}>
          Seu preenchimento continua nesta tela. Corrija e toque em Salvar novamente.
        </Text>
        <Button title="Ver o que corrigir" icon="alert" secondary onPress={onOpen} />
      </Card>
      <PickerSheet
        visible={visible}
        title="Confira antes de salvar"
        icon="alert"
        subtitle="Veja onde ocorreu o problema e como continuar."
        onClose={onClose}
      >
        {issues.map((issue, index) => (
          <View
            key={issue.path.join('.') + index}
            style={{
              gap: 10,
              padding: 14,
              borderWidth: 1,
              borderColor: t.colors.danger,
              borderRadius: 12,
            }}
          >
            <Text style={[styles.text, { fontFamily: t.fonts.bold }]}>{issue.label}</Text>
            <Text style={styles.text}>{issue.message}</Text>
            <Text style={styles.muted}>{issue.guidance}</Text>
            <Button title="Corrigir" icon="edit" secondary onPress={() => onCorrect(issue)} />
          </View>
        ))}
      </PickerSheet>
    </>
  );
}
