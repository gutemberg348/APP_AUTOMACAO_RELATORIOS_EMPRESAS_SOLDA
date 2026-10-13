import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { darkTokens, tokens } from './tokens';
import { createThemeStyles } from './theme-styles';
import { themeStorage, type ThemeMode } from '../services/theme-storage';

const palettes = {
  light: { tokens, styles: createThemeStyles(tokens) },
  dark: { tokens: darkTokens, styles: createThemeStyles(darkTokens) },
};
const ThemeContext = createContext({
  ...palettes.light,
  mode: 'light' as ThemeMode,
  toggle: () => {},
});

export function AppThemeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<ThemeMode>('light');
  const changed = useRef(false);
  useEffect(() => {
    let active = true;
    void themeStorage.get().then((saved) => {
      if (active && saved && !changed.current) setMode(saved);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.style.colorScheme = mode;
    document.documentElement.style.backgroundColor = palettes[mode].tokens.colors.background;
  }, [mode]);
  const value = useMemo(
    () => ({
      ...palettes[mode],
      mode,
      toggle: () => {
        changed.current = true;
        const next = mode === 'light' ? 'dark' : 'light';
        setMode(next);
        void themeStorage.set(next);
      },
    }),
    [mode],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
