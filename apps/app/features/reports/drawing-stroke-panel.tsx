import { DrawingCustomColor } from './drawing-color-picker';
import { Pressable, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import {
  drawingStrokeDash,
  drawingBrushes,
  drawingBrushLayers,
  type DrawingBrush,
} from '@weldcosta/shared';
import { PickerSheet } from '../../components/picker-sheet';
import { Button, IconButton } from '../../components/ui';
import { useTheme } from '../../utils/theme';

function brushPreview(
  brush: DrawingBrush | undefined,
  width: number,
  color: string,
  path: string,
  viewBox: string,
  dash = '',
) {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' +
    viewBox +
    '">' +
    drawingBrushLayers(brush, width)
      .map(
        (layer) =>
          '<path d="' +
          path +
          '" fill="none" stroke="' +
          color +
          '" stroke-width="' +
          layer.width +
          '" stroke-opacity="' +
          layer.opacity +
          '" stroke-linecap="' +
          layer.cap +
          '"' +
          (dash ? ' stroke-dasharray="' + dash + '"' : '') +
          '/>',
      )
      .join('') +
    '</svg>'
  );
}
export type StrokeAppearance = {
  brush?: DrawingBrush;
  strokeWidth: number;
  strokeColor: string;
  strokeStyle: 'solid' | 'dotted' | 'dashed';
};
export const strokeStyleLabels = { solid: 'Contínua', dotted: 'Pontilhada', dashed: 'Tracejada' };
export const drawingStrokeColors = [
  ['Preto', '#263D52'],
  ['Azul', '#1764C0'],
  ['Vermelho', '#DC2626'],
  ['Laranja', '#EA580C'],
  ['Amarelo', '#EAB308'],
  ['Verde', '#16725B'],
  ['Roxo', '#7C3AED'],
  ['Cinza', '#64748B'],
] as const;
export function DrawingColorChoices({
  value,
  onChange,
}: {
  value: string;
  onChange(color: string): void;
}) {
  const { tokens: t } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
        {drawingStrokeColors.map(([name, color]) => (
          <Pressable
            key={color}
            accessibilityRole="button"
            accessibilityLabel={'Cor do texto ' + name.toLowerCase()}
            accessibilityState={{ selected: value === color }}
            onPress={() => onChange(color)}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: color,
                borderWidth: 2,
                borderColor: value === color ? t.colors.text : t.colors.line,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {value === color && <Text style={{ color: 'white' }}>✓</Text>}
            </View>
          </Pressable>
        ))}
      </View>
      <DrawingCustomColor value={value} onChange={onChange} />
    </View>
  );
}
export function DrawingStrokePanel({
  visible,
  value,
  selected,
  onChange,
  onClose,
  onBrush,
  onEraser,
}: {
  onBrush?(brush: DrawingBrush, width: number): void;
  onEraser?(): void;
  visible: boolean;
  value: StrokeAppearance;
  selected: boolean;
  onChange(patch: Partial<StrokeAppearance>): void;
  onClose(): void;
}) {
  const { tokens: t, styles } = useTheme();
  const dash = drawingStrokeDash(value.strokeStyle, value.strokeWidth);
  return (
    <PickerSheet
      visible={visible}
      title={onBrush ? 'Pincéis, cores e espessura' : 'Estilo da linha'}
      icon="line"
      onClose={onClose}
      subtitle={
        selected
          ? 'Altere a linha selecionada. A prévia atualiza na hora.'
          : 'Escolha o estilo antes de desenhar. Será usado nos próximos traços.'
      }
      footer={<Button title="Concluir estilo" icon="check" onPress={onClose} />}
    >
      <View style={{ gap: 16 }}>
        {onBrush && (
          <View style={{ gap: 8 }}>
            <Text style={styles.label}>Escolha o pincel</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {drawingBrushes.map((brush) => (
                <Pressable
                  key={brush.id}
                  accessibilityRole="button"
                  accessibilityLabel={'Pincel ' + brush.name.toLowerCase()}
                  accessibilityState={{ selected: (value.brush ?? 'pen') === brush.id }}
                  onPress={() => onBrush(brush.id, brush.width)}
                  style={{
                    width: 92,
                    minHeight: 80,
                    borderWidth: 1,
                    borderColor: t.colors.line,
                    borderRadius: 10,
                    padding: 8,
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor:
                      (value.brush ?? 'pen') === brush.id ? t.colors.blueSoft : t.colors.surface,
                  }}
                >
                  <SvgXml
                    width={64}
                    height={28}
                    xml={brushPreview(
                      brush.id,
                      Math.min(14, brush.width),
                      value.strokeColor,
                      'M6 20Q20 1 32 14T58 10',
                      '0 0 64 28',
                    )}
                  />
                  <Text style={[styles.label, { fontSize: 11 }]}>{brush.name}</Text>
                </Pressable>
              ))}
              {onEraser && <Button title="Borracha" icon="eraser" secondary onPress={onEraser} />}
            </View>
          </View>
        )}
        <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 8 }}>
          <SvgXml
            width="100%"
            height={42}
            xml={brushPreview(
              value.brush,
              value.strokeWidth,
              value.strokeColor,
              'M15 21L285 21',
              '0 0 300 42',
              dash,
            )}
          />
        </View>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Text style={styles.label}>Espessura · {value.strokeWidth.toFixed(1)}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton
              label="Diminuir espessura da linha"
              icon="minus"
              disabled={value.strokeWidth <= 0.5}
              onPress={() =>
                onChange({
                  strokeWidth: Math.max(0.5, Math.round((value.strokeWidth - 0.5) * 10) / 10),
                })
              }
            />
            <IconButton
              label="Aumentar espessura da linha"
              icon="plus"
              disabled={value.strokeWidth >= 60}
              onPress={() =>
                onChange({
                  strokeWidth: Math.min(60, Math.round((value.strokeWidth + 0.5) * 10) / 10),
                })
              }
            />
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {[0.5, 1, 2, 3, 5, 8, 12, 18, 30, 45, 60].map((w) => (
            <Button
              key={w}
              title={String(w)}
              small
              secondary={value.strokeWidth !== w}
              onPress={() => onChange({ strokeWidth: w })}
            />
          ))}
        </View>
        <Text style={styles.label}>Tipo do traço</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(Object.keys(strokeStyleLabels) as StrokeAppearance['strokeStyle'][]).map((style) => (
            <Button
              key={style}
              title={strokeStyleLabels[style]}
              small
              secondary={style !== value.strokeStyle}
              onPress={() => onChange({ strokeStyle: style })}
            />
          ))}
        </View>
        <Text style={styles.label}>Cor da linha</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {drawingStrokeColors.map(([name, color]) => (
            <Pressable
              key={color}
              accessibilityRole="button"
              accessibilityLabel={'Cor ' + name.toLowerCase()}
              accessibilityState={{
                selected: value.strokeColor.toUpperCase() === color.toUpperCase(),
              }}
              onPress={() => onChange({ strokeColor: color })}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: color,
                borderWidth: 3,
                borderColor:
                  value.strokeColor.toUpperCase() === color.toUpperCase()
                    ? t.colors.text
                    : t.colors.line,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {value.strokeColor.toUpperCase() === color.toUpperCase() && (
                <Text style={{ color: 'white', fontSize: 22 }}>✓</Text>
              )}
            </Pressable>
          ))}
        </View>
        <DrawingCustomColor
          value={value.strokeColor}
          onChange={(strokeColor) => onChange({ strokeColor })}
        />
      </View>
    </PickerSheet>
  );
}
