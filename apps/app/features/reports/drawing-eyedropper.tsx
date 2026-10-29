import { createContext, useContext, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import Svg, { SvgXml } from 'react-native-svg';
import { decode } from 'fast-png';
import { PickerSheet } from '../../components/picker-sheet';
import { Button } from '../../components/ui';
import { useTheme } from '../../utils/theme';

export const DrawingColorSource = createContext('');

const hex = (rgb: number[]) =>
  '#' +
  rgb
    .map((n) => Math.round(n).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();

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
    return hex([...context.getImageData(x, y, 1, 1).data].slice(0, 3));
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
    width = useRef(1),
    request = useRef(0);
  const close = () => {
    request.current++;
    setOpen(false);
    setBusy(false);
  };
  const pick = async (px: number, py: number) => {
    if (busy) return;
    const x = Math.max(0, Math.min(999, Math.floor((px / width.current) * 1000)));
    const y = Math.max(0, Math.min(799, Math.floor((py / width.current) * 1000)));
    const token = ++request.current;
    setBusy(true);
    setError('');
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
          svg.current.toDataURL(
            (value) => {
              clearTimeout(timeout);
              resolve(value);
            },
            { width: 1000, height: 800 },
          );
        });
        const png = decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
        if (png.depth !== 8 || png.channels < 3 || png.palette)
          throw new Error('Formato de prévia inválido');
        const offset =
          (Math.min(png.height - 1, Math.floor((y / 800) * png.height)) * png.width +
            Math.min(png.width - 1, Math.floor((x / 1000) * png.width))) *
          png.channels;
        const alpha = png.channels === 4 ? png.data[offset + 3]! / 255 : 1;
        next = hex([0, 1, 2].map((c) => png.data[offset + c]! * alpha + 255 * (1 - alpha)));
      }
      if (token === request.current) {
        setColor(next);
        setPoint({ x: x / 10, y: y / 8 });
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
      <Button
        title="Conta-gotas · pegar cor"
        icon="eyedropper"
        secondary
        small
        onPress={() => {
          setColor(undefined);
          setPoint(undefined);
          setError('');
          setOpen(true);
        }}
      />
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
            width.current = e.nativeEvent.layout.width;
          }}
          onStartShouldSetResponder={() => true}
          onResponderRelease={(e) => void pick(e.nativeEvent.locationX, e.nativeEvent.locationY)}
          style={{
            width: '100%',
            aspectRatio: 1.25,
            backgroundColor: 'white',
            borderWidth: 1,
            borderColor: t.colors.line,
          }}
        >
          <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
            <Svg ref={svg} width="100%" height="100%" viewBox="0 0 1000 800">
              <SvgXml xml={source} />
            </Svg>
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
