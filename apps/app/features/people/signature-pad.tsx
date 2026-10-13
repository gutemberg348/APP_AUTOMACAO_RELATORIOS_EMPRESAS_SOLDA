import { useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Text,
  View,
  type GestureResponderEvent,
  type ViewStyle,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path, Line } from 'react-native-svg';
import { fitSignatureStrokes, signatureStrokePath, type SignaturePoint } from '@weldcosta/shared';
import { Button, Notice } from '../../components/ui';
import { useTheme } from '../../utils/theme';
import { api, jsonBody } from '../../services/api';

function Pad({ onClose, onSaved }: { onClose(): void; onSaved(id: string): void }) {
  const { styles, tokens: t, mode } = useTheme();
  const [strokes, setStrokes] = useState<SignaturePoint[][]>([]);
  const [live, setLive] = useState<SignaturePoint[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [logicalHeight, setLogicalHeight] = useState(500);
  const size = useRef({ width: 1, height: 1 });
  const current = useRef<SignaturePoint[]>([]);
  const point = (event: GestureResponderEvent) => ({
    x: Math.max(0, Math.min(1000, (event.nativeEvent.locationX * 1000) / size.current.width)),
    y: Math.max(
      0,
      Math.min(logicalHeight, (event.nativeEvent.locationY * 1000) / size.current.width),
    ),
  });
  const finish = () => {
    const stroke = current.current;
    if (stroke.length > 1) setStrokes((old) => [...old, stroke]);
    current.current = [];
    setLive([]);
  };
  const clear = () => {
    current.current = [];
    setStrokes([]);
    setLive([]);
    setError(undefined);
  };
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: t.colors.surface }}
      edges={['top', 'bottom', 'left', 'right']}
      testID="signature-safe-area"
    >
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 12,
          borderBottomWidth: 1,
          borderColor: t.colors.line,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.text, { fontFamily: t.fonts.bold, fontSize: 18 }]}>
            Sua assinatura
          </Text>
          <Text style={[styles.muted, { fontSize: 12 }]}>
            Use o dedo ou o mouse. Pode girar o aparelho.
          </Text>
        </View>
        <Button
          title="Cancelar"
          secondary
          small
          disabled={busy}
          onPress={onClose}
          style={{ minHeight: 44 }}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, padding: 12 }}>
        <Button
          title="Desfazer traço"
          icon="undo"
          secondary
          small
          disabled={busy || !strokes.length}
          onPress={() => setStrokes((old) => old.slice(0, -1))}
          style={{ minHeight: 44 }}
        />
        <Button
          title="Limpar"
          icon="trash"
          secondary
          small
          disabled={busy || (!strokes.length && !live.length)}
          onPress={clear}
          style={{ minHeight: 44 }}
        />
      </View>
      <View style={{ flex: 1, minHeight: 0, paddingHorizontal: 12, paddingBottom: 12 }}>
        <View
          accessibilityLabel="Área para desenhar assinatura"
          testID="signature-canvas"
          style={
            {
              flex: 1,
              backgroundColor: 'white',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: t.colors.line,
              overflow: 'hidden',
              touchAction: 'none',
              userSelect: 'none',
            } as ViewStyle
          }
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            if (!width || !height) return;
            const nextHeight = (height * 1000) / width;
            if (size.current.width > 1 && Math.abs(nextHeight - logicalHeight) > 1) {
              current.current = [];
              setLive([]);
              setStrokes((old) => fitSignatureStrokes(old, nextHeight));
            }
            size.current = { width, height };
            setLogicalHeight(nextHeight);
          }}
          onStartShouldSetResponder={() => !busy}
          onMoveShouldSetResponder={() => !busy}
          onResponderTerminationRequest={() => false}
          onResponderGrant={(event) => {
            if (strokes.length >= 100) {
              setError(new Error('Limite de traços atingido. Desfaça ou limpe para continuar.'));
              return;
            }
            setError(undefined);
            current.current = [point(event)];
            setLive(current.current);
          }}
          onResponderMove={(event) => {
            if (!current.current.length) return;
            const next = point(event),
              previous = current.current.at(-1)!;
            if (Math.hypot(next.x - previous.x, next.y - previous.y) < 1) return;
            if (current.current.length < 3000) {
              current.current = [...current.current, next];
              setLive(current.current);
            }
          }}
          onResponderRelease={finish}
          onResponderTerminate={finish}
        >
          <Svg
            width="100%"
            height="100%"
            viewBox={`0 0 1000 ${logicalHeight}`}
            preserveAspectRatio="none"
            pointerEvents="none"
          >
            <Line
              x1="70"
              x2="930"
              y1={logicalHeight * 0.74}
              y2={logicalHeight * 0.74}
              stroke="#E4EAF2"
              strokeDasharray="8 8"
              strokeWidth="1"
            />
            {[...strokes, live].map((stroke, index) => (
              <Path
                key={index}
                d={signatureStrokePath(stroke)}
                fill="none"
                stroke="#14243a"
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </Svg>
          {!strokes.length && !live.length && (
            <Text
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: '45%',
                width: '100%',
                textAlign: 'center',
                color: '#7D8DA1',
                fontSize: 18,
              }}
            >
              Assine aqui
            </Text>
          )}
        </View>
      </View>
      <View style={{ padding: 12, borderTopWidth: 1, borderColor: t.colors.line, gap: 8 }}>
        <Notice error={error} />
        <Button
          title="Usar esta assinatura"
          icon="check"
          busy={busy}
          disabled={busy || !strokes.length}
          onPress={async () => {
            setBusy(true);
            setError(undefined);
            Keyboard.dismiss();
            try {
              const saved = await api<{ id: string }>(
                '/people/signatures/draw',
                jsonBody('POST', { strokes: fitSignatureStrokes(strokes) }),
              );
              onSaved(saved.id);
            } catch (cause) {
              setError(cause);
            } finally {
              setBusy(false);
            }
          }}
        />
      </View>
    </SafeAreaView>
  );
}

export function SignaturePad(props: { onClose(): void; onSaved(id: string): void }) {
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      supportedOrientations={['portrait', 'landscape']}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={props.onClose}
      accessibilityLabel="Assinar em tela cheia"
    >
      <SafeAreaProvider>
        <Pad {...props} />
      </SafeAreaProvider>
    </Modal>
  );
}
