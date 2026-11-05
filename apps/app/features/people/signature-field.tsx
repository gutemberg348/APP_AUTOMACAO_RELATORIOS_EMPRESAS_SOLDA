import { useEffect, useState } from 'react';
import { Image, View, Text, Keyboard } from 'react-native';
import { apiBlob } from '../../services/api';
import { localSignature, saveLocalSignature } from './offline-signatures';
import { signatureStrokePath, type SignaturePoint } from '@weldcosta/shared';
import Svg, { Path } from 'react-native-svg';
import { MediaSourcePicker } from '../../components/media-source-picker';
import { Button, Notice } from '../../components/ui';
import { useTheme } from '../../utils/theme';
import { SignaturePad } from './signature-pad';

export function SignaturePreview({ id }: { id: string }) {
  const [strokes, setStrokes] = useState<SignaturePoint[][]>();
  const [uri, setUri] = useState('');
  const [error, setError] = useState<unknown>();
  useEffect(() => {
    let active = true;
    setUri('');
    setError(undefined);
    setStrokes(undefined);
    void localSignature(id)
      .then(async (local) => {
        if (local?.strokes) {
          if (active) setStrokes(local.strokes);
          return undefined;
        }
        if (local?.asset) {
          if (active) setUri(local.asset.uri);
          return undefined;
        }
        return apiBlob('/people/signatures/' + (local?.remoteId ?? id));
      })
      .then((blob) =>
        blob
          ? new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            })
          : undefined,
      )
      .then((value) => {
        if (active && value) setUri(value);
      })
      .catch((e) => {
        if (active) setError(e);
      });
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <View>
      <Notice error={error} />
      {strokes ? (
        <Svg
          viewBox="0 0 1000 500"
          style={{ height: 100, width: '100%', backgroundColor: 'white' }}
        >
          {strokes.map((stroke, index) => (
            <Path
              key={index}
              d={signatureStrokePath(stroke)}
              stroke="#14243a"
              strokeWidth={4}
              fill="none"
            />
          ))}
        </Svg>
      ) : uri ? (
        <Image
          source={{ uri }}
          accessibilityLabel="Assinatura selecionada"
          resizeMode="contain"
          style={{ height: 100, width: '100%', backgroundColor: 'white', borderRadius: 10 }}
        />
      ) : null}
    </View>
  );
}
export function SignatureField({
  value,
  onChange,
  editable = true,
}: {
  value?: string | null;
  onChange(id: string | null): void;
  editable?: boolean;
}) {
  const { styles } = useTheme();
  const [upload, setUpload] = useState(false),
    [draw, setDraw] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.label}>Assinatura</Text>
      {value ? (
        <SignaturePreview id={value} />
      ) : (
        <Text style={styles.muted}>Sem assinatura. Pode assinar agora ou enviar uma imagem.</Text>
      )}
      <Notice error={error} />
      {editable && (
        <>
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            <Button
              title="Assinar na tela"
              icon="edit"
              secondary
              small
              disabled={busy}
              onPress={() => {
                Keyboard.dismiss();
                setDraw(true);
                setError(undefined);
              }}
            />
            <Button
              title="Enviar assinatura"
              icon="image"
              secondary
              small
              disabled={busy}
              onPress={() => {
                Keyboard.dismiss();
                setUpload(true);
              }}
            />
            {!!value && (
              <Button
                title="Retirar assinatura"
                variant="ghost"
                small
                disabled={busy}
                onPress={() => onChange(null)}
              />
            )}
          </View>
          {draw && (
            <SignaturePad
              onClose={() => setDraw(false)}
              onSaved={(id) => {
                onChange(id);
                setDraw(false);
              }}
            />
          )}
          <MediaSourcePicker
            visible={upload}
            onClose={() => setUpload(false)}
            onSelect={async (asset, onProgress) => {
              setBusy(true);
              setError(undefined);
              try {
                onProgress('Preparando assinatura…');
                if (asset.size && asset.size > 5 * 1024 * 1024)
                  throw new Error('Escolha uma assinatura de até 5 MB.');
                const saved = await saveLocalSignature({ asset });
                onChange(saved.id);
                setDraw(false);
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      )}
    </View>
  );
}
