import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { photoAnnotationsSvg, type PhotoAnnotations } from '@weldcosta/shared';
import { apiBlob } from '../../services/api';
import { Button, Notice } from '../../components/ui';
import { useTheme } from '../../utils/theme';

export type PhotoSource = { uri: string; width: number; height: number };
const dataUri = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível abrir a foto. Tente novamente.'));
    reader.readAsDataURL(blob);
  });
export function PhotoPreview({
  uri,
  reportId,
  mediaId,
  annotations,
  height = 140,
  action,
  onOpen,
}: {
  uri?: string;
  reportId?: string;
  mediaId?: string;
  annotations?: PhotoAnnotations | null;
  height?: number;
  action?: string;
  onOpen?(source: PhotoSource): void;
}) {
  const { tokens: t, styles } = useTheme();
  const [source, setSource] = useState<PhotoSource>();
  const [error, setError] = useState<unknown>();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setSource(undefined);
    setError(undefined);
    void (async () => {
      const src =
        uri ?? (await dataUri(await apiBlob('/reports/' + reportId + '/media/' + mediaId)));
      const size = await new Promise<{ width: number; height: number }>((resolve, reject) =>
        Image.getSize(
          src,
          (width, height) => resolve({ width, height }),
          () => reject(new Error('Não foi possível ler a foto. Tente novamente.')),
        ),
      );
      if (active) setSource({ uri: src, ...size });
    })().catch((cause) => {
      if (active) setError(cause);
    });
    return () => {
      active = false;
    };
  }, [uri, reportId, mediaId, retry]);
  return (
    <View style={{ gap: 6 }}>
      <View
        style={{
          height,
          backgroundColor: t.colors.soft,
          borderRadius: 10,
          overflow: 'hidden',
          justifyContent: 'center',
        }}
      >
        {source ? (
          <SvgXml
            xml={photoAnnotationsSvg(
              source.uri,
              source.width,
              source.height,
              annotations ?? { elements: [] },
            )}
            width="100%"
            height="100%"
          />
        ) : (
          !error && (
            <View style={{ alignItems: 'center', gap: 6 }}>
              <ActivityIndicator color={t.colors.blue} />
              <Text style={styles.muted}>Carregando foto…</Text>
            </View>
          )
        )}
      </View>
      <Notice error={error} />
      {annotations?.measurements
        ?.filter((point) => point.value != null)
        .map((point) => (
          <Text key={point.id} style={styles.label}>
            Ponto {point.number}:{' '}
            {point.value!.toLocaleString('pt-BR', { maximumFractionDigits: 20 })} mm
          </Text>
        ))}
      {!!error && (
        <Button
          title="Tentar abrir foto novamente"
          secondary
          small
          onPress={() => setRetry((v) => v + 1)}
        />
      )}
      {onOpen && (
        <Button
          title={action ?? 'Ver e pintar foto'}
          icon="image"
          secondary
          small
          disabled={!source}
          onPress={() => {
            if (source) onOpen(source);
          }}
        />
      )}
    </View>
  );
}
