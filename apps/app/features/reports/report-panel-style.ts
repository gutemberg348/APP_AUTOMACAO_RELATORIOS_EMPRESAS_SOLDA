import type { ViewStyle } from 'react-native';
import type { ThemeTokens } from '../../utils/tokens';

export function reportPanelStyle(t: ThemeTokens, open: boolean): ViewStyle {
  return {
    borderWidth: 1,
    borderColor: open ? t.colors.blue : t.colors.line,
    borderRadius: 16,
    backgroundColor: t.colors.surface,
    boxShadow: open ? '0 0 0 2px rgba(70,145,240,0.12), 0 6px 20px rgba(23,100,192,0.08)' : 'none',
  };
}
