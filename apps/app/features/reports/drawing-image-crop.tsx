import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, PanResponder, Text, View, useWindowDimensions } from 'react-native';
import { clampDrawingCrop, fullDrawingCrop, type DrawingCrop } from '@weldcosta/shared';
import { PickerSheet } from '../../components/picker-sheet';
import { Button } from '../../components/ui';
import { useTheme } from '../../utils/theme';

export function DrawingImageCrop({
  uri,
  aspect,
  initial,
  onClose,
  onApply,
}: {
  uri: string;
  aspect: number;
  initial?: DrawingCrop;
  onClose(): void;
  onApply(crop: DrawingCrop): string | void;
}) {
  const { styles } = useTheme();
  const window = useWindowDimensions();
  const [crop, setCrop] = useState(initial ?? fullDrawingCrop);
  const [width, setWidth] = useState(300);
  const cropRef = useRef(crop);
  const dragStart = useRef(fullDrawingCrop);
  cropRef.current = crop;
  const height = Math.min(340, window.height * 0.4);
  const iw = Math.min(width, height * aspect),
    ih = iw / aspect;
  const dimensions = useRef({ iw, ih });
  dimensions.current = { iw, ih };
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [applyError, setApplyError] = useState('');
  useEffect(() => {
    setCrop(initial ?? fullDrawingCrop);
  }, [uri, initial]);
  const responders = useMemo(() => {
    const handlers = (mode: 'move' | 'tl' | 'tr' | 'bl' | 'br') =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          dragStart.current = { ...cropRef.current };
        },
        onPanResponderMove: (_event, gesture) => {
          const start = dragStart.current;
          const dx = gesture.dx / dimensions.current.iw,
            dy = gesture.dy / dimensions.current.ih;
          if (mode === 'move') {
            setCrop(clampDrawingCrop({ ...start, x: start.x + dx, y: start.y + dy }));
            return;
          }
          let left = start.x,
            top = start.y,
            right = left + start.width,
            bottom = top + start.height;
          if (mode.endsWith('l')) left = Math.max(0, Math.min(right - 0.05, left + dx));
          else right = Math.min(1, Math.max(left + 0.05, right + dx));
          if (mode.startsWith('t')) top = Math.max(0, Math.min(bottom - 0.05, top + dy));
          else bottom = Math.min(1, Math.max(top + 0.05, bottom + dy));
          setCrop(clampDrawingCrop({ x: left, y: top, width: right - left, height: bottom - top }));
        },
      }).panHandlers;
    return {
      move: handlers('move'),
      tl: handlers('tl'),
      tr: handlers('tr'),
      bl: handlers('bl'),
      br: handlers('br'),
    };
  }, []);
  const shade = 'rgba(0,0,0,0.55)';
  const x = crop.x * iw,
    y = crop.y * ih,
    w = crop.width * iw,
    h = crop.height * ih;
  return (
    <PickerSheet
      visible
      title="Recortar imagem"
      icon="crop"
      onClose={onClose}
      subtitle="Arraste os cantos para recortar e o centro para mover a área."
      footer={
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button title="Cancelar recorte" secondary onPress={onClose} />
          <Button
            title="Aplicar recorte"
            icon="check"
            disabled={!loaded || error}
            onPress={() => setApplyError(onApply(crop) ?? '')}
          />
        </View>
      }
    >
      <View style={{ padding: 16, gap: 14 }}>
        <View
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          style={{
            height,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0B1420',
            borderRadius: 8,
          }}
        >
          <View testID="drawing-crop-preview" style={{ width: iw, height: ih }}>
            <Image
              source={{ uri }}
              resizeMode="contain"
              onLoad={() => setLoaded(true)}
              onError={() => setError(true)}
              style={{ position: 'absolute', inset: 0 }}
            />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: iw,
                height: y,
                backgroundColor: shade,
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                top: y + h,
                width: iw,
                height: ih - y - h,
                backgroundColor: shade,
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                top: y,
                width: x,
                height: h,
                backgroundColor: shade,
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: x + w,
                top: y,
                width: iw - x - w,
                height: h,
                backgroundColor: shade,
              }}
            />
            <View
              testID="drawing-crop-area"
              {...responders.move}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width: w,
                height: h,
                borderWidth: 1.5,
                borderColor: '#fff',
              }}
            />
            {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
              <View
                key={corner}
                testID={'drawing-crop-' + corner}
                accessibilityLabel={'Canto do recorte ' + corner}
                {...responders[corner]}
                style={{
                  position: 'absolute',
                  left: x + (corner.endsWith('r') ? w : 0) - 16,
                  top: y + (corner.startsWith('b') ? h : 0) - 16,
                  width: 32,
                  height: 32,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  pointerEvents="none"
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    borderWidth: 2,
                    borderColor: '#fff',
                    backgroundColor: '#1764C0',
                  }}
                />
              </View>
            ))}
          </View>
        </View>
        {!!applyError && (
          <Text accessibilityRole="alert" style={styles.muted}>
            {applyError}
          </Text>
        )}
        {error && (
          <Text accessibilityRole="alert" style={styles.muted}>
            Não foi possível abrir a imagem. Feche e tente novamente.
          </Text>
        )}
        <Text style={styles.muted}>
          Área escolhida: {Math.round(crop.width * 100)}% × {Math.round(crop.height * 100)}%. O
          arquivo original é preservado.
        </Text>
        <Button
          title="Restaurar imagem inteira"
          small
          secondary
          onPress={() => setCrop({ ...fullDrawingCrop })}
        />
      </View>
    </PickerSheet>
  );
}
