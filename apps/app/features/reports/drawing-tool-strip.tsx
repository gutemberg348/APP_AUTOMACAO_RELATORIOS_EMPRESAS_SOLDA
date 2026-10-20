import { useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Icon } from '../../components/icon';
import { useTheme } from '../../utils/theme';

/** Keep the scroll controls outside the strip so they never disappear with its tools. */
export function DrawingToolStrip({ children, label }: { children: ReactNode; label: string }) {
  const { tokens: t } = useTheme();
  const scroll = useRef<ScrollView>(null);
  const offset = useRef(0);
  const [position, setPosition] = useState(0);
  const [width, setWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const end = Math.max(0, contentWidth - width);
  const arrow = (direction: -1 | 1) => {
    const disabled = direction < 0 ? position <= 1 : position >= end - 1;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Rolar ${label} para a ${direction < 0 ? 'esquerda' : 'direita'}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => {
          const x = Math.max(0, Math.min(end, offset.current + direction * width * 0.8));
          offset.current = x;
          scroll.current?.scrollTo({ x, animated: true });
        }}
        style={{
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          backgroundColor: t.colors.blueSoft,
          opacity: disabled ? 0.3 : 1,
          flexShrink: 0,
        }}
      >
        <Icon name={direction < 0 ? 'arrow-left' : 'arrow-right'} size={22} color={t.colors.text} />
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      {arrow(-1)}
      <ScrollView
        ref={scroll}
        horizontal
        style={{ flex: 1, minWidth: 0 }}
        contentContainerStyle={{ gap: 6, paddingVertical: 8 }}
        showsHorizontalScrollIndicator
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onContentSizeChange={(nextWidth) => setContentWidth(nextWidth)}
        onScroll={(event) => {
          offset.current = event.nativeEvent.contentOffset.x;
          setPosition(offset.current);
        }}
      >
        {children}
      </ScrollView>
      {arrow(1)}
    </View>
  );
}
