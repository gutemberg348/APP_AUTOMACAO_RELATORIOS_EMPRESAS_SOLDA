import { useRef, useState, type RefObject } from 'react';
import {
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
  type ViewInstance,
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import {
  drawingId,
  photoAnnotationsSchema,
  photoAnnotationsSvg,
  type PhotoAnnotations,
  type PhotoMeasurement,
} from '@weldcosta/shared';
import { PickerSheet } from '../../components/picker-sheet';
import { Button, Field, Notice } from '../../components/ui';
import { useTheme } from '../../utils/theme';
import type { PhotoSource } from './photo-preview';
import { usePageScroll } from '../../components/page-scroll';

function MovePoint({
  number,
  target,
  onPress,
}: {
  number: string;
  target: RefObject<ViewInstance | null>;
  onPress(): void;
}) {
  const reveal = usePageScroll();
  return (
    <Button
      title={`Mover ponto ${number}`}
      icon="pin"
      small
      secondary
      onPress={() => {
        onPress();
        reveal(target.current);
      }}
    />
  );
}

export function PhotoMeasurementsEditor({
  source,
  value,
  editable,
  onSave,
  onClose,
  onPaint,
}: {
  source: PhotoSource;
  value: PhotoAnnotations;
  editable: boolean;
  onSave(value: PhotoAnnotations): void;
  onClose(): void;
  onPaint(value: PhotoAnnotations): void;
}) {
  const { styles, tokens: t } = useTheme();
  const window = useWindowDimensions();
  const [items, setItems] = useState<PhotoMeasurement[]>(value.measurements ?? []);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (value.measurements ?? []).map((m) => [
        m.id,
        m.value == null ? '' : String(m.value).replace('.', ','),
      ]),
    ),
  );
  const [moving, setMoving] = useState<string>();
  const [error, setError] = useState<string>();
  const touchRef = useRef<ViewInstance>(null);
  const photoRef = useRef<ViewInstance>(null);
  const width = Math.min(
    window.width - 48,
    620,
    (Math.max(200, window.height * 0.42) * source.width) / source.height,
  );
  const height = (width * source.height) / source.width;
  const annotations = { ...value, measurements: items };
  const update = (id: string, change: Partial<PhotoMeasurement>) =>
    setItems((old) => old.map((m) => (m.id === id ? { ...m, ...change } : m)));
  const validate = (next: (data: PhotoAnnotations) => void) => {
    const invalid = items.find((m) => {
      const text = (values[m.id] ?? '').trim();
      return (
        text !== '' && (!/^\d+(?:[.,]\d+)?$/.test(text) || Number(text.replace(',', '.')) > 100000)
      );
    });
    if (invalid) {
      setError(`Ponto ${invalid.number}: informe a espessura em mm, como 5,9, ou deixe vazia.`);
      return;
    }
    const parsed = photoAnnotationsSchema.safeParse({
      ...value,
      measurements:
        !items.length && value.measurements === undefined
          ? undefined
          : items.map((m) => ({
              ...m,
              value:
                (values[m.id] ?? '').trim() === '' ? null : Number(values[m.id]!.replace(',', '.')),
            })),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Confira os números dos pontos.');
      return;
    }
    setError(undefined);
    next(parsed.data);
  };
  return (
    <PickerSheet
      visible
      fillHeight
      title="Pontos de medição na foto"
      icon="pin"
      maxWidth={680}
      subtitle="Toque na foto para numerar. Preencha a espessura de cada ponto abaixo. Sem valor, não há linha no PDF."
      onClose={onClose}
      footer={
        <View style={{ gap: 8 }}>
          <Notice error={error ? new Error(error) : undefined} />
          <Button
            title={editable ? 'Salvar pontos da foto' : 'Fechar prévia'}
            icon="check"
            onPress={() => (editable ? validate(onSave) : onClose())}
          />
        </View>
      }
    >
      <View style={{ gap: 12 }}>
        <View ref={photoRef} collapsable={false}>
          <Pressable
            ref={touchRef}
            accessibilityRole="button"
            accessibilityLabel={
              moving ? 'Toque para reposicionar o ponto' : 'Toque na foto para adicionar ponto'
            }
            disabled={!editable}
            style={{
              width,
              height,
              alignSelf: 'center',
              borderWidth: moving ? 2 : 1,
              borderColor: moving ? t.colors.blue : t.colors.line,
            }}
            onPress={(event) => {
              const native = event.nativeEvent as typeof event.nativeEvent & {
                clientX?: number;
                clientY?: number;
              };
              const px = Platform.OS === 'web' ? (native.clientX ?? native.pageX) : native.pageX;
              const py = Platform.OS === 'web' ? (native.clientY ?? native.pageY) : native.pageY;
              touchRef.current?.measureInWindow((left, top, w, h) => {
                const x = Math.max(0.035, Math.min(0.965, (px - left) / w));
                const y = Math.max(0.035, Math.min(0.965, (py - top) / h));
                if (!Number.isFinite(x) || !Number.isFinite(y)) {
                  setError('Não foi possível localizar o toque. Toque novamente na foto.');
                  return;
                }
                if (moving) {
                  update(moving, { x, y });
                  setMoving(undefined);
                  return;
                }
                if (items.length >= 100) {
                  setError('Esta foto já tem 100 pontos. Use outra foto para continuar.');
                  return;
                }
                const id = drawingId();
                setItems((old) => {
                  if (old.length >= 100) return old;
                  let number = 1;
                  while (old.some((m) => Number(m.number) === number)) number++;
                  return [...old, { id, number: String(number), x, y, value: null }];
                });
                setError(undefined);
              });
            }}
          >
            <View pointerEvents="none" style={{ flex: 1 }}>
              <SvgXml
                width="100%"
                height="100%"
                xml={photoAnnotationsSvg(source.uri, source.width, source.height, annotations)}
              />
            </View>
          </Pressable>
        </View>
        {moving && (
          <Button
            title="Cancelar reposicionamento"
            secondary
            small
            onPress={() => setMoving(undefined)}
          />
        )}
        <Button
          title={editable ? 'Pintar / anotar foto' : 'Ver anotações'}
          icon="edit"
          secondary
          small
          onPress={() => validate(onPaint)}
        />
        {!items.length && (
          <Text style={styles.muted}>
            Foto de apoio: sem pontos, será exibida sem linhas de medição abaixo.
          </Text>
        )}
        {items.map((item) => (
          <View
            key={item.id}
            style={{
              padding: 12,
              gap: 8,
              borderWidth: 1,
              borderColor: moving === item.id ? t.colors.blue : t.colors.line,
              borderRadius: 12,
            }}
          >
            <Text style={styles.label}>Ponto {item.number || '—'}</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Número"
                  accessibilityLabel={`Número do ponto ${item.number}`}
                  value={item.number}
                  editable={editable}
                  keyboardType="number-pad"
                  maxLength={4}
                  onChangeText={(number) => update(item.id, { number })}
                />
              </View>
              <View style={{ flex: 2 }}>
                <Field
                  label="Espessura (mm)"
                  accessibilityLabel={`Espessura do ponto ${item.number}`}
                  value={values[item.id] ?? ''}
                  editable={editable}
                  keyboardType="decimal-pad"
                  placeholder="Ex.: 5,9"
                  onChangeText={(text) => setValues((old) => ({ ...old, [item.id]: text }))}
                />
              </View>
            </View>
            {editable && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <MovePoint
                  number={item.number}
                  target={photoRef}
                  onPress={() => setMoving(item.id)}
                />
                <Button
                  title={`Excluir ponto ${item.number}`}
                  icon="trash"
                  small
                  secondary
                  onPress={() => {
                    setItems((old) => old.filter((m) => m.id !== item.id));
                    if (moving === item.id) setMoving(undefined);
                  }}
                />
              </View>
            )}
          </View>
        ))}
      </View>
    </PickerSheet>
  );
}
