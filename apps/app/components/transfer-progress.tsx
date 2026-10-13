import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../utils/theme';

export interface TransferState {
  message: string;
  detail?: string;
  completed?: number;
  total?: number;
}
export function TransferProgress({ message, detail, completed, total }: TransferState) {
  const { tokens: t, styles } = useTheme();
  const movement = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(240);
  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(movement, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [movement]);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      accessibilityState={{ busy: true }}
      accessibilityLiveRegion="polite"
      style={{ gap: 14 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <ActivityIndicator size="large" color={t.colors.primary} />
        <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
          <Text style={[styles.text, { fontFamily: t.fonts.bold, fontSize: 16 }]}>{message}</Text>
          {!!detail && (
            <Text numberOfLines={2} style={[styles.muted, { fontSize: 12 }]}>
              {detail}
            </Text>
          )}
        </View>
      </View>
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={{ height: 5, borderRadius: 5, overflow: 'hidden', backgroundColor: t.colors.line }}
      >
        <Animated.View
          style={{
            width: '35%',
            height: 5,
            borderRadius: 5,
            backgroundColor: t.colors.primary,
            transform: [
              {
                translateX: movement.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-width * 0.35, width],
                }),
              },
            ],
          }}
        />
      </View>
      {!!total && (
        <Text style={[styles.muted, { fontSize: 12 }]}>
          {completed ?? 0} de {total} foto{total === 1 ? '' : 's'} enviada{total === 1 ? '' : 's'}
        </Text>
      )}
    </View>
  );
}

export function TransferOverlay({ progress }: { progress?: TransferState }) {
  const { tokens: t, styles } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={!!progress}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
      accessibilityLabel="Envio de imagens em andamento"
    >
      <View
        accessibilityViewIsModal
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 24,
          paddingTop: Math.max(24, insets.top),
          paddingBottom: Math.max(24, insets.bottom),
          backgroundColor: 'rgba(10,20,36,0.62)',
        }}
      >
        <View style={[styles.card, { width: '100%', maxWidth: 430, padding: 24, gap: 18 }]}>
          {!!progress && <TransferProgress {...progress} />}
          <Text style={{ color: t.colors.muted, fontSize: 12, lineHeight: 18 }}>
            Aguarde a conclusão do envio. As fotos estão sendo vinculadas ao relatório.
          </Text>
        </View>
      </View>
    </Modal>
  );
}
