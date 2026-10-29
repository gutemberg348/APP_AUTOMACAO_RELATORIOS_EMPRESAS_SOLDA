import { Pressable, Text, View } from 'react-native';
import { Button, IconButton } from '../../components/ui';
import { useTheme } from '../../utils/theme';
import {
  DrawingColorChoices,
  drawingStrokeColors,
  strokeStyleLabels,
  type StrokeAppearance,
} from './drawing-stroke-panel';

export function DrawingSelectionQuickOptions({
  textColor,
  onTextColor,
  stroke,
  onStroke,
  onResize,
  onMore,
  onFullStyle,
}: {
  textColor?: string;
  onTextColor?: (color: string) => void;
  stroke?: StrokeAppearance;
  onStroke(patch: Partial<StrokeAppearance>): void;
  onResize?: (scale: number) => void;
  onMore(): void;
  onFullStyle(): void;
}) {
  const { tokens: t, styles } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {textColor && onTextColor && (
        <>
          <Text style={[styles.label, { fontSize: 12 }]}>Cor do texto</Text>
          <DrawingColorChoices value={textColor} onChange={onTextColor} />
        </>
      )}
      {stroke && (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.label, { flex: 1, fontSize: 12 }]}>
              Espessura · {stroke.strokeWidth.toFixed(1)}
            </Text>
            <IconButton
              label="Afinar traço selecionado"
              icon="minus"
              disabled={stroke.strokeWidth <= 0.5}
              onPress={() =>
                onStroke({
                  strokeWidth: Math.max(0.5, Math.round((stroke.strokeWidth - 0.5) * 10) / 10),
                })
              }
            />
            <IconButton
              label="Engrossar traço selecionado"
              icon="plus"
              disabled={stroke.strokeWidth >= 60}
              onPress={() =>
                onStroke({
                  strokeWidth: Math.min(60, Math.round((stroke.strokeWidth + 0.5) * 10) / 10),
                })
              }
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {(Object.keys(strokeStyleLabels) as StrokeAppearance['strokeStyle'][]).map((style) => (
              <Pressable
                key={style}
                accessibilityRole="button"
                accessibilityLabel={'Traço ' + strokeStyleLabels[style].toLowerCase()}
                accessibilityState={{ selected: stroke.strokeStyle === style }}
                onPress={() => onStroke({ strokeStyle: style })}
                style={{
                  flex: 1,
                  minHeight: 44,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderRadius: 8,
                  backgroundColor: stroke.strokeStyle === style ? t.colors.blueSoft : t.colors.soft,
                }}
              >
                <Text style={[styles.text, { fontSize: 11 }]}>{strokeStyleLabels[style]}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.label, { fontSize: 12 }]}>Cor</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {drawingStrokeColors.map(([name, color]) => (
              <Pressable
                key={color}
                accessibilityRole="button"
                accessibilityLabel={'Selecionar cor ' + name.toLowerCase()}
                accessibilityState={{ selected: stroke.strokeColor === color }}
                onPress={() => onStroke({ strokeColor: color })}
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: color,
                    borderWidth: 2,
                    borderColor: stroke.strokeColor === color ? t.colors.text : t.colors.line,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {stroke.strokeColor === color && <Text style={{ color: 'white' }}>✓</Text>}
                </View>
              </Pressable>
            ))}
          </View>
          <Button title="Mais cores e traços" secondary small onPress={onFullStyle} />
        </>
      )}
      {onResize && (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[styles.label, { flex: 1, fontSize: 12 }]}>Tamanho</Text>
          <IconButton label="Diminuir seleção" icon="minus" onPress={() => onResize(1 / 1.15)} />
          <IconButton label="Aumentar seleção" icon="plus" onPress={() => onResize(1.15)} />
        </View>
      )}
      <Button title="Mais opções do objeto" secondary small icon="tool" onPress={onMore} />
    </View>
  );
}
