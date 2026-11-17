import { useState } from 'react';
import { Text, View } from 'react-native';
import { reportSectionId, type ReportSection, type ReportSectionId } from '@weldcosta/shared';
import { Button } from '../../components/ui';
import { PickerSheet } from '../../components/picker-sheet';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { useTheme } from '../../utils/theme';

export function ReportSectionsManager({
  sections,
  value,
  onChange,
  editable,
}: {
  sections: (ReportSection & { content?: string })[];
  value: ReportSectionId[];
  onChange(value: ReportSectionId[]): void;
  editable: boolean;
}) {
  const { styles } = useTheme();
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<ReportSectionId>();
  return (
    <>
      <Button
        title="Remover / restaurar etapas"
        icon="layers"
        secondary
        small
        disabled={!editable}
        onPress={() => setOpen(true)}
      />
      <PickerSheet
        visible={open}
        title="Etapas deste relatório"
        icon="layers"
        subtitle="As alterações valem apenas para este relatório. Novos relatórios começam com todas as etapas do modelo."
        onClose={() => setOpen(false)}
      >
        <View style={{ gap: 12 }}>
          <Text style={styles.muted}>
            Uma etapa removida deixa de aparecer no preenchimento e no PDF. Os dados já preenchidos
            ficam guardados para você restaurar a etapa neste relatório.
          </Text>
          {sections.map((section) => {
            const id = reportSectionId(section),
              removed = value.includes(id);
            return (
              <View key={id} style={[styles.card, { gap: 8 }]}>
                <Text style={styles.label}>
                  {section.title}
                  {removed ? ' · removida' : ''}
                </Text>
                <Button
                  title={removed ? 'Restaurar etapa' : 'Remover deste relatório'}
                  small
                  secondary
                  icon={removed ? 'plus' : 'trash'}
                  onPress={() =>
                    removed ? onChange(value.filter((v) => v !== id)) : setRemoving(id)
                  }
                />
              </View>
            );
          })}
        </View>
      </PickerSheet>
      <ConfirmDialog
        visible={!!removing}
        title="Remover esta etapa só deste relatório?"
        description="Ela não aparecerá no preenchimento nem no PDF deste relatório. Você pode restaurá-la aqui. O modelo e os próximos relatórios continuam completos."
        confirmLabel="Remover etapa"
        onClose={() => setRemoving(undefined)}
        onConfirm={() => {
          if (removing) onChange([...value, removing]);
          setRemoving(undefined);
        }}
      />
    </>
  );
}
