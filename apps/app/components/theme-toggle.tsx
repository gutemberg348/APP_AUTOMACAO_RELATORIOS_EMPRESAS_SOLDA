import { useState } from 'react';
import { Pressable } from 'react-native';
import { useTheme } from '../utils/theme';
import { Icon } from './icon';

export function ThemeToggle() {
  const { mode, toggle, tokens: t } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const dark = mode === 'dark';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={dark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      accessibilityHint="Alterna a aparência e salva sua preferência neste dispositivo."
      aria-pressed={dark}
      onPress={toggle}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: focused ? t.colors.blue : t.colors.line,
        backgroundColor: pressed || hovered || focused ? t.colors.blueSoft : t.colors.soft,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Icon name={dark ? 'sun' : 'moon'} color={dark ? t.colors.amber : t.colors.muted} size={20} />
    </Pressable>
  );
}
