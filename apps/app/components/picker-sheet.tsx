import { useTheme } from '../utils/theme';
import { useCallback, useEffect, useRef, type PropsWithChildren, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  View,
  Text,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  useWindowDimensions,
  type ScrollViewInstance,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, IconTile } from './ui';
import type { IconName } from './icon';
import { KeyboardScrollView } from './keyboard-scroll-view';
import { PageScrollContext } from './page-scroll';

export function PickerSheet({
  visible,
  title,
  subtitle,
  icon,
  onClose,
  children,
  footer,
  maxWidth = 520,
}: PropsWithChildren<{
  visible: boolean;
  title: string;
  subtitle?: string;
  icon: IconName;
  onClose(): void;
  footer?: ReactNode;
  maxWidth?: number;
}>) {
  const { tokens: t, styles } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const mobile = width < 640;
  const scroll = useRef<ScrollViewInstance>(null),
    offset = useRef(0);
  const reveal = useCallback((target?: ViewInstance | null) => {
    if (!target) {
      scroll.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    scroll.current?.getNativeScrollRef()?.measureInWindow((_x, top) => {
      target.measureInWindow((_targetX, targetTop) => {
        scroll.current?.scrollTo({
          y: Math.max(0, offset.current + targetTop - top - 24),
          animated: true,
        });
      });
    });
  }, []);
  useEffect(() => {
    if (visible) Keyboard.dismiss();
  }, [visible]);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      accessibilityLabel={title}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: mobile ? 'flex-end' : 'center',
          padding: mobile ? 0 : 24,
        }}
      >
        <Pressable
          accessible={false}
          onPress={onClose}
          style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(17,42,71,0.48)' }}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth,
            flexShrink: 1,
            maxHeight: height - Math.max(32, insets.top + 16),
            backgroundColor: t.colors.surface,
            borderRadius: 22,
            borderBottomLeftRadius: mobile ? 0 : 22,
            borderBottomRightRadius: mobile ? 0 : 22,
            overflow: 'hidden',
            boxShadow: '0 24px 70px rgba(17,42,71,0.2)',
            paddingBottom: mobile ? insets.bottom + 12 : 12,
          }}
        >
          {mobile && (
            <View
              style={{
                width: 36,
                height: 4,
                backgroundColor: t.colors.line,
                borderRadius: 8,
                alignSelf: 'center',
                marginTop: 10,
              }}
            />
          )}
          <View
            style={{
              padding: 22,
              paddingBottom: 18,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderBottomWidth: 1,
              borderColor: t.colors.line,
            }}
          >
            <IconTile name={icon} size={40} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                accessibilityRole="header"
                style={{ fontFamily: t.fonts.bold, fontSize: 17, color: t.colors.text }}
              >
                {title}
              </Text>
              {!!subtitle && (
                <Text style={[styles.muted, { fontSize: 11, marginTop: 3 }]}>{subtitle}</Text>
              )}
            </View>
            <IconButton icon="close" label={'Fechar ' + title.toLowerCase()} onPress={onClose} />
          </View>
          <PageScrollContext.Provider value={reveal}>
            <KeyboardScrollView
              scrollRef={scroll}
              onScroll={(event) => {
                offset.current = event.nativeEvent.contentOffset.y;
              }}
              testID="picker-keyboard-scroll"
              automaticallyAdjustKeyboardInsets={false}
              style={{ flexShrink: 1, minHeight: 0 }}
              contentContainerStyle={{ padding: mobile ? 20 : 22, gap: 16 }}
            >
              {children}
            </KeyboardScrollView>
          </PageScrollContext.Provider>
          {footer && (
            <View
              style={{
                padding: 18,
                paddingHorizontal: 22,
                borderTopWidth: 1,
                borderColor: t.colors.line,
                backgroundColor: t.colors.soft,
              }}
            >
              {footer}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
