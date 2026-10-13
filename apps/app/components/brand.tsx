import { useTheme } from '../utils/theme';
import { View, Text } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

export function Brand({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  const { tokens: t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      <Svg width={compact ? 30 : 38} height={compact ? 30 : 38} viewBox="0 0 44 44" aria-hidden>
        <Path
          d="m19 3 6 0 1 4 4 2 4-1 3 5-3 3v5l3 3-3 5-4-1-4 2-1 4h-6l-1-4-4-2-4 1-3-5 3-3v-5l-3-3 3-5 4 1 4-2 1-4Z"
          fill={light ? '#224663' : t.colors.blueSoft}
        />
        <Circle
          cx={22}
          cy={19.5}
          r={11}
          stroke={light ? '#90C1F5' : t.colors.blue}
          strokeWidth={2.3}
          fill="none"
        />
        <Circle
          cx={22}
          cy={19.5}
          r={6.5}
          stroke={light ? 'white' : t.colors.brandText}
          strokeWidth={1.8}
          fill="none"
        />
        <Path d="M1 19.5h8m26 0h8" stroke="#DD665C" strokeWidth={2.3} />
      </Svg>
      <View>
        <Text
          style={{
            fontFamily: t.fonts.extra,
            color: light ? 'white' : t.colors.brandText,
            fontSize: compact ? 18 : 22,
            letterSpacing: -0.6,
          }}
        >
          WELD<Text style={{ color: light ? '#90C1F5' : t.colors.blue }}>COSTA</Text>
        </Text>
        {!compact && (
          <Text
            style={{
              fontFamily: t.fonts.semibold,
              color: light ? '#AFC5DB' : t.colors.muted,
              fontSize: 7.5,
              letterSpacing: 1.65,
            }}
          >
            INSPEÇÕES INDUSTRIAIS
          </Text>
        )}
      </View>
    </View>
  );
}
