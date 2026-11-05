import { useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import {
  drawingPointLabel,
  drawingPointLabelRadius,
  positionDrawingPointLabel,
  type DrawingNumberedPoint,
} from '@weldcosta/shared';
import { Button } from '../../components/ui';
import { useTheme } from '../../utils/theme';

export function DrawingPointLabelControl({
  element,
  number,
  onChange,
}: {
  element: DrawingNumberedPoint;
  number: string;
  onChange(element: DrawingNumberedPoint): void;
}) {
  const { styles } = useTheme();
  const [preview, setPreview] = useState<DrawingNumberedPoint>();
  const current = useRef({ element, onChange });
  current.current = { element, onChange };
  const origin = useRef({ x: 0, y: 0 });
  const pending = useRef<DrawingNumberedPoint | undefined>(undefined);
  const pan = useMemo(() => {
    const move = (x: number, y: number) => {
      const point = current.current.element;
      pending.current = positionDrawingPointLabel(point, {
        x: point.x + x - 90,
        y: point.y + y - 85,
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
  const point = preview?.id === element.id ? preview : element;
  const label = drawingPointLabel(point, number);
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.label, { fontSize: 12 }]}>Posição do número</Text>
      <Text style={[styles.muted, { fontSize: 12 }]}>
        Arraste o número ao redor da bolinha. Só o número muda de lugar.
      </Text>
      <View
        {...pan.panHandlers}
        testID="drawing-number-position-preview"
        accessibilityLabel="Prévia da posição do número; toque ou arraste ao redor da bolinha"
        style={
          {
            width: 180,
            height: 170,
            alignSelf: 'center',
            borderRadius: 12,
            backgroundColor: '#fff',
            overflow: 'hidden',
            ...(Platform.OS === 'web' ? { touchAction: 'none' } : {}),
          } as ViewStyle
        }
      >
        <Svg width={180} height={170} pointerEvents="none">
          <Circle
            cx={90}
            cy={85}
            r={drawingPointLabelRadius}
            fill="#1764C0"
            fillOpacity={0.03}
            stroke="#1764C0"
            strokeOpacity={0.3}
            strokeDasharray="3 5"
          />
          <Circle cx={90} cy={85} r={5} fill="#1764C0" />
          <SvgText
            x={90 + label.x - point.x}
            y={85 + label.y - point.y}
            textAnchor={label.anchor as 'start' | 'end' | 'middle'}
            fontSize={18}
            fontWeight="bold"
            fill="#1764C0"
          >
            {number}
          </SvgText>
        </Svg>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        {(
          [
            ['Acima', 0, -28],
            ['Abaixo', 0, 28],
            ['Esquerda', -28, 0],
            ['Direita', 28, 0],
          ] as const
        ).map(([title, dx, dy]) => (
          <Button
            key={title}
            title={title}
            small
            secondary
            onPress={() =>
              onChange(positionDrawingPointLabel(element, { x: element.x + dx, y: element.y + dy }))
            }
          />
        ))}
      </View>
      <Button
        title="Posição automática"
        small
        variant="ghost"
        onPress={() =>
          onChange({ ...element, labelPosition: undefined, labelX: undefined, labelY: undefined })
        }
      />
    </View>
  );
}
