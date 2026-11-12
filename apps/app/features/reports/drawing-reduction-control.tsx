import { useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Text, View, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import {
  drawingSvg,
  drawingSymbolDefinition,
  newDrawingData,
  positionDrawingReductionLabel,
  type DrawingSymbol,
} from '@weldcosta/shared';
import { Button, Field, IconButton } from '../../components/ui';
import { useTheme } from '../../utils/theme';

export function DrawingReductionControl({
  element,
  onChange,
}: {
  element: DrawingSymbol;
  onChange(element: DrawingSymbol): void;
}) {
  const { styles } = useTheme();
  const [preview, setPreview] = useState<DrawingSymbol>();
  const data = element.reduction ?? { inlet: '', outlet: '' };
  const bounds = drawingSymbolDefinition(element.symbolCode).bounds;
  const factor = Math.min(1, 70 / (Math.max(bounds.width, bounds.height) * (element.scale ?? 1)));
  const current = useRef({ element, onChange, factor });
  current.current = { element, onChange, factor };
  const origin = useRef({ x: 0, y: 0 });
  const pending = useRef<DrawingSymbol | undefined>(undefined);
  const pan = useMemo(() => {
    const move = (x: number, y: number) => {
      const { element, factor } = current.current;
      pending.current = positionDrawingReductionLabel(element, {
        x: element.x + (x - 110) / factor,
        y: element.y + (y - 95) / factor,
      });
      setPreview(pending.current);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        origin.current = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
        move(origin.current.x, origin.current.y);
      },
      onPanResponderMove: (_event, state) =>
        move(origin.current.x + state.dx, origin.current.y + state.dy),
      onPanResponderRelease: () => {
        if (pending.current) current.current.onChange(pending.current);
        pending.current = undefined;
        setPreview(undefined);
      },
      onPanResponderTerminate: () => {
        pending.current = undefined;
        setPreview(undefined);
      },
    });
  }, []);
  const shown = preview?.id === element.id ? preview : element;
  const setPosition = (dx: number, dy: number) =>
    onChange(
      positionDrawingReductionLabel(
        { ...element, reduction: data },
        { x: element.x + dx / factor, y: element.y + dy / factor },
      ),
    );
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.label, { fontSize: 12 }]}>Medidas da redução</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Medida 1"
            value={data.inlet}
            placeholder="Ex.: 2"
            maxLength={20}
            onChangeText={(inlet) => onChange({ ...element, reduction: { ...data, inlet } })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Medida 2"
            value={data.outlet}
            placeholder="Ex.: 4"
            maxLength={20}
            onChangeText={(outlet) => onChange({ ...element, reduction: { ...data, outlet } })}
          />
        </View>
      </View>
      <Text style={[styles.muted, { fontSize: 12 }]}>
        Preencha as duas medidas. Arraste o texto na prévia para escolher a posição.
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[styles.label, { flex: 1, fontSize: 12 }]}>
          Tamanho das medidas · {data.labelSize ?? 18}
        </Text>
        <IconButton
          label="Diminuir medidas da redução"
          icon="minus"
          disabled={(data.labelSize ?? 18) <= 10}
          onPress={() =>
            onChange({
              ...element,
              reduction: { ...data, labelSize: Math.max(10, (data.labelSize ?? 18) - 2) },
            })
          }
        />
        <IconButton
          label="Aumentar medidas da redução"
          icon="plus"
          disabled={(data.labelSize ?? 18) >= 40}
          onPress={() =>
            onChange({
              ...element,
              reduction: { ...data, labelSize: Math.min(40, (data.labelSize ?? 18) + 2) },
            })
          }
        />
      </View>
      <View
        {...pan.panHandlers}
        testID="drawing-reduction-position-preview"
        accessibilityLabel="Posição das medidas da redução; toque ou arraste ao redor do símbolo"
        style={
          {
            width: 220,
            height: 190,
            alignSelf: 'center',
            backgroundColor: '#fff',
            borderRadius: 12,
            overflow: 'hidden',
            ...(Platform.OS === 'web' ? { touchAction: 'none' } : {}),
          } as ViewStyle
        }
      >
        <View pointerEvents="none">
          <SvgXml
            width={220}
            height={190}
            xml={drawingSvg({ ...newDrawingData(), grid: 'none', elements: [shown] }, [], {
              viewBox: `${element.x - 110 / factor} ${element.y - 95 / factor} ${220 / factor} ${190 / factor}`,
            })}
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        {(
          [
            ['Acima', 0, -65],
            ['Abaixo', 0, 65],
            ['Esquerda', -70, 0],
            ['Direita', 70, 0],
          ] as const
        ).map(([title, x, y]) => (
          <Button key={title} title={title} small secondary onPress={() => setPosition(x, y)} />
        ))}
      </View>
      <Button
        title="Posição automática abaixo"
        small
        variant="ghost"
        onPress={() =>
          onChange({ ...element, reduction: { ...data, labelX: undefined, labelY: undefined } })
        }
      />
    </View>
  );
}
