import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTheme } from '../../utils/theme';

export function TutorialVideo({ uri, headers }: { uri: string; headers?: Record<string, string> }) {
  const { styles } = useTheme();
  const [failed, setFailed] = useState(false);
  const player = useVideoPlayer({ uri, headers });
  useEffect(() => {
    const subscription = player.addListener('statusChange', (event) =>
      setFailed(event.status === 'error'),
    );
    return () => subscription.remove();
  }, [player]);
  return (
    <View style={{ gap: 12 }}>
      <VideoView
        player={player}
        nativeControls
        fullscreenOptions={{ enable: true }}
        contentFit="contain"
        style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: 12 }}
      />
      {failed && (
        <Text style={styles.muted}>
          Não foi possível reproduzir neste dispositivo. Use Baixar material para abrir em outro
          aplicativo.
        </Text>
      )}
    </View>
  );
}
