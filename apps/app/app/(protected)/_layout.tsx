import { useTheme } from '../../utils/theme';
import { requestNavigation } from '../../stores/navigation';
import { useEffect, useState } from 'react';
import { Pressable, Text, View, Modal, ScrollView, useWindowDimensions } from 'react-native';
import { Redirect, Slot, usePathname, router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { userRoleLabels, hasUserPermission, type CurrentUser } from '@weldcosta/shared';
import { useAuth } from '../../stores/auth';
import { api, jsonBody } from '../../services/api';
import { Brand } from '../../components/brand';
import { ThemeToggle } from '../../components/theme-toggle';
import { Icon, type IconName } from '../../components/icon';
import { Button, IconButton, Loading, Badge, selectionState } from '../../components/ui';
import { useKeyboardVisible } from '../../hooks/use-keyboard-visible';
import { PickerSheet } from '../../components/picker-sheet';

const links = [
  {
    label: 'Usuários',
    short: 'Usuários',
    path: '/users',
    icon: 'shield',
    permission: 'users.view',
  },
  {
    label: 'Pessoas e assinaturas',
    short: 'Pessoas',
    path: '/people',
    icon: 'user',
    permission: 'people.view',
  },
  {
    label: 'Visão geral',
    short: 'Início',
    path: '/dashboard',
    icon: 'dashboard',
    permission: 'reports.view',
  },
  {
    label: 'Empresas',
    short: 'Empresas',
    path: '/companies',
    icon: 'building',
    permission: 'companies.view',
  },
  {
    label: 'Obras',
    short: 'Obras',
    path: '/projects',
    icon: 'folder',
    permission: 'projects.view',
  },
  {
    label: 'Relatórios',
    short: 'Relatórios',
    path: '/reports',
    icon: 'report',
    permission: 'reports.view',
  },
  {
    label: 'Tutoriais',
    short: 'Tutoriais',
    path: '/tutorials',
    icon: 'book',
    permission: 'training.view',
  },
] as const;
export default function ProtectedLayout() {
  const { tokens: t, styles } = useTheme();
  const { session, ready, clear, setSession } = useAuth(),
    path = usePathname();
  const { width, height } = useWindowDimensions(),
    insets = useSafeAreaInsets(),
    desktop = width >= t.breakpoints.sidebar;
  const [profile, setProfile] = useState(false),
    [more, setMore] = useState(false),
    [leaving, setLeaving] = useState(false);
  const keyboardVisible = useKeyboardVisible();
  const client = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api<CurrentUser>('/auth/me'),
    enabled: ready && !!session,
    refetchOnWindowFocus: true,
  });
  useEffect(() => {
    if (me.data) {
      const current = useAuth.getState().session;
      if (current) void setSession({ ...current, user: me.data });
    }
  }, [me.data, setSession]);
  if (!ready) return <Loading />;
  if (!session) return <Redirect href="/login" />;
  const operator = session.user.role.code === 'OPERATOR';
  if (operator && !path.startsWith('/reports') && !path.startsWith('/tutorials'))
    return <Redirect href="/reports" />;
  const visibleLinks = links.filter(
    (link) =>
      hasUserPermission(session.user, link.permission) &&
      (!operator || link.path === '/reports' || link.path === '/tutorials'),
  );
  const canManageUsers = hasUserPermission(session.user, 'users.view');
  const canViewPeople = hasUserPermission(session.user, 'people.view');
  const hasMore = canManageUsers || canViewPeople;
  const extraPaths: readonly string[] = ['/users', '/people', '/tutorials'];
  const current = links.find((link) => path.startsWith(link.path));
  const initials = session.user.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const role = userRoleLabels[session.user.role.code] ?? session.user.role.name;
  const logout = async () => {
    setLeaving(true);
    try {
      await api('/auth/logout', jsonBody('POST', { refreshToken: session.refreshToken }), false);
    } finally {
      setProfile(false);
      await clear();
      client.clear();
      router.replace('/login');
      setLeaving(false);
    }
  };
  const avatar = (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: t.colors.blueSoft,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ fontFamily: t.fonts.bold, color: t.colors.blue, fontSize: 12 }}>
        {initials}
      </Text>
    </View>
  );
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: t.colors.background,
        flexDirection: 'row',
        paddingTop: insets.top,
        paddingLeft: insets.left,
        paddingRight: insets.right,
        paddingBottom: desktop && !keyboardVisible ? insets.bottom : 0,
      }}
    >
      {desktop && (
        <View
          style={{
            width: 248,
            backgroundColor: t.colors.surface,
            borderRightWidth: 1,
            borderColor: t.colors.line,
            paddingTop: 28,
            paddingHorizontal: 18,
          }}
        >
          <View style={{ paddingHorizontal: 5, paddingBottom: 30 }}>
            <Brand />
          </View>
          <Text
            style={[
              styles.caption,
              { paddingHorizontal: 14, marginBottom: 12, fontSize: 9, letterSpacing: 1.5 },
            ]}
          >
            AMBIENTE DE TRABALHO
          </Text>
          <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ gap: 6 }}>
            {visibleLinks.map((link) => (
              <NavLink key={link.path} link={link} selected={path.startsWith(link.path)} />
            ))}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir perfil"
            onPress={() => setProfile(true)}
            style={{
              borderTopWidth: 1,
              borderColor: t.colors.line,
              paddingVertical: 20,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            {avatar}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{ fontFamily: t.fonts.bold, color: t.colors.text, fontSize: 12 }}
              >
                {session.user.name}
              </Text>
              <Text style={[styles.muted, { fontSize: 10 }]}>{role}</Text>
            </View>
            <Icon name="chevron-down" size={15} />
          </Pressable>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{
            height: desktop ? 72 : keyboardVisible && height < 500 ? 48 : 64,
            backgroundColor: t.colors.surface,
            paddingHorizontal: desktop ? 32 : 20,
            borderBottomWidth: 1,
            borderColor: t.colors.line,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          {desktop ? (
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Icon name={current?.icon ?? 'dashboard'} size={17} color={t.colors.subtle} />
              <Text style={styles.muted}>Gestão técnica</Text>
              <Icon name="chevron-right" size={12} color={t.colors.subtle} />
              <Text style={{ fontFamily: t.fonts.semibold, color: t.colors.text, fontSize: 12 }}>
                {current?.label ?? 'Início'}
              </Text>
              {path.endsWith('/new') && (
                <>
                  <Icon name="chevron-right" size={12} />
                  <Text style={styles.muted}>Novo cadastro</Text>
                </>
              )}
            </View>
          ) : (
            <Brand compact />
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: desktop ? 16 : 8 }}>
            {desktop && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Icon name="calendar" size={16} color={t.colors.subtle} />
                <Text style={[styles.muted, { fontSize: 12 }]}>
                  {new Intl.DateTimeFormat('pt-BR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }).format(new Date())}
                </Text>
              </View>
            )}
            <ThemeToggle />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abrir perfil"
              onPress={() => setProfile(true)}
              style={{ padding: 3 }}
            >
              {avatar}
            </Pressable>
          </View>
        </View>
        <View style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
          <Slot />
        </View>
        {!desktop && !keyboardVisible && (
          <View
            testID="app-bottom-navigation"
            style={{
              flexDirection: 'row',
              backgroundColor: t.colors.surface,
              borderTopWidth: 1,
              borderColor: t.colors.line,
              paddingTop: 8,
              paddingBottom: insets.bottom + 8,
              paddingHorizontal: 8,
            }}
          >
            {visibleLinks
              .filter(
                (link) =>
                  link.path !== '/people' &&
                  link.path !== '/users' &&
                  (!hasMore || link.path !== '/tutorials'),
              )
              .map((link) => (
                <Pressable
                  key={link.path}
                  accessibilityRole="link"
                  accessibilityLabel={link.label}
                  accessibilityState={selectionState(path.startsWith(link.path))}
                  aria-current={path.startsWith(link.path) ? 'page' : undefined}
                  onPress={() => requestNavigation(() => router.push(link.path))}
                  style={{
                    flex: 1,
                    minHeight: 52,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                  }}
                >
                  <View
                    style={{
                      paddingHorizontal: 17,
                      paddingVertical: 4,
                      borderRadius: 9,
                      backgroundColor: path.startsWith(link.path)
                        ? t.colors.blueSoft
                        : 'transparent',
                    }}
                  >
                    <Icon
                      name={link.icon}
                      size={21}
                      color={path.startsWith(link.path) ? t.colors.blue : t.colors.muted}
                    />
                  </View>
                  <Text
                    style={{
                      fontFamily: path.startsWith(link.path) ? t.fonts.bold : t.fonts.medium,
                      fontSize: 10,
                      color: path.startsWith(link.path) ? t.colors.blue : t.colors.muted,
                    }}
                  >
                    {link.short}
                  </Text>
                </Pressable>
              ))}
            {hasMore && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Abrir menu Mais"
                onPress={() => setMore(true)}
                style={{
                  flex: 1,
                  minHeight: 52,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                }}
              >
                <View
                  style={{
                    paddingHorizontal: 17,
                    paddingVertical: 4,
                    borderRadius: 9,
                    backgroundColor: extraPaths.some((extra) => path.startsWith(extra))
                      ? t.colors.blueSoft
                      : 'transparent',
                  }}
                >
                  <Icon
                    name="menu"
                    size={21}
                    color={
                      extraPaths.some((extra) => path.startsWith(extra))
                        ? t.colors.blue
                        : t.colors.muted
                    }
                  />
                </View>
                <Text
                  style={{
                    fontFamily: t.fonts.medium,
                    fontSize: 10,
                    color: extraPaths.some((extra) => path.startsWith(extra))
                      ? t.colors.blue
                      : t.colors.muted,
                  }}
                >
                  Mais
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
      <PickerSheet
        visible={more}
        title="Mais opções"
        subtitle="Administração e atalhos do sistema."
        icon="menu"
        onClose={() => setMore(false)}
      >
        {visibleLinks
          .filter((link) => extraPaths.includes(link.path))
          .map((link) => (
            <Button
              key={link.path}
              title={link.label}
              icon={link.icon}
              secondary
              onPress={() => {
                setMore(false);
                requestNavigation(() => router.push(link.path));
              }}
            />
          ))}
      </PickerSheet>
      <Modal
        accessibilityLabel="Sua conta"
        visible={profile}
        transparent
        animationType="fade"
        onRequestClose={() => setProfile(false)}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Pressable
            accessibilityLabel="Fechar perfil"
            onPress={() => setProfile(false)}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: 'rgba(15,30,48,0.35)',
            }}
          />
          <View style={[styles.card, { width: '100%', maxWidth: 360, gap: 20 }]}>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <Text style={{ fontFamily: t.fonts.bold, fontSize: 16, color: t.colors.text }}>
                Sua conta
              </Text>
              <IconButton icon="close" label="Fechar perfil" onPress={() => setProfile(false)} />
            </View>
            <View style={styles.row}>
              {avatar}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.text}>{session.user.name}</Text>
                <Text style={styles.muted}>{session.user.email}</Text>
              </View>
            </View>
            <Badge label={role} tone="blue" dot={false} />
            {canManageUsers && (
              <Button
                title="Gerenciar usuários"
                icon="shield"
                secondary
                onPress={() => {
                  setProfile(false);
                  requestNavigation(() => router.push('/users'));
                }}
              />
            )}
            {canViewPeople && (
              <Button
                title="Pessoas e assinaturas"
                icon="user"
                secondary
                onPress={() => {
                  setProfile(false);
                  requestNavigation(() => router.push('/people'));
                }}
              />
            )}
            <Button
              title="Sair do sistema"
              icon="logout"
              secondary
              busy={leaving}
              onPress={() => {
                setProfile(false);
                requestNavigation(() => void logout());
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
function NavLink({
  link,
  selected,
}: {
  link: {
    label: string;
    path: (typeof links)[number]['path'];
    icon: IconName;
  };
  selected: boolean;
}) {
  const { tokens: t } = useTheme();
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={link.label}
      accessibilityState={selectionState(selected)}
      aria-current={selected ? 'page' : undefined}
      onPress={() => requestNavigation(() => router.push(link.path))}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 14,
        minHeight: 48,
        borderRadius: 9,
        backgroundColor: selected ? t.colors.blueSoft : hover ? t.colors.soft : 'transparent',
      }}
    >
      <Icon name={link.icon} color={selected ? t.colors.blue : t.colors.muted} size={20} />
      <Text
        style={{
          fontFamily: selected ? t.fonts.bold : t.fonts.medium,
          color: selected ? t.colors.blue : t.colors.muted,
          fontSize: 13,
          flex: 1,
        }}
      >
        {link.label}
      </Text>
      {selected && (
        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.colors.blue }} />
      )}
    </Pressable>
  );
}
