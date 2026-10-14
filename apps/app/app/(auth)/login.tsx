import { useTheme } from '../../utils/theme';
import { useState } from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type AuthSession } from '@weldcosta/shared';
import { useAuth } from '../../stores/auth';
import { api, jsonBody } from '../../services/api';
import { Brand } from '../../components/brand';
import { TechnicalIllustration } from '../../components/technical-illustration';
import { Icon } from '../../components/icon';
import { Button, Field, IconButton, Notice } from '../../components/ui';
import { ThemeToggle } from '../../components/theme-toggle';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardScrollView } from '../../components/keyboard-scroll-view';

export default function Login() {
  const { tokens: t, styles } = useTheme();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<unknown>(),
    [showPassword, setShowPassword] = useState(false);
  const { width, height } = useWindowDimensions(),
    desktop = width >= 960;
  const { session, setSession } = useAuth();
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  if (session) return <Redirect href="/dashboard" />;
  const submit = handleSubmit(async (data) => {
    setError(undefined);
    try {
      await setSession(await api<AuthSession>('/auth/login', jsonBody('POST', data), false));
      router.replace('/dashboard');
    } catch (cause) {
      setError(cause);
    }
  });
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.colors.surface,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
    >
      <View style={{ position: 'absolute', top: insets.top + 16, right: 24, zIndex: 2 }}>
        <ThemeToggle />
      </View>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {desktop && (
          <View
            style={{
              width: '48%',
              backgroundColor: t.colors.navy,
              padding: width >= 1400 ? 56 : 40,
              justifyContent: 'space-between',
              overflow: 'hidden',
            }}
          >
            <Brand light />
            <View style={{ gap: 24, paddingVertical: 30 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 20, height: 2, backgroundColor: '#8AB9E5' }} />
                <Text
                  style={{
                    color: '#A9C7E2',
                    fontFamily: t.fonts.semibold,
                    fontSize: 10,
                    letterSpacing: 2,
                  }}
                >
                  GESTÃO DE INSPEÇÕES INDUSTRIAIS
                </Text>
              </View>
              <Text
                style={{
                  color: t.colors.white,
                  fontFamily: t.fonts.extra,
                  fontSize: width >= 1400 ? 46 : 39,
                  lineHeight: width >= 1400 ? 58 : 51,
                  letterSpacing: -1.8,
                }}
              >
                Controle técnico.{'\n'}Do campo à{'\n'}aprovação.
              </Text>
              <Text
                style={{
                  color: '#BCD0E2',
                  fontFamily: t.fonts.regular,
                  fontSize: 14,
                  lineHeight: 25,
                  maxWidth: 350,
                }}
              >
                Organize suas obras, registre inspeções e acompanhe cada relatório com clareza e
                rastreabilidade.
              </Text>
              <View style={{ marginHorizontal: -20 }}>
                <TechnicalIllustration height={height < 850 ? 160 : 240} />
              </View>
            </View>
            <View style={{ gap: 22 }}>
              <View style={{ flexDirection: 'row', gap: 20, flexWrap: 'wrap' }}>
                {[
                  ['folder', 'Organização'],
                  ['shield', 'Rastreabilidade'],
                  ['check-circle', 'Revisão'],
                ].map(([icon, label]) => (
                  <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <Icon
                      name={icon as 'folder' | 'shield' | 'check-circle'}
                      size={15}
                      color="#8AB9E5"
                    />
                    <Text style={{ fontFamily: t.fonts.medium, fontSize: 11, color: '#BCD0E2' }}>
                      {label}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={{ height: 1, backgroundColor: '#2C4660' }} />
              <Text style={{ color: '#A0B6CB', fontFamily: t.fonts.regular, fontSize: 10 }}>
                Weldcosta Inspeções Industriais · Gestão técnica
              </Text>
            </View>
          </View>
        )}
        <KeyboardScrollView
          testID="login-keyboard-scroll"
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            padding: desktop ? 48 : 24,
            paddingTop: desktop ? 80 : insets.top + 80,
            paddingBottom: insets.bottom + 24,
          }}
        >
          <View style={{ width: '100%', maxWidth: 392, alignSelf: 'center', gap: 30 }}>
            {!desktop && (
              <View style={{ marginBottom: 18 }}>
                <Brand />
              </View>
            )}
            <View style={{ gap: 12 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: t.colors.blueSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="shield" color={t.colors.blue} size={22} />
              </View>
              <Text style={[styles.caption, { color: t.colors.blue, marginTop: 9 }]}>
                SEU AMBIENTE DE TRABALHO
              </Text>
              <Text
                accessibilityRole="header"
                style={{
                  color: t.colors.text,
                  fontFamily: t.fonts.extra,
                  fontSize: 30,
                  lineHeight: 40,
                  letterSpacing: -1.1,
                }}
              >
                Bem-vindo de volta.
              </Text>
              <Text style={styles.muted}>Acesse sua conta para continuar suas inspeções.</Text>
            </View>
            <View style={{ gap: 20 }}>
              <Controller
                control={control}
                name="email"
                render={({ field }) => (
                  <Field
                    label="E-mail"
                    placeholder="nome@empresa.com.br"
                    icon="mail"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    autoComplete="email"
                    error={errors.email?.message}
                    returnKeyType="next"
                  />
                )}
              />
              <Controller
                control={control}
                name="password"
                render={({ field }) => (
                  <Field
                    label="Senha"
                    placeholder="Digite sua senha"
                    icon="lock"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    secureTextEntry={!showPassword}
                    autoComplete="current-password"
                    error={errors.password?.message}
                    returnKeyType="go"
                    onSubmitEditing={() => void submit()}
                    trailing={
                      <IconButton
                        icon={showPassword ? 'eye-off' : 'eye'}
                        label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        onPress={() => setShowPassword(!showPassword)}
                      />
                    }
                  />
                )}
              />
              <Notice error={error} />
              <Button
                title="Entrar no sistema"
                iconRight="arrow-right"
                busy={isSubmitting}
                onPress={() => void submit()}
                style={{ minHeight: 50, marginTop: 4 }}
              />
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Icon name="lock" size={13} color={t.colors.subtle} />
              <Text style={[styles.muted, { fontSize: 11 }]}>
                Acesso exclusivo a usuários autorizados
              </Text>
            </View>
            {!desktop && (
              <Text
                style={[styles.caption, { textAlign: 'center', marginTop: 16, letterSpacing: 0 }]}
              >
                Weldcosta · Inspeções Industriais
              </Text>
            )}
          </View>
        </KeyboardScrollView>
      </View>
    </View>
  );
}
