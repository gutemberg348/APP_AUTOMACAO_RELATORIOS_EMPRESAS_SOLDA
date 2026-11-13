import type { ReportDrawing } from '@weldcosta/shared';
import { PickerSheet } from '../../components/picker-sheet';
import { Button } from '../../components/ui';
import { View } from 'react-native';

export function DrawingSheetPositionPicker({
  sheets,
  mode,
  currentIndex,
  onChoose,
  onClose,
}: {
  sheets: ReportDrawing[];
  mode?: 'add' | 'move';
  currentIndex: number;
  onChoose(position: number): void;
  onClose(): void;
}) {
  const remaining = sheets.flatMap((sheet, i) =>
    mode === 'move' && i === currentIndex ? [] : [{ sheet, originalPosition: i + 1 }],
  );
  return (
    <PickerSheet
      visible={!!mode}
      icon="layers"
      onClose={onClose}
      title={mode === 'add' ? 'Onde colocar o novo desenho?' : 'Alterar posição do desenho'}
      subtitle="Escolha a posição entre as folhas de desenho. Essa será a ordem no relatório e no PDF após salvar."
    >
      <View style={{ gap: 10 }}>
        {Array.from({ length: remaining.length + 1 }, (_, position) => {
          const previous = remaining[position - 1];
          const current = mode === 'move' && position === currentIndex;
          return (
            <Button
              key={position}
              secondary
              small
              title={`${position + 1}º · ${
                previous
                  ? `Após desenho ${previous.originalPosition} — ${previous.sheet.data.title}${position === remaining.length ? ' · Último' : ''}`
                  : 'Primeiro desenho'
              }${current ? ' · Posição atual' : ''}`}
              onPress={() => onChoose(position)}
            />
          );
        })}
      </View>
    </PickerSheet>
  );
}
