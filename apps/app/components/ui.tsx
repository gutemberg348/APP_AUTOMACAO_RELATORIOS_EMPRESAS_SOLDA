import { useTheme } from '../utils/theme';
import {
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Icon, type IconName } from './icon';
import { MaskedTextInput } from './masked-text-input';
import type { InputMask } from '../utils/input-masks';
import { PageScrollContext } from './page-scroll';
import { InputVisibilityContext } from './input-visibility';
import { router, type Href } from 'expo-router';
import { requestNavigation } from '../stores/navigation';
export const selectionState = (selected: boolean, disabled?: boolean) =>
  Platform.OS === 'web' ? { disabled } : { selected, disabled };

export function Page({
  title,
  subtitle,
  action,
  eyebrow,
  back,
  children,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  action?: ReactNode;
  eyebrow?: string;
  back?: { label: string; href: Href };
}>) {
  const { tokens: t, styles } = useTheme();
  const { width } = useWindowDimensions();
  const mobile = width < 640;
  const scroll = useRef<ScrollView>(null);
  const viewport = useRef<View>(null);
  const offset = useRef(0);
  const reveal = useCallback((target?: View | null) => {
    if (!target) {
      scroll.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    viewport.current?.measureInWindow((_x, top) => {
      target.measureInWindow((_targetX, targetTop) => {
        scroll.current?.scrollTo({
          y: Math.max(0, offset.current + targetTop - top - 24),
          animated: true,
        });
      });
    });
  }, []);
  return (
    <View ref={viewport} style={{ flex: 1, minWidth: 0 }}>
      <PageScrollContext.Provider value={reveal}>
        <ScrollView
          ref={scroll}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          onScroll={(event) => {
            offset.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          style={{ flex: 1, minWidth: 0 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.page,
            mobile && { padding: 20, gap: 20, paddingBottom: 32 },
          ]}
        >
          {back && (
            <View style={{ alignSelf: 'flex-start' }}>
              <Button
                title={back.label}
                icon="arrow-left"
                secondary
                small
                onPress={() => requestNavigation(() => router.push(back.href))}
              />
            </View>
          )}
          <View
            style={{
              flexDirection: mobile ? 'column' : 'row',
              gap: 16,
              alignItems: mobile ? 'stretch' : 'center',
              justifyContent: 'space-between',
              minWidth: 0,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              {eyebrow && (
                <Text style={[styles.caption, { color: t.colors.blue, marginBottom: 5 }]}>
                  {eyebrow.toUpperCase()}
                </Text>
              )}
              <Text
                accessibilityRole="header"
                style={[styles.heading, mobile && { fontSize: 26, lineHeight: 35 }]}
              >
                {title}
              </Text>
              {subtitle && <Text style={[styles.muted, { marginTop: 5 }]}>{subtitle}</Text>}
            </View>
            {action && <View style={{ alignSelf: mobile ? 'stretch' : 'center' }}>{action}</View>}
          </View>
          {children}
        </ScrollView>
      </PageScrollContext.Provider>
    </View>
  );
}
export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const { styles } = useTheme();
  return <View style={[styles.card, style]}>{children}</View>;
}
export function PanelHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  action?: ReactNode;
}) {
  const { tokens: t, styles } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
        alignItems: 'center',
      }}
    >
      {icon && <IconTile name={icon} size={36} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          accessibilityRole="header"
          style={{ fontFamily: t.fonts.bold, fontSize: 15, color: t.colors.text, lineHeight: 23 }}
        >
          {title}
        </Text>
        {subtitle && <Text style={[styles.muted, { fontSize: 12 }]}>{subtitle}</Text>}
      </View>
      {action}
    </View>
  );
}
export function IconTile({
  name,
  size = 42,
  color,
  background,
}: {
  name: IconName;
  size?: number;
  color?: string;
  background?: string;
}) {
  const { tokens: t } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        backgroundColor: background ?? t.colors.blueSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={name} color={color ?? t.colors.blue} size={size < 40 ? 18 : 21} />
    </View>
  );
}
export function Button({
  title,
  onPress,
  secondary,
  disabled,
  busy,
  icon,
  iconRight,
  variant,
  small,
  style,
}: {
  title: string;
  onPress(): void;
  secondary?: boolean;
  disabled?: boolean;
  busy?: boolean;
  icon?: IconName;
  iconRight?: IconName;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { tokens: t, styles } = useTheme();
  const [hover, setHover] = useState(false),
    [focus, setFocus] = useState(false);
  const kind = variant ?? (secondary ? 'secondary' : 'primary');
  const foreground =
    kind === 'primary'
      ? 'white'
      : kind === 'danger'
        ? t.colors.danger
        : kind === 'ghost'
          ? t.colors.blue
          : t.colors.text;
  const bg =
    kind === 'primary'
      ? hover
        ? t.colors.primaryHover
        : t.colors.primary
      : kind === 'danger'
        ? t.colors.dangerSoft
        : kind === 'ghost'
          ? hover
            ? t.colors.blueSoft
            : 'transparent'
          : hover
            ? t.colors.hover
            : t.colors.surface;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          borderColor: focus ? t.colors.blue : kind === 'secondary' ? t.colors.line : 'transparent',
        },
        small && { minHeight: 36, paddingVertical: 7, paddingHorizontal: 12 },
        (disabled || busy) && { opacity: 0.48 },
        pressed && { opacity: 0.8 },
        focus && { boxShadow: '0 0 0 3px rgba(23,100,192,0.17)' },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : (
        icon && <Icon name={icon} size={17} color={foreground} />
      )}
      <Text
        style={{
          color: foreground,
          fontSize: small ? 12 : 13,
          fontFamily: t.fonts.bold,
          flexShrink: 1,
          textAlign: 'center',
        }}
      >
        {busy ? 'Aguarde…' : title}
      </Text>
      {!busy && iconRight && <Icon name={iconRight} size={17} color={foreground} />}
    </Pressable>
  );
}
export function IconButton({
  icon,
  label,
  onPress,
  small,
  danger,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  onPress(): void;
  small?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const { tokens: t } = useTheme();
  const [hover, setHover] = useState(false),
    [focus, setFocus] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      hitSlop={4}
      style={{
        width: small ? 36 : 44,
        opacity: disabled ? 0.4 : 1,
        height: small ? 36 : 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        backgroundColor:
          hover || focus ? (danger ? t.colors.dangerSoft : t.colors.blueSoft) : 'transparent',
        borderWidth: 1,
        borderColor: focus ? t.colors.blue : 'transparent',
      }}
    >
      <Icon name={icon} size={18} color={danger ? t.colors.danger : t.colors.muted} />
    </Pressable>
  );
}
export function Field({
  label,
  mask,
  error,
  hint,
  icon,
  trailing,
  hideLabel,
  required,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & {
  label: string;
  mask?: InputMask;
  error?: string;
  hint?: string;
  icon?: IconName;
  trailing?: ReactNode;
  hideLabel?: boolean;
  required?: boolean;
}) {
  const { tokens: t, styles } = useTheme();
  const [focus, setFocus] = useState(false);
  const container = useRef<View>(null);
  const revealInput = useContext(InputVisibilityContext);
  const mobile = useWindowDimensions().width < 640;
  const id = useId();
  const readonly = props.editable === false;
  const inputProps: TextInputProps = {
    nativeID: id,
    accessibilityLabel: label,
    accessibilityHint: hint,
    placeholderTextColor: t.colors.subtle,
    ...props,
    onFocus: (event) => {
      setFocus(true);
      revealInput?.(container.current);
      onFocus?.(event);
    },
    onBlur: (event) => {
      setFocus(false);
      onBlur?.(event);
    },
    style: [
      styles.input,
      mobile && { fontSize: 16 },
      props.multiline && { minHeight: 116, textAlignVertical: 'top' },
      { outlineWidth: 0 } as TextInputProps['style'],
      props.style,
    ],
  };
  return (
    <View style={{ gap: 5, minWidth: 0 }}>
      {!hideLabel && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={styles.label}>{label}</Text>
          {required && <Text style={{ color: t.colors.blue }}>*</Text>}
          {readonly && <Icon name="lock" size={12} color={t.colors.subtle} />}
        </View>
      )}
      <View
        ref={container}
        collapsable={false}
        style={{
          flexDirection: 'row',
          alignItems: props.multiline ? 'flex-start' : 'center',
          minHeight: 48,
          borderRadius: 9,
          borderWidth: 1,
          borderColor: error ? t.colors.danger : focus ? t.colors.blue : t.colors.line,
          backgroundColor: readonly ? t.colors.disabled : t.colors.surface,
          ...(focus ? { boxShadow: '0 0 0 3px rgba(23,100,192,0.10)' } : {}),
        }}
      >
        {icon && (
          <View style={{ paddingLeft: 13, paddingTop: props.multiline ? 15 : 0 }}>
            <Icon name={icon} size={18} color={focus ? t.colors.blue : t.colors.subtle} />
          </View>
        )}
        {mask ? <MaskedTextInput {...inputProps} mask={mask} /> : <TextInput {...inputProps} />}
        {trailing && <View style={{ marginRight: 4 }}>{trailing}</View>}
      </View>
      {error ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{ color: t.colors.danger, fontSize: 12, fontFamily: t.fonts.medium }}
        >
          {error}
        </Text>
      ) : (
        hint && <Text style={[styles.muted, { fontSize: 11 }]}>{hint}</Text>
      )}
    </View>
  );
}
export function SearchField({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText(value: string): void;
  placeholder?: string;
}) {
  return (
    <Field
      hideLabel
      label={label}
      placeholder={placeholder ?? label}
      value={value}
      onChangeText={onChangeText}
      icon="search"
      autoCapitalize="none"
      autoCorrect={false}
      trailing={
        value ? (
          <IconButton small icon="close" label="Limpar busca" onPress={() => onChangeText('')} />
        ) : undefined
      }
    />
  );
}
export function Notice({ error, guidance }: { error?: unknown; guidance?: string }) {
  const { tokens: t } = useTheme();
  return error ? (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        borderWidth: 1,
        borderColor: t.colors.dangerBorder,
        backgroundColor: t.colors.dangerSoft,
        padding: 14,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
      }}
    >
      <Icon name="alert" size={18} color={t.colors.danger} />
      <View style={{ flex: 1, gap: 6 }}>
        <Text
          style={{
            color: t.colors.danger,
            fontSize: 13,
            fontFamily: t.fonts.medium,
            lineHeight: 21,
          }}
        >
          {error instanceof Error ? error.message : String(error)}
        </Text>
        {!!guidance && (
          <Text
            style={{
              color: t.colors.danger,
              fontSize: 12,
              lineHeight: 19,
              fontFamily: t.fonts.medium,
            }}
          >
            {guidance}
          </Text>
        )}
      </View>
    </View>
  ) : null;
}
export function Info({ text, icon = 'shield' }: { text: string; icon?: IconName }) {
  const { tokens: t, styles } = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.colors.blueSoft,
        padding: 14,
        borderRadius: 10,
        flexDirection: 'row',
        gap: 10,
      }}
    >
      <Icon name={icon} color={t.colors.blue} size={18} />
      <Text style={[styles.muted, { flex: 1, color: t.colors.infoText, fontSize: 12 }]}>
        {text}
      </Text>
    </View>
  );
}
export function Loading() {
  const { tokens: t, styles } = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Carregando conteúdo"
      style={{ padding: 36, alignItems: 'center', gap: 12 }}
    >
      <ActivityIndicator color={t.colors.blue} />
      <Text style={styles.muted}>Carregando…</Text>
    </View>
  );
}
export function Empty({
  text,
  title = 'Tudo organizado por aqui',
  icon = 'folder',
  action,
}: {
  text: string;
  title?: string;
  icon?: IconName;
  action?: ReactNode;
}) {
  const { tokens: t, styles } = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        paddingVertical: 42,
        paddingHorizontal: 24,
        gap: 12,
        backgroundColor: t.colors.surface,
        borderWidth: 1,
        borderColor: t.colors.line,
        borderRadius: 14,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          backgroundColor: t.colors.blueSoft,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 4,
        }}
      >
        <Icon name={icon} size={28} color={t.colors.blue} />
      </View>
      <Text
        style={{
          fontFamily: t.fonts.bold,
          color: t.colors.text,
          fontSize: 15,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      <Text style={[styles.muted, { textAlign: 'center', maxWidth: 350 }]}>{text}</Text>
      {action && <View style={{ marginTop: 8 }}>{action}</View>}
    </View>
  );
}
export function Choice({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress(): void;
  disabled?: boolean;
}) {
  const { tokens: t } = useTheme();
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selectionState(selected, disabled)}
      aria-pressed={selected}
      disabled={disabled}
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={{
        minHeight: 44,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: selected ? t.colors.selectionBorder : t.colors.line,
        backgroundColor: selected ? t.colors.blueSoft : hover ? t.colors.soft : t.colors.surface,
        opacity: disabled ? 0.5 : 1,
        justifyContent: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
      }}
    >
      {selected && <Icon name="check" size={14} color={t.colors.blue} />}
      <Text
        style={{
          color: selected ? t.colors.blue : t.colors.muted,
          fontFamily: selected ? t.fonts.bold : t.fonts.medium,
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Pager({
  page,
  pages,
  onChange,
  total,
}: {
  page: number;
  pages: number;
  onChange(page: number): void;
  total?: number;
}) {
  const { styles } = useTheme();
  return (
    <View style={[styles.row, { justifyContent: 'space-between', paddingTop: 8 }]}>
      <Text style={styles.muted}>
        {total !== undefined ? total + ' registro' + (total === 1 ? '' : 's') + ' · ' : ''}Página{' '}
        {page} de {Math.max(pages, 1)}
      </Text>
      <View style={styles.row}>
        <Button
          title="Anterior"
          secondary
          small
          icon="arrow-left"
          disabled={page <= 1}
          onPress={() => onChange(page - 1)}
        />
        <Button
          title="Próxima"
          secondary
          small
          iconRight="arrow-right"
          disabled={page >= pages}
          onPress={() => onChange(page + 1)}
        />
      </View>
    </View>
  );
}
export function FormGrid({ children }: PropsWithChildren) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20, minWidth: 0 }}>{children}</View>
  );
}
export function FormCell({ children, full }: PropsWithChildren<{ full?: boolean }>) {
  const { width } = useWindowDimensions();
  return (
    <View style={{ width: width >= 740 && !full ? '47.8%' : '100%', flexGrow: 1, minWidth: 0 }}>
      {children}
    </View>
  );
}
export function Divider() {
  const { tokens: t } = useTheme();
  return <View style={{ height: 1, backgroundColor: t.colors.line }} />;
}
export function Badge({
  label,
  tone = 'neutral',
  dot = true,
}: {
  label: string;
  tone?: 'neutral' | 'blue' | 'green' | 'amber' | 'danger';
  dot?: boolean;
}) {
  const { tokens: t } = useTheme();
  const palette = {
    neutral: [t.colors.muted, t.colors.neutralSoft],
    blue: [t.colors.blue, t.colors.blueSoft],
    green: [t.colors.green, t.colors.greenSoft],
    amber: [t.colors.amber, t.colors.amberSoft],
    danger: [t.colors.danger, t.colors.dangerSoft],
  }[tone];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 6,
        backgroundColor: palette[1],
      }}
    >
      {dot && (
        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: palette[0] }} />
      )}
      <Text style={{ fontSize: 11, fontFamily: t.fonts.semibold, color: palette[0] }}>{label}</Text>
    </View>
  );
}
