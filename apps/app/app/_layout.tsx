import { useEffect } from 'react';
import { View } from 'react-native';
import {
  Stack,
  ThemeProvider as NavigationThemeProvider,
  DarkTheme,
  DefaultTheme,
} from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../stores/auth';
import { ApiError } from '../services/api';
import { useFonts } from 'expo-font';
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import { Loading } from '../components/ui';
import { NavigationConfirmation } from '../components/navigation-confirmation';
import { AppThemeProvider, useTheme } from '../utils/theme';
const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20000,
      retry: (count, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1,
    },
  },
});
export default function RootLayout() {
  return (
    <AppThemeProvider>
      <RootContent />
    </AppThemeProvider>
  );
}
function RootContent() {
  const { mode, tokens: t } = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const hydrate = useAuth((state) => state.hydrate);
  const userId = useAuth((state) => state.session?.user.id);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = 'pt-BR';
  }, []);
  useEffect(() => {
    client.clear();
  }, [userId]);
  if (!fontsLoaded && !fontError)
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.background }}>
        <Loading />
      </View>
    );
  const navigationTheme = {
    ...(mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(mode === 'dark' ? DarkTheme : DefaultTheme).colors,
      primary: t.colors.blue,
      background: t.colors.background,
      card: t.colors.surface,
      text: t.colors.text,
      border: t.colors.line,
      notification: t.colors.danger,
    },
  };
  return (
    <QueryClientProvider client={client}>
      <SafeAreaProvider>
        <NavigationThemeProvider value={navigationTheme}>
          <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: t.colors.background },
            }}
          />
          <NavigationConfirmation />
        </NavigationThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
