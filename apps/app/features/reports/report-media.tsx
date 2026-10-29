import { useTheme } from '../../utils/theme';
import { useState, useEffect } from 'react';
import { Image, Platform, View, Text } from 'react-native';
import type { Report, ReportMedia } from '@weldcosta/shared';
import { apiBlob, apiUrl } from '../../services/api';
import { useAuth } from '../../stores/auth';
import { Notice, PanelHeader, FormGrid, FormCell } from '../../components/ui';
import { PhotoPreview } from './photo-preview';
export function MediaImage({
  reportId,
  item,
  height = 200,
}: {
  reportId: string;
  item: ReportMedia;
  height?: number;
}) {
  return item.annotations?.elements.length ? (
    <PhotoPreview
      reportId={reportId}
      mediaId={item.id}
      annotations={item.annotations}
      height={height}
    />
  ) : (
    <OriginalMediaImage reportId={reportId} item={item} height={height} />
  );
}
function OriginalMediaImage({
  reportId,
  item,
  height = 200,
}: {
  reportId: string;
  item: ReportMedia;
  height?: number;
}) {
  const { tokens: t } = useTheme();
  const [uri, setUri] = useState(''),
    [error, setError] = useState<unknown>();
  const token = useAuth((state) => state.session?.accessToken);
  const path = '/reports/' + reportId + '/media/' + item.id;
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let active = true,
      url = '';
    void apiBlob(path)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        if (active) setUri(url);
        else URL.revokeObjectURL(url);
      })
      .catch(setError);
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);
  return (
    <View>
      <Notice error={error} />
      {(Platform.OS !== 'web' || !!uri) && (
        <Image
          accessibilityLabel={item.caption || item.originalName}
          source={
            Platform.OS === 'web'
              ? { uri }
              : { uri: apiUrl + path, headers: { Authorization: 'Bearer ' + token } }
          }
          resizeMode="contain"
          style={{
            width: '100%',
            height,
            backgroundColor: t.colors.disabled,
            borderRadius: 10,
          }}
        />
      )}
    </View>
  );
}
export function ReportMediaPanel({ report }: { report: Report }) {
  const { styles } = useTheme();
  return (
    <View style={{ gap: 18 }}>
      <PanelHeader
        title="Fotos do relatório"
        subtitle="Imagens dos pontos e registros adicionais incluídos no documento."
        icon="image"
      />
      <FormGrid>
        {(report.media ?? [])
          .filter((item) => !item.clientUploadId?.startsWith('drawing-image-'))
          .map((item) => (
            <FormCell key={item.id}>
              <View style={{ gap: 8 }}>
                <MediaImage reportId={report.id} item={item} />
                <Text style={styles.label}>
                  {item.sectionKey === 'drawing'
                    ? 'Croqui anexado'
                    : item.reportPointId
                      ? 'Ponto / solda ' +
                        (report.points?.find((point) => point.id === item.reportPointId)?.number ??
                          '')
                      : 'Foto adicional'}
                </Text>
                <Text style={styles.muted}>{item.caption || item.originalName}</Text>
              </View>
            </FormCell>
          ))}
      </FormGrid>
      {!report.media?.length && <Text style={styles.muted}>Nenhuma imagem anexada.</Text>}
    </View>
  );
}
