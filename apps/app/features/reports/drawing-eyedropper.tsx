import { createContext, useContext, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import Svg, { SvgXml } from 'react-native-svg';
import { rgbHex, sampleDrawingPng } from './drawing-sample-color';
import { Icon } from '../../components/icon';
import { PickerSheet } from '../../components/picker-sheet';
import { Button } from '../../components/ui';
import { useTheme } from '../../utils/theme';

export const DrawingColorSource = createContext('');

async function webPixel(source: string, x: number, y: number) {
  // Images referenced by an SVG loaded into a browser canvas must be embedded.
  let xml = source;
  const uris = [...new Set([...xml.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!))];
  for (const escaped of uris) {
    if (escaped.startsWith('data:')) continue;
    const uri = escaped.replace(/&amp;/g, '&').replace(/&quot;/g, '"');
    const response = await fetch(uri);
    if (!response.ok) throw new Error('Imagem indisponível');
    const blob = await response.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    xml = xml.split(escaped).join(data);
  }
  xml = xml.replace('width="100%" height="100%"', 'width="1000" height="800"');
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
  try {
    const image = new globalThis.Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = reject;
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 800;
    const context = canvas.getContext('2d')!;
    context.fillStyle = 'white';
    context.fillRect(0, 0, 1000, 800);
    context.drawImage(image, 0, 0, 1000, 800);
    return rgbHex(
      [
        ...context.getImageData(
          Math.min(999, Math.floor(x * 1000)),
          Math.min(799, Math.floor(y * 800)),
          1,
          1,
        ).data,
      ].slice(0, 3),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function DrawingEyedropper({ onChange }: { onChange(color: string): void }) {
  const source = useContext(DrawingColorSource);
  const { styles, tokens: t } = useTheme();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const [color, setColor] = useState<string>(),
    [error, setError] = useState('');
  const [point, setPoint] = useState<{ x: number; y: number }>();
  const svg = useRef<Svg>(null),
    size = useRef({ width: 1, height: 1 }),
    request = useRef(0);
  const close = () => {
    request.current++;
    setOpen(false);
    setBusy(false);
  };
  const pick = async (px: number, py: number) => {
    if (busy) return;
    if (!Number.isFinite(px) || !Number.isFinite(py)) return;
    const x = Math.max(0, Math.min(1, px / size.current.width));
    const y = Math.max(0, Math.min(1, py / size.current.height));
    const token = ++request.current;
    setBusy(true);
    setError('');
    setColor(undefined);
    setPoint(undefined);
    try {
      let next: string;
      if (Platform.OS === 'web') next = await webPixel(source, x, y);
      else {
        const base64 = await new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Tempo esgotado')), 6000);
          if (!svg.current) {
            clearTimeout(timeout);
            reject(new Error('Prévia indisponível'));
            return;
          }
          // Export at the displayed SVG bounds. On iOS, supplying larger bounds
          // enlarges the bitmap but drawRect still draws at the view's own size.
          svg.current.toDataURL((value) => {
            clearTimeout(timeout);
            resolve(value);
          });
        });
        next = sampleDrawingPng(
          Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
          x,
          y,
        );
      }
      if (token === request.current) {
        setColor(next);
        setPoint({ x: x * 100, y: y * 100 });
      }
    } catch {
      if (token === request.current)
        setError('Não foi possível ler esta cor. Aguarde a imagem carregar e toque novamente.');
    } finally {
      if (token === request.current) setBusy(false);
    }
  };
  if (!source) return null;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Conta-gotas · pegar cor"
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          borderWidth: 2,
          borderColor: t.colors.line,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: t.colors.soft,
        }}
        onPress={() => {
          setColor(undefined);
          setPoint(undefined);
          setError('');
          setOpen(true);
        }}
      >
        <Icon name="eyedropper" size={22} color={t.colors.text} />
      </Pressable>
      <PickerSheet
        visible={open}
        title="Conta-gotas"
        icon="eyedropper"
        subtitle="Toque na cor do desenho ou da foto que deseja usar."
        onClose={close}
        footer={
          <Button
            title="Usar cor capturada"
            icon="check"
            disabled={!color || busy}
            onPress={() => {
              if (color) onChange(color);
              close();
            }}
          />
        }
      >
        <View
          testID="drawing-eyedropper-sample"
          accessibilityRole="button"
          accessibilityLabel="Capturar cor da prévia"
          onLayout={(e) => {
            size.current = e.nativeEvent.layout;
          }}
          onStartShouldSetResponder={() => true}
          onResponderRelease={(e) => void pick(e.nativeEvent.locationX, e.nativeEvent.locationY)}
          style={{
            width: '100%',
            aspectRatio: 1.25,
            backgroundColor: 'white',
          }}
        >
          <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
            <SvgXml xml={source} override={{ ref: svg, width: '100%', height: '100%' }} />
          </View>
          {point && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: `${point.x}%`,
                top: `${point.y}%`,
                width: 16,
                height: 16,
                marginLeft: -8,
                marginTop: -8,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: 'white',
                backgroundColor: color,
                boxShadow: '0 0 0 1px black',
              }}
            />
          )}
        </View>
        {busy && (
          <Text accessibilityRole="alert" style={styles.muted}>
            Capturando cor…
          </Text>
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={[styles.text, { color: t.colors.danger }]}>
            {error}
          </Text>
        )}
        {color && (
          <View
            style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 12 }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                backgroundColor: color,
                borderWidth: 1,
                borderColor: t.colors.line,
              }}
            />
            <Text style={styles.label}>Cor capturada</Text>
          </View>
        )}
      </PickerSheet>
    </>
  );
}
