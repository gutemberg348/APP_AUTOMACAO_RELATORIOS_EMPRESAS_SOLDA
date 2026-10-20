import { Children, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { Icon } from '../../components/icon';
import { useTheme } from '../../utils/theme';

/** Passive edge hints leave the full width and all touch gestures to the tools. */
export function DrawingToolStrip({
  children,
  label,
  rows = 1,
}: {
  children: ReactNode;
  label: string;
  rows?: 1 | 2;
}) {
  const { tokens: t } = useTheme();
  const [position, setPosition] = useState(0);
  const [width, setWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const end = Math.max(0, contentWidth - width);
  const items = Children.toArray(children);
  const columns = Math.ceil(items.length / 2);
  const arrow = (direction: -1 | 1) => {
    const visible = direction < 0 ? position > 1 : position < end - 1;
    if (!visible) return null;
    return (
      <View
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID={`scroll-hint-${label}-${direction < 0 ? 'left' : 'right'}`}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          [direction < 0 ? 'left' : 'right']: 2,
          width: 18,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.55,
        }}
      >
        <Icon name={direction < 0 ? 'arrow-left' : 'arrow-right'} size={18} color={t.colors.text} />
      </View>
    );
  };
  return (
    <View style={{ position: 'relative', flexShrink: 0 }}>
      <ScrollView
        horizontal
        accessibilityLabel={label}
        accessibilityHint="Deslize para os lados para ver mais opções."
        style={{ width: '100%', minWidth: 0 }}
        contentContainerStyle={{ gap: 6, paddingVertical: 8 }}
        showsHorizontalScrollIndicator
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onContentSizeChange={(nextWidth) => setContentWidth(nextWidth)}
        onScroll={(event) => {
          setPosition(event.nativeEvent.contentOffset.x);
        }}
      >
        {rows === 1
          ? children
          : items.slice(0, columns).map((item, index) => (
              <View key={index} style={{ gap: 6, width: 144 }}>
                {item}
                {items[index + columns]}
              </View>
            ))}
      </ScrollView>
      {arrow(-1)}
      {arrow(1)}
    </View>
  );
}
