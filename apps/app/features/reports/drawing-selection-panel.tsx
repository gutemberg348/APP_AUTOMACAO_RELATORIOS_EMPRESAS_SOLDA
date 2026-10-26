import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import {
  drawingSelectionBounds,
  drawingPreciseTransform,
  type DrawingElement,
} from '@weldcosta/shared';
import { PickerSheet } from '../../components/picker-sheet';
import { Button, Field } from '../../components/ui';
import { useTheme } from '../../utils/theme';

export function DrawingSelectionPanel({
  visible,
  elements,
  onClose,
  onApply,
  onAction,
}: {
  visible: boolean;
  elements: DrawingElement[];
  onClose(): void;
  onApply(elements: DrawingElement[]): void;
  onAction(action: 'group' | 'ungroup' | 'duplicate' | 'front' | 'back' | 'lock'): void;
}) {
  const { styles } = useTheme();
  const [x, setX] = useState(''),
    [y, setY] = useState(''),
    [size, setSize] = useState('100'),
    [angle, setAngle] = useState('0'),
    [length, setLength] = useState(''),
    [error, setError] = useState('');
  const e = elements.length === 1 ? elements[0] : undefined;
  const line = e?.type === 'line' || e?.type === 'dimension' ? e : undefined;
  useEffect(() => {
    if (!visible || !elements.length) return;
    const b = drawingSelectionBounds(elements);
    setX(String(Number(b.center.x.toFixed(3))));
    setY(String(Number(b.center.y.toFixed(3))));
    setSize('100');
    setError('');
    setAngle(
      line
        ? String(
            Number(((Math.atan2(line.y2 - line.y1, line.x2 - line.x1) * 180) / Math.PI).toFixed(3)),
          )
        : '0',
    );
    setLength(
      line ? String(Number(Math.hypot(line.x2 - line.x1, line.y2 - line.y1).toFixed(3))) : '',
    );
  }, [visible, elements, line]);
  const action = (value: Parameters<typeof onAction>[0]) => {
    onAction(value);
    onClose();
  };
  const read = (text: string) => (text.trim() ? Number(text.replace(',', '.')) : NaN);
  return (
    <PickerSheet
      visible={visible}
      title="Editar seleção"
      subtitle="Organize os elementos ou informe medidas exatas."
      icon="tool"
      onClose={onClose}
    >
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {elements.length > 1 && (
            <Button title="Agrupar" small secondary icon="layers" onPress={() => action('group')} />
          )}
          {elements.some((e) => e.groupId) && (
            <Button
              title="Desagrupar"
              small
              secondary
              icon="layers"
              onPress={() => action('ungroup')}
            />
          )}
          <Button
            title="Duplicar seleção"
            small
            secondary
            icon="plus"
            onPress={() => action('duplicate')}
          />
          <Button
            title="Trazer para frente"
            small
            secondary
            icon="chevron-up"
            onPress={() => action('front')}
          />
          <Button
            title="Enviar para trás"
            small
            secondary
            icon="chevron-down"
            onPress={() => action('back')}
          />
          {e?.type === 'image' && (
            <Button
              title="Bloquear imagem"
              small
              secondary
              icon="lock"
              onPress={() => action('lock')}
            />
          )}
        </View>
        {elements.some((e) => e.type === 'point') && (
          <Text style={styles.muted}>
            Duplicar cria novos pontos, sem copiar fotos nem resultados.
          </Text>
        )}
        <Text style={styles.label}>Medidas precisas</Text>
        <Text style={styles.muted}>
          Coordenadas do centro e medidas em unidades da folha (1000 × 800). Medidas reais da
          tubulação devem ser informadas nas cotas.
        </Text>
        <Field label="Centro X" value={x} onChangeText={setX} keyboardType="decimal-pad" />
        <Field label="Centro Y" value={y} onChangeText={setY} keyboardType="decimal-pad" />
        {line ? (
          <Field
            label="Comprimento da linha"
            value={length}
            onChangeText={setLength}
            keyboardType="decimal-pad"
          />
        ) : (
          <Field
            label="Tamanho (%)"
            value={size}
            onChangeText={setSize}
            keyboardType="decimal-pad"
          />
        )}
        <Field
          label={line ? 'Ângulo da linha (graus)' : 'Girar seleção (graus)'}
          value={angle}
          onChangeText={setAngle}
          keyboardType="numbers-and-punctuation"
        />
        {!!error && (
          <Text accessibilityRole="alert" style={styles.muted}>
            {error}
          </Text>
        )}
        <Button
          title="Aplicar medidas"
          icon="check"
          onPress={() => {
            try {
              const result = drawingPreciseTransform(elements, {
                x: read(x),
                y: read(y),
                scale: line ? 1 : read(size) / 100,
                angle: read(angle),
                ...(line ? { length: read(length) } : {}),
              });
              onApply(result);
              onClose();
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Confira as medidas.');
            }
          }}
        />
      </View>
    </PickerSheet>
  );
}
