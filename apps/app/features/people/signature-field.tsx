import { useEffect, useState } from 'react';
import { Image, View, Text, Platform, Keyboard } from 'react-native';
import { api, apiBlob, apiUrl } from '../../services/api';
import { useAuth } from '../../stores/auth';
import { appendUploadFile } from '../../services/upload-file';
import { MediaSourcePicker } from '../../components/media-source-picker';
import { Button, Notice } from '../../components/ui';
import { useTheme } from '../../utils/theme';
import { SignaturePad } from './signature-pad';

export function SignaturePreview({ id }: { id: string }) {
  const token = useAuth((state) => state.session?.accessToken);
  const path = '/people/signatures/' + id;
  const [uri, setUri] = useState('');
  const [error, setError] = useState<unknown>();
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let active = true;
    setUri('');
    setError(undefined);
    void apiBlob('/people/signatures/' + id)
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          }),
      )
      .then((value) => {
        if (active) setUri(value);
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
      {Platform.OS !== 'web' || uri ? (
        <Image
          source={
            Platform.OS === 'web'
              ? { uri }
              : { uri: apiUrl + path, headers: { Authorization: 'Bearer ' + token } }
          }
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
                const form = new FormData();
                onProgress('Preparando assinatura…');
                await appendUploadFile(form, asset, 5 * 1024 * 1024);
                onProgress('Enviando assinatura…');
                const saved = await api<{ id: string }>('/people/signatures/upload', {
                  method: 'POST',
                  body: form,
                });
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
