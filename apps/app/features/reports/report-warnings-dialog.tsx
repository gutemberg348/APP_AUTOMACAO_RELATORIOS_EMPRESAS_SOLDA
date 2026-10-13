import { ScrollView, Text, View } from 'react-native';
import { PickerSheet } from '../../components/picker-sheet';
import { Button } from '../../components/ui';
import { useTheme } from '../../utils/theme';

export function ReportWarningsDialog({
  visible,
  warnings,
  title = 'Enviar com pendências?',
  confirmLabel = 'Enviar assim mesmo',
  busy,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  warnings: string[];
  title?: string;
  confirmLabel?: string;
  busy?: boolean;
  onClose(): void;
  onConfirm(): void;
}) {
  const { styles } = useTheme();
  return (
    <PickerSheet
      visible={visible}
      title={title}
      icon="alert"
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <View style={[styles.row, { justifyContent: 'flex-end' }]}>
          <Button title="Conferir relatório" secondary disabled={busy} onPress={onClose} />
          <Button title={confirmLabel} busy={busy} onPress={onConfirm} />
        </View>
      }
    >
      <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 12 }}>
        <Text style={styles.text}>
          O relatório tem informações incompletas. Se a inspeção terminou antes, você pode
          prosseguir com os dados já registrados.
        </Text>
        {warnings.map((warning) => (
          <Text key={warning} style={styles.muted}>
            • {warning}
          </Text>
        ))}
        <Text style={styles.muted}>
          Os pontos, fotos e resultados registrados serão preservados.
        </Text>
      </ScrollView>
    </PickerSheet>
  );
}
